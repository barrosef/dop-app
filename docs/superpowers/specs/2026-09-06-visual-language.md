# The cockpit's visual language

- **Date:** 2026-09-06
- **Status:** direction chosen by the owner from three side-by-side mockups
- **Needs the API:** no. Nothing here changes a request. Buildable today.
- **Rails:** [`RAILS.md`](../../../RAILS.md) — read §4 (components), §5 (the
  direction and its tokens) and §6 (i18n) before starting. This spec does not
  repeat them.

## 1. Why this work exists

The owner's words: the screens are poor, simplistic, with ordinary combos and
text fields that feel like the year 2000.

The reading is right and the cause is specific. This package ships **56
components** in `artifacts/dop/src/components/ui/` — shadcn/ui over Radix — and
the screens do not use them:

| screen | imports from `components/ui` | what it uses instead |
|---|---|---|
| `account.tsx` | 0 | hand-rolled `<button>`, native `<select>` |
| `invite.tsx` | 0 | hand-rolled `<button>` |
| `sign-in.tsx`, `sign-up.tsx`, `link-provider.tsx`, `verify-email.tsx` | 0 | bare `<input>` |
| `workspace-wizard.tsx` | 6 | nearly clean — this is what good looks like here |

A native `<select>` is drawn by the operating system: it ignores the theme,
cannot carry an icon or a description, and looks like a different decade because
it is from one. So **most of this work is adoption, not construction.** The
components are themed, accessible and already in the bundle.

`workspace-wizard.tsx` is the reference for what the codebase looks like when
the library is used.

## 2. What is being decided here, and what is not

**Yours:** layout, visual hierarchy, spacing, composition, density, empty and
loading states, micro-interactions, how a busy screen stays readable. Rearrange
freely — move sections, restructure a table, split a screen, group differently.

**Not yours:** the palette and the typefaces (`RAILS.md` §5 — the owner chose
them), and **what information appears on a screen**. Rearranging is yours;
adding or removing is not. A screen that seems to be missing something, or
showing something useless, is a finding to report, not a thing to invent.

## 3. The user stories

### US-1 — The direction lands once, and everything inherits it

**As** whoever maintains this cockpit, **I want** the visual direction to live in
the theme tokens, **so that** a screen built next month is already correct
without anyone remembering a palette.

Acceptance:

1. `artifacts/dop/src/index.css` carries the direction's values under the token
   names that already exist (`--background`, `--card`, `--primary`, and the
   rest), plus tokens for the three states (`ok`, `attention`, `danger`).
2. The typefaces are loaded and applied: headings and short labels in the
   display face, body and controls in the text face, **every identifier** — ids,
   hashes, counts, durations, versions — in the mono face.
3. Columns of digits use `font-variant-numeric: tabular-nums`. A number that
   changes width makes the layout dance on every tick.
4. **No component contains a literal colour.** A hex that is not a token will
   not follow the theme.
5. This story lands **before** any screen is restyled. A screen touched before
   the tokens exist gets touched twice.

### US-2 — Signing in and signing up look like the product they open

**As** somebody arriving for the first time, **I want** the entry screens to feel
built rather than assembled, **so that** my first impression of the platform is
not a bare form.

Screens: `sign-in.tsx`, `sign-up.tsx`, `link-provider.tsx`, `verify-email.tsx`.

Acceptance:

1. Every field, button and message is drawn by a component from the library.
2. The verification code field, when one is needed, uses `input-otp`.
3. Errors appear where the person is looking, not in a corner, and never as a
   browser alert.
4. Loading and submitting states are visible — a button that does nothing for
   two seconds reads as broken.
5. **Every behaviour in §4 still works.** This is the acceptance criterion that
   matters most on these four screens.

### US-3 — An invite's state is readable at a glance

**As** somebody who administers an account, **I want** to see who was invited,
what happened to each invite and what I can do about it, **so that** I do not
read a grid to find one pending row.

Screen: `invite.tsx`, and the invites area of `account.tsx`.

Acceptance:

1. Rows divided by hairlines, not boxed cards — one invite is one line, not one
   panel.
