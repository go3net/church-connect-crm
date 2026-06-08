"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button, Card, Input, Label, Select, Badge } from "@/components/ui";
import { UserPlus } from "lucide-react";

interface Staff {
  id: string; name: string; email: string; role: string;
  isActive: boolean; lastLoginAt: string | null;
}

const ROLES = [
  { value: "CELL_LEADER", label: "Cell Leader" },
  { value: "CHURCH_ADMIN", label: "Church Admin" },
  { value: "PASTOR", label: "Pastor" },
];

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [creating, setCreating] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/users?all=1");
    if (res.status === 403) { setForbidden(true); return; }
    const data = await res.json();
    setStaff(data.users ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd.entries())),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? "Could not add staff"); return; }
    toast.success("Staff member added");
    (e.target as HTMLFormElement).reset();
    setCreating(false);
    load();
  }

  async function patch(id: string, body: Record<string, unknown>, msg: string) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Update failed"); return; }
    toast.success(msg);
    load();
  }

  if (forbidden) {
    return <p className="text-muted-foreground">Only Pastors and Super Admins can manage staff.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Staff & Roles</h1>
          <p className="text-sm text-muted-foreground">{staff.filter((s) => s.isActive).length} active members</p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>
          <UserPlus className="h-4 w-4" /> {creating ? "Close" : "Add staff"}
        </Button>
      </div>

      {creating && (
        <Card className="p-6">
          <form onSubmit={add} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Temporary password</Label>
              <Input id="password" name="password" type="text" placeholder="At least 8 characters" required />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select name="role" defaultValue="CELL_LEADER">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Create account</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.email}</td>
                <td className="px-4 py-3">
                  <Select
                    value={s.role}
                    onChange={(e) => patch(s.id, { role: e.target.value }, "Role updated")}
                    className="h-8 w-36 text-xs"
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={s.isActive ? "success" : "muted"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => patch(s.id, { isActive: !s.isActive }, s.isActive ? "Deactivated" : "Reactivated")}>
                    {s.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
