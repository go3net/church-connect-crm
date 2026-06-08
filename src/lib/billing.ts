import { db } from "@/lib/db";

export interface BillingState {
  subscription: {
    status: string;
    currentPeriodEnd: Date | null;
    messagesUsed: number;
    topUpBalance: number;
  } | null;
  plan: {
    name: string;
    priceKobo: number;
    maxMembers: number;
    maxStaff: number;
    maxBranches: number;
    monthlyMessageQuota: number;
  } | null;
  usage: { members: number; staff: number; branches: number };
}

/** Current subscription, plan, and live usage for a church. */
export async function getBillingState(churchId: string): Promise<BillingState> {
  const [sub, members, staff, branches] = await Promise.all([
    db.subscription.findUnique({
      where: { churchId },
      include: { plan: true },
    }),
    db.member.count({ where: { churchId, deletedAt: null } }),
    db.user.count({ where: { churchId, deletedAt: null, isActive: true } }),
    db.branch.count({ where: { churchId, deletedAt: null } }),
  ]);

  return {
    subscription: sub
      ? {
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd,
          messagesUsed: sub.messagesUsed,
          topUpBalance: sub.topUpBalance,
        }
      : null,
    plan: sub?.plan
      ? {
          name: sub.plan.name,
          priceKobo: sub.plan.priceKobo,
          maxMembers: sub.plan.maxMembers,
          maxStaff: sub.plan.maxStaff,
          maxBranches: sub.plan.maxBranches,
          monthlyMessageQuota: sub.plan.monthlyMessageQuota,
        }
      : null,
    usage: { members, staff, branches },
  };
}

/** Activate/upgrade a church's subscription to a plan for one billing period. */
export async function activateSubscription(opts: {
  churchId: string;
  planId: string;
  reference: string;
  amountKobo: number;
}): Promise<void> {
  const plan = await db.plan.findUnique({ where: { id: opts.planId } });
  if (!plan) throw new Error("Plan not found");

  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + (plan.interval === "YEARLY" ? 12 : 1));

  const sub = await db.subscription.upsert({
    where: { churchId: opts.churchId },
    create: {
      churchId: opts.churchId,
      planId: plan.id,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: end,
      messagesUsed: 0,
    },
    update: {
      planId: plan.id,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: end,
      messagesUsed: 0, // reset usage on (re)activation
    },
  });

  // idempotent invoice (reference is unique)
  await db.invoice.upsert({
    where: { paystackRef: opts.reference },
    create: {
      subscriptionId: sub.id,
      amountKobo: opts.amountKobo,
      status: "paid",
      paystackRef: opts.reference,
      periodStart: now,
      periodEnd: end,
      paidAt: now,
    },
    update: {},
  });
}
