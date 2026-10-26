"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Alert } from "../../components/ui/alert";
import { FormField } from "../../components/ui/form-field";

// Sign-in page, built from the shadcn-style ui components (see components/ui/README.md).
// No password reset flow exists yet (see docs/SECURITY.md): until email reset
// is built, reset is via an admin — the copy below says so, honestly.
function Login() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "Sign-in failed."); return; }
      router.push(next); router.refresh();
    } finally { setLoading(false); }
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
          {err && <div style={{ marginBottom: 12 }}><Alert variant="destructive">{err}</Alert></div>}
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
            Password reset is via an admin until email reset exists (see docs/SECURITY.md).
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" loading={demoLoading} onClick={demo} style={{ width: "100%" }}>
            Continue with demo account
          </Button>
        </CardFooter>
      </Card>
      <p className="caption" style={{ marginTop: 12 }}>
        Demo sign-in only works when the server sets LEDGER_DEMO_AUTH=true, and it always creates a
        <strong> Viewer</strong> session — never an Owner. When the flag is off, this button is rejected with a clear message.
      </p>
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
