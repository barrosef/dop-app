export * from "./generated/api";
export * from "./generated/types";
export * from "./repository-commit-attribution";

// A mandatory disambiguation (TS2308).
//
// Orval's `zod` target generates TWO things under this name: the schema (a
// value, in `generated/api`) and the parameters' type (in `generated/types`).
// The two `export *` above make the name ambiguous, and TypeScript refuses the
// whole module because of it. The explicit re-export beats the wildcards and
// resolves the ambiguity in favour of the SCHEMA — whoever needs the type gets
// it with `zod.infer<typeof …>`, which is derived from the schema and cannot
// diverge from it.
//
// If a second collision ever shows up, it will fail here, loud and clear,
// instead of generating a silently different client.
export { StreamSandboxLogsApiV1StreamSandboxesSandboxIdLogsGetParams } from "./generated/api";
