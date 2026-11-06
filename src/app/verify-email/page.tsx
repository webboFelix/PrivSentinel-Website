import { connection } from "next/server";
import { VerifyEmailPage } from "@/components/auth-pages";
import { getAuthConfigurationStatus } from "@/lib/env";

export default async function VerifyEmail() {
  await connection();
  return <VerifyEmailPage authAvailable={getAuthConfigurationStatus().available} />;
}
