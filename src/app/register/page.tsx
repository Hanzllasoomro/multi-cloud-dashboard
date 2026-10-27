"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Alert } from "../../components/ui/alert";
import { FormField } from "../../components/ui/form-field";

// Registration page, built from the shadcn-style ui components.
// Bootstrap rule (see src/lib/auth.ts): the FIRST registered user becomes
// Owner; every later registration defaults to Viewer, visible in
// Settings > Team members for an Owner/Admin to promote.
export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "Registration failed."); return; }
      // Never land on a page that immediately bounces to /login with no
      // explanation (the v1.3.0 bug: the account existed in one server
      // instance but the session was lost before the next request).
      // Verify the session first; if it is not there, send the user to
      // /login with an honest message instead of a silent sign-out.
      const me = await fetch("/api/auth/me").catch(() => null);
      if (!me || !me.ok) {
        router.push("/login?session_lost=1");
        return;
      }
      router.push("/"); router.refresh();
    } finally { setLoading(false); }
  }
  return (
    <div style={{ maxWidth: 440, margin: "48px auto" }}>
      <Card>
        <CardHeader>
          <CardTitle>Create your Ledger account</CardTitle>
          <CardDescription>
            The first account registered on a fresh install becomes the Owner. Later accounts start as
            Viewers — an Owner or Admin can promote them in Settings &gt; Team members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {err && <div style={{ marginBottom: 12 }}><Alert variant="destructive">{err}</Alert></div>}
          <form onSubmit={submit}>
            <FormField id="name" label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} description="Shown in the header and audit log." />
            <FormField id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <FormField id="password" label="Password" type={show ? "text" : "password"} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} description="Minimum 12 characters. Common passwords are rejected." />
            <label className="small" style={{ display: "block", marginBottom: 14 }}>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
            </label>
            <Button type="submit" loading={loading} style={{ width: "100%" }}>Create account</Button>
          </form>
          <p className="caption" style={{ marginTop: 12 }}>Already have an account? <Link href="/login">Sign in</Link>.</p>
        </CardContent>
      </Card>
    </div>
  );
}
