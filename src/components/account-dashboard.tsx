"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  LogOut,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Profile = {
  fullName: string;
  phoneNumber: string | null;
  gender: "male" | "female" | "other" | null;
  organization: string | null;
  currentPosition: string | null;
  createdAt: string;
};
type DownloadEntry = { assetName: string; downloadedAt: string; version: string; releaseName: string };
type SavedPaymentMethod = { id: string; brand: string; last4: string; expiryMonth: number; expiryYear: number };

export function AccountDashboard() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<DownloadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gender, setGender] = useState("");
  const [organization, setOrganization] = useState("");
  const [currentPosition, setCurrentPosition] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [billingConfigured, setBillingConfigured] = useState<boolean | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [billingNotice, setBillingNotice] = useState("");

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/login?next=%2Fdashboard");
      return;
    }

    const query = new URLSearchParams(window.location.search);
    void Promise.all([
      fetch("/api/profile").then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load your profile."))),
      fetch("/api/downloads/history").then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load download history."))),
      fetch("/api/billing/payment-methods").then(async (response) => {
        const data = await response.json() as { configured?: boolean; paymentMethods?: SavedPaymentMethod[] };
        if (!response.ok) throw new Error("Saved payment methods could not be loaded.");
        return data;
      }).catch(() => {
        setBillingError("Saved payment methods could not be loaded. Refresh the page to try again.");
        return { configured: null, paymentMethods: [] };
      }),
    ]).then(async ([profileData, historyData, billingData]) => {
      const current = (profileData as { profile: Profile | null }).profile;
      setProfile(current);
      setFullName(current?.fullName ?? session.user.name ?? "");
      setPhoneNumber(current?.phoneNumber ?? "");
      setGender(current?.gender ?? "");
      setOrganization(current?.organization ?? "");
      setCurrentPosition(current?.currentPosition ?? "");
      setAvatar((profileData as { avatar?: string | null }).avatar ?? null);
      setHistory((historyData as { history: DownloadEntry[] }).history);
      setBillingConfigured(typeof billingData.configured === "boolean" ? billingData.configured : null);
      setPaymentMethods(billingData.paymentMethods ?? []);
      if (query.get("payment") === "success") {
        const sessionId = query.get("session_id");
        if (!sessionId) {
          setBillingError("The secure card setup session was missing. Please try adding your card again.");
        } else {
          try {
            const response = await fetch("/api/billing/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }),
            });
            const result = await response.json() as { error?: string; paymentMethod?: SavedPaymentMethod };
            if (!response.ok || !result.paymentMethod) throw new Error(result.error || "Card verification could not be confirmed.");
            setPaymentMethods((currentMethods) => [
              ...currentMethods.filter((method) => method.id !== result.paymentMethod!.id),
              result.paymentMethod!,
            ]);
            setBillingNotice("Your card was verified and saved securely.");
            router.replace("/account?payment=saved");
          } catch (confirmationError) {
            setBillingError(confirmationError instanceof Error ? confirmationError.message : "The card setup could not be confirmed. Please try again.");
          }
        }
      } else if (query.get("payment") === "cancelled") {
        setBillingNotice("Card setup was cancelled. No card was saved.");
        router.replace("/account");
      }
    }).catch(() => {
      setError("Account information could not be loaded. Refresh the page to try again.");
    }).finally(() => setLoading(false));
  }, [isPending, router, session]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phoneNumber, gender, organization, currentPosition }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Profile could not be saved.");
        return;
      }
      const refreshed = await fetch("/api/profile");
      if (refreshed.ok) {
        const result = await refreshed.json() as { profile: Profile | null };
        setProfile(result.profile);
        setPhoneNumber(result.profile?.phoneNumber ?? "");
        setFullName(result.profile?.fullName ?? fullName);
        setGender(result.profile?.gender ?? "");
        setOrganization(result.profile?.organization ?? "");
        setCurrentPosition(result.profile?.currentPosition ?? "");
      }
      setNotice("Your profile has been saved. Downloads are now enabled.");
    } catch {
      setError("Could not save your profile. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAvatar(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Choose a PNG, JPEG, or WebP image up to 5 MB.");
      return;
    }
    setAvatarSaving(true);
    setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const image = `data:${file.type};base64,${btoa(binary)}`;
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const result = await response.json() as { image?: string; error?: string };
      if (!response.ok || !result.image) throw new Error(result.error || "Avatar could not be saved.");
      setAvatar(result.image);
      setNotice("Your profile photo has been updated.");
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : "Avatar could not be saved. Try again.");
    } finally {
      setAvatarSaving(false);
    }
  }

  async function removeAvatar() {
    setAvatarSaving(true);
    setError("");
    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: null }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Avatar could not be removed.");
      setAvatar(null);
      setNotice("Your profile photo has been removed.");
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : "Avatar could not be removed. Try again.");
    } finally {
      setAvatarSaving(false);
    }
  }

  async function addPaymentCard() {
    setBillingBusy(true);
    setBillingError("");
    setBillingNotice("");
    try {
      const response = await fetch("/api/billing/setup", { method: "POST" });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Card setup could not be started.");
      window.location.assign(result.url);
    } catch (billingSetupError) {
      setBillingError(billingSetupError instanceof Error ? billingSetupError.message : "Card setup could not be started.");
      setBillingBusy(false);
    }
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/");
  }

  if (isPending || !session) {
    return <main className="account-page"><div className="account-loading"><span className="loading-dot" /> Loading your account…</div></main>;
  }

  return (
    <main className="account-page">
      <header className="account-header">
        <Link className="account-brand" href="/"><Image className="account-brand-logo" src="/PrivSentinel.png" alt="" width={40} height={40} /><span className="brand-name">Priv<span>Sentinel</span></span></Link>
        <button className="account-logout" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button>
      </header>
      <div className="account-main">
        <Link className="account-back" href="/"><ArrowLeft size={14} /> Back to home</Link>
        <div className="account-welcome"><div><span className="section-kicker">ACCOUNT OVERVIEW</span><h1>Welcome back, {profile?.fullName || session.user.name?.split(" ")[0] || "there"}.</h1><p>Manage your PrivSentinel account and protected downloads.</p></div><div className="account-shield">{avatar ? <Image className="account-avatar-image" src={avatar} alt="Your profile avatar" width={53} height={53} unoptimized /> : <ShieldCheck size={26} />}</div></div>
        {!loading && (!profile?.phoneNumber || !profile.gender) && <div className="profile-required" role="status"><ShieldCheck size={17} /> Add your phone number and select your gender to complete your profile and enable downloads.</div>}
        {error && <p className="account-message error" role="alert">{error}</p>}
        {notice && <p className="account-message success" role="status"><CheckCircle2 size={16} /> {notice}</p>}
        {loading ? <div className="account-loading"><span className="loading-dot" /> Loading account details…</div> : (
          <div className="account-grid">
            <section className="account-panel profile-panel">
              <div className="account-panel-heading"><span className="account-panel-icon"><UserRound size={18} /></span><div><h2>Personal information</h2><p>Your profile and contact details</p></div></div>
              <div className="account-detail"><span>Account email</span><strong>{session.user.email}</strong></div>
              <div className="avatar-editor">
                <div className="avatar-preview">{avatar ? <Image src={avatar} alt="Current profile avatar" width={64} height={64} unoptimized /> : <span>{(fullName || session.user.name || "U").slice(0, 1).toUpperCase()}</span>}</div>
                <div><strong>Profile photo</strong><small>PNG, JPEG, or WebP · up to 5 MB</small><label className="avatar-upload-button">{avatarSaving ? "Saving photo…" : avatar ? "Change photo" : "Choose photo"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={avatarSaving} onChange={(event) => { void saveAvatar(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>{avatar && <button className="avatar-remove-button" type="button" disabled={avatarSaving} onClick={() => void removeAvatar()}>Remove</button>}</div>
              </div>
              <form className="profile-form" onSubmit={(event) => void saveProfile(event)}>
                <label>Full name<input required minLength={2} maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></label>
                <label>Phone number<input required type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+254 712 345 678" autoComplete="tel" /></label>
                {profile?.gender ? <div className="saved-profile-value"><strong>Gender</strong><span>{profile.gender[0].toUpperCase() + profile.gender.slice(1)}</span></div> : <fieldset className="gender-options" aria-describedby="account-gender-required"><legend>Gender <span className="gender-required">Required</span></legend>{(["male", "female", "other"] as const).map((option) => <label key={option}><input type="radio" name="gender" value={option} required checked={gender === option} onChange={() => setGender(option)} /> {option[0].toUpperCase() + option.slice(1)}</label>)}<small id="account-gender-required">Select an option to complete your profile.</small></fieldset>}
                <label>Organization <span className="optional-label">(optional)</span><input maxLength={150} value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Company or organization" autoComplete="organization" /></label>
                <label>Current position <span className="optional-label">(optional)</span><input maxLength={150} value={currentPosition} onChange={(event) => setCurrentPosition(event.target.value)} placeholder="Your role or position" autoComplete="organization-title" /></label>
                <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"} <CheckCircle2 size={16} /></button>
              </form>
              <div className="account-detail account-date"><span><CalendarDays size={14} /> Registered</span><strong>{new Date(session.user.createdAt).toLocaleDateString()}</strong></div>
            </section>
            <section className="account-panel downloads-panel">
              <div className="account-panel-heading"><span className="account-panel-icon"><Download size={18} /></span><div><h2>Protected downloads</h2><p>Latest stable Windows installer</p></div></div>
              <div className="download-callout"><span className="download-callout-icon"><ArrowDownToLine size={20} /></span><div><strong>PrivSentinel for Windows</strong><small>Windows 10 / 11 · Stable channel</small></div><span className="download-status">ACCOUNT<br />VERIFIED</span></div>
              {profile?.phoneNumber && profile.gender ? <a className="download-button account-download" href="/api/downloads/latest"><ArrowDownToLine size={17} /> Download latest installer</a> : <button className="download-button account-download" disabled><ArrowDownToLine size={17} /> Complete profile to download</button>}
              <div className="account-panel-heading history-heading"><span className="account-panel-icon"><Clock3 size={18} /></span><div><h2>Download history</h2><p>Your recent installer activity</p></div></div>
              {history.length === 0 ? <p className="history-empty">No downloads yet. Your downloaded releases will appear here.</p> : <ul className="download-history">{history.map((item, index) => <li key={`${item.downloadedAt}-${index}`}><span><strong>{item.version}</strong><small>{item.assetName}</small></span><time>{new Date(item.downloadedAt).toLocaleDateString()}</time></li>)}</ul>}
            </section>
          </div>
        )}
        {!loading && <section className="account-panel billing-panel">
          <div className="account-panel-heading"><span className="account-panel-icon"><CreditCard size={18} /></span><div><h2>Billing cards</h2><p>Verify and save a Visa or other supported card</p></div></div>
          <p className="billing-security-note">Card details are entered on Stripe’s secure page. PrivSentinel never receives or stores your card number or security code. Adding a card does not charge it.</p>
          {billingError && <p className="account-message error" role="alert">{billingError}</p>}
          {billingNotice && <p className="account-message success" role="status"><CheckCircle2 size={16} /> {billingNotice}</p>}
          {paymentMethods.length > 0 && <ul className="saved-cards">{paymentMethods.map((method) => <li key={method.id}><span className="saved-card-icon"><CreditCard size={19} /></span><span className="saved-card-brand">{method.brand.toUpperCase()} <strong>•••• {method.last4}</strong></span><span className="saved-card-expiry">Expires {String(method.expiryMonth).padStart(2, "0")}/{method.expiryYear}</span></li>)}</ul>}
          {billingConfigured === false && <p className="billing-unavailable">Card verification is not configured yet. Add STRIPE_SECRET_KEY to the server-side .env file to enable it.</p>}
          <button className="auth-submit billing-add-button" type="button" disabled={!billingConfigured || billingBusy} onClick={() => void addPaymentCard()}>{billingBusy ? "Opening secure card setup…" : <><Plus size={16} /> Add a card securely</>}</button>
        </section>}
        <p className="account-privacy">Your phone number and gender complete your account profile. Gender, organization, current position, and profile photo are not shown publicly; organization and current position are optional.</p>
      </div>
    </main>
  );
}
