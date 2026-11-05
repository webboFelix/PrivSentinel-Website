"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  Download,
  Maximize,
  Pause,
  Play,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useHydrated } from "@/hooks/use-hydrated";
import { useProfileQuery } from "@/hooks/use-profile";
import { useReleaseQuery, useReleasesQuery } from "@/hooks/use-releases";
import { usePublicTestimonialsQuery } from "@/hooks/use-testimonials";
import { formatTimeAgo } from "@/lib/time-ago";

function bytes(value: number) {
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;
}

function releaseDate(value: string | null) {
  if (!value) return "Date not provided";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
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
  const hydrated = useHydrated();
  const searchParams = useSearchParams();
  const selectedVersion = compact ? null : searchParams.get("version");
  const releasesQuery = useReleasesQuery();
  const selectedReleaseQuery = useReleaseQuery(selectedVersion);
  const data = releasesQuery.data;
  const selectedRelease = selectedReleaseQuery.data?.release;
  const selectedError = selectedReleaseQuery.error
    ? releaseErrorMessage(selectedReleaseQuery.error, selectedReleaseQuery.error.message)
    : selectedVersion && selectedReleaseQuery.data && !selectedRelease
      ? selectedReleaseQuery.data.error || "This release could not be found. Choose another version from the release history."
      : "";
  const release = selectedVersion ? selectedRelease : data?.latest;
  const loadingSelectedRelease = !hydrated || Boolean(selectedVersion && selectedReleaseQuery.isPending);
  const loadingLatestRelease = !hydrated || (!selectedVersion && releasesQuery.isPending);
  return (
    <section className={`release-summary${compact ? " is-compact" : ""}`} aria-labelledby={compact ? "home-release-title" : "download-release-title"} aria-busy={loadingSelectedRelease || loadingLatestRelease}>
      {!compact && <span className="route-eyebrow">WINDOWS RELEASES</span>}
      <h2 id={compact ? "home-release-title" : "download-release-title"}>{compact ? "Latest Release" : selectedVersion ? `Release ${selectedVersion}` : "Latest stable release"}</h2>
      <p className="release-lede">{compact ? "Get the latest version of PrivSentinel for Windows." : "Published Windows installer and release notes from the configured GitHub repository."}</p>
      {loadingSelectedRelease || loadingLatestRelease ? (
        <ReleaseLoadingSkeleton compact={compact} />
      ) : selectedError ? (
        <div className="release-error-state" role="alert"><p className="release-feedback is-error">{selectedError}</p><button type="button" className="state-retry-button" onClick={() => void selectedReleaseQuery.refetch()}>Try again</button></div>
      ) : releasesQuery.error ? (
        <div className="release-error-state" role="alert"><p className="release-feedback is-error">{releaseErrorMessage(releasesQuery.error, releasesQuery.error.message)}</p><button type="button" className="state-retry-button" onClick={() => void releasesQuery.refetch()}>Try again</button></div>
      ) : data?.error ? (
        <div className="release-error-state" role="alert"><p className="release-feedback is-error">{data.error}</p><button type="button" className="state-retry-button" onClick={() => void releasesQuery.refetch()}>Try again</button></div>
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
  const profileQuery = useProfileQuery(session?.user.id);

  if (isPending) {
    return <button className="release-download" type="button" disabled><Download size={17} /> Checking download access…</button>;
  }
  if (!session?.user) {
    return <Link className="release-download" href="/register?next=%2Fapi%2Fdownloads%2Flatest"><Download size={17} /> Download Windows Installer ({tagName}) <span>— {bytes(size)}</span></Link>;
  }
  if (profileQuery.isPending) {
    return <button className="release-download" type="button" disabled><Download size={17} /> Checking download access…</button>;
  }
  if (profileQuery.data?.profile?.phoneNumber && profileQuery.data.profile.gender && profileQuery.data.profile.countryCode) {
    return <a className="release-download" href="/api/downloads/latest"><Download size={17} /> Download Windows Installer ({tagName}) <span>— {bytes(size)}</span></a>;
  }
  const label = profileQuery.error ? "Review account profile to download" : "Complete profile to download";
  return <Link className="release-download" href="/account?completeProfile=1&next=%2Fapi%2Fdownloads%2Flatest"><Download size={17} /> {label} <span>— {bytes(size)}</span></Link>;
}

export function TestimonialPreview() {
  const hydrated = useHydrated();
  const testimonialsQuery = usePublicTestimonialsQuery();
  const reviews = testimonialsQuery.data?.reviews ?? [];
  const summary = testimonialsQuery.data?.summary;
  const [activeReview, setActiveReview] = useState(0);
  const [rotationPaused, setRotationPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const isRotationPaused = rotationPaused || isHovered || hasFocus || reducedMotion;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (reviews.length < 2 || isRotationPaused) return;
    const timer = window.setInterval(() => {
      setActiveReview((current) => (current + 1) % reviews.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [isRotationPaused, reviews.length]);

  function showReview(index: number) {
    setActiveReview((index + reviews.length) % reviews.length);
  }

  const currentIndex = Math.min(activeReview, Math.max(reviews.length - 1, 0));
  const currentReview = reviews[currentIndex];

  return (
    <section className="testimonial-preview" aria-labelledby="testimonial-title">
      <h2 id="testimonial-title">What Our Users Say</h2>
      <p>Feedback from the PrivSentinel community.</p>
      {!hydrated || testimonialsQuery.isPending ? <TestimonialLoadingSkeleton /> :
        testimonialsQuery.error ? <div className="testimonial-empty-state" role="alert"><p className="testimonial-empty">{testimonialsQuery.error.message || "Approved testimonials could not be loaded."}</p><button type="button" className="state-retry-button" onClick={() => void testimonialsQuery.refetch()}>Try again</button></div> :
          reviews.length === 0 ? <p className="testimonial-empty" role="status">No approved reviews yet. Check back later.</p> :
            <><p className="testimonial-rating-summary" aria-label={`${summary?.average.toFixed(1) ?? "0.0"} average from ${summary?.count ?? 0} approved reviews`}>
              <span aria-hidden="true">{"★".repeat(Math.round(summary?.average ?? 0))}</span>
              {summary?.average.toFixed(1)} average · {summary?.count} approved {summary?.count === 1 ? "review" : "reviews"}
            </p><div className="testimonial-carousel"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onFocusCapture={() => setHasFocus(true)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false);
              }}
            ><div className="testimonial-stack" aria-live={isRotationPaused ? "polite" : "off"} aria-atomic="true">
              {currentReview && <article className="testimonial-card" key={currentReview.id}>
                <span className="testimonial-avatar" aria-hidden="true">{currentReview.avatar
                  ? <Image src={currentReview.avatar} alt="" width={42} height={42} unoptimized />
                  : currentReview.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                <div><div className="testimonial-stars" aria-label={`${currentReview.rating} out of 5 stars`}>{"★".repeat(currentReview.rating)}</div><h3>{currentReview.title}</h3><blockquote>“{currentReview.message}”</blockquote><strong>— {currentReview.name}{currentReview.designation ? `, ${currentReview.designation}` : ""}</strong><RelativeTime value={currentReview.submittedAt} /></div>
              </article>}
            </div>{reviews.length > 1 && <div className="testimonial-controls">
              <button type="button" className="testimonial-control-button" aria-label="Previous testimonial" onClick={() => showReview(currentIndex - 1)}><ChevronLeft size={14} /></button>
              <div className="testimonial-pagination" aria-label="Choose a testimonial">
                {reviews.map((review, index) => <button key={review.id} type="button" className={`testimonial-indicator${index === currentIndex ? " is-active" : ""}`} aria-label={`Show testimonial ${index + 1}`} aria-current={index === currentIndex ? "true" : undefined} onClick={() => showReview(index)} />)}
              </div>
              <button type="button" className="testimonial-control-button" aria-label="Next testimonial" onClick={() => showReview(currentIndex + 1)}><ChevronRight size={14} /></button>
              <button type="button" className="testimonial-control-button testimonial-rotation-button" disabled={reducedMotion} aria-label={reducedMotion ? "Automatic rotation is disabled by your reduced-motion setting" : rotationPaused ? "Resume automatic testimonial rotation" : "Pause automatic testimonial rotation"} onClick={() => setRotationPaused((paused) => !paused)}>{rotationPaused || reducedMotion ? <Play size={12} /> : <Pause size={12} />}</button>
            </div>}</div></>}
      <Link className="testimonial-link" href="/about">About PrivSentinel <ArrowRight size={13} /></Link>
    </section>
  );
}

function RelativeTime({ value }: { value: string }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return <time dateTime={value} title={releaseDate(value)}>{now ? formatTimeAgo(value, now) : releaseDate(value)}</time>;
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
