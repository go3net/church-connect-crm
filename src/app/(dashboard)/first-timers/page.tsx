import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button, Card, Badge } from "@/components/ui";
import { fullName, formatDate } from "@/lib/utils";
import { ConvertButton } from "./convert-button";
import { UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FirstTimersPage() {
  const session = await auth();
  const churchId = session!.user.churchId!;

  const firstTimers = await db.firstTimer.findMany({
    where: { churchId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">First Timers</h1>
          <p className="text-sm text-muted-foreground">{firstTimers.length} records</p>
        </div>
        <Link href="/first-timers/new">
          <Button>
            <UserPlus className="h-4 w-4" /> Register guest
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden">
        {/* desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Invited by</th>
                <th className="px-4 py-3">Registered</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {firstTimers.map((ft) => (
                <tr key={ft.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{fullName(ft)}</td>
                  <td className="px-4 py-3">{ft.phone}</td>
                  <td className="px-4 py-3">{ft.invitedByName ?? "—"}</td>
                  <td className="px-4 py-3">{formatDate(ft.createdAt)}</td>
                  <td className="px-4 py-3">
                    {ft.isConverted ? (
                      <Badge variant="success">Converted</Badge>
                    ) : (
                      <Badge variant="warn">First Timer</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!ft.isConverted && <ConvertButton id={ft.id} />}
                  </td>
                </tr>
              ))}
              {firstTimers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No first timers yet. Register your first guest.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* mobile cards */}
        <div className="divide-y md:hidden">
          {firstTimers.map((ft) => (
            <div key={ft.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{fullName(ft)}</p>
                <p className="text-sm text-muted-foreground">{ft.phone}</p>
              </div>
              {ft.isConverted ? (
                <Badge variant="success">Converted</Badge>
              ) : (
                <ConvertButton id={ft.id} />
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
