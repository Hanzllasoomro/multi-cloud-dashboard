// shadcn-style Card primitives, built on Ledger tokens (see components/ui/README.md).
import React from "react";

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="card" style={style}>{children}</div>;
}
export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}>{children}</div>;
}
export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: 0 }}>{children}</h2>;
}
export function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>{children}</p>;
}
export function CardContent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
export function CardFooter({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>;
}
export default Card;
