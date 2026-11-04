"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { registrationSchema } from "@/lib/validation";

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
  if (error.status === 403) {
    return "Sign-up was blocked because this site URL is not trusted. Use the configured app URL or update BETTER_AUTH_URL to match it.";
  }
  return error.message || "Account creation failed. Check your details and try again.";
}

function AuthShell({ children, eyebrow, title, description }: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main className="auth-page">
      <div className="auth-backdrop" />
      <div className="auth-wrap">
        <Link className="auth-brand" href="/"><Image className="auth-brand-logo" src="/PrivSentinel.png" alt="" width={42} height={42} /><span className="brand-name">Priv<span>Sentinel</span></span></Link>
        <section className="auth-card">
          <div className="auth-card-mark"><ShieldCheck size={24} /></div>
          <span className="auth-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
          <div className="auth-trust"><ShieldCheck size={14} /> Your account information is protected</div>
        </section>
        <Link className="auth-back-link" href="/"><ArrowLeft size={14} /> Back to PrivSentinel</Link>
      </div>
    </main>
  );
}

export function RegisterPage({ googleConfigured }: { googleConfigured: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState({ fullName: "", email: "", phoneNumber: "", gender: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [googleError, setGoogleError] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("provider") !== "google") return;
    if (!googleConfigured) return;
    const next = new URLSearchParams(window.location.search).get("next");
    const destination = `/account?completeProfile=1${next ? `&next=${encodeURIComponent(safeNextPath())}` : ""}`;
    void authClient.signIn.social({ provider: "google", callbackURL: destination })
      .then((result) => {
        if (result.error) setGoogleError(googleSignInError(result.error));
      })
      .catch((error: unknown) => setGoogleError(googleSignInError(error)));
  }, [googleConfigured]);

  async function continueWithGoogle() {
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
    let result: Awaited<ReturnType<typeof authClient.signUp.email>>;
    try {
      result = await authClient.signUp.email({
        name: parsed.data.fullName,
        email: parsed.data.email,
        password: parsed.data.password,
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

    try {
      const profileResponse = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: parsed.data.fullName, phoneNumber: parsed.data.phoneNumber, gender: parsed.data.gender }),
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
    <AuthShell eyebrow="CREATE YOUR ACCOUNT" title="Start with a safer view." description="Create an account to access published Windows releases and security updates.">
      <form className="auth-form" onSubmit={submit} noValidate>
        <label>Full name<input autoComplete="name" value={values.fullName} onChange={update("fullName")} placeholder="Your full name" aria-invalid={Boolean(fieldErrors.fullName)} />{fieldErrors.fullName && <small>{fieldErrors.fullName}</small>}</label>
        <label>Email address<input type="email" autoComplete="email" value={values.email} onChange={update("email")} placeholder="you@example.com" aria-invalid={Boolean(fieldErrors.email)} />{fieldErrors.email && <small>{fieldErrors.email}</small>}</label>
        <fieldset className="auth-gender-options" aria-describedby={fieldErrors.gender ? "register-gender-error" : undefined}><legend>Gender <span>Required</span></legend>{(["male", "female", "other"] as const).map((option) => <label key={option}><input type="radio" name="registration-gender" value={option} required checked={values.gender === option} onChange={() => { setValues((current) => ({ ...current, gender: option })); setFieldErrors((current) => ({ ...current, gender: "" })); }} /> {option[0].toUpperCase() + option.slice(1)}</label>)}{fieldErrors.gender && <small id="register-gender-error">{fieldErrors.gender}</small>}</fieldset>
        <label>Phone number<input type="tel" autoComplete="tel" value={values.phoneNumber} onChange={update("phoneNumber")} placeholder="+254 712 345 678" aria-invalid={Boolean(fieldErrors.phoneNumber)} />{fieldErrors.phoneNumber && <small>{fieldErrors.phoneNumber}</small>}</label>
        <label>Password<span className="password-input"><input type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} value={values.password} onChange={update("password")} placeholder="At least 12 characters" aria-invalid={Boolean(fieldErrors.password)} aria-describedby="password-requirements" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((show) => !show)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span><small id="password-requirements">Use 12–128 characters with uppercase and lowercase letters, a number, and a symbol.</small>{fieldErrors.password && <small>{fieldErrors.password}</small>}</label>
        <label>Confirm password<input type="password" autoComplete="new-password" value={values.confirmPassword} onChange={update("confirmPassword")} placeholder="Enter your password again" aria-invalid={Boolean(fieldErrors.confirmPassword)} />{fieldErrors.confirmPassword && <small>{fieldErrors.confirmPassword}</small>}</label>
        {error && <p className="auth-message error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"} <ArrowRight size={16} /></button>
      </form>
      <div className="auth-or"><span />OR<span /></div>
      <button className="auth-google" type="button" disabled={busy} onClick={() => void continueWithGoogle()}><b>G</b> {busy ? "Connecting to Google…" : "Continue with Google"}</button>
      {googleError && <p className="auth-message error" role="alert">{googleError}</p>}
      <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
      <p className="auth-privacy">Your gender selection is required to complete your account profile and is not shown publicly.</p>
    </AuthShell>
  );
}

export function LoginPage({ googleConfigured }: { googleConfigured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleError, setGoogleError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await authClient.signIn.email({ email: email.trim(), password });
    if (result.error) {
      setError("Email or password is incorrect. Try again or reset your password.");
      setBusy(false);
      return;
    }
    const profileResponse = await fetch("/api/profile");
    if (profileResponse.ok) {
      const body = await profileResponse.json() as { profile: { phoneNumber: string | null; gender: string | null } | null };
      if (!body.profile?.phoneNumber || !body.profile.gender) {
        router.push("/account?completeProfile=1");
        return;
      }
    }
    router.push(safeNextPath());
  }

  async function continueWithGoogle() {
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
    <AuthShell eyebrow="WELCOME BACK" title="Sign in to your account." description="Access your profile, release history, and protected downloads.">
      <form className="auth-form" onSubmit={submit}>
        <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label>Password<span className="password-input"><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /><Link href="/forgot-password" aria-label="Reset password"><LockKeyhole size={15} /></Link></span></label>
        {error && <p className="auth-message error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"} <ArrowRight size={16} /></button>
      </form>
      <div className="auth-or"><span />OR<span /></div>
      <button className="auth-google" type="button" disabled={busy} onClick={() => void continueWithGoogle()}><b>G</b> {busy ? "Connecting to Google…" : "Continue with Google"}</button>
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
    const result = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (result.error) {
      setError("Password reset could not be started. Confirm email delivery is configured and try again.");
    } else {
      setMessage("If an account exists for this address, password reset instructions will be sent.");
    }
    setBusy(false);
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
    const parsed = registrationSchema.shape.password.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Choose a stronger password.");
      return;
    }
    setBusy(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    if (result.error) setError("This reset link is invalid or expired. Request a new one.");
    else setMessage("Your password has been updated. You can now sign in.");
    setBusy(false);
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
