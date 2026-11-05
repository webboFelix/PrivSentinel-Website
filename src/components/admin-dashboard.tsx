"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DottedLoader } from "@/components/dotted-loader";
import { countryOptions } from "@/lib/countries";

type Role = "user" | "admin" | "super_admin";
type Status = "active" | "suspended";
type AdminUser = {
  id: string;
  name: string;
  displayName: string;
  email: string;
  role: Role;
  createdAt: string;
  status: Status;
  lastLoginAt: string | null;
  avatar?: string | null;
};
type Overview = {
  totals: { users: number; activeUsers: number; suspendedUsers: number; downloads: number };
  roleDistribution: Record<string, number>;
  latestRegistrations: Array<{ id: string; name: string | null; email: string; role: Role; createdAt: string }>;
  recentActivity: Array<{ id: string; action: string; resource: string; timestamp: string; actorEmail: string | null }>;
};
type Review = {
  id: string;
  name: string;
  email: string | null;
  designation: string | null;
  avatar: string | null;
  title: string;
  message: string;
  rating: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};
type Release = {
  tagName: string;
  name: string;
  body: string;
  publishedAt: string | null;
  installer: { name: string; url: string; size: number } | null;
  isPublished: boolean;
  downloadCount: number;
};
type AuditEvent = {
  id: string;
  action: string;
  resource: string;
  targetType: string | null;
  targetId: string | null;
  timestamp: string;
  metadata: string | null;
  actorEmail: string | null;
};
type UserDetail = {
  user: AdminUser & {
    emailVerified: boolean;
    banReason: string | null;
    phoneNumber: string | null;
    countryCode: string | null;
    city: string | null;
    region: string | null;
    organization: string | null;
    currentPosition: string | null;
    location: string | null;
    downloadCount: number;
  };
  activity: Array<{ id: string; action: string; resource: string; timestamp: string; metadata: string | null }>;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export function AdminDashboard({ role, currentUserId }: { role: string; currentUserId: string }) {
  const [section, setSection] = useState("Overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userOffset, setUserOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reviewStatus, setReviewStatus] = useState<Review["status"]>("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadOverview = useCallback(async () => setOverview(await api<Overview>("/api/admin/overview")), []);
  const loadUsers = useCallback(async (append = false, offset = 0) => {
    const params = new URLSearchParams({ limit: "25", offset: String(offset) });
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    const result = await api<{ users: AdminUser[]; total: number }>(`/api/admin/users?${params}`);
    setUsers((current) => append ? [...current, ...result.users] : result.users);
    setUserTotal(result.total);
    setUserOffset(offset);
  }, [roleFilter, search, statusFilter]);
  const loadReviews = useCallback(async () => {
    const result = await api<{ testimonials: Review[] }>(`/api/admin/testimonials?status=${reviewStatus}`);
    setReviews(result.testimonials);
  }, [reviewStatus]);
  const loadReleases = useCallback(async () => {
    const result = await api<{ releases: Release[] }>("/api/admin/releases");
    setReleases(result.releases);
  }, []);
  const loadEvents = useCallback(async () => {
    const result = await api<{ events: AuditEvent[] }>("/api/admin/audit");
    setEvents(result.events);
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const request = section === "Overview" ? loadOverview()
        : section === "Users" ? loadUsers(false, 0)
          : section === "Testimonials & Reviews" ? loadReviews()
            : section === "Release management" ? loadReleases()
              : loadEvents();
      void request.catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "The dashboard data could not be loaded.");
      });
    }, section === "Users" ? 200 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [section, loadEvents, loadOverview, loadReleases, loadReviews, loadUsers]);

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(item: AdminUser, nextRole: Role) {
    if (nextRole === item.role) return;
    if (!window.confirm(`Change ${item.displayName}'s role from ${item.role} to ${nextRole}?`)) return;
    await runAction(async () => {
      await api(`/api/admin/users/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      await Promise.all([loadUsers(false, 0), loadOverview()]);
    }, "The account role was updated.");
  }

  async function setSuspended(item: AdminUser) {
    const suspended = item.status !== "suspended";
    const reason = suspended ? window.prompt("Enter a reason for suspending this account (at least five characters):") : undefined;
    if (suspended && (reason === null || !reason?.trim())) return;
    if (!suspended && !window.confirm(`Reactivate ${item.displayName}'s account?`)) return;
    await runAction(async () => {
      await api(`/api/admin/users/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(suspended ? { suspended: true, reason } : { suspended: false }),
      });
      await Promise.all([loadUsers(false, 0), loadOverview()]);
    }, suspended ? "The account was suspended." : "The account was reactivated.");
  }

  async function showUser(id: string) {
    await runAction(async () => setDetail(await api<UserDetail>(`/api/admin/users/${encodeURIComponent(id)}`)), "");
  }

  async function moderate(review: Review, status: "approved" | "rejected") {
    if (!window.confirm(`${status === "approved" ? "Approve" : "Reject"} this testimonial?`)) return;
    await runAction(async () => {
      await api(`/api/admin/testimonials/${encodeURIComponent(review.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadReviews();
      await loadOverview();
    }, `Testimonial ${status}.`);
  }

  async function saveRelease(release: Release, data: { name: string; body: string; isPublished: boolean }) {
    await runAction(async () => {
      await api("/api/admin/releases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagName: release.tagName,
          releaseName: data.name,
          releaseNotes: data.body,
          isPublished: data.isPublished,
        }),
      });
      await loadReleases();
    }, `Release ${release.tagName} was updated.`);
  }

  const sections = ["Overview", "Users", "Testimonials & Reviews", "Release management", "Security & audit"];

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link href="/" className="admin-brand"><Image src="/PrivSentinel.png" alt="" width={36} height={36} /><span className="brand-name">Priv<span>Sentinel</span></span></Link>
        <nav className="admin-header-links"><Link href="/dashboard">Return to account</Link><span>{role.replace("_", " ")}</span></nav>
      </header>
      <div className="admin-main">
        <span className="section-kicker">PRIVSENTINEL ADMINISTRATION</span>
        <h1>Operations dashboard</h1>
        <p className="admin-lede">Manage accounts, reviews, releases, and security activity. All privileged changes are audited.</p>
        <nav className="admin-tabs" aria-label="Administration sections">
          {sections.map((item) => <button key={item} type="button" className={section === item ? "is-active" : ""} aria-current={section === item ? "page" : undefined} onClick={() => { setSection(item); setError(""); setNotice(""); }}>{item}</button>)}
        </nav>
        {error && <p className="account-message error" role="alert">{error}</p>}
        {notice && <p className="account-message success" role="status">{notice}</p>}
        {busy && <p className="admin-busy"><DottedLoader label="Saving administrative change…" /></p>}

        {section === "Overview" && <OverviewPanel data={overview} />}
        {section === "Users" && <section className="admin-panel">
          <div className="admin-section-heading"><div><h2>User management</h2><p>{userTotal} registered accounts</p></div></div>
          <div className="admin-filters">
            <label>Search users<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" /></label>
            <label>Role<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">All roles</option><option value="user">User</option><option value="admin">Admin</option><option value="super_admin">Super admin</option></select></label>
            <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
          </div>
          <div className="admin-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Registered</th><th>Role</th><th>Status</th><th>Last login</th><th>Actions</th></tr></thead>
            <tbody>{users.map((item) => {
              const canChangeRole = item.id !== currentUserId && (role === "super_admin" || role === "admin" && item.role === "user");
              const roles: Role[] = role === "super_admin" ? ["user", "admin", "super_admin"] : ["user", "admin"];
              const canChangeStatus = item.id !== currentUserId && (role === "super_admin" || role === "admin" && item.role === "user");
              return <tr key={item.id}><td>{item.displayName}</td><td>{item.email}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td>
                <td>{canChangeRole ? <select aria-label={`Role for ${item.email}`} value={item.role} disabled={busy} onChange={(event) => void changeRole(item, event.target.value as Role)}>{roles.map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select> : item.role.replace("_", " ")}</td>
                <td><span className={`admin-status is-${item.status}`}>{item.status}</span></td><td>{formatDate(item.lastLoginAt)}</td>
                <td className="admin-actions"><button type="button" disabled={busy} onClick={() => void showUser(item.id)}>Details</button>{canChangeStatus && <button type="button" disabled={busy} onClick={() => void setSuspended(item)}>{item.status === "suspended" ? "Reactivate" : "Suspend"}</button>}</td>
              </tr>;
            })}</tbody></table></div>
          {users.length < userTotal && <button className="admin-secondary-button" type="button" disabled={busy} onClick={() => void runAction(() => loadUsers(true, userOffset + 25), "")}>Load more</button>}
        </section>}

        {section === "Testimonials & Reviews" && <section className="admin-panel">
          <div className="admin-section-heading"><div><h2>Testimonials &amp; Reviews</h2><p>New submissions remain private until approved.</p></div>
            <label>Filter by status<select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as Review["status"])}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label></div>
          {reviews.length === 0 ? <p className="admin-empty">No {reviewStatus} testimonials.</p> : <div className="admin-review-list">{reviews.map((review) => <article className="admin-review" key={review.id}>
            <header><span className="testimonial-stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}</span><time>{formatDate(review.createdAt)}</time></header>
            <div className="admin-review-author">{review.avatar ? <Image src={review.avatar} alt="" width={34} height={34} unoptimized /> : <span aria-hidden="true">{review.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>}<small>{review.name}{review.email ? ` · ${review.email}` : ""}{review.designation ? ` · ${review.designation}` : ""}</small></div>
            <h3>{review.title}</h3><p>{review.message}</p>
            <div className="admin-actions">{review.status !== "approved" && <button type="button" disabled={busy} onClick={() => void moderate(review, "approved")}>Approve</button>}{review.status !== "rejected" && <button type="button" disabled={busy} onClick={() => void moderate(review, "rejected")}>{review.status === "approved" ? "Remove from public display" : "Reject"}</button>}</div>
          </article>)}</div>}
        </section>}

        {section === "Release management" && <section className="admin-panel">
          <div className="admin-section-heading"><div><h2>Release management</h2><p>Release assets remain hosted by GitHub; these settings manage metadata and visibility.</p></div></div>
          {releases.length === 0 ? <p className="admin-empty">No GitHub releases are available.</p> : <div className="admin-release-list">{releases.map((release) => <ReleaseEditor key={release.tagName} release={release} disabled={busy} onSave={saveRelease} />)}</div>}
        </section>}

        {section === "Security & audit" && <SecurityPanel events={events} onFilter={async (action) => {
          setBusy(true);
          setError("");
          try {
            const params = new URLSearchParams();
            if (action) params.set("action", action);
            const result = await api<{ events: AuditEvent[] }>(`/api/admin/audit?${params}`);
            setEvents(result.events);
          } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Audit activity could not be loaded.");
          } finally {
            setBusy(false);
          }
        }} />}
      </div>
      {detail && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
        <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-user-detail-title">
          <button type="button" className="admin-modal-close" onClick={() => setDetail(null)} aria-label="Close user details">×</button>
          <h2 id="admin-user-detail-title">{detail.user.displayName}</h2><p>{detail.user.email}</p>
          <dl><dt>Role</dt><dd>{detail.user.role}</dd><dt>Status</dt><dd>{detail.user.status}{detail.user.banReason ? ` · ${detail.user.banReason}` : ""}</dd><dt>Registered</dt><dd>{formatDate(detail.user.createdAt)}</dd><dt>Last login</dt><dd>{formatDate(detail.user.lastLoginAt)}</dd><dt>Downloads</dt><dd>{detail.user.downloadCount}</dd><dt>Email verified</dt><dd>{detail.user.emailVerified ? "Yes" : "No"}</dd><dt>Phone</dt><dd>{detail.user.phoneNumber || "Not provided"}</dd><dt>Country</dt><dd>{countryOptions.find((country) => country.code === detail.user.countryCode)?.name ?? detail.user.location ?? "Not provided"}</dd><dt>City</dt><dd>{detail.user.city || "Not provided"}</dd><dt>State or region</dt><dd>{detail.user.region || "Not provided"}</dd><dt>Organization</dt><dd>{detail.user.organization || "Not provided"}</dd><dt>Position</dt><dd>{detail.user.currentPosition || "Not provided"}</dd></dl>
          <h3>Recent account activity</h3>{detail.activity.length ? <ul className="admin-events">{detail.activity.map((event) => <li key={event.id}><span><strong>{event.action}</strong><small>{event.resource}</small></span><time>{formatDate(event.timestamp)}</time></li>)}</ul> : <p>No activity recorded.</p>}
        </section>
      </div>}
    </main>
  );
}

