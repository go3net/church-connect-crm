import { db } from "@/lib/db";

/**
 * Seed a brand-new church with sensible defaults so automation works out of the
 * box: message templates + the Day 0→30 First-Timer Journey workflow, plus
 * birthday/anniversary templates. Idempotent (upserts by churchId+name).
 */
export async function provisionChurchDefaults(churchId: string): Promise<void> {
  const templates = [
    { name: "Welcome (WhatsApp)", channel: "WHATSAPP" as const, category: "welcome",
      body: "Hello {{firstName}}, thank you for worshipping with us today. We hope you were blessed. Kindly reply and tell us how today's service impacted you. We look forward to seeing you again." },
    { name: "Welcome (SMS)", channel: "SMS" as const, category: "welcome",
      body: "Hello {{firstName}}, thank you for worshipping with us today. We look forward to seeing you again!" },
    { name: "Day 2 Follow-up", channel: "WHATSAPP" as const, category: "followup",
      body: "Hi {{firstName}}, it was a joy having you. Is there anything we can pray with you about this week?" },
    { name: "Day 7 Check-in", channel: "WHATSAPP" as const, category: "followup",
      body: "Hello {{firstName}}, how has your week been? We'd love to see you again this Sunday." },
    { name: "Day 14 Invitation", channel: "WHATSAPP" as const, category: "invite",
      body: "Hi {{firstName}}, our next service promises to be a blessing. Will you join us this Sunday? We're saving a seat for you." },
    { name: "Day 30 Membership", channel: "WHATSAPP" as const, category: "invite",
      body: "{{firstName}}, we'd love for you to become part of our family. Reply to learn about our membership class." },
    { name: "Birthday Greeting", channel: "WHATSAPP" as const, category: "birthday",
      body: "Happy Birthday {{firstName}}. We celebrate you today and pray that God grants you greater grace, favour, and blessings." },
    { name: "Anniversary Greeting", channel: "WHATSAPP" as const, category: "anniversary",
      body: "Congratulations on your wedding anniversary {{firstName}}. May God continue to strengthen your home with love, peace, and joy." },
  ];

  const tplIds: Record<string, string> = {};
  for (const t of templates) {
    const rec = await db.messageTemplate.upsert({
      where: { churchId_name: { churchId, name: t.name } },
      update: {},
      create: { churchId, ...t },
    });
    tplIds[t.name] = rec.id;
  }

  const workflow = await db.automationWorkflow.upsert({
    where: { churchId_name: { churchId, name: "First-Timer Journey" } },
    update: {},
    create: {
      churchId,
      name: "First-Timer Journey",
      description: "Day 0 → 30 automated welcome & follow-up",
      trigger: "FIRST_TIMER_REGISTERED",
      isActive: true,
    },
  });

  const steps = [
    { order: 1, offsetDays: 0, channel: "WHATSAPP" as const, templateId: tplIds["Welcome (WhatsApp)"] },
    { order: 2, offsetDays: 0, channel: "SMS" as const, templateId: tplIds["Welcome (SMS)"] },
    { order: 3, offsetDays: 2, channel: "WHATSAPP" as const, templateId: tplIds["Day 2 Follow-up"] },
    { order: 4, offsetDays: 7, channel: "WHATSAPP" as const, templateId: tplIds["Day 7 Check-in"] },
    { order: 5, offsetDays: 14, channel: "WHATSAPP" as const, templateId: tplIds["Day 14 Invitation"] },
    { order: 6, offsetDays: 30, channel: "WHATSAPP" as const, templateId: tplIds["Day 30 Membership"] },
  ];
  for (const s of steps) {
    await db.automationStep.upsert({
      where: { workflowId_order: { workflowId: workflow.id, order: s.order } },
      update: {},
      create: { workflowId: workflow.id, ...s },
    });
  }
}

/** Ensure the global Plan catalog exists; returns the Free plan id. */
export async function ensurePlansAndGetFree(): Promise<string> {
  const plans = [
    { name: "Free", slug: "free", priceKobo: 0, maxBranches: 1, maxMembers: 100, maxStaff: 2, monthlyMessageQuota: 100,
      features: ["First-timer capture", "Manual follow-up", "1 branch"] },
    { name: "Starter", slug: "starter", priceKobo: 1_500_000, maxBranches: 1, maxMembers: 500, maxStaff: 5, monthlyMessageQuota: 2000,
      features: ["Automation engine", "WhatsApp + SMS", "Birthday automation"] },
    { name: "Growth", slug: "growth", priceKobo: 4_000_000, maxBranches: 3, maxMembers: 2000, maxStaff: 20, monthlyMessageQuota: 8000,
      features: ["Multi-branch", "Engagement scoring", "AI follow-up suggestions", "Reports"] },
    { name: "Pro", slug: "pro", priceKobo: 10_000_000, maxBranches: 25, maxMembers: 20000, maxStaff: 200, monthlyMessageQuota: 40000,
      features: ["Unlimited automation", "Priority support", "Custom templates", "API access"] },
  ];
  for (const p of plans) {
    await db.plan.upsert({
      where: { slug: p.slug },
      update: {},
      create: { ...p, features: p.features as any },
    });
  }
  const free = await db.plan.findUniqueOrThrow({ where: { slug: "free" } });
  return free.id;
}
