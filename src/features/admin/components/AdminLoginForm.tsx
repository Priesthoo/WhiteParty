
"use client";

import {
  useState,
  type FormEvent,
} from "react";

import { useRouter } from "next/navigation";

import { LockKeyhole } from "lucide-react";

import { createClient } from "@/lib/supabase/browser";

import {
  Button,
  Card,
} from "@/components/ui";

export function AdminLoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  // =========================================================
  // ADMINISTRATOR LOGIN
  // =========================================================

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (busy) return;

    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Enter your email address and password.");
      return;
    }

    setBusy(true);

    try {
      const db = createClient();

      const {
        error: authError,
      } = await db.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        setError(
          "Email or password is incorrect. Please check your details and try again.",
        );

        return;
      }

      // Navigate to the protected administrator area.
      // The server independently checks that the account
      // has an active administrator record and valid role.
      router.replace("/admin");

      router.refresh();

    } catch (caught) {
      console.error(
        "Administrator sign-in failed:",
        caught instanceof Error
          ? caught.message
          : "Unknown error",
      );

      setError(
        "Unable to sign in right now. Check your connection and try again.",
      );

    } finally {
      setBusy(false);
    }
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <Card className="login-form">

      {/* HEADER */}

      <div className="login-head">
        <LockKeyhole size={30} />

        <span>
          PRIVATE ADMINISTRATION
        </span>

        <h1>Welcome back.</h1>

        <p>
          Sign in to manage ALL WHITE POOL PARTY.
        </p>
      </div>


      {/* LOGIN FORM */}

      <form
        className="form-stack"
        onSubmit={submit}
        aria-busy={busy}
      >

        {/* EMAIL */}

        <div className="form-field">
          <label htmlFor="admin-email">
            Email address
          </label>

          <input
            className="input"
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            maxLength={254}
            placeholder="admin@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            required
            disabled={busy}
          />
        </div>


        {/* PASSWORD */}

        <div className="form-field">
          <label htmlFor="admin-password">
            Password
          </label>

          <input
            className="input"
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            required
            disabled={busy}
          />
        </div>


        {/* ERROR */}

        {error && (
          <div
            className="error-box"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}


        {/* SUBMIT */}

        <Button
          type="submit"
          fullWidth
          disabled={
            busy ||
            !email.trim() ||
            !password
          }
        >
          {busy
            ? "Signing in…"
            : "Sign in"}
        </Button>

      </form>


      {/* FOOTER */}

      <p
        className="muted"
        style={{
          textAlign: "center",
          marginTop: 18,
          fontSize: 13,
        }}
      >
        Authorised event personnel only.
      </p>

    </Card>
  );
}
