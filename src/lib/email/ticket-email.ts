
import { Resend } from "resend";

export type IssuedTicket = {
  ticketCode: string;
  attendeeName: string;
  ticketType: string;
};

export type TicketEmailInput = {
  buyerName: string;
  buyerEmail: string;
  orderReference: string;
  eventName: string;
  eventStartAt: string;
  venue: string;
  tickets: IssuedTicket[];
};

export type EmailDeliveryResult =
  | {
      status: "sent";
      messageId: string;
    }
  | {
      status: "failed";
      message: string;
    };

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return value.replace(
    /[&<>"']/g,
    (character) => replacements[character] ?? character,
  );
}

function formatEventDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(date);
}

export async function sendTicketEmail(
  input: TicketEmailInput,
): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return {
      status: "failed",
      message: "Email service is not configured.",
    };
  }

  if (
    input.tickets.length === 0 ||
    !input.buyerEmail
  ) {
    return {
      status: "failed",
      message: "Ticket email information is incomplete.",
    };
  }

  const resend = new Resend(apiKey);

  const eventDate = formatEventDate(
    input.eventStartAt,
  );

  const venue =
    input.venue.toLowerCase() === "undisclosed"
      ? "Venue details will be announced."
      : input.venue;

  const ticketHtml = input.tickets
    .map((ticket, index) => `
      <tr>
        <td style="
          padding: 20px;
          border: 1px solid #e7e7e7;
          border-radius: 10px;
        ">
          <p style="
            margin: 0 0 8px;
            color: #777777;
            font-size: 12px;
          ">
            TICKET ${index + 1} · ${escapeHtml(ticket.ticketType)}
          </p>

          <h3 style="
            margin: 0 0 8px;
            font-size: 16px;
            color: #222222;
          ">
            ${escapeHtml(ticket.attendeeName)}
          </h3>

          <div style="
            padding: 14px;
            background: #f5f5f5;
            border-radius: 6px;
            color: #171717;
            font-size: 19px;
            font-weight: bold;
            letter-spacing: 1px;
          ">
            ${escapeHtml(ticket.ticketCode)}
          </div>

          <p style="
            margin: 10px 0 0;
            font-size: 12px;
            color: #777777;
          ">
            Present this code at the event entrance.
          </p>
        </td>
      </tr>

      <tr>
        <td style="height: 12px;"></td>
      </tr>
    `)
    .join("");

  const ticketText = input.tickets
    .map((ticket, index) => [
      `Ticket ${index + 1}`,
      `Ticket holder: ${ticket.attendeeName}`,
      `Ticket type: ${ticket.ticketType}`,
      `Ticket code: ${ticket.ticketCode}`,
    ].join("\n"))
    .join("\n\n");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <body style="
        margin: 0;
        padding: 30px 12px;
        background: #f5f5f5;
        font-family: Arial, Helvetica, sans-serif;
      ">

        <div style="
          max-width: 600px;
          margin: 0 auto;
          padding: 30px;
          background: #ffffff;
          border-radius: 12px;
        ">

          <p style="
            color: #ff5a36;
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 2px;
          ">
            ZIMJA FEST PRESENTS
          </p>

          <h1 style="
            margin: 0 0 12px;
            color: #171717;
            font-size: 27px;
          ">
            Your tickets are ready!
          </h1>

          <p style="color: #555555; line-height: 1.7;">
            Hello ${escapeHtml(input.buyerName)},
          </p>

          <p style="color: #555555; line-height: 1.7;">
            Your payment has been confirmed. Your tickets
            for <strong>${escapeHtml(input.eventName)}</strong>
            have been issued.
          </p>

          <div style="
            margin: 24px 0;
            padding: 18px;
            background: #fff5f1;
            border-radius: 8px;
          ">
            <p>
              <strong>Event:</strong>
              ${escapeHtml(input.eventName)}
            </p>

            <p>
              <strong>Date:</strong>
              ${escapeHtml(eventDate)}
            </p>

            <p>
              <strong>Venue:</strong>
              ${escapeHtml(venue)}
            </p>

            <p>
              <strong>Booking reference:</strong>
              ${escapeHtml(input.orderReference)}
            </p>
          </div>

          <h2 style="color: #222222; font-size: 19px;">
            Your individual ticket codes
          </h2>

          <p style="color: #666666; line-height: 1.6;">
            Each ticket has its own unique code.
            Keep these codes safe and present the
            appropriate code at the entrance.
          </p>

          <table style="
            width: 100%;
            border-collapse: separate;
          ">
            ${ticketHtml}
          </table>

          <div style="
            margin-top: 24px;
            padding: 16px;
            background: #f5f5f5;
            border-radius: 8px;
          ">
            <strong>Important entry information</strong>

            <p style="
              margin-bottom: 0;
              color: #555555;
              line-height: 1.6;
              font-size: 14px;
            ">
              Each ticket code admits one person and
              can only be used once. Do not share your
              ticket codes with other people.
            </p>
          </div>

          <p style="
            margin-top: 30px;
            color: #777777;
            font-size: 13px;
            line-height: 1.6;
          ">
            Thank you for choosing ALL WHITE POOL PARTY.
            We look forward to seeing you!
          </p>

          <hr style="
            margin: 25px 0;
            border: 0;
            border-top: 1px solid #eeeeee;
          " />

          <p style="
            color: #999999;
            font-size: 11px;
            text-align: center;
          ">
            ALL WHITE POOL PARTY · ZIMJA FEST
          </p>

        </div>
      </body>
    </html>
  `;

  const text = `
ALL WHITE POOL PARTY
ZIMJA FEST

Hello ${input.buyerName},

Your payment has been confirmed and your tickets have been issued.

EVENT DETAILS
Event: ${input.eventName}
Date: ${eventDate}
Venue: ${venue}
Booking reference: ${input.orderReference}

YOUR TICKETS

${ticketText}

IMPORTANT:
Each ticket code admits one person and can only be used once.
Keep your codes safe and present them at the entrance.

Thank you for choosing ALL WHITE POOL PARTY.
We look forward to seeing you!
  `.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [input.buyerEmail],
      subject: `Your ALL WHITE POOL PARTY tickets - ${input.orderReference}`,
      html,
      text,
    });

    if (error || !data?.id) {
      console.error(
        "Ticket email failed:",
        error?.message ?? "No email ID returned.",
      );

      return {
        status: "failed",
        message: "The ticket email could not be sent.",
      };
    }

    return {
      status: "sent",
      messageId: data.id,
    };

  } catch (caught) {
    console.error(
      "Ticket email request failed:",
      caught instanceof Error
        ? caught.message
        : "Unknown email error.",
    );

    return {
      status: "failed",
      message: "The ticket email could not be sent.",
    };
  }
}
