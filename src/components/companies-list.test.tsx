import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompaniesList } from "./companies-list";

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
          { id: "e1", nome: "Smart Tennis", esportes: ["tenis"], status: "ativa", logoUrl: null },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    );

    render(<CompaniesList />);

    expect(await screen.findByText("Smart Tennis")).toBeInTheDocument();
    expect(screen.getByText("Ativa")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há empresas", async () => {
    mockFetch(jsonResponse({ data: [], page: 1, pageSize: 20, total: 0 }));

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
