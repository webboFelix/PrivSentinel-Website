import { ContactPage } from "@/components/contact-page";
import { getPublicContactChannels } from "@/lib/env";

export default function ContactRoute() {
  return <ContactPage {...getPublicContactChannels()} />;
}
