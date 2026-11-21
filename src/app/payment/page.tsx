import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar, Footer } from "@/components/layout";
import { PaymentPageClient } from "@/features/payments/components/PaymentPageClient";
export const metadata: Metadata = { title: "Bank transfer payment", robots: { index: false, follow: false } };
export default async function PaymentPage({searchParams}:{searchParams:Promise<{reference?:string|string[]}>}) { const p=await searchParams;const reference=typeof p.reference==="string"?p.reference:"";if(!/^AWN-2026-[A-F0-9]{16}$/.test(reference))notFound();return <><Navbar/><main className="page-shell"><PaymentPageClient reference={reference}/></main><Footer/></>; }
