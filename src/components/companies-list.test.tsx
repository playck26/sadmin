import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaginatedCompanies } from "@/lib/api-client";
import { CompaniesList } from "./companies-list";

/**
 * SPEC-021/INV-059 — **a fixture desta lista é tipada pelo contrato, e não é
 * zelo: sem isso o alias de tipo não protege esta tela.**
 *
 * Descoberto por sabotagem em 2026-08-27. `Empresa` virou apelido de
 * `EmpresaResponseDto`, e a pergunta era se isso já bastava. Não basta:
 * trocando `esportes: string[]` por `{ id, nome }[]` no schema — a forma
 * EXATA do DEF-012 — o typecheck do SAdmin continuou verde.
 *
 * O motivo é simples e desagradável: `companies-list.tsx` faz
 * `empresa.esportes.join(", ")`, e `join` existe em **qualquer** array. O
 * tipo do elemento pode virar objeto que a chamada continua compilando — e em
 * runtime a tela imprime `"[object Object]"`.
 *
 * Nem o alias nem este teste pegavam sozinhos: a fixture era um literal solto
 * que o TypeScript nunca confrontava com nada. **Tipada, ela é que fica
 * vermelha** quando o `back` muda a forma — e a linha vermelha aparece aqui,
 * no arquivo que descreve o que a tela espera.
 *
 * É o mesmo buraco do `mockRotas(itensDoDia: unknown[])` no Admin: fixture
 * sem tipo é uma segunda afirmação escrita à mão, escondida dentro do teste
 * que deveria conferir a primeira.
 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch(res: Response): void {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(res);
}

// EVD-007 (SPEC-002): fluxo de listagem na UI do sadmin.
//
// Os mocks devolvem `Response` de verdade, e nao um objeto solto com
// `ok`/`json`. Ate 2026-08-22 devolviam o objeto solto, e o teste de erro
// quebrou quando o `authFetch` passou a inspecionar o corpo do 403
// (SPEC-013/INV-013): faltava `clone()`. A fixture e que estava mentindo
// sobre o que `fetch` devolve — o codigo so passou a usar mais da interface
// que sempre existiu.
describe("CompaniesList", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("mostra as empresas retornadas pela API", async () => {
    mockFetch(
      jsonResponse({
        data: [
          {
            id: "e1",
            nome: "Smart Tennis",
            slug: "smart-tennis",
            esportes: ["tenis"],
            status: "ativa",
            logoUrl: null,
            permiteAutoCadastro: true,
            createdAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-01T00:00:00.000Z",
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      } satisfies PaginatedCompanies),
    );

    render(<CompaniesList />);

    expect(await screen.findByText("Smart Tennis")).toBeInTheDocument();
    expect(screen.getByText("Ativa")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há empresas", async () => {
    mockFetch(
      jsonResponse({
        data: [],
        page: 1,
        pageSize: 20,
        total: 0,
      } satisfies PaginatedCompanies),
    );

    render(<CompaniesList />);

    await waitFor(() =>
      expect(screen.getByText("Nenhuma empresa cadastrada ainda.")).toBeInTheDocument(),
    );
  });

  it("mostra mensagem de erro quando a API falha", async () => {
    mockFetch(
      jsonResponse(
        { statusCode: 403, error: "Forbidden", message: "Forbidden resource" },
        403,
      ),
    );

    render(<CompaniesList />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden resource");
  });

  // SPEC-013/INV-013 — 403 com `code: CONTA_INATIVA` nao e erro de tela: e
  // fim de sessao. O `authFetch` encerra a sessao e leva para o login, em
  // vez de deixar a pessoa numa tela viva que so devolve erro.
  it("trata 403 CONTA_INATIVA como fim de sessao", async () => {
    mockFetch(
      jsonResponse(
        { statusCode: 403, code: "CONTA_INATIVA", message: "Esta conta está inativa." },
        403,
      ),
    );

    render(<CompaniesList />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/inativa/i);
  });
});
