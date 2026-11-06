"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, MailCheck, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { emailSchema, passwordSchema, registrationSchema } from "@/lib/validation";
import { CountrySelect } from "@/components/country-select";
import { callingCodeForCountry } from "@/lib/countries";

function safeNextPath() {
  const requested = new URLSearchParams(window.location.search).get("next");
  if (!requested || !requested.startsWith("/") || requested.startsWith("//") || requested.includes("\\")) {
    return "/dashboard";
  }
  return requested;
}

function googleSignInError(error: unknown) {
  if (error instanceof TypeError) {
    return "Could not reach Google sign-in. Check your connection and try again.";
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = error.status;
    if (status === 429) return "Google sign-in is temporarily rate-limited. Please wait a moment and try again.";
    if (typeof status === "number" && status >= 500) return "Google sign-in is temporarily unavailable. Please try again later.";
    if (status === 401 || status === 403) return "Google rejected the sign-in request. Check the OAuth configuration or choose another sign-in method.";
  }
  return "Google sign-in could not be started. Please try again or use email and password.";
}

function registrationError(error: { status?: number; message?: string }) {
  if (error.status === 503) {
    return "Registration is temporarily unavailable. Please contact the site administrator.";
  }
  if (error.status === 403) {
    return "Sign-up was blocked because this site URL is not trusted. Use the configured app URL or update BETTER_AUTH_URL to match it.";
  }
  return error.message || "Account creation failed. Check your details and try again.";
}

function signInError(error: { code?: string; status?: number }) {
  if (error.code === "IP_BLOCKED") {
    return "Sign-in from this network has been blocked after repeated failed attempts. Contact support if you believe this is a mistake.";
  }
  if (error.code === "EMAIL_NOT_VERIFIED") {
    return "Verify your email before signing in. If the address and password are correct, a new verification link has been sent.";
  }
  if (error.status === 429) {
    return "Too many sign-in attempts. Wait a moment before trying again.";
  }
  if (typeof error.status === "number" && error.status >= 500) {
    return "Sign-in is temporarily unavailable. Please try again shortly.";
  }
  if (error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD" || error.code === "INVALID_PASSWORD") {
    return "Email or password is incorrect. Please check your details and try again.";
  }
  return "We could not complete sign-in. Please check your connection and try again.";
}

const verificationEmailStorageKey = "privsentinel-verification-email";
const verificationCallbackStorageKey = "privsentinel-verification-callback";
const verificationResendAfterStorageKey = "privsentinel-verification-resend-after";
const verificationResendCooldownSeconds = 60;

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function retryAfterFromError(message: string) {
  const seconds = message.match(/Try again in (\d+) seconds?\./i)?.[1];
  return seconds ? Number(seconds) : null;
}

function AuthShell({ children, eyebrow, title, description, authAvailable = true }: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  authAvailable?: boolean;
}) {
  return (
    <main className="auth-page">
      <div className="auth-backdrop" />
      <div className="auth-wrap">
        <Link className="auth-brand" href="/"><Image className="auth-brand-logo" src="/PrivSentinel.png" alt="" width={42} height={42} loading="eager" /><span className="brand-name">Priv<span>Sentinel</span></span></Link>
        <section className="auth-card">
          <div className="auth-card-mark"><ShieldCheck size={24} /></div>
          <span className="auth-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {!authAvailable && <p className="auth-message error" role="status">Sign-in and registration are temporarily unavailable. Please contact the site administrator.</p>}
          {children}
          <div className="auth-trust"><ShieldCheck size={14} /> Your account information is protected</div>
        </section>
        <Link className="auth-back-link" href="/"><ArrowLeft size={14} /> Back to PrivSentinel</Link>
      </div>
    </main>
  );
}

