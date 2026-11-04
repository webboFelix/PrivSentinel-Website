import { HomePage } from "@/components/home-page";

export default function Home() {
  const authAvailable = Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
  return <HomePage demoVideoUrl={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ?? ""} authAvailable={authAvailable} />;
}
