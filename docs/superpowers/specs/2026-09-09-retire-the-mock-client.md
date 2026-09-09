# Retiring the mock client

**Type:** migration, in slices. **Needs the API?** It is already there — 64
endpoints, in the committed spec. **Size:** larger than it looks. Read the
second section before planning anything.

Read [`RAILS.md`](../../../RAILS.md) first. §1 and §2 are the whole reason this
document exists.

## Where things stand

`artifacts/dop/src/lib/api/index.ts` is two lines:

```ts
import { api } from './mockClient';
export { api };
```

Everything downstream of it is fed by `mockClient`. Six files depend on it:
`App.tsx`, `app-sidebar.tsx`, `lib/api/index.ts`, `components/test-stage-view.tsx`,
`pages/workspace-cockpit.tsx`, `pages/card-execution.tsx`.

The code is honest about it — the comments say "the old screens, which still
talk to the MOCK client" — so this is a known transitional state and not a
deviation somebody slipped in.

## Two things that make this bigger than an import swap

**There are no generated hooks.** RAILS.md §1 says every call to the backend
goes through one. Today nothing generates them: `lib/api-spec/openapi.json` is
committed and `fetch-spec.mjs` exists, but there is no Orval configuration, no
`generated/` directory, and no `orval` in any `package.json`. So the target of
this migration does not exist yet — it has to be created first.

**The mock models a product that is not this one.** `lib/api/client.ts` declares
`listCards`, `getCard`, `sendChatMessage`, `listWorkspaces`. The real contract
has **no `card` anywhere in its 64 paths**. The concept is called a **demand**:

| the mock says | the API says |
|---|---|
| `listCards(workspaceId)` | `GET /api/v1/demands` |
| `getCard(workspaceId, cardId)` | `GET /api/v1/demands/{demand_id}` |
| the card's execution view | `GET /api/v1/demands/{demand_id}/cockpit` |
| `sendChatMessage(cardId, text)` | `POST /api/v1/demands/{demand_id}/threads/{thread_id}/turns` |
| `streamLogs(...)` | the SSE stream, not a method on a client |

So `card-execution.tsx` is not one import away from working. It is written
against invented names, invented shapes and an invented call pattern, and
pointing it at the real API is a rewrite of what it asks for — even when the
screen ends up looking the same.

This is precisely what §2 warns about: "do not invent a path that looks like"
one. It happened before the rails were written, which is why the rails were
written.

## How to do it

**Do not do it all at once.** A six-file sweep against a vocabulary change is a
pull request nobody can review and a week where nothing works.

**Slice 0 — make the target exist.** Add Orval, configured against
`lib/api-spec/openapi.json`, generating react-query hooks and Zod schemas into a
`generated/` directory that is committed and never hand-edited (§1). Nothing
else in this slice. Prove it by generating and building, with no screen changed.

**Then one screen per slice**, in this order, easiest first so the pattern is
established before the hard one:

1. `app-sidebar.tsx` — reads little; mostly counts and names.
2. `workspace-cockpit.tsx` — resources and the terminal. `/api/v1/resources` is
   real and close to what the mock pretends.
3. `card-execution.tsx` — the rewrite. Demands, stages, threads and turns. Read
   `/api/v1/demands/{id}/cockpit` before deciding anything about the layout: it
   returns the stage view assembled, and the screen should render what arrives
   rather than assemble it here.

`test-stage-view.tsx` and `App.tsx` follow whichever screen owns them.

When a slice lands, delete the part of `mockClient` it made dead. The file
shrinks with each slice, and the last slice deletes it along with `client.ts`'s
invented `DopApi` interface and `lib/api/index.ts`'s re-export.

## What to do when the API does not answer something

Ask. Do not fill the gap with a local implementation, a `switch` over a status
string, or a sorted list — §2 is explicit and the reason is not purity: two
rulers diverge, and the one on this side is the one nobody remembers to update.
A missing field is backend work, and backend work here is fast.

## Done means, per slice

- [ ] The screen calls generated hooks only; no `fetch` by hand, no mock import.
- [ ] Nothing under `generated/` or in `openapi.json` was hand-edited.
- [ ] The dead part of `mockClient` was deleted in the same change.
- [ ] No rule was reproduced: no permission computed from a role name, no
      ordering imposed on a list the API already ordered, no severity decided
      from a status string.
