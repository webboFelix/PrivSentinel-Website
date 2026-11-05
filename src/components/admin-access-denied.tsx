import Link from "next/link";

export function AdminAccessDenied({ description }: { description: string }) {
  return (
    <main className="auth-page">
      <div className="auth-wrap">
        <section className="auth-card" role="alert" aria-labelledby="admin-access-denied-title">
          <span className="auth-eyebrow">403 · ACCESS DENIED</span>
          <h1 id="admin-access-denied-title">You can’t access this page.</h1>
          <p className="auth-description">{description}</p>
          <Link className="auth-submit" href="/">Return to home</Link>
        </section>
      </div>
    </main>
  );
}
