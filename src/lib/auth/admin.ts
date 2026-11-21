
import "server-only";

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const ADMIN_ROLES = [
  "owner",
  "finance",
  "ticket_manager",
  "gate_staff",
  "support",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface AdminContext {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
}

export type AdminGuardResult =
  | {
      admin: AdminContext;
      response: null;
    }
  | {
      admin: null;
      response: Response;
    };

function isAdminRole(value: unknown): value is AdminRole {
  return (
    typeof value === "string" &&
    (ADMIN_ROLES as readonly string[]).includes(value)
  );
}

function authError(
  message: string,
  status: number,
): Response {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}

/**
 * Retrieves the currently authenticated administrator.
 *
 * Identity is verified using the Supabase server session.
 * Administrator permissions are retrieved from the
 * private admin_users database table.
 *
 * Returns null whenever authentication, authorization,
 * or the administrator lookup cannot be verified.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  try {
    // 1. Verify the authenticated Supabase user.
    const auth = await createClient();

    const {
      data,
      error,
    } = await auth.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    const user = data.user;

    // 2. Retrieve administrator information using
    // the server-only service-role database client.
    const db = createSupabaseAdminClient();

    const {
      data: admin,
      error: adminError,
    } = await db
      .from("admin_users")
      .select(
        "user_id, display_name, role, is_active",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    // 3. Fail closed if the administrator record
    // cannot be verified.
    if (
      adminError ||
      !admin ||
      admin.user_id !== user.id ||
      admin.is_active !== true ||
      !isAdminRole(admin.role)
    ) {
      return null;
    }

    // 4. Return the verified administrator context.
    return {
      id: user.id,
      email: user.email ?? "",
      displayName: admin.display_name,
      role: admin.role,
    };

  } catch {
    // Authentication and authorization must fail closed.
    return null;
  }
}

/**
 * Requires an authenticated and active administrator.
 *
 * When roles are supplied, the administrator must have
 * at least one of the specified roles.
 */
export async function requireAdminRole(
  roles?: AdminRole[],
): Promise<AdminGuardResult> {
  const admin = await getAdminContext();

  // No valid administrator session.
  if (!admin) {
    return {
      admin: null,
      response: authError(
        "Administrator authentication required.",
        401,
      ),
    };
  }

  // Verify the administrator's role.
  if (
    roles &&
    !roles.includes(admin.role)
  ) {
    return {
      admin: null,
      response: authError(
        "You do not have permission to perform this action.",
        403,
      ),
    };
  }

  return {
    admin,
    response: null,
  };
}
