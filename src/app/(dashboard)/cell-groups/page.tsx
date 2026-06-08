"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, Card, Input, Label, Select, Badge } from "@/components/ui";

interface Group {
  id: string;
  name: string;
  meetingDay: string | null;
  location: string | null;
  leader: { id: string; name: string } | null;
  _count: { members: number };
}
interface Leader { id: string; name: string }

export default function CellGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [g, u] = await Promise.all([
      fetch("/api/cell-groups").then((r) => r.json()),
      fetch("/api/users?role=CELL_LEADER").then((r) => r.json()),
    ]);
    setGroups(g.groups ?? []);
    setLeaders(u.users ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    const res = await fetch("/api/cell-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not create group");
      return;
    }
    toast.success("Cell group created");
    (e.target as HTMLFormElement).reset();
    setCreating(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cell Groups</h1>
          <p className="text-sm text-muted-foreground">{groups.length} groups</p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>{creating ? "Close" : "New group"}</Button>
      </div>

      {creating && (
        <Card className="p-6">
          <form onSubmit={create} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" placeholder="Lekki Cell" required />
            </div>
            <div className="space-y-1.5">
              <Label>Leader</Label>
              <Select name="leaderId" defaultValue="">
                <option value="">— Unassigned —</option>
                {leaders.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meetingDay">Meeting day</Label>
              <Input id="meetingDay" name="meetingDay" placeholder="Tuesday" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="Lekki Phase 1" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Save group</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <Link key={g.id} href={`/cell-groups/${g.id}`}>
            <Card className="h-full p-5 transition-colors hover:bg-accent/40">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{g.name}</h3>
                <Badge variant="muted">{g._count.members} members</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Leader: {g.leader?.name ?? "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                {g.meetingDay ?? "—"} · {g.location ?? "—"}
              </p>
            </Card>
          </Link>
        ))}
        {groups.length === 0 && (
          <p className="text-muted-foreground">No cell groups yet.</p>
        )}
      </div>
    </div>
  );
}
