import Link from "next/link";

import {
  ArrowRight,
  Landmark,
  ShieldCheck,
  FileCheck2,
} from "lucide-react";

import { Container } from "@/components/ui";

export function PaymentInfoSection() {
  return (
    <section
      className="section payment-info-section"
      id="how-to-pay"
    >
      <Container>
        <div className="payment-info-panel">

          <div className="payment-info-icon">
            <Landmark size={25} />
          </div>

          <div className="payment-info-copy">

            <span>PAYMENT METHOD</span>

            <h2>
              Simple, direct bank transfer.
            </h2>

            <p>
              ALL WHITE POOL PARTY accepts direct
              bank transfers to the organiser's
              designated account. No card payment
              gateway is required.
            </p>

            <div className="payment-info-steps">

              <div>
                <strong>01</strong>

                <span>
                  Select your ticket and complete
                  checkout.
                </span>
              </div>

              <div>
                <strong>02</strong>

                <span>
                  View the official account name,
                  bank and exact amount on your
                  secure payment page.
                </span>
              </div>

              <div>
                <strong>03</strong>

                <span>
                  Make the transfer and submit
                  the bank reference and receipt.
                </span>
              </div>

              <div>
                <strong>04</strong>

                <span>
                  The organiser verifies the actual
                  credit before issuing your
                  digital ticket.
                </span>
              </div>

            </div>

            <div className="payment-info-note">
              <ShieldCheck size={18} />

              <p>
                Bank details are displayed during
                an order's payment step. Always
                verify the beneficiary name before
                transferring. A receipt screenshot
                alone does not confirm payment.
              </p>
            </div>

            <div className="payment-info-actions">

              <Link
                href="/tickets"
                className="btn btn-primary"
              >
                Choose a ticket
                <ArrowRight size={16} />
              </Link>

              <span>
                <FileCheck2 size={16} />
                Digital ticket after payment approval
              </span>

            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}