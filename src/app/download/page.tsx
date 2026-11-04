import { DownloadPage } from "@/components/content-pages";

export default function DownloadRoute() {
  const authAvailable = Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
  return <DownloadPage authAvailable={authAvailable} />;
}
