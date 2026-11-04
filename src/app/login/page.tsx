import { Suspense } from "react";
import { connection } from "next/server";
import { LoginPage } from "@/components/auth-pages";
import { getAuthConfigurationStatus } from "@/lib/env";

export default function Login() {
  return (
    <Suspense fallback={<p className="auth-message" role="status">Checking sign-in availability…</p>}>
      <LoginAvailability />
    </Suspense>
  );
}

async function LoginAvailability() {
  await connection();
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const authAvailable = getAuthConfigurationStatus().available;
  return <LoginPage authAvailable={authAvailable} googleConfigured={googleConfigured} />;
}
