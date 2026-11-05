"use client";

import Link from "next/link";

export function ErrorFallback({ retry, digest }: { retry: () => void; digest?: string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        color: "#f4f7ff",
        background: "#080f1c",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section style={{ width: "min(100%, 520px)", textAlign: "center" }}>
        <p style={{ color: "#65c6ff", fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>PRIVSENTINEL</p>
        <h1 style={{ fontSize: 30 }}>We hit a temporary problem</h1>
        <p style={{ color: "#b9c9e0", lineHeight: 1.6 }}>
          This page could not be loaded. Please try again or return to the homepage.
        </p>
        {digest && <p style={{ color: "#91a6c5", fontSize: 12 }}>Reference: {digest}</p>}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 24 }}>
          <button
            type="button"
            onClick={retry}
            style={{
              minHeight: 42,
              padding: "0 18px",
              border: 0,
              borderRadius: 8,
              color: "#fff",
              background: "#0879f4",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{
              minHeight: 42,
              display: "inline-flex",
              alignItems: "center",
              padding: "0 18px",
              border: "1px solid #385777",
              borderRadius: 8,
              color: "#dcecff",
              textDecoration: "none",
            }}
          >
            Return home
          </Link>
        </div>
      </section>
    </main>
  );
}
