"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import QRCode from "qrcode";

import {
  Printer,
  RefreshCw,
  ShieldCheck,
  Clock3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Container,
} from "@/components/ui";

import { eventConfig } from "@/features/events/config/event";

// ===========================================================
// TYPES
// ===========================================================

type TicketStatus = "active" | "used" | "cancelled";

type WalletStatus =
  | "loading"
  | "reserved"
  | "payment_submitted"
  | "paid"
  | "expired"
  | "cancelled"
  | "unknown";

type Ticket = {
  ticketCode: string;
  attendeeName: string;
  ticketType: string;
  status: TicketStatus;
  issuedAt: string;
  qrCredential: string;
};

type WalletResponse = {
  success: true;
  status: WalletStatus;
  message?: string;
  tickets: Ticket[];
};

// ===========================================================
// CONSTANTS
// ===========================================================

const TICKET_PATTERN = /^AWN-2026-[A-F0-9]{16}$/;

const QR_CREDENTIAL_PATTERN =
  /^AWNQR1\.AWN-2026-[A-F0-9]{16}\.[a-f0-9]{32}\.[a-f0-9]{64}$/;

const TICKET_MESSAGES: Record<string, string> = {
  reserved:
    "Your reservation has been created. Complete your bank transfer and submit your payment details to proceed.",

  payment_submitted:
    "Your transfer details have been received. The organiser is checking the actual bank credit. Your tickets will appear after payment is confirmed.",

  expired:
    "Your reservation has expired. This order can no longer accept payment. Return to ticket selection to check availability.",

  cancelled:
    "This order has been cancelled. Its tickets cannot be used for event entry.",

  paid:
    "Your payment has been confirmed. Your individual admission tickets are ready.",

  unknown:
    "We could not determine the status of this order. Please contact the event organiser.",
};

// ===========================================================
// HELPERS
// ===========================================================

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isTicketStatus(
  value: unknown,
): value is TicketStatus {
  return (
    value === "active" ||
    value === "used" ||
    value === "cancelled"
  );
}

function isWalletStatus(
  value: unknown,
): value is WalletStatus {
  return (
    value === "reserved" ||
    value === "payment_submitted" ||
    value === "paid" ||
    value === "expired" ||
    value === "cancelled"
  );
}

function getApiError(data: unknown): string {
  if (!isRecord(data)) {
    return "Unable to retrieve tickets.";
  }

  if (typeof data.error === "string") {
    return data.error;
  }

  if (
    isRecord(data.error) &&
    typeof data.error.message === "string"
  ) {
    return data.error.message;
  }

  return "Unable to retrieve tickets.";
}

