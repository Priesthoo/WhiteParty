import type { Metadata } from "next";
import { PaymentQueue } from "@/features/admin/components/PaymentQueue";
export const metadata:Metadata={title:"Payment verification",robots:{index:false,follow:false}};
export default function AdminPaymentsPage(){return <PaymentQueue/>}
