# Prompt for the Replit agent — the onboarding journey, second pass

- **Date:** 2026-10-14
- **Why a second prompt:** the first one (`2026-09-20-onboarding-journey-replit-prompt.md`)
  produced nothing on `origin/dev`. What the repository holds today is still
  the one-step wizard of the retired 2026-09-06 spec. This prompt is written
  against that gap: it says what exists, what is missing, and how "done" will
  be checked, item by item.
- **The spec it serves:** `2026-09-20-onboarding-journey.md`. Nothing below
  reopens a decision taken there.

Paste everything below the line into the Replit agent, after `git pull origin dev`.

---

Antes de qualquer coisa: `git pull origin dev` e confirme que o commit do topo
cita *o segundo prompt da jornada de onboarding*. Sem o pull você constrói
contra um contrato velho e o trabalho é descartado.

## Onde estamos — leia isto antes da spec

A tarefa da jornada foi passada em 20/09 e **nada chegou ao repositório**. O
que existe hoje em `artifacts/dop/src` é o wizard antigo, e ele não é um ponto
de partida — é o que a spec substitui. Em concreto:

| O que existe | Por que não serve |
|---|---|
| `pages/onboarding.tsx`, um só passo (telefone), aberto como modal sobre `Start` na rota `/onboarding` | A spec pede sete momentos em `/welcome/*`, fora do shell. Nenhuma rota leva a `/onboarding`. |
| `const STEPS = [phone, tools, social, referral, plans]` escrito no arquivo | O trilho tem que ler `OnboardingState.steps` da API. Essa lista é da spec retirada de 06/09. |
| *Pular* e *confirmar* navegam direto para `/` | Nenhum dos dois grava `POST /me/onboarding/steps/contact`. A API nunca fica sabendo. |
| O telefone não é gravado no perfil | A spec manda `PATCH /me {phone}` antes de enrolar o segundo fator. |
| `App.tsx` não lê `useMe().onboarded` nem `useOnboarding` | Não existe portão. Uma conta nova cai em `/` com a árvore vazia. |
| `sign-up.tsx` com `<input>` e `<button>` crus, um card, dois provedores embaixo | RAILS §4 proíbe; a spec pede duas metades, e-mail expandindo inline, política e força da senha. |
| `verify-email.tsx` sem contagem de reenvio nem "digitei o e-mail errado" | Os dois estão na spec §3.0. |
| 26 chaves `wizard.onboarding.*` em cada mapa de i18n; zero chaves `welcome.*` | O texto novo não existe. |
| Dos 19 hooks gerados que a jornada usa, só `useEnrollSecondFactor` e `useConfirmSecondFactor` são chamados | `useMe`, `useOnboarding`, `useRecordStep`, `useCompleteOnboarding`, `useUpdateProfile`, `useHandleAvailability`, `useUpdatePersonalAccount`, `useListPlans`, `useSetPlan`, `useListProviders`, `useCreateResource`, `useSetCredential`, `useCheckResource` não aparecem em nenhuma tela. |

Agora leia, nesta ordem e inteiros: `RAILS.md` na raiz;
`docs/superpowers/specs/2026-09-20-onboarding-journey.md`; e o arquivo
`lib/api-client-react/src/generated/` para ver a assinatura real de cada hook
antes de usá-lo.

## O que entregar — por arquivo

Cada item abaixo é um arquivo ou uma mudança nomeada. Quando terminar, a
lista inteira tem que estar marcada; "fiz a maior parte" é zero.

### Rotas e portão — `App.tsx`

- [ ] Rotas `/welcome/profile`, `/welcome/contact`, `/welcome/code`,
      `/welcome/tasks`, `/welcome/plan`, `/welcome/ready`, **fora** de
      `AuthenticatedShell` (sem sidebar, sem árvore), mas exigindo sessão e
      e-mail verificado — o mesmo `needsEmailVerification` já existente.
- [ ] Um único layout `WelcomeLayout` (trilho + painel narrativo + conteúdo)
      que as seis rotas compartilham via `<Outlet />`.
- [ ] O portão, no **mesmo** lugar onde `AuthenticatedShell` já decide o
      portão de sessão: `useMe().onboarded === false` → `Navigate` para
      `/welcome/<useOnboarding().current>`. Nunca por tela.
- [ ] O inverso: `onboarded === true` abrindo `/welcome/*` → `/`.
- [ ] Reload duro em qualquer `/welcome/<passo>` fica nesse passo. O estado é o
      da API; `localStorage` não decide passo.
- [ ] `/onboarding` removida e `pages/onboarding.tsx` apagado — depois que
      `/welcome/contact` existir, não antes. `grep -rn onboarding src` tem que
      devolver só o que for da jornada.

### Trilho e narrativa — `components/welcome/`

