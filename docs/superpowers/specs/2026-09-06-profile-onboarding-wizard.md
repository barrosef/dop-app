# Profile onboarding — the wizard after sign-up

- **Date:** 2026-09-06
- **Status:** decisions approved by the owner, section by section
- **Needs the API:** **partly.** US-1 is buildable today; US-2 to US-5 are
  blocked on operations that do not exist yet — see §7.
- **Rails:** [`RAILS.md`](../../../RAILS.md). §1 (the API contract) governs §7 of
  this spec, and §5 (the visual direction) governs every screen here.
- **Builds on:** [`2026-09-06-visual-language.md`](2026-09-06-visual-language.md).
  This wizard should be built **after** that spec's US-1, or it is built in the
  old visual language and done twice.

## 1. What this is

After an account exists, and before the person uses the platform, a wizard
appears **over the portal** — the portal visible and dimmed behind it — asking
for five things. It appears once and never again.

The shape was chosen by the owner from mockups: a centred panel, a step rail on
the left, and the tools step using **tiles grouped by subject** with a search
field and a per-group count.

## 2. Decisions, and the reasons — because the reasons are what you can disagree with

**D-1. Mandatory, once.** The person completes the wizard before using the
platform.

**D-2. The phone step can be skipped; the others cannot.** A mandatory step that
depends on a mobile carrier is a locked door — SMS blocked, a digit typed wrong,
a new chip, no signal. Every other step is a choice the person can always make.

**The rail shows a skipped phone as skipped, not as pending.** It was a
legitimate choice, and showing it as an error teaches people to distrust the
rail.

**D-3. Tools require at least one. Social networks, referral and plans are
pass-through.** Tools are the only answer the platform will actually act on, so
an empty answer empties the point of asking. Social networks may genuinely be
none, and requiring one only teaches people to lie. The last two steps have
nothing to fill in — they are seen, may be acted on, and are passed.

**D-4. The referral link is real; nothing is rewarded yet.** Each person has a
code, the link carries it to sign-up, and whoever signs up through it is recorded
as referred by whoever shared it. No credit, no reward — those are commercial
decisions not yet taken. The copy must be honest about that rather than implying
a benefit.

**D-5. Plans carry no price.** Free, Start, Pro and Enterprise, with a tagline
and a short feature list each. The absence of prices is deliberate, not a
placeholder, and the screen must not leave a gap where a price would go.

**D-6. The gate is here, not in the backend.** Every other refusal in this
platform lives in the core. This one does not, because an incomplete profile
protects nothing — a backend refusal would add no security and one more way to
lock somebody out. This is the **one** documented exception to `RAILS.md` §2, and
it is an exception about *routing*, not about a rule.

## 3. The user stories

### US-1 — Confirming a phone number · **buildable today**

**As** somebody who just created an account, **I want** to confirm my mobile
number, **so that** the platform has a channel that is really mine.

This uses the second-factor operations that **already exist** in the generated
client: enrolling a factor sends a code to the destination, and confirming it
validates the code. The person ends the step with a working second factor, which
is a better outcome than a phone number nobody can use.

Acceptance:

1. Number first, then the code, using `input-otp` for the code.
2. **Resend** with a visibly growing delay, and **"correct my number"** available
   without leaving the step — most failures are a wrong digit.
3. The API limits attempts. Show what remains rather than failing silently at
   the limit, and render the API's own error when it refuses.
4. **Skip is always visible**, never buried, and never worded as a failure.
5. On skip, the rail marks the step skipped and the wizard advances.
6. Rate limiting says when to try again, not "an error occurred".

### US-2 — Saying which tools I use · blocked on §7

**As** somebody being onboarded, **I want** to say which tools my team uses,
**so that** the platform works where my team already works.

Acceptance:

1. Tiles grouped by subject, with the group's name and a **count of how many are
   selected in it** — the count is what stops somebody believing they must select
   everything.
