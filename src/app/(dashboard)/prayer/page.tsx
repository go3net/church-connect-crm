"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button, Card, Badge, Select } from "@/components/ui";
import { HeartHandshake } from "lucide-react";

interface PR {
  id: string; request: string; status: string; requesterName: string | null;
  isConfidential: boolean; createdAt: string;
  member: { firstName: string; lastName: string } | null;
  firstTimer: { firstName: string; lastName: string } | null;
}

const STATUSES = ["OPEN", "PRAYING", "ANSWERED", "CLOSED"];

export default function PrayerPage() {
  const [items, setItems] = useState<PR[]>([]);
  const [filter, setFilter] = useState("OPEN");

  const load = useCallback(async () => {
    const res = await fetch(`/api/prayer-requests?status=${filter}`);
    const data = await res.json();
    setItems(data.requests ?? []);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function update(id: string, status: string) {
    const res = await fetch(`/api/prayer-requests/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { toast.error("Update failed"); return; }
    toast.success("Updated");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prayer Requests</h1>
          <p className="text-sm text-muted-foreground">{items.length} {filter.toLowerCase()} requests</p>
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="">All</option>
        </Select>
      </div>

      {items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <HeartHandshake className="mx-auto mb-2 h-6 w-6" /> No prayer requests here.
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((p) => {
            const person = p.member ?? p.firstTimer;
            const name = person ? `${person.firstName} ${person.lastName}` : p.requesterName ?? "Anonymous";
            return (
              <Card key={p.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{name}</span>
                      {p.isConfidential && <Badge variant="warn">Confidential</Badge>}
                      <Badge variant={p.status === "ANSWERED" ? "success" : "muted"}>{p.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{p.request}</p>
                  </div>
                  <div className="flex gap-1">
                    {p.status !== "PRAYING" && <Button size="sm" variant="outline" onClick={() => update(p.id, "PRAYING")}>Praying</Button>}
                    {p.status !== "ANSWERED" && <Button size="sm" onClick={() => update(p.id, "ANSWERED")}>Answered</Button>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
