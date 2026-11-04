"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ChevronDown,
  CirclePlay,
  Download,
  Maximize,
  Pause,
  Play,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

type ReleaseAsset = { name: string; size: number; downloadCount: number };
export type Release = {
  id: number;
  tagName: string;
  name: string;
  body: string;
  publishedAt: string | null;
  url: string;
  installer: ReleaseAsset | null;
};
type ReleasesResponse = { latest: Release | null; history: Release[]; error?: string };
type Testimonial = {
  id: string;
  name: string;
  designation: string | null;
  title: string;
  message: string;
  rating: number;
  submittedAt: string;
};
type TestimonialFailure = { code?: string; error?: string };
type TestimonialResponse = {
  reviews: Testimonial[];
  summary: { count: number; average: number };
};

function bytes(value: number) {
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;
}

function releaseDate(value: string | null) {
  if (!value) return "Date not provided";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function LoadingLine({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`loading-skeleton ${className}`} />;
}

function ReleaseLoadingSkeleton({ compact }: { compact: boolean }) {
  return (
    <div className={`release-skeleton${compact ? " is-compact" : ""}`} role="status" aria-label="Loading release information">
      <LoadingLine className="skeleton-badge" />
      <LoadingLine className="skeleton-line medium" />
      <LoadingLine className="skeleton-line wide" />
      <LoadingLine className="skeleton-button" />
    </div>
  );
}

function releaseErrorMessage(error: unknown, apiMessage?: string) {
  if (error instanceof TypeError) return "Could not connect to the release service. Check your connection and try again.";
  return apiMessage || "Release information could not be loaded. Please try again.";
}

function isTestimonial(value: unknown): value is Testimonial {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" &&
    typeof record.name === "string" &&
    (typeof record.designation === "string" || record.designation === null) &&
    typeof record.title === "string" &&
    typeof record.message === "string" &&
    typeof record.rating === "number" &&
    Number.isInteger(record.rating) &&
    record.rating >= 1 && record.rating <= 5 &&
    typeof record.submittedAt === "string";
}

export function DemoPlayer({ videoUrl, compact = false }: { videoUrl: string; compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <div className={`demo-player${compact ? " is-compact" : ""}`}>
      {videoUrl ? (
        <video ref={videoRef} className="demo-video" controls playsInline preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}>
          <source src={videoUrl} />
          Your browser does not support embedded video.
        </video>
      ) : (
        <div className="demo-empty">
          <div className="demo-network" aria-hidden="true"><span /><span /><span /><span /></div>
          <div className="demo-shield" aria-hidden="true"><ShieldCheck size={42} /></div>
          <strong>PrivSentinel</strong>
          <span>Product walkthrough video not configured</span>
          <span className="demo-controls" aria-hidden="true"><Play size={14} fill="currentColor" /> Video preview unavailable</span>
        </div>
      )}
      {videoUrl && (
        <button className="demo-overlay-toggle" type="button" aria-label={playing ? "Pause demonstration" : "Play demonstration"} onClick={() => void togglePlayback()}>
          {playing ? <Pause size={21} /> : <Play size={21} fill="currentColor" />}
        </button>
      )}
      {videoUrl && <span className="demo-expand" aria-hidden="true"><Volume2 size={14} /><Maximize size={14} /></span>}
    </div>
  );
}

