import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, Badge } from "@/components/ui";
import { fullName, cn } from "@/lib/utils";
import { Users, UserPlus, CalendarHeart, PhoneCall, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

async function getLists(churchId: string) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const [birthdays, dueFollowUps, recentFirstTimers] = await Promise.all([
    db.$queryRaw<{ id: string; firstName: string; lastName: string; phone: string }[]>`
      SELECT id, "firstName", "lastName", phone FROM "Member"
      WHERE "churchId" = ${churchId} AND "deletedAt" IS NULL AND "dateOfBirth" IS NOT NULL
        AND EXTRACT(MONTH FROM "dateOfBirth") = ${month} AND EXTRACT(DAY FROM "dateOfBirth") = ${day}
      LIMIT 8`,
    db.followUp.findMany({
      where: { churchId, status: { in: ["PENDING", "IN_PROGRESS"] } },
      include: { member: { select: { firstName: true, lastName: true } }, firstTimer: { select: { firstName: true, lastName: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    db.firstTimer.findMany({
      where: { churchId, deletedAt: null, isConverted: false },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  return { birthdays, dueFollowUps, recentFirstTimers };
}

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
  const [stats, lists] = await Promise.all([getStats(churchId), getLists(churchId)]);
  const church = await db.church.findUnique({ where: { id: churchId }, select: { name: true } });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Welcome back, {session!.user.name}</p>
        <h1 className="text-2xl font-bold md:text-3xl">{church?.name ?? "Dashboard"}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
        {STAT_CARDS.map((c, i) => {
          const Icon = c.icon;
          const highlight = i === 0; // feature the first metric in black
          return (
            <Card
              key={c.key}
              className={cn(
                "p-5",
                highlight && "border-transparent brand-gradient text-white shadow-soft"
              )}
            >
              <div
                className={cn(
                  "mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg",
                  highlight ? "bg-brand-yellow text-neutral-900" : "bg-neutral-900 text-brand-yellow"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <p className={cn("text-3xl font-bold tabular-nums", highlight && "text-white")}>
                {(stats as Record<string, number>)[c.key]}
              </p>
              <p className={cn("mt-0.5 text-sm", highlight ? "text-neutral-300" : "text-muted-foreground")}>
                {c.label}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <CalendarHeart className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Birthdays today</h2>
          </div>
          <div className="space-y-2 text-sm">
            {lists.birthdays.map((b) => (
              <div key={b.id} className="flex justify-between">
                <span>{b.firstName} {b.lastName}</span>
                <span className="text-muted-foreground">{b.phone}</span>
              </div>
            ))}
            {lists.birthdays.length === 0 && <p className="text-muted-foreground">No birthdays today.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Follow-ups due</h2>
            </div>
            <Link href="/follow-ups" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2 text-sm">
            {lists.dueFollowUps.map((f) => {
              const p = f.member ?? f.firstTimer;
              return (
                <div key={f.id} className="flex justify-between">
                  <span>{p ? `${p.firstName} ${p.lastName}` : "—"}</span>
                  <Badge variant="muted">{f.type}</Badge>
                </div>
              );
            })}
            {lists.dueFollowUps.length === 0 && <p className="text-muted-foreground">All caught up 🎉</p>}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Recent first timers</h2>
            </div>
            <Link href="/first-timers" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2 text-sm">
            {lists.recentFirstTimers.map((f) => (
              <div key={f.id} className="flex justify-between">
                <span>{fullName(f)}</span>
                <span className="text-muted-foreground">{f.phone}</span>
              </div>
            ))}
            {lists.recentFirstTimers.length === 0 && <p className="text-muted-foreground">None yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
