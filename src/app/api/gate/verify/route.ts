
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireAdminRole,
} from "@/lib/auth/admin";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  verifyQrCredential,
} from "@/lib/tickets/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

const TICKET_CODE_PATTERN =
  /^AWN-2026-[A-F0-9]{16}$/;


// ============================================================
// REQUEST VALIDATION
// ============================================================

const schema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("qr"),

    credential: z.string()
      .trim()
      .min(1)
      .max(256),
  }).strict(),

  z.object({
    method: z.literal("manual"),

    ticketCode: z.string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(
        z.string().regex(TICKET_CODE_PATTERN),
      ),
  }).strict(),
]);


// ============================================================
// ALLOWED DATABASE STATUSES
// ============================================================

const statusSchema = z.enum([
  "valid",
  "invalid_ticket",
  "invalid_qr",
  "already_used",
  "payment_not_confirmed",
  "cancelled",
]);

type GateStatus = z.infer<typeof statusSchema>;


// ============================================================
// RESULT MESSAGES
// ============================================================

const messages: Record<GateStatus, string> = {
  valid:
    "Ticket verified. Entry authorised.",

  invalid_ticket:
    "This ticket ID does not exist.",

  invalid_qr:
    "QR credential is invalid or has been altered.",

  already_used:
    "This ticket has already been used.",

  payment_not_confirmed:
    "Payment is not confirmed. Entry denied.",

  cancelled:
    "This ticket has been cancelled.",
};


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
  const originHeader =
    request.headers.get("origin");

  if (!originHeader) {
    return false;
  }

  try {
    const requestOrigin =
      new URL(originHeader).origin;

    const targetOrigin =
      new URL(request.url).origin;

    return requestOrigin === targetOrigin;

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
// MAIN GATE VERIFICATION ROUTE
// ============================================================

export async function POST(request: Request) {
  try {

    // ========================================================
    // 1. ADMIN AUTHENTICATION
    // ========================================================

    const {
      admin,
      response,
    } = await requireAdminRole([
      "owner",
      "ticket_manager",
      "gate_staff",
    ]);

    if (response) {
      return response;
    }

    if (!admin) {
      return jsonError(
        "Not authorised for gate operations.",
        403,
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
    // 3. REQUEST BODY VALIDATION
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
          error: "Invalid verification details.",

          details:
            parsed.error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: RESPONSE_HEADERS,
        },
      );
    }


    // ========================================================
    // 4. EXTRACT TICKET CREDENTIALS
    // ========================================================

    let ticketCode: string;

    let nonce: string | null = null;

    const verificationMethod =
      parsed.data.method;


    // --------------------------------------------------------
    // QR VERIFICATION
    // --------------------------------------------------------

    if (verificationMethod === "qr") {

      // Verify the signed QR credential before
      // making a database request.

      const verified = verifyQrCredential(
        parsed.data.credential,
      );

      if (!verified) {
        return NextResponse.json(
          {
            success: false,

            result: {
              status: "invalid_qr",

              message: messages.invalid_qr,
            },
          },
          {
            status: 200,
            headers: RESPONSE_HEADERS,
          },
        );
      }

      ticketCode = verified.ticketCode;

      nonce = verified.nonce;


      // Validate the recovered ticket code.

      if (
        typeof ticketCode !== "string" ||
        !TICKET_CODE_PATTERN.test(ticketCode) ||
        typeof nonce !== "string" ||
        !/^[a-f0-9]{32}$/i.test(nonce)
      ) {
        return NextResponse.json(
          {
            success: false,

            result: {
              status: "invalid_qr",

              message: messages.invalid_qr,
            },
          },
          {
            status: 200,
            headers: RESPONSE_HEADERS,
          },
        );
      }


    // --------------------------------------------------------
    // MANUAL TEXTUAL CODE VERIFICATION
    // --------------------------------------------------------

    } else {

      // Manual codes are independent of QR credentials.
      // Their format is validated by the request schema.

      ticketCode = parsed.data.ticketCode;

      // PostgreSQL expects NULL for manual verification.
      nonce = null;
    }


    // ========================================================
    // 5. DATABASE CHECK-IN
    // ========================================================

    const db = createSupabaseAdminClient();

    const {
      data,
      error,
    } = await db.rpc(
      "check_in_ticket",
      {
        p_ticket_code: ticketCode,

        p_qr_nonce: nonce,

        p_admin_user_id: admin.id,

        p_verification_method: verificationMethod,
      },
    );


    // ========================================================
    // 6. DATABASE ERROR HANDLING
    // ========================================================

    if (error) {

      if (
        error.message.includes("ADMIN_NOT_AUTHORIZED") ||
        error.message.includes("GATE_PERMISSION_DENIED")
      ) {
        return jsonError(
          "Not authorised for gate operations.",
          403,
        );
      }

      if (
        error.message.includes("INVALID_VERIFICATION_METHOD")
      ) {
        return jsonError(
          "Invalid ticket verification method.",
          400,
        );
      }

      console.error(
        "Gate check-in RPC failed:",
        error.code,
      );

      return jsonError(
        "Ticket verification is temporarily unavailable.",
        500,
      );
    }


    // ========================================================
    // 7. VALIDATE DATABASE RESPONSE
    // ========================================================

    if (
      !isRecord(data) ||
      typeof data.status !== "string"
    ) {
      console.error(
        "Gate check-in returned an invalid response.",
      );

      return jsonError(
        "Ticket verification could not be completed.",
        500,
      );
    }

    const parsedStatus = statusSchema.safeParse(
      data.status,
    );

    if (!parsedStatus.success) {
      console.error(
        "Gate check-in returned an unknown status.",
      );

      return jsonError(
        "Ticket verification returned an unexpected result.",
        500,
      );
    }

    const status: GateStatus =
      parsedStatus.data;


    // ========================================================
    // 8. BUILD SAFE RESPONSE
    // ========================================================

    const result: {
      status: GateStatus;
      message: string;

      ticketCode?: string;
      attendeeName?: string;
      ticketType?: string;
      orderReference?: string;

      verificationMethod?: "qr" | "manual";

      checkedInAt?: string;
    } = {
      status,

      message: messages[status],
    };


    // --------------------------------------------------------
    // OPTIONAL TICKET INFORMATION
    // --------------------------------------------------------

    if (data.ticketCode !== undefined) {
      if (
        typeof data.ticketCode !== "string" ||
        !TICKET_CODE_PATTERN.test(data.ticketCode)
      ) {
        return jsonError(
          "The database returned an invalid ticket code.",
          500,
        );
      }

      result.ticketCode = data.ticketCode;
    }


    if (data.attendeeName !== undefined) {
      if (typeof data.attendeeName !== "string") {
        return jsonError(
          "The database returned invalid attendee information.",
          500,
        );
      }

      result.attendeeName = data.attendeeName;
    }


    if (data.ticketType !== undefined) {
      if (typeof data.ticketType !== "string") {
        return jsonError(
          "The database returned invalid ticket information.",
          500,
        );
      }

      result.ticketType = data.ticketType;
    }


    if (data.orderReference !== undefined) {
      if (
        typeof data.orderReference !== "string" ||
        !/^AWN-2026-[A-F0-9]{16}$/.test(
          data.orderReference,
        )
      ) {
        return jsonError(
          "The database returned an invalid order reference.",
          500,
        );
      }

      result.orderReference = data.orderReference;
    }


    if (data.verificationMethod !== undefined) {
      if (
        data.verificationMethod !== "qr" &&
        data.verificationMethod !== "manual"
      ) {
        return jsonError(
          "The database returned an invalid verification method.",
          500,
        );
      }

      result.verificationMethod =
        data.verificationMethod;
    }


    if (data.checkedInAt !== undefined) {
      if (
        typeof data.checkedInAt !== "string" ||
        !Number.isFinite(
          new Date(data.checkedInAt).getTime(),
        )
      ) {
        return jsonError(
          "The database returned an invalid check-in time.",
          500,
        );
      }

      result.checkedInAt = data.checkedInAt;
    }


    // ========================================================
    // 9. RETURN VERIFICATION RESULT
    // ========================================================

    return NextResponse.json(
      {
        success: status === "valid",

        result,
      },
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      },
    );

  } catch (caught) {

    console.error(
      "Unexpected gate verification error:",
      caught instanceof Error
        ? caught.message
        : "Unknown error",
    );

    return jsonError(
      "Ticket verification is temporarily unavailable.",
      500,
    );
  }
}
