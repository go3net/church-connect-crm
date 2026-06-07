import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, Badge } from "@/components/ui";
import { fullName, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "default" | "muted" | "success" | "warn"> = {
  ACTIVE_MEMBER: "success",
  NEW_MEMBER: "default",
  NEW_CONVERT: "default",
  FIRST_TIMER: "warn",
  INACTIVE_MEMBER: "muted",
};

export default async function MembersPage() {
  const session = await auth();
  const churchId = session!.user.churchId!;

  const members = await db.member.findMany({
    where: { churchId, deletedAt: null },
    include: { cellGroup: { select: { name: true } }, engagementScore: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">{members.length} records</p>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Cell group</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Engagement</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{fullName(m)}</td>
                  <td className="px-4 py-3">{m.phone}</td>
                  <td className="px-4 py-3">{m.cellGroup?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[m.status] ?? "muted"}>
                      {m.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {m.engagementScore ? `${m.engagementScore.score}/100` : "—"}
                  </td>
                  <td className="px-4 py-3">{formatDate(m.joinedAt)}</td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No members yet. Convert a first-timer to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y md:hidden">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{fullName(m)}</p>
                <p className="text-sm text-muted-foreground">{m.phone}</p>
              </div>
              <Badge variant={STATUS_VARIANT[m.status] ?? "muted"}>
                {m.status.replace("_", " ")}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
