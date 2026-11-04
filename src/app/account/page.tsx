import { Suspense } from "react";
import { AccountDashboard } from "@/components/account-dashboard";
import { requireUser } from "@/lib/require-session";

export default function Account() {
  return <Suspense fallback={<main className="account-page"><div className="account-loading"><span className="loading-dot" /> Verifying account access…</div></main>}><ProtectedAccount /></Suspense>;
}

async function ProtectedAccount() {
  await requireUser("/account");
  return <AccountDashboard />;
}
