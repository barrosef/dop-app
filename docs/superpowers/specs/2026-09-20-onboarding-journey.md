# The onboarding journey — from "how do you want to enter" to "ready to fly"

- **Date:** 2026-09-20
- **Needs the API:** **yes, and it is in the generated client.** Every hook this
  spec names exists in `lib/api-client-react` after the `chore(api-spec)`
  commit of 2026-09-20. If one is missing, the spec is stale — say so, do not
  invent it (`RAILS.md` §1).
- **Rails:** [`RAILS.md`](../../../RAILS.md). §1 (the contract), §2 (no backend
  rule here), §4 (the components), §5 (the direction), §6 (i18n) govern every
  screen below. This spec does not repeat them.
- **Supersedes:** `2026-09-06-profile-onboarding-wizard.md`.
- **Source of the decisions:** the platform spec of the same date, in the
  umbrella repository (`docs/superpowers/specs/2026-09-20-onboarding-journey-design.md`).
  What is decided there is not reopened here.

## 1. What this is, and why it exists

After sign-up the cockpit drops the person on `/` with an empty tree. Nothing
explains what a workspace is, where their code should come from, or what to do
first. The one wizard that existed (`onboarding.tsx`) has a single step and
**no route leads to it**.

This spec replaces that with a **journey**: seven moments, each one
*explain → act → confirm*, that end with the person able to create their first
project. The owner's words, which set the bar: the current screens are pretty
and shallow — "falta muito do ponto de vista de arquitetura, wizard, fluxos e
ux-ui no geral". A form with fields and a Next button does not meet this spec.

## 2. The decisions you inherit

These were taken on the platform side and arrive here as facts:

- **The state of the journey lives in the API** (`GET /me/onboarding`), never in
  the browser. `localStorage` may remember a draft of a form; it never decides
  which step to show.
- **Required steps:** `profile`, `code`, `plan`. **Optional:** `contact`, `tasks`.
  The API refuses to skip a required step and refuses `complete` while one is
  undone — render its refusal, do not pre-empt it with a rule of your own.
- **The workspace is backstage.** The personal account is born with a workspace
  the API creates. The journey never shows a "create workspace" step.
- **Photo and logo are out.** The provider's photo is shown; nothing is uploaded.
- **The phone is optional and verified by SMS through the second factor that
  already exists.** An unverified phone never blocks; the attention box carries
  the reminder afterwards (it arrives from the API like any other item).
- **Connections are real integrations.** A tile is a provider from
  `GET /catalog/providers`; connecting creates a resource and stores its
  credential; *test connection* asks the API. The `operated` flag decides the
  tile's badge, not a list here.
- **A plan is chosen and carries no price**, and no gap where a price would go.
- **The e-mail stays at the door**: a password credential with an unverified
  address is refused by the backend (412) before the journey starts. That flow
  (`verify-email.tsx`) is kept and polished, not redesigned.

## 3. The screens

All journey routes live under `/welcome/*`, outside the shell (the sidebar and
the tree have nothing to show yet). A **step rail** on the left reflects
`OnboardingState.steps` — `done`, `skipped`, `pending`, and the `current` one —
in the order the API lists them. Every screen has a **narrative panel**: what
this step does, what the platform will do with the answer, and — on optional
steps — what skipping costs. The person reads first and acts second.

### 0 · Entry — `/sign-up` (redesign)

Two halves. Left: the promise in three lines — *connect your code · bring your
cards · the agent works on your flow*. Right: *How do you want to enter?* —
Google, GitHub, e-mail. Choosing e-mail expands, **inline**, into address and
password, with strength feedback and the password policy stated **before** it
is violated. The linking choreography (`link-provider.tsx`), the error
decisions (`auth-errors.ts`) and `verify-email.tsx` keep their logic; the
latter gains a visible resend countdown and *I typed the wrong address*.

### 1 · Who you are — `/welcome/profile` · required

**Data:** `useMe` (pre-fill), `useUpdateProfile`, `useHandleAvailability`,
`useUpdatePersonalAccount`, `useRecordStep`.

Arrives pre-filled from `useMe`: the provider's photo (`avatar_url`, or initials
— `profile-initials.ts` already does this), `name`, `email` with a *verified*
mark when `email_verified`. Editable: display name; the personal account's
handle (from `useListAccounts`, the account with `kind === "personal"`) checked
**as typed** with `useHandleAvailability` (debounced; the API's `suggestion`
is offered when taken; typing one's own current handle back reads as
available); language and time zone, detected from the browser and shown for
confirmation; date of birth, optional, with one line saying why it is asked.

Continue = `PATCH /me` (only the fields that changed), then
`PATCH /accounts/current` if handle or display name changed, then
`POST /me/onboarding/steps/profile {status: "done"}`. Required by the API:
name and handle.

### 2 · How to reach you — `/welcome/contact` · optional

**Data:** `useUpdateProfile` (records the phone), `useEnrollSecondFactor`
(`kind: "sms"`, `destination` = the phone, `label` = "phone"),
`useConfirmSecondFactor`, `useRecordStep`.

Phone first (E.164; the field helps with the country code), then the six-digit
code in `input-otp`. Resend with a **visibly growing** delay; *correct my
number* in place; *skip* always visible and never worded as failure. On skip →
`steps/contact {status: "skipped"}`; on a confirmed code → `steps/contact
{status: "done"}`. A phone that was typed but never confirmed is still saved
(`PATCH /me` runs before enrolment), and the reminder is the box's job.

