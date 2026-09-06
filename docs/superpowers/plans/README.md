# Plans for the cockpit

A plan breaks one spec into tasks with a test cycle each. Most frontend work
here does not need one: the specs carry user stories with acceptance criteria,
and the person building the screens decides the order and the composition.

A plan appears here only when a spec turns out to need a sequence somebody could
get wrong — a migration of shared state, work that has to land in a specific
order across several screens, or a change where two tasks touch the same file
and would collide.

Empty is the normal state of this folder.
