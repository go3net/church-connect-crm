"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, Badge } from "@/components/ui";
import { Check } from "lucide-react";

interface Plan {
  id: string; name: string; priceKobo: number; maxMembers: number;
  maxStaff: number; maxBranches: number; monthlyMessageQuota: number;
  features: string[];
}
interface State {
  subscription: { status: string; currentPeriodEnd: string | null; messagesUsed: number } | null;
  plan: Plan | null;
  usage: { members: number; staff: number; branches: number };
  plans: Plan[];
}

const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);

function Bar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{used} / {limit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${pct > 90 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
      <BillingInner />
    </Suspense>
  );
}

function BillingInner() {
  const params = useSearchParams();
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const data = await fetch("/api/billing").then((r) => r.json());
    setState(data);
  }, []);

  useEffect(() => {
    load();
    if (params.get("status") === "success") toast.success("Payment received — your plan is being activated.");
  }, [load, params]);

  async function upgrade(planId: string) {
    setBusy(planId);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) { toast.error(data.error ?? "Checkout failed"); return; }
    window.location.href = data.authorizationUrl;
  }

  if (!state) return <p className="text-muted-foreground">Loading…</p>;

  const current = state.plan;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing & Plan</h1>
        <p className="text-sm text-muted-foreground">Manage your subscription and usage</p>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <h2 className="text-xl font-semibold">{current?.name ?? "No plan"}</h2>
          </div>
          {state.subscription && (
            <Badge variant={state.subscription.status === "ACTIVE" ? "success" : "warn"}>
              {state.subscription.status}
            </Badge>
          )}
        </div>
        {current && (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Bar label="Members" used={state.usage.members} limit={current.maxMembers} />
            <Bar label="Staff" used={state.usage.staff} limit={current.maxStaff} />
            <Bar label="Messages (this period)" used={state.subscription?.messagesUsed ?? 0} limit={current.monthlyMessageQuota} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {state.plans.map((p) => {
          const isCurrent = current?.name === p.name;
          return (
            <Card key={p.id} className={`flex flex-col p-5 ${isCurrent ? "ring-2 ring-primary" : ""}`}>
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-1 text-2xl font-bold">
                {p.priceKobo === 0 ? "Free" : naira(p.priceKobo)}
                {p.priceKobo > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
              </p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted-foreground">
                <li>{p.maxMembers.toLocaleString()} members</li>
                <li>{p.maxStaff} staff · {p.maxBranches} branch(es)</li>
                <li>{p.monthlyMessageQuota.toLocaleString()} messages/mo</li>
                {(p.features ?? []).map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>Current plan</Button>
                ) : p.priceKobo === 0 ? (
                  <Button variant="outline" className="w-full" disabled>Free tier</Button>
                ) : (
                  <Button className="w-full" onClick={() => upgrade(p.id)} disabled={busy === p.id}>
                    {busy === p.id ? "Redirecting…" : "Upgrade"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Payments are processed securely by Paystack. Plans activate automatically once payment is confirmed.
      </p>
    </div>
  );
}
