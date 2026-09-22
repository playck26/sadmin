/**
 * SPEC-067 — **o que os dois scripts do contrato compartilham, num lugar só.**
 *
 * `conferir-contrato.mjs` (TASK-001) responde *"os tipos correspondem ao
 * contrato fixado?"*; `sincronizar-contrato.mjs` (TASK-002) responde *"o
 * contrato fixado ainda é o atual?"*. As duas perguntas usam a mesma origem, o
 * mesmo lock e a mesma validação do que veio da rede.
 *
 * **Copiar seria escrever a mesma regra duas vezes** — foi assim que nasceu o
 * DEF-036: a regra de crédito morava em dois lugares, um mudou e o outro não.
 *
 * Mora em `.github/scripts/`, coberto por `^\.github\/` em `SEM_EFEITO_NO_SITE`.
 * Arquivo idêntico em `cliente`, `admin` e `sadmin`.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

export const LOCK = "src/lib/contrato.lock.json";
export const TIPOS = "src/lib/api-types.ts";
export const REPO_DO_BACK = "https://github.com/playck26/back";
export const ORIGEM = (sha) =>
  `https://raw.githubusercontent.com/playck26/back/${sha}/openapi.json`;

/**
 * **Lança, em vez de `process.exit()`.** A primeira versão encerrava o processo
 * no meio do `fetch`, e no Windows o Node abortava com
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` — **saindo 127 em vez
 * de 2**, com a mensagem certa impressa antes. Quem chama põe
 * `process.exitCode` e deixa o loop terminar sozinho.
 */
export class NaoConferido extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

export function falhar(codigo, mensagem) {
  throw new NaoConferido(codigo, mensagem);
}

export function lerLock() {
  let lock;
  try {
    lock = JSON.parse(readFileSync(LOCK, "utf8"));
  } catch (erro) {
    falhar(2, `NAO CONFERIDO: ${LOCK} ausente ou invalido (${erro.message})`);
  }
  if (typeof lock.back !== "string" || !/^[0-9a-f]{40}$/.test(lock.back)) {
    falhar(2, `NAO CONFERIDO: ${LOCK} precisa de "back" com o SHA completo (40 hex)`);
  }
  return lock.back;
}

/** O conteúdo que o lock grava. Uma forma só, para o sincronizador e para quem edita à mão. */
export function conteudoDoLock(sha) {
  return `${JSON.stringify({ back: sha }, null, 2)}\n`;
}

export async function baixarContrato(sha) {
  let resposta;
  try {
    resposta = await fetch(ORIGEM(sha), { signal: AbortSignal.timeout(30_000) });
  } catch (erro) {
    falhar(2, `NAO CONFERIDO: a rede falhou buscando ${ORIGEM(sha)} (${erro.message})`);
  }
  if (!resposta.ok) {
    falhar(2, `NAO CONFERIDO: ${ORIGEM(sha)} respondeu ${resposta.status}`);
  }
  const texto = await resposta.text();
  try {
    if (!JSON.parse(texto).openapi) throw new Error("sem o campo `openapi`");
  } catch (erro) {
    falhar(2, `NAO CONFERIDO: o que veio de ${ORIGEM(sha)} nao e um OpenAPI (${erro.message})`);
  }
  return texto;
}

/** O CLI do gerador, pelo pacote instalado — o mesmo `^7.13` do `package.json`. */
export function caminhoDoGerador() {
  const exigir = createRequire(join(process.cwd(), "package.json"));
  try {
    const pacote = exigir.resolve("openapi-typescript/package.json");
    return join(pacote, "..", "bin", "cli.js");
  } catch {
    falhar(2, "NAO CONFERIDO: openapi-typescript nao esta instalado (rode o install antes)");
  }
}

/** Roda `principal`, e traduz qualquer falha em `process.exitCode` — nunca em silêncio. */
export async function executar(principal) {
  try {
    await principal();
  } catch (erro) {
    console.error(
      erro instanceof NaoConferido
        ? erro.message
        : `NAO CONFERIDO: erro inesperado (${erro.message})`,
    );
    process.exitCode = erro instanceof NaoConferido ? erro.codigo : 2;
  }
}
