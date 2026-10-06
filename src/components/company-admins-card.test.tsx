import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminDaEmpresa } from "@/lib/api-client";
import { CompanyAdminsCard } from "./company-admins-card";

/**
 * SPEC-085 — o formulário "Adicionar gestor". É o primeiro teste deste card;
 * a parte da SPEC-016 (gerar senha) continua sem teste de tela.
 *
 * O `api-client` é dublado só nas duas funções que o formulário usa; o
 * `ApiError` é o de verdade, porque é por `instanceof` que o card decide
 * mostrar a mensagem do servidor.
 */
const fn = vi.hoisted(() => ({
  listCompanyAdmins: vi.fn(),
  criarAdmin: vi.fn(),
}));

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listCompanyAdmins: fn.listCompanyAdmins,
    criarAdmin: fn.criarAdmin,
  };
});

const INICIAL: AdminDaEmpresa = {
  id: "u1",
  nome: "Gestor Inicial",
  email: "inicial@clube.demo",
  status: "ativo",
  senhaTemporaria: false,
};
const SEGUNDA: AdminDaEmpresa = {
  id: "u2",
  nome: "Segunda Gestora",
  email: "segunda@clube.demo",
  status: "ativo",
  senhaTemporaria: false,
};

const CAMPOS = ["Nome", "Email", "Senha", "Telefone (opcional)"] as const;

/**
 * Os quatro campos, um por um. Conferir só alguns deixou passar, na 1ª
 * rodada da validação, limpar só a senha no erro e esquecer o e-mail no
 * sucesso (M09, M10).
 */
function esperarCampos(valores: readonly [string, string, string, string]) {
  CAMPOS.forEach((rotulo, i) => {
    expect(screen.getByLabelText(rotulo)).toHaveValue(valores[i]);
  });
}

function preencher(telefone = "") {
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: SEGUNDA.nome },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: SEGUNDA.email },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "senha-forte-1" },
  });
  fireEvent.change(screen.getByLabelText("Telefone (opcional)"), {
    target: { value: telefone },
  });
}

describe("CompanyAdminsCard — adicionar gestor (SPEC-085)", () => {
  beforeEach(() => {
    fn.listCompanyAdmins.mockReset();
    fn.criarAdmin.mockReset();
    fn.listCompanyAdmins.mockResolvedValue([INICIAL]);
  });

  it("AC-006: envia os campos, limpa o formulário e recarrega a lista", async () => {
    fn.criarAdmin.mockResolvedValue(SEGUNDA);
    render(<CompanyAdminsCard companyId="e1" />);
    await screen.findByText(INICIAL.nome);
    fn.listCompanyAdmins.mockResolvedValue([INICIAL, SEGUNDA]);

    preencher("11999990000");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar gestor" }));

    await screen.findByText(SEGUNDA.email);
    expect(fn.criarAdmin).toHaveBeenCalledWith("e1", {
      nome: SEGUNDA.nome,
      email: SEGUNDA.email,
      senha: "senha-forte-1",
      telefone: "11999990000",
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      `${SEGUNDA.nome} foi adicionado`,
    );
    esperarCampos(["", "", "", ""]);
    expect(fn.listCompanyAdmins).toHaveBeenCalledTimes(2);
  });

  it("AC-006: telefone vazio não vai como string vazia", async () => {
    fn.criarAdmin.mockResolvedValue(SEGUNDA);
    render(<CompanyAdminsCard companyId="e1" />);
    await screen.findByText(INICIAL.nome);

    preencher("");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar gestor" }));

    await waitFor(() => expect(fn.criarAdmin).toHaveBeenCalled());
    const dto = fn.criarAdmin.mock.calls[0][1] as Record<string, unknown>;
    expect(dto.telefone).toBeUndefined();
  });

  it("AC-006: no erro mostra a mensagem do servidor e mantém o que foi digitado", async () => {
    const { ApiError } = await import("@/lib/api-client");
    fn.criarAdmin.mockRejectedValue(
      new ApiError(409, "Este e-mail já pertence a outra conta."),
    );
    render(<CompanyAdminsCard companyId="e1" />);
    await screen.findByText(INICIAL.nome);

    preencher("11999990000");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar gestor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este e-mail já pertence a outra conta.",
    );
    esperarCampos([SEGUNDA.nome, SEGUNDA.email, "senha-forte-1", "11999990000"]);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("AC-007: o botão fica desabilitado enquanto a requisição está no ar", async () => {
    let concluir: (g: AdminDaEmpresa) => void = () => {};
    fn.criarAdmin.mockReturnValue(
      new Promise<AdminDaEmpresa>((resolve) => {
        concluir = resolve;
      }),
    );
    render(<CompanyAdminsCard companyId="e1" />);
    await screen.findByText(INICIAL.nome);

    preencher();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar gestor" }));

    const botao = await screen.findByRole("button", { name: "Adicionando..." });
    expect(botao).toBeDisabled();
    fireEvent.click(botao);
    expect(fn.criarAdmin).toHaveBeenCalledTimes(1);

    concluir(SEGUNDA);
    await screen.findByRole("button", { name: "Adicionar gestor" });
  });
});
