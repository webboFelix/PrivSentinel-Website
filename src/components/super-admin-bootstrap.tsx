"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export function SuperAdminBootstrap({
  email,
  emailVerified,
  isInitialized,
  isSuperAdministrator,
}: {
  email: string;
  emailVerified: boolean;
  isInitialized: boolean;
  isSuperAdministrator: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendVerificationEmail() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/admin/bootstrap",
      });
      if (result.error) {
        throw new Error(result.error.status === 429
          ? "Verification email requests are temporarily rate-limited. Wait before trying again."
          : "Verification email could not be sent. Confirm GMAIL_SMTP_USER is the Gmail account for GMAIL_APP_PASSWORD, then check the server email-delivery logs.");
      }
      setNotice("If the email provider accepted the request, a verification link will arrive shortly. Check your inbox and spam folder.");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Verification email could not be sent. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/bootstrap", {
        method: "POST",
        cache: "no-store",
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Administrator setup could not be completed.");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      router.replace("/admin");
      router.refresh();
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
        {isInitialized ? (
          <>
            <span className="auth-eyebrow">SETUP COMPLETE</span>
            <h1>Administrator access is already initialized</h1>
            <p className="auth-description">
              {isSuperAdministrator
                ? "This account is already set up as the super administrator. No further setup is needed."
                : "One-time administrator setup has already been completed. It cannot be initialized again."}
            </p>
            <p className="auth-back-link">
              <Link href={isSuperAdministrator ? "/admin" : "/dashboard"}>
                {isSuperAdministrator ? "Go to admin dashboard" : "Return to account"}
              </Link>
            </p>
          </>
        ) : (
          <>
            <span className="auth-eyebrow">ONE-TIME SECURITY SETUP</span>
            <h1>Initialize administrator access</h1>
            <p className="auth-description">Only the signed-in, email-verified account designated by the server can initialize the first super administrator. This one-time setup is disabled after completion.</p>
            {error && <p className="auth-message error" role="alert">{error}</p>}
            {notice && <p className="auth-message success" role="status">{notice}</p>}
            {!emailVerified
              ? <div className="auth-form">
                  <p className="auth-description">Verify {email} first. We send a verification link to the address on your account.</p>
                  <button type="button" className="auth-submit" disabled={busy} onClick={() => void sendVerificationEmail()}>{busy ? "Sending…" : "Send verification email"}</button>
                </div>
              : <form className="auth-form" onSubmit={(event) => void submit(event)}>
                  <button type="submit" className="auth-submit" disabled={busy}>{busy ? "Checking account…" : "Initialize super administrator"}</button>
                </form>}
            <p className="auth-back-link"><Link href="/dashboard">Return to account</Link></p>
          </>
        )}
      </section>
    </div>
  </main>;
}
