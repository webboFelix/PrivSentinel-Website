"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
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
  Trash2,
  UserRound,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { TestimonialForm } from "@/components/testimonial-form";
import { DottedLoader } from "@/components/dotted-loader";
import { useAccountDataQuery, useProfileQuery, useSaveProfileMutation, useAvatarMutation } from "@/hooks/use-profile";
import { useQueryClient } from "@tanstack/react-query";
import { clearUiPreferences, useUiPreferencesStore } from "@/stores/ui-preferences-store";
import { CountrySelect } from "@/components/country-select";
import { callingCodeForCountry } from "@/lib/countries";
import { parsePhoneNumberFromString } from "libphonenumber-js";

type DownloadEntry = { assetName: string; downloadedAt: string; version: string; releaseName: string };
type SavedPaymentMethod = { id: string; brand: string; last4: string; expiryMonth: number; expiryYear: number };
type ProfileDraft = { fullName: string; phoneNumber: string; phoneCountry: string; countryCode: string; city: string; region: string; gender: string; organization: string; currentPosition: string };

export function AccountDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const profileQuery = useProfileQuery(userId);
  const historyQuery = useAccountDataQuery<{ history: DownloadEntry[] }>(userId, "/api/downloads/history");
  const paymentMethodsQuery = useAccountDataQuery<{ configured: boolean; paymentMethods: SavedPaymentMethod[] }>(userId, "/api/billing/payment-methods");
  const saveProfileMutation = useSaveProfileMutation(userId ?? "");
  const avatarMutation = useAvatarMutation(userId ?? "");
  const [profileDraft, setProfileDraft] = useState<Partial<ProfileDraft>>({});
  const profile = profileQuery.data?.profile ?? null;
  const avatar = profileQuery.data?.avatar ?? null;
  const history = historyQuery.data?.history ?? [];
  const paymentMethods = paymentMethodsQuery.data?.paymentMethods ?? [];
  const billingConfigured = paymentMethodsQuery.data?.configured ?? null;
  const loading = isPending || profileQuery.isPending || historyQuery.isPending;
  const accountRole = profileQuery.data?.role ?? "user";
  const accountStatus = profileQuery.data?.status ?? "active";
  const saving = saveProfileMutation.isPending;
  const avatarSaving = avatarMutation.isPending;
  const fullName = profileDraft.fullName ?? profile?.fullName ?? session?.user.name ?? "";
  const phoneCountry = profileDraft.phoneCountry ?? profile?.phoneCountry ?? parsePhoneNumberFromString(profile?.phoneNumber ?? "")?.country ?? "";
  const phoneNumber = profileDraft.phoneNumber ?? (profile?.phoneNumber
    ? parsePhoneNumberFromString(profile.phoneNumber)?.formatNational() ?? profile.phoneNumber
    : "");
  const countryCode = profileDraft.countryCode ?? profile?.countryCode ?? "";
  const city = profileDraft.city ?? profile?.city ?? "";
  const region = profileDraft.region ?? profile?.region ?? "";
  const gender = profileDraft.gender ?? profile?.gender ?? "";
  const organization = profileDraft.organization ?? profile?.organization ?? "";
  const currentPosition = profileDraft.currentPosition ?? profile?.currentPosition ?? "";
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [billingNotice, setBillingNotice] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const paymentConfirmStarted = useRef(false);
  const navigationDensity = useUiPreferencesStore((state) => state.navigationDensity);
  const toggleNavigationDensity = useUiPreferencesStore((state) => state.toggleNavigationDensity);
  const requestError = error || profileQuery.error?.message || historyQuery.error?.message || "";
  const paymentStatus = searchParams.get("payment");
  const paymentSessionId = searchParams.get("session_id");
  const visibleBillingError = billingError || (paymentStatus === "success" && !paymentSessionId
    ? "The secure card setup session was missing. Please try adding your card again."
    : "");
  const visibleBillingNotice = billingNotice || (paymentStatus === "cancelled" ? "Card setup was cancelled. No card was saved." : "");

  function updateProfileDraft<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setProfileDraft((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/login?next=%2Fdashboard");
    }
  }, [isPending, router, session]);

  useEffect(() => {
    if (!session) return;
    if (paymentStatus === "cancelled") {
      router.replace("/account");
    } else if (paymentStatus === "success") {
      if (paymentConfirmStarted.current) return;
      if (!paymentSessionId) return;
      paymentConfirmStarted.current = true;
      void fetch("/api/billing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: paymentSessionId }),
      }).then(async (response) => {
        const result = await response.json() as { error?: string; paymentMethod?: SavedPaymentMethod };
        if (!response.ok || !result.paymentMethod) throw new Error(result.error || "Card verification could not be confirmed.");
        await queryClient.invalidateQueries({ queryKey: ["account-data", "/api/billing/payment-methods", userId] });
        setBillingNotice("Your card was verified and saved securely.");
        router.replace("/account?payment=saved");
      }).catch((confirmationError: unknown) => {
        setBillingError(confirmationError instanceof Error ? confirmationError.message : "The card setup could not be confirmed. Please try again.");
      });
    }
  }, [paymentSessionId, paymentStatus, queryClient, router, session, userId]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    try {
      await saveProfileMutation.mutateAsync({
        fullName,
        phoneNumber,
        phoneCountry,
        countryCode,
        city,
        region,
        gender,
        organization,
        currentPosition,
      });
      setProfileDraft({});
      setNotice("Your profile has been saved. Downloads are now enabled.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your profile. Check your connection and try again.");
    }
  }

  async function saveAvatar(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 1024 * 1024) {
      setError("Choose a PNG, JPEG, or WebP image up to 1 MB.");
      return;
    }
    setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const image = `data:${file.type};base64,${btoa(binary)}`;
      await avatarMutation.mutateAsync(image);
      setNotice("Your profile photo has been updated.");
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : "Avatar could not be saved. Try again.");
    }
  }

  async function removeAvatar() {
    setError("");
    try {
      await avatarMutation.mutateAsync(null);
      setNotice("Your profile photo has been removed.");
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : "Avatar could not be removed. Try again.");
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
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Could not sign out. Please try again.");
        return;
      }
      queryClient.removeQueries({ queryKey: ["profile"] });
      queryClient.removeQueries({ queryKey: ["account-data"] });
      router.push("/");
    } catch {
      setError("Could not sign out. Please try again.");
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE") return;
    setError("");
    setDeletingAccount(true);
    try {
      const result = await authClient.deleteUser({}, {
        headers: { "x-account-delete-confirmation": "DELETE" },
      });
      if (result.error) throw new Error(result.error.message || "Account deletion could not be completed.");
      queryClient.clear();
      clearUiPreferences();
      setDeleteDialogOpen(false);
      router.replace("/");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Account deletion could not be completed. Try again.");
      setDeletingAccount(false);
    }
  }

  if (isPending || !session) {
    return <main className="account-page"><div className="account-loading"><DottedLoader label="Loading your account…" /></div></main>;
  }

  return (
    <main className="account-page">
      <header className="account-header">
        <Link className="account-brand" href="/"><Image className="account-brand-logo" src="/PrivSentinel.png" alt="" width={40} height={40} /><span className="brand-name">Priv<span>Sentinel</span></span></Link>
        <div className="account-header-actions"><button className="account-density-toggle" type="button" onClick={toggleNavigationDensity}>{navigationDensity === "compact" ? "Standard navigation" : "Compact navigation"}</button><button className="account-logout" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button></div>
      </header>
      <div className="account-main">
        <Link className="account-back" href="/"><ArrowLeft size={14} /> Back to home</Link>
        <div className="account-welcome"><div><span className="section-kicker">ACCOUNT OVERVIEW</span><h1>Welcome back, {profile?.fullName || session.user.name?.split(" ")[0] || "there"}.</h1><p>Manage your PrivSentinel account and protected downloads.</p><div className="account-badges">{accountRole !== "user" && <span>Role: {accountRole.replace("_", " ")}</span>}<span className={`admin-status is-${accountStatus}`}>Status: {accountStatus}</span>{(accountRole === "admin" || accountRole === "super_admin") && <Link href="/admin">Open administration</Link>}</div></div><div className="account-shield">{avatar ? <Image className="account-avatar-image" src={avatar} alt="Your profile avatar" width={53} height={53} unoptimized /> : <ShieldCheck size={26} />}</div></div>
        {!loading && (!profile?.phoneNumber || !profile.gender || !profile.countryCode) && <div className="profile-required" role="status"><ShieldCheck size={17} /> Add your country, phone number, and gender to complete your profile and enable downloads.</div>}
        {requestError && <p className="account-message error" role="alert">{requestError}</p>}
        {notice && <p className="account-message success" role="status"><CheckCircle2 size={16} /> {notice}</p>}
        {loading ? <div className="account-loading"><DottedLoader label="Loading account details…" /></div> : (
          <div className="account-grid">
            <section className="account-panel profile-panel">
              <div className="account-panel-heading"><span className="account-panel-icon"><UserRound size={18} /></span><div><h2>Personal information</h2><p>Your profile and contact details</p></div></div>
              <div className="account-detail"><span>Account email</span><strong>{session.user.email}</strong></div>
              <div className="avatar-editor">
                <div className="avatar-preview">{avatar ? <Image src={avatar} alt="Current profile avatar" width={64} height={64} unoptimized /> : <span>{(fullName || session.user.name || "U").slice(0, 1).toUpperCase()}</span>}</div>
                <div><strong>Profile photo</strong><small>PNG, JPEG, or WebP · up to 1 MB</small><label className="avatar-upload-button">{avatarSaving ? "Saving photo…" : avatar ? "Change photo" : "Choose photo"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={avatarSaving} onChange={(event) => { void saveAvatar(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>{avatar && <button className="avatar-remove-button" type="button" disabled={avatarSaving} onClick={() => void removeAvatar()}>Remove</button>}</div>
              </div>
              <form className="profile-form" onSubmit={(event) => void saveProfile(event)}>
                <label>Full name<input required minLength={2} maxLength={100} value={fullName} onChange={(event) => updateProfileDraft("fullName", event.target.value)} autoComplete="name" /></label>
                <label>Country<CountrySelect value={countryCode} required autoComplete="country" onChange={(value) => updateProfileDraft("countryCode", value)} /></label>
                <div className="phone-number-field">
                  <label>Phone country code<CountrySelect value={phoneCountry} phoneCode required autoComplete="tel-country-code" onChange={(value) => updateProfileDraft("phoneCountry", value)} /></label>
                  <label>Phone number<input required type="tel" value={phoneNumber} onChange={(event) => updateProfileDraft("phoneNumber", event.target.value)} placeholder={`${callingCodeForCountry(phoneCountry)} 712 345 678`} autoComplete="tel-national" /></label>
                </div>
                {profile?.gender ? <div className="saved-profile-value"><strong>Gender</strong><span>{profile.gender[0].toUpperCase() + profile.gender.slice(1)}</span></div> : <fieldset className="gender-options" aria-describedby="account-gender-required"><legend>Gender <span className="gender-required">Required</span></legend>{(["male", "female", "other"] as const).map((option) => <label key={option}><input type="radio" name="gender" value={option} required checked={gender === option} onChange={() => updateProfileDraft("gender", option)} /> {option[0].toUpperCase() + option.slice(1)}</label>)}<small id="account-gender-required">Select an option to complete your profile.</small></fieldset>}
                <label>City <span className="optional-label">(optional)</span><input maxLength={100} value={city} onChange={(event) => updateProfileDraft("city", event.target.value)} placeholder="City or town" autoComplete="address-level2" /></label>
                <label>State or region <span className="optional-label">(optional)</span><input maxLength={100} value={region} onChange={(event) => updateProfileDraft("region", event.target.value)} placeholder="State, province, or region" autoComplete="address-level1" /></label>
                <label>Organization <span className="optional-label">(optional)</span><input maxLength={150} value={organization} onChange={(event) => updateProfileDraft("organization", event.target.value)} placeholder="Company or organization" autoComplete="organization" /></label>
                <label>Current position <span className="optional-label">(optional)</span><input maxLength={150} value={currentPosition} onChange={(event) => updateProfileDraft("currentPosition", event.target.value)} placeholder="Your role or position" autoComplete="organization-title" /></label>
                <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"} <CheckCircle2 size={16} /></button>
              </form>
              <div className="account-detail account-date"><span><CalendarDays size={14} /> Registered</span><strong>{new Date(session.user.createdAt).toLocaleDateString()}</strong></div>
            </section>
            <section className="account-panel downloads-panel">
              <div className="account-panel-heading"><span className="account-panel-icon"><Download size={18} /></span><div><h2>Protected downloads</h2><p>Latest stable Windows installer</p></div></div>
              <div className="download-callout"><span className="download-callout-icon"><ArrowDownToLine size={20} /></span><div><strong>PrivSentinel for Windows</strong><small>Windows 10 / 11 · Stable channel</small></div><span className="download-status">ACCOUNT<br />VERIFIED</span></div>
              {profile?.phoneNumber && profile.gender && profile.countryCode ? <a className="download-button account-download" href="/api/downloads/latest"><ArrowDownToLine size={17} /> Download latest installer</a> : <button className="download-button account-download" disabled><ArrowDownToLine size={17} /> Complete profile to download</button>}
              <div id="download-history" className="account-panel-heading history-heading"><span className="account-panel-icon"><Clock3 size={18} /></span><div><h2>Download history</h2><p>Your recent installer activity</p></div></div>
              {history.length === 0 ? <p className="history-empty">No downloads yet. Your downloaded releases will appear here.</p> : <ul className="download-history">{history.map((item, index) => <li key={`${item.downloadedAt}-${index}`}><span><strong>{item.version}</strong><small>{item.assetName}</small></span><time>{new Date(item.downloadedAt).toLocaleDateString()}</time></li>)}</ul>}
            </section>
          </div>
        )}
        {!loading && <TestimonialForm />}
        {!loading && <section className="account-panel account-security-panel">
          <div className="account-panel-heading"><span className="account-panel-icon"><ShieldCheck size={18} /></span><div><h2>Security settings</h2><p>Review and update your sign-in security</p></div></div>
          <div className="account-detail"><span>Account status</span><strong>{accountStatus}</strong></div>
          <div className="account-detail"><span>Authentication</span><strong>{session.user.email}</strong></div>
          <p className="billing-security-note">To change or reset your password, use the verified email flow. Google sign-in accounts can continue managing access through their Google account.</p>
          <Link className="admin-secondary-button" href="/forgot-password">Reset password</Link>
        </section>}
        {!loading && <section id="billing" className="account-panel billing-panel">
          <div className="account-panel-heading"><span className="account-panel-icon"><CreditCard size={18} /></span><div><h2>Billing cards</h2><p>Verify and save a Visa or other supported card</p></div></div>
          <p className="billing-security-note">Card details are entered on Stripe’s secure page. PrivSentinel never receives or stores your card number or security code. Adding a card does not charge it.</p>
          {visibleBillingError && <p className="account-message error" role="alert">{visibleBillingError}</p>}
          {paymentMethodsQuery.error && <p className="account-message error" role="alert">{paymentMethodsQuery.error.message || "Saved payment methods could not be loaded."}</p>}
          {visibleBillingNotice && <p className="account-message success" role="status"><CheckCircle2 size={16} /> {visibleBillingNotice}</p>}
          {paymentMethods.length > 0 && <ul className="saved-cards">{paymentMethods.map((method) => <li key={method.id}><span className="saved-card-icon"><CreditCard size={19} /></span><span className="saved-card-brand">{method.brand.toUpperCase()} <strong>•••• {method.last4}</strong></span><span className="saved-card-expiry">Expires {String(method.expiryMonth).padStart(2, "0")}/{method.expiryYear}</span></li>)}</ul>}
          {billingConfigured === false && <p className="billing-unavailable">Card verification is not configured yet. Add STRIPE_SECRET_KEY to the server-side .env file to enable it.</p>}
          <button className="auth-submit billing-add-button" type="button" disabled={!billingConfigured || billingBusy} onClick={() => void addPaymentCard()}>{billingBusy ? "Opening secure card setup…" : <><Plus size={16} /> Add a card securely</>}</button>
        </section>}
        {!loading && <section className="account-panel account-delete-panel">
          <div className="account-panel-heading"><span className="account-panel-icon"><Trash2 size={18} /></span><div><h2>Delete account</h2><p>Permanently remove your account and personal data</p></div></div>
          <p>Deletion removes your profile, sign-in accounts and sessions, downloads, saved payment details, reviews, audit entries, and profile image. This cannot be undone.</p>
          {!deleteDialogOpen ? (
            <button className="account-delete-button" type="button" onClick={() => setDeleteDialogOpen(true)}>Delete my account</button>
          ) : (
            <div className="account-delete-confirmation" role="group" aria-labelledby="delete-account-heading">
              <strong id="delete-account-heading">Confirm permanent deletion</strong>
              <p>Type <b>DELETE</b> to continue. Your account will be removed immediately after confirmation.</p>
              <label htmlFor="delete-account-confirmation">Confirmation</label>
              <input
                id="delete-account-confirmation"
                autoComplete="off"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
              <div className="account-delete-actions">
                <button type="button" disabled={deletingAccount} onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmation(""); }}>Cancel</button>
                <button type="button" disabled={deleteConfirmation !== "DELETE" || deletingAccount} onClick={() => void deleteAccount()}>
                  {deletingAccount ? "Deleting account…" : "Permanently delete"}
                </button>
              </div>
            </div>
          )}
        </section>}
        <p className="account-privacy">Your country, phone number, and gender complete your account profile. Gender, organization, current position, and profile photo are not shown publicly; city, region, organization, and current position are optional.</p>
      </div>
    </main>
  );
}
