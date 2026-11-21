
import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { getAdminContext } from "@/lib/auth/admin";

import { AdminShell } from "@/features/admin/components/AdminShell";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await getAdminContext();

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <AdminShell
      adminName={admin.displayName}
      adminRole={admin.role}
    >
      {children}
    </AdminShell>
  );
}