2. State is a badge whose meaning comes from the API's own value, never from a
   colour decided here (`RAILS.md` §2).
3. Relative time is rendered in tabular mono so the column does not jitter.
4. Actions belong to the row and appear on it; they do not occupy a permanent
   column of buttons.
5. **An empty list says what to do**, using the `empty` component — a table with
   nothing in it and no explanation is a dead end.
6. A list that is loading shows structure, not a spinner over a blank area.

### US-4 — The profile is a place, not a form

**As** somebody managing my own account, **I want** the profile to group what
belongs together and make the security settings legible, **so that** I can find
what I came for.

Screen: `account.tsx` — the largest of the four at 563 lines, and the one that
gains most from the patterns settled in US-2 and US-3.

Acceptance:

1. No native `<select>` survives. Where the list is short, `select`; where it
   passes roughly eight items or benefits from search, `command`.
2. Sections are visually distinct without each becoming a card — border, fill
   and radius are spent to lift the one thing that needs lifting.
3. The second-factor area (`components/security/second-factor-settings`) reads
   as a status, not as a settings dump: what is enrolled, what is not, what to
   do next.
4. Destructive actions look destructive and confirm before acting.

### US-5 — The organization screen carries a hierarchy

**As** somebody who runs an organization, **I want** members, roles and grants to
read as a structure, **so that** I can see who has what without reconstructing it
in my head.

Acceptance:

1. Members are rows with the same anatomy as US-3's invites — one visual
   language for two lists of people.
2. A role is a control, not free text, and it is the API that says which roles
   exist and which are permitted (`RAILS.md` §2).
3. Whatever the API marks as not permitted is visibly unavailable, with a reason
   the person can read — not silently missing, and not enabled until it fails.

## 4. Behaviour that must survive the restyle

The four authentication screens shipped hours before this spec and were reviewed
hard. Their behaviour breaks **silently** under a restyle — it typechecks, it
looks better, and it stops working. Restyle them freely; do not reorganise their
control flow.

- **`sign-in`/`sign-up` decide from the caught error, not from state.** They call
  `decideFromAuthError(failure)` and branch on `decision.kind`. There is a trap:
  `pendingLink` is React state set immediately before the throw, so reading it in
  the same `catch` tick returns the value from *before* the update. Refactoring
  this into "check `pendingLink` after catching" silently kills the linking flow.
- **`sign-up` branches on whether there is a credential to link.** A password
  collision has none and goes straight to `/sign-in` carrying `linkEmail` in
  router state, where an explanation banner renders. A provider collision goes to
  `/link-provider`.
- **`link-provider` removes the provider that was just attempted** from what it
  offers, and falls back to offering all of them when `pendingLink.methods` comes
  back empty — an empty list is a normal answer under e-mail enumeration
  protection, not a failure.
- **`verify-email` has a sign-out link.** It is the only exit for somebody who
  typed their address wrong: `/` sends them to `/verify-email` and `/sign-in`
  sends them to `/`. Removing it rebuilds a trap that was deliberately removed.
- **The gate in `App.tsx` fires only when every entry in `providerData` is
  `password`** and the e-mail is unverified. Gating on unverified alone locks out
  every GitHub user, because GitHub frequently reports an unverified address.

## 5. Order

1. **US-1**, alone, first.
2. **US-2** — smallest surface, newest code, and the proof the direction works.
3. **US-3** — the table the owner named.
4. **US-4**, then **US-5** — densest, last.

## 6. Done

`pnpm typecheck`, `pnpm --filter @workspace/dop run test`, and
`PORT=5173 BASE_PATH=/ pnpm build` (which needs both variables), plus the
checklist in `RAILS.md` §7 — it covers what those commands cannot, including the
i18n key counts and the absence of literal colours.

## 7. Out of scope

- **No new components.** If something is genuinely missing from the 56, say so
  before building it.
- **No new UI dependency.**
- **No light theme.** The direction is dark; `index.css` keeps its light token
  block so nothing breaks, and a light theme is separate work if it is ever
  wanted.
- **No change to what any screen shows** (§2).
- **The `/workspaces/*` routes**, which run on mock data and belong to a
  different piece of work.
