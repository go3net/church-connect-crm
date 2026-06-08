import type { WorkflowTrigger } from "@prisma/client";
import { db } from "@/lib/db";
import { dispatchMessage } from "@/lib/messaging";

/**
 * Enroll a person into the active workflow for a trigger.
 * Sets nextRunAt to the first step's offset so the cron picks it up.
 */
export async function enrollPerson(opts: {
  churchId: string;
  trigger: WorkflowTrigger;
  memberId?: string | null;
  firstTimerId?: string | null;
}): Promise<string | null> {
  const workflow = await db.automationWorkflow.findFirst({
    where: { churchId: opts.churchId, trigger: opts.trigger, isActive: true },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!workflow || workflow.steps.length === 0) return null;

  const enrolledAt = new Date();
  const firstOffset = workflow.steps[0].offsetDays;
  const nextRunAt = addDays(enrolledAt, firstOffset);

  const enrollment = await db.automationEnrollment.create({
    data: {
      churchId: opts.churchId,
      workflowId: workflow.id,
      memberId: opts.memberId ?? null,
      firstTimerId: opts.firstTimerId ?? null,
      currentStep: 0,
      status: "ACTIVE",
      enrolledAt,
      nextRunAt,
    },
  });
  return enrollment.id;
}

/**
 * Cron entrypoint: process all due enrollments across all tenants.
 * Runs the current step (message or follow-up task), then schedules the next.
 */
export async function advanceDueEnrollments(opts: {
  churchId?: string;
  limit?: number;
} = {}): Promise<{
  processed: number;
  completed: number;
  errors: number;
}> {
  const { churchId, limit = 500 } = opts;
  const due = await db.automationEnrollment.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: new Date() },
      ...(churchId ? { churchId } : {}),
    },
    take: limit,
    include: {
      workflow: { include: { steps: { orderBy: { order: "asc" } } } },
      member: true,
      firstTimer: true,
    },
  });

  let processed = 0;
  let completed = 0;
  let errors = 0;

  const now = new Date();
  for (const e of due) {
    try {
      let currentStep = e.currentStep;

      // run EVERY step whose scheduled time has already elapsed (handles
      // multiple same-day steps, e.g. Day-0 welcome WhatsApp + SMS, and
      // catches up if the cron missed a run).
      while (true) {
        const step = e.workflow.steps[currentStep];
        if (!step) {
          await db.automationEnrollment.update({
            where: { id: e.id },
            data: { status: "COMPLETED", completedAt: new Date(), nextRunAt: null },
          });
          completed++;
          break;
        }

        const scheduledAt = addDays(e.enrolledAt, step.offsetDays);
        if (scheduledAt > now) {
          // next step is in the future — park the enrollment until then
          await db.automationEnrollment.update({
            where: { id: e.id },
            data: { currentStep, nextRunAt: scheduledAt },
          });
          break;
        }

        const person = e.member ?? e.firstTimer;
        if (person) {
          if (step.createsFollowUp) {
            await createFollowUpForStep(e, step.followUpType ?? "CALL");
          } else {
            await runMessageStep(e, step.templateId, step.channel);
          }
        }
        processed++;
        currentStep++;
      }
    } catch (err) {
      errors++;
      console.error(`[automation] enrollment ${e.id} failed`, err);
    }
  }

  return { processed, completed, errors };
}

async function runMessageStep(
  e: { id: string; churchId: string; member: any; firstTimer: any },
  templateId: string | null,
  channel: "WHATSAPP" | "SMS" | "EMAIL"
) {
  const template = templateId
    ? await db.messageTemplate.findUnique({ where: { id: templateId } })
    : null;
  if (!template) return;

  const person = e.member ?? e.firstTimer;
  const church = await db.church.findUnique({ where: { id: e.churchId } });

  await dispatchMessage({
    churchId: e.churchId,
    branchId: person.branchId ?? null,
    channel,
    person: {
      memberId: e.member?.id ?? null,
      firstTimerId: e.firstTimer?.id ?? null,
      firstName: person.firstName,
      lastName: person.lastName,
      phone: person.phone,
      email: person.email,
    },
    body: template.body,
    subject: template.subject,
    templateId: template.id,
    enrollmentId: e.id,
    waTemplateName: template.waTemplateName,
    waPhoneId: church?.waPhoneId,
    smsSenderId: church?.senderId,
  });
}

async function createFollowUpForStep(
  e: { id: string; churchId: string; member: any; firstTimer: any },
  type: "CALL" | "WHATSAPP" | "HOME_VISIT" | "PRAYER"
) {
  const person = e.member ?? e.firstTimer;

  // prefer the person's active assignment owner, else any admin/pastor
  const assignment = await db.assignment.findFirst({
    where: {
      churchId: e.churchId,
      isActive: true,
      ...(e.member ? { memberId: e.member.id } : { firstTimerId: e.firstTimer.id }),
    },
  });
  const assigneeId =
    assignment?.assignedToId ??
    (
      await db.user.findFirst({
        where: { churchId: e.churchId, role: { in: ["CHURCH_ADMIN", "PASTOR"] }, isActive: true },
        select: { id: true },
      })
    )?.id;
  if (!assigneeId) return;

  await db.followUp.create({
    data: {
      churchId: e.churchId,
      branchId: person.branchId ?? null,
      assignedToId: assigneeId,
      memberId: e.member?.id ?? null,
      firstTimerId: e.firstTimer?.id ?? null,
      type,
      status: "PENDING",
      enrollmentId: e.id,
      dueDate: new Date(),
    },
  });
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
