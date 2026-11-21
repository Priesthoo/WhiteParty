import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = createSupabaseAdminClient();

    const { data, error } = await db.rpc(
      "get_ticket_availability",
    );

    if (error) throw error;

    // Only expose whether a release is open.
    // Never expose internal ticket allocation
    // or remaining admission quantities.

    return NextResponse.json(
      {
        availability: {
          earlyBird: {
            open: Boolean(
              data?.earlyBird?.open,
            ),
          },

          regularOpen: Boolean(
            data?.regularOpen,
          ),

          friendsOpen: Boolean(
            data?.friendsOpen,
          ),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );

  } catch {
    return NextResponse.json(
      {
        error: "Availability is temporarily unavailable.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}