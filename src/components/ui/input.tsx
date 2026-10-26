// shadcn-style Input / Label, built on Ledger tokens (see components/ui/README.md).
import React from "react";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="input" style={{ width: "100%", ...props.style }} aria-invalid={props["aria-invalid"]} />;
}

export function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>
      {children}
    </label>
  );
}
export default Input;
