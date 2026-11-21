
import "server-only";

import {
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const secretKey =
    process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error(
      "SUPABASE_URL_NOT_CONFIGURED",
    );
  }

  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY_NOT_CONFIGURED",
    );
  }
  console.log("Supabase configuration:", {
  projectHost: new URL(url).host,
  keyPresent: Boolean(secretKey),
  keyType: secretKey.startsWith("sb_secret_")
    ? "Secret key"
    : secretKey.startsWith("sb_publishable_")
      ? "Publishable key"
      : secretKey.startsWith("eyJ")
        ? "Legacy JWT key"
        : "Unknown key format",
});
  return createSupabaseClient(
    url,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
