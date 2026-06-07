"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui";

export function ConvertButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function convert() {
    setLoading(true);
    const res = await fetch(`/api/first-timers/${id}/convert`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Conversion failed");
      return;
    }
    toast.success("Converted to member");
    router.refresh();
  }

  return (
    <Button size="sm" variant="outline" onClick={convert} disabled={loading}>
      {loading ? "Converting…" : "Convert to member"}
    </Button>
  );
}
