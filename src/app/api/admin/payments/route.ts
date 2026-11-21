
import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  requireAdminRole,
} from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "payment-receipts";
const SIGNED_URL_EXPIRY = 300;

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

type OrderSummary = {
  id: string;
  order_reference: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  ticket_type_id: string;
  quantity: number;
  admissions_count: number;
  total_amount_kobo: number;
  status: string;
};

function isOrderSummary(
  value: unknown,
): value is OrderSummary {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const order = value as Record<string, unknown>;

  return (
    typeof order.id === "string" &&
    typeof order.order_reference === "string" &&
    typeof order.buyer_name === "string" &&
    typeof order.buyer_email === "string" &&
    typeof order.buyer_phone === "string" &&
    typeof order.ticket_type_id === "string" &&
    Number.isSafeInteger(Number(order.quantity)) &&
    Number.isSafeInteger(Number(order.admissions_count)) &&
    Number.isSafeInteger(Number(order.total_amount_kobo)) &&
    typeof order.status === "string"
  );
}

function isReceiptPathValid(
  path: string,
  orderId: string,
): boolean {
  const prefix = `${orderId}/`;

  if (!path.startsWith(prefix)) {
    return false;
  }

  const filename = path.slice(prefix.length);

  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|pdf)$/i.test(
    filename,
  );
}

function errorResponse(
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

export async function GET() {
  try {
    // =======================================================
    // 1. ADMIN AUTHENTICATION
    // =======================================================

    const {
      admin,
      response,
    } = await requireAdminRole([
      "owner",
      "finance",
    ]);

    if (response) return response;

    if (!admin) {
      return errorResponse(
        "Administrator authentication required.",
        401,
      );
    }


    // =======================================================
    // 2. DATABASE CLIENT
    // =======================================================

    const db = createSupabaseAdminClient();


    // =======================================================
    // 3. LOAD PAYMENT QUEUE
    // =======================================================

    const {
      data,
      error,
    } = await db
      .from("payment_submissions")
      .select(`
        id,
        order_id,
        payment_reference,
        sender_name,
        sender_bank,
        transfer_reference,
        amount_kobo,
        receipt_path,
        status,
        created_at,
        orders!payment_submissions_order_id_fkey (
          id,
          order_reference,
          buyer_name,
          buyer_email,
          buyer_phone,
          ticket_type_id,
          quantity,
          admissions_count,
          total_amount_kobo,
          status
        )
      `)
      .in("status", [
        "submitted",
        "under_review",
      ])
      .order("created_at", {
        ascending: true,
      })
      .limit(100);

    if (error) {
      console.error(
        "Payment queue lookup failed:",
        error.code,
      );

      return errorResponse(
        "Unable to load payment queue.",
        500,
      );
    }


    // =======================================================
    // 4. GENERATE SECURE RECEIPT URLS
    // =======================================================

    const payments = await Promise.all(
      (data ?? []).map(async (payment) => {
        // Supabase many-to-one relationships normally
        // return an object. Handle an array defensively.
        const relatedOrder = Array.isArray(payment.orders)
          ? payment.orders[0]
          : payment.orders;

        const order = isOrderSummary(relatedOrder)
          ? relatedOrder
          : null;

        let receiptUrl: string | null = null;

        // Only sign receipts belonging to the associated
        // order's private storage directory.
        if (
          order &&
          payment.order_id === order.id &&
          typeof payment.receipt_path === "string" &&
          isReceiptPathValid(
            payment.receipt_path,
            order.id,
          )
        ) {
          const {
            data: signed,
            error: signedError,
          } = await db.storage
            .from(BUCKET)
            .createSignedUrl(
              payment.receipt_path,
              SIGNED_URL_EXPIRY,
            );

          if (signedError) {
            console.error(
              "Receipt signing failed:",
              payment.id,
              signedError.message,
            );
          } else {
            receiptUrl = signed.signedUrl;
          }
        } else {
          console.error(
            "Invalid payment receipt association:",
            payment.id,
          );
        }

        // Return only fields required by the admin interface.
        return {
          id: payment.id,

          reference: payment.payment_reference,

          senderName: payment.sender_name,

          senderBank: payment.sender_bank,

          transferReference:
            payment.transfer_reference,

          amountKobo: payment.amount_kobo,

          status: payment.status,

          submittedAt: payment.created_at,

          receiptUrl,

          order: order
            ? {
                orderReference:
                  order.order_reference,

                buyerName:
                  order.buyer_name,

                buyerEmail:
                  order.buyer_email,

                buyerPhone:
                  order.buyer_phone,

                ticketTypeId:
                  order.ticket_type_id,

                quantity:
                  order.quantity,

                admissionsCount:
                  order.admissions_count,

                totalAmountKobo:
                  order.total_amount_kobo,

                status:
                  order.status,
              }
            : null,
        };
      }),
    );


    // =======================================================
    // 5. RETURN PAYMENT QUEUE
    // =======================================================

    return NextResponse.json(
      {
        success: true,
        payments,
      },
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      },
    );

  } catch (caught) {
    console.error(
      "Unexpected payment queue failure:",
      caught instanceof Error
        ? caught.message
        : "Unknown error",
    );

    return errorResponse(
      "Unable to load payment queue.",
      500,
    );
  }
}
