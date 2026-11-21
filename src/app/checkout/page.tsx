import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar, Footer } from "@/components/layout";
import { CheckoutForm } from "@/features/checkout/components/CheckoutForm";
import { eventConfig, type TicketTypeId } from "@/features/events/config/event";
export const metadata: Metadata = { title: "Ticket checkout", robots: { index: false, follow: false } };
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ ticket?: string | string[]; quantity?: string | string[] }> }) {
  const params = await searchParams;
  const id = typeof params.ticket === "string" ? params.ticket : "";
  if (!Object.prototype.hasOwnProperty.call(eventConfig.tickets, id)) notFound();
  const ticketId = id as TicketTypeId;
  const ticket = eventConfig.tickets[ticketId];
  const raw = typeof params.quantity === "string" ? Number.parseInt(params.quantity, 10) : 1;
  const quantity = Number.isFinite(raw) ? Math.max(1, Math.min(5, raw)) : 1;
  return <><Navbar/><main className="page-shell"><div className="container"><div className="page-heading"><span className="eyebrow">ALL WHITE POOL PARTY / CHECKOUT</span><h1>Secure your admission.</h1><p>Complete your details to reserve tickets. Payment is made by direct bank transfer.</p></div><CheckoutForm ticketTypeId={ticket.id} ticketName={ticket.name} description={ticket.admissionsPerUnit === 5 ? "Five individual admissions in one group package." : "One individual event admission."} price={ticket.priceNaira} admissionsPerUnit={ticket.admissionsPerUnit} initialQuantity={quantity}/></div></main><Footer/></>;
}
