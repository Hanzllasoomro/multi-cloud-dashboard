"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Alert } from "../../components/ui/alert";
import { FormField } from "../../components/ui/form-field";

// Sign-in page, built from the shadcn-style ui components (see components/ui/README.md).
// MFA: when login returns 202 with a challenge token, this page switches to
// the code step instead of signing in — the session is only created after
// POST /api/auth/mfa/challenge succeeds.
function Login() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const sessionLost = search.get("session_lost") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [challengeToken, setChallengeToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  // If the server's account store is empty (e.g. it was wiped by a
  // restart on an old version), say so plainly: a 401 then means "no
  // account exists", not "wrong password". The status endpoint reveals
  // only a boolean, never emails or counts.
  useEffect(() => {
    fetch("/api/auth/status").then((r) => r.json()).then((j) => {
      if (typeof j?.data?.hasUsers === "boolean") setHasUsers(j.data.hasUsers);
    }).catch(() => undefined);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 202 && j?.data?.mfaRequired) { setChallengeToken(j.data.challengeToken); return; }
      if (!r.ok) { setErr(j.error || "Sign-in failed."); return; }
      router.push(next); router.refresh();
    } finally { setLoading(false); }
  }
  async function submitMfa(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setMfaLoading(true);
    try {
      const r = await fetch("/api/auth/mfa/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeToken, code: mfaCode }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "Incorrect code."); return; }
      router.push(next); router.refresh();
    } finally { setMfaLoading(false); }
  }
  async function demo() {
    setErr(""); setDemoLoading(true);
    try {
      const r = await fetch("/api/auth/demo", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "Demo sign-in is disabled."); return; }
      router.push("/demo"); router.refresh();
    } finally { setDemoLoading(false); }
  }
  return (
    <div style={{ maxWidth: 440, margin: "48px auto" }}>
      <Card>
        <CardHeader>
          <CardTitle>Sign in to Ledger</CardTitle>
          <CardDescription>Monitor billing, usage, budgets and recommendations across AWS, Azure and GCP in one place.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionLost && (
            <div style={{ marginBottom: 12 }}>
              <Alert>Account created, but your session wasn&apos;t saved — please sign in with the email and password you just created.</Alert>
            </div>
          )}
          {hasUsers === false && (
            <div style={{ marginBottom: 12 }}>
              <Alert>No accounts exist on this server yet — create the first one (it becomes the Owner).</Alert>
            </div>
          )}
          {err && <div style={{ marginBottom: 12 }}><Alert variant="destructive">{err}</Alert></div>}
          {challengeToken && (
            <form onSubmit={submitMfa} style={{ marginBottom: 16 }}>
              <p className="small"><strong>Two-factor authentication.</strong> Enter the 6-digit code from your authenticator app — or one of your backup codes (XXXX-XXXX).</p>
              <FormField id="mfa-code" label="Authentication code" autoComplete="one-time-code" required value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} />
              <Button type="submit" loading={mfaLoading} style={{ width: "100%" }}>Verify and sign in</Button>
              <p className="caption" style={{ marginTop: 8 }}>The code step expires after 5 minutes. <button type="button" className="btn-ghost" style={{ padding: "2px 8px" }} onClick={() => { setChallengeToken(""); setMfaCode(""); }}>Back to password sign-in</button></p>
            </form>
          )}
          <form onSubmit={submit}>
            <FormField id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <FormField id="password" label="Password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} description="Minimum 12 characters." />
            <label className="small" style={{ display: "block", marginBottom: 14 }}>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
            </label>
            <Button type="submit" loading={loading} style={{ width: "100%" }}>Sign in</Button>
          </form>
          <p className="caption" style={{ marginTop: 12 }}>
            No account yet? <Link href="/register">Create one</Link> — the first account registered becomes the Owner.
            Forgot your password? <Link href="/forgot-password">Reset it</Link>.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" loading={demoLoading} onClick={demo} style={{ width: "100%" }}>
            Continue with demo account
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="small">Loading sign-in…</p>}>
      <Login />
    </Suspense>
  );
}
