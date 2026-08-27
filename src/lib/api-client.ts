import type { components } from "./api-types";
import {
  clearAccessToken,
  getAccessToken,
  saveAccessToken,
} from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type LoginDto = components["schemas"]["LoginDto"];
export type CreateCompanyDto = components["schemas"]["CreateCompanyDto"];
export type UpdateCompanyDto = components["schemas"]["UpdateCompanyDto"];
export type CompanyStatus = "ativa" | "inativa";

/**
 * SPEC-021/INV-059 — **estes tipos eram `interface` escrita à mão e viraram
 * apelidos do schema publicado.**
 *
 * Até 2026-08-27 o `back` publicava schema de resposta para 10 das 90
 * operações; hoje publica para as 90. Enquanto não havia o que gerar, todo
 * tipo de resposta aqui era uma **afirmação** — e afirmação envelhece calada.
 *
 * O `LoginResult` daqui é o exemplo: ele declarava
 * `role: "super_admin" | "company_admin" | "aluno"` e **faltava
 * `"professor"`**, que existe desde a SPEC-013. Nunca quebrou porque ninguém
 * tentou logar um professor no painel do super admin — o tipo estava errado e
 * o silêncio parecia acerto.
 *
 * `Empresa` também omitia dois campos que a API devolve (`slug` e
 * `permiteAutoCadastro`) e declarava `createdAt: string` onde o contrato diz
 * `date-time`.
 */
export type LoginResult = components["schemas"]["LoginResponseDto"];
export type Empresa = components["schemas"]["EmpresaResponseDto"];
export type PaginatedCompanies =
  components["schemas"]["EmpresaPaginadaResponseDto"];
export type CreateCompanyResult =
  components["schemas"]["EmpresaCriadaResponseDto"];

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  return body && typeof body === "object" && "message" in body && typeof body.message === "string"
    ? body.message
    : fallback;
}

/**
 * Renova o access token usando o refresh token do cookie httpOnly.
 *
 * O backend implementa rotação de refresh desde a SPEC-001 (REQ-003), mas
 * nenhum frontend chamava esta rota: o access token vale 15 minutos, e
 * qualquer ação depois disso morria com "Unauthorized" no meio da tela.
 * Passava despercebido porque, em teste, o intervalo entre logar e agir
 * era sempre menor que 15 minutos.
 *
 * `credentials: "include"` é obrigatório — é o que manda o cookie de
 * refresh (httpOnly, `SameSite=Strict`, path `/api/v1/auth`).
 */
let renovacaoEmCurso: Promise<boolean> | null = null;

async function renovarSessao(): Promise<boolean> {
  // Várias requisições podem receber 401 ao mesmo tempo (uma tela que
  // carrega três listas, por exemplo). Sem esta trava, cada uma dispararia
  // um refresh, e a rotação do backend trataria as concorrentes como reuso
  // de token — revogando a sessão inteira, que é o oposto do desejado.
  if (renovacaoEmCurso) return renovacaoEmCurso;

  renovacaoEmCurso = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      const { accessToken } = (await res.json()) as { accessToken: string };
      saveAccessToken(accessToken);
      return true;
    } catch {
      return false;
    } finally {
      renovacaoEmCurso = null;
    }
  })();

  return renovacaoEmCurso;
}

function encerrarSessao(): void {
  clearAccessToken();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    // Navegação dura de propósito, em vez de `router.push`: este módulo não
    // é componente (não há hook disponível) e, mais importante, sessão
    // perdida deve descartar todo o estado em memória — cache de listas,
    // formulário pela metade, dados de outro usuário.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
}

async function temCodigo(res: Response, codigo: string): Promise<boolean> {
  try {
    const body: unknown = await res.json();
    return (
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      (body as { code?: string }).code === codigo
    );
  } catch {
    return false;
  }
}

