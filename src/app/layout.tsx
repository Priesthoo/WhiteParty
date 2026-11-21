import type { Metadata, Viewport } from "next";
import { eventConfig } from "../features/events/config/event";
import "./globals.css";

const eventDescription =
  `${eventConfig.organizer} presents ${eventConfig.name}. ` +
  `${eventConfig.dateLabel} at ${eventConfig.timeLabel}. ` +
  `${eventConfig.venue}. ${eventConfig.slogan}.`;

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),

  title: {
    default: `${eventConfig.name} | ${eventConfig.organizer}`,
    template: `%s | ${eventConfig.name}`,
  },

  description: eventDescription,

  applicationName: eventConfig.name,

  openGraph: {
    title: `${eventConfig.name} | ${eventConfig.organizer}`,
    description: eventDescription,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}