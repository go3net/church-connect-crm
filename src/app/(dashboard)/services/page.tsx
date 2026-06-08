"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, Card, Input, Label, Select, Badge } from "@/components/ui";

interface Service {
  id: string;
  name: string;
  type: string;
  date: string;
  totalAttendees: number;
  totalFirstTimers: number;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/services");
    const data = await res.json();
    setServices(data.services ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd.entries())),
    });
    if (!res.ok) {
      toast.error("Could not create service");
      return;
    }
    toast.success("Service created");
    (e.target as HTMLFormElement).reset();
    setCreating(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Services</h1>
          <p className="text-sm text-muted-foreground">Record attendance & generate check-in QR</p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>{creating ? "Close" : "New service"}</Button>
      </div>

      {creating && (
        <Card className="p-6">
          <form onSubmit={create} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" placeholder="Sunday First Service" required />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select name="type" defaultValue="SUNDAY">
                <option value="SUNDAY">Sunday</option>
                <option value="MIDWEEK">Midweek</option>
                <option value="SPECIAL">Special</option>
                <option value="CELL_MEETING">Cell meeting</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date *</Label>
              <Input id="date" name="date" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preacher">Preacher</Label>
              <Input id="preacher" name="preacher" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Save service</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Attendance</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">
                  <Badge variant="muted">{s.type.replace("_", " ")}</Badge>
                </td>
                <td className="px-4 py-3">{new Date(s.date).toLocaleDateString("en-NG")}</td>
                <td className="px-4 py-3">
                  {s.totalAttendees} <span className="text-muted-foreground">({s.totalFirstTimers} FT)</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/services/${s.id}`}>
                    <Button size="sm" variant="outline">Take attendance</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {!loading && services.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No services yet. Create one to record attendance.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
