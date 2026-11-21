

"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  RefreshCw,
  FileText,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock3,
  AlertTriangle,
  Mail,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
} from "@/components/ui";


type PaymentOrder = {
  orderReference: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  ticketTypeId: string;
  quantity: number;
  admissionsCount: number;
  totalAmountKobo: number;
  status: string;
};

type Payment = {
  id: string;
  reference: string;
  senderName: string;
  senderBank: string | null;
  transferReference: string;
  amountKobo: number;
  status: string;
  submittedAt: string;
  receiptUrl: string | null;
  order: PaymentOrder | null;
};

type PaymentDecision = "approve" | "reject";

type EmailDelivery = {
  status: "sent" | "failed";
  messageId?: string;
  message?: string;
};

type ReviewFeedback = {
  type: "success" | "warning";
  title: string;
  message: string;

  orderReference?: string;
  buyerEmail?: string;
  canResend?: boolean;
};


const money = (amountKobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amountKobo / 100);


function formatDate(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}


// ============================================================
// RESPONSE VALIDATION
// ============================================================

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}


function isPaymentOrder(
  value: unknown,
): value is PaymentOrder {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.orderReference === "string" &&
    typeof value.buyerName === "string" &&
    typeof value.buyerEmail === "string" &&
    typeof value.buyerPhone === "string" &&
    typeof value.ticketTypeId === "string" &&
    Number.isSafeInteger(Number(value.quantity)) &&
    Number.isSafeInteger(Number(value.admissionsCount)) &&
    Number.isSafeInteger(Number(value.totalAmountKobo)) &&
    typeof value.status === "string"
  );
}


function isPayment(
  value: unknown,
): value is Payment {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.reference === "string" &&
    typeof value.senderName === "string" &&
    typeof value.transferReference === "string" &&
    typeof value.status === "string" &&
    typeof value.submittedAt === "string" &&
    Number.isSafeInteger(Number(value.amountKobo)) &&

    (
      value.senderBank === null ||
      typeof value.senderBank === "string"
    ) &&

    (
      value.receiptUrl === null ||
      typeof value.receiptUrl === "string"
    ) &&

    (
      value.order === null ||
      isPaymentOrder(value.order)
    )
  );
}


function isEmailDelivery(
  value: unknown,
): value is EmailDelivery {
  if (!isRecord(value)) {
    return false;
  }

  if (value.status === "sent") {
    return (
      typeof value.messageId === "string" &&
      value.messageId.length > 0
    );
  }

  if (value.status === "failed") {
    return (
      value.message === undefined ||
      typeof value.message === "string"
    );
  }

  return false;
}


// ============================================================
// PAYMENT QUEUE
// ============================================================

