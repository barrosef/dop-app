export * from "./generated/api";
export * from "./generated/types";
export * from "./repository-commit-attribution";

// Desambiguação obrigatória (TS2308).
//
// O alvo `zod` do orval gera DUAS coisas com este nome: o schema (valor, em
// `generated/api`) e o tipo dos parâmetros (em `generated/types`). Os dois
// `export *` acima tornam o nome ambíguo, e o TypeScript recusa o módulo
// inteiro por causa dele. O re-export explícito vence os curinga e resolve a
// ambiguidade em favor do SCHEMA — quem precisa do tipo o obtém com
// `zod.infer<typeof …>`, que é derivado do schema e não pode divergir dele.
//
// Se um dia aparecer uma segunda colisão, ela vai falhar aqui, alto e claro,
// em vez de gerar um cliente silenciosamente diferente.
export { StreamSandboxLogsApiV1StreamSandboxesSandboxIdLogsGetParams } from "./generated/api";
