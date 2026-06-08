"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function NewFirstTimerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries()) as any;
    payload.wantsVisit = fd.get("wantsVisit") === "on";

    // birthday is day + month only — store with a neutral placeholder year (2000)
    // so the birthday automation (matches on month/day) works without exposing age.
    const mm = fd.get("birthMonth");
    const dd = fd.get("birthDay");
    if (mm && dd) payload.dateOfBirth = `2000-${mm}-${dd}`;
    delete payload.birthMonth;
    delete payload.birthDay;

    setLoading(true);
    const res = await fetch("/api/first-timers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not register guest");
      return;
    }
    toast.success("Guest registered — welcome message sent");
    router.push("/first-timers");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Register First Timer</h1>
        <p className="text-sm text-muted-foreground">
          A welcome WhatsApp + SMS is sent automatically and the follow-up journey begins.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" name="firstName" required />
          <Field label="Last name" name="lastName" required />
          <Field label="Phone (WhatsApp)" name="phone" placeholder="0803 123 4567" required />
          <Field label="Email" name="email" type="email" />
          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Select name="gender" defaultValue="">
              <option value="">—</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Birthday (day & month)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select name="birthDay" defaultValue="">
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => {
                  const d = String(i + 1).padStart(2, "0");
                  return <option key={d} value={d}>{i + 1}</option>;
                })}
              </Select>
              <Select name="birthMonth" defaultValue="">
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
                ))}
              </Select>
            </div>
          </div>
          <Field label="Invited by" name="invitedByName" />
          <Field label="How did you hear about us?" name="howHeard" />
          <div className="sm:col-span-2">
            <Field label="Address" name="address" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Prayer request</Label>
            <Textarea name="prayerRequest" placeholder="Anything we can pray about?" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="wantsVisit" className="h-4 w-4" />
            Requests a home visit
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Register guest"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input id={name} name={name} type={type} required={required} placeholder={placeholder} />
    </div>
  );
}
