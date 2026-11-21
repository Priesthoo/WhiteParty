import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/admin";
import { AdminLoginForm } from "@/features/admin/components/AdminLoginForm";
export const metadata: Metadata = { title: "Administrator login", robots: { index: false, follow: false } };
export default async function AdminLoginPage(){if(await getAdminContext())redirect("/admin");return <main className="login-page"><div className="login-brand"><strong>ZIMJA FEST</strong><span>ALL WHITE POOL PARTY</span></div><AdminLoginForm/></main>}
