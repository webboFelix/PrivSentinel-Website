import { Suspense } from "react";
import { connection } from "next/server";
import { RegisterPage } from "@/components/auth-pages";
import { getAuthConfigurationStatus } from "@/lib/env";

export default function Register() {
  return (
    <Suspense fallback={<p className="auth-message" role="status">Checking account availability…</p>}>
      <RegistrationAvailability />
    </Suspense>
  );
}

async function RegistrationAvailability() {
  await connection();
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const authAvailable = getAuthConfigurationStatus().available;
  return <RegisterPage authAvailable={authAvailable} googleConfigured={googleConfigured} />;
}
