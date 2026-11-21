
import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

function errorResponse(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      error: {
        message,
      },
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    },
  );
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      reference: string;
    }>;
  },
) {
  const { reference } = await params;

  const token = (
    request.headers.get("x-checkout-token") ?? ""
  ).trim();

  // Validate the order reference and checkout token.
  if (
    !/^AWN-2026-[A-F0-9]{16}$/.test(reference) ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return errorResponse(
      "Invalid checkout session.",
      401,
    );
  }

  try {
    // Hash the private checkout token.
    // The raw token is never stored in the database.
    const checkoutHash = createHash("sha256")
      .update(token, "utf8")
      .digest("hex");

    const db = createSupabaseAdminClient();

    // Retrieve only the information needed by the
    // customer payment page.
    const {
      data: order,
      error,
    } = await db
      .from("orders")
      .select(
        [
          "order_reference",
          "ticket_type_id",
          "quantity",
          "admissions_count",
          "total_amount_kobo",
          "status",
          "reservation_expires_at",
        ].join(","),
      )
      .eq("order_reference", reference)
      .eq("checkout_token_hash", checkoutHash)
      .maybeSingle();

    if (error) {
      console.error(
        "Order retrieval failed:",
        error.code,
      );

      return errorResponse(
        "Unable to retrieve order.",
        500,
      );
    }

    if (!order) {
      return errorResponse(
        "Order not found.",
        404,
      );
    }

    // Return the existing response structure expected
    // by PaymentPageClient.
    return NextResponse.json(
      {
        success: true,
        order,
      },
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      },
    );

  } catch (caught) {
    console.error(
      "Unexpected order retrieval failure:",
      caught instanceof Error
        ? caught.message
        : "Unknown error",
    );

    return errorResponse(
      "Unable to retrieve order.",
      500,
    );
  }
}
