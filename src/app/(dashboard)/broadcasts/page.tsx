"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button, Card, Label, Select, Textarea, Input, Badge } from "@/components/ui";
import { Send } from "lucide-react";

const BASE_SEGMENTS = [
  { value: "members_all", label: "All members" },
  { value: "members_active", label: "Active members" },
  { value: "members_inactive", label: "Inactive members" },
  { value: "members_new", label: "New members & converts" },
  { value: "firsttimers", label: "First timers" },
];

interface Tpl { id: string; name: string; channel: string; subject: string | null; body: string }
interface Group { id: string; name: string }
interface LogRow { id: string; channel: string; toAddress: string; status: string; body: string; createdAt: string }

export default function BroadcastsPage() {
  const [channel, setChannel] = useState("WHATSAPP");
  const [segment, setSegment] = useState("members_all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [last, setLast] = useState<LogRow[]>([]);
  const [sending, setSending] = useState(false);

  const loadActivity = useCallback(async () => {
    const a = await fetch("/api/broadcasts").then((r) => r.json());
    setTotals(a.totals ?? {});
    setLast(a.last ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then((d) => setTemplates(d.templates ?? []));
    fetch("/api/cell-groups").then((r) => r.json()).then((d) => setGroups(d.groups ?? []));
    loadActivity();
  }, [loadActivity]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) { toast.error("Write a message first"); return; }
    setSending(true);
    const res = await fetch("/api/broadcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, segment, body, subject: subject || undefined }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { toast.error(data.error ?? "Send failed"); return; }
    toast.success(`Queued to ${data.recipients} recipient(s)`);
    setBody(""); setSubject("");
    loadActivity();
  }

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (t) { setBody(t.body); if (t.subject) setSubject(t.subject); setChannel(t.channel); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Broadcasts</h1>
        <p className="text-sm text-muted-foreground">
          Send WhatsApp / SMS / email to a member segment. Use {"{{firstName}}"} for personalisation.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <form onSubmit={send} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Channel</Label>
                <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <Select value={segment} onChange={(e) => setSegment(e.target.value)}>
                  {BASE_SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  {groups.map((g) => <option key={g.id} value={`cell_${g.id}`}>Cell: {g.name}</option>)}
                </Select>
              </div>
            </div>

            {templates.length > 0 && (
              <div className="space-y-1.5">
                <Label>Start from template</Label>
                <Select defaultValue="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
                  <option value="">— None —</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
            )}

            {channel === "EMAIL" && (
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="body">Message</Label>
              <Textarea id="body" rows={6} value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="Hello {{firstName}}, ..." />
            </div>

            <Button type="submit" disabled={sending}>
              <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send broadcast"}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="mb-3 font-semibold">Delivery activity</h2>
          <div className="flex flex-wrap gap-2">
            {["DELIVERED", "SENT", "READ", "REPLIED", "FAILED", "QUEUED"].map((s) => (
              <Badge key={s} variant={s === "FAILED" ? "warn" : "muted"}>
                {s}: {totals[s] ?? 0}
              </Badge>
            ))}
          </div>
          <h3 className="mb-2 mt-5 text-sm font-medium text-muted-foreground">Recent</h3>
          <div className="space-y-2 text-sm">
            {last.slice(0, 10).map((m) => (
              <div key={m.id} className="rounded-md border p-2">
                <div className="flex justify-between">
                  <span className="font-medium">{m.channel}</span>
                  <Badge variant={m.status === "FAILED" ? "warn" : "muted"}>{m.status}</Badge>
                </div>
                <p className="truncate text-muted-foreground">{m.toAddress}</p>
              </div>
            ))}
            {last.length === 0 && <p className="text-muted-foreground">No messages yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
