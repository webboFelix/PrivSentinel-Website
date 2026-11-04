import { Suspense } from "react";
import { AccountDashboard } from "@/components/account-dashboard";
import { requireUser } from "@/lib/require-session";

export default function Dashboard() {
  return <Suspense fallback={<main className="account-page"><div className="account-loading"><span className="loading-dot" /> Verifying account access…</div></main>}><ProtectedDashboard /></Suspense>;
}

async function ProtectedDashboard() {
  await requireUser("/dashboard");
  return <AccountDashboard />;
}
