// Ledger logo (v1.10.1 redesign).
//
// The old mark was a plain ✓ in a green circle — it said "done", not
// "ledger". The new mark is the product in miniature: three ascending bars
// (spend, tracked and compared across the three clouds) inside a deep-forest
// rounded square, the same forest as the app's hero cards. One component,
// used in the app shell, on the homepage and as the favicon, so the mark is
// identical everywhere. No text inside the SVG — the wordmark "Ledger" sits
// next to it in the layout.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Ledger logo" aria-hidden="false">
      <defs>
        <linearGradient id="ledger-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1F6B40" />
          <stop offset="100%" stopColor="#0E2F20" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#ledger-mark-g)" />
      <rect x="7" y="17" width="4.5" height="8" rx="2" fill="#FFFFFF" opacity="0.6" />
      <rect x="13.75" y="12" width="4.5" height="13" rx="2" fill="#FFFFFF" opacity="0.85" />
      <rect x="20.5" y="7" width="4.5" height="18" rx="2" fill="#FFFFFF" />
    </svg>
  );
}