function validateTicket(value: unknown): Ticket {
  if (!isRecord(value)) {
    throw new Error(
      "The server returned an invalid ticket.",
    );
  }

  const {
    ticketCode,
    attendeeName,
    ticketType,
    status,
    issuedAt,
    qrCredential,
  } = value;

  if (
    typeof ticketCode !== "string" ||
    !TICKET_PATTERN.test(ticketCode) ||
    typeof attendeeName !== "string" ||
    typeof ticketType !== "string" ||
    !isTicketStatus(status) ||
    typeof issuedAt !== "string" ||
    !Number.isFinite(Date.parse(issuedAt)) ||
    typeof qrCredential !== "string" ||
    !QR_CREDENTIAL_PATTERN.test(qrCredential)
  ) {
    throw new Error(
      "The server returned incomplete or invalid ticket information.",
    );
  }

  return {
    ticketCode,
    attendeeName,
    ticketType,
    status,
    issuedAt,
    qrCredential,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);

  return date.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ===========================================================
// COMPONENT
// ===========================================================

export function TicketWallet({
  reference,
}: {
  reference: string;
}) {
  // =========================================================
  // STATE
  // =========================================================

  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [images, setImages] = useState<
    Record<string, string>
  >({});

  const [status, setStatus] =
    useState<WalletStatus>("loading");

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  // =========================================================
  // REFS
  // =========================================================

  const mountedRef = useRef(false);

  const requestIdRef = useRef(0);

  const controllerRef =
    useRef<AbortController | null>(null);

  // =========================================================
  // LOAD CUSTOMER TICKETS
  // =========================================================

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    // Cancel any previous request.
    controllerRef.current?.abort();

    const controller = new AbortController();

    controllerRef.current = controller;

    setError("");

    setBusy(true);

    try {
      // -----------------------------------------------
      // CHECKOUT SESSION
      // -----------------------------------------------

      const token = sessionStorage.getItem(
        `awn_checkout:${reference}`,
      );

      if (!token) {
        throw new Error(
          "This checkout session is not available in this browser. Please use the same browser session used to reserve your tickets.",
        );
      }

      // -----------------------------------------------
      // FETCH TICKETS
      // -----------------------------------------------

      const response = await fetch(
        `/api/tickets/order/${encodeURIComponent(reference)}`,
        {
          method: "GET",

          headers: {
            "x-checkout-token": token,
          },

          cache: "no-store",

          signal: controller.signal,
        },
      );

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getApiError(data));
      }

      // -----------------------------------------------
      // VALIDATE API RESPONSE
      // -----------------------------------------------

      if (
        !isRecord(data) ||
        data.success !== true ||
        !isWalletStatus(data.status) ||
        !Array.isArray(data.tickets)
      ) {
        throw new Error(
          "The ticket service returned an invalid response.",
        );
      }

      const nextStatus = data.status;

      const nextTickets = data.tickets.map(
        validateTicket,
      );

      // Only paid orders should return tickets.
      if (
        nextStatus !== "paid" &&
        nextTickets.length > 0
      ) {
        throw new Error(
          "Ticket access could not be verified.",
        );
      }

      // -----------------------------------------------
      // GENERATE INDIVIDUAL QR IMAGES
      // -----------------------------------------------

      const nextImages: Record<string, string> = {};

      await Promise.all(
        nextTickets
          .filter((ticket) => ticket.status === "active")
          .map(async (ticket) => {
            const image = await QRCode.toDataURL(
              ticket.qrCredential,
              {
                errorCorrectionLevel: "H",
                margin: 2,
                width: 300,
              },
            );

            nextImages[ticket.ticketCode] = image;
          }),
      );

      // -----------------------------------------------
      // UPDATE STATE
      // -----------------------------------------------

      if (
        !mountedRef.current ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      setTickets(nextTickets);

      setImages(nextImages);

      setStatus(nextStatus);

      // Use status-specific messages rather than the
      // generic API message for expired or cancelled orders.
      setMessage(
        nextStatus === "payment_submitted" &&
        typeof data.message === "string"
          ? data.message
          : TICKET_MESSAGES[nextStatus],
      );

    } catch (caught) {
      if (
        caught instanceof Error &&
        caught.name === "AbortError"
      ) {
        return;
      }

      if (
        mountedRef.current &&
        requestId === requestIdRef.current
      ) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Ticket lookup failed.",
        );

        setStatus("unknown");
      }

    } finally {
      if (
        mountedRef.current &&
        requestId === requestIdRef.current
      ) {
        setBusy(false);
      }
    }
  }, [reference]);

  // =========================================================
  // INITIAL LOAD AND CLEANUP
  // =========================================================

  useEffect(() => {
    mountedRef.current = true;

    void load();

    return () => {
      mountedRef.current = false;

      requestIdRef.current += 1;

      controllerRef.current?.abort();

      controllerRef.current = null;
    };
  }, [load]);

  // =========================================================
  // REFRESH
  // =========================================================

  async function refresh() {
    if (busy) return;

    await load();
  }

  // =========================================================
  // TICKET STATISTICS
  // =========================================================

  const activeCount = tickets.filter(
    (ticket) => ticket.status === "active",
  ).length;

  const usedCount = tickets.filter(
    (ticket) => ticket.status === "used",
  ).length;

  const cancelledCount = tickets.filter(
    (ticket) => ticket.status === "cancelled",
  ).length;

  // =========================================================
  // EMPTY STATE CONFIGURATION
  // =========================================================

  const emptyState = {
    reserved: {
      title: "Reservation created",
      icon: Clock3,
      variant: "warning" as const,
    },

    payment_submitted: {
      title: "Payment under review",
      icon: Clock3,
      variant: "warning" as const,
    },

    expired: {
      title: "Reservation expired",
      icon: XCircle,
      variant: "danger" as const,
    },

    cancelled: {
      title: "Order cancelled",
      icon: XCircle,
      variant: "danger" as const,
    },

    paid: {
      title: "Payment confirmed",
      icon: CheckCircle2,
      variant: "success" as const,
    },

    unknown: {
      title: "Order status unavailable",
      icon: AlertTriangle,
      variant: "neutral" as const,
    },
  };

  const state = emptyState[
    status === "loading" ? "unknown" : status
  ];

  const EmptyIcon = state.icon;

  // =========================================================
  // EVENT DISPLAY DETAILS
  // =========================================================

  const eventDateTime =
    `${eventConfig.dateLabel.toUpperCase()} · ${eventConfig.timeLabel}`;

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <Container>
      <div className="wallet">

        {/* ------------------------------------------------ */}
        {/* WALLET HEADER */}
        {/* ------------------------------------------------ */}

        <div className="page-heading">
          <Badge variant="gold">
            {eventConfig.organizer}
          </Badge>

          <h1>Your event tickets</h1>

          <p>
            {eventConfig.name} · {eventDateTime}
          </p>

          <p className="muted">
            Order: {reference}
          </p>
        </div>

        {/* ------------------------------------------------ */}
        {/* WALLET TOOLBAR */}
        {/* ------------------------------------------------ */}

        <div className="wallet-actions">

          <Button
            variant="outline"
            onClick={() => void refresh()}
            disabled={busy}
          >
            <RefreshCw
              size={15}
              className={busy ? "wallet-refreshing" : ""}
            />

            {busy ? "Refreshing…" : "Refresh"}
          </Button>

          {activeCount > 0 && (
            <Button
              onClick={() => window.print()}
              disabled={busy}
            >
              <Printer size={15} />

              Print tickets
            </Button>
          )}

        </div>

        {/* ------------------------------------------------ */}
        {/* LOADING STATE */}
        {/* ------------------------------------------------ */}

        {status === "loading" && (
          <Card>
            <Clock3 size={30} />

            <h2>Loading your tickets</h2>

            <p className="muted">
              Securely retrieving your order and
              generating your individual QR tickets.
            </p>
          </Card>
        )}

        {/* ------------------------------------------------ */}
        {/* ERROR STATE */}
        {/* ------------------------------------------------ */}

        {error && (
          <Card>
            <AlertTriangle
              size={30}
              color="#dc2626"
            />

            <h2>Unable to retrieve your tickets</h2>

            <p
              className="muted"
              role="alert"
            >
              {error}
            </p>

            <Button
              variant="outline"
              onClick={() => void refresh()}
              disabled={busy}
            >
              <RefreshCw size={15} />

              Try again
            </Button>
          </Card>
        )}

        {/* ------------------------------------------------ */}
        {/* PAYMENT OR ORDER STATUS */}
        {/* ------------------------------------------------ */}

        {!error &&
          status !== "loading" &&
          tickets.length === 0 && (
            <Card>
              <EmptyIcon size={34} />

              <Badge variant={state.variant}>
                {status.replaceAll("_", " ").toUpperCase()}
              </Badge>

              <h2>
                {status === "paid"
                  ? "Tickets unavailable"
                  : state.title}
              </h2>

              <p className="muted">
                {status === "paid"
                  ? "Your payment is confirmed, but no individual tickets were returned. Please contact the event organiser."
                  : message || TICKET_MESSAGES.unknown}
              </p>

              {status === "expired" ||
              status === "cancelled" ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    window.location.assign("/tickets")
                  }
                >
                  Browse tickets
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => void refresh()}
                  disabled={busy}
                >
                  <RefreshCw size={15} />

                  Check again
                </Button>
              )}
            </Card>
          )}

        {/* ------------------------------------------------ */}
        {/* PAID ORDER SUMMARY */}
        {/* ------------------------------------------------ */}

        {!error &&
          status === "paid" &&
          tickets.length > 0 && (
            <Card className="wallet-summary">
              <div className="wallet-summary-heading">
                <CheckCircle2 size={25} />

                <div>
                  <Badge variant="success">
                    PAYMENT CONFIRMED
                  </Badge>

                  <h2>Your tickets are ready</h2>
                </div>
              </div>

              <div className="wallet-statistics">
                <div>
                  <strong>{tickets.length}</strong>
                  <span>Total admissions</span>
                </div>

                <div>
                  <strong>{activeCount}</strong>
                  <span>Active tickets</span>
                </div>

                <div>
                  <strong>{usedCount}</strong>
                  <span>Used tickets</span>
                </div>

                {cancelledCount > 0 && (
                  <div>
                    <strong>{cancelledCount}</strong>
                    <span>Cancelled tickets</span>
                  </div>
                )}
              </div>

              <p className="muted">
                Each ticket admits one individual guest.
                Every active ticket has its own QR credential.
              </p>
            </Card>
          )}

        {/* ------------------------------------------------ */}
        {/* INDIVIDUAL DIGITAL TICKETS */}
        {/* ------------------------------------------------ */}

        {!error &&
          tickets.length > 0 && (
            <div className="wallet-grid">

              {tickets.map((ticket, index) => {
                const active =
                  ticket.status === "active";

                const used =
                  ticket.status === "used";

                return (
                  <article
                    className="digital-ticket"
                    key={ticket.ticketCode}
                  >

                    {/* TICKET HEADER */}

                    <div className="digital-ticket-head">
                      <span>
                        {eventConfig.organizer} PRESENTS
                      </span>

                      <strong>
                        ALL WHITE · POOL PARTY
                      </strong>
                    </div>

                    {/* TICKET BODY */}

                    <div className="digital-ticket-main">

                      <span>
                        ADMIT ONE
                      </span>

                      <h2>
                        {ticket.attendeeName}
                      </h2>

                      <Badge
                        variant={
                          active
                            ? "success"
                            : used
                              ? "neutral"
                              : "danger"
                        }
                      >
                        {ticket.status.toUpperCase()}
                      </Badge>

                      <p className="muted">
                        {ticket.ticketType}
                      </p>

                      <span className="ticket-admission-number">
                        ADMISSION {index + 1} OF {tickets.length}
                      </span>

                      {/* QR CREDENTIAL */}

                      {active && images[ticket.ticketCode] && (
                        <div className="ticket-qr">
                          <img
                            src={images[ticket.ticketCode]}
                            alt={`Private QR credential for ticket ${ticket.ticketCode}`}
                            loading="lazy"
                          />

                          <small>
                            YOUR PERSONAL QR TICKET
                          </small>
                        </div>
                      )}

                      {/* NON-ACTIVE TICKET */}

                      {!active && (
                        <div className="ticket-inactive">
                          {used ? (
                            <CheckCircle2 size={30} />
                          ) : (
                            <XCircle size={30} />
                          )}

                          <strong>
                            {used
                              ? "Already admitted"
                              : "Ticket cancelled"}
                          </strong>

                          <small>
                            This ticket cannot be used
                            for another admission.
                          </small>
                        </div>
                      )}

                      <small>
                        {active
                          ? "SCAN AT EVENT ENTRY"
                          : "NOT VALID FOR ENTRY"}
                      </small>

                    </div>

                    {/* TICKET IDENTIFICATION */}

                    <div className="digital-ticket-id">
                      <span>TICKET ID</span>

                      <strong>
                        {ticket.ticketCode}
                      </strong>
                    </div>

                    {/* TICKET FOOTER */}

                    <div className="digital-ticket-foot">
                      {eventDateTime.toUpperCase()}

                      <br />

                      <strong>
                        {eventConfig.slogan}
                      </strong>
                    </div>

                  </article>
                );
              })}

            </div>
          )}

        {/* ------------------------------------------------ */}
        {/* WALLET SECURITY MESSAGE */}
        {/* ------------------------------------------------ */}

        {tickets.length > 0 && (
          <div className="wallet-security-note">
            <ShieldCheck size={17} />

            <p>
              Keep your ticket QR code private.
              Each active ticket is valid for one
              individual admission. Once scanned
              successfully, it cannot be used again.
            </p>
          </div>
        )}

      </div>
    </Container>
  );
}