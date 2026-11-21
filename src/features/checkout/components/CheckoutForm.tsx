"use client";

import { useState, type FormEvent } from "react";

import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  Button,
  Card,
  Badge,
} from "@/components/ui";

import { formatNaira } from "@/lib/format";

type Props = {
  ticketTypeId:
    | "early-bird"
    | "regular"
    | "friends-of-five";

  ticketName: string;
  description: string;
  price: number;
  admissionsPerUnit: number;
  initialQuantity: number;
};

export function CheckoutForm({
  ticketTypeId,
  ticketName,
  description,
  price,
  admissionsPerUnit,
  initialQuantity,
}: Props) {
  const safeQuantity = Math.max(
    1,
    Math.min(5, initialQuantity),
  );

  const [quantity, setQuantity] =
    useState(safeQuantity);

  const [names, setNames] = useState<string[]>(
    () =>
      Array.from(
        {
          length: safeQuantity * admissionsPerUnit,
        },
        () => "",
      ),
  );

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  const totalAdmissions =
    quantity * admissionsPerUnit;

  const total = quantity * price;

  function updateQuantity(value: number) {
    const next = Math.max(
      1,
      Math.min(5, value),
    );

    setQuantity(next);

    setNames((old) =>
      Array.from(
        {
          length: next * admissionsPerUnit,
        },
        (_, i) => old[i] ?? "",
      ),
    );
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          ticketTypeId,
          quantity,

          buyer: {
            name: form.get("name"),
            email: form.get("email"),
            phone: form.get("phone"),
          },

          attendees: names.map((fullName) => ({
            fullName,
          })),
        }),
      });

      const result = await response.json();

      if (
        !response.ok ||
        !result.order?.checkoutToken
      ) {
        throw new Error(
          result.error?.message ??
          "Unable to reserve tickets.",
        );
      }

      sessionStorage.setItem(
        `awn_checkout:${result.order.orderReference}`,
        result.order.checkoutToken,
      );

      window.location.assign(
        `/payment?reference=${encodeURIComponent(
          result.order.orderReference,
        )}`,
      );

    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Checkout failed.",
      );

    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="checkout-layout">

      <div>
        <a
          className="back-link"
          href="/tickets"
        >
          <ArrowLeft size={15} />
          Back to tickets
        </a>

        <div className="page-heading">
          <Badge variant="gold">
            ALL WHITE POOL PARTY
          </Badge>

          <h1>Complete your booking.</h1>

          <p>
            Enter your information to reserve
            your admission.
          </p>
        </div>

        <form
          className="checkout-form"
          onSubmit={submit}
        >
          <Card>
            <h2>01 · Purchaser information</h2>

            <div className="form-stack">
              <div className="form-field">
                <label htmlFor="buyer-name">
                  Full name
                </label>

                <input
                  className="input"
                  id="buyer-name"
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={120}
                  required
                  placeholder="Your full name"
                />
              </div>

              <div className="form-field">
                <label htmlFor="buyer-email">
                  Email address
                </label>

                <input
                  className="input"
                  id="buyer-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </div>

              <div className="form-field">
                <label htmlFor="buyer-phone">
                  Phone number
                </label>

                <input
                  className="input"
                  id="buyer-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  minLength={7}
                  maxLength={24}
                  required
                  placeholder="+234 ..."
                />
              </div>
            </div>
          </Card>

          <Card>
            <h2>02 · Attendee information</h2>

            <p className="muted">
  Each admission receives its own unique
  ticket code after payment is confirmed.
  QR codes may also be provided.
    </p>

            <div className="form-stack">
              {names.map((name, index) => (
                <div
                  className="form-field"
                  key={index}
                >
                  <label htmlFor={`attendee-${index}`}>
                    {totalAdmissions > 1
                      ? `Attendee ${index + 1}`
                      : "Attendee full name"}
                  </label>

                  <input
                    className="input"
                    id={`attendee-${index}`}
                    value={name}
                    minLength={2}
                    maxLength={100}
                    onChange={(event) =>
                      setNames((old) =>
                        old.map((n, i) =>
                          i === index
                            ? event.target.value
                            : n,
                        ),
                      )
                    }
                    required
                    placeholder="Guest full name"
                  />
                </div>
              ))}
            </div>

            <p className="muted">
              <Users
                size={14}
                style={{
                  display: "inline",
                  verticalAlign: "middle",
                }}
              />

              {" "}Friends of 5 includes five
              independently scannable admissions.
            </p>
          </Card>

          <label className="terms">
            <input type="checkbox" required />

            I confirm the details are accurate and
            agree to the event's ticketing and entry
            policies.
          </label>

          {error && (
            <div
              className="error-box"
              role="alert"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            disabled={submitting}
          >
            {submitting
              ? "Creating reservation…"
              : "Reserve my tickets"}

            <ArrowRight size={17} />
          </Button>

          <p
            className="muted"
            style={{ textAlign: "center" }}
          >
            <ShieldCheck
              size={14}
              style={{
                display: "inline",
                verticalAlign: "middle",
              }}
            />

            {" "}Your order is validated by the
            server before reservation.
          </p>
        </form>
      </div>

      <aside className="order-summary">
        <Card>
          <h2>Order summary</h2>

          <div className="bank-detail">
            <span>SELECTED TICKET</span>

            <strong>{ticketName}</strong>

            <p className="muted">
              {description}
            </p>

            <strong>{formatNaira(price)}</strong>
          </div>

          <div className="quantity-row">
            <div>
              <strong>Quantity</strong>

              <small>
                {admissionsPerUnit === 5
                  ? "Packages"
                  : "Tickets"}
              </small>
            </div>

            <div>
              <button
                type="button"
                disabled={quantity <= 1 || submitting}
                onClick={() =>
                  updateQuantity(quantity - 1)
                }
                aria-label="Decrease quantity"
              >
                −
              </button>

              <strong>{quantity}</strong>

              <button
                type="button"
                disabled={quantity >= 5 || submitting}
                onClick={() =>
                  updateQuantity(quantity + 1)
                }
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          <div className="summary-row">
            <span>Individual admissions</span>
            <strong>{totalAdmissions}</strong>
          </div>

          <div className="summary-row">
            <span>Ticket total</span>
            <strong>{formatNaira(total)}</strong>
          </div>

          <div className="summary-total">
            <span>Total</span>
            <strong>{formatNaira(total)}</strong>
          </div>

          
        </Card>
      </aside>

    </div>
  );
}