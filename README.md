# casino-platform-skin-1 — ChoCho

The player-facing skin front, greenfield (P3-16). Per ADR-16 the model is **fork per skin**: this repo is the
primary skin, ChoCho (Philippines, PHP, `en-PH` + `fil`), and the base a future brand fork starts from. Keep the
fork thin: the API client is generated, shared logic lives in `src/lib`, the fork owns look, layout and content.

**The design is the spec:** `design/chocho/` — the owner's Claude Design project (17 documents, a site map, a
measured banner specification). `ChoCho UI Foundations.dc.html` holds every token; each page's `renderVals()` is
the response shape the screen expects. Read them, never ship them.

## Stack (the back-office front's, on purpose)

Vite · React 19 · TypeScript · TanStack Router (file routes) · TanStack Query (all server state) · react-hook-form +
zod (all forms) · openapi-fetch with types generated from **the gateway's aggregated OpenAPI** (P3-26) · i18next ·
Tailwind 4 with the ChoCho tokens as CSS variables (`--cc-*`).

Same house rules as `casino-platform-backoffice`: every read is `useQuery`, every write `useMutation` with both
outcomes handled, every form is RHF + zod, no hand-written fetch (lint refuses it), all copy through the catalog.

## How it talks to the platform

- **One origin.** Everything is `/api/*` on the skin's own origin. In dev, Vite proxies `/api` to the gateway
  (`VITE_API_TARGET`, default `http://127.0.0.1:5000`); in the container, Caddy does (prefix kept). The gateway
  resolves the skin from the Host — the laptop stack's `skin-test` serves `127.0.0.1` and `localhost`.
- **Cookie mode (P3-04).** Sign-up, sign-in, Telegram and refresh answer `{expiresAt, sessionId}`; the tokens are
  httpOnly cookies the page never sees. A 401 outside identity's auth routes triggers ONE refresh (empty body)
  and a replay; a failed refresh ends the session and the shared dialog opens over the page.
- **Who is signed in** is answered by `GET /api/id/sessions` (identity has no player "me" endpoint yet — P3-24).
- **Google with callback** (owner decision 2026-09-24): `GET /api/id/auth/google?callbackUrl=…` → navigate → the
  gateway lands the browser on `/auth/callback#login=ok&…`, cookies already set.
- **Verify-email** lands on `/verify-email?email=&token=` (identity's parity link shape) and posts the pair once.
- **Attribution**: `?externaldatakey=` / `?aff=` and `?source=` on the landing URL are kept for the session and
  sent at signup as identity's `externaldatakey` / `X-Source` headers.

## Commands

```bash
npm run dev          # :3002, proxied to the gateway on :5000
npm run api:sync     # openapi/gateway.json ← the gateway's /openapi/v1.json, then src/api/schema.d.ts
npm test             # vitest + msw
npm run e2e          # playwright in the installed Chrome against the laptop stack + dev server
npm run e2e:lobby    # the lobby pages through the compose skin front (:3003) on a throwaway skin + host
```

`e2e/smoke.mjs` signs up a throwaway player through the edge, reads the verification link from identity's staged
`comms.requests` outbox row (via the compose stack's Postgres), verifies, lists sessions, signs out and back in,
and proves sign-out-everywhere kills the old cookies.

`e2e/lobby.mjs` (P3-27) seeds a throwaway skin on its own host (`p327-<id>.localhost`) over core's HMAC admin surface —
games, categories, providers, HOT picks, promotions with terms, a hero banner — waits for the gateway to learn the
host, then walks Home, Games (category, provider, search, reload, Load More, a stale thumbnail, a hidden game), a
game page and Promotions as a guest, and the ♥ as a new player. It needs `CORE_HMAC_BACKOFFICE_SECRET` in the
backend's `deploy/.env` and a rebuilt `skin-front` container; screenshots at 375 and 1280 land in `e2e/shots/`
(ignored). It signs up one player, so it shares the laptop's signup throttle — restart gateway and identity after a
burst of runs.

## What is here, and what waits on other cards

| Built | Waits on |
|---|---|
| Shell: header, bottom nav, footer, canvas, tokens, i18n bootstrap (`en-PH`, `fil`) | Live header balance from core's hub (next P3-16 increment) |
| The shared auth dialog: sign in (+ TOTP step), register (consent, attribution), forgot → reset code, Google, Telegram widget | Phone-number accounts — the design's default tab says so ([P3-24]) |
| `/verify-email`, `/auth/callback` | Player profile, contact changes ([P3-24]); verification ([P3-25]) |
| My Account → Security (change password, two-factor) and Sessions (per-device sign-out, everywhere) | Profile / Preferences / Bonuses tabs ([P3-24], [P3-12], [P5-07]) |
| Wallet and My Account sign-in gates | Cashier screens — no design yet (owner) |
| Home (hero, Hot Games, Quick Play, Bonuses), Games (search, pills, providers, sort, favourites, Load More), game page, Promotions (pills, featured, terms) — on core's lobby reads ([P3-27]) | Game launch — the design has no game container (owner); the play buttons are shown disabled |
| The ♥ on every card, the Favourite Games rail, favourites-only | "My Promotions" (bonus's active list) and the promotions FAQ (owner copy) |
| VIP, Info frames | VIP benefits and info-page copy (owner) |
