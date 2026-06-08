"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, Input, Label } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    setLoading(true);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      toast.error(data.error ?? "Could not create your church");
      return;
    }
    // auto sign-in
    const login = await signIn("credentials", {
      email: data.email,
      password: payload.password as string,
      redirect: false,
    });
    setLoading(false);
    if (login?.error) {
      toast.success("Church created — please sign in.");
      router.push("/login");
      return;
    }
    toast.success("Welcome to Church Connect!");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-10">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-yellow text-lg font-extrabold text-neutral-900">
            CC
          </div>
          <h1 className="text-xl font-bold tracking-tight">Start your church</h1>
          <p className="text-sm text-muted-foreground">Free 14-day trial. No card required.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="churchName">Church name</Label>
            <Input id="churchName" name="churchName" placeholder="Grace Chapel" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adminName">Your name</Label>
            <Input id="adminName" name="adminName" placeholder="Pastor James" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@church.org" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" name="phone" placeholder="0803 123 4567" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" placeholder="At least 8 characters" required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create my church"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/login" className="font-medium text-primary">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
