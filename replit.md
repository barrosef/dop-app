# dop-app — cockpit da plataforma DOP

Cockpit web da plataforma DOP: a caixa de atenção, a árvore de workspaces e
projetos, e o cockpit da demanda. Fala com o **BFF (`dop-api`)**; não tem banco
nem regra de negócio própria.

## Run & Operate

- `pnpm --filter @workspace/dop run dev` — o cockpit (precisa de `PORT` e `BASE_PATH`; ver `artifacts/dop/.env.example`)
- `pnpm run typecheck` — typecheck de todos os pacotes
- `pnpm run build` — typecheck + build
- `pnpm --filter @workspace/api-spec run fetch-spec` — baixa a spec do BFF para `lib/api-spec/openapi.json`
- `pnpm --filter @workspace/api-spec run codegen` — regenera hooks (react-query) e schemas (zod) a partir da spec versionada
- `pnpm --filter @workspace/api-server run dev` — servidor Express local (só o websocket do terminal; ver "Arquitetura")

Para ver o cockpit com dado real é preciso o BFF de pé:

```bash
cd ../dop-api
CORE_GRPC=127.0.0.1:9226 FIREBASE_AUTH_EMULATOR_HOST=auth.localtest.me:8080 \
  uv run uvicorn app.main:app --port 8000
```

A caixa de atenção só enche se o **worker** do núcleo estiver rodando: é ele que
consome os eventos e constrói a projeção. Sem worker, a API responde `200` com a
caixa vazia — o que parece "nada pendente" e não é.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9, React 19 + Vite
- Dados: react-query com hooks gerados por **Orval** a partir da OpenAPI do BFF
- Identidade: **Firebase Auth** (emulador no ambiente local)
- Validação: Zod (`zod/v4`)

## Where things live

| | |
|---|---|
| Spec da API (fonte da geração) | `lib/api-spec/openapi.json` — **baixada do BFF, nunca editada à mão** |
| Configuração da geração | `lib/api-spec/orval.config.ts` |
| Cliente gerado (hooks) | `lib/api-client-react/src/generated/` |
| Transporte (base, token, conta ativa) | `lib/api-client-react/src/custom-fetch.ts` |
| Ligação com o BFF | `artifacts/dop/src/lib/plataforma/backend.ts` |
| Sessão e conta ativa | `artifacts/dop/src/lib/plataforma/{sessao,conta,conta-ativa}.tsx` |
| Telas ligadas ao real | `artifacts/dop/src/pages/{inicio,projeto,demanda,entrar}.tsx` |
| Telas antigas, com dado de MOCK | `artifacts/dop/src/pages/{home,workspace-*}.tsx` (rotas `/workspaces/*`) |

## Architecture decisions

- **A spec é versionada, não buscada na geração.** `fetch-spec` baixa; `codegen`
  lê o arquivo do repositório. A geração não depende de servidor no ar e toda
  mudança de contrato aparece no diff da revisão.
- **Nenhuma regra do backend é reproduzida no front.** A ordem da caixa de
  atenção, o badge, a prioridade dos itens e o fluxo efetivo da demanda vêm
  prontos da API e são renderizados como vieram. Régua duplicada é régua que
  diverge.
- **Conta ativa é cabeçalho por requisição** (`x-account-id`), lido de uma loja
  observável a cada chamada. Trocar de conta limpa o cache do react-query: as
  chaves geradas não incluem a conta.
- **O `api-server` (Express) não serve mais API.** Depois da chegada do BFF,
  sobrou nele o websocket do terminal local (`/api/terminal`) e uma sonda de
  processo. Ver o relatório da fatia de integração para a recomendação.

## Gotchas

- O `EventSource` não envia cabeçalho, e o BFF exige `Authorization` e
  `x-account-id` em cabeçalho: hoje `GET /api/v1/stream/attention` responde
  **401** para o browser. A caixa se mantém honesta relendo o endpoint REST, e o
  indicador na tela diz qual dos dois modos está valendo.
- O emulador do Firebase emite token `alg: none`, **sem assinatura**. Em
  produção a assinatura é verificada de verdade. Nada no cockpit pode depender
  dessa diferença.
- `vite.config.ts` exige `PORT` e `BASE_PATH` no ambiente — sem eles o build
  falha na hora de subir, não depois.
- `pnpm install` pode falhar ao compilar `node-pty` (dependência do
  `api-server`) em máquinas sem `node-gyp`. `pnpm install --ignore-scripts`
  resolve para quem só vai mexer no cockpit.
