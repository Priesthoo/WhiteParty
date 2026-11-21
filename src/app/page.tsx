import {
  Navbar,
  Footer,
} from "@/components/layout";

import {
  HeroSection,
  TicketSection,
  HomeSections,
} from "@/features/website/components";

export default function HomePage() {
  return (
    <>
      <Navbar />

      <main>
        <HeroSection />

        <TicketSection />

        <HomeSections />
      </main>

      <Footer />
    </>
  );
}