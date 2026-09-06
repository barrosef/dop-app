# Rails — what holds when the cockpit changes

This repository is the DOP platform's cockpit, and it is **one of four**. The
others — the core (Go), the BFF (Python) and the infrastructure — are not
visible from here, and most of what can go wrong in this repository is a
decision that belongs to one of them being taken here instead.

Read this before changing anything. `replit.md` says how to run the project;
this says what must stay true afterwards.

---

## 1. The contract is a file, not a description

The BFF publishes an OpenAPI document. It is downloaded into
`lib/api-spec/openapi.json` and **committed**, and Orval generates the
react-query hooks and the Zod schemas from it.

```bash
pnpm --filter @workspace/api-spec run fetch-spec   # only when told the API changed
pnpm --filter @workspace/api-spec run codegen      # regenerates hooks + schemas
```

**Every call to the backend goes through a generated hook.** There is no
`fetch('/api/...')` in a screen, no axios, no hand-written client.

**If the hook you need does not exist, the endpoint does not exist.** Do not
write the call by hand, do not mock it, do not invent a path that looks
plausible. Stop and say which operation is missing. An invented endpoint costs
more than a blocked task: it typechecks, it renders, it is reviewed as done, and
it fails the first time a real person clicks it.

**Never edit by hand:**

- `lib/api-spec/openapi.json` — it is downloaded, and a hand edit makes the
  generated client lie about the server;
- anything under `lib/api-client-react/src/generated/` — it is regenerated and
  your change disappears at the next `codegen`;
- `lib/api-client-react/src/custom-fetch.ts` — it carries the auth token and the
  `x-account-id` header. A request with the wrong account **does not error**; it
  returns somebody else's data.

---

## 2. No backend rule is reproduced here

This is the rule that matters most, and the easiest to break without noticing,
because from inside this repository a duplicated rule looks like ordinary code.

The order of the attention box, an item's priority, a badge's meaning, a
demand's effective flow, who may do what in an account — all of it arrives
computed from the API and is **rendered as it arrived**.

Concretely, this means:

- do not sort a list the API already ordered;
- do not decide a badge's colour from a status string with a `switch` invented
  here — if the API does not say the severity, ask for it;
- do not compute permissions from a role name; the API answers what is allowed;
- do not filter out items you believe are irrelevant.

The reason is not purity. Two rulers diverge, always, and the one on this side
is the one nobody remembers to update. When a rule seems to be missing, the
answer is a question to whoever owns the backend, not a local implementation.

There is one legitimate exception, and it is narrow: **client-side form
validation that mirrors a rule the server also enforces**, to give a faster
answer. The server's answer still wins, and its error is still rendered.

---

## 3. What is yours, and what is not

**Yours, and the reason this repository is worked on separately:** layout,
visual hierarchy, spacing, composition, the shape of empty and loading states,
micro-interactions, how a dense screen stays readable. Design decisions inside
the direction below are yours to make well.

**Not yours:**

- the palette's direction and the typefaces — the owner chose them from
  side-by-side comparisons (see §5);
- what an endpoint returns, and what it is called;
- what a rule means (§2);
- which components exist (§4).

---

## 4. The component library already exists

`artifacts/dop/src/components/ui/` holds **56 components** — shadcn/ui over
Radix: `select`, `command`, `dialog`, `form`, `field`, `input`, `input-otp`,
`table`, `badge`, `tabs`, `sheet`, `sonner`, `skeleton`, `empty`, and the rest.
They are themed, accessible and already in the bundle.

- **Use them.** A native `<select>` renders as the operating system draws it,
  ignores the theme and cannot carry an icon or a description. A hand-rolled
  `<button>` has its own focus ring, its own disabled state, and its own bugs.
- **Do not add a UI dependency.** If something is genuinely missing, say so
  before building it; a new library is a decision, not a detail.
- **Do not restyle a component to be a different component.** A `badge` bent
  into a button is a button nobody can find.

---

## 5. The visual direction, decided

Chosen by the owner from three mockups. The tokens live in
`artifacts/dop/src/index.css` and every component reads them.

**Control room** — dark, dense, an instrument panel over work in flight. The
screens are read for hours beside an editor.

```
ground        #0E1116    the page
surface       #12171E    panels, cards
surface-2     #0F141A    inset fields, tiles
hairline      #232A34    dividers, borders
hairline-2    #2A323E    interactive borders
text          #D8DEE7    body
text-strong   #F0F4F9    headings, values
text-muted    #7C8798    labels, secondary
text-faint    #5C6879    placeholders, units
accent        #2F81F7    the one action colour
ok            #3FB950    a state
attention     #D29922    a state
danger        #F85149    a state
```

- **Chivo** for headings and short labels; **IBM Plex Sans** for body and
  controls; **JetBrains Mono** for every identifier — ids, hashes, counts,
  durations, versions.
- **Colour means state.** A green pill says a thing is green. Colour is never
  spent to brighten a row, and that restraint is what keeps a dense screen
  readable.
- **Tabular numerals** on every column of digits. A count that changes width
  makes the layout dance on every tick.
- **No shadows.** Separation is a 1px hairline. Nothing floats on an instrument
  panel.
- **Rows, not cards**, for lists of things — divided by hairlines, with state as
  a 2px stripe on the left edge.
- **Never a literal colour in a component.** A hex that is not a token will not
  follow the theme, and that is how a palette rots one screen at a time.

---

## 6. Everything a person reads goes through i18n

`artifacts/dop/src/lib/i18n.ts` holds two flat maps, `pt` and `en`. They have
the same number of keys today and must still have it afterwards.

**A key added to one map only renders as the raw key to half the users, and
nothing in the toolchain catches it.** Not the compiler, not the tests, not the
build. Count the keys before and after.

Code, comments, identifiers, file names and test names are **English**. Only the
strings a person reads are translated, and both languages are written at the
same time — never one now and the other later.

---

## 7. Before saying it is done

```bash
pnpm typecheck
pnpm --filter @workspace/dop run test        # if the package has tests
PORT=5173 BASE_PATH=/ pnpm build             # the build needs both variables
```

And by hand, because no tool checks these:

- [ ] every new string exists in **both** `pt` and `en`, and the maps have the
      same key count;
- [ ] no literal colour outside the tokens;
- [ ] no `fetch` to the backend outside a generated hook;
- [ ] nothing changed under `generated/`, in `openapi.json`, or in
      `custom-fetch.ts`;
- [ ] no rule from §2 was reimplemented here;
- [ ] every interactive element reachable and visible by keyboard.

---

## 8. When you are blocked, say so

Two things are worth more than a workaround:

- **A missing endpoint or field.** Name the screen, the data it needs and what
  it would show. That becomes backend work, and it is fast.
- **A rule you cannot find.** If you cannot tell where a value should come from,
  it almost certainly comes from the API and this is §2 arriving in disguise.

Guessing produces something that passes review and fails in front of a person.
Saying "this is missing" costs one message.
