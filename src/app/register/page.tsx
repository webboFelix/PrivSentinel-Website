import { RegisterPage } from "@/components/auth-pages";

export default function Register() {
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return <RegisterPage googleConfigured={googleConfigured} />;
}
