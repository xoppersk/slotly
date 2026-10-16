export default function Loading() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--linen)",
        color: "var(--muted)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <p>Loading…</p>
    </main>
  );
}
