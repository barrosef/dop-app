/**
 * Baixa a especificação OpenAPI do BFF (dop-api) e a grava em `openapi.json`.
 *
 * A spec é VERSIONADA neste repositório, e não buscada no momento da geração.
 * Duas razões:
 *
 *  1. A geração deixa de depender de um servidor no ar — `pnpm codegen` roda
 *     igual no CI, na máquina de quem acabou de clonar e no avião.
 *  2. A mudança de contrato aparece no diff. Um campo que sumiu do BFF vira
 *     uma linha vermelha na revisão, e não um erro de tipo que ninguém
 *     consegue explicar três commits depois.
 *
 * O preço é a sincronização manual: quando o BFF muda, alguém roda este script.
 * É o preço certo — ele é visível, enquanto a alternativa (spec buscada) falha
 * silenciosamente, gerando um cliente diferente para cada dia da semana.
 *
 * Uso:
 *   pnpm --filter @workspace/api-spec run fetch-spec
 *   DOP_API_URL=http://dop-api.dop-local.svc:8000 pnpm ... run fetch-spec
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

const base = (process.env.DOP_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
const url = `${base}/openapi.json`;
const destino = path.resolve(import.meta.dirname, "openapi.json");

const resposta = await fetch(url);
if (!resposta.ok) {
  throw new Error(`Falha ao baixar ${url}: HTTP ${resposta.status} ${resposta.statusText}`);
}

const spec = await resposta.json();
if (!spec?.paths || Object.keys(spec.paths).length === 0) {
  throw new Error(`Spec sem caminhos em ${url} — o BFF respondeu, mas não é a spec esperada.`);
}

// Escrita determinística (2 espaços, quebra final): sem isso, cada download
// produziria um diff artificial.
await writeFile(destino, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
console.log(
  `openapi.json atualizado de ${url} — ${Object.keys(spec.paths).length} caminhos.`,
);
