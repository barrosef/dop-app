/**
 * Tela inicial: a caixa de atenção ocupando o centro.
 *
 * "Zero telas até o trabalho" (spec navegação-e-cockpit §1): o que abre a
 * sessão é a fila de "onde eu sou necessário", não um catálogo de workspaces.
 * A árvore fica na barra, à esquerda, para escolher o escopo quando o dev
 * quiser navegar em vez de atender.
 */
import React from 'react';

import { ListaDeAtencao } from '../components/plataforma/caixa-de-atencao';

export default function Inicio() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">
          Onde você é necessário
        </h1>
        <p className="text-xs text-muted-foreground">
          A fila única entre todas as demandas da conta ativa, na ordem que o
          núcleo derivou.
        </p>
      </div>
      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-hidden">
        <ListaDeAtencao />
      </div>
    </div>
  );
}
