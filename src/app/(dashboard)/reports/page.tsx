"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Card } from "@/components/ui";
import { Download, Eye, FileText } from "lucide-react";

const REPORTS = [
  { type: "first-timers", label: "First Timers", description: "All guests and conversion status" },
  { type: "members", label: "Members", description: "Full membership directory" },
  { type: "attendance", label: "Attendance", description: "Per-service attendance totals" },
  { type: "follow-ups", label: "Follow-ups", description: "Follow-up tasks and outcomes" },
  { type: "cell-groups", label: "Cell Groups", description: "Groups, leaders and sizes" },
];

export default function ReportsPage() {
  const [preview, setPreview] = useState<{ columns: string[]; rows: (string | number)[][]; label: string } | null>(null);
  const [loading, setLoading] = useState("");

  async function showPreview(type: string, label: string) {
    setLoading(type);
    const res = await fetch(`/api/reports?type=${type}`);
    const data = await res.json();
    setLoading("");
    if (!res.ok) { toast.error("Could not load report"); return; }
    setPreview({ ...data, label });
  }

  function download(type: string) {
    window.location.href = `/api/reports?type=${type}&format=csv`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Preview on screen or export to CSV (opens in Excel/Sheets)</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.type} className="flex flex-col p-5">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">{r.label}</h3>
            </div>
            <p className="mb-4 flex-1 text-sm text-muted-foreground">{r.description}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => showPreview(r.type, r.label)} disabled={loading === r.type}>
                <Eye className="h-4 w-4" /> {loading === r.type ? "…" : "Preview"}
              </Button>
              <Button size="sm" onClick={() => download(r.type)}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {preview && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
            <h2 className="font-semibold">{preview.label} — {preview.rows.length} rows</h2>
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Close</Button>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-card text-left text-xs uppercase text-muted-foreground">
                <tr>{preview.columns.map((c) => <th key={c} className="px-4 py-2">{c}</th>)}</tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 200).map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {row.map((cell, j) => <td key={j} className="px-4 py-2">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length === 0 && <p className="p-8 text-center text-muted-foreground">No data.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
