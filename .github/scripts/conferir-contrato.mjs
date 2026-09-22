/**
 * SPEC-067/TASK-001 — **os tipos deste repositório correspondem ao contrato de
 * que foram gerados?**
 *
 * ## Por que existe
 *
 * O `api-types.ts` ficou **612 linhas** atrás do `openapi.json` do Back ao longo
 * de três SPECs (062, 063, 064), com o CI deste repositório **verde** o tempo
 * todo. O gate que pegaria isso morava só na raiz da governança
 * (`Docs/conferir-tipos-do-contrato.py`), porque aqui não existe `../Back` — é
 * poly-repo (ADR-001). Script que alguém precisa lembrar de rodar não é
 * mecanismo.
 *
 * ## A pergunta é REPRODUTIBILIDADE, não atualidade
 *
 * O contrato vem do commit do Back fixado em `src/lib/contrato.lock.json`, por
 * `raw.githubusercontent.com/playck26/back/<sha>/openapi.json` — **imutável**. A
 * mesma PR dá o mesmo veredito hoje e daqui a um mês.
 *
 * Buscar o `main` do Back seria alvo móvel: 82 dos 277 commits dele em 30 dias
 * mexeram no contrato, e o CI deste repositório ficaria vermelho por merge
 * alheio. *"O contrato ainda é o atual?"* é outra pergunta, e quem a responde é
 * o `contrato.yml` agendado, que abre PR em vez de reprovar a sua.
 *
 * ## Não escreve no repositório
 *
 * O `api-types:check` do `package.json` **regenera o arquivo que confere**. Um
 * gate que conserta o que confere deixa de ser gate. Este gera num diretório
 * temporário e compara.
 *
 * ## Mora em `.github/scripts/`, e isso é o custo de deploy
 *
 * `^\.github\/` está em `SEM_EFEITO_NO_SITE` (`scripts/netlify-ignore.mjs`).
 * Em `scripts/` ele faria cada mudança sua custar 15 créditos da Netlify.
 * **Arquivo idêntico em `cliente`, `admin` e `sadmin`** — o mesmo custo de
 * duplicação declarado do `netlify-ignore.mjs` (ADR-001).
 *
 * ## Saídas
 *
 *     0  em dia com o contrato fixado
 *     1  divergente (nomeia o arquivo e quantas linhas)
 *     2  a checagem não pôde ser feita — lock inválido, rede, JSON, gerador
 *
 * O `2` importa tanto quanto o `1` (INV-067b): um script que devolvesse `0` sem
 * conseguir conferir estaria afirmando que conferiu.
 *
 * `--autoteste` roda os casos da comparação, sem rede.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOCK = "src/lib/contrato.lock.json";
const TIPOS = "src/lib/api-types.ts";
const ORIGEM = (sha) =>
  `https://raw.githubusercontent.com/playck26/back/${sha}/openapi.json`;

/**
 * Final de linha NÃO é diferença de contrato. Com `core.autocrlf=true` a cópia
 * de trabalho sai em CRLF e o `openapi-typescript` escreve LF; o blob no git é
 * LF nos dois casos. É a mesma decisão do gate da raiz, medida na SPEC-053 —
 * comparar bytes crus reprovava tipos em dia.
 *
 * **E não pode cegar o gate:** o `--autoteste` prova que um campo que virou
 * anulável continua sendo pego com a cópia em CRLF.
 */
export function comparar(atual, gerado) {
  const a = atual.replace(/\r\n/g, "\n");
  const g = gerado.replace(/\r\n/g, "\n");
  return a === g ? { estado: "ok" } : { estado: "divergente", a, g };
}

/**
 * **Lança, em vez de `process.exit()`.** A primeira versão encerrava o processo
 * no meio do `fetch`, e no Windows o Node abortava com
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` — **saindo 127 em vez
 * de 2**, com a mensagem certa impressa antes. Um código de saída que depende do
 * sistema operacional não é o código que a INV-067b promete. O erro sobe até o
 * fim do arquivo, que põe `process.exitCode` e deixa o loop terminar sozinho.
 */
class NaoConferido extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

function falhar(codigo, mensagem) {
  throw new NaoConferido(codigo, mensagem);
}

