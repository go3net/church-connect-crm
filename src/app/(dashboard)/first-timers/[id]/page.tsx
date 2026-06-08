import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, Badge } from "@/components/ui";
import { fullName, formatDate } from "@/lib/utils";
import { ConvertButton } from "../convert-button";
import { ArrowLeft, Phone, Mail, MapPin, Cake, UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FirstTimerDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const churchId = session!.user.churchId!;

  const ft = await db.firstTimer.findFirst({
    where: { id: params.id, churchId, deletedAt: null },
    include: {
      followUps: { include: { assignedTo: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
      prayerRequests: { orderBy: { createdAt: "desc" }, take: 10 },
      enrollments: { include: { workflow: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 3 },
      firstService: { select: { name: true, date: true } },
    },
  });
  if (!ft) notFound();

  return (
    <div className="space-y-6">
      <Link href="/first-timers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to first timers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{fullName(ft)}</h1>
          <div className="mt-1 flex items-center gap-2">
            {ft.isConverted
              ? <Badge variant="success">Converted</Badge>
              : <Badge variant="warn">First Timer</Badge>}
            <Badge variant="muted">{ft.visitCount} visit(s)</Badge>
          </div>
        </div>
        {!ft.isConverted && <ConvertButton id={ft.id} />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Details</h2>
          <Detail icon={Phone} label="Phone" value={ft.phone} />
          <Detail icon={Mail} label="Email" value={ft.email} />
          <Detail icon={Cake} label="Birthday" value={ft.dateOfBirth ? formatDate(ft.dateOfBirth) : null} />
          <Detail icon={UserCheck} label="Invited by" value={ft.invitedByName} />
          <Detail icon={MapPin} label="Address" value={ft.address} />
          <Detail icon={UserCheck} label="First seen" value={ft.firstService ? `${ft.firstService.name} (${formatDate(ft.firstService.date)})` : formatDate(ft.createdAt)} />
          {ft.prayerRequest && (
            <div className="rounded-md bg-muted p-2 text-sm">
              <p className="font-medium">Prayer request</p>
              <p className="text-muted-foreground">{ft.prayerRequest}</p>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Follow-up journey</h2>
          <div className="space-y-2 text-sm">
            {ft.enrollments.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border p-2">
                <span>{e.workflow.name}</span>
                <Badge variant={e.status === "ACTIVE" ? "default" : "muted"}>
                  {e.status} · step {e.currentStep}
                </Badge>
              </div>
            ))}
            {ft.enrollments.length === 0 && <p className="text-muted-foreground">Not enrolled in any workflow.</p>}
          </div>

          <h2 className="mb-3 mt-5 font-semibold">Follow-ups</h2>
          <div className="divide-y text-sm">
            {ft.followUps.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-2">
                <span className="font-medium">{f.type} <span className="font-normal text-muted-foreground">· {f.assignedTo?.name ?? "—"}</span></span>
                <Badge variant={f.status === "COMPLETED" ? "success" : "warn"}>{f.status}</Badge>
              </div>
            ))}
            {ft.followUps.length === 0 && <p className="py-2 text-muted-foreground">No follow-ups yet.</p>}
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
