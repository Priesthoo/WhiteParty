import {
  CalendarDays,
  Clock3,
  MapPin,
  Music2,
  Waves,
  Sparkles,
} from "lucide-react";

import {
  Container,
  SectionHeading,
} from "@/components/ui";

import {
  eventConfig,
} from "@/features/events/config/event";

import {
  PaymentInfoSection,
} from "./PaymentInfoSection";

export function HomeSections() {
  return (
    <>
      {/* EXPERIENCE */}

      <section
        id="experience"
        className="section experience-section"
      >
        <Container>

          <SectionHeading
            eyebrow="THE EXPERIENCE"
            title={
              <>
                A night outside the <em>ordinary.</em>
              </>
            }
            description="A white-themed pool party created for music, great company and a memorable night."
            centered
          />

          <div className="experience-grid">

            <article>
              <Waves />

              <h3>Poolside atmosphere</h3>

              <p>
                Bring your summer energy and enjoy
                the pool-party setting.
              </p>
            </article>

            <article>
              <Music2 />

              <h3>Music & good company</h3>

              <p>
                Come ready to celebrate with friends
                and enjoy the night.
              </p>
            </article>

            <article>
              <Sparkles />

              <h3>All-white style</h3>

              <p>
                Dress in white and be part of the
                event's signature look.
              </p>
            </article>

          </div>
        </Container>
      </section>

      {/* EVENT INFORMATION */}

      <section
        id="event-information"
        className="section"
      >
        <Container>

          <SectionHeading
            eyebrow="SAVE THE DATE"
            title="Everything you need to know."
            description="Plan ahead for the ALL WHITE POOL PARTY."
          />

          <div className="event-info-grid">

            <div>
              <CalendarDays />
              <span>DATE</span>
              <strong>{eventConfig.dateLabel}</strong>
            </div>

            <div>
              <Clock3 />
              <span>TIME</span>
              <strong>{eventConfig.timeLabel}</strong>
            </div>

            <div>
              <MapPin />
              <span>VENUE</span>
              <strong>{eventConfig.venue}</strong>
            </div>

            <div>
              <Sparkles />
              <span>DRESS CODE</span>
              <strong>All White</strong>
            </div>

          </div>

        </Container>
      </section>

      {/* PAYMENT INFORMATION */}

      <PaymentInfoSection />

      {/* FAQ */}

      <section
        id="faq"
        className="section faq-section"
      >
        <Container>

          <SectionHeading
            eyebrow="GOOD TO KNOW"
            title="Frequently asked questions."
            centered
          />

          <div className="faq-list">

            <details>
              <summary>
                How do I secure a ticket?
              </summary>

              <p>
                Select a ticket, complete checkout,
                transfer the exact amount to the
                official account shown and submit
                your transfer details. Payment must
                be verified before a ticket is issued.
              </p>
            </details>

            <details>
              <summary>
                Are Early Bird tickets limited?
              </summary>

              <p>
                Early Bird is the first ticket release.
                Regular and Friends of 5 become
                available automatically when the
                Early Bird release is complete.
              </p>
            </details>

            <details>
              <summary>
                What does Friends of 5 include?
              </summary>

              <p>
                One package costs ₦36,000 and includes
                five individual admissions. Each
                attendee receives a separate ticket
                and QR code.
              </p>
            </details>

            <details>
              <summary>How do I pay?</summary>

              <p>
                Payment is made by direct bank transfer.
                The official account details and exact
                order amount appear after you reserve
                a ticket.
              </p>
            </details>

            <details>
              <summary>Where is the venue?</summary>

              <p>
                The venue is currently undisclosed.
                Confirmed guests will receive venue
                details through official event
                communication.
              </p>
            </details>

            <details>
              <summary>
                Can I enter with a screenshot?
              </summary>

              <p>
                Gate staff must validate the ticket
                QR credential or ticket ID against
                the live ticket and payment records.
                A screenshot alone does not guarantee
                admission.
              </p>
            </details>

          </div>
        </Container>
      </section>

      {/* CONTACT */}

      <section
        id="contact"
        className="section contact-section"
      >
        <Container>

          <div className="contact-panel">

            <span>SPONSORSHIPS & ENQUIRIES</span>

            <h2>
              Let's make it a night to remember.
            </h2>

            <p>
              For event enquiries and sponsorship
              opportunities, contact the organisers.
            </p>

            <div>
              <a href="tel:+2348121567008">
                {eventConfig.contact.sponsorship}
              </a>

              <a href="tel:+2349165245102">
                {eventConfig.contact.enquiries}
              </a>
            </div>

          </div>

        </Container>
      </section>
    </>
  );
}