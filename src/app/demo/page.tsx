import { DemoPage } from "@/components/content-pages";

export default function DemoRoute() {
  return <DemoPage videoUrl={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ?? ""} />;
}
