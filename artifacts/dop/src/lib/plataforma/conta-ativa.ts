/**
 * A conta ativa — a conta sob a qual o usuário está operando agora.
 *
 * Toda chamada ao BFF carrega uma (cabeçalho `x-account-id`), e é ela que
 * decide papel, concessões e QUAIS dados voltam. Por isso ela precisa ser
 * legível de dois lugares: de dentro do React (para desenhar o seletor) e de
 * FORA dele (o `customFetch`, que não é um componente). Daí a loja mínima
 * abaixo, com `useSyncExternalStore` do lado do React.
 *
 * Persistida em `localStorage` para o F5 não jogar o usuário de volta na
 * conta errada.
 */

const CHAVE = 'dop.conta-ativa';

type Ouvinte = () => void;

let contaAtiva: string = lerDoArmazenamento();
const ouvintes = new Set<Ouvinte>();

function lerDoArmazenamento(): string {
  try {
    return localStorage.getItem(CHAVE) ?? '';
  } catch {
    // Navegação privada ou armazenamento bloqueado: seguimos sem persistir.
    return '';
  }
}

export function obterContaAtiva(): string {
  return contaAtiva;
}

export function definirContaAtiva(id: string): void {
  if (id === contaAtiva) return;
  contaAtiva = id;
  try {
    if (id) localStorage.setItem(CHAVE, id);
    else localStorage.removeItem(CHAVE);
  } catch {
    // idem
  }
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarContaAtiva(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}
