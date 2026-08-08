import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompaniesList } from "./companies-list";

// EVD-007 (SPEC-002): fluxo de listagem na UI do sadmin.
describe("CompaniesList", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("mostra as empresas retornadas pela API", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "e1", nome: "Smart Tennis", esportes: ["tenis"], status: "ativa", logoUrl: null },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    });

    render(<CompaniesList />);

    expect(await screen.findByText("Smart Tennis")).toBeInTheDocument();
    expect(screen.getByText("Ativa")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há empresas", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], page: 1, pageSize: 20, total: 0 }),
    });

    render(<CompaniesList />);

    await waitFor(() => expect(screen.getByText("Nenhuma empresa cadastrada ainda.")).toBeInTheDocument());
  });

  it("mostra mensagem de erro quando a API falha", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ statusCode: 403, error: "Forbidden", message: "Forbidden resource" }),
    });

    render(<CompaniesList />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden resource");
  });
});