function OverviewPanel({ data }: { data: Overview | null }) {
  if (!data) return <p className="admin-empty"><DottedLoader label="Loading overview…" /></p>;
  return <>
    <div className="admin-stats"><article><span>Registered users</span><strong>{data.totals.users}</strong></article><article><span>Active users</span><strong>{data.totals.activeUsers}</strong></article><article><span>Total downloads</span><strong>{data.totals.downloads}</strong></article><article><span>Suspended accounts</span><strong>{data.totals.suspendedUsers}</strong></article></div>
    <section className="admin-panel"><h2>User role distribution</h2><div className="admin-role-distribution">{(["user", "admin", "super_admin"] as const).map((value) => <div key={value}><span>{value.replace("_", " ")}</span><strong>{data.roleDistribution[value] ?? 0}</strong></div>)}</div></section>
    <section className="admin-panel"><h2>Latest registrations</h2>{data.latestRegistrations.length ? <div className="admin-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Registered</th></tr></thead><tbody>{data.latestRegistrations.map((item) => <tr key={item.id}><td>{item.name || "Name not provided"}</td><td>{item.email}</td><td>{item.role}</td><td>{formatDate(item.createdAt)}</td></tr>)}</tbody></table></div> : <p>No registrations yet.</p>}</section>
    <section className="admin-panel"><h2>Recent administrative activity</h2>{data.recentActivity.length ? <ul className="admin-events">{data.recentActivity.map((event) => <li key={event.id}><span><strong>{event.action}</strong><small>{event.actorEmail || "System"} · {event.resource}</small></span><time>{formatDate(event.timestamp)}</time></li>)}</ul> : <p>No audit activity recorded.</p>}</section>
  </>;
}

function ReleaseEditor({ release, disabled, onSave }: {
  release: Release;
  disabled: boolean;
  onSave: (release: Release, data: { name: string; body: string; isPublished: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState(release.name);
  const [body, setBody] = useState(release.body);
  const [isPublished, setIsPublished] = useState(release.isPublished);
  return <article className="admin-release">
    <header><h3>{release.tagName}</h3><span>{release.downloadCount} downloads</span></header>
    <label>Release title<input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} /></label>
    <label>Release notes<textarea value={body} maxLength={10_000} rows={5} onChange={(event) => setBody(event.target.value)} /></label>
    {release.installer && <p className="admin-release-asset">GitHub asset: {release.installer.name}</p>}
    <label className="admin-publish-toggle"><input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} /> Published publicly</label>
    <button className="admin-secondary-button" type="button" disabled={disabled || !name.trim()} onClick={() => void onSave(release, { name, body, isPublished })}>Save release settings</button>
  </article>;
}

function SecurityPanel({ events, onFilter }: { events: AuditEvent[]; onFilter: (action: string) => Promise<void> }) {
  const [filter, setFilter] = useState("");
  return <section className="admin-panel">
    <div className="admin-section-heading"><div><h2>Security &amp; audit activity</h2><p>Authentication events, account changes, downloads, and release actions. Audit records are read-only here.</p></div>
      <label>Action filter<input value={filter} maxLength={100} placeholder="e.g. auth.admin_login" onChange={(event) => setFilter(event.target.value)} /></label>
      <button className="admin-secondary-button" type="button" onClick={() => void onFilter(filter)}>Filter</button>
    </div>
    {events.length ? <ul className="admin-events">{events.map((event) => <li key={event.id}><span><strong>{event.action}</strong><small>{event.actorEmail || "System"} · {event.resource}{event.targetType ? ` · ${event.targetType}: ${event.targetId}` : ""}</small>{event.metadata && <small>{event.metadata}</small>}</span><time>{formatDate(event.timestamp)}</time></li>)}</ul> : <p>No matching security events.</p>}
  </section>;
}
