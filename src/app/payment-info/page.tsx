import type { Metadata } from "next";

import {
  Navbar,
  Footer,
} from "@/components/layout";

import {
  PaymentInfoSection,
} from "@/features/website/components/PaymentInfoSection";

export const metadata: Metadata = {
  title: "How to Pay | ALL WHITE POOL PARTY",

  description:
    "Learn how to pay for ALL WHITE POOL PARTY tickets by direct bank transfer.",
};

export default function PaymentInfoPage() {
  return (
    <>
      <Navbar />

      <main>
        <PaymentInfoSection />
      </main>

      <Footer />
    </>
  );
}