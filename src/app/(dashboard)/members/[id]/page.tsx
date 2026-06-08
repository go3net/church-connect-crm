import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, Badge, Button } from "@/components/ui";
import { fullName, formatDate } from "@/lib/utils";
import { ArrowLeft, Phone, Mail, MapPin, Cake, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const churchId = session!.user.churchId!;

  const member = await db.member.findFirst({
    where: { id: params.id, churchId, deletedAt: null },
    include: {
      cellGroup: { select: { name: true } },
      engagementScore: true,
      attendances: {
        include: { service: { select: { name: true, date: true } } },
        orderBy: { checkedInAt: "desc" },
        take: 10,
      },
      followUps: {
        include: { assignedTo: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      prayerRequests: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!member) notFound();

  const score = member.engagementScore?.score ?? null;

  return (
    <div className="space-y-6">
      <Link href="/members" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to members
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{fullName(member)}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={member.status === "ACTIVE_MEMBER" ? "success" : member.status === "INACTIVE_MEMBER" ? "muted" : "default"}>
              {member.status.replace(/_/g, " ")}
            </Badge>
            {score !== null && <Badge variant="muted">Engagement {score}/100</Badge>}
          </div>
        </div>
        <Link href={`/members/${member.id}/edit`}>
          <Button variant="outline" size="sm">Edit</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Details</h2>
          <Detail icon={Phone} label="Phone" value={member.phone} />
          <Detail icon={Mail} label="Email" value={member.email} />
          <Detail icon={Cake} label="Birthday" value={member.dateOfBirth ? formatDate(member.dateOfBirth) : null} />
          <Detail icon={Users} label="Cell group" value={member.cellGroup?.name} />
          <Detail icon={MapPin} label="Address" value={member.address} />
          <Detail icon={Users} label="Joined" value={formatDate(member.joinedAt)} />
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Attendance ({member.attendances.length} recent)</h2>
          <div className="divide-y text-sm">
            {member.attendances.map((a) => (
              <div key={a.id} className="flex justify-between py-2">
                <span>{a.service.name}</span>
                <span className="text-muted-foreground">{formatDate(a.service.date)}</span>
              </div>
            ))}
            {member.attendances.length === 0 && <p className="py-3 text-muted-foreground">No attendance recorded yet.</p>}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Follow-ups</h2>
          <div className="divide-y text-sm">
            {member.followUps.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium">{f.type}</span>
                  <span className="text-muted-foreground"> · {f.assignedTo?.name ?? "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  {f.outcome && <Badge variant="muted">{f.outcome.replace(/_/g, " ")}</Badge>}
                  <Badge variant={f.status === "COMPLETED" ? "success" : "warn"}>{f.status}</Badge>
                </div>
              </div>
            ))}
            {member.followUps.length === 0 && <p className="py-3 text-muted-foreground">No follow-ups yet.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Prayer requests</h2>
          <div className="space-y-2 text-sm">
            {member.prayerRequests.map((p) => (
              <div key={p.id} className="rounded-md border p-2">
                <p>{p.request}</p>
                <Badge variant="muted" className="mt-1">{p.status}</Badge>
              </div>
            ))}
            {member.prayerRequests.length === 0 && <p className="text-muted-foreground">None.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
