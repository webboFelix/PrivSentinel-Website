import Link from "next/link";
import { Suspense } from "react";
import {
  Activity,
  ArrowRight,
  FileCheck2,
  Fingerprint,
  LockKeyhole,
  Network,
  Radio,
  Shield,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { DemoPlayer, ReleaseSummary } from "@/components/product-widgets";

const productFeatures = [
  { icon: Activity, title: "Endpoint monitoring", text: "Review device activity and monitoring status from a focused Windows security workspace." },
  { icon: Fingerprint, title: "Identity verification", text: "Keep identity-related security information close to the endpoint overview." },
  { icon: FileCheck2, title: "File integrity monitoring", text: "Surface monitored file changes so unexpected activity can be reviewed." },
  { icon: TriangleAlert, title: "Threat signals", text: "Bring potential security signals into view for follow-up and investigation." },
  { icon: Network, title: "Network activity", text: "See endpoint network activity in a security monitoring context." },
  { icon: Radio, title: "Windows event signals", text: "Review relevant Windows event information through a focused interface." },
];

function PageIntro({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return <header className="route-intro"><span className="route-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{lead}</p></header>;
}

export function AboutPage() {
  return <main className="route-page">
    <PageIntro eyebrow="ABOUT PRIVSENTINEL" title="A clearer view of Windows security." lead="PrivSentinel is a Windows-first endpoint security application and companion website for accessing published releases." />
    <section className="route-panel about-panel">
      <div className="route-feature-icon"><ShieldCheck size={26} /></div>
      <div><h2>Our mission</h2><p>Make endpoint security signals easier to review through a focused, privacy-conscious desktop experience.</p></div>
    </section>
    <div className="route-card-grid">
      <article className="route-panel"><h2>Product overview</h2><p>PrivSentinel brings endpoint monitoring and related security information into a Windows-focused workspace. The available installer and its release notes are published through the configured GitHub Releases repository.</p></article>
      <article className="route-panel"><h2>Development goals</h2><ul className="route-check-list"><li>Make key device status and signals easier to understand.</li><li>Keep release access transparent and authenticated through this site.</li><li>Build around clear privacy boundaries and responsible use.</li></ul></article>
    </div>
    <div className="route-cta"><p>Explore the capabilities and security approach.</p><Link className="route-button" href="/features">Explore features <ArrowRight size={15} /></Link><Link className="route-text-link" href="/security">Security and privacy</Link></div>
  </main>;
}

export function FeaturesPage() {
  return <main className="route-page">
    <PageIntro eyebrow="PRODUCT FEATURES" title="Security signals, in one workspace." lead="Explore the monitoring capabilities represented in the PrivSentinel product interface. Refer to the published release notes for exact version availability." />
    <div className="detailed-feature-grid">{productFeatures.map(({ icon: Icon, title, text }) => <article className="route-panel detailed-feature" key={title}><span className="route-feature-icon"><Icon size={22} /></span><h2>{title}</h2><p>{text}</p></article>)}</div>
    <section className="route-panel features-note"><Shield size={22} /><p>Features and availability may vary by version. The GitHub release notes describe changes included with each published installer.</p><Link href="/download">View releases <ArrowRight size={14} /></Link></section>
  </main>;
}

export function SecurityPage() {
  return <main className="route-page">
    <PageIntro eyebrow="SECURITY & PRIVACY" title="Designed for responsible protection." lead="Understand how the PrivSentinel website handles account access, installer downloads, and your information." />
    <div className="security-principles">
      <article className="route-panel"><span className="route-feature-icon"><LockKeyhole size={22} /></span><h2>Protected download access</h2><p>The website checks your authenticated session and profile before it streams the latest Windows installer. Download activity is recorded against your account.</p></article>
      <article className="route-panel"><span className="route-feature-icon"><ShieldCheck size={22} /></span><h2>Server-side credentials</h2><p>Database, authentication, and optional GitHub API credentials are configured on the server and are not intended for public client bundles.</p></article>
      <article className="route-panel"><span className="route-feature-icon"><Network size={22} /></span><h2>Clear distribution limits</h2><p>Account checks control access through this website; they cannot prevent redistribution of a file after someone downloads it. GitHub release assets may be publicly accessible.</p></article>
    </div>
    <section className="route-panel security-disclosure"><h2>Privacy approach</h2><p>The site processes account details needed for authentication and profile completion, including a phone number, and records installer download events. Review the <Link href="/privacy">Privacy Policy</Link> for more detail.</p><p>Use PrivSentinel only on systems you own or are authorized to monitor.</p></section>
  </main>;
}

export function DemoPage({ videoUrl }: { videoUrl: string }) {
  return <main className="route-page">
    <PageIntro eyebrow="PRODUCT DEMONSTRATION" title="See the workspace in action." lead="Watch a configured product walkthrough or review the overview below." />
    <section className="route-panel full-demo-panel"><DemoPlayer videoUrl={videoUrl} /><div className="demo-description"><h2>PrivSentinel product walkthrough</h2><p>{videoUrl ? "Use the video controls to play, pause, adjust volume, and move through the demonstration." : "A demonstration video has not been configured. Set NEXT_PUBLIC_DEMO_VIDEO_URL in your local .env file to add a real video source."}</p></div></section>
    <div className="route-card-grid"><article className="route-panel"><h2>What you can explore</h2><p>See the monitoring overview, the product interface, and the available security signals included in the demonstration.</p></article><article className="route-panel"><h2>Want the current build?</h2><p>Read the current release notes and access the protected installer.</p><Link className="route-text-link" href="/download">Visit downloads <ArrowRight size={14} /></Link></article></div>
  </main>;
}

export function DownloadPage({ authAvailable }: { authAvailable: boolean }) {
  return <main className="route-page download-route">
    <PageIntro eyebrow="OFFICIAL WINDOWS RELEASES" title="PrivSentinel downloads." lead="Release information is retrieved dynamically from the configured GitHub repository. Installer downloads require sign-in and a complete account profile." />
    <Suspense fallback={<div className="route-panel">Loading release information…</div>}><ReleaseSummary authAvailable={authAvailable} /></Suspense>
  </main>;
}

const faqItems = [
  ["Which Windows versions are supported?", "The current download is intended for Windows 10 and Windows 11. Check the release notes for any version-specific requirements."],
  ["Why does downloading require an account?", "An account allows the website to authorize access and associate download history with your profile. This does not make public GitHub assets private or prevent a downloaded installer from being shared."],
  ["Why do I need to add a phone number?", "A completed profile, including a phone number, is required before the protected installer endpoint authorizes a download."],
  ["Where does release information come from?", "The website reads published, non-draft, non-prerelease releases from the GitHub repository configured in the server environment."],
  ["What if the installer is missing?", "A release without a Windows .exe installer cannot be downloaded through the protected installer flow. Check the release page again later or contact support."],
  ["How do I reset my password?", "Use the Forgot password link on the login page. Password reset email delivery must be configured by the service operator."],
];

export function FaqPage() {
  return <main className="route-page">
    <PageIntro eyebrow="HELP CENTER" title="Frequently asked questions." lead="Answers about platform support, account access, releases, and downloads." />
    <div className="route-faq-list">{faqItems.map(([question, answer]) => <details className="route-panel" key={question}><summary>{question}<ArrowRight size={15} /></summary><p>{answer}</p></details>)}</div>
    <p className="faq-contact">Need more help? Visit our <Link href="/help">help page</Link>.</p>
  </main>;
}

export function HelpPage() {
  return <main className="route-page">
    <PageIntro eyebrow="SUPPORT" title="How can we help?" lead="Find support for account access, profile completion, release information, or the PrivSentinel installer." />
    <div className="route-card-grid">
      <article className="route-panel"><h2>Account and profile</h2><p>Sign in or create an account. Add a valid phone number in Account before requesting the protected installer.</p><div className="route-link-row"><Link href="/login">Sign in <ArrowRight size={14} /></Link><Link href="/account">Account settings <ArrowRight size={14} /></Link></div></article>
      <article className="route-panel"><h2>Download and releases</h2><p>Check whether a stable release and Windows installer are available and review version notes.</p><Link className="route-text-link" href="/download">Open releases <ArrowRight size={14} /></Link></article>
      <article className="route-panel"><h2>Frequently asked questions</h2><p>Browse common questions about supported Windows versions, download authorization, and release data.</p><Link className="route-text-link" href="/faq">Browse FAQs <ArrowRight size={14} /></Link></article>
    </div>
    <section className="route-panel support-contact"><h2>Contact support</h2><p>For issues with published release assets, contact the project through its GitHub repository.</p><a className="route-button" href="https://github.com/CybersecurityHubVAPT/PrivSentinel-Releases/issues" target="_blank" rel="noreferrer">Open a GitHub issue <ArrowRight size={14} /></a></section>
  </main>;
}

export function PrivacyPage() {
  return <main className="route-page legal-page">
    <PageIntro eyebrow="LEGAL" title="Privacy Policy." lead="This page explains information processed by the PrivSentinel website and why it is needed." />
    <p className="legal-updated">Last updated: November 4, 2026</p>
    <section className="route-panel"><h2>Information processed</h2><p>When you create an account, the service processes your name, email address, gender, and password through Better Auth and the account profile. Passwords are handled by the authentication provider and are not stored as plaintext. A phone number and gender are required to complete your profile before installer downloads are enabled. You may optionally provide a profile photo, organization, and current position; these optional details are not needed for downloads.</p></section>
    <section className="route-panel"><h2>Payment cards</h2><p>If card setup is enabled, card details are entered directly with Stripe to verify and save a payment method without charging it. PrivSentinel does not receive or store full card numbers or security codes. The service stores a Stripe payment-method identifier and limited display details such as card brand, last four digits, and expiry date.</p></section>
    <section className="route-panel"><h2>Downloads and technical data</h2><p>When a download is authorized, the service records the account, release, installer name, and time to provide download history and operational auditing. Better Auth or infrastructure providers may process session or request data as required to operate and secure the service.</p></section>
    <section className="route-panel"><h2>Service providers and retention</h2><p>Account and download records are stored in the configured Turso database. Authentication is provided by Better Auth, and release information is read from the configured GitHub repository. Records are retained as needed to provide and secure the service, subject to operator configuration and applicable requirements.</p></section>
    <section className="route-panel"><h2>Your choices and contact</h2><p>For account or privacy questions, contact the project maintainers through the <Link href="/help">help page</Link>. Do not include passwords, tokens, or other credentials in a support request.</p></section>
  </main>;
}

export function TermsPage() {
  return <main className="route-page legal-page">
    <PageIntro eyebrow="LEGAL" title="Terms of Service." lead="These terms describe responsible use of the PrivSentinel website and its downloads." />
    <p className="legal-updated">Last updated: November 4, 2026</p>
    <section className="route-panel"><h2>Acceptable use</h2><p>Use the site and PrivSentinel only for lawful purposes and only monitor devices or networks you own or are authorized to assess. Do not attempt to bypass access controls or disrupt the service.</p></section>
    <section className="route-panel"><h2>Accounts and downloads</h2><p>Keep your account credentials secure and provide accurate profile information. Downloads are authorized through account checks on this website. Downloaded software or public GitHub release assets may be shared outside the website; access controls cannot prevent redistribution.</p></section>
    <section className="route-panel"><h2>Release information</h2><p>Availability, features, and system requirements can change between versions. Review the release notes and verify compatibility before installing. The website may temporarily be unable to reach the configured release service.</p></section>
    <section className="route-panel"><h2>Changes and support</h2><p>These terms may be updated as the service evolves. Continued use after an update indicates acceptance of the updated terms. For questions, visit the <Link href="/help">help page</Link>.</p></section>
  </main>;
}
