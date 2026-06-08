"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, Input, Badge } from "@/components/ui";
import { UserMinus, UserPlus } from "lucide-react";

interface Person { id: string; firstName: string; lastName: string; phone: string }

export default function CellGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<{ name: string; leader: { name: string } | null } | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [all, setAll] = useState<(Person & { cellGroupId?: string | null })[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const [g, m] = await Promise.all([
      fetch(`/api/cell-groups/${id}`).then((r) => r.json()),
      fetch(`/api/members`).then((r) => r.json()),
    ]);
    setGroup(g.group);
    setMembers(g.members ?? []);
    setAll(m.members ?? []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function patch(body: Record<string, unknown>, msg: string) {
    const res = await fetch(`/api/cell-groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { toast.error("Update failed"); return; }
    toast.success(msg);
    load();
  }

  const memberIds = new Set(members.map((m) => m.id));
  const assignable = all
    .filter((m) => !memberIds.has(m.id))
    .filter((m) => `${m.firstName} ${m.lastName} ${m.phone}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 25);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{group?.name ?? "Cell Group"}</h1>
        <p className="text-sm text-muted-foreground">
          Leader: {group?.leader?.name ?? "—"} · {members.length} members
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Members</h2>
          <div className="divide-y">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">{m.firstName} {m.lastName}</p>
                  <p className="text-sm text-muted-foreground">{m.phone}</p>
                </div>
                <Button size="sm" variant="ghost"
                  onClick={() => patch({ removeMemberIds: [m.id] }, "Removed from group")}>
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {members.length === 0 && <p className="py-4 text-sm text-muted-foreground">No members yet.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Add members</h2>
          <Input placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
          <div className="divide-y">
            {assignable.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">{m.firstName} {m.lastName}</p>
                  <p className="text-sm text-muted-foreground">{m.phone}</p>
                  {m.cellGroupId && <Badge variant="warn" className="mt-1">In another group</Badge>}
                </div>
                <Button size="sm" variant="outline"
                  onClick={() => patch({ addMemberIds: [m.id] }, "Added to group")}>
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {assignable.length === 0 && <p className="py-4 text-sm text-muted-foreground">No matches.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