export function RegisterPage({ authAvailable, googleConfigured }: { authAvailable: boolean; googleConfigured: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState({ fullName: "", email: "", phoneNumber: "", phoneCountry: "", countryCode: "", gender: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [emailVerificationPending, setEmailVerificationPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [googleError, setGoogleError] = useState("");
  const emailHasInput = values.email.trim().length > 0;
  const emailIsValid = emailSchema.safeParse(values.email).success;
  const passwordChecks = [
    { label: "12–128 characters", passed: values.password.length >= 12 && values.password.length <= 128 },
    { label: "A lowercase letter", passed: /[a-z]/.test(values.password) },
    { label: "An uppercase letter", passed: /[A-Z]/.test(values.password) },
    { label: "A number", passed: /\d/.test(values.password) },
    { label: "A symbol", passed: /[^A-Za-z0-9]/.test(values.password) },
  ];
  const passedPasswordChecks = passwordChecks.filter((check) => check.passed).length;
  const passwordStrength = passedPasswordChecks === passwordChecks.length
    ? "strong"
    : passedPasswordChecks >= 3
      ? "fair"
      : "weak";

  useEffect(() => {
    if (!authAvailable || new URLSearchParams(window.location.search).get("provider") !== "google") return;
    if (!googleConfigured) return;
    const next = new URLSearchParams(window.location.search).get("next");
    const destination = `/account?completeProfile=1${next ? `&next=${encodeURIComponent(safeNextPath())}` : ""}`;
    void authClient.signIn.social({ provider: "google", callbackURL: destination })
      .then((result) => {
        if (result.error) setGoogleError(googleSignInError(result.error));
      })
      .catch((error: unknown) => setGoogleError(googleSignInError(error)));
  }, [authAvailable, googleConfigured]);

  async function continueWithGoogle() {
    if (!authAvailable) return;
    if (!googleConfigured) {
      setGoogleError("Google sign-in is not available at the moment. Create your account with email and password instead.");
      return;
    }
    setError("");
    setGoogleError("");
    setBusy(true);
    const next = new URLSearchParams(window.location.search).get("next");
    const destination = `/account?completeProfile=1${next ? `&next=${encodeURIComponent(safeNextPath())}` : ""}`;
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: destination });
      if (result.error) {
        setGoogleError(googleSignInError(result.error));
        setBusy(false);
      }
    } catch (error: unknown) {
      setGoogleError(googleSignInError(error));
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authAvailable) return;
    setError("");
    setFieldErrors({});
    if (values.password !== values.confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match." });
      return;
    }
    const parsed = registrationSchema.safeParse({
      fullName: values.fullName,
      email: values.email,
      phoneNumber: values.phoneNumber,
      phoneCountry: values.phoneCountry,
      countryCode: values.countryCode,
      gender: values.gender,
      password: values.password,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        errors[key] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setBusy(true);
    setNotice("");
    let result: Awaited<ReturnType<typeof authClient.signUp.email>>;
    const callbackURL = `/account?completeProfile=1${safeNextPath() === "/dashboard" ? "" : `&next=${encodeURIComponent(safeNextPath())}`}`;
    try {
      result = await authClient.signUp.email({
        name: parsed.data.fullName,
        email: parsed.data.email,
        password: parsed.data.password,
        callbackURL,
      });
    } catch {
      setError("Could not reach the account service. Check your connection and try again.");
      setBusy(false);
      return;
    }
    if (result.error) {
      setError(registrationError(result.error));
      setBusy(false);
      return;
    }

    if (!result.data?.token || result.data.user?.emailVerified === false) {
      try {
        sessionStorage.setItem(verificationEmailStorageKey, parsed.data.email);
        sessionStorage.setItem(verificationCallbackStorageKey, callbackURL);
        sessionStorage.setItem(
          verificationResendAfterStorageKey,
          String(Date.now() + verificationResendCooldownSeconds * 1000),
        );
        router.push("/verify-email");
      } catch {
        setEmailVerificationPending(true);
        setNotice(`Check your email at ${parsed.data.email} for a verification link. If it doesn't arrive, try signing in to request another link.`);
        setBusy(false);
      }
      return;
    }

    try {
      const profileResponse = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: parsed.data.fullName,
          phoneNumber: values.phoneNumber,
          phoneCountry: values.phoneCountry,
          countryCode: values.countryCode,
          gender: parsed.data.gender,
        }),
      });
      if (!profileResponse.ok) {
        setError("Your account was created, but the profile could not be saved. Sign in and complete your profile before downloading.");
        setBusy(false);
        return;
      }
      router.push(safeNextPath());
    } catch {
      setError("Your account was created, but the profile could not be saved. Sign in and complete your profile before downloading.");
      setBusy(false);
    }
  }

  const update = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  };

  return (
    <AuthShell authAvailable={authAvailable} eyebrow="CREATE YOUR ACCOUNT" title="Start with a safer view." description="Create an account to access published Windows releases and security updates.">
      <form className="auth-form" onSubmit={submit} noValidate>
        <label>Full name<input autoComplete="name" value={values.fullName} onChange={update("fullName")} placeholder="Your full name" aria-invalid={Boolean(fieldErrors.fullName)} />{fieldErrors.fullName && <small>{fieldErrors.fullName}</small>}</label>
        <label>Email address<input type="email" autoComplete="email" value={values.email} onChange={update("email")} placeholder="you@example.com" aria-invalid={Boolean(fieldErrors.email) || (emailHasInput && !emailIsValid)} aria-describedby={emailHasInput ? "register-email-status" : undefined} />{emailHasInput && <small id="register-email-status" className={emailIsValid ? "auth-field-valid" : undefined} role="status">{emailIsValid ? "Valid email address." : "Enter a valid email address."}</small>}{fieldErrors.email && !emailHasInput && <small>{fieldErrors.email}</small>}</label>
        <fieldset className="auth-gender-options" aria-describedby={fieldErrors.gender ? "register-gender-error" : undefined}><legend>Gender <span>Required</span></legend>{(["male", "female", "other"] as const).map((option) => <label key={option}><input type="radio" name="registration-gender" value={option} required checked={values.gender === option} onChange={() => { setValues((current) => ({ ...current, gender: option })); setFieldErrors((current) => ({ ...current, gender: "" })); }} /> {option[0].toUpperCase() + option.slice(1)}</label>)}{fieldErrors.gender && <small id="register-gender-error">{fieldErrors.gender}</small>}</fieldset>
        <label>Country<CountrySelect value={values.countryCode} required autoComplete="country" onChange={(countryCode) => { setValues((current) => ({ ...current, countryCode })); setFieldErrors((current) => ({ ...current, countryCode: "" })); }} />{fieldErrors.countryCode && <small>{fieldErrors.countryCode}</small>}</label>
        <div className="phone-number-field">
          <label>Phone country code<CountrySelect value={values.phoneCountry} phoneCode required autoComplete="tel-country-code" onChange={(phoneCountry) => { setValues((current) => ({ ...current, phoneCountry })); setFieldErrors((current) => ({ ...current, phoneCountry: "", phoneNumber: "" })); }} />{fieldErrors.phoneCountry && <small>{fieldErrors.phoneCountry}</small>}</label>
          <label>Phone number<input required type="tel" autoComplete="tel-national" value={values.phoneNumber} onChange={update("phoneNumber")} placeholder={`${callingCodeForCountry(values.phoneCountry)} 712 345 678`} aria-invalid={Boolean(fieldErrors.phoneNumber)} />{fieldErrors.phoneNumber && <small>{fieldErrors.phoneNumber}</small>}</label>
        </div>
        <label>Password<span className="password-input"><input type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} value={values.password} onChange={update("password")} placeholder="At least 12 characters" aria-invalid={Boolean(fieldErrors.password)} aria-describedby="password-strength" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((show) => !show)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>{values.password && <span id="password-strength" className={`password-strength ${passwordStrength}`} aria-live="polite"><span className="password-strength-heading">Password strength: <strong>{passwordStrength[0].toUpperCase() + passwordStrength.slice(1)}</strong></span><span className="password-strength-meter" aria-hidden="true"><i /><i /><i /></span><span className="password-requirements">{passwordChecks.map((check) => <span className={check.passed ? "passed" : ""} key={check.label}>{check.passed ? "✓" : "○"} {check.label}</span>)}</span>{passwordStrength === "strong" && <span className="password-success">Password meets all requirements.</span>}</span>}{fieldErrors.password && <small>{fieldErrors.password}</small>}</label>
        <label>Confirm password<input type="password" autoComplete="new-password" value={values.confirmPassword} onChange={update("confirmPassword")} placeholder="Enter your password again" aria-invalid={Boolean(fieldErrors.confirmPassword)} />{fieldErrors.confirmPassword && <small>{fieldErrors.confirmPassword}</small>}</label>
        {error && <p className="auth-message error" role="alert">{error}</p>}
        {notice && <p className="auth-message success" role="status">{notice}</p>}
        <button className="auth-submit" type="submit" disabled={!authAvailable || busy || emailVerificationPending}>{busy ? "Creating account…" : emailVerificationPending ? "Check your email" : "Create account"} <ArrowRight size={16} /></button>
      </form>
      <div className="auth-or"><span />OR<span /></div>
      <button className="auth-google" type="button" disabled={!authAvailable || busy} onClick={() => void continueWithGoogle()}><b>G</b> {busy ? "Connecting to Google…" : "Continue with Google"}</button>
      {googleError && <p className="auth-message error" role="alert">{googleError}</p>}
      <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
      <p className="auth-privacy">Your gender selection is required to complete your account profile and is not shown publicly.</p>
    </AuthShell>
  );
}

