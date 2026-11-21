
import {
  createHash,
  randomUUID,
} from "node:crypto";

import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024;
const MAX_REQUEST_SIZE = MAX_SIZE + 256 * 1024;

const RECEIPT_BUCKET = "payment-receipts";

type PaymentError = {
  status: number;
  message: string;
};

function getText(
  form: FormData,
  key: string,
): string | null {
  const value = form.get(key);

  return typeof value === "string"
    ? value.trim()
    : null;
}

function detectType(data: Buffer): string | null {
  // JPEG
  if (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  ) {
    return "image/jpeg";
  }

  // PNG
  if (
    data.length >= 8 &&
    data
      .subarray(0, 8)
      .equals(
        Buffer.from([
          0x89,
          0x50,
          0x4e,
          0x47,
          0x0d,
          0x0a,
          0x1a,
          0x0a,
        ]),
      )
  ) {
    return "image/png";
  }

  // PDF
  if (
    data.length >= 5 &&
    data.subarray(0, 5).toString() === "%PDF-"
  ) {
    return "application/pdf";
  }

  return null;
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
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function mapPaymentError(
  message: string,
): PaymentError | null {
  const errors: Record<string, PaymentError> = {
    INVALID_ORDER_REFERENCE: {
      status: 400,
      message: "Invalid order reference.",
    },

    INVALID_CHECKOUT_TOKEN: {
      status: 400,
      message: "Invalid checkout session.",
    },

    INVALID_SENDER_NAME: {
      status: 400,
      message: "Please enter a valid sender name.",
    },

    INVALID_SENDER_BANK: {
      status: 400,
      message: "Please enter a valid bank name.",
    },

    INVALID_TRANSFER_REFERENCE: {
      status: 400,
      message: "Please enter a valid transfer reference.",
    },

    INVALID_PAYMENT_AMOUNT: {
      status: 400,
      message: "Please enter a valid payment amount.",
    },

    INVALID_RECEIPT_PATH: {
      status: 400,
      message: "The receipt could not be verified.",
    },

    INVALID_PAYMENT_REFERENCE: {
      status: 400,
      message: "Invalid payment reference.",
    },

    ORDER_NOT_FOUND: {
      status: 404,
      message: "Order could not be found.",
    },

    ORDER_NOT_PAYABLE: {
      status: 409,
      message: "This order is no longer accepting payment.",
    },

    RESERVATION_EXPIRED: {
      status: 409,
      message: "Your reservation has expired.",
    },

    AMOUNT_MISMATCH: {
      status: 400,
      message: "The submitted amount does not match your order.",
    },

    PAYMENT_ALREADY_SUBMITTED: {
      status: 409,
      message: "A payment submission already exists for this order.",
    },
  };

  const match = Object.entries(errors).find(
    ([code]) => message.includes(code),
  );

  return match?.[1] ?? null;
}

async function removeReceipt(
  db: ReturnType<typeof createSupabaseAdminClient>,
  path: string,
) {
  try {
    const { error } = await db.storage
      .from(RECEIPT_BUCKET)
      .remove([path]);

    if (error) {
      console.error(
        "Receipt cleanup failed",
        error.message,
      );
    }
  } catch {
    console.error("Receipt cleanup failed.");
  }
}

export async function POST(request: Request) {
  // Supplementary request-size check.
  // The platform should also enforce an upload/body-size limit.
  const contentLength = Number(
    request.headers.get("content-length") ?? 0,
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_REQUEST_SIZE
  ) {
    return errorResponse(
      "The payment submission is too large.",
      413,
    );
  }

  // Parse multipart form.
  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return errorResponse(
      "Invalid payment form.",
      400,
    );
  }

  // Read only actual string form fields.
  const reference =
    getText(form, "orderReference") ?? "";

  const token =
    getText(form, "checkoutToken") ?? "";

  const senderName =
    getText(form, "senderName") ?? "";

  const senderBank =
    getText(form, "senderBank") ?? "";

  const transferRef =
    getText(form, "transferReference") ?? "";

  const amountValue =
    getText(form, "amountNaira") ?? "";

  const receiptValue = form.get("receipt");

  // Validate order reference and checkout token.
  if (
    !/^AWN-2026-[A-F0-9]{16}$/.test(reference) ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return errorResponse(
      "Invalid order or checkout session.",
      400,
    );
  }

  // Validate sender details.
  if (
    senderName.length < 2 ||
    senderName.length > 120 ||
    senderBank.length > 100 ||
    transferRef.length < 3 ||
    transferRef.length > 120
  ) {
    return errorResponse(
      "Please provide valid transfer details.",
      400,
    );
  }

  // Accept whole Naira amounts only.
  if (!/^\d{1,9}$/.test(amountValue)) {
    return errorResponse(
      "Please enter a valid transfer amount.",
      400,
    );
  }

  const amountNaira = Number(amountValue);
  const amountKobo = amountNaira * 100;

  if (
    !Number.isSafeInteger(amountNaira) ||
    amountNaira <= 0 ||
    !Number.isSafeInteger(amountKobo)
  ) {
    return errorResponse(
      "Please enter a valid transfer amount.",
      400,
    );
  }

  // Validate receipt presence.
  if (!(receiptValue instanceof File)) {
    return errorResponse(
      "Please upload your transfer receipt.",
      400,
    );
  }

  const receipt = receiptValue;

  if (
    receipt.size <= 0 ||
    receipt.size > MAX_SIZE
  ) {
    return errorResponse(
      "Receipt must be larger than 0 bytes and no larger than 5 MB.",
      400,
    );
  }

  // Read and inspect actual file contents.
  let buffer: Buffer;

  try {
    buffer = Buffer.from(
      await receipt.arrayBuffer(),
    );
  } catch {
    return errorResponse(
      "Unable to read the uploaded receipt.",
      400,
    );
  }

  const contentType = detectType(buffer);

  if (!contentType) {
    return errorResponse(
      "Upload a valid JPG, PNG or PDF receipt.",
      400,
    );
  }

  // Generate the private checkout token hash.
  const checkoutHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

  let db: ReturnType<typeof createSupabaseAdminClient>;

  try {
    db = createSupabaseAdminClient();
  } catch {
    return errorResponse(
      "Payment service is temporarily unavailable.",
      503,
    );
  }

  // Verify that the order exists and belongs to this checkout session.
  const {
    data: order,
    error: lookupError,
  } = await db
    .from("orders")
    .select(
      "id,total_amount_kobo,status,reservation_expires_at",
    )
    .eq("order_reference", reference)
    .eq("checkout_token_hash", checkoutHash)
    .maybeSingle();

  if (lookupError) {
    console.error(
      "Payment order lookup failed",
      lookupError.code,
    );

    return errorResponse(
      "Unable to verify this order.",
      500,
    );
  }

  if (!order) {
    return errorResponse(
      "Order not found.",
      404,
    );
  }

  // Verify that the order can still receive payment.
  if (
    order.status !== "reserved" &&
    order.status !== "payment_submitted"
  ) {
    return errorResponse(
      "This order is no longer accepting payment.",
      409,
    );
  }

  const expiry = Date.parse(
    order.reservation_expires_at,
  );

  if (
    !Number.isFinite(expiry) ||
    expiry <= Date.now()
  ) {
    return errorResponse(
      "Your reservation has expired.",
      409,
    );
  }

  // Check the exact database total in kobo.
  const expectedAmountKobo = Number(
    order.total_amount_kobo,
  );

  if (
    !Number.isSafeInteger(expectedAmountKobo) ||
    amountKobo !== expectedAmountKobo
  ) {
    return errorResponse(
      "Transfer amount must exactly match the order total.",
      400,
    );
  }

  // Create a unique private receipt path.
  const paymentId = randomUUID();

  const suffix =
    contentType === "image/jpeg"
      ? "jpg"
      : contentType === "image/png"
        ? "png"
        : "pdf";

  const path =
    `${order.id}/${paymentId}.${suffix}`;

  // Upload receipt.
  const {
    error: uploadError,
  } = await db.storage
    .from(RECEIPT_BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error(
      "Payment receipt upload failed",
      uploadError.message,
    );

    return errorResponse(
      "Receipt upload failed. Please try again.",
      500,
    );
  }

  // Generate a unique payment reference.
  const paymentReference =
    `AWNP-${randomUUID()
      .replaceAll("-", "")
      .slice(0, 20)
      .toUpperCase()}`;

  // Submit payment through the database transaction.
  try {
    const {
      data,
      error,
    } = await db.rpc(
      "submit_bank_payment",
      {
        p_order_reference: reference,
        p_checkout_token_hash: checkoutHash,
        p_sender_name: senderName,
        p_sender_bank: senderBank,
        p_transfer_reference: transferRef,
        p_amount_kobo: amountKobo,
        p_receipt_path: path,
        p_payment_reference: paymentReference,
      },
    );

    if (error) {
      await removeReceipt(db, path);

      console.error(
        "Payment submission RPC failed",
        error.code,
      );

      const mapped = mapPaymentError(
        error.message,
      );

      return errorResponse(
        mapped?.message ??
          "Payment submission could not be completed.",
        mapped?.status ?? 500,
      );
    }

    // Validate the RPC response before reporting success.
    if (
      !isRecord(data) ||
      data.status !== "submitted" ||
      typeof data.paymentId !== "string" ||
      typeof data.paymentReference !== "string"
    ) {
      await removeReceipt(db, path);

      console.error(
        "Payment submission returned an invalid response.",
      );

      return errorResponse(
        "We could not confirm your payment submission. Please check your order before retrying.",
        500,
      );
    }

    return NextResponse.json(
      {
        success: true,
        payment: data,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    // The RPC may have failed before committing.
    // Attempt to remove the uploaded receipt.
    await removeReceipt(db, path);

    console.error(
      "Unexpected payment submission failure.",
    );

    return errorResponse(
      "Payment submission could not be completed. Please check your order before retrying.",
      500,
    );
  }
}
