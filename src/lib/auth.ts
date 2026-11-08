// Ledger — authentication core (v1.6).
//
// The auth backend is now modular: src/lib/auth/ holds password hashing,
// TOTP, the file-backed store, MFA, password reset, API keys and audit
// logging; this file re-exports that whole surface so existing imports
// (routes, guards, tests) keep working unchanged. See docs/SECURITY.md
// for the security properties and what is still not built (SSO/SCIM,
// WebAuthn, email delivery for reset — the reset token is returned in
// non-production runs until an email provider is wired in).
export * from "./auth/index";
