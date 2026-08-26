---
name: DOP phase boundary
description: Scope boundary between the validated IDE experience and later provider-backed behavior.
---

The first DOP IDE phase should preserve the current UI contracts while using mock data. Real Jira, ClickUp, Redmine, Git-host integrations, and write operations belong to separate follow-up work.

**Why:** The product experience, navigation, repository aggregation, detailed card cockpit, and bilingual interface needed validation before adding provider complexity and irreversible remote operations.

**How to apply:** When extending this product, do not mix provider integration or real card/Git mutations into unrelated cockpit refinements. Replace mocks behind the existing API/types boundary and add explicit progress and error states.