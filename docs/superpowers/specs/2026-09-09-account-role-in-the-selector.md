# The role is now reliable for every account

**Type:** behaviour note. **Needs the API?** Already shipped — nothing to wait
for. **Does the contract change?** No.

Read [`RAILS.md`](../../../RAILS.md) first, as always. This note exists because
a value the cockpit already receives changed meaning, and a changed meaning with
an unchanged type is the kind of thing that goes unnoticed until it is wrong on
someone's screen.

## What changed

`GET /api/v1/accounts` returns `AccountSummary[]`, and each one has a `role`.
Until now that field was filled **only for the account currently active** and
came back as an empty string for every other one.

That was not a bug in the cockpit and not a bug in the API: the backend had no
way to send a per-account role, and the edge refused to invent one. The
consequence landed here anyway — the account selector could not tell an account
you own from one you merely view, because the answer only existed after you had
already switched into it.

The backend now sends the account together with the caller's role in it. **Every
entry in the list carries its own `role`**, and it is one of `owner`, `admin`,
`developer`, `viewer`.

## What you do NOT have to do

- **No `pnpm fetch-spec`, no `codegen`, no change under `generated/`.** The
  OpenAPI schema is byte-identical — `role` was always a required string. This
  was verified against the committed `lib/api-spec/openapi.json`, not assumed.
- **No new endpoint, no new hook.** The same `useListAccounts` you already call.

## What to build

In the account selector, show which role the person holds in each account —
whatever form fits the visual language (a quiet label beside the name, a badge,
a secondary line). The names are user-facing text, so they go through i18n like
everything else; do not print the raw API string.

Empty string is no longer the normal case, but it is still a possible one: an
account the backend could not resolve a role for arrives as `""`. **Render
nothing** in that case — no "unknown", no fallback role, no dash that reads like
a value. An account with no role shown is honest; an account labelled `viewer`
because the field was empty is a lie the person will act on.

## The line not to cross

`RAILS.md` §"who may do what" is the one that matters here, and this change
makes it easy to break by accident:

> do not compute permissions from a role name; the API answers what is allowed

`role` is for **saying what someone is**, never for **deciding what they may
do**. Do not write `if (role === 'owner')` to show a delete button, enable a
settings tab or unlock an invite form. Those answers come from the API, and if
the API does not currently say whether an action is allowed, that is a question
for whoever owns the backend — not a `switch` invented here.

The reason is concrete rather than doctrinal: roles gain members over time, and
a permission rule written here is the one nobody remembers to update. It will
keep working, wrongly, long after the backend rule changed.

## Done means

- [ ] Each account in the selector shows its own role, not the active one's.
- [ ] An account whose `role` is empty renders no role at all.
- [ ] The role names are translated, not raw API strings.
- [ ] No `if` on a role name gates any action anywhere in the diff.
- [ ] `generated/` and `openapi.json` are untouched (`RAILS.md` §7).
