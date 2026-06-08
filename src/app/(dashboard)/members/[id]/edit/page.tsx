"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, Input, Label, Select } from "@/components/ui";

const STATUSES = ["FIRST_TIMER", "NEW_CONVERT", "NEW_MEMBER", "ACTIVE_MEMBER", "INACTIVE_MEMBER"];

export default function EditMemberPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<any>(null);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/members/${id}`).then((r) => r.json()).then((d) => setMember(d.member));
    fetch("/api/cell-groups").then((r) => r.json()).then((d) => setGroups(d.groups ?? []));
  }, [id]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const res = await fetch(`/api/members/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd.entries())),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Save failed"); return; }
    toast.success("Member updated");
    router.push(`/members/${id}`);
    router.refresh();
  }

  if (!member) return <p className="text-muted-foreground">Loading…</p>;
  const dob = member.dateOfBirth ? new Date(member.dateOfBirth).toISOString().slice(0, 10) : "";
  const wed = member.weddingDate ? new Date(member.weddingDate).toISOString().slice(0, 10) : "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Edit member</h1>
      <Card className="p-6">
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <F label="First name" name="firstName" def={member.firstName} required />
          <F label="Last name" name="lastName" def={member.lastName} required />
          <F label="Phone" name="phone" def={member.phone} required />
          <F label="Email" name="email" type="email" def={member.email ?? ""} />
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select name="status" defaultValue={member.status}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cell group</Label>
            <Select name="cellGroupId" defaultValue={member.cellGroupId ?? ""}>
              <option value="">— None —</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </div>
          <F label="Date of birth" name="dateOfBirth" type="date" def={dob} />
          <F label="Wedding date" name="weddingDate" type="date" def={wed} />
          <F label="Occupation" name="occupation" def={member.occupation ?? ""} />
          <F label="City" name="city" def={member.city ?? ""} />
          <div className="sm:col-span-2"><F label="Address" name="address" def={member.address ?? ""} /></div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function F({ label, name, type = "text", def, required }: { label: string; name: string; type?: string; def?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={def} required={required} />
    </div>
  );
}
