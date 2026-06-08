"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  PhoneCall,
  CalendarCheck,
  Network,
  Megaphone,
  BarChart3,
  CreditCard,
  Workflow,
  ShieldCheck,
  Settings,
  HeartHandshake,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/first-timers", label: "First Timers", icon: UserPlus },
  { href: "/members", label: "Members", icon: Users },
  { href: "/cell-groups", label: "Cell Groups", icon: Network },
  { href: "/services", label: "Services", icon: CalendarCheck },
  { href: "/follow-ups", label: "Follow-ups", icon: PhoneCall },
  { href: "/prayer", label: "Prayer", icon: HeartHandshake },
  { href: "/broadcasts", label: "Broadcasts", icon: Megaphone },
  { href: "/automation", label: "Automation", icon: Workflow },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/staff", label: "Staff", icon: ShieldCheck },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-yellow text-sm font-extrabold text-neutral-900">
        CC
      </div>
      <span className="text-[15px] font-semibold tracking-tight text-white">Church Connect</span>
    </div>
  );
}

export function Sidebar({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-neutral-950 px-4 md:hidden">
        <button onClick={() => setOpen(true)} className="text-white" aria-label="Open menu">
          <Menu className="h-6 w-6" />
        </button>
        <Brand />
        <div className="w-6" />
      </header>

      {/* mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* desktop sidebar + mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-neutral-950 transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
          <Brand />
          <button onClick={() => setOpen(false)} className="text-neutral-400 md:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-yellow" />
                )}
                <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand-yellow" : "text-neutral-500 group-hover:text-neutral-300")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
              {name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{name}</p>
              <p className="text-xs capitalize text-neutral-500">{role.replace(/_/g, " ").toLowerCase()}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
