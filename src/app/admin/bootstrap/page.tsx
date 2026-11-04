import { headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SuperAdminBootstrap } from "@/components/super-admin-bootstrap";
import { getPrincipal } from "@/lib/authorization";

export default function BootstrapPage() {
  return <Suspense fallback={<main className="auth-page"><div className="account-loading"><span className="loading-dot" /> Loading secure setup…</div></main>}><BootstrapContent /></Suspense>;
}

async function BootstrapContent() {
  await connection();
  const principal = await getPrincipal(await headers());
  if (!principal) redirect("/login?next=%2Fadmin%2Fbootstrap");
  if (principal.actor.role === "admin" || principal.actor.role === "super_admin") redirect("/admin");
  return <SuperAdminBootstrap />;
}