- [ ] `step-rail.tsx`: lê `OnboardingState.steps` na ordem da API; quatro
      estados visuais (`done`, `skipped`, `current`, `pending`); pulado se lê
      como escolha, não como erro. Em largura de celular vira faixa de
      progresso no topo.
- [ ] `narrative.tsx`: três partes — o que esta etapa é, o que a plataforma faz
      com a resposta, o que custa pular (só nas opcionais). Texto de produto,
      nos dois mapas. Nada de *lorem*, nada de uma frase só.
- [ ] `api-error.tsx`: um componente que renderiza a mensagem da API e, num
      412, o `detail`. Reaproveite `apiErrorMessage`, `remainingAttempts` e
      `retryAfterSeconds` do `onboarding.tsx` antigo — essa parte estava certa.

### As telas — `pages/welcome/`

- [ ] `profile.tsx` (obrigatório). Pré-preenchido de `useMe`: foto
      (`avatar_url`, ou iniciais via `profile-initials.ts`), nome, e-mail com
      selo *verificado* quando `email_verified`. Editáveis: nome de exibição;
      handle da conta pessoal (`useListAccounts`, `kind === "personal"`)
      checado enquanto digita por `useHandleAvailability` (debounce; oferece
      `suggestion` quando ocupado; o próprio handle atual lê como disponível);
      idioma e fuso detectados do navegador para confirmação; nascimento
      opcional com uma linha dizendo por quê. Continuar = `useUpdateProfile`
      (só o que mudou) → `useUpdatePersonalAccount` se handle ou nome mudaram
      → `useRecordStep('profile', {status: 'done'})`.
- [ ] `contact.tsx` (opcional). Telefone em E.164 com ajuda de código de país;
      `useUpdateProfile({phone})` **antes** de `useEnrollSecondFactor({kind:
      'sms', destination, label: 'phone'})`; código de seis dígitos em
      `input-otp`; `useConfirmSecondFactor`; reenvio com atraso visivelmente
      crescente; *corrigir número* no lugar; *pular* sempre visível. Pular →
      `useRecordStep('contact', {status: 'skipped'})`; código confirmado →
      `{status: 'done'}`. Telefone digitado e não confirmado fica salvo — o
      lembrete é da caixa de atenção, não desta tela.
- [ ] `code.tsx` (obrigatório). Tiles de `useListProviders` filtrados por
      `category === 'git'`: nome, marca em `brand_color` com iniciais (sem
      arquivo de logo), selo `operated` → *operado hoje* / senão *registrado —
      operação a caminho*. `useListResources({kind: 'integration'})` mostra o
      que já existe. Tile selecionado abre um `sheet` com `credential_kind`,
      `permissions` **listadas e copiáveis**, link para `docs_url`, campo de
      URL base quando `needs_base_url`, campo do token e *testar conexão*.
      Conectar = `useCreateResource({kind: 'integration', name, config:
      {category: 'git', provider: key, base_url?}})` →
      `useSetCredential(resource_id, {secret_base64})`. Testar =
      `useCheckResource(resource_id)`; renderize `operated`, `ok`, `identity`,
      `message` como vierem — provedor não operado é resposta honesta, não erro.
      Concluir = `useRecordStep('code', {status: 'done'})`; **a API recusa com
      412 sem conexão git** — renderize a recusa, não a antecipe.
- [ ] `tasks.tsx` (opcional). Os mesmos tiles e o mesmo painel com
      `category === 'task_manager'`; extraia o tile e o painel para
      `components/welcome/provider-tile.tsx` e `provider-sheet.tsx` em vez de
      duplicar. Pular → `skipped`; conectar → `done`.
- [ ] `plan.tsx` (obrigatório). `useListPlans` na ordem da API: `name`,
      `tagline`, `features`. **Sem preço e sem espaço onde iria um preço.**
      Primeiro plano pré-selecionado. Enterprise = *fale conosco*, `mailto:`
      com endereço vindo de `lib/platform/config.ts`, nunca literal na tela.
      Continuar = `useSetPlan({plan_key})` → `useRecordStep('plan', {status:
      'done'})`.
- [ ] `ready.tsx`. Checklist de `useOnboarding`: perfil ✓; telefone —
      *verificado* / *não verificado* / *não informado* (de `phone` e
      `phone_verified`); conexões de código `code_connections`; de tarefas
      `task_connections` ou *nenhuma*; plano ✓ com nome (de `plan_key` cruzado
      com `useListPlans`). Card oferecendo segundo fator → `/account`
      (Segurança). **Um** botão primário: *Criar seu primeiro projeto* quando
      `code_connections > 0`, *Conectar seu código* (→ `/welcome/code`) quando
      zero. Secundário: *Ir para o cockpit*. O primário chama
      `useCompleteOnboarding` antes; num 412 o `detail` nomeia o passo que falta
      — mostre com link para ele.
- [ ] Cada ação primária diz o que faz (*Salvar e continuar*, *Conectar
      GitHub*, *Escolher Free*). Um "Próximo" seco reprova a tela.
