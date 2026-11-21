
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  requireAdminRole,
} from "@/lib/auth/admin";

import {
  sendTicketEmail,
  type IssuedTicket,
  type EmailDeliveryResult,
} from "@/lib/email/ticket-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

const PAYMENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ORDER_REFERENCE_PATTERN =
  /^AWN-2026-[A-F0-9]{16}$/;

const TICKET_CODE_PATTERN =
  /^AWN-2026-[A-F0-9]{16}$/;


// ============================================================
// REQUEST VALIDATION
// ============================================================

const schema = z.object({
  decision: z.enum(["approve", "reject"]),

  note: z.string().trim().max(500),

  verifiedAmountNaira: z.number()
    .positive()
    .finite()
    .optional(),

  bankTransactionReference: z.string()
    .trim()
    .max(120)
    .optional(),

}).superRefine((value, ctx) => {
  if (value.decision === "approve") {
    const amount = value.verifiedAmountNaira;
    const amountKobo = (amount ?? 0) * 100;

    if (
      amount === undefined ||
      !Number.isSafeInteger(amount) ||
      !Number.isSafeInteger(amountKobo)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["verifiedAmountNaira"],
        message: "Enter a valid whole-Naira verified amount.",
      });
    }

    const reference =
      value.bankTransactionReference?.trim();

    if (
      !reference ||
      reference.length < 2 ||
      reference.length > 120
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["bankTransactionReference"],
        message: "Enter the actual bank transaction reference.",
      });
    }
  }

  if (
    value.decision === "reject" &&
    value.note.length < 3
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["note"],
      message: "A rejection reason is required.",
    });
  }
});


// ============================================================
// RESPONSE HELPERS
// ============================================================

function jsonError(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    },
  );
}


function isSameOrigin(request: Request): boolean {
  const originHeader = request.headers.get("origin");

  if (!originHeader) {
    return false;
  }

  try {
    return (
      new URL(originHeader).origin ===
      new URL(request.url).origin
    );
  } catch {
    return false;
  }
}


function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}


// ============================================================
// TICKET VALIDATION
// ============================================================

function isIssuedTicket(
  value: unknown,
): value is IssuedTicket {
  return (
    isRecord(value) &&

    typeof value.ticketCode === "string" &&
    TICKET_CODE_PATTERN.test(value.ticketCode) &&

    typeof value.attendeeName === "string" &&
    value.attendeeName.trim().length >= 2 &&

    typeof value.ticketType === "string" &&
    value.ticketType.trim().length > 0
  );
}


// ============================================================
// DATABASE ERROR MAPPING
// ============================================================

type ReviewError = {
  status: number;
  message: string;
};

function mapReviewError(
  message: string,
): ReviewError | null {
  const errors: Record<string, ReviewError> = {
    ADMIN_NOT_AUTHORIZED: {
      status: 403,
      message: "Administrator authentication is invalid.",
    },

    PAYMENT_PERMISSION_DENIED: {
      status: 403,
      message: "Not authorised to approve payments.",
    },

    INVALID_REVIEW_DECISION: {
      status: 400,
      message: "Invalid payment review decision.",
    },

    PAYMENT_NOT_FOUND: {
      status: 404,
      message: "Payment not found.",
    },

    ORDER_NOT_FOUND: {
      status: 404,
      message: "Associated order not found.",
    },

    EVENT_NOT_FOUND: {
      status: 409,
      message: "The event configuration could not be found.",
    },

    PAYMENT_ALREADY_REVIEWED: {
      status: 409,
      message: "This payment has already been reviewed.",
    },

    ORDER_NOT_AWAITING_REVIEW: {
      status: 409,
      message: "This order is not awaiting payment review.",
    },

    SUBMITTED_AMOUNT_MISMATCH: {
      status: 409,
      message: "Submitted payment amount does not match the order.",
    },

    RESERVATION_EXPIRED: {
      status: 409,
      message: "This reservation has expired.",
    },

    BANK_AMOUNT_MISMATCH: {
      status: 400,
      message: "The verified bank amount does not match the order.",
    },

    BANK_REFERENCE_REQUIRED: {
      status: 400,
      message: "An actual bank transaction reference is required.",
    },

    REJECTION_REASON_REQUIRED: {
      status: 400,
      message: "A rejection reason is required.",
    },

    ATTENDEE_COUNT_MISMATCH: {
      status: 409,
      message: "The attendee records do not match the order.",
    },

    TICKETS_ALREADY_ISSUED: {
      status: 409,
      message: "Tickets have already been issued for this order.",
    },

    TICKET_TYPE_NOT_FOUND: {
      status: 409,
      message: "The ticket category could not be found.",
    },

    TICKET_ORDER_NOT_FOUND: {
      status: 409,
      message: "The ticket order could not be found.",
    },

    TICKET_PAYMENT_NOT_CONFIRMED: {
      status: 409,
      message: "Ticket issuance requires confirmed payment.",
    },

    TICKET_ORDER_DETAILS_MISMATCH: {
      status: 409,
      message: "Ticket details do not match the order.",
    },

    TICKET_ATTENDEE_MISMATCH: {
      status: 409,
      message: "The ticket attendee does not match the order.",
    },

    TICKET_ISSUANCE_COUNT_MISMATCH: {
      status: 409,
      message: "The issued ticket count does not match the order.",
    },
  };

  const match = Object.entries(errors).find(
    ([code]) => message.includes(code),
  );

  return match?.[1] ?? null;
}


