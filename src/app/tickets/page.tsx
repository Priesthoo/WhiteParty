import type { Metadata } from "next";

import {
  Navbar,
  Footer,
} from "@/components/layout";

import {
  TicketSection,
} from "@/features/website/components/TicketSection";

import {
  PaymentInfoSection,
} from "@/features/website/components/PaymentInfoSection";

export const metadata: Metadata = {
  title: "Tickets | ALL WHITE POOL PARTY",

  description:
    "Choose your ALL WHITE POOL PARTY admission and pay by direct bank transfer.",
};

export default function TicketsPage() {
  return (
    <>
      <Navbar />

      <main>
        <TicketSection />

        <PaymentInfoSection />
      </main>

      <Footer />
    </>
  );
}