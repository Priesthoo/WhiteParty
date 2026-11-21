
"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type ChangeEvent,
} from "react";

import {
  Copy,
  Building2,
  ShieldCheck,
  Upload,
  FileCheck,
  Check,
  Clock,
  Ticket,
} from "lucide-react";

import {
  Button,
  Card,
  Container,
  Badge,
} from "@/components/ui";

type Bank = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
};

type Order = {
  order_reference: string;
  ticket_type_id: string;
  quantity: number;
  admissions_count: number;
  total_amount_kobo: number;
  status:
    | "reserved"
    | "payment_submitted"
    | "paid"
    | "expired"
    | "cancelled";
  reservation_expires_at: string;
};

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

export function PaymentPageClient({
  reference,
}: {
  reference: string;
}) {
  const [bank, setBank] = useState<Bank | null>(null);

  const [order, setOrder] = useState<Order | null>(null);

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);

  const [sender, setSender] = useState("");

  const [senderBank, setSenderBank] = useState("");

  const [transferRef, setTransferRef] = useState("");

  const [receipt, setReceipt] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);

  const [submitted, setSubmitted] = useState("");

  const [copied, setCopied] = useState(false);

  // =========================================================
  // LOAD ORDER AND PAYMENT INSTRUCTIONS
  // =========================================================

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const token = sessionStorage.getItem(
          `awn_checkout:${reference}`,
        );

        if (!token) {
          throw new Error(
            "This checkout session is not available in this browser. Use the same browser session used for your booking.",
          );
        }

        const orderResponse = await fetch(
          `/api/orders/${encodeURIComponent(reference)}`,
          {
            headers: {
              "x-checkout-token": token,
            },
            cache: "no-store",
          },
        );

        const orderData = await orderResponse.json();

        if (!orderResponse.ok) {
          throw new Error(
            orderData.error?.message ??
              "Order unavailable.",
          );
        }

        const loadedOrder = orderData.order as Order;

        if (
          !loadedOrder ||
          typeof loadedOrder.order_reference !== "string" ||
          typeof loadedOrder.status !== "string" ||
          !Number.isSafeInteger(
            Number(loadedOrder.total_amount_kobo),
          )
        ) {
          throw new Error(
            "The server returned invalid order information.",
          );
        }

        if (!active) return;

        setOrder(loadedOrder);

        // Bank details are only required when the order
        // is still awaiting its first payment submission.
        //
        // Previously submitted or paid orders should not
        // depend on the payment account configuration.

        if (loadedOrder.status !== "reserved") {
          return;
        }

        const bankResponse = await fetch(
          "/api/payment-instructions",
          {
            cache: "no-store",
          },
        );

        const bankData = await bankResponse.json();

        if (!bankResponse.ok) {
          throw new Error(
            bankData.error?.message ??
              "Bank details are not configured.",
          );
        }

        if (!bankData.bank) {
          throw new Error(
            "Bank payment details are unavailable.",
          );
        }

        if (active) {
          setBank(bankData.bank);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load payment details.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [reference]);


  // =========================================================
  // COPY ACCOUNT NUMBER
  // =========================================================

  async function copyAccountNumber() {
    if (!bank) return;

    try {
      await navigator.clipboard.writeText(
        bank.accountNumber,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setError(
        "Unable to copy the account number. Please copy it manually.",
      );
    }
  }


  // =========================================================
  // RECEIPT SELECTION
  // =========================================================

  function handleReceiptChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setError("");

    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setReceipt(null);
      return;
    }

    if (file.size <= 0) {
      setReceipt(null);
      event.target.value = "";

      setError(
        "The selected receipt is empty.",
      );

      return;
    }

    if (file.size > MAX_RECEIPT_SIZE) {
      setReceipt(null);
      event.target.value = "";

      setError(
        "Receipt must be 5 MB or smaller.",
      );

      return;
    }

    setReceipt(file);
  }


  // =========================================================
  // PAYMENT SUBMISSION
  // =========================================================

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    if (!order || !receipt) {
      setError(
        "Please provide your transfer receipt.",
      );

      return;
    }

    if (order.status !== "reserved") {
      setError(
        "This order is no longer accepting a payment submission.",
      );

      return;
    }

    const token = sessionStorage.getItem(
      `awn_checkout:${reference}`,
    );

    if (!token) {
      setError(
        "Checkout session has expired. Please use the original browser session.",
      );

      return;
    }

    const totalKobo = Number(
      order.total_amount_kobo,
    );

    const amountNaira = totalKobo / 100;

    if (
      !Number.isSafeInteger(totalKobo) ||
      !Number.isSafeInteger(amountNaira) ||
      amountNaira <= 0
    ) {
      setError(
        "The order amount is invalid. Please contact the organiser.",
      );

      return;
    }

    setBusy(true);

    try {
      const form = new FormData();

      form.set("orderReference", reference);

      form.set("checkoutToken", token);

      form.set("senderName", sender.trim());

      form.set("senderBank", senderBank.trim());

      form.set(
        "transferReference",
        transferRef.trim(),
      );

      form.set(
        "amountNaira",
        String(amountNaira),
      );

      form.set("receipt", receipt);

      const response = await fetch(
        "/api/payments/submit",
        {
          method: "POST",
          body: form,
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message ??
            "Payment submission failed.",
        );
      }

      if (
        result.success !== true ||
        typeof result.payment?.paymentReference !== "string"
      ) {
        throw new Error(
          "We could not confirm your payment submission. Please check your order status.",
        );
      }

      setSubmitted(
        result.payment.paymentReference,
      );

      // Reflect the new status immediately.
      setOrder({
        ...order,
        status: "payment_submitted",
      });

    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to submit payment.",
      );
    } finally {
      setBusy(false);
    }
  }


  // =========================================================
  // LOADING STATE
  // =========================================================

  if (loading) {
    return (
      <Container>
        <div className="page-shell">
          <p>Loading secure payment details…</p>
        </div>
      </Container>
    );
  }


  // =========================================================
  // ORDER LOADING ERROR
  // =========================================================

  if (!order) {
    return (
      <Container>
        <div className="page-shell">
          <Card>
            <h2>Payment details unavailable</h2>

            <p className="muted">
              {error ||
                "Unable to retrieve this order."}
            </p>

            <Button
              variant="outline"
              onClick={() => window.location.assign("/tickets")}
            >
              Return to tickets
            </Button>
          </Card>
        </div>
      </Container>
    );
  }


  // =========================================================
  // LOCALLY CONFIRMED SUBMISSION
  // =========================================================

  if (submitted) {
    return (
      <Container>
        <div className="page-shell">
          <Card>
            <FileCheck size={38} />

            <Badge variant="success">
              SUBMITTED FOR REVIEW
            </Badge>

            <h1>Payment details received.</h1>

            <p className="muted">
              Payment reference: {submitted}
            </p>

            <p className="muted">
              Your bank transfer has not yet been
              verified. Your tickets will be issued
              after an authorised administrator
              confirms the actual credit in the
              organiser's bank account.
            </p>

            <Button
              variant="outline"
              fullWidth
              onClick={() =>
                window.location.assign(
                  `/my-tickets?reference=${encodeURIComponent(reference)}`,
                )
              }
            >
              Check ticket status
            </Button>
          </Card>
        </div>
      </Container>
    );
  }


  // =========================================================
  // ALREADY SUBMITTED
  // =========================================================

  if (order.status === "payment_submitted") {
    return (
      <Container>
        <div className="page-shell">
          <Card>
            <Clock size={38} />

            <Badge variant="success">
              PAYMENT UNDER REVIEW
            </Badge>

            <h1>Your transfer details have been received.</h1>

            <p className="muted">
              We have already received a payment
              submission for this reservation.
              Please do not make another transfer
              or submit another receipt.
            </p>

            <p className="muted">
              The organiser will verify the actual
              bank credit before issuing your tickets.
            </p>

            <Button
              fullWidth
              onClick={() =>
                window.location.assign(
                  `/my-tickets?reference=${encodeURIComponent(reference)}`,
                )
              }
            >
              Check ticket status
            </Button>
          </Card>
        </div>
      </Container>
    );
  }


  // =========================================================
  // PAYMENT CONFIRMED
  // =========================================================

  if (order.status === "paid") {
    return (
      <Container>
        <div className="page-shell">
          <Card>
            <Check size={40} />

            <Badge variant="success">
              PAYMENT VERIFIED
            </Badge>

            <h1>Your payment is confirmed.</h1>

            <p className="muted">
              Your tickets have been issued.
              Open your ticket wallet to view
              your individual QR tickets.
            </p>

            <Button
              fullWidth
              onClick={() =>
                window.location.assign(
                  `/my-tickets?reference=${encodeURIComponent(reference)}`,
                )
              }
            >
              <Ticket size={16} />
              View my tickets
            </Button>
          </Card>
        </div>
      </Container>
    );
  }


  // =========================================================
  // CANCELLED OR EXPIRED ORDER
  // =========================================================

  if (
    order.status === "expired" ||
    order.status === "cancelled"
  ) {
    return (
      <Container>
        <div className="page-shell">
          <Card>
            <h2>
              {order.status === "expired"
                ? "Your reservation has expired."
                : "This order has been cancelled."}
            </h2>

            <p className="muted">
              This reservation can no longer accept
              payment. Return to ticket selection
              to check current availability.
            </p>

            <Button
              fullWidth
              onClick={() =>
                window.location.assign("/tickets")
              }
            >
              Return to tickets
            </Button>
          </Card>
        </div>
      </Container>
    );
  }


  // =========================================================
  // RESERVATION EXPIRY
  // =========================================================

  const expiryTime = Date.parse(
    order.reservation_expires_at,
  );

  const reservationExpired =
    !Number.isFinite(expiryTime) ||
    expiryTime <= Date.now();

  if (reservationExpired) {
    return (
      <Container>
        <div className="page-shell">
          <Card>
            <Clock size={36} />

            <h2>Your reservation has expired.</h2>

            <p className="muted">
              Your 20-minute reservation period
              has ended. Return to ticket selection
              to check availability.
            </p>

            <Button
              fullWidth
              onClick={() =>
                window.location.assign("/tickets")
              }
            >
              Return to tickets
            </Button>
          </Card>
        </div>
      </Container>
    );
  }


  // =========================================================
  // BANK DETAILS UNAVAILABLE
  // =========================================================

  if (!bank) {
    return (
      <Container>
        <div className="page-shell">
          <Card>
            <h2>Bank details unavailable</h2>

            <p className="muted">
              {error ||
                "Official payment instructions are not currently available."}
            </p>

            <p className="muted">
              Your reservation is still subject
              to its expiry time. Please contact
              the organiser for assistance.
            </p>
          </Card>
        </div>
      </Container>
    );
  }


  // =========================================================
  // PAYMENT PAGE
  // =========================================================

  const totalNaira =
    Number(order.total_amount_kobo) / 100;

  return (
    <Container>
      <div className="payment-page">

        {/* ------------------------------------------------- */}
        {/* PAGE HEADING */}
        {/* ------------------------------------------------- */}

        <div className="page-heading">
          <Badge variant="gold">
            BANK TRANSFER
          </Badge>

          <h1>Complete your payment.</h1>

          <p>
            Transfer the exact amount to the
            official event account.
          </p>
        </div>


        {/* ------------------------------------------------- */}
        {/* OFFICIAL BANK ACCOUNT */}
        {/* ------------------------------------------------- */}

        <Card>
          <div className="bank-heading">
            <Building2 />

            <div>
              <h2>Official payment account</h2>

              <span className="muted">
                ALL WHITE POOL PARTY
              </span>
            </div>
          </div>

          <div className="bank-detail">
            <span>BANK NAME</span>

            <strong>{bank.bankName}</strong>
          </div>

          <div className="bank-detail">
            <span>ACCOUNT NAME</span>

            <strong>{bank.accountName}</strong>
          </div>

          <div className="bank-detail bank-number">
            <div>
              <span>ACCOUNT NUMBER</span>

              <strong>{bank.accountNumber}</strong>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={copyAccountNumber}
            >
              {copied ? (
                <Check size={15} />
              ) : (
                <Copy size={15} />
              )}

              {copied ? "Copied" : "Copy"}
            </Button>
          </div>


          {/* PAYMENT AMOUNT */}

          <div className="payment-amount">
            <span>EXACT AMOUNT TO TRANSFER</span>

            <strong>
              ₦{totalNaira.toLocaleString("en-NG")}
            </strong>
          </div>


          {/* TRANSFER NARRATION */}

          <div className="bank-detail">
            <span>TRANSFER NARRATION / REMARK</span>

            <strong>{order.order_reference}</strong>
          </div>

          <p className="muted">
            {bank.instructions}
          </p>


          {/* SECURITY MESSAGE */}

          <div className="payment-warning">
            <ShieldCheck size={19} />

            <p>
              Verify the beneficiary account name
              before transferring. Do not pay an
              account sent through an unofficial
              channel.
            </p>
          </div>
        </Card>


        {/* ------------------------------------------------- */}
        {/* PAYMENT SUBMISSION FORM */}
        {/* ------------------------------------------------- */}

        <Card>
          <h2>Submit your transfer details</h2>

          <p className="muted">
            A screenshot is not proof of payment.
            The organiser will check the actual
            bank credit.
          </p>

          <form
            className="form-stack"
            onSubmit={submit}
          >

            {/* SENDER NAME */}

            <div className="form-field">
              <label htmlFor="sender">
                Sender's account name
              </label>

              <input
                className="input"
                id="sender"
                name="senderName"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                value={sender}
                onChange={(event) =>
                  setSender(event.target.value)
                }
                placeholder="Name on the sending bank account"
              />
            </div>


            {/* SENDER BANK */}

            <div className="form-field">
              <label htmlFor="sender-bank">
                Sending bank
              </label>

              <input
                className="input"
                id="sender-bank"
                name="senderBank"
                maxLength={100}
                value={senderBank}
                onChange={(event) =>
                  setSenderBank(event.target.value)
                }
                placeholder="Name of your bank"
              />
            </div>


            {/* TRANSFER REFERENCE */}

            <div className="form-field">
              <label htmlFor="transfer-ref">
                Bank transaction reference
              </label>

              <input
                className="input"
                id="transfer-ref"
                name="transferReference"
                required
                minLength={3}
                maxLength={120}
                value={transferRef}
                onChange={(event) =>
                  setTransferRef(event.target.value)
                }
                placeholder="Enter your bank transaction reference"
              />
            </div>


            {/* RECEIPT UPLOAD */}

            <div className="form-field">
              <label htmlFor="receipt">
                Transfer receipt
              </label>

              <p className="muted">
                JPG, PNG or PDF. Maximum size: 5 MB.
              </p>

              <input
                className="input"
                id="receipt"
                name="receipt"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                required
                onChange={handleReceiptChange}
              />

              {receipt && (
                <p className="muted">
                  <FileCheck
                    size={14}
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                    }}
                  />

                  {" "}{receipt.name}
                </p>
              )}
            </div>


            {/* ERROR MESSAGE */}

            {error && (
              <div
                className="error-box"
                role="alert"
              >
                {error}
              </div>
            )}


            {/* SUBMIT */}

            <Button
              type="submit"
              fullWidth
              disabled={busy || !receipt}
            >
              {busy
                ? "Submitting…"
                : "Submit for payment verification"}

              <Upload size={16} />
            </Button>

          </form>
        </Card>

      </div>
    </Container>
  );
}
