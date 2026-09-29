# Security Policy

Fatorati is a client-side financial/compliance app for Moroccan small
businesses and artisans. This document describes what's actually in place,
how to report a problem, and — importantly — what is *not* yet in place, so
nobody assumes more coverage than exists.

## Reporting a vulnerability

Please report privately, not via a public GitHub issue.

- Email: **security@fatorati.tech** (see [`/.well-known/security.txt`](public/.well-known/security.txt))
- Include: what you found, steps to reproduce, and the potential impact.
- You'll get an acknowledgement within **3 business days** and a status
  update at least every **7 days** until it's resolved.
- Please give us a reasonable window to fix an issue before any public
  disclosure. We don't currently run a paid bug bounty.

## Supported versions

This project ships as a single rolling `main` branch deployed to production
— there are no maintained older versions. Security fixes land on `main` and
deploy on the next push.

## What's currently implemented

**Transport & browser hardening** (`public/_headers`, enforced by Cloudflare
Pages on every response):
- Content-Security-Policy scoped to what the app actually loads (self JS/CSS,
  Google Fonts, `data:` URIs for uploaded logos) — blocks arbitrary inline
  script injection and external script loading
- `Strict-Transport-Security` (2yr, includeSubDomains, preload)
- `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` — clickjacking
- `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy: same-origin`
- Hardened `Permissions-Policy` (camera, mic, geolocation, payment, USB,
  sensors, FLoC all denied)
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`

**Application layer**:
- Free-text input passed into the store is sanitized (`sanitize()` in
  `src/store/useMizan.ts`) before being persisted — strips control
  characters and angle brackets, caps length
- No use of `dangerouslySetInnerHTML`, `eval`, or `new Function` anywhere in
  the app — React's default escaping is relied on and not bypassed
- Automatic sign-out after 20 minutes of inactivity
  (`src/lib/useIdleLogout.ts`) — mitigates an unlocked tab left open on a
  shared device
- Role-based module visibility for non-owner team members
  (`allowed` permission check in `src/App.tsx`)
- Uploaded logos are read as `data:` URIs client-side only — never uploaded
  anywhere

**Supply chain**:
- `.github/dependabot.yml` — weekly automated PRs for npm and GitHub Actions
  dependency updates
- `.github/workflows/deploy.yml` runs a type-check (`tsc --noEmit`) before
  every deploy

## Known limitations — read before handling real client data

This is the most important part of this document.

**There is no backend, and therefore no real authentication.** The
"Connexion" screen collects a name, email, and a self-selected role
(including "owner," which grants full access) and stores it in
`localStorage` via `zustand/persist` — it does not check a password or
verify identity against anything. Anyone with access to the deployed URL can
sign in as anyone, with any role, and see or edit all data in that browser's
local storage.

Concretely, this means:
- **All data lives in the browser's `localStorage`**, not on a server.
  Nothing here is currently multi-user, multi-device, or backed up.
  Clearing browser storage deletes everything.
- The CSP, HSTS, idle-logout, and input sanitization above harden the
  *browser environment* and reduce the blast radius of client-side bugs
  (XSS, clickjacking, session-left-open) — none of them are access control.
  They don't stop someone from opening the site and clicking "Se connecter."
- Role-based permission checks (`allowed` in `App.tsx`) run entirely in the
  client and can be bypassed by anyone with browser devtools. They're useful
  for UX (hiding irrelevant modules from non-owner roles) but are not a
  security boundary.

**Before this app handles real client financial data, it needs:**
1. A real backend with server-issued sessions (e.g. signed, HTTP-only
   cookies) and password or OAuth-based authentication
2. Server-side enforcement of role permissions on every read/write —
   never trust the client's `allowed` object
3. Data persisted server-side (with backups), not solely in `localStorage`
4. Input validation repeated server-side (never trust that client-side
   `sanitize()` ran)
5. Rate limiting / brute-force protection on whatever auth endpoint replaces
   the current form
6. An actual privacy/data-processing review for Loi 09-08 (CNDP) compliance
   — the login screen references it, but real compliance requires real data
   handling safeguards behind it, not just the disclosure text

Until then, treat this as a **demo/prototype data model**: fine for trying
out the UI and workflows, not for anyone's real invoices, contracts, or
client records.