Errors are the API's: wrong code (show attempts remaining when the API says),
rate limit (say when, from the API's `Retry-After` or its message), delivery
failure. Reuse the pieces of the old `onboarding.tsx` phone step — the
behaviour was right; the framing was missing.

### 3 · Where your code lives — `/welcome/code` · required

**Data:** `useListProviders` (filter `category === "git"`), `useListResources`
(`kind: "integration"`, to show what exists), `useCreateResource`,
`useSetCredential`, `useCheckResource`, `useRecordStep`.

Tiles from the catalogue — name, a mark in `brand_color` with initials (no logo
files), and the API's badge: `operated` → *operated today*; otherwise
*registered — operation coming*. Selecting a tile opens a **side panel**
(`sheet`) with that provider's method: the credential kind, the
**`permissions` listed and copyable**, a link to `docs_url`, the base URL field
when `needs_base_url`, the token field, and *test connection*.

Connecting = `POST /resources {kind: "integration", name, config: {category:
"git", provider: <key>, base_url?}}` then `PUT /resources/{id}/credential`
(`secret_base64`). *Test connection* = `POST /resources/{id}/check`; render its
`operated`, `ok`, `identity` and `message` as they come — a non-operated
provider is an honest answer, not an error. Several connections may be made;
the step is done with `steps/code {status: "done"}` — **the API refuses it
with 412 when there is no git connection**; render that refusal.

### 4 · Where your cards live — `/welcome/tasks` · optional

The same tiles and the same panel, `category === "task_manager"`. The
narrative says what a board connection buys (cards become demands) and that
it can be connected from the project later. Skip → `steps/tasks
{status: "skipped"}`; connect → `steps/tasks {status: "done"}`.

### 5 · How you want to start — `/welcome/plan` · required

**Data:** `useListPlans`, `useSetPlan`, `useRecordStep`.

Plans side by side, in the API's order: name, tagline, features. **No price and
no space where a price would go.** The first plan is pre-selected; one must be
chosen. Enterprise's control is *talk to us* (a `mailto:` to the platform's
contact until a form exists — the address comes from configuration, not a
literal in the screen). Continue = `PUT /accounts/current/plan {plan_key}` then
`steps/plan {status: "done"}`. The API refuses the plan step before a plan is
recorded; the order above avoids that, and the refusal is rendered if it
happens anyway.

### 6 · Ready to fly — `/welcome/ready`

**Data:** `useOnboarding`, `useCompleteOnboarding`.

A checklist built from `OnboardingState`: profile ✓; phone — *verified*, *not
verified* or *not given*; code connections *n*; task connections *n* or *none*;
plan ✓ with its name. A card offering to protect the account (second factor →
`/account`, Security). **One primary action:** *Create your first project* when
`code_connections > 0`, *Connect your code* (→ `/welcome/code`) when zero. A
secondary *Go to the cockpit*. The primary action first calls
`POST /me/onboarding/complete`; on 412 the response names the missing step —
link to it.

*Create your first project* leads to the project creation that exists
(`useCreateProject` inside the personal workspace, which `useGetTree` lists),
already offering the repositories of the connection made when the API exposes
them; where it does not yet, the screen says so rather than inventing a list.

## 4. The gate

**As** the platform, **I want** an incomplete journey to be the only thing a
signed-in person sees, **so that** nobody lands on an empty tree and nobody is
asked twice.

1. On any route inside the shell, if `useMe().onboarded === false`, navigate
   to `/welcome/<current>` where `current` comes from `useOnboarding`. Decided
   in **one** place — the same place `App.tsx` already decides the sign-in gate
   — never per screen.
2. `/welcome/*` routes are reachable only with a session; an onboarded person
   who opens one is sent to `/`.
3. A hard reload lands on the same step: the state is the API's.
4. The `/onboarding` route and the old `onboarding.tsx` are removed once the
   contact step exists; nothing else may link to them.

## 5. The rail and the narrative — what must be true

- The rail shows every step the API lists, in that order, with four visual
  states (done, skipped, current, pending). A skipped step reads as a choice,
  not as an error.
- Every step has a narrative panel with three parts: what this is, what the
  platform does with it, what happens if skipped (optional steps only). It is
  copy, in both i18n maps, not placeholder text.
- Every step's primary action names what it does (*Save and continue*,
  *Connect GitHub*, *Choose Free*) — never a bare *Next*.
- Loading, empty and error states exist for every API call. A failed call
  shows the API's message; a 412 shows its `detail`.
- The journey works on a phone-width viewport: the rail collapses to a
  progress strip at the top.

## 6. What is yours

Composition, hierarchy, how the two halves of the entry screen relate, the
rail's design, how a tile reads when selected and when non-operated, the side
panel's rhythm, the transitions between steps, how the checklist celebrates
without being loud. This is the screen the owner will judge the product by.

## 7. What is not

The step order, what is required, where every value comes from, the tokens
and typefaces, the component library, and the decision that no rule is
reimplemented here. When a rule seems missing, it is in the API or it is a
question — `RAILS.md` §8.

## 8. Done means

`RAILS.md` §7, plus:

- [ ] a new Google account walks from `/sign-up` to `/welcome/ready` and lands
      on `/` with a personal workspace in the tree;
- [ ] skipping contact and tasks works; skipping code is refused by the API and
      the refusal is rendered;
- [ ] `complete` before the plan is refused with the step named, and the link
      leads there;
- [ ] a hard reload on `/welcome/code` stays on `/welcome/code`;
- [ ] an onboarded account never sees `/welcome/*` again;
- [ ] both i18n maps grew by the same number of keys;
- [ ] no string, no colour, no rule that belongs to the API lives here.
