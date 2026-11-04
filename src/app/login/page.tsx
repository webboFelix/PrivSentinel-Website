import { LoginPage } from "@/components/auth-pages";

export default function Login() {
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return <LoginPage googleConfigured={googleConfigured} />;
}
