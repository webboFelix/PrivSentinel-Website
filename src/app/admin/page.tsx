import { count, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getDb } from "@/db";
import { auditLogs, downloads, profiles, releases, user } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { isAdministrator } from "@/lib/permissions";

export default function AdminPage() {
  return <Suspense fallback={<main className="admin-page"><div className="account-loading"><span className="loading-dot" /> Loading secure administration…</div></main>}><AdminContent /></Suspense>;
}

async function AdminContent() {
  await connection();
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) redirect("/login?next=%2Fadmin");
  if (!isAdministrator(session.user)) redirect("/dashboard");

  const db = getDb();
  const [userCount, downloadCount, users, events, releaseRows, recentDownloads] = await Promise.all([
    db.select({ value: count() }).from(user),
    db.select({ value: count() }).from(downloads),
    db.select({
      id: user.id,
      fullName: profiles.fullName,
      email: user.email,
      createdAt: user.createdAt,
      role: user.role,
    }).from(user).leftJoin(profiles, eq(user.id, profiles.userId)).orderBy(desc(user.createdAt)).limit(100),
    db.select({
      action: auditLogs.action,
      resource: auditLogs.resource,
      timestamp: auditLogs.timestamp,
    }).from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(25),
    db.select({
      tagName: releases.tagName,
      releaseName: releases.releaseName,
      publishedAt: releases.publishedAt,
      installerName: releases.installerName,
    }).from(releases).orderBy(desc(releases.publishedAt)).limit(20),
    db.select({
      email: user.email,
      tagName: releases.tagName,
      assetName: downloads.assetName,
      downloadedAt: downloads.downloadedAt,
    }).from(downloads)
      .innerJoin(user, eq(downloads.userId, user.id))
      .innerJoin(releases, eq(downloads.releaseId, releases.id))
      .orderBy(desc(downloads.downloadedAt))
      .limit(50),
  ]);

  return <main className="admin-page">
    <header className="admin-header"><Link href="/" className="admin-brand"><Image src="/PrivSentinel.png" alt="" width={36} height={36} /> <span className="brand-name">Priv<span>Sentinel</span></span></Link><Link href="/dashboard">Return to account</Link></header>
    <div className="admin-main">
      <span className="section-kicker">PRIVSENTINEL ADMINISTRATION</span>
      <h1>Operations overview</h1>
      <p className="admin-lede">Restricted account, release and download activity. User details are only available to administrators.</p>
      <div className="admin-stats"><article><span>Registered users</span><strong>{userCount[0]?.value ?? 0}</strong></article><article><span>Recorded downloads</span><strong>{downloadCount[0]?.value ?? 0}</strong></article><article><span>Recent audit events</span><strong>{events.length}</strong></article></div>
      <section className="admin-panel"><h2>Registered users</h2><div className="admin-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Registered</th><th>Role</th></tr></thead><tbody>{users.map((item) => <tr key={item.id}><td>{item.fullName ?? "Profile incomplete"}</td><td>{item.email}</td><td>{item.createdAt.toLocaleDateString()}</td><td>{item.role}</td></tr>)}</tbody></table></div></section>
      <section className="admin-panel"><h2>Recent audit events</h2>{events.length === 0 ? <p>No audit activity recorded.</p> : <ul className="admin-events">{events.map((event, index) => <li key={`${event.timestamp.toISOString()}-${index}`}><span><strong>{event.action}</strong><small>{event.resource}</small></span><time>{event.timestamp.toLocaleString()}</time></li>)}</ul>}</section>
      <section className="admin-panel"><h2>Release information</h2>{releaseRows.length === 0 ? <p>No release metadata has been cached yet. Open the public releases page to refresh it.</p> : <div className="admin-table-wrap"><table><thead><tr><th>Version</th><th>Release</th><th>Published</th><th>Installer</th></tr></thead><tbody>{releaseRows.map((item) => <tr key={item.tagName}><td>{item.tagName}</td><td>{item.releaseName}</td><td>{item.publishedAt?.toLocaleDateString() ?? "Not provided"}</td><td>{item.installerName ?? "Not found"}</td></tr>)}</tbody></table></div>}</section>
      <section className="admin-panel"><h2>Recent download history</h2>{recentDownloads.length === 0 ? <p>No installer downloads recorded.</p> : <div className="admin-table-wrap"><table><thead><tr><th>Account</th><th>Version</th><th>Asset</th><th>Downloaded</th></tr></thead><tbody>{recentDownloads.map((item, index) => <tr key={`${item.downloadedAt.toISOString()}-${index}`}><td>{item.email}</td><td>{item.tagName}</td><td>{item.assetName}</td><td>{item.downloadedAt.toLocaleString()}</td></tr>)}</tbody></table></div>}</section>
    </div>
  </main>;
}
