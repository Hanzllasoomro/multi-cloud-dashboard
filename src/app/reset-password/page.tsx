"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Alert } from "../../components/ui/alert";
import { FormField } from "../../components/ui/form-field";

// Reset password with a token. On success all sessions are revoked, so
// you must sign in again with the new password.
function ResetPassword() {
  const search = useSearchParams();
  const [token, setToken] = useState(search.get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/reset/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, newPassword }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "Reset failed."); return; }
      setDone(true);
    } finally { setLoading(false); }
  }
  return (
    <div style={{ maxWidth: 440, margin: "48px auto" }}>
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>Minimum 12 characters. Resetting signs you out everywhere.</CardDescription>
        </CardHeader>
        <CardContent>
          {err && <div style={{ marginBottom: 12 }}><Alert variant="destructive">{err}</Alert></div>}
          {done ? (
            <div>
              <Alert>Password reset. All sessions were revoked — sign in with your new password.</Alert>
              <p style={{ marginTop: 12 }}><Link href="/login" className="btn">Sign in →</Link></p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <FormField id="token" label="Reset token" required value={token} onChange={(e) => setToken(e.target.value)} />
              <FormField id="new-password" label="New password" type="password" autoComplete="new-password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} description="Minimum 12 characters." />
              <Button type="submit" loading={loading} style={{ width: "100%" }}>Reset password</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="small">Loading…</p>}>
      <ResetPassword />
    </Suspense>
  );
}
