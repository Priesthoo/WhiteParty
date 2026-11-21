import {
  randomBytes,
  createHash,
} from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  ticketTypeId: z.enum([
    "early-bird",
    "regular",
    "friends-of-five",
  ]),

  quantity: z.number().int().min(1).max(5),

  buyer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),

    phone: z.string()
      .trim()
      .min(7)
      .max(24)
      .regex(/^[+0-9()\s-]+$/),
  }),

  attendees: z.array(
    z.object({
      fullName: z.string().trim().min(2).max(100),
    }),
  ).max(25),

}).superRefine((value, ctx) => {
  const expected =
    value.quantity *
    (value.ticketTypeId === "friends-of-five" ? 5 : 1);

  if (value.attendees.length !== expected) {
    ctx.addIssue({
      code: "custom",
      path: ["attendees"],
      message: `Enter ${expected} attendee names.`,
    });
  }
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Invalid JSON request.",
        },
      },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: "Please review your checkout details.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  const token = randomBytes(32).toString("hex");

  const hash = createHash("sha256")
    .update(token)
    .digest("hex");

  try {
    const db = createSupabaseAdminClient();

    const { data, error } = await db.rpc(
      "create_ticket_order",
      {
        p_ticket_type_id: input.ticketTypeId,
        p_quantity: input.quantity,
        p_buyer_name: input.buyer.name,
        p_buyer_email: input.buyer.email,
        p_buyer_phone: input.buyer.phone,
        p_attendees: input.attendees,
        p_checkout_token_hash: hash,
      },
    );

    if (error) {
      const map: Record<string, string> = {
        EARLY_BIRD_SOLD_OUT:
          "The remaining Early Bird allocation is no longer available.",

        EARLY_BIRD_NOT_SOLD_OUT:
          "Regular and Friends of 5 tickets become available after the Early Bird release is complete.",

        TICKET_TYPE_NOT_FOUND:
          "This ticket category is unavailable.",

        INVALID_ATTENDEE_COUNT:
          "The attendee count does not match your ticket quantity.",
      };

      const known = Object.entries(map).find(
        ([key]) => error.message.includes(key),
      );

      if (known) {
        return NextResponse.json(
          {
            error: {
              code: known[0],
              message: known[1],
            },
          },
          { status: 409 },
        );
      }

      if (error.message.includes("INVALID")) {
        return NextResponse.json(
          {
            error: {
              message: "Some order information is invalid.",
            },
          },
          { status: 400 },
        );
      }

console.error("Order RPC failed:", {
  code: error.code,
  message: error.message,
  details: error.details,
  hint: error.hint,
});
      return NextResponse.json(
        {
          error: {
            message: "We could not reserve the tickets. Please try again.",
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,

        order: {
          ...data,
          checkoutToken: token,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );

  }    catch (caught) {
    console.error("Order route failed:", {
      message:
        caught instanceof Error
          ? caught.message
          : "Unknown error",
    });

    return NextResponse.json(
      {
        error: {
          message:
            "Ticket reservation service is unavailable.",
        },
      },
      { status: 503 },
    );
  }
}