export function PaymentQueue() {
  const [data, setData] = useState<Payment[]>([]);

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState("");

  const [resendingOrder, setResendingOrder] =
    useState("");

  const [err, setErr] = useState("");

  const [feedback, setFeedback] =
    useState<ReviewFeedback | null>(null);

  const [notes, setNotes] = useState<
    Record<string, string>
  >({});

  const [amounts, setAmounts] = useState<
    Record<string, string>
  >({});

  const [bankRefs, setBankRefs] = useState<
    Record<string, string>
  >({});

  const [confirmed, setConfirmed] = useState<
    Record<string, boolean>
  >({});


  // =========================================================
  // LOAD PAYMENT QUEUE
  // =========================================================

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/admin/payments",
        {
          cache: "no-store",
        },
      );

      const result: unknown = await response.json();

      if (!response.ok) {
        const message =
          isRecord(result) &&
          typeof result.error === "string"
            ? result.error
            : "Could not load payments.";

        throw new Error(message);
      }

      if (
        !isRecord(result) ||
        result.success !== true ||
        !Array.isArray(result.payments) ||
        !result.payments.every(isPayment)
      ) {
        throw new Error(
          "The payment queue returned invalid data.",
        );
      }

      setData(result.payments);

    } catch (caught) {
      setErr(
        caught instanceof Error
          ? caught.message
          : "Payment queue unavailable.",
      );

    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    void load();
  }, [load]);


  // =========================================================
  // UPDATE PAYMENT FIELDS
  // =========================================================

  function updateNote(
    id: string,
    value: string,
  ) {
    setNotes((previous) => ({
      ...previous,
      [id]: value,
    }));
  }


  function updateAmount(
    id: string,
    value: string,
  ) {
    setAmounts((previous) => ({
      ...previous,
      [id]: value,
    }));
  }


  function updateBankReference(
    id: string,
    value: string,
  ) {
    setBankRefs((previous) => ({
      ...previous,
      [id]: value,
    }));
  }


  function updateConfirmation(
    id: string,
    value: boolean,
  ) {
    setConfirmed((previous) => ({
      ...previous,
      [id]: value,
    }));
  }


  // =========================================================
  // CLEAR REVIEW FORM
  // =========================================================

  function clearPaymentForm(id: string) {
    setNotes((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });

    setAmounts((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });

    setBankRefs((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });

    setConfirmed((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }


  // =========================================================
  // RESEND EXISTING TICKET EMAIL
  // =========================================================

  async function resendTicketEmail() {
    const currentFeedback = feedback;

    if (
      !currentFeedback ||
      !currentFeedback.canResend ||
      !currentFeedback.orderReference
    ) {
      return;
    }

    const reference =
      currentFeedback.orderReference;

    if (resendingOrder) {
      return;
    }

    setResendingOrder(reference);
    setErr("");

    try {
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(reference)}/resend-tickets`,
        {
          method: "POST",
        },
      );

      const result: unknown = await response.json();


      // -----------------------------------------------------
      // VALIDATE SERVER RESPONSE
      // -----------------------------------------------------

      if (!response.ok) {
        const message =
          isRecord(result) &&
          typeof result.error === "string"
            ? result.error
            : "Could not resend the ticket email.";

        throw new Error(message);
      }

      if (
        !isRecord(result) ||
        result.success !== true ||
        !isRecord(result.emailDelivery)
      ) {
        throw new Error(
          "The email resend response was invalid.",
        );
      }

      const delivery = result.emailDelivery;


      // -----------------------------------------------------
      // SUCCESSFUL EMAIL DELIVERY
      // -----------------------------------------------------

      if (delivery.status === "sent") {
        setFeedback({
          type: "success",

          title: "Ticket email sent successfully",

          message: [
            "The existing ticket codes were emailed to the buyer.",
            `Recipient: ${currentFeedback.buyerEmail ?? "Buyer email"}.`,
            `Order reference: ${reference}.`,
            "No new tickets were generated.",
          ].join(" "),
        });

        return;
      }


      // -----------------------------------------------------
      // FAILED EMAIL DELIVERY
      // -----------------------------------------------------

      if (delivery.status === "failed") {
        setFeedback({
          ...currentFeedback,

          type: "warning",

          title: "Email delivery failed again",

          message: [
            typeof delivery.message === "string"
              ? delivery.message
              : "The ticket email could not be delivered.",
            `The existing tickets remain issued for order ${reference}.`,
            "You can try resending again.",
          ].join(" "),

          canResend: true,
        });

        return;
      }


      throw new Error(
        "The email delivery status could not be confirmed.",
      );

    } catch (caught) {
      setErr(
        caught instanceof Error
          ? caught.message
          : "Unable to resend ticket email.",
      );

    } finally {
      setResendingOrder("");
    }
  }


  // =========================================================
  // REVIEW PAYMENT
  // =========================================================

  async function review(
    payment: Payment,
    decision: PaymentDecision,
  ) {
    const note = (notes[payment.id] ?? "").trim();

    const actualAmount =
      amounts[payment.id] ?? "";

    const actualBankReference = (
      bankRefs[payment.id] ?? ""
    ).trim();


    if (!payment.order) {
      setErr(
        "The associated order could not be verified. This payment cannot be reviewed.",
      );

      return;
    }


    // -------------------------------------------------------
    // APPROVAL VALIDATION
    // -------------------------------------------------------

    if (decision === "approve") {
      const amountNaira = Number(actualAmount);

      const amountKobo = amountNaira * 100;

      if (
        !confirmed[payment.id] ||
        !actualAmount ||
        !Number.isSafeInteger(amountNaira) ||
        !Number.isSafeInteger(amountKobo) ||
        amountNaira <= 0 ||
        !actualBankReference ||
        actualBankReference.length > 120
      ) {
        setErr(
          "Confirm the actual bank credit and enter a valid amount and transaction reference.",
        );

        return;
      }


      if (
        amountKobo !== payment.order.totalAmountKobo
      ) {
        setErr(
          "The verified amount does not match the order total. Check the bank credit before approving.",
        );

        return;
      }
    }


    // -------------------------------------------------------
    // REJECTION VALIDATION
    // -------------------------------------------------------

    if (
      decision === "reject" &&
      note.length < 3
    ) {
      setErr(
        "Enter a rejection reason in the administrator note.",
      );

      return;
    }


    // -------------------------------------------------------
    // CONFIRMATION
    // -------------------------------------------------------

    const confirmationMessage =
      decision === "approve"
        ? [
            "Confirm that this exact amount has arrived",
            "in the official event bank account?",
            "",
            `Order: ${payment.order.orderReference}`,
            `Buyer: ${payment.order.buyerName}`,
            `Amount: ${money(payment.order.totalAmountKobo)}`,
            `Bank reference: ${actualBankReference}`,
            "",
            "Approving will generate one unique textual code per admission.",
            "The ticket codes will be emailed to the buyer.",
            "",
            "Continue?",
          ].join("\n")
        : [
            "Reject this payment and cancel the order?",
            "",
            `Order: ${payment.order.orderReference}`,
            `Reason: ${note}`,
          ].join("\n");


    if (!window.confirm(confirmationMessage)) {
      return;
    }


    setBusy(payment.id);
    setErr("");
    setFeedback(null);


    // -------------------------------------------------------
    // SEND REVIEW REQUEST
    // -------------------------------------------------------

    try {
      const response = await fetch(
        `/api/admin/payments/${payment.id}/review`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            decision,
            note,

            verifiedAmountNaira:
              decision === "approve"
                ? Number(actualAmount)
                : undefined,

            bankTransactionReference:
              decision === "approve"
                ? actualBankReference
                : undefined,
          }),
        },
      );


      const result: unknown = await response.json();


      if (!response.ok) {
        const message =
          isRecord(result) &&
          typeof result.error === "string"
            ? result.error
            : "Payment review failed.";

        throw new Error(message);
      }


      // -----------------------------------------------------
      // VALIDATE REVIEW RESPONSE
      // -----------------------------------------------------

      if (
        !isRecord(result) ||
        result.success !== true ||
        !isRecord(result.result) ||
        result.result.decision !== decision ||
        typeof result.result.orderReference !== "string" ||
        !Number.isSafeInteger(result.ticketsIssued)
      ) {
        throw new Error(
          "The server response could not confirm the review. Refresh the payment queue before attempting another action.",
        );
      }


      const ticketsIssued =
        result.ticketsIssued as number;

      const orderReference =
        result.result.orderReference;

      const emailDelivery: EmailDelivery | null =
        isEmailDelivery(result.emailDelivery)
          ? result.emailDelivery
          : null;


      // -----------------------------------------------------
      // CLEAR FORM
      // -----------------------------------------------------

      clearPaymentForm(payment.id);


      // -----------------------------------------------------
      // SET REVIEW FEEDBACK
      // -----------------------------------------------------

      if (decision === "approve") {
        if (emailDelivery?.status === "sent") {
          setFeedback({
            type: "success",

            title: "Payment approved and tickets emailed",

            message: [
              `${ticketsIssued} unique ticket code(s) were issued.`,
              `Email sent successfully to ${payment.order.buyerEmail}.`,
              `Order reference: ${orderReference}.`,
            ].join(" "),
          });

        } else if (emailDelivery?.status === "failed") {
          setFeedback({
            type: "warning",

            title: "Payment approved, but email delivery failed",

            message: [
              `${ticketsIssued} unique ticket code(s) were issued and saved.`,
              `Email delivery to ${payment.order.buyerEmail} failed.`,
              "The payment and tickets remain confirmed. Do not approve this payment again.",
              "You can resend the same tickets below.",
            ].join(" "),

            orderReference,
            buyerEmail: payment.order.buyerEmail,
            canResend: true,
          });

        } else {
          setFeedback({
            type: "warning",

            title: "Payment approved; email status unavailable",

            message: [
              `${ticketsIssued} unique ticket code(s) were issued and saved.`,
              `The intended recipient is ${payment.order.buyerEmail}.`,
              "The email status could not be confirmed.",
              "You can resend the existing tickets below.",
            ].join(" "),

            orderReference,
            buyerEmail: payment.order.buyerEmail,
            canResend: true,
          });
        }

      } else {
        setFeedback({
          type: "success",

          title: "Payment rejected",

          message: [
            "The payment submission was rejected and the order was cancelled.",
            `Order reference: ${orderReference}.`,
          ].join(" "),
        });
      }


      // -----------------------------------------------------
      // REFRESH QUEUE
      // -----------------------------------------------------

      await load();

    } catch (caught) {
      setErr(
        caught instanceof Error
          ? caught.message
          : "Unable to review payment.",
      );

    } finally {
      setBusy("");
    }
  }


  // =========================================================
  // LOADING STATE
  // =========================================================

  if (loading) {
    return (
      <div className="admin-page">
        <p className="muted">
          Loading payment queue…
        </p>
      </div>
    );
  }


  // =========================================================
  // PAYMENT QUEUE
  // =========================================================

  return (
    <div className="admin-page">

      {/* PAGE HEADING */}

      <div className="admin-title">
        <Badge variant="gold">
          FINANCE MANAGEMENT
        </Badge>

        <h1>Payment verification</h1>

        <p>
          Compare each submission with the actual
          bank credit before approval.
        </p>
      </div>


      {/* REVIEW FEEDBACK */}

      {feedback && (
        <div
          className={
            feedback.type === "success"
              ? "success-box"
              : "warning-box"
          }
          role="status"
          aria-live="polite"
        >
          <div className="feedback-heading">
            {feedback.type === "success" ? (
              <CheckCircle2 size={19} />
            ) : (
              <AlertTriangle size={19} />
            )}

            <strong>{feedback.title}</strong>
          </div>

          <p>{feedback.message}</p>


          {/* RESEND TICKET EMAIL */}

          {feedback.canResend &&
            feedback.orderReference && (
              <div>
                <Button
                  variant="outline"
                  disabled={
                    resendingOrder === feedback.orderReference ||
                    Boolean(busy)
                  }
                  onClick={() =>
                    void resendTicketEmail()
                  }
                >
                  <Mail size={15} />

                  {resendingOrder === feedback.orderReference
                    ? "Sending email…"
                    : "Resend ticket email"}
                </Button>
              </div>
            )}
        </div>
      )}


      {/* ERROR MESSAGE */}

      {err && (
        <div
          className="error-box"
          role="alert"
        >
          {err}
        </div>
      )}


      {/* TOOLBAR */}

      <div className="admin-toolbar">
        <div>
          <strong>
            {data.length} submissions awaiting review
          </strong>

          <p className="muted">
            Oldest submissions appear first.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={
            Boolean(busy) ||
            Boolean(resendingOrder)
          }
        >
          <RefreshCw size={15} />
          Refresh
        </Button>
      </div>


      {/* EMPTY STATE */}

      {data.length === 0 ? (
        <Card>
          <CheckCircle2 size={28} />

          <h2>No pending payments</h2>

          <p className="muted">
            New customer submissions will appear here.
          </p>
        </Card>
      ) : (

        /* PAYMENT CARDS */

        <div className="payment-review">

          {data.map((payment) => {
            const order = payment.order;

            const isBusy =
              busy === payment.id;

            const amountNaira =
              amounts[payment.id] ?? "";

            const bankReference =
              bankRefs[payment.id] ?? "";

            const note =
              notes[payment.id] ?? "";

            const amountMatches =
              order !== null &&
              amountNaira !== "" &&
              Number.isSafeInteger(Number(amountNaira)) &&
              Number(amountNaira) * 100 ===
                order.totalAmountKobo;

            return (
              <Card key={payment.id}>

                {/* PAYMENT HEADER */}

                <div className="payment-card-head">
                  <div>
                    <Badge variant="warning">
                      {payment.status.replaceAll("_", " ")}
                    </Badge>

                    <h2>
                      {payment.reference}
                    </h2>

                    <p className="muted">
                      Order:{" "}

                      {order?.orderReference ??
                        "Order unavailable"}
                    </p>
                  </div>

                  <span className="muted">
                    <Clock3 size={13} />

                    {" "}{formatDate(payment.submittedAt)}
                  </span>
                </div>


                {/* ORDER UNAVAILABLE */}

                {!order && (
                  <div className="error-box">
                    <AlertTriangle size={16} />

                    The associated order could not be
                    verified. Do not approve this payment.
                  </div>
                )}


                {/* PAYMENT INFORMATION */}

                <div className="payment-grid">

                  <div>
                    <span>BUYER</span>

                    <strong>
                      {order?.buyerName ?? "Unavailable"}
                    </strong>

                    <small>
                      {order?.buyerEmail ?? ""}
                    </small>

                    <small>
                      {order?.buyerPhone ?? ""}
                    </small>
                  </div>


                  <div>
                    <span>SENDER</span>

                    <strong>
                      {payment.senderName}
                    </strong>

                    <small>
                      {payment.senderBank ??
                        "Bank not supplied"}
                    </small>
                  </div>


                  <div>
                    <span>ORDER</span>

                    <strong>
                      {order?.ticketTypeId ?? "Unavailable"}
                    </strong>

                    <small>
                      {order
                        ? `${order.admissionsCount} individual admissions`
                        : "Admission information unavailable"}
                    </small>

                    {order && (
                      <small>
                        Quantity: {order.quantity}
                      </small>
                    )}
                  </div>


                  <div>
                    <span>CLAIMED AMOUNT</span>

                    <strong className="amount">
                      {money(payment.amountKobo)}
                    </strong>

                    <small>
                      {payment.transferReference}
                    </small>
                  </div>

                </div>


                {/* EXPECTED ORDER TOTAL */}

                {order && (
                  <div className="summary-row">
                    <span>
                      Expected order total
                    </span>

                    <strong>
                      {money(order.totalAmountKobo)}
                    </strong>
                  </div>
                )}


                {/* RECEIPT */}

                <div className="receipt-link">
                  <FileText size={16} />

                  <span>Receipt</span>

                  {payment.receiptUrl ? (
                    <a
                      href={payment.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open private receipt

                      <ExternalLink size={13} />
                    </a>
                  ) : (
                    <span>
                      Unavailable
                    </span>
                  )}
                </div>

                <p className="muted">
                  Receipt links expire after five minutes.
                  Refresh the queue to generate a new link.
                </p>


                {/* BANK VERIFICATION */}

                <div className="review-panel">

                  <h3>
                    Bank verification
                  </h3>

                  <p className="muted">
                    Compare the transaction against
                    the actual credit in the organiser's
                    bank account.
                  </p>


                  {/* VERIFICATION INPUTS */}

                  <div className="review-fields">

                    <label>
                      Actual amount received (₦)

                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={amountNaira}
                        disabled={isBusy || !order}
                        onChange={(event) =>
                          updateAmount(
                            payment.id,
                            event.target.value,
                          )
                        }
                        placeholder="Enter credited amount"
                      />

                      {order &&
                        amountNaira !== "" &&
                        !amountMatches && (
                          <small className="error-text">
                            Amount does not match the
                            expected order total.
                          </small>
                        )}
                    </label>


                    <label>
                      Actual bank transaction reference

                      <input
                        value={bankReference}
                        maxLength={120}
                        disabled={isBusy || !order}
                        onChange={(event) =>
                          updateBankReference(
                            payment.id,
                            event.target.value,
                          )
                        }
                        placeholder="Enter bank reference"
                      />
                    </label>

                  </div>


                  {/* ADMINISTRATOR NOTE */}

                  <label className="note-field">
                    Administrator note

                    <textarea
                      rows={2}
                      maxLength={500}
                      value={note}
                      disabled={isBusy}
                      onChange={(event) =>
                        updateNote(
                          payment.id,
                          event.target.value,
                        )
                      }
                      placeholder="Required when rejecting; optional when approving."
                    />
                  </label>


                  {/* MANUAL BANK CONFIRMATION */}

                  <label className="confirm-check">
                    <input
                      type="checkbox"
                      checked={
                        confirmed[payment.id] ?? false
                      }
                      disabled={isBusy || !order}
                      onChange={(event) =>
                        updateConfirmation(
                          payment.id,
                          event.target.checked,
                        )
                      }
                    />

                    I personally verified the credit
                    in the organiser's bank account.
                  </label>


                  {/* REVIEW ACTIONS */}

                  <div className="review-actions">

                    <Button
                      variant="outline"
                      disabled={isBusy}
                      onClick={() =>
                        void review(payment, "reject")
                      }
                    >
                      <XCircle size={15} />

                      {isBusy
                        ? "Processing…"
                        : "Reject"}
                    </Button>


                    <Button
                      disabled={
                        isBusy ||
                        !order ||
                        !confirmed[payment.id] ||
                        !amountMatches ||
                        !bankReference.trim()
                      }
                      onClick={() =>
                        void review(payment, "approve")
                      }
                    >
                      <CheckCircle2 size={15} />

                      {isBusy
                        ? "Processing…"
                        : "Verify & approve"}
                    </Button>

                  </div>

                </div>

              </Card>
            );
          })}

        </div>
      )}

    </div>
  );
}
