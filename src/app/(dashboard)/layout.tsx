import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar name={session.user.name ?? "User"} role={session.user.role} />
      <main className="flex-1 bg-muted/30 p-4 md:p-8">{children}</main>
    </div>
  );
}
