import { HomePage } from "@/components/home-page";
import { getAuthConfigurationStatus } from "@/lib/env";

export default function Home() {
  const authAvailable = getAuthConfigurationStatus().available;
  return <HomePage demoVideoUrl={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ?? ""} authAvailable={authAvailable} />;
}
