"use client";

import {
  useState,
  type ReactNode,
} from "react";

import Link from "next/link";

import {
  useRouter,
  usePathname,
} from "next/navigation";

import {
  LayoutDashboard,
  CreditCard,
  ScanLine,
  LogOut,
  ShieldCheck,
} from "lucide-react";

import {
  createClient,
} from "@/lib/supabase/browser";

import { eventConfig } from "@/features/events/config/event";

// ===========================================================
// TYPES
// ===========================================================

export type AdminRole =
  | "owner"
  | "finance"
  | "ticket_manager"
  | "gate_staff"
  | "support";

type AdminShellProps = {
  children: ReactNode;
  adminName: string;
  adminRole: AdminRole;
};

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: readonly AdminRole[];
};

// ===========================================================
// NAVIGATION CONFIGURATION
// ===========================================================

const navigation: NavigationItem[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    roles: ["owner", "finance"],
  },
  {
    href: "/admin/payments",
    label: "Payments",
    icon: CreditCard,
    roles: ["owner", "finance"],
  },
  {
    href: "/admin/gate",
    label: "Gate check-in",
    icon: ScanLine,
    roles: ["owner", "ticket_manager", "gate_staff"],
  },
];

// ===========================================================
// COMPONENT
// ===========================================================

export function AdminShell({
  children,
  adminName,
  adminRole,
}: AdminShellProps) {
  const router = useRouter();

  const pathname = usePathname();

  const [loggingOut, setLoggingOut] = useState(false);

  const [logoutError, setLogoutError] = useState("");

  // =========================================================
  // ROLE-BASED NAVIGATION
  // =========================================================

  const allowedNavigation = navigation.filter(
    (item) => item.roles.includes(adminRole),
  );

  // =========================================================
  // ACTIVE NAVIGATION ITEM
  // =========================================================

  function isActive(href: string): boolean {
    if (href === "/admin") {
      return pathname === "/admin";
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }

  // =========================================================
  // ADMIN LOGOUT
  // =========================================================

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    setLogoutError("");

    try {
      const db = createClient();

      const { error } = await db.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/admin/login");

      router.refresh();

    } catch (caught) {
      console.error(
        "Administrator logout failed:",
        caught instanceof Error
          ? caught.message
          : "Unknown error",
      );

      setLogoutError(
        "Unable to sign out. Please try again.",
      );

      setLoggingOut(false);
    }
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="admin-shell">

      {/* ------------------------------------------------- */}
      {/* SIDEBAR */}
      {/* ------------------------------------------------- */}

      <aside
        className="admin-sidebar"
        aria-label="Administrator navigation"
      >

        {/* BRAND */}

        <Link
          href="/admin"
          className="admin-brand"
          aria-label="ZIMJA FEST administration home"
        >
          <strong>ZIMJA FEST</strong>

          <span>
            EVENT MANAGEMENT
          </span>
        </Link>

        {/* EVENT INFORMATION */}

        <div className="admin-event">
          <small>
            MANAGING EVENT
          </small>

          <strong>
            {eventConfig.name}
          </strong>

          <span>
            {eventConfig.dateLabel.toUpperCase()}
          </span>
        </div>

        {/* NAVIGATION */}

        <nav className="admin-nav">
          {allowedNavigation.map((item) => {
            const Icon = item.icon;

            const active = isActive(item.href);

            return (
              <Link
                href={item.href}
                key={item.href}
                title={item.label}
                aria-label={item.label}
                aria-current={
                  active ? "page" : undefined
                }
                className={
                  active ? "admin-nav-active" : undefined
                }
              >
                <Icon
                  size={18}
                  aria-hidden="true"
                />

                <span>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* ADMINISTRATOR PROFILE */}

        <div className="admin-user">

          <div className="admin-user-heading">
            <ShieldCheck
              size={19}
              aria-hidden="true"
            />

            <span>
              SIGNED IN AS
            </span>
          </div>

          <strong
            className="admin-user-name"
            title={adminName}
          >
            {adminName}
          </strong>

          <span className="admin-user-role">
            {adminRole.replaceAll("_", " ")}
          </span>

          {/* LOGOUT ERROR */}

          {logoutError && (
            <div
              className="admin-logout-error"
              role="alert"
            >
              {logoutError}
            </div>
          )}

          {/* LOGOUT BUTTON */}

          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            aria-label="Sign out of administrator account"
          >
            <LogOut
              size={15}
              aria-hidden="true"
            />

            {loggingOut
              ? "Signing out…"
              : "Sign out"}
          </button>

        </div>

      </aside>

      {/* ------------------------------------------------- */}
      {/* MAIN ADMIN CONTENT */}
      {/* ------------------------------------------------- */}

      <div className="admin-main">

        {/* TOP BAR */}

        <header className="admin-topbar">
          <span>
            EVENT ADMINISTRATION
          </span>

          <span>
            PRIVATE WORKSPACE
          </span>
        </header>

        {/* PAGE CONTENT */}

        <main
          className="admin-content"
          id="admin-main-content"
        >
          {children}
        </main>

      </div>

    </div>
  );
}