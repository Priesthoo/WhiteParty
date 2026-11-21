
import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  requireAdminRole,
} from "@/lib/auth/admin";

import {
  sendTicketEmail,
  type IssuedTicket,
} from "@/lib/email/ticket-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

const ORDER_REFERENCE_PATTERN =
  /^AWN-2026-[A-F0-9]{16}$/;

const TICKET_CODE_PATTERN =
  /^AWN-2026-[A-F0-9]{16}$/;

function jsonError(
  message: string,
  status: number,
) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: RESPONSE_HEADERS,
    },
  );
}

function isSameOrigin(request: Request): boolean {
  const originHeader = request.headers.get("origin");

  if (!originHeader) return false;

  try {
    return (
      new URL(originHeader).origin ===
      new URL(request.url).origin
    );
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      reference: string;
    }>;
  },
) {
  try {
    // -------------------------------------------------------
    // 1. VERIFY ADMIN
    // -------------------------------------------------------

    const {
      admin,
      response,
    } = await requireAdminRole([
      "owner",
      "finance",
    ]);

    if (response) return response;

    if (!admin) {
      return jsonError(
        "Administrator authentication required.",
        401,
      );
    }


    // -------------------------------------------------------
    // 2. VERIFY REQUEST ORIGIN
    // -------------------------------------------------------

    if (!isSameOrigin(request)) {
      return jsonError(
        "Invalid request origin.",
        403,
      );
    }


    // -------------------------------------------------------
    // 3. VALIDATE ORDER REFERENCE
    // -------------------------------------------------------

    const { reference } = await params;

    if (!ORDER_REFERENCE_PATTERN.test(reference)) {
      return jsonError(
        "Invalid order reference.",
        400,
      );
    }


    // -------------------------------------------------------
    // 4. LOAD PAID ORDER
    // -------------------------------------------------------

    const db = createSupabaseAdminClient();

    const {
      data: order,
      error: orderError,
    } = await db
      .from("orders")
      .select(`
        id,
        order_reference,
        buyer_name,
        buyer_email,
        event_id,
        ticket_type_id,
        admissions_count,
        total_amount_kobo,
        status
      `)
      .eq("order_reference", reference)
      .maybeSingle();

    if (orderError) {
      console.error(
        "Ticket resend order lookup failed:",
        orderError.code,
      );

      return jsonError(
        "Could not retrieve this order.",
        500,
      );
    }

    if (!order) {
      return jsonError(
        "Order not found.",
        404,
      );
    }

    if (order.status !== "paid") {
      return jsonError(
        "Tickets can only be emailed for a paid order.",
        409,
      );
    }


    // -------------------------------------------------------
    // 5. VERIFY CONFIRMED PAYMENT
    // -------------------------------------------------------

    const {
      data: confirmedPayment,
      error: paymentError,
    } = await db
      .from("payment_submissions")
      .select("id")
      .eq("order_id", order.id)
      .eq("status", "confirmed")
      .eq(
        "verified_amount_kobo",
        order.total_amount_kobo,
      )
      .not(
        "bank_transaction_reference",
        "is",
        null,
      )
      .maybeSingle();

    if (paymentError || !confirmedPayment) {
      return jsonError(
        "A confirmed bank payment could not be verified for this order.",
        409,
      );
    }


    // -------------------------------------------------------
    // 6. LOAD EVENT
    // -------------------------------------------------------

    const {
      data: event,
      error: eventError,
    } = await db
      .from("events")
      .select("name,event_start_at,venue")
      .eq("id", order.event_id)
      .maybeSingle();

    if (eventError || !event) {
      return jsonError(
        "Event information could not be retrieved.",
        500,
      );
    }


    // -------------------------------------------------------
    // 7. LOAD TICKET TYPE
    // -------------------------------------------------------

    const {
      data: ticketType,
      error: ticketTypeError,
    } = await db
      .from("ticket_types")
      .select("name")
      .eq("id", order.ticket_type_id)
      .maybeSingle();

    if (ticketTypeError || !ticketType) {
      return jsonError(
        "Ticket category information could not be retrieved.",
        500,
      );
    }


    // -------------------------------------------------------
    // 8. LOAD ALREADY ISSUED TICKETS
    // -------------------------------------------------------

    const {
      data: ticketRows,
      error: ticketError,
    } = await db
      .from("tickets")
      .select("ticket_code,attendee_id")
      .eq("order_id", order.id)
      .order("ticket_number", {
        ascending: true,
      });

    if (ticketError || !ticketRows) {
      return jsonError(
        "Could not retrieve the issued tickets.",
        500,
      );
    }

    if (
      ticketRows.length !==
      order.admissions_count
    ) {
      return jsonError(
        "The saved ticket count does not match the paid order. Please investigate before sending.",
        409,
      );
    }

    if (
      ticketRows.some(
        (ticket) =>
          typeof ticket.ticket_code !== "string" ||
          !TICKET_CODE_PATTERN.test(ticket.ticket_code),
      )
    ) {
      return jsonError(
        "One or more saved ticket codes are invalid.",
        409,
      );
    }


    // -------------------------------------------------------
    // 9. LOAD ATTENDEES
    // -------------------------------------------------------

    const attendeeIds = ticketRows.map(
      (ticket) => ticket.attendee_id,
    );

    const {
      data: attendees,
      error: attendeeError,
    } = await db
      .from("attendees")
      .select("id,full_name")
      .in("id", attendeeIds);

    if (attendeeError || !attendees) {
      return jsonError(
        "Could not retrieve ticket holder details.",
        500,
      );
    }

    const attendeeMap = new Map(
      attendees.map((attendee) => [
        attendee.id,
        attendee.full_name,
      ]),
    );


    const tickets: IssuedTicket[] = [];

    for (const ticket of ticketRows) {
      const attendeeName = attendeeMap.get(
        ticket.attendee_id,
      );

      if (!attendeeName) {
        return jsonError(
          "A ticket holder record is missing.",
          409,
        );
      }

      tickets.push({
        ticketCode: ticket.ticket_code,
        attendeeName,
        ticketType: ticketType.name,
      });
    }


    // -------------------------------------------------------
    // 10. SEND EXISTING TICKET CODES
    // -------------------------------------------------------

    const delivery = await sendTicketEmail({
      buyerName: order.buyer_name,
      buyerEmail: order.buyer_email,
      orderReference: order.order_reference,
      eventName: event.name,
      eventStartAt: event.event_start_at,
      venue: event.venue,
      tickets,
    });


    // -------------------------------------------------------
    // 11. RETURN DELIVERY RESULT
    // -------------------------------------------------------

    if (delivery.status === "failed") {
      return NextResponse.json(
        {
          success: true,

          emailDelivery: {
            status: "failed",
            message: delivery.message,
          },
        },
        {
          status: 200,
          headers: RESPONSE_HEADERS,
        },
      );
    }

    return NextResponse.json(
      {
        success: true,

        emailDelivery: {
          status: "sent",
          messageId: delivery.messageId,
        },

        orderReference: order.order_reference,

        ticketsEmailed: tickets.length,
      },
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      },
    );

  } catch (caught) {
    console.error(
      "Ticket email resend failed:",
      caught instanceof Error
        ? caught.message
        : "Unknown error.",
    );

    return jsonError(
      "Unable to resend the ticket email.",
      500,
    );
  }
}
