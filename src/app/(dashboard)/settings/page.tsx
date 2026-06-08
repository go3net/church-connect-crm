"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Input, Label } from "@/components/ui";

interface Church {
  name: string; email: string | null; phone: string | null; address: string | null;
  city: string | null; state: string | null; timezone: string | null;
  waPhoneId: string | null; senderId: string | null;
}

export default function SettingsPage() {
  const [church, setChurch] = useState<Church | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/church").then((r) => r.json()).then((d) => setChurch(d.church));
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const res = await fetch("/api/church", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd.entries())),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Save failed"); return; }
    toast.success("Settings saved");
  }

  if (!church) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Church profile and messaging configuration</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <Card className="p-6">
          <h2 className="mb-4 font-semibold">Church profile</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Church name" name="name" defaultValue={church.name} required />
            <Field label="Contact email" name="email" type="email" defaultValue={church.email ?? ""} />
            <Field label="Phone" name="phone" defaultValue={church.phone ?? ""} />
            <Field label="City" name="city" defaultValue={church.city ?? ""} />
            <Field label="State" name="state" defaultValue={church.state ?? ""} />
            <Field label="Timezone" name="timezone" defaultValue={church.timezone ?? "Africa/Lagos"} />
            <div className="sm:col-span-2">
              <Field label="Address" name="address" defaultValue={church.address ?? ""} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-1 font-semibold">Messaging credentials</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Connect your own WhatsApp Business number and SMS sender ID. Leave blank to use the platform defaults.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="WhatsApp Phone Number ID" name="waPhoneId" defaultValue={church.waPhoneId ?? ""} placeholder="From Meta Cloud API" />
            <Field label="SMS Sender ID (Termii)" name="senderId" defaultValue={church.senderId ?? ""} placeholder="e.g. GraceChapel" />
          </div>
        </Card>

        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
      </form>
    </div>
  );
}

function Field({ label, name, type = "text", defaultValue, placeholder, required }: {
  label: string; name: string; type?: string; defaultValue?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required} />
    </div>
  );
}
