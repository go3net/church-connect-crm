"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
import { Check } from "lucide-react";

export default function PublicCheckinPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ name: string; already: boolean } | null>(null);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/public/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, phone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Check-in failed");
      return;
    }
    setDone({ name: data.name, already: data.already });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-yellow text-lg font-extrabold text-neutral-900">
          CC
        </div>
        {done ? (
          <div className="space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <h1 className="text-xl font-semibold">Welcome, {done.name}!</h1>
            <p className="text-muted-foreground">
              {done.already ? "You're already checked in." : "You're checked in. God bless you."}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 text-left">
            <div className="text-center">
              <h1 className="text-xl font-semibold">Service Check-in</h1>
              <p className="text-sm text-muted-foreground">Enter your phone number</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0803 123 4567"
                inputMode="tel"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Checking in…" : "Check in"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
