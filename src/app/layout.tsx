import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "ALL WHITE POOL PARTY | ZIMJA FEST", template: "%s | ALL WHITE POOL PARTY" },
  description: "ZIMJA FEST presents ALL WHITE POOL PARTY. Sunday, December 13, 2026 at 8 PM. Party till Mama Calls.",
  applicationName: "ALL WHITE POOL PARTY",
  openGraph: { title: "ALL WHITE POOL PARTY | ZIMJA FEST", description: "Party till Mama Calls. December 13, 2026.", type: "website" }
};
export const viewport: Viewport = { themeColor: "#fafaf7", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
