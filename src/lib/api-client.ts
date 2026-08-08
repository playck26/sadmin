import type { components } from "./api-types";
import { getAccessToken } from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type LoginDto = components["schemas"]["LoginDto"];
export type CreateCompanyDto = components["schemas"]["CreateCompanyDto"];
export type UpdateCompanyDto = components["schemas"]["UpdateCompanyDto"];
export type CompanyStatus = "ativa" | "inativa";

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  usuario: {
    id: string;
    nome: string;
    role: "super_admin" | "company_admin" | "aluno";
    companyId: string | null;
  };
}

export interface Empresa {
  id: string;
  nome: string;
  logoUrl: string | null;
  esportes: string[];
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCompanies {
  data: Empresa[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreateCompanyResult {
  empresa: Empresa;
  adminUsuario: {
    id: string;
    nome: string;
    email: string;
    role: "company_admin";
    companyId: string;
  };
}

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

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = getAccessToken();
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

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

export async function updateCompanyStatus(id: string, status: CompanyStatus): Promise<Empresa> {
  const res = await authFetch(`/companies/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return (await res.json()) as Empresa;
}
