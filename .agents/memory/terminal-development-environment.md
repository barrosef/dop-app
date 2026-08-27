---
name: Terminal development environment
description: How the development terminal resolves its allowed working directory under managed artifact workflows.
---

Managed artifact development workflows may not expose values declared in a service's development environment block to the child process.

**Why:** The interactive terminal must remain usable in preview while still validating the directory where its PTY is created. The server therefore uses its own working directory only when no configured terminal root is available, and emits a warning so this condition is observable rather than silent.

**How to apply:** When changing terminal startup or artifact workflow configuration, verify the effective runtime environment in workflow logs and keep any development default restricted to the API server's local working directory. A shared or deployed terminal must use explicit authenticated authorization and isolated execution roots.