function autoteste() {
  const LF = "export interface A {\n  x: string;\n}\n";
  const CRLF = LF.replace(/\n/g, "\r\n");
  const MUDOU_CRLF = "export interface A {\r\n  x: string | null;\r\n}\r\n";
  const casos = [
    ["idêntico -> ok", comparar(LF, LF).estado, "ok"],
    ["só final de linha (cópia CRLF, gerado LF) -> ok", comparar(CRLF, LF).estado, "ok"],
    // O defeito da SPEC-039, que pagou o gate da raiz: `chamada` virou
    // anulável e o Cliente não regenerou. Em CRLF ele tem de continuar visível.
    ["campo que ficou anulável, com a cópia em CRLF -> divergente", comparar(MUDOU_CRLF, LF).estado, "divergente"],
    ["uma linha a menos -> divergente", comparar(LF, LF + "export type B = 1;\n").estado, "divergente"],
  ];
  let ok = 0;
  for (const [nome, obtido, esperado] of casos) {
    const passou = obtido === esperado;
    if (passou) ok += 1;
    console.log(`${passou ? "ok" : "!!"} ${nome}`);
  }
  console.log(`autoteste: ${ok} de ${casos.length}`);
  process.exit(ok === casos.length ? 0 : 1);
}

function lerLock() {
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

async function baixarContrato(sha) {
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
function caminhoDoGerador() {
  const exigir = createRequire(join(process.cwd(), "package.json"));
  try {
    const pacote = exigir.resolve("openapi-typescript/package.json");
    return join(pacote, "..", "bin", "cli.js");
  } catch {
    falhar(2, "NAO CONFERIDO: openapi-typescript nao esta instalado (rode o install antes)");
  }
}

function linhasQueDivergem(dir, a, g) {
  const pa = join(dir, "atual.ts");
  const pg = join(dir, "gerado.ts");
  writeFileSync(pa, a);
  writeFileSync(pg, g);
  try {
    // `core.autocrlf=false`: sem isto o git avisa "LF will be replaced by
    // CRLF" sobre os dois temporarios, e o aviso polui a saida do gate.
    execFileSync(
      "git",
      ["-c", "core.autocrlf=false", "diff", "--no-index", "--numstat", "--", pa, pg],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return "0";
  } catch (erro) {
    // `git diff --no-index` sai com 1 quando HÁ diferença: é o caso esperado.
    const numstat = String(erro.stdout ?? "").trim().split(/\s+/);
    return numstat.length >= 2 ? `${numstat[0]} inserção(ões) / ${numstat[1]} remoção(ões)` : "?";
  }
}

async function conferir() {
  const sha = lerLock();
  const contrato = await baixarContrato(sha);
  const dir = mkdtempSync(join(tmpdir(), "contrato-"));
  try {
    const entrada = join(dir, "openapi.json");
    const saida = join(dir, "api-types.ts");
    writeFileSync(entrada, contrato);
    // Fora do `try` abaixo: se o gerador nao estiver instalado, a mensagem tem
    // de dizer ISSO, e nao "o gerador falhou".
    const gerador = caminhoDoGerador();
    try {
      execFileSync(process.execPath, [gerador, entrada, "-o", saida], {
        stdio: ["ignore", "ignore", "pipe"],
      });
    } catch (erro) {
      falhar(2, `NAO CONFERIDO: o gerador falhou (${String(erro.stderr ?? erro.message).slice(-300)})`);
    }
    let atual;
    try {
      atual = readFileSync(TIPOS, "utf8");
    } catch {
      falhar(2, `NAO CONFERIDO: ${TIPOS} nao existe`);
    }
    const r = comparar(atual, readFileSync(saida, "utf8"));
    if (r.estado === "ok") {
      console.log(`OK ${TIPOS} em dia com o contrato do back@${sha.slice(0, 7)}`);
      return;
    }
    const quantas = linhasQueDivergem(dir, r.a, r.g);
    falhar(
      1,
      `DIVERGENTE ${TIPOS} nao corresponde ao contrato do back@${sha.slice(0, 7)}: ` +
        `${quantas} para ficar igual.\n` +
        `Rode \`pnpm exec openapi-typescript ${ORIGEM(sha)} -o ${TIPOS}\` e commite.\n` +
        `Se a intencao era seguir um contrato MAIS NOVO do Back, atualize tambem o ` +
        `"back" de ${LOCK} para o SHA desse commit.`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv.includes("--autoteste")) {
  autoteste();
} else {
  try {
    await conferir();
  } catch (erro) {
    // Erro que ninguem previu tambem e `2`: o gate nunca passa em silencio.
    console.error(
      erro instanceof NaoConferido
        ? erro.message
        : `NAO CONFERIDO: erro inesperado (${erro.message})`,
    );
    process.exitCode = erro instanceof NaoConferido ? erro.codigo : 2;
  }
}
