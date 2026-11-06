"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, ExternalLink, Mail, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const publicPhoneNumber = "+254702803400";

export function ContactPage({ supportEmail, linkedInUrl }: {
  supportEmail?: string;
  linkedInUrl?: string;
}) {
  const { data: session } = authClient.useSession();
  const [name, setName] = useState<string>();
  const [email, setEmail] = useState<string>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const contactName = name ?? session?.user?.name ?? "";
  const contactEmail = email ?? session?.user?.email ?? "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: contactName, email: contactEmail, message }),
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok && response.status !== 202) {
        setError(result.error || "Your message could not be sent. Please try again.");
      } else {
        setNotice(result.message || "Your message was sent to the PrivSentinel team.");
        setMessage("");
      }
    } catch {
      setError("Could not reach the contact service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="route-page contact-route">
    <header className="route-intro">
      <span className="route-eyebrow">CONTACT PRIVSENTINEL</span>
      <h1>How can we help?</h1>
      <p>Send the team a message or reach us through one of our configured contact channels.</p>
    </header>
    <div className="contact-grid">
      <section className="route-panel contact-channels">
        <h2>Other ways to reach us</h2>
        <a href={`https://wa.me/${publicPhoneNumber.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
          <span><MessageCircle size={19} /></span><span><strong>WhatsApp</strong><small>{publicPhoneNumber}</small></span><ArrowRight size={16} />
        </a>
        <a href={`tel:${publicPhoneNumber}`}>
          <span><Phone size={19} /></span><span><strong>Phone call</strong><small>{publicPhoneNumber}</small></span><ArrowRight size={16} />
        </a>
        {supportEmail
          ? <a href={`mailto:${supportEmail}`}><span><Mail size={19} /></span><span><strong>Email</strong><small>{supportEmail}</small></span><ArrowRight size={16} /></a>
          : <div className="contact-channel-disabled"><span><Mail size={19} /></span><span><strong>Email</strong><small>Direct email is not configured</small></span></div>}
        {linkedInUrl
          ? <a href={linkedInUrl} target="_blank" rel="noreferrer"><span><ExternalLink size={19} /></span><span><strong>LinkedIn</strong><small>Visit our LinkedIn page</small></span><ArrowRight size={16} /></a>
          : <div className="contact-channel-disabled"><span><ExternalLink size={19} /></span><span><strong>LinkedIn</strong><small>LinkedIn page is not configured</small></span></div>}
        <p><ShieldCheck size={15} /> Never include passwords, verification links, or payment details in a message.</p>
      </section>
      <section className="route-panel contact-form-panel">
        <h2><Mail size={18} /> Send us a message</h2>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label>Your name<input autoComplete="name" required minLength={2} maxLength={100} value={contactName} onChange={(event) => setName(event.target.value)} /></label>
          <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={contactEmail} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Message<textarea required minLength={10} maxLength={5000} rows={7} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="How can we help?" /></label>
          {error && <p className="auth-message error" role="alert">{error}</p>}
          {notice && <p className="auth-message success" role="status">{notice}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Sending…" : "Send message"} <ArrowRight size={16} /></button>
        </form>
      </section>
    </div>
  </main>;
}
