# Ledger UI components — shadcn-style, not a shadcn CLI install

## Honest note (read this first)

These components follow **shadcn's API conventions** — the prop names and
variants developers expect (`Button variant="destructive" size="sm"`,
`Card` / `CardHeader` / `CardTitle` / `CardContent`, `FormField` with
label + description + error) — but they are **not** produced by the shadcn
CLI and this app does **not** use Tailwind.

Why: Ledger already has its own design system (see `src/app/globals.css`
and `DESIGN_SYSTEM.md`) built on CSS custom properties — primitive
neutrals, blue `#2756D6`, semantic bg/text/border/status tokens, radius
and elevation scales. A literal shadcn install would force a Tailwind
migration and break those tokens, the dark mode, and the contrast rules
(status text at the 700 step, never colour alone).

So: same developer-facing API, implemented on top of the existing Ledger
tokens. Do not claim a shadcn CLI install anywhere in the app or docs.

## Components

- `button.tsx` — `Button`: variants `default | secondary | outline | ghost | destructive`,
  sizes `sm | default | lg`, `loading` state (disables + `aria-busy`, keeps its width).
- `input.tsx` — `Input` (full-width, Ledger `.input` class) and `Label`.
- `card.tsx` — `Card`, `CardHeader`, `CardTitle`, `CardDescription`,
  `CardContent`, `CardFooter`.
- `alert.tsx` — `Alert`: variants `default | destructive | success`, always
  with text + `role="alert"` (never colour alone).
- `form-field.tsx` — `FormField`: label + input + optional description +
  error, wired with `aria-describedby` / `aria-invalid`.

All components accept standard HTML props passthrough, honour
`:focus-visible` from `globals.css` (2px blue ring), and use semantic
tokens only — no hard-coded colours, spacing, or font sizes.
