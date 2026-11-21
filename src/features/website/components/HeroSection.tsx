import Image from "next/image";

import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
} from "lucide-react";

import {
  Container,
  ButtonLink,
} from "@/components/ui";

import {
  eventConfig,
} from "@/features/events/config/event";

import { Countdown } from "./Countdown";

export function HeroSection() {
  return (
    <section className="hero">

      <div className="hero-orb hero-orb-one" />
      <div className="hero-orb hero-orb-two" />

      <Container className="hero-layout">

        <div className="hero-content">

          <div className="organizer-line">
            <strong>{eventConfig.organizer}</strong>

            <span>
              PRESENTS · {eventConfig.presentedBy}
            </span>
          </div>

          <h1>
            ALL WHITE

            <span className="hero-script">
              Pool Party
            </span>
          </h1>

          <p className="hero-description">
            Dress in white. Bring your people.
            Get ready for an unforgettable pool-party night.
          </p>

          <div className="hero-facts">

            <div>
              <CalendarDays />

              <span>
                <strong>{eventConfig.dateLabel}</strong>
                <small>EVENT DATE</small>
              </span>
            </div>

            <div>
              <Clock3 />

              <span>
                <strong>{eventConfig.timeLabel}</strong>
                <small>START TIME</small>
              </span>
            </div>

            <div>
              <MapPin />

              <span>
                <strong>{eventConfig.venue}</strong>
                <small>VENUE</small>
              </span>
            </div>

          </div>

          <div className="hero-offer">
            <span>EARLY BIRD OFFER</span>

            <strong>₦4,000</strong>

            <small>
              Regular ₦8,000 · Friends of 5 ₦36,000
            </small>
          </div>

          <div className="hero-actions">

            <ButtonLink
              href="/tickets"
              size="lg"
            >
              Get your ticket
              <ArrowUpRight size={18} />
            </ButtonLink>

            <a href="#experience">
              Explore the experience
            </a>

          </div>

          <div className="hero-countdown-label">
            THE NIGHT IS APPROACHING
          </div>

          <Countdown />

          <p className="hero-slogan">
            {eventConfig.slogan}
          </p>

        </div>

        <div className="hero-art">

          <div className="flyer-frame">
            <Image
              src="/images/all-white-pool-party-flyer.jpg"
              alt="Official ALL WHITE Pool Party flyer presented by ZIMJA FEST"
              width={1229}
              height={1536}
              priority
              sizes="(max-width: 860px) 90vw, 43vw"
            />
          </div>

          <span className="flyer-caption">
            THE ALL WHITE EXPERIENCE
          </span>

        </div>

      </Container>
    </section>
  );
}