import Link from "next/link";

export default function NotFound() {
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
        This page isn&rsquo;t here.
      </h1>
      <p style={{ color: "var(--ink-2)", margin: 0 }}>The page you asked for doesn&rsquo;t exist.</p>
      <Link href="/" style={{ color: "var(--oxblood)", fontWeight: 600 }}>
        Back to Slotly
      </Link>
    </main>
  );
}
