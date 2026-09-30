const ACCESS_TOKEN_KEY = "playck_sadmin_access_token";

export function saveAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

/**
 * O perfil (`role`) gravado no payload do access token, ou `null` quando o
 * token não é um JWT legível.
 *
 * **Não é verificação de assinatura, e não precisa ser.** Quem decide acesso
 * é o `SuperAdminGuard` do back, que lê este mesmo campo. Aqui a leitura só
 * serve para o painel não mandar pedido que o servidor já vai recusar — e
 * para explicar à pessoa o motivo, em vez de "Forbidden".
 */
export function perfilDoToken(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (c) =>
      c.charCodeAt(0),
    );
    const dados: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof dados === "object" && dados !== null && "role" in dados && typeof dados.role === "string"
      ? dados.role
      : null;
  } catch {
    return null;
  }
}
