import Link from "next/link";
import { Container } from "@/components/ui";
import { eventConfig } from "@/features/events/config/event";

export function Footer() {
  return (
    <footer className="site-footer">
      <Container>
        <div className="footer-grid">
          <div>
            <strong className="footer-brand">
              ALL WHITE
            </strong>

            <span className="footer-script">
              Pool Party
            </span>

            <p>
              Presented by ZIMJA FEST.
              Party till Mama Calls.
            </p>
          </div>

          <div>
            <h3>Explore</h3>

            <Link href="/#experience">
              The experience
            </Link>

            <Link href="/tickets">
              Tickets
            </Link>

            <Link href="/payment-info">
              How to pay
            </Link>

            <Link href="/#event-information">
              Event information
            </Link>
          </div>

          <div>
            <h3>Enquiries</h3>

            <a href="tel:+2348121567008">
              {eventConfig.contact.sponsorship}
            </a>

            <a href="tel:+2349165245102">
              {eventConfig.contact.enquiries}
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} ZIMJA FEST.
            All rights reserved.
          </span>

          <span>PARTY TILL MAMA CALLS.</span>
        </div>
      </Container>
    </footer>
  );
}