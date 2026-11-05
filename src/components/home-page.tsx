"use client";

import Link from "next/link";
import { Suspense } from "react";
import {
  Activity,
  ArrowDownToLine,
  FileCheck2,
  Fingerprint,
  LockKeyhole,
  Monitor,
  Network,
  Play,
  Radio,
  Shield,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { DemoPlayer, ReleaseSummary, TestimonialPreview } from "@/components/product-widgets";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { useHydrated } from "@/hooks/use-hydrated";
import { useReleasesQuery } from "@/hooks/use-releases";

const features = [
  { icon: Shield, title: "Endpoint Monitoring", copy: "Real-time protection for your device" },
  { icon: Fingerprint, title: "Identity Verification", copy: "Keep your identity safe and secure" },
  { icon: FileCheck2, title: "File Integrity Monitoring", copy: "Detect unauthorized changes" },
  { icon: TriangleAlert, title: "Threat Detection", copy: "Surface suspicious activity for review" },
  { icon: Network, title: "Network Monitoring", copy: "Track endpoint network activity" },
  { icon: Radio, title: "Windows Event Signals", copy: "Review security-relevant system events" },
];

function LatestVersion() {
  const hydrated = useHydrated();
  const { data } = useReleasesQuery();
  const version = hydrated ? data?.latest?.tagName ?? "" : "";
  return <span className="version-pill"><ShieldCheck size={12} /> Latest Version{version ? `: ${version}` : ""}</span>;
}

function ProductDashboardPreview() {
  return (
    <div className="product-preview" aria-label="Illustration of the PrivSentinel desktop dashboard">
      <div className="dashboard-titlebar"><span className="dashboard-app-icon"><ShieldCheck size={12} /></span> PrivSentinel <span>Windows Security Workspace</span><div aria-hidden="true"><i /><i /><i /></div></div>
      <div className="dashboard-layout">
        <aside className="dashboard-sidebar" aria-label="Product interface preview">
          <strong><ShieldCheck size={14} /> PrivSentinel</strong>
          <span className="selected"><Monitor size={13} /> Dashboard</span>
          <span><Activity size={13} /> Monitoring</span>
          <span><TriangleAlert size={13} /> Threats</span>
          <span><Network size={13} /> Network</span>
          <span><FileCheck2 size={13} /> Files</span>
          <span><Radio size={13} /> Events</span>
        </aside>
        <div className="dashboard-main">
          <div className="dashboard-welcome">
            <div className="protected-emblem"><ShieldCheck size={34} /></div>
            <div><h3>Security overview</h3><p>Monitoring workspace preview</p></div>
            <span className="real-time"><i /> Monitoring status</span>
          </div>
          <div className="dashboard-metrics">
            <article><span className="metric-icon red"><TriangleAlert size={18} /></span><small>Security signals</small><strong>Overview</strong><em>Review activity</em></article>
            <article><span className="metric-icon blue"><Activity size={18} /></span><small>System activity</small><strong>Monitored</strong><em>Endpoint status</em></article>
            <article><span className="metric-icon violet"><FileCheck2 size={18} /></span><small>File integrity</small><strong>Available</strong><em>Review changes</em></article>
          </div>
          <div className="dashboard-chart">
            <div><strong>Security activity</strong><span>Product interface preview</span></div>
            <div className="chart-area" aria-hidden="true"><svg viewBox="0 0 500 90" preserveAspectRatio="none"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#0b9eff" stopOpacity=".4"/><stop offset="1" stopColor="#0b9eff" stopOpacity="0"/></linearGradient></defs><path d="M0 68 C35 61 39 48 67 54 S111 82 137 42 S179 16 201 46 S245 60 270 34 S309 38 331 51 S366 13 398 35 S445 47 500 22 V90 H0Z" fill="url(#chartFill)"/><path d="M0 68 C35 61 39 48 67 54 S111 82 137 42 S179 16 201 46 S245 60 270 34 S309 38 331 51 S366 13 398 35 S445 47 500 22" fill="none" stroke="#159eff" strokeWidth="2"/></svg></div>
            <div className="chart-legend"><span>Activity overview</span><span>Windows endpoint signals</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomePage({ demoVideoUrl, authAvailable }: { demoVideoUrl: string; authAvailable: boolean }) {
  return (
    <main className="site-home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-network" aria-hidden="true" />
        <div className="home-hero-copy">
          <LatestVersion />
          <h1 id="home-title">PrivSentinel</h1>
          <h2>Your Windows Security <span>Guardian</span></h2>
          <p><strong>Monitor. Protect. Stay in Control.</strong> Advanced endpoint security for a safer, more secure Windows experience.</p>
          <div className="home-hero-actions">
            <Link className="home-download-button" href="/download"><Monitor size={17} fill="currentColor" /> Download PrivSentinel <ArrowDownToLine size={16} /></Link>
            <PwaInstallButton variant="hero" />
            <Link className="home-demo-button" href="/demo"><Play size={14} fill="currentColor" /> Watch Live Demo</Link>
          </div>
          <div className="hero-assurances">
            <span><Monitor size={15} /> Windows Compatible</span>
            <span><ShieldCheck size={16} /> Secure &amp; Reliable</span>
            <span><Activity size={15} /> Lightweight</span>
          </div>
        </div>
        <div className="hero-product-art" aria-hidden="true"><span className="hero-glow" /><div className="hero-outline-shield"><Shield /><LockKeyhole /></div></div>
        <ProductDashboardPreview />
      </section>

      <section className="home-features" aria-labelledby="home-features-title">
        <div className="home-section-heading"><span /><h2 id="home-features-title">Powerful Features for <em>Complete Protection</em></h2><span /></div>
        <div className="home-feature-grid">{features.map(({ icon: Icon, title, copy }) => (
          <Link className="home-feature-card" href="/features" key={title}>
            <Icon size={25} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{copy}</p>
          </Link>
        ))}</div>
      </section>

      <section className="home-lower-grid" aria-label="Product demo, release, and community">
        <article className="home-demo-column">
          <h2>See PrivSentinel <em>in Action</em></h2>
          <p>Watch our live demonstration to see how easy it is to protect your Windows environment.</p>
          <DemoPlayer videoUrl={demoVideoUrl} compact />
        </article>
        <div className="home-release-column"><Suspense fallback={<p className="release-feedback">Checking the latest release…</p>}><ReleaseSummary compact authAvailable={authAvailable} /></Suspense></div>
        <div className="home-testimonial-column"><TestimonialPreview /></div>
      </section>
    </main>
  );
}