async function requisicaoAutenticada(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const accessToken = getAccessToken();
  return fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let res = await requisicaoAutenticada(path, init);

  // 401 aqui quase sempre é access token vencido, não credencial errada:
  // tenta renovar uma vez e repete. Se a renovação falhar, a sessão acabou
  // de verdade — manda para o login em vez de mostrar "Unauthorized" no
  // meio de um formulário.
  // SPEC-013/INV-013 — conta inativada enquanto a sessão estava aberta. O
  // servidor passa a responder 403 CONTA_INATIVA em toda rota, e um 403 não
  // dispara a renovação logo abaixo: sem este desvio a pessoa ficaria presa
  // numa tela viva cheia de erros, sem entender que perdeu o acesso.
  // Encerra a sessão como se fosse expiração, porque para ela é isso mesmo.
  // SPEC-014:TASK-000 / INV-008 — o servidor barra tudo enquanto a senha for
  // temporaria. Sem este desvio a pessoa veria erro seco em cada tela em vez
  // da unica tela que resolve o problema dela.
  if (res.status === 403 && (await temCodigo(res.clone(), "SENHA_TEMPORARIA"))) {
    if (typeof window !== "undefined" && window.location.pathname !== "/primeiro-acesso") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/primeiro-acesso";
    }
    throw new ApiError(403, "Crie sua senha para continuar.");
  }

  if (res.status === 403 && (await temCodigo(res.clone(), "CONTA_INATIVA"))) {
    encerrarSessao();
    throw new ApiError(
      403,
      await parseErrorMessage(res, "Esta conta está inativa. Procure o administrador."),
    );
  }

  if (res.status === 401) {
    const renovou = await renovarSessao();
    if (!renovou) {
      encerrarSessao();
      throw new ApiError(401, "Sua sessão expirou. Entre novamente.");
    }
    res = await requisicaoAutenticada(path, init);
    if (res.status === 401) {
      encerrarSessao();
      throw new ApiError(401, "Sua sessão expirou. Entre novamente.");
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res, "Não foi possível completar a operação"));
  }

  return res;
}

export async function login(dto: LoginDto): Promise<LoginResult> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(dto),
  });

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res, "Não foi possível entrar"));
  }

  return (await res.json()) as LoginResult;
}

export async function listCompanies(page = 1, pageSize = 20): Promise<PaginatedCompanies> {
  const res = await authFetch(`/companies?page=${page}&pageSize=${pageSize}`);
  return (await res.json()) as PaginatedCompanies;
}

export async function getCompany(id: string): Promise<Empresa> {
  const res = await authFetch(`/companies/${id}`);
  return (await res.json()) as Empresa;
}

export async function createCompany(dto: CreateCompanyDto): Promise<CreateCompanyResult> {
  const res = await authFetch("/companies", { method: "POST", body: JSON.stringify(dto) });
  return (await res.json()) as CreateCompanyResult;
}

export async function updateCompany(id: string, dto: UpdateCompanyDto): Promise<Empresa> {
  const res = await authFetch(`/companies/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  return (await res.json()) as Empresa;
}

/**
 * SPEC-016/AC-001 — os gestores da empresa.
 *
 * `senhaTemporaria` aqui é **booleano** (a conta está em primeiro acesso), e
 * em `SenhaTemporariaGerada` é a senha em si. Os dois campos têm o mesmo nome
 * e coisas diferentes; o contrato publicado agora separa os dois DTOs, e é
 * por isso que este apelido aponta para o de listagem.
 */
export type AdminDaEmpresa = components["schemas"]["AdminDaEmpresaResponseDto"];

/** SPEC-016 — a senha vem **uma vez só**, na resposta que a gerou. */
export type SenhaTemporariaGerada =
  components["schemas"]["SenhaDeAdminResponseDto"];

export async function listCompanyAdmins(id: string): Promise<AdminDaEmpresa[]> {
  const res = await authFetch(`/companies/${id}/admins`);
  return (await res.json()) as AdminDaEmpresa[];
}

export async function gerarSenhaDeAdmin(
  companyId: string,
  usuarioId: string,
): Promise<SenhaTemporariaGerada> {
  const res = await authFetch(
    `/companies/${companyId}/admins/${usuarioId}/senha-temporaria`,
    { method: "POST" },
  );
  return (await res.json()) as SenhaTemporariaGerada;
}

export async function updateCompanyStatus(id: string, status: CompanyStatus): Promise<Empresa> {
  const res = await authFetch(`/companies/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return (await res.json()) as Empresa;
}

/**
 * SPEC-014:TASK-000 — troca de senha. O backend revoga todas as sessoes e
 * devolve um par novo; quem chama precisa guardar o access token, senao a
 * pessoa cai no login logo depois de trocar.
 */
export async function trocarSenha(dto: {
  senhaAtual: string;
  novaSenha: string;
}): Promise<{ accessToken: string }> {
  const res = await authFetch("/auth/trocar-senha", {
    method: "POST",
    body: JSON.stringify(dto),
  });
  return (await res.json()) as { accessToken: string };
}
