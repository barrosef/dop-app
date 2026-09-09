# Specs for the cockpit

Each file here describes one body of frontend work as **user stories with
acceptance criteria**. They are written for whoever builds the screens, and they
assume only this repository is visible.

## How to use one

1. Read [`RAILS.md`](../../../RAILS.md) at the repository root first. It carries
   what must stay true after any change — the API contract, the rule that no
   backend logic is reproduced here, the component library, the visual
   direction's tokens, and the i18n discipline. A spec never repeats it.
2. Read the spec. It says what to build and what "done" means.
3. Build. Layout, hierarchy, composition and polish are yours to decide; the
   spec says what must be true, not how it should look.
4. Run the checks in `RAILS.md` §7 before calling it done.

## What a spec will and will not tell you

**It will** name the screens, the behaviour that must survive, the acceptance
criteria, and every place where the answer comes from the API rather than from
a decision made here.

**It will not** give pixel values, class names or a component tree. If a spec
ever reads like a description of markup, it is over-specified and worth saying
so.

## When a spec depends on an endpoint that does not exist yet

The spec says so, in its own section, and names the operations it needs. Until
those ship and `fetch-spec` + `codegen` bring the hooks in, that part is not
buildable — and building it against invented shapes produces work that has to be
thrown away. `RAILS.md` §1 says why.

## Index

| spec | needs the API? |
|---|---|
| [`2026-09-06-visual-language.md`](2026-09-06-visual-language.md) | no — buildable now |
| [`2026-09-06-profile-onboarding-wizard.md`](2026-09-06-profile-onboarding-wizard.md) | yes — blocked, operations listed in §7 |
| [`2026-09-09-account-role-in-the-selector.md`](2026-09-09-account-role-in-the-selector.md) | no — the API already ships it, and the contract did not change |