2. A search field filters across every group at once.
3. **At least one selection is required** to continue; the continue control says
   so before it is pressed, not after.
4. The groups, the tools, their order and their brand colour all come from the
   API. Neither the list nor its grouping is written here (`RAILS.md` §2).
5. A tool's mark is drawn from its colour and its initials. No logo files.

### US-3 — Saying where I am · blocked on §7

**As** somebody being onboarded, **I want** to say which social networks I use,
**so that** the platform can find me where I already am.

Acceptance:

1. The same tile pattern as US-2, so the two steps read as one language.
2. Selecting one optionally reveals a handle field for it.
3. **Nothing is required.** Continue is always available.

### US-4 — Sharing the platform · blocked on §7

**As** somebody who likes the platform, **I want** a link I can send to people,
**so that** whoever arrives through me is recorded as mine.

Acceptance:

1. The person's link is shown whole, selectable, with a copy control that
   confirms it copied.
2. One line says what it does today: it records who came from whom. It must not
   imply a reward that does not exist (D-4).
3. Continue is always available.

### US-5 — Seeing what the platform offers · blocked on §7

**As** somebody finishing onboarding, **I want** to see the plans, **so that** I
know what exists before I need it.

Acceptance:

1. Four plans side by side, each with its name, tagline and features, from the
   API.
2. **No price, and no space left where a price would go** (D-5).
3. Nothing must be chosen. Finishing the wizard is what the last control does.
4. Finishing marks the profile complete through the API, and the wizard never
   appears again.

### US-6 — The wizard appears when it should, and only then · blocked on §7

**As** the platform, **I want** the wizard to gate the portal exactly once,
**so that** nobody is asked twice and nobody slips past.

Acceptance:

1. A signed-in person whose profile is incomplete lands on the wizard from any
   route.
2. The portal is visible behind it and not interactive.
3. Once complete, no route shows the wizard again, including a hard reload.
4. The completeness answer comes from the API, never from local storage — a flag
   in the browser is lost on another device and forged on this one.

## 4. Errors

The phone step is the only one that fails for reasons outside the person's
control, and it is the one to get right. Everything a person reads goes through
i18n, in **both** maps (`RAILS.md` §6).

## 5. What is yours

Composition, the rail's design, how the tiles are sized and grouped visually,
the transition between steps, how search behaves, how a selected tile reads, the
copy control's feedback. This is a screen where craft shows.

## 6. What is not

The step order, what each step requires (D-2, D-3), where the data comes from,
and the visual direction's tokens.

## 7. The operations this needs, which do not exist yet

**US-1 is buildable now.** US-2 to US-6 are not, and building them against
invented shapes produces work to throw away (`RAILS.md` §1).

When the backend ships, these will appear in the generated client after
`pnpm --filter @workspace/api-spec run fetch-spec` and then `codegen`:

| what the screen needs | operation |
|---|---|
| the tool catalog, grouped, ordered, with colours | `GET /api/v1/catalog/tools` |
| the social catalog | `GET /api/v1/catalog/socials` |
| the plans, with tagline and features | `GET /api/v1/catalog/plans` |
| whether the wizard should appear, and what is already answered | `GET /api/v1/me/onboarding` |
| saving the tool selection | `PUT /api/v1/me/tools` |
| saving the social selection and handles | `PUT /api/v1/me/socials` |
| the person's referral code and link | included in `GET /api/v1/me/onboarding` |
| marking the profile complete | `POST /api/v1/me/onboarding/complete` |

Paths and payloads here are **indicative**. The generated client is the truth;
if it disagrees with this table, the client wins and this table is stale — say
so.

## 8. Out of scope

- **Rewards for referrals** (D-4). Attribution only.
- **Prices, checkout, changing a plan.** Billing is its own subsystem.
- **Editing the catalogs from the interface.** They are a versioned file and a
  command on the backend side.
- **Tool logos** — a coloured mark with initials until the licensing of each
  brand's asset is settled.
