"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Alert } from "../../components/ui/alert";
import { FormField } from "../../components/ui/form-field";

// Forgot password: request a reset token. The response is the same whether
// or not the email exists. Ledger has no email provider configured, so in
// non-production runs the token is shown here — copy it into the reset
// page. In production, wire an email sender and do not return the token.
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ resetToken?: string; expiresAt?: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/reset/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "Request failed."); return; }
      setResult(j.data || {});
    } finally { setLoading(false); }
  }
  return (
    <div style={{ maxWidth: 440, margin: "48px auto" }}>
      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Enter your email. If an account exists, a reset token is created (valid 1 hour, single use).</CardDescription>
        </CardHeader>
        <CardContent>
          {err && <div style={{ marginBottom: 12 }}><Alert variant="destructive">{err}</Alert></div>}
          {result ? (
            <div>
              <Alert>Request received. If an account exists for that email, a reset token was created and expires {result.expiresAt ? new Date(result.expiresAt).toLocaleString() : "in 1 hour"}.</Alert>
              {result.resetToken && (
                <div style={{ marginTop: 12 }}>
                  <p className="small"><strong>Your reset token (shown here because no email provider is configured):</strong></p>
                  <p className="small" style={{ wordBreak: "break-all" }}><code>{result.resetToken}</code></p>
                  <p className="caption">Copy it, then continue to the reset page. Anyone with this token can reset the password — treat it like a password.</p>
                  <Link href={`/reset-password?token=${encodeURIComponent(result.resetToken)}`} className="btn" style={{ display: "inline-block", marginTop: 8 }}>Continue to reset →</Link>
                </div>
              )}
              <p className="caption" style={{ marginTop: 12 }}><Link href="/login">Back to sign-in</Link></p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <FormField id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" loading={loading} style={{ width: "100%" }}>Request reset</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
