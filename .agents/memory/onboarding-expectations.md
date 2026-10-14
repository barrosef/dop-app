---
name: Expectativa do cadastro guiado
description: Escopo confirmado pelo usuário para cadastro e oferta de planos.
---

A criação de conta deve ser um wizard em que o usuário configura serviços como GitLab, GitHub ou Azure DevOps, task manager como Jira e por fim seleciona o plano. Por enquanto, somente o gratuito / Community.

**Why:** O usuário esclareceu que criar apenas a conta básica com Google, sem passar pelas configurações, não atende à expectativa.

**How to apply:** Tratar autenticação social como entrada da jornada, não como conclusão do cadastro. Não oferecer planos pagos nesta fase; manter persistência, disponibilidade de integrações e progresso sob autoridade da API.
