import Link from "next/link";
import { Container, ButtonLink } from "@/components/ui";

const links = [
  { label: "The experience", href: "/#experience" },
  { label: "Tickets", href: "/tickets" },
  { label: "Event details", href: "/#event-information" },
  { label: "How to pay", href: "/payment-info" },
  { label: "FAQ", href: "/#faq" },
];

export function Navbar() {
  return (
    <header className="site-header">
      <Container className="nav-inner">
        <Link href="/" className="brand">
          <strong>ZIMJA FEST</strong>
          <span>PRESENTS ALL WHITE</span>
        </Link>

        <nav
          className="desktop-nav"
          aria-label="Main navigation"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <ButtonLink href="/tickets">
          Get tickets
        </ButtonLink>

        <details className="mobile-nav">
          <summary aria-label="Open navigation menu">
            <span />
            <span />
            <span />
          </summary>

          <div className="mobile-nav-panel">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
              >
                {link.label}
              </Link>
            ))}

            <ButtonLink
              href="/tickets"
              fullWidth
            >
              Get tickets
            </ButtonLink>
          </div>
        </details>
      </Container>
    </header>
  );
}