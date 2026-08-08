import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// AC-007 (SPEC-001): login funciona e redireciona para a lista de empresas.
describe("LoginForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renderiza os campos de email e senha", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("redireciona para /empresas após login com sucesso", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: "token-123",
        refreshToken: "refresh-123",
        usuario: { id: "u1", nome: "Root", role: "super_admin", companyId: null },
      }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "root@playck.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-valida" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/empresas"));
  });

  it("mostra mensagem de erro genérica em credenciais inválidas (AC-002)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, error: "Unauthorized", message: "Credenciais inválidas" }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "root@playck.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-errada" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas");
    expect(pushMock).not.toHaveBeenCalled();
  });
});
