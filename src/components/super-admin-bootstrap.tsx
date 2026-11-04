"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function SuperAdminBootstrap() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: { "x-super-admin-bootstrap-secret": secret },
        cache: "no-store",
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Administrator setup could not be completed.");
      router.push("/admin");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Administrator setup could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <div className="auth-wrap">
      <Link href="/" className="auth-brand"><Image src="/PrivSentinel.png" alt="" width={42} height={42} className="auth-brand-logo" /><span className="brand-name">Priv<span>Sentinel</span></span></Link>
      <section className="auth-card">
        <span className="auth-eyebrow">ONE-TIME SECURITY SETUP</span>
        <h1>Initialize administrator access</h1>
        <p className="auth-description">Sign in with the designated initial administrator account and enter the deployment bootstrap secret. Setup is disabled after successful initialization.</p>
        {error && <p className="auth-message error" role="alert">{error}</p>}
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label htmlFor="bootstrap-secret">Bootstrap secret</label>
          <input id="bootstrap-secret" type="password" autoComplete="current-password" required value={secret} onChange={(event) => setSecret(event.target.value)} />
          <button type="submit" className="auth-submit" disabled={busy}>{busy ? "Initializing…" : "Initialize super administrator"}</button>
        </form>
        <p className="auth-back-link"><Link href="/dashboard">Return to account</Link></p>
      </section>
    </div>
  </main>;
}
