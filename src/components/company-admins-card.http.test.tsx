import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminDaEmpresa } from "@/lib/api-client";
import { CompanyAdminsCard } from "./company-admins-card";

/**
 * SPEC-085/AC-006 — **a ligação do card com a rota**, com o `api-client` de
 * verdade e só o `fetch` dublado.
 *
 * O teste irmão (`company-admins-card.test.tsx`) dubla o `criarAdmin`
 * inteiro, e por isso trocar a URL dele ficava verde (M11 da 1ª rodada da
 * validação). Aqui o dublê é o servidor: ele só conhece `GET` e `POST` em
 * `/api/v1/companies/e1/admins`, e qualquer outro pedido recebe `404`.
 */
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
const ROTA = "/api/v1/companies/e1/admins";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface Pedido {
  url: string;
  method: string;
  body: unknown;
}

/** O servidor dublado; `post` decide a resposta do `POST`. */
function servidor(post: () => Response): Pedido[] {
  const pedidos: Pedido[] = [];
  let admins = [INICIAL];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      pedidos.push({
        url,
        method,
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      });
      if (!url.endsWith(ROTA)) {
        return Promise.resolve(json({ message: "Cannot find route" }, 404));
      }
      if (method === "GET") return Promise.resolve(json(admins, 200));
      if (method === "POST") {
        const res = post();
        if (res.status === 201) admins = [INICIAL, SEGUNDA];
        return Promise.resolve(res);
      }
      return Promise.resolve(json({}, 405));
    }),
  );
  return pedidos;
}

function preencher() {
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
    target: { value: "11999990000" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar gestor" }));
}

describe("CompanyAdminsCard — rota real do api-client (SPEC-085)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("AC-006: faz POST na rota da empresa com os quatro campos, e o 201 recarrega a lista", async () => {
    const pedidos = servidor(() => json(SEGUNDA, 201));
    render(<CompanyAdminsCard companyId="e1" />);
    await screen.findByText(INICIAL.nome);

    preencher();

    await screen.findByText(SEGUNDA.email);
    const posts = pedidos.filter((p) => p.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].url.endsWith(ROTA)).toBe(true);
    expect(posts[0].body).toEqual({
      nome: SEGUNDA.nome,
      email: SEGUNDA.email,
      senha: "senha-forte-1",
      telefone: "11999990000",
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("AC-006: o 409 EMAIL_EM_USO do servidor chega à tela com a mensagem dele", async () => {
    servidor(() =>
      json(
        {
          statusCode: 409,
          code: "EMAIL_EM_USO",
          message:
            "Este e-mail já pertence a outra conta. Uma pessoa não pode ter duas contas na plataforma (LIM-001).",
        },
        409,
      ),
    );
    render(<CompanyAdminsCard companyId="e1" />);
    await screen.findByText(INICIAL.nome);

    preencher();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este e-mail já pertence a outra conta.",
    );
    expect(screen.getByLabelText("Email")).toHaveValue(SEGUNDA.email);
    expect(screen.queryByText(SEGUNDA.nome, { selector: "p" })).toBeNull();
  });
});
