# Prompt for the Replit agent — the onboarding journey

Paste everything below the line into the Replit agent, after `git pull origin dev`.

---

Antes de qualquer coisa: `git pull origin dev`. O branch recebeu commits que
você ainda não tem — o cliente gerado (`lib/api-client-react`, `lib/api-zod`,
`lib/api-spec/openapi.json`) e a spec desta tarefa. Sem o pull você vai
construir contra um contrato antigo. Confirme que `git log --oneline -3` mostra
`docs(specs): a jornada de onboarding, tela a tela` antes de começar.

## O que construir

A **jornada de onboarding** do cockpit, do `/sign-up` até "pronto para voar",
exatamente como está em
`docs/superpowers/specs/2026-09-20-onboarding-journey.md`. Leia a spec inteira
antes de tocar em qualquer arquivo; depois leia `RAILS.md` na raiz — ele diz o
que tem que continuar verdadeiro depois da sua mudança (contrato, nenhuma regra
de backend aqui, componentes, direção visual, i18n).

Sete momentos, cada um **explicar → agir → confirmar**:

1. `/sign-up` redesenhado: promessa à esquerda, "como você quer entrar?" à
   direita, e-mail expandindo inline com força da senha e política dita antes do
   erro. A lógica de vinculação, os erros e o `verify-email.tsx` ficam; ganham
   contagem de reenvio e "digitei o e-mail errado".
2. `/welcome/profile` (obrigatório) — pré-preenchido do `useMe`; handle checado
   enquanto digita com `useHandleAvailability`; idioma e fuso detectados para
   confirmar; nascimento opcional com a razão na tela.
3. `/welcome/contact` (opcional) — telefone e código por SMS via
   `useEnrollSecondFactor` (`kind: "sms"`) + `useConfirmSecondFactor`; reenvio
   com atraso crescente, "corrigir número" no lugar, "pular" sempre visível.
4. `/welcome/code` (obrigatório) — tiles de `useListProviders` (categoria
   `git`), selo `operated` vindo da API, painel lateral com permissões
   copiáveis, URL base quando `needs_base_url`, token, **testar conexão**
   (`useCheckResource`). Criação: `useCreateResource` + `useSetCredential`.
5. `/welcome/tasks` (opcional) — mesmos tiles, categoria `task_manager`.
6. `/welcome/plan` (obrigatório) — `useListPlans`, `useSetPlan`; sem preço e
   sem buraco onde iria um preço; Enterprise = "fale conosco".
7. `/welcome/ready` — checklist de `useOnboarding`, `useCompleteOnboarding`, um
   único botão primário que muda conforme há conexão de código ou não.

Mais o **portão** (spec §4): decidido no único lugar onde `App.tsx` já decide o
portão de sessão. `useMe().onboarded === false` → `/welcome/<current>`. Estado
sempre da API, nunca do `localStorage`. Reload duro cai no mesmo passo. Conta
já onboarded nunca vê `/welcome/*`.

## Os hooks que existem (não invente nenhum)

`useMe`, `useOnboarding`, `useRecordStep`, `useCompleteOnboarding`,
`useUpdateProfile`, `useHandleAvailability`, `useUpdatePersonalAccount`,
`useSetPlan`, `useListPlans`, `useListProviders`, `useCheckResource`,
`useListResources`, `useCreateResource`, `useSetCredential`,
`useEnrollSecondFactor`, `useConfirmSecondFactor`, `useListAccounts`,
`useGetTree`, `useCreateProject`. As chaves de query correspondentes
(`getOnboardingQueryKey`, `getListPlansQueryKey`, `getListProvidersQueryKey`,
`getHandleAvailabilityQueryKey`, …) também estão geradas. Se precisar de algo
que não está nessa lista, **pare e diga qual operação falta** (RAILS §8) — não
escreva um `fetch`, não mocke, não invente um caminho.

## A barra

A versão atual das telas ficou bonita e rasa — cards pequenos com campos e um
"Próximo". Isso não atende. O que se espera:

- Painel narrativo em toda etapa: o que ela faz, o que a plataforma fará com a
  resposta, o que custa pular (nas opcionais). É texto de produto, nos dois
  mapas de i18n, não placeholder.
- Trilho de etapas à esquerda com quatro estados (feita, pulada, atual,
  pendente), lido de `OnboardingState.steps` na ordem em que a API lista.
  Pulada é uma escolha, não um erro.
- Ação primária de cada etapa diz o que faz ("Salvar e continuar", "Conectar
  GitHub", "Escolher Free") — nunca um "Próximo" seco.
- Estados de carregando, vazio e erro em toda chamada; um 412 mostra o `detail`
  da API. A recusa de "código" sem conexão e a de "concluir" sem plano vêm da
  API — renderize, não antecipe com regra sua.
- Componentes de `components/ui/` (sheet, form, input-otp, badge, skeleton,
  empty…); nenhum `<select>` nativo, nenhum `<button>` cru, nenhuma cor
  literal fora dos tokens.
- Funciona em largura de celular: o trilho vira uma faixa de progresso no topo.

Escreva o código, os comentários e os identificadores em inglês. Toda string
que uma pessoa lê vai nos dois mapas de `lib/i18n.ts` — conte as chaves antes e
depois; têm que crescer o mesmo tanto.

## O que sai

`/onboarding` e `pages/onboarding.tsx` são removidos quando `/welcome/contact`
existir (reaproveite a lógica do passo do celular — ela estava certa; faltava a
moldura). Nada mais pode apontar para eles.

## Antes de dizer que terminou

`pnpm typecheck` e `PORT=5173 BASE_PATH=/ pnpm build` verdes, a lista de
`RAILS.md` §7 e a de "Done means" na spec §8 — em especial: uma conta Google
nova vai de `/sign-up` a `/welcome/ready` e cai em `/` com o workspace pessoal
na árvore; pular contato e tarefas funciona; pular código é recusado pela API
e a recusa aparece; reload duro em `/welcome/code` continua em
`/welcome/code`.

Contra o QA (`replit.md`, "Against QA"): a entrada por Google é a que funciona
de ponta a ponta hoje; e-mail/senha é recusada até o e-mail ser verificado, e
o canal de e-mail ainda não está ligado. O SMS do passo de contato só chega
quando o QA tiver um adaptador com credencial — até lá, a etapa tem que se
comportar bem com "o código não chegou": reenvio, corrigir, pular.

Entregue por commits pequenos, em português no assunto, descrevendo o achado e
não a edição (`feat(welcome): o trilho lê os passos da API e não de uma lista
local`). Ao final, um resumo do que ficou fora e por quê.