export function VerifyEmailPage({ authAvailable }: { authAvailable: boolean }) {
  const [email, setEmail] = useState("");
  const [callbackURL, setCallbackURL] = useState("/account?completeProfile=1");
  const [secondsRemaining, setSecondsRemaining] = useState(verificationResendCooldownSeconds);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const updateCountdown = () => {
      const resendAfter = Number(sessionStorage.getItem(verificationResendAfterStorageKey));
      setSecondsRemaining(Number.isFinite(resendAfter)
        ? Math.max(0, Math.ceil((resendAfter - Date.now()) / 1000))
        : 0);
    };
    const initialize = window.setTimeout(() => {
      const storedEmail = sessionStorage.getItem(verificationEmailStorageKey);
      if (storedEmail) setEmail(storedEmail);
      setCallbackURL(sessionStorage.getItem(verificationCallbackStorageKey) ?? "/account?completeProfile=1");
      updateCountdown();
    }, 0);
    const timer = window.setInterval(updateCountdown, 1000);
    return () => {
      window.clearTimeout(initialize);
      window.clearInterval(timer);
    };
  }, []);

  async function resendVerificationEmail() {
    if (!authAvailable || !email || secondsRemaining > 0 || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const resendAfter = Date.now() + verificationResendCooldownSeconds * 1000;
    sessionStorage.setItem(verificationResendAfterStorageKey, String(resendAfter));
    setSecondsRemaining(verificationResendCooldownSeconds);

    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL,
      });
      if (result.error) {
        const retryAfter = result.error.status === 429
          ? retryAfterFromError(result.error.message ?? "")
          : null;
        if (retryAfter !== null) {
          const cooldown = Math.max(verificationResendCooldownSeconds, retryAfter);
          const nextResendAfter = Date.now() + cooldown * 1000;
          sessionStorage.setItem(verificationResendAfterStorageKey, String(nextResendAfter));
          setSecondsRemaining(cooldown);
          setError(`The verification email limit was reached. Please try again in ${formatCountdown(retryAfter)}.`);
        } else {
          setError(result.error.status === 429
            ? "Too many verification requests. Please wait before trying again."
            : "We couldn't request another verification email. Please try again shortly.");
        }
      } else {
        setNotice(`A new verification email was requested for ${email}. Check your inbox and spam folder.`);
      }
    } catch {
      setError("Could not reach the account service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      authAvailable={authAvailable}
      eyebrow="VERIFY YOUR EMAIL"
      title="Check your inbox."
      description="Verify your email address to continue and complete your PrivSentinel account."
    >
      <div className="verification-panel">
        <div className="verification-icon"><MailCheck size={24} /></div>
        {email
          ? <p>We sent a verification email to <strong>{email}</strong>. Open the link in that email to verify and continue.</p>
          : <p>Enter your email while registering to receive a verification link. If you have already registered, try signing in to request a new link.</p>}
        <p className="verification-spam-note">Didn&apos;t receive it? Check your spam folder. You can request another email{secondsRemaining > 0 ? <> in <strong>{formatCountdown(secondsRemaining)}</strong></> : " now"}.</p>
        {notice && <p className="auth-message success" role="status">{notice}</p>}
        {error && <p className="auth-message error" role="alert">{error}</p>}
        {email && <button
          className="auth-submit"
          type="button"
          disabled={!authAvailable || busy || secondsRemaining > 0}
          onClick={() => void resendVerificationEmail()}
        >
          {busy ? "Sending…" : secondsRemaining > 0 ? `Resend in ${formatCountdown(secondsRemaining)}` : "Resend verification email"}
          <ArrowRight size={16} />
        </button>}
      </div>
      <p className="auth-switch">Already verified? <Link href="/login">Sign in</Link></p>
      {!email && <p className="auth-switch"><Link href="/register">Return to registration</Link></p>}
    </AuthShell>
  );
}

