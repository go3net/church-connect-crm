"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, Badge, Button, Select } from "@/components/ui";

interface FollowUp {
  id: string;
  type: string;
  status: string;
  outcome: string | null;
  dueDate: string | null;
  member: { firstName: string; lastName: string; phone: string } | null;
  firstTimer: { firstName: string; lastName: string; phone: string } | null;
  assignedTo: { name: string } | null;
}

const OUTCOMES = ["CONTACTED", "NOT_CONTACTED", "INTERESTED", "NEEDS_PRAYER", "NEEDS_VISIT"];

export default function FollowUpsPage() {
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/follow-ups?status=${filter}`);
    const data = await res.json();
    setItems(data.followUps ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function update(id: string, body: Record<string, string>) {
    const res = await fetch(`/api/follow-ups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error("Update failed");
      return;
    }
    toast.success("Follow-up updated");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">Your team&apos;s outstanding tasks</p>
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-44">
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="">All</option>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No follow-ups here.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((f) => {
            const person = f.member ?? f.firstTimer;
            return (
              <Card key={f.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {person ? `${person.firstName} ${person.lastName}` : "Unknown"}
                    </p>
                    <Badge variant="muted">{f.type}</Badge>
                    {f.outcome && <Badge>{f.outcome.replace("_", " ")}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {person?.phone} · assigned to {f.assignedTo?.name ?? "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    defaultValue=""
                    onChange={(e) => e.target.value && update(f.id, { outcome: e.target.value })}
                    className="w-44"
                  >
                    <option value="">Record outcome…</option>
                    {OUTCOMES.map((o) => (
                      <option key={o} value={o}>
                        {o.replace("_", " ")}
                      </option>
                    ))}
                  </Select>
                  {f.status !== "COMPLETED" && (
                    <Button size="sm" onClick={() => update(f.id, { status: "COMPLETED" })}>
                      Mark done
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
