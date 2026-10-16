"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        background: "var(--linen)",
        color: "var(--ink)",
        fontFamily: "var(--font-sans)",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "44px", fontWeight: 600, margin: 0 }}>
        Something went wrong.
      </h1>
      <p style={{ color: "var(--ink-2)", margin: 0 }}>Sorry — that one&rsquo;s on us. Try again.</p>
      <button
        onClick={reset}
        style={{
          background: "var(--oxblood)",
          color: "var(--on-oxblood)",
          border: "none",
          borderRadius: "var(--radius-pill)",
          padding: "12px 24px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </main>
  );
}
