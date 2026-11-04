import { DownloadPage } from "@/components/content-pages";
import { getAuthConfigurationStatus } from "@/lib/env";

export default function DownloadRoute() {
  const authAvailable = getAuthConfigurationStatus().available;
  return <DownloadPage authAvailable={authAvailable} />;
}