// ============================================================
// MAIN PAYMENT REVIEW ROUTE
// ============================================================

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    // ========================================================
    // 1. ADMIN AUTHENTICATION
    // ========================================================

    const {
      admin,
      response,
    } = await requireAdminRole([
      "owner",
      "finance",
    ]);

    if (response) {
      return response;
    }

    if (!admin) {
      return jsonError(
        "Administrator authentication required.",
        401,
      );
    }


    // ========================================================
    // 2. ORIGIN VALIDATION
    // ========================================================

    if (!isSameOrigin(request)) {
      return jsonError(
        "Invalid request origin.",
        403,
      );
    }


    // ========================================================
    // 3. PAYMENT ID VALIDATION
    // ========================================================

    const { id } = await params;

    if (!PAYMENT_ID_PATTERN.test(id)) {
      return jsonError(
        "Invalid payment ID.",
        400,
      );
    }


    // ========================================================
    // 4. REQUEST BODY VALIDATION
    // ========================================================

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError(
        "Invalid JSON request.",
        400,
      );
    }

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payment review details.",

          details:
            parsed.error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: RESPONSE_HEADERS,
        },
      );
    }

    const input = parsed.data;


    // ========================================================
    // 5. PREPARE DATABASE ARGUMENTS
    // ========================================================

    const verifiedAmountKobo =
      input.decision === "approve"
        ? (input.verifiedAmountNaira ?? 0) * 100
        : null;

    const bankReference =
      input.decision === "approve"
        ? input.bankTransactionReference ?? null
        : null;


    // ========================================================
    // 6. EXECUTE ATOMIC PAYMENT REVIEW
    // ========================================================
    //
    // PostgreSQL:
    // - verifies the admin permission;
    // - verifies the payment;
    // - confirms the bank payment;
    // - marks the order as paid;
    // - generates one ticket per attendee;
    // - saves the unique ticket codes;
    // - records the audit log.
    //
    // If ticket generation fails, the transaction rolls back.
    //
    // Email sending happens only after this RPC succeeds.

    const db = createSupabaseAdminClient();

    const {
      data,
      error,
    } = await db.rpc(
      "admin_review_payment",
      {
        p_payment_id: id,

        p_admin_user_id: admin.id,

        p_decision: input.decision,

        p_admin_note: input.note,

        p_verified_amount_kobo:
          verifiedAmountKobo,

        p_bank_transaction_reference:
          bankReference,
      },
    );


    // ========================================================
    // 7. HANDLE DATABASE ERRORS
    // ========================================================

    if (error) {
      if (error.code === "23505") {
        return jsonError(
          "This payment reference has already been used or conflicts with an existing record.",
          409,
        );
      }

      const mapped = mapReviewError(
        error.message,
      );

      if (mapped) {
        return jsonError(
          mapped.message,
          mapped.status,
        );
      }

      console.error(
        "Admin payment review RPC failed:",
        error.code,
      );

      return jsonError(
        "Payment review could not be completed.",
        500,
      );
    }


    // ========================================================
    // 8. VALIDATE DATABASE RESPONSE
    // ========================================================

    const expectedOrderStatus =
      input.decision === "approve"
        ? "paid"
        : "cancelled";

    if (
      !isRecord(data) ||
      data.success !== true ||
      data.decision !== input.decision ||
      data.order_status !== expectedOrderStatus ||
      typeof data.order_reference !== "string" ||
      !ORDER_REFERENCE_PATTERN.test(
        data.order_reference,
      ) ||
      !Array.isArray(data.tickets)
    ) {
      console.error(
        "Invalid admin payment review response.",
      );

      return jsonError(
        "The review response could not be confirmed. Check the payment record before attempting another action.",
        500,
      );
    }


    // ========================================================
    // 9. VALIDATE TICKET ISSUANCE
    // ========================================================

    const validTickets =
      data.tickets.every(isIssuedTicket);

    const ticketCodes = data.tickets.map(
      (ticket: IssuedTicket) => ticket.ticketCode,
    );

    const uniqueTicketCodes =
      new Set(ticketCodes).size === ticketCodes.length;

    const ticketCountMatches =
      data.ticket_count === undefined ||
      data.ticket_count === data.tickets.length;

    if (
      !validTickets ||
      !uniqueTicketCodes ||
      !ticketCountMatches ||
      (
        input.decision === "approve" &&
        data.tickets.length === 0
      ) ||
      (
        input.decision === "reject" &&
        data.tickets.length !== 0
      )
    ) {
      console.error(
        "Payment review returned an unexpected ticket result.",
      );

      return jsonError(
        "The payment review may have completed, but its ticket details could not be confirmed. Check the order before taking further action.",
        500,
      );
    }


    // ========================================================
    // 10. SEND TICKET EMAIL
    // ========================================================
    //
    // This happens AFTER payment approval and ticket creation.
    //
    // If Resend is unavailable:
    // - Payment remains approved.
    // - Ticket codes remain saved.
    // - Admin can use the resend endpoint.
    //
    // Never approve the same payment again just because
    // email delivery failed.

    let emailDelivery: EmailDeliveryResult | null = null;

    if (input.decision === "approve") {
      const emailAddress =
        typeof data.buyer_email === "string"
          ? data.buyer_email.trim()
          : "";

      const buyerName =
        typeof data.buyer_name === "string"
          ? data.buyer_name.trim()
          : "";

      const eventName =
        typeof data.event_name === "string"
          ? data.event_name.trim()
          : "";

      const eventStartAt =
        typeof data.event_start_at === "string"
          ? data.event_start_at
          : "";

      const venue =
        typeof data.venue === "string"
          ? data.venue.trim()
          : "";

      const emailAddressValid =
        z.string().email().safeParse(
          emailAddress,
        ).success;

      const eventDateValid =
        eventStartAt.length > 0 &&
        !Number.isNaN(
          new Date(eventStartAt).getTime(),
        );

      const ticketsHaveEmailDetails =
        data.tickets.every(isIssuedTicket);

      if (
        !emailAddressValid ||
        !buyerName ||
        !eventName ||
        !eventDateValid ||
        !venue ||
        !ticketsHaveEmailDetails
      ) {
        console.error(
          "Ticket email could not be prepared because the database response is incomplete.",
        );

        emailDelivery = {
          status: "failed",
          message:
            "Payment was confirmed and tickets were issued, but the email details were incomplete.",
        };

      } else {
        emailDelivery = await sendTicketEmail({
          buyerName,

          buyerEmail: emailAddress,

          orderReference: data.order_reference,

          eventName,

          eventStartAt,

          venue,

          tickets: data.tickets,
        });
      }
    }


    // ========================================================
    // 11. RETURN REVIEW RESULT
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        result: {
          orderReference:
            data.order_reference,

          decision:
            data.decision,

          orderStatus:
            data.order_status,
        },

        ticketsIssued:
          data.tickets.length,

        emailDelivery,
      },
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      },
    );

  } catch (caught) {
    console.error(
      "Unexpected payment review failure:",
      caught instanceof Error
        ? caught.message
        : "Unknown error",
    );

    return jsonError(
      "Unexpected payment review error.",
      500,
    );
  }
}
