import type { Metadata } from "next";

import { notFound } from "next/navigation";

import {
  Navbar,
  Footer,
} from "@/components/layout";

import {
  TicketWallet,
} from "@/features/tickets/components";

export const metadata: Metadata = {
  title: "My Tickets | ALL WHITE POOL PARTY",

  robots: {
    index: false,
    follow: false,
  },
};

export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    reference?: string | string[];
  }>;
}) {
  const params = await searchParams;

  const reference =
    typeof params.reference === "string"
      ? params.reference
      : "";

  if (
    !/^AWN-2026-[A-F0-9]{16}$/.test(reference)
  ) {
    notFound();
  }

  return (
    <>
      <Navbar />

      <main className="page-shell">
        <TicketWallet reference={reference} />
      </main>

      <Footer />
    </>
  );
}