export function LoginPage({ authAvailable, googleConfigured }: { authAvailable: boolean; googleConfigured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleError, setGoogleError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authAvailable) return;
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          sessionStorage.setItem(verificationEmailStorageKey, email.trim().toLowerCase());
          sessionStorage.setItem(verificationCallbackStorageKey, `/account?completeProfile=1${safeNextPath() === "/dashboard" ? "" : `&next=${encodeURIComponent(safeNextPath())}`}`);
          sessionStorage.setItem(verificationResendAfterStorageKey, String(Date.now()));
          router.replace("/verify-email");
          return;
        }
        setError(signInError(result.error));
        setBusy(false);
        return;
      }
    } catch {
      setError("Could not reach the sign-in service. Check your connection and try again.");
      setBusy(false);
      return;
    }
    const profileResponse = await fetch("/api/profile");
    if (profileResponse.ok) {
      const body = await profileResponse.json() as { profile: { phoneNumber: string | null; gender: string | null; countryCode: string | null } | null };
      if (!body.profile?.phoneNumber || !body.profile.gender || !body.profile.countryCode) {
        router.push("/account?completeProfile=1");
        return;
      }
    }
    router.push(safeNextPath());
  }

  async function continueWithGoogle() {
    if (!authAvailable) return;
    if (!googleConfigured) {
      setGoogleError("Google sign-in is not available at the moment. Sign in with email and password instead.");
      return;
    }
    setGoogleError("");
    setBusy(true);
    const next = new URLSearchParams(window.location.search).get("next");
    const destination = next ? `/account?completeProfile=1&next=${encodeURIComponent(safeNextPath())}` : "/account?completeProfile=1";
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: destination });
      if (result.error) {
        setGoogleError(googleSignInError(result.error));
        setBusy(false);
      }
    } catch (error: unknown) {
      setGoogleError(googleSignInError(error));
      setBusy(false);
    }
  }

  return (
    <AuthShell authAvailable={authAvailable} eyebrow="WELCOME BACK" title="Sign in to your account." description="Access your profile, release history, and protected downloads.">
      <form className="auth-form" onSubmit={submit}>
        <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label>Password<span className="password-input"><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /><Link href="/forgot-password" aria-label="Reset password"><LockKeyhole size={15} /></Link></span></label>
        {error && <div className="auth-message error auth-login-error" role="alert">
          <span>{error}</span>
          <Link href="/forgot-password">Forgot your password? <strong>Reset it</strong></Link>
        </div>}
        <button className="auth-submit" type="submit" disabled={!authAvailable || busy}>{busy ? "Signing in…" : "Sign in"} <ArrowRight size={16} /></button>
      </form>
      <div className="auth-or"><span />OR<span /></div>
      <button className="auth-google" type="button" disabled={!authAvailable || busy} onClick={() => void continueWithGoogle()}><b>G</b> {busy ? "Connecting to Google…" : "Continue with Google"}</button>
      {googleError && <p className="auth-message error" role="alert">{googleError}</p>}
      <p className="auth-switch">New to PrivSentinel? <Link href="/register">Create an account</Link></p>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) {
        setError(typeof result.error.status === "number" && result.error.status >= 500
          ? "Password reset is temporarily unavailable. Please try again shortly."
          : "Password reset could not be started. Please check your details and try again.");
      } else {
        setMessage("If an account exists for this address, password reset instructions will be sent.");
      }
    } catch {
      setError("Could not reach the account service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <AuthShell eyebrow="ACCOUNT RECOVERY" title="Reset your password." description="Enter the email address linked to your account.">
    <form className="auth-form" onSubmit={submit}>
      <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
      {error && <p className="auth-message error" role="alert">{error}</p>}
      {message && <p className="auth-message success" role="status">{message}</p>}
      <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"} <ArrowRight size={16} /></button>
    </form>
    <p className="auth-switch"><Link href="/login">Return to sign in</Link></p>
  </AuthShell>;
}

export function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setError("This reset link is invalid or expired. Request a new one.");
      return;
    }
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Choose a stronger password.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(typeof result.error.status === "number" && result.error.status >= 500
          ? "Password could not be updated right now. Please try again shortly."
          : "This reset link is invalid or expired. Request a new one.");
      } else {
        setMessage("Your password has been updated. You can now sign in.");
      }
    } catch {
      setError("Could not reach the account service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <AuthShell eyebrow="SECURE YOUR ACCOUNT" title="Choose a new password." description="Use a strong password that you do not reuse elsewhere.">
    <form className="auth-form" onSubmit={submit}>
      <label>New password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" aria-describedby="reset-password-requirements" /><small id="reset-password-requirements">Use 12–128 characters with uppercase and lowercase letters, a number, and a symbol.</small></label>
      <label>Confirm password<input type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again" /></label>
      {error && <p className="auth-message error" role="alert">{error}</p>}
      {message && <p className="auth-message success" role="status">{message}</p>}
      <button className="auth-submit" type="submit" disabled={busy || Boolean(message)}>{busy ? "Updating…" : "Update password"} <ArrowRight size={16} /></button>
    </form>
    <p className="auth-switch"><Link href="/login">Return to sign in</Link></p>
  </AuthShell>;
}
