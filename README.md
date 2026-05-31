# dop-app — frontend do DOP

Frontend (React + Vite + TypeScript) onde o **Dev** trabalha: tela inicial de
workspaces, wizard de configuração, lista de demandas e **tela de execução** da demanda
(chat + wizard de etapas + dossiê + logs).

Construído **mock-first** (sem backend) pelo **Replit**, e integrado à `dop-api` pelo
**Claude**. As telas dependem apenas da interface `DopApi`, de modo que o cliente mock
seja trocado por um cliente HTTP real sem reescrever a UI.

- **Prompt de construção (Replit):** `docs/prd/dop-1.0-mvp/replit-frontend-prompt.md`
  (repositório raiz `dop`).
- **Contrato de dados:** interface `DopApi` + `types.ts` (mesmo prompt).

Status: 🚧 a ser gerado pelo Replit (1.0 MVP).
