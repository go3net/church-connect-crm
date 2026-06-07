import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui";
import { Users, UserPlus, CalendarHeart, PhoneCall, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

async function getStats(churchId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const [totalMembers, totalFirstTimers, newThisMonth, dueFollowUps, birthdays] =
    await Promise.all([
      db.member.count({ where: { churchId, deletedAt: null } }),
      db.firstTimer.count({ where: { churchId, deletedAt: null, isConverted: false } }),
      db.member.count({ where: { churchId, deletedAt: null, createdAt: { gte: monthStart } } }),
      db.followUp.count({ where: { churchId, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM "Member"
        WHERE "churchId" = ${churchId} AND "deletedAt" IS NULL
          AND "dateOfBirth" IS NOT NULL
          AND EXTRACT(MONTH FROM "dateOfBirth") = ${month}
          AND EXTRACT(DAY FROM "dateOfBirth") = ${day}`,
    ]);

  return {
    totalMembers,
    totalFirstTimers,
    newThisMonth,
    dueFollowUps,
    birthdaysToday: Number(birthdays[0]?.count ?? 0),
  };
}

const STAT_CARDS = [
  { key: "totalMembers", label: "Total Members", icon: Users },
  { key: "totalFirstTimers", label: "Active First Timers", icon: UserPlus },
  { key: "newThisMonth", label: "New This Month", icon: TrendingUp },
  { key: "birthdaysToday", label: "Birthdays Today", icon: CalendarHeart },
  { key: "dueFollowUps", label: "Follow-ups Due", icon: PhoneCall },
] as const;

export default async function DashboardPage() {
  const session = await auth();
  const churchId = session!.user.churchId!;
  const stats = await getStats(churchId);
  const church = await db.church.findUnique({ where: { id: churchId }, select: { name: true } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{church?.name ?? "Dashboard"}</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {session!.user.name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {STAT_CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.key} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 text-3xl font-bold">
                {(stats as Record<string, number>)[c.key]}
              </p>
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <h2 className="mb-2 font-semibold">Quick start</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Register a guest under <strong>First Timers</strong> — they are auto-enrolled in the welcome journey.</li>
          <li>When a guest returns, open their record and <strong>Convert to member</strong>.</li>
          <li><strong>Follow-ups</strong> shows your team&apos;s outstanding calls, visits and prayers.</li>
        </ul>
      </Card>
    </div>
  );
}
