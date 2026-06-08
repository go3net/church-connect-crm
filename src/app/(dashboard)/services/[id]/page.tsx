"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, Input, Badge } from "@/components/ui";
import { Check, QrCode } from "lucide-react";

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export default function ServiceAttendancePage() {
  const { id } = useParams<{ id: string }>();
  const [service, setService] = useState<{ name: string } | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [showQr, setShowQr] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/services/${id}/attendance`);
    const data = await res.json();
    setService(data.service);
    setMembers(data.members ?? []);
    setMarked(new Set((data.markedMemberIds ?? []).filter(Boolean)));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function mark(memberId: string) {
    setMarked((prev) => new Set(prev).add(memberId)); // optimistic
    const res = await fetch(`/api/services/${id}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    if (!res.ok) {
      toast.error("Failed to mark");
      load();
    }
  }

  const checkinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/checkin/${id}` : "";
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(checkinUrl)}`;

  const filtered = members.filter((m) =>
    `${m.firstName} ${m.lastName} ${m.phone}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{service?.name ?? "Attendance"}</h1>
          <p className="text-sm text-muted-foreground">
            {marked.size} of {members.length} members marked present
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowQr((v) => !v)}>
          <QrCode className="h-4 w-4" /> {showQr ? "Hide" : "Show"} check-in QR
        </Button>
      </div>

      {showQr && (
        <Card className="flex flex-col items-center gap-3 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt="Check-in QR" width={240} height={240} />
          <p className="text-sm text-muted-foreground">Scan to self check-in</p>
          <code className="rounded bg-muted px-2 py-1 text-xs">{checkinUrl}</code>
        </Card>
      )}

      <Input placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />

      <Card className="divide-y">
        {filtered.map((m) => {
          const isMarked = marked.has(m.id);
          return (
            <div key={m.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">{m.firstName} {m.lastName}</p>
                <p className="text-sm text-muted-foreground">{m.phone}</p>
              </div>
              {isMarked ? (
                <Badge variant="success"><Check className="mr-1 h-3 w-3" /> Present</Badge>
              ) : (
                <Button size="sm" onClick={() => mark(m.id)}>Mark present</Button>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-8 text-center text-muted-foreground">No members found.</p>
        )}
      </Card>
    </div>
  );
}
