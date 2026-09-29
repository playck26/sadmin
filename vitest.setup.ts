import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";

/**
 * **Nenhum teste fala com a rede** (2026-09-29).
 *
 * O `vi.mock("@/lib/api-client", …)` dos testes espalha o módulo REAL e troca
 * só as funções que o caso nomeia. Uma função esquecida — do componente ou de
 * um filho dele — chegava ao `fetch` de verdade. Sem API rodando, o pedido
 * falhava, a tela seguia pelo caminho de erro, e o teste passava; mas a falha
 * chegava quando chegava, às vezes DEPOIS do fim do arquivo, e o `setState` da
 * resposta encontrava o `window` já desmontado: "ReferenceError: window is not
 * defined", fora de qualquer teste. Foi o que derrubou o CI do `main` do
 * Cliente em 2026-09-29. Medido aqui na suíte inteira: nenhum teste do
 * SAdmin fazia isso — a trava é para continuar assim.
 *
 * Por isso o `fetch` global daqui **recusa na hora** e o teste que o chamou
 * **cai**, com a URL na mensagem — o esquecimento aparece no teste que o
 * cometeu, e não como um vermelho intermitente num arquivo qualquer. Teste que
 * precisa de `fetch` o simula (`vi.stubGlobal`, `vi.spyOn`), e isso substitui
 * esta trava enquanto durar. A mesma trava mora no Cliente, no Admin e no
 * SAdmin.
 */
const pedidosReais: string[] = [];

globalThis.fetch = ((entrada: RequestInfo | URL) => {
  const url =
    typeof entrada === "string"
      ? entrada
      : entrada instanceof URL
        ? entrada.href
        : entrada.url;
  pedidosReais.push(url);
  return Promise.reject(new TypeError(`fetch real em teste: ${url}`));
}) as typeof fetch;

beforeEach(() => {
  pedidosReais.length = 0;
});

afterEach(() => {
  if (pedidosReais.length === 0) return;
  const lista = [...new Set(pedidosReais)].join(", ");
  pedidosReais.length = 0;
  throw new Error(
    `Este teste fez pedido de rede de verdade, sem mock: ${lista}. ` +
      "Simule a função da api-client que o faz (ou a do componente filho).",
  );
});
