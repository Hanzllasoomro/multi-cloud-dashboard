// shadcn-style Alert, built on Ledger tokens (see components/ui/README.md).
// Tone is never colour alone: every alert carries a text label + role.
import React from "react";

type Variant = "default" | "destructive" | "success";
const styles: Record<Variant, React.CSSProperties> = {
  default: { background: "var(--status-info-bg)", color: "var(--status-info-text)", borderColor: "var(--sky-200)" },
  destructive: { background: "var(--status-danger-bg)", color: "var(--status-danger-text)", borderColor: "var(--red-200)" },
  success: { background: "var(--status-success-bg)", color: "var(--status-success-text)", borderColor: "var(--green-200)" },
};
export function Alert({ variant = "default", children, role = "alert" }: { variant?: Variant; children: React.ReactNode; role?: string }) {
  return (
    <div role={role} style={{ border: "1px solid", borderRadius: "var(--radius-8)", padding: "10px 14px", fontSize: 13, ...styles[variant] }}>
      {children}
    </div>
  );
}
export default Alert;
