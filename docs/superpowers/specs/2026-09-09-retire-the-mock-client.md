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

## Correction to an earlier version of this document

An earlier version said the generated hooks did not exist and made "set up
Orval" the first slice. **That was wrong**, and it was wrong in the expensive
direction: acting on it would have meant building a second client beside a
working one.

What is actually there, verified file by file:

- Orval is configured at `lib/api-spec/orval.config.ts`, with a transformer that
  turns FastAPI's `get_cockpit_api_v1_demands__demand_id__cockpit_get` back into
  `useGetCockpit` — so the hook names match the BFF's own function names.
- `lib/api-client-react/src/generated/` holds **81** query and mutation hooks.
- `lib/platform/backend.ts` wires them to the BFF: base URL from the
  environment, `Authorization: Bearer <Firebase ID token>`, and `x-account-id`
  read from the store on **every** request.
- **Twelve files already use them**, including `pages/demand.tsx`,
  `pages/account.tsx`, `pages/invite.tsx`, `pages/project.tsx`,
  `pages/onboarding.tsx` and the attention box.

So there is no groundwork slice. The target exists, it works, and most of the
cockpit is already on it.

## What is actually left, and why it is not an import swap

**The mock models a product that is not this one.** `lib/api/client.ts` declares
`listCards`, `getCard`, `sendChatMessage`, `listWorkspaces`. The real contract
has **no `card` anywhere in its 65 paths**. The concept is called a **demand**:

| the mock says | the API says |
|---|---|
| `listCards(workspaceId)` | `GET /api/v1/demands` |
| `getCard(workspaceId, cardId)` | `GET /api/v1/demands/{demand_id}` |
| the card's execution view | `GET /api/v1/demands/{demand_id}/cockpit` |
| `sendChatMessage(cardId, text)` | `POST /api/v1/demands/{demand_id}/threads/{thread_id}/turns` |
| `streamLogs(...)` | the SSE stream, not a method on a client |

**And the screen already exists twice.** Both are routed in `App.tsx`:

| | lines | fed by | route |
|---|---|---|---|
| `pages/demand.tsx` | 318 | generated hooks | `/demands/:demandId` |
| `pages/card-execution.tsx` | 2236 | `mockClient` | `/workspaces/:id/demands/:demandId` |

The big one is the mock one. That is the normal shape of this situation and it
is worth naming: a mockup can show anything, so it grows; a screen wired to a
real API can only show what the API answers, so it stays honest and small.

**So the question for `card-execution.tsx` is not "how do I migrate it".** It is:
*what does it show that `demand.tsx` does not, and which of those things are real?*
Go through it panel by panel and sort each one into three piles — already in
`demand.tsx`; available from the API and worth adding to `demand.tsx`; or
invented, in which case it is a product conversation and not a coding task. Then
delete the old screen and its route. Rewriting 2236 lines of mock against the
real API would be porting the invention along with the rest.

## How to do it

**Do not do it all at once.** A six-file sweep against a vocabulary change is a
pull request nobody can review and a week where nothing works.

**One screen per slice**, easiest first so the pattern is established before the
judgement call:

1. `app-sidebar.tsx` — reads little; mostly counts and names. The hooks it needs
   already exist.
2. `workspace-cockpit.tsx` — resources and the terminal. `/api/v1/resources` is
   real and close to what the mock pretends.
3. `card-execution.tsx` — the panel-by-panel sort described above, then delete.
   Read `/api/v1/demands/{id}/cockpit` first: it returns the stage view already
   assembled, so the screen renders what arrives instead of assembling it here.

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