- [ ] Carregando (`skeleton`), vazio (`empty`) e erro em **toda** chamada.

### Entrada — `pages/sign-up.tsx` e `pages/verify-email.tsx`

- [ ] `sign-up.tsx` em duas metades: esquerda, a promessa em três linhas
      (*conecte seu código · traga seus cards · o agente trabalha no seu
      fluxo*); direita, *Como você quer entrar?* — Google, GitHub, e-mail.
      E-mail expande **inline** em endereço e senha, com força da senha e a
      política dita antes de ser violada. `Button`, `Input`, `Form` de
      `components/ui/` — nenhum elemento cru. `handleFailure`,
      `decideFromAuthError` e o desvio para `/link-provider` ficam como estão.
- [ ] `verify-email.tsx` ganha contagem regressiva visível no reenvio e
      *digitei o e-mail errado*. A lógica de rate limit que já existe fica.
- [ ] Depois de um provedor social criar a conta, `navigate('/')` continua
      certo: o portão em `App.tsx` manda para `/welcome/profile`.

### i18n — `lib/i18n.ts`

- [ ] As 26 chaves `wizard.onboarding.*` saem de cada mapa; as chaves
      `welcome.*` entram nos dois. Conte antes e depois: `pt` e `en` têm que
      ter o mesmo total. Registre os dois números no resumo final.

## Os hooks que existem — e só eles

`useMe`, `useOnboarding`, `useRecordStep`, `useCompleteOnboarding`,
`useUpdateProfile`, `useHandleAvailability`, `useUpdatePersonalAccount`,
`useSetPlan`, `useListPlans`, `useListProviders`, `useCheckResource`,
`useListResources`, `useCreateResource`, `useSetCredential`,
`useEnrollSecondFactor`, `useConfirmSecondFactor`, `useListAccounts`,
`useGetTree`, `useCreateProject`. Depois de gravar um passo, invalide
`getOnboardingQueryKey()` e `getMeQueryKey()` para o trilho e o portão
acompanharem. Se faltar algo, **pare e diga qual operação falta** (RAILS §8):
nenhum `fetch`, nenhum mock, nenhum caminho inventado.

## O que não fazer — cada um destes já aconteceu uma vez

- Não reaproveite `pages/onboarding.tsx` como base. Extraia dele só o passo
  do telefone e os helpers de erro; o resto morre.
- Não escreva a lista de passos no código. Ela vem de `OnboardingState.steps`.
- Não decida localmente que um passo obrigatório "não pode ser pulado". Mande
  o `skipped` e renderize o 412 da API.
- Não guarde em `localStorage` qual passo mostrar. Rascunho de formulário,
  no máximo.
- Não abra a jornada como modal sobre o cockpit. É uma rota própria, fora do
  shell.
- Não entregue uma tela por vez pedindo aprovação. Entregue a jornada inteira
  em commits pequenos (assunto em português, descrevendo o achado:
  `feat(welcome): o portão decide o passo lendo a API, não o navegador`).

## Antes de dizer que terminou

`pnpm typecheck` e `PORT=5173 BASE_PATH=/ pnpm build` verdes, a lista de
`RAILS.md` §7 e esta, que será conferida item a item contra QA:

- [ ] uma conta Google nova vai de `/sign-up` a `/welcome/ready` e cai em `/`
      com o workspace pessoal na árvore;
- [ ] pular contato e tarefas funciona e o trilho mostra os dois como pulados;
- [ ] pular código é recusado pela API e a recusa (o `detail`) aparece na tela;
- [ ] *concluir* antes do plano é recusado, o passo é nomeado e o link leva até
      ele;
- [ ] reload duro em `/welcome/code` continua em `/welcome/code`;
- [ ] uma conta já onboarded abrindo `/welcome/plan` vai para `/`;
- [ ] `/onboarding` devolve 404 e `pages/onboarding.tsx` não existe;
- [ ] `grep -rn "wizard.onboarding" src` devolve nada;
- [ ] os mapas `pt` e `en` cresceram pelo mesmo número de chaves;
- [ ] nenhuma cor literal, nenhum `<select>`/`<button>`/`<input>` cru nas
      telas novas;
- [ ] funciona em 390px de largura: trilho vira faixa no topo, nada corta.

Contra o QA (`replit.md`, "Against QA"): Google é o caminho que funciona de
ponta a ponta; e-mail/senha é recusado até o e-mail ser verificado e o canal
ainda não está ligado; o SMS do passo de contato só chega quando houver
adaptador com credencial — até lá, a etapa tem que se comportar bem com "o
código não chegou": reenvio, corrigir, pular.

Ao final, um resumo com: cada item desta lista marcado ou, se não, por quê;
a contagem de chaves de i18n antes e depois; e qualquer operação que faltou na
API, nomeada.
