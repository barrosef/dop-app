# Onboarding journey — implementation and verification

Date: 2026-10-14.
Source: `2026-10-14-onboarding-journey-replit-prompt-2.md` and
`2026-09-20-onboarding-journey.md`.

Checked implementation below does not imply authenticated QA acceptance.
No QA users, credentials, resources or other records were created for testing.

## Implementation checklist

- [x] Pulled `origin/dev`; its tip named the second onboarding prompt.
- [x] Six `/welcome/*` routes outside the shell, session and verified-email gates, shared layout with Outlet.
- [x] Central shell gate reads `me.onboarded` and the API's `current`; reverse gate for onboarded users.
- [x] Explicit welcome URLs are preserved on reload; no localStorage step decisions.
- [x] Old `/onboarding` route and page removed.
- [x] Rail reads API step order/status; skipped is neutral; mobile progress strip.
- [x] Bilingual narrative explains purpose, use of answers and optional-step tradeoffs.
- [x] Shared API errors expose 412 detail, named-step links, retry delay and remaining attempts.
- [x] Profile: prefill, avatar/initials, verification badge, debounced handle check/suggestion, own-handle handling, detected locale/timezone, optional birth date; changed-fields patches before recording.
- [x] Contact: phone patch before SMS enrollment, six-digit OTP, increasing resend delay, correction, visible skip, API recording; confirmation retry avoids reusing a confirmed challenge.
- [x] Code/tasks: catalogue categories, API branding and operated badge, shared tiles/sheet, copyable permissions/docs/base URL/token, create then credential, connection check and existing integrations.
- [x] Partial resource-creation failures can retry credential storage without creating another resource in the current mounted flow.
- [x] Required-step skips reach the API; no local required-step prohibition.
- [x] Plan: API order, recorded/first selection, no price or price placeholder, set plan before recording.
- [x] Enterprise contact is read from configuration, not a screen literal; unset configuration is explicitly displayed.
- [x] Ready: API checklist, plan lookup, Security action, one primary action, secondary cockpit action, complete before exit and named-step refusal.
- [x] First project creation uses the active personal account's tree and generated create hook; repositories are explicitly unavailable rather than simulated.
- [x] Sign-up: two halves, inline email form, Firebase password policy, strength feedback, existing provider-link/error decisions.
- [x] Verify email: visible countdown, wrong-address exit, existing rate-limit handling, pending resend protection.
- [x] Named primary actions, loading/error/empty presentation, existing UI components.
- [x] Both language maps updated; old wizard keys removed.

## Verified

- [x] `pnpm typecheck`.
- [x] `pnpm --filter @workspace/dop run test`: 35 tests pass.
- [x] `PORT=5173 BASE_PATH=/ pnpm build`: all builds completed; nonblocking large-bundle warning remains.
- [x] `git diff --check`.
- [x] No edits to OpenAPI, generated client or custom-fetch.
- [x] No manual fetch, native button/input/select, or literal component colors in new journey/entry screens; provider color comes from API.
- [x] Browser: signup desktop and 390px mobile; inline expansion, password feedback, keyboard interactions; no horizontal clipping observed.
- [x] Browser: `/onboarding` renders the app's 404.
- [x] Browser: unauthenticated `/welcome/code` and `/verify-email` redirect to sign-in.
- [x] No runtime app errors observed in this browser pass.

## QA acceptance still pending

No authenticated session was available; these items are implemented but not
validated against live authenticated responses:

- [ ] New Google account traverses signup to ready and reaches a personal workspace in the cockpit.
- [ ] Skipping contact/tasks persists and appears in the rail.
- [ ] Skipping code returns the real 412 detail.
- [ ] Completing before plan returns the named step and its link.
- [ ] Authenticated hard reload on `/welcome/code` stays there.
- [ ] Onboarded user visiting `/welcome/plan` returns to `/`.
- [ ] Every authenticated screen, sheet and rail is visually verified at 390px and keyboard-tested.
- [ ] SMS delivery/verification and real integration credentials work against their providers.

## i18n

| Map | Before | After | Net change |
|---|---:|---:|---:|
| pt-BR | 744 | 911 | +167 |
| en | 744 | 911 | +167 |

Removed 26 `wizard.onboarding.*` keys per map; added 193 keys per map.
Key and interpolation parity are covered by the existing translation test.

## Contract and environment limits

1. All 19 named hooks exist. No endpoint was invented or handwritten.
2. The contract does not list repositories for a connection. Project creation
   says so instead of inventing choices.
3. Enterprise email is not configured. Set `VITE_ENTERPRISE_CONTACT_EMAIL` to
   the real commercial address to enable mailto; no address was guessed.
4. Required flags and enterprise contact-action flags are absent from the
   catalogue. Optional narrative follows the spec; skip permission remains
   the API's decision. The explicit enterprise key follows the spec.
5. A missing-step field is not typed in the error contract. The UI accepts a
   returned step field when present, otherwise links only an API-listed key
   named in detail; it does not invent a missing requirement.
6. At zero code connections, the primary follows the spec's complete-first
   instruction and exposes its refusal/link to code. This cannot also be an
   unconditional navigation: the API rejects completing without code. An
   anomalous accepted completion cannot re-enter welcome, because onboarded
   users must go to the cockpit.
7. QA documentation reports GitHub login unavailable, email delivery not
   enabled and SMS dependent on an adapter credential. These are not replaced
   with simulated success.
8. Existing typography tokens were preserved rather than globally restyled;
   their current font definitions differ from the names stated in RAILS.
