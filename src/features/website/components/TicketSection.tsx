
"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  ArrowRight,
  Check,
} from "lucide-react";

import {
  Badge,
  Container,
  SectionHeading,
} from "@/components/ui";

import {
  eventConfig,
} from "@/features/events/config/event";

import {
  formatNaira,
} from "@/lib/format";

type Availability = {
  earlyBird: {
    open: boolean;
  };

  regularOpen: boolean;

  friendsOpen: boolean;
};

export function TicketSection() {
  const [availability, setAvailability] =
    useState<Availability | null>(null);

  const [availabilityLoaded, setAvailabilityLoaded] =
    useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(
          "/api/tickets/availability",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            "Availability unavailable",
          );
        }

        const data = await response.json();

        if (active) {
          setAvailability(data.availability);
        }
      } catch {
        if (active) {
          setAvailability(null);
        }
      } finally {
        if (active) {
          setAvailabilityLoaded(true);
        }
      }
    };

    void load();

    const interval = window.setInterval(
      load,
      30000,
    );

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const tickets = eventConfig.tickets;

  // Keep Early Bird accessible while availability
  // is loading or the backend is not connected.
  // The server remains responsible for the
  // final reservation decision.

  const earlyBirdOpen = availability
    ? availability.earlyBird.open
    : true;

  const rows = [
    {
      id: "early-bird",

      name: "Early Bird",

      price: tickets["early-bird"].priceNaira,

      description:
        "A special first-release ticket price.",

      perks: [
        "One individual admission",
        "Personal digital ticket",
        "QR and manual ID verification",
      ],

      enabled: earlyBirdOpen,

      featured: true,

      unavailableLabel:
        "Early Bird unavailable",
    },

    {
      id: "regular",

      name: "Regular",

      price: tickets.regular.priceNaira,

      description:
        "Standard individual event admission.",

      perks: [
        "One individual admission",
        "Personal digital ticket",
        "QR and manual ID verification",
      ],

      enabled:
        availability?.regularOpen ?? false,

      featured: false,

      unavailableLabel:
        "Available after Early Bird",
    },

    {
      id: "friends-of-five",

      name: "Friends of 5",

      price:
        tickets["friends-of-five"].priceNaira,

      description:
        "Bring your people and celebrate together.",

      perks: [
        "Five individual admissions",
        "Five separate QR tickets",
        "One combined group order",
      ],

      enabled:
        availability?.friendsOpen ?? false,

      featured: false,

      unavailableLabel:
        "Available after Early Bird",
    },
  ];

  return (
    <section
      id="tickets"
      className="section ticket-section"
    >
      <Container>

        <SectionHeading
          eyebrow="SECURE YOUR EXPERIENCE"

          title={
            <>
              Choose your <em>experience.</em>
            </>
          }

          description="Choose your admission and get ready for the ALL WHITE experience."

          centered
        />

        {/* TICKET CARDS */}

        <div className="ticket-grid">

          {rows.map((ticket) => (
            <article
              key={ticket.id}
              className={
                `ticket-card` +
                `${ticket.featured ? " ticket-featured" : ""}` +
                `${!ticket.enabled ? " ticket-locked" : ""}`
              }
            >

              <div className="ticket-card-top">

                <span className="ticket-eyebrow">
                  {ticket.featured
                    ? "EARLY BIRD"
                    : ticket.name.toUpperCase()}
                </span>

                <h3>{ticket.name}</h3>

                <p>{ticket.description}</p>

                <strong className="ticket-price">
                  {formatNaira(ticket.price)}
                </strong>

                <span className="ticket-per">
                  {ticket.id === "friends-of-five"
                    ? "FIVE ADMISSIONS"
                    : "ONE ADMISSION"}
                </span>

              </div>

              <div className="ticket-perks">

                {ticket.perks.map((perk) => (
                  <span key={perk}>
                    <Check size={15} />
                    {perk}
                  </span>
                ))}

              </div>

              {ticket.enabled ? (
                <Link
                  className="btn btn-primary btn-full"
                  href={
                    `/checkout?ticket=${ticket.id}&quantity=1`
                  }
                >
                  Select ticket

                  <ArrowRight size={16} />
                </Link>
              ) : (
                <button
                  className="btn btn-outline btn-full"
                  disabled
                >
                  {ticket.unavailableLabel}
                </button>
              )}

              <small className="ticket-footnote">
                {ticket.id === "friends-of-five"
                  ? "₦7,200 per person."
                  : ticket.featured && !availabilityLoaded
                    ? "Live availability will be confirmed during checkout."
                    : "Availability is confirmed during checkout."}
              </small>

            </article>
          ))}

        </div>

      </Container>
    </section>
  );
}
