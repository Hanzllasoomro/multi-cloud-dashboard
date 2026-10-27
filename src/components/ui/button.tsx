// shadcn-style Button, built on Ledger tokens (see components/ui/README.md).
import React from "react";

type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "default" | "lg";

const sizeStyle: Record<Size, React.CSSProperties> = {
  sm: { padding: "6px 10px", fontSize: 13 },
  default: { padding: "8px 14px", fontSize: 14 },
  lg: { padding: "11px 20px", fontSize: 15 },
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size; loading?: boolean;
}

export function Button({ variant = "default", size = "default", loading = false, disabled, style, children, ...props }: ButtonProps) {
  const base: React.CSSProperties = { borderRadius: "var(--radius-full)", fontWeight: 600, cursor: disabled || loading ? "not-allowed" : "pointer", opacity: disabled || loading ? 0.6 : 1, ...sizeStyle[size] };
  const byVariant: Record<Variant, React.CSSProperties> = {
    default: { background: "var(--action-primary)", color: "#fff", border: "0" },
    secondary: { background: "var(--bg-sunken)", color: "var(--text-primary)", border: "1px solid var(--border-default)" },
    outline: { background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)" },
    ghost: { background: "transparent", color: "var(--text-primary)", border: "1px solid transparent" },
    destructive: { background: "var(--red-700)", color: "#fff", border: "0" },
  };
  return (
    <button {...props} disabled={disabled || loading} aria-busy={loading} style={{ ...base, ...byVariant[variant], ...style }}>
      {loading ? "Working…" : children}
    </button>
  );
}
export default Button;
