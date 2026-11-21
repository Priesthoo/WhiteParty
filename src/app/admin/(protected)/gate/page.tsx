
import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { getAdminContext } from "@/lib/auth/admin";

import { GateScanner } from "@/features/admin/components/GateScanner";

export const metadata: Metadata = {
  title: "Gate Check-in | ALL WHITE POOL PARTY",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function AdminGatePage() {
  const admin = await getAdminContext();

  if (!admin) {
    redirect("/admin/login");
  }

  if (
    !["owner", "ticket_manager", "gate_staff"].includes(
      admin.role,
    )
  ) {
    redirect("/admin");
  }

  return <GateScanner />;
}
