
import { redirect } from "next/navigation";
import Link from "next/link";

import {
  CreditCard,
  Ticket,
  Users,
  Clock3,
  ScanLine,
} from "lucide-react";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  getAdminContext,
} from "@/lib/auth/admin";

import {
  Badge,
  Card,
} from "@/components/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DashboardStats = {
  verifiedRevenueKobo: number;
  paidOrders: number;
  paidAdmissions: number;
  pendingPayments: number;
  checkedInAdmissions: number;
  activeTickets: number;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readMetric(
  value: unknown,
): number | null {
  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function parseDashboardStats(
  value: unknown,
): DashboardStats | null {
  if (!isRecord(value)) {
    return null;
  }

  const fields = {
    verifiedRevenueKobo: readMetric(
      value.verifiedRevenueKobo,
    ),

    paidOrders: readMetric(
      value.paidOrders,
    ),

    paidAdmissions: readMetric(
      value.paidAdmissions,
    ),

    pendingPayments: readMetric(
      value.pendingPayments,
    ),

    checkedInAdmissions: readMetric(
      value.checkedInAdmissions,
    ),

    activeTickets: readMetric(
      value.activeTickets,
    ),
  };

  if (
    Object.values(fields).some(
      (field) => field === null,
    )
  ) {
    return null;
  }

  return fields as DashboardStats;
}

const numberFormat = new Intl.NumberFormat(
  "en-NG",
  {
    maximumFractionDigits: 0,
  },
);

const currencyFormat = new Intl.NumberFormat(
  "en-NG",
  {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  },
);

function formatCount(value: number) {
  return numberFormat.format(value);
}

function formatNaira(kobo: number) {
  return currencyFormat.format(kobo / 100);
}

export default async function AdminDashboard() {
  // =========================================================
  // 1. ADMIN AUTHENTICATION
  // =========================================================

  const admin = await getAdminContext();

  if (!admin) {
    redirect("/admin/login");
  }


  // =========================================================
  // 2. ROLE-BASED REDIRECTS
  // =========================================================

  if (
    admin.role === "ticket_manager" ||
    admin.role === "gate_staff"
  ) {
    redirect("/admin/gate");
  }


  // =========================================================
  // 3. LIMITED SUPPORT ACCESS
  // =========================================================

  if (admin.role === "support") {
    return (
      <main className="admin-page">
        <div className="admin-title">
          <Badge variant="gold">
            SUPPORT ACCESS
          </Badge>

          <h1>Limited access</h1>

          <p>
            Your account does not have access to
            financial or gate operations.
          </p>
        </div>

        <Card>
          <h2>Support permissions</h2>

          <p className="muted">
            You can use only the administrative
            features assigned to your account.
            Contact the event owner if you need
            additional permissions.
          </p>
        </Card>
      </main>
    );
  }


  // =========================================================
  // 4. LOAD DASHBOARD METRICS
  // =========================================================

  let stats: DashboardStats;

  try {
    const db = createSupabaseAdminClient();

    const {
      data,
      error,
    } = await db.rpc(
      "get_admin_dashboard_stats",
    );

    if (error) {
      console.error(
        "Admin dashboard statistics failed:",
        error.code,
      );

      throw new Error(
        "DASHBOARD_STATS_UNAVAILABLE",
      );
    }

    const parsed = parseDashboardStats(data);

    if (!parsed) {
      console.error(
        "Dashboard statistics returned an invalid response.",
      );

      throw new Error(
        "INVALID_DASHBOARD_STATS",
      );
    }

    stats = parsed;

  } catch (caught) {
    console.error(
      "Unable to load admin dashboard:",
      caught instanceof Error
        ? caught.message
        : "Unknown error",
    );

    return (
      <main className="admin-page">
        <div className="admin-title">
          <Badge variant="gold">
            EVENT OVERVIEW
          </Badge>

          <h1>Event dashboard</h1>
        </div>

        <Card>
          <h2>Dashboard temporarily unavailable</h2>

          <p className="muted">
            We couldn't retrieve the latest event
            statistics. No financial figures are
            being displayed until the data can
            be verified.
          </p>

          <Link
            href="/admin"
            className="admin-link"
          >
            Reload dashboard →
          </Link>
        </Card>
      </main>
    );
  }


  // =========================================================
  // 5. BUILD DASHBOARD METRICS
  // =========================================================

  const metrics = [
    {
      label: "Verified revenue",

      value: formatNaira(
        stats.verifiedRevenueKobo,
      ),

      note: "Confirmed bank payments",

      icon: CreditCard,
    },

    {
      label: "Paid orders",

      value: formatCount(
        stats.paidOrders,
      ),

      note: "Verified orders",

      icon: Ticket,
    },

    {
      label: "Confirmed admissions",

      value: formatCount(
        stats.paidAdmissions,
      ),

      note: "Individual paid admissions",

      icon: Users,
    },

    {
      label: "Pending payments",

      value: formatCount(
        stats.pendingPayments,
      ),

      note: "Awaiting administrator review",

      icon: Clock3,
    },

    {
      label: "Guests checked in",

      value: formatCount(
        stats.checkedInAdmissions,
      ),

      note: "Recorded entrance scans",

      icon: ScanLine,
    },

    {
      label: "Active tickets",

      value: formatCount(
        stats.activeTickets,
      ),

      note: "Unused valid tickets",

      icon: Ticket,
    },
  ];


  // =========================================================
  // 6. ADMIN DASHBOARD
  // =========================================================

  return (
    <main className="admin-page">

      {/* ------------------------------------------------- */}
      {/* DASHBOARD HEADING */}
      {/* ------------------------------------------------- */}

      <div className="admin-title">
        <Badge variant="gold">
          EVENT OVERVIEW
        </Badge>

        <h1>Event dashboard</h1>

        <p>
          Monitor ticket sales, verified payments
          and guest attendance.
        </p>
      </div>


      {/* ------------------------------------------------- */}
      {/* EVENT METRICS */}
      {/* ------------------------------------------------- */}

      <div className="admin-metrics">

        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <Card
              className="admin-metric"
              key={metric.label}
            >
              <span>
                {metric.label.toUpperCase()}
              </span>

              <Icon size={19} />

              <strong>
                {metric.value}
              </strong>

              <small>
                {metric.note}
              </small>
            </Card>
          );
        })}

      </div>


      {/* ------------------------------------------------- */}
      {/* ADMIN OPERATIONS */}
      {/* ------------------------------------------------- */}

      <div className="admin-panels">

        {/* PAYMENT MANAGEMENT */}

        <Card>
          <div>
            <CreditCard size={22} />

            <h2>Payment operations</h2>
          </div>

          <p className="muted">
            Review bank transfer receipts, compare
            actual bank credits and issue tickets
            after successful verification.
          </p>

          <Link
            href="/admin/payments"
            className="admin-link"
          >
            Open payment queue →
          </Link>
        </Card>


        {/* GATE MANAGEMENT */}

        <Card>
          <div>
            <ScanLine size={22} />

            <h2>Gate operations</h2>
          </div>

          <p className="muted">
            Scan individual QR tickets or enter
            ticket IDs to verify and record guest
            admission.
          </p>

          <Link
            href="/admin/gate"
            className="admin-link"
          >
            Open gate scanner →
          </Link>
        </Card>

      </div>


      {/* ------------------------------------------------- */}
      {/* FINANCIAL REPORTING NOTE */}
      {/* ------------------------------------------------- */}

      <p className="muted">
        Financial figures include confirmed payments
        only. Pending submissions are not treated
        as revenue.
      </p>

    </main>
  );
}
