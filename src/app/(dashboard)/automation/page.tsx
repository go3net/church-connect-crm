"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button, Card, Input, Label, Select, Textarea, Badge } from "@/components/ui";
import { Plus, Trash2, Power } from "lucide-react";

interface Step {
  id: string; order: number; offsetDays: number; channel: string;
  createsFollowUp: boolean; followUpType: string | null;
  template: { id: string; name: string; channel: string } | null;
}
interface Workflow {
  id: string; name: string; trigger: string; isActive: boolean;
  steps: Step[]; _count: { enrollments: number };
}
interface Tpl { id: string; name: string; channel: string }

const TRIGGERS = ["FIRST_TIMER_REGISTERED", "NEW_CONVERT", "MEMBER_INACTIVE", "MANUAL"];

export default function AutomationPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<Tpl[]>([]);

  const load = useCallback(async () => {
    const [w, t] = await Promise.all([
      fetch("/api/automation").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
    ]);
    setWorkflows(w.workflows ?? []);
    setTemplates(t.templates ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createWorkflow(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/automation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd.entries())),
    });
    if (!res.ok) { toast.error("Could not create"); return; }
    toast.success("Workflow created");
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function toggle(wf: Workflow) {
    await fetch(`/api/automation/${wf.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !wf.isActive }),
    });
    load();
  }

  async function addStep(wfId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/automation/${wfId}/steps`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd.entries())),
    });
    if (!res.ok) { toast.error("Could not add step"); return; }
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function deleteStep(stepId: string) {
    await fetch(`/api/automation/steps/${stepId}`, { method: "DELETE" });
    load();
  }

  async function createTemplate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd.entries())),
    });
    if (!res.ok) { toast.error("Could not create template"); return; }
    toast.success("Template created");
    (e.target as HTMLFormElement).reset();
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Automation</h1>
        <p className="text-sm text-muted-foreground">Build follow-up journeys with no code. The daily cron advances each enrolled person.</p>
      </div>

      {/* Workflows */}
      <div className="space-y-4">
        {workflows.map((wf) => (
          <Card key={wf.id} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{wf.name}</h3>
                  <Badge variant={wf.isActive ? "success" : "muted"}>{wf.isActive ? "Active" : "Paused"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Trigger: {wf.trigger.replace(/_/g, " ")} · {wf._count.enrollments} enrolled
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => toggle(wf)}>
                <Power className="h-4 w-4" /> {wf.isActive ? "Pause" : "Activate"}
              </Button>
            </div>

            {/* step timeline */}
            <div className="mt-4 space-y-2">
              {wf.steps.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-md border p-2 text-sm">
                  <Badge variant="muted">Day {s.offsetDays}</Badge>
                  <span className="font-medium">{s.channel}</span>
                  <span className="text-muted-foreground">
                    {s.createsFollowUp ? `→ creates ${s.followUpType} task` : `→ ${s.template?.name ?? "(no template)"}`}
                  </span>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => deleteStep(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {wf.steps.length === 0 && <p className="text-sm text-muted-foreground">No steps yet.</p>}
            </div>

            {/* add step */}
            <form onSubmit={(e) => addStep(wf.id, e)} className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-xs">Day offset</Label>
                <Input name="offsetDays" type="number" min={0} defaultValue={0} className="w-24" />
              </div>
              <div>
                <Label className="text-xs">Channel</Label>
                <Select name="channel" className="w-32">
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Template</Label>
                <Select name="templateId" className="w-48">
                  <option value="">— None —</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
              <Button size="sm" type="submit"><Plus className="h-4 w-4" /> Add step</Button>
            </form>
          </Card>
        ))}
        {workflows.length === 0 && <p className="text-muted-foreground">No workflows yet.</p>}
      </div>

      {/* New workflow */}
      <Card className="p-5">
        <h2 className="mb-3 font-semibold">New workflow</h2>
        <form onSubmit={createWorkflow} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-48">
            <Label className="text-xs">Name</Label>
            <Input name="name" placeholder="First-Timer Journey" required />
          </div>
          <div>
            <Label className="text-xs">Trigger</Label>
            <Select name="trigger" className="w-56">
              {TRIGGERS.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </Select>
          </div>
          <Button type="submit"><Plus className="h-4 w-4" /> Create</Button>
        </form>
      </Card>

      {/* Templates */}
      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Message templates</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {templates.map((t) => (
            <Badge key={t.id} variant="muted">{t.name} · {t.channel}</Badge>
          ))}
          {templates.length === 0 && <p className="text-sm text-muted-foreground">No templates yet.</p>}
        </div>
        <form onSubmit={createTemplate} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input name="name" placeholder="Template name" required />
          <Select name="channel">
            <option value="WHATSAPP">WhatsApp</option>
            <option value="SMS">SMS</option>
            <option value="EMAIL">Email</option>
          </Select>
          <Input name="category" placeholder="Category (welcome, followup…)" className="sm:col-span-2" />
          <Textarea name="body" placeholder="Message body — use {{firstName}}" className="sm:col-span-2" rows={3} required />
          <div className="sm:col-span-2">
            <Button type="submit"><Plus className="h-4 w-4" /> Add template</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
