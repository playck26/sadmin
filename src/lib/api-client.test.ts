import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, listCompanies, login } from "./api-client";
import { getAccessToken, saveAccessToken } from "./auth-storage";
import { navegarPara } from "./navegacao";

vi.mock("./navegacao", () => ({ navegarPara: vi.fn() }));

/**
 * 2026-09-30 — o painel mostrava "Forbidden" e zero empresas.
 *
 * O cookie de refresh é um só para os três painéis (mesmo host da API, mesmo
 * path). Um login no painel do clube, no mesmo navegador, troca o cookie; a
 * renovação seguinte daqui recebia um access token de gestor, guardava, e
 * toda rota de `/companies` respondia 403. O login também aceitava gestor.
 *
 * Os casos de controle (super admin passa, renovação de super admin repete o
 * pedido, token ilegível segue) existem para provar que a trava não barra
 * quem devia passar — sem eles, "barrar tudo" também deixaria esta suíte
 * verde.
 */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.assinatura`;
}

// `nome` acentuado de propósito: o payload é UTF-8 e o `atob` devolve bytes.
const TOKEN_SUPER_ADMIN = jwt({ sub: "u1", nome: "Raiz Ção", role: "super_admin", companyId: null });
const TOKEN_GESTOR = jwt({ sub: "u2", nome: "Gestora Ângela", role: "company_admin", companyId: "c1" });

const PAGINA_VAZIA = { data: [], meta: { page: 1, pageSize: 20, total: 0 } };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = () => fetch as unknown as ReturnType<typeof vi.fn>;

function urlsPedidas(): string[] {
  return fetchMock().mock.calls.map(([url]) => String(url));
}

describe("api-client: sessão de outro perfil", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(navegarPara).mockClear();
    window.localStorage.clear();
    window.history.pushState({}, "", "/empresas");
  });

  it("token de gestor já salvo: não chama a API, limpa o token e leva ao login com o motivo", async () => {
    saveAccessToken(TOKEN_GESTOR);

    const erro = await listCompanies().catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).status).toBe(403);
    expect((erro as ApiError).message).toMatch(/não é de super admin/);
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
    expect(navegarPara).toHaveBeenCalledWith("/login?motivo=outro-perfil");
  });

  it("renovação que devolve token de gestor: não repete o pedido, limpa e leva ao login com o motivo", async () => {
    saveAccessToken(TOKEN_SUPER_ADMIN);
    fetchMock()
      .mockResolvedValueOnce(jsonResponse({ statusCode: 401, message: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: TOKEN_GESTOR }));

    const erro = await listCompanies().catch((e: unknown) => e);

    expect((erro as ApiError).status).toBe(403);
    expect(urlsPedidas()).toEqual([
      expect.stringContaining("/api/v1/companies?page=1&pageSize=20"),
      expect.stringContaining("/api/v1/auth/refresh"),
    ]);
    expect(getAccessToken()).toBeNull();
    expect(navegarPara).toHaveBeenCalledWith("/login?motivo=outro-perfil");
  });

  it("controle: token de super admin segue para a API com o Bearer", async () => {
    saveAccessToken(TOKEN_SUPER_ADMIN);
    fetchMock().mockResolvedValueOnce(jsonResponse(PAGINA_VAZIA));

    await expect(listCompanies()).resolves.toEqual(PAGINA_VAZIA);

    const [, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN_SUPER_ADMIN}`);
    expect(navegarPara).not.toHaveBeenCalled();
  });

  it("controle: renovação que devolve token de super admin repete o pedido", async () => {
    const renovado = jwt({ sub: "u1", nome: "Raiz Ção", role: "super_admin", companyId: null, n: 2 });
    saveAccessToken(TOKEN_SUPER_ADMIN);
    fetchMock()
      .mockResolvedValueOnce(jsonResponse({ statusCode: 401, message: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: renovado }))
      .mockResolvedValueOnce(jsonResponse(PAGINA_VAZIA));

    await expect(listCompanies()).resolves.toEqual(PAGINA_VAZIA);

    expect(urlsPedidas()).toHaveLength(3);
    expect(getAccessToken()).toBe(renovado);
    expect(navegarPara).not.toHaveBeenCalled();
  });

  it("controle: token ilegível não é barrado aqui — quem decide é o servidor", async () => {
    saveAccessToken("token-que-nao-e-jwt");
    fetchMock().mockResolvedValueOnce(jsonResponse(PAGINA_VAZIA));

    await expect(listCompanies()).resolves.toEqual(PAGINA_VAZIA);
    expect(navegarPara).not.toHaveBeenCalled();
  });
});

describe("api-client: login", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("recusa credencial válida de outro perfil", async () => {
    fetchMock().mockResolvedValueOnce(
      jsonResponse({
        accessToken: TOKEN_GESTOR,
        refreshToken: "r",
        usuario: { id: "u2", nome: "Gestora", email: "g@x.com", role: "company_admin", companyId: "c1" },
      }),
    );

    const erro = await login({ email: "g@x.com", senha: "senha-valida" }).catch((e: unknown) => e);

    expect((erro as ApiError).status).toBe(403);
    expect((erro as ApiError).message).toMatch(/não é de super admin/);
  });

  it("controle: aceita super admin", async () => {
    fetchMock().mockResolvedValueOnce(
      jsonResponse({
        accessToken: TOKEN_SUPER_ADMIN,
        refreshToken: "r",
        usuario: { id: "u1", nome: "Raiz", email: "r@x.com", role: "super_admin", companyId: null },
      }),
    );

    await expect(login({ email: "r@x.com", senha: "senha-valida" })).resolves.toMatchObject({
      accessToken: TOKEN_SUPER_ADMIN,
    });
  });
});
