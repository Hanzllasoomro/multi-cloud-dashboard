// shadcn-style FormField: label + input + description + error, wired for
// screen readers (aria-describedby, aria-invalid). Built on Ledger tokens.
import React from "react";
import { Input } from "./input";
import { Label } from "./input";

export interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string; label: string; description?: string; error?: string;
}

export function FormField({ id, label, description, error, ...inputProps }: FormFieldProps) {
  const descId = description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div style={{ marginBottom: 14 }}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-describedby={describedBy} aria-invalid={!!error} {...inputProps} />
      {description && <p id={descId} className="caption" style={{ marginTop: 4 }}>{description}</p>}
      {error && <p id={errId} role="alert" style={{ marginTop: 4, fontSize: 13, color: "var(--status-danger-text)" }}>{error}</p>}
    </div>
  );
}
export default FormField;
