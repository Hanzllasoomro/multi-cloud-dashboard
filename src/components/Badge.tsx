const tones: Record<string, { bg: string; fg: string; icon: string }> = {
  success: { bg: "var(--status-success-bg)", fg: "var(--status-success-text)", icon: "✓" },
  warning: { bg: "var(--status-warning-bg)", fg: "var(--status-warning-text)", icon: "⚠" },
  danger: { bg: "var(--status-danger-bg)", fg: "var(--status-danger-text)", icon: "●" },
  info: { bg: "var(--status-info-bg)", fg: "var(--status-info-text)", icon: "ℹ" },
  neutral: { bg: "var(--bg-sunken)", fg: "var(--text-secondary)", icon: "○" },
};
// Never colour alone: every badge carries an icon + text, and status text uses the 700 step.
export default function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  const t = tones[tone];
  return <span style={{ display: "inline-flex", gap: 6, alignItems: "center", background: t.bg, color: t.fg, borderRadius: "var(--radius-full)", padding: "2px 10px", fontSize: 12, fontWeight: 600 }}><span aria-hidden>{t.icon}</span>{children}</span>;
}