export function ReleaseSummary({ compact = false, authAvailable = false }: { compact?: boolean; authAvailable?: boolean }) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ReleasesResponse | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [selectedError, setSelectedError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const selectedVersion = compact ? null : searchParams.get("version");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/releases", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as ReleasesResponse;
        if (!response.ok) {
          setData({ latest: null, history: [], error: releaseErrorMessage(null, result.error) });
          return;
        }
        setData(result);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setData({ latest: null, history: [], error: releaseErrorMessage(error) });
      });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    if (!selectedVersion) return;
    const controller = new AbortController();
    fetch(`/api/releases/${encodeURIComponent(selectedVersion)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { release?: Release; error?: string };
        if (!response.ok || !result.release) {
          setSelectedError(result.error || "This release could not be found. Choose another version from the release history.");
          return;
        }
        setSelectedRelease(result.release);
        setSelectedError("");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setSelectedError(releaseErrorMessage(error, "This release could not be loaded. Please try again."));
      });
    return () => controller.abort();
  }, [selectedVersion, refresh]);

  const release = selectedVersion ? selectedRelease : data?.latest;
  const loadingSelectedRelease = Boolean(selectedVersion && !selectedRelease && !selectedError);
  const loadingLatestRelease = !selectedVersion && data === null;
  return (
    <section className={`release-summary${compact ? " is-compact" : ""}`} aria-labelledby={compact ? "home-release-title" : "download-release-title"} aria-busy={loadingSelectedRelease || loadingLatestRelease}>
      {!compact && <span className="route-eyebrow">WINDOWS RELEASES</span>}
      <h2 id={compact ? "home-release-title" : "download-release-title"}>{compact ? "Latest Release" : selectedVersion ? `Release ${selectedVersion}` : "Latest stable release"}</h2>
      <p className="release-lede">{compact ? "Get the latest version of PrivSentinel for Windows." : "Published Windows installer and release notes from the configured GitHub repository."}</p>
      {loadingSelectedRelease || loadingLatestRelease ? (
        <ReleaseLoadingSkeleton compact={compact} />
      ) : selectedError ? (
        <div className="release-error-state" role="alert"><p className="release-feedback is-error">{selectedError}</p><button type="button" className="state-retry-button" onClick={() => { setSelectedError(""); setSelectedRelease(null); setRefresh((value) => value + 1); }}>Try again</button></div>
      ) : data?.error ? (
        <div className="release-error-state" role="alert"><p className="release-feedback is-error">{data.error}</p><button type="button" className="state-retry-button" onClick={() => { setData(null); setRefresh((value) => value + 1); }}>Try again</button></div>
      ) : !release ? (
        <p className="release-feedback release-empty-state" role="status">No stable release is published yet. Please check back later.</p>
      ) : (
        <div className="release-details">
          <div className="release-badges"><strong>{release.tagName}</strong>{release.installer && <span>Latest</span>}</div>
          <p className="release-published">Released: {releaseDate(release.publishedAt)}</p>
          <h3>{release.name}</h3>
          {release.installer ? (
            <p className="release-asset">{release.installer.name} <span>· {bytes(release.installer.size)}{release.installer.downloadCount ? ` · ${release.installer.downloadCount.toLocaleString()} downloads` : ""}</span></p>
          ) : <p className="release-feedback is-error">No Windows installer was found in this release.</p>}
          {release.body && <details className="release-notes"><summary>Release notes <ChevronDown size={14} /></summary><p>{release.body}</p></details>}
          {release.installer && (
            <InstallerAccessLink authAvailable={authAvailable} tagName={release.tagName} size={release.installer.size} />
          )}
        </div>
      )}
      {compact ? (
        <Link className="release-history-link" href="/download">View release history <ArrowRight size={13} /></Link>
      ) : (
        <>
          {selectedVersion && <Link className="release-history-link" href="/download">← Back to latest release</Link>}
          <p className="release-platform"><ShieldCheck size={15} /> Windows 10 / 11 · Authenticated account required</p>
          {data?.history?.length ? <div className="release-history-list"><h3>Release history</h3>{data.history.map((item) => (
            <Link href={`/download?version=${encodeURIComponent(item.tagName)}`} key={item.id}>
              <span><strong>{item.tagName}</strong><small>{item.name}</small></span><time>{releaseDate(item.publishedAt)}</time>
            </Link>
          ))}</div> : null}
          <p className="release-disclosure">Account access controls downloads through this site. Public GitHub assets may still be shared after a download.</p>
        </>
      )}
    </section>
  );
}

function InstallerAccessLink({ authAvailable, tagName, size }: { authAvailable: boolean; tagName: string; size: number }) {
  if (!authAvailable) {
    return <Link className="release-download" href="/register?next=%2Fapi%2Fdownloads%2Flatest"><Download size={17} /> Download Windows Installer ({tagName}) <span>— {bytes(size)}</span></Link>;
  }
  return <ConfiguredInstallerAccessLink tagName={tagName} size={size} />;
}

function ConfiguredInstallerAccessLink({ tagName, size }: { tagName: string; size: number }) {
  const { data: session, isPending } = authClient.useSession();
  const [profileState, setProfileState] = useState<{ userId: string; status: "complete" | "incomplete" | "error" } | null>(null);

  useEffect(() => {
    if (isPending || !session?.user) return;

    const controller = new AbortController();
    fetch("/api/profile", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Profile could not be checked.");
        const result = await response.json() as { profile: { phoneNumber: string | null; gender: string | null } | null };
        setProfileState({ userId: session.user.id, status: result.profile?.phoneNumber && result.profile.gender ? "complete" : "incomplete" });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setProfileState({ userId: session.user.id, status: "error" });
      });
    return () => controller.abort();
  }, [isPending, session]);

  if (isPending) {
    return <button className="release-download" type="button" disabled><Download size={17} /> Checking download access…</button>;
  }
  if (!session?.user) {
    return <Link className="release-download" href="/register?next=%2Fapi%2Fdownloads%2Flatest"><Download size={17} /> Download Windows Installer ({tagName}) <span>— {bytes(size)}</span></Link>;
  }
  const profileStatus = profileState?.userId === session.user.id ? profileState.status : "checking";
  if (profileStatus === "checking") {
    return <button className="release-download" type="button" disabled><Download size={17} /> Checking download access…</button>;
  }
  if (profileStatus === "complete") {
    return <a className="release-download" href="/api/downloads/latest"><Download size={17} /> Download Windows Installer ({tagName}) <span>— {bytes(size)}</span></a>;
  }
  const label = profileStatus === "error" ? "Review account profile to download" : "Complete profile to download";
  return <Link className="release-download" href="/account?completeProfile=1&next=%2Fapi%2Fdownloads%2Flatest"><Download size={17} /> {label} <span>— {bytes(size)}</span></Link>;
}

export function TestimonialPreview() {
  const [reviews, setReviews] = useState<Testimonial[] | null>(null);
  const [summary, setSummary] = useState<TestimonialResponse["summary"] | null>(null);
  const [failure, setFailure] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/testimonials", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const result = await response.json() as TestimonialFailure;
          setFailure(result.error || "Approved testimonials could not be loaded.");
          return;
        }
        const result = await response.json() as unknown;
        if (typeof result !== "object" || result === null || !("reviews" in result) ||
            !Array.isArray(result.reviews) || !result.reviews.every(isTestimonial) ||
            !("summary" in result) || typeof result.summary !== "object" || result.summary === null ||
            !("count" in result.summary) || !Number.isInteger(result.summary.count) ||
            !("average" in result.summary) || typeof result.summary.average !== "number") {
          setFailure("The testimonial response was invalid. Please try again.");
          return;
        }
        setReviews(result.reviews);
        setSummary(result.summary as TestimonialResponse["summary"]);
        setFailure("");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setFailure(error instanceof TypeError
          ? "Could not connect to load testimonials. Check your connection and try again."
          : "Approved testimonials could not be loaded. Please try again.");
      });
    return () => controller.abort();
  }, [refresh]);

  return (
    <section className="testimonial-preview" aria-labelledby="testimonial-title">
      <h2 id="testimonial-title">What Our Users Say</h2>
      <p>Feedback from the PrivSentinel community.</p>
      {failure ? <div className="testimonial-empty-state" role="alert"><p className="testimonial-empty">{failure}</p><button type="button" className="state-retry-button" onClick={() => { setFailure(""); setReviews(null); setRefresh((value) => value + 1); }}>Try again</button></div> :
        reviews === null ? <TestimonialLoadingSkeleton /> :
          reviews.length === 0 ? <p className="testimonial-empty" role="status">No approved reviews yet. Check back later.</p> :
            <><p className="testimonial-rating-summary" aria-label={`${summary?.average.toFixed(1) ?? "0.0"} average from ${summary?.count ?? 0} approved reviews`}>
              <span aria-hidden="true">{"★".repeat(Math.round(summary?.average ?? 0))}</span>
              {summary?.average.toFixed(1)} average · {summary?.count} approved {summary?.count === 1 ? "review" : "reviews"}
            </p><div className="testimonial-stack">{reviews.slice(0, 3).map((review) => (
              <article className="testimonial-card" key={review.id}>
                <span className="testimonial-avatar" aria-hidden="true">{review.name.slice(0, 1).toUpperCase()}</span>
                <div><div className="testimonial-stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}</div><h3>{review.title}</h3><blockquote>“{review.message}”</blockquote><strong>— {review.name}{review.designation ? `, ${review.designation}` : ""}</strong><time dateTime={review.submittedAt}>{releaseDate(review.submittedAt)}</time></div>
              </article>
            ))}</div></>}
      <Link className="testimonial-link" href="/about">About PrivSentinel <ArrowRight size={13} /></Link>
    </section>
  );
}

function TestimonialLoadingSkeleton() {
  return (
    <div className="testimonial-skeleton-stack" role="status" aria-label="Loading approved testimonials" aria-busy="true">
      {[0, 1].map((item) => <div className="testimonial-skeleton" key={item}>
        <LoadingLine className="skeleton-avatar" />
        <div><LoadingLine className="skeleton-line short" /><LoadingLine className="skeleton-line wide" /><LoadingLine className="skeleton-line medium" /></div>
      </div>)}
    </div>
  );
}

export function DownloadAction() {
  return (
    <Link className="release-download" href="/register?next=%2Fapi%2Fdownloads%2Flatest">
      <ArrowDownToLine size={17} /> Get the protected installer <ArrowRight size={15} />
    </Link>
  );
}

export function DemoLink() {
  return <Link className="demo-route-link" href="/demo"><CirclePlay size={15} /> Open demo page <ArrowRight size={14} /></Link>;
}
