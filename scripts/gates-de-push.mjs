#!/usr/bin/env node
// SPEC-062/TASK-006 — **os gates da chave privada, dentro deste repositório.**
//
// ## Por que aqui, e não no repositório de governança
//
// Os gates nasceram lá (`Docs/conferir-literal-de-segredo.py`), e lá eles
// continuam valendo para quem varre os quatro repositórios de uma vez. Mas a
// CI **deste** repositório não enxerga aquele — poly-repo, ADR-001 —, e gate
// que só roda quando alguém lembra não é gate.
//
// Custo declarado: este arquivo é **idêntico** nos três frontends, sem gate de
// sincronia, como o `netlify-ignore.mjs` e o `comprimir-imagem.ts`.
//
// ## O que cada um impede
//
// A invariante é INV-062b: **a chave privada VAPID não alcança o navegador.**
// Ela já caiu três vezes na validação independente, por motivos diferentes, e
// o último foi o que mais ensina: os gates procuravam o NOME da variável, e
// bastava cadastrá-la na Netlify como `NEXT_PUBLIC_PUSH_KEY` para passar por
// todos. **O nome não é o portador; o valor é.**
//
// Estes quatro fecham os caminhos que se pode fechar sem conhecer o valor:
//
//   G1  o nome não é citado em nenhum arquivo rastreado
//   G2  `next.config` não embute ambiente em bloco
//   G2b o front só lê variável da allowlist
//   G3  nenhum `.env*` versionado
//   G4  nenhum literal com FORMA de chave no fonte
//
// O que eles **não** fecham está declarado na spec (LIM-062k) e é coberto pelo
// G7, que procura o valor no artefato pela impressão — e por G6, que é humano.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * As ÚNICAS variáveis que um front pode ler. Nome novo aqui é decisão
 * deliberada, com revisão — que é exatamente o ponto: sem a lista, um
 * `process.env.X` novo entraria sem ninguém olhar.
 */
const ALLOWLIST = ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_CLIENTE_URL"];

/** 65 bytes em base64url dão 87 caracteres. 40 é folga para baixo. */
const COMPRIMENTO_SUSPEITO = 40;

const falhas = [];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

/** `git grep` sai com 1 quando não acha — e "não achou" é o que queremos. */
function grepAchou(args) {
  try {
    return git(["grep", ...args]).trim();
  } catch {
    return "";
  }
}

function reprovar(gate, detalhe) {
  falhas.push({ gate, detalhe });
}

// ---------------------------------------------------------------------------
// G1 — o nome, em qualquer arquivo rastreado
// ---------------------------------------------------------------------------
{
  const achado = grepAchou(["-I", "-n", "-E", "PUSH_VAPID", "--", "."]);
  if (achado) {
    reprovar(
      "G1",
      `o nome PUSH_VAPID aparece em arquivo rastreado:\n${achado}`,
    );
  }
}

// ---------------------------------------------------------------------------
// G2 — `next.config` embutindo ambiente em bloco
//
// O `env:` do `next.config` embute QUALQUER chave no bundle, com ou sem o
// prefixo `NEXT_PUBLIC_`. É o caminho que não depende de nome nenhum.
// ---------------------------------------------------------------------------
{
  const achado = grepAchou([
    "-n",
    "-E",
    "(^|[^A-Za-z.])env[[:space:]]*:|[.]{3}process[.]env",
    "--",
    "next.config.*",
  ]);
  if (achado) {
    reprovar("G2", `next.config embute ambiente em bloco:\n${achado}`);
  }
}

// ---------------------------------------------------------------------------
// G2b — o front só lê variável da allowlist
//
// `process[.]env[^.]` pega também o acesso que NÃO usa ponto: índice dinâmico
// (`process.env[x]`) e desestruturação (`const {X} = process.env`).
// ---------------------------------------------------------------------------
{
  const bruto = grepAchou([
    "-h",
    "-o",
    "-E",
    "process[.]env[^.]|process[.]env[.][A-Z_0-9]+",
    "--",
    "src",
    "next.config.*",
  ]);
  const fora = [...new Set(bruto.split("\n").filter(Boolean))].filter((uso) => {
    const nome = uso.startsWith("process.env.") ? uso.slice(12) : null;
    return !nome || !ALLOWLIST.includes(nome);
  });
  if (fora.length > 0) {
    reprovar(
      "G2b",
      `leitura de ambiente fora da allowlist (${ALLOWLIST.join(", ")}):\n` +
        fora.map((f) => `  ${f}`).join("\n"),
    );
  }
}

// ---------------------------------------------------------------------------
// G3 — nenhum `.env*` versionado
// ---------------------------------------------------------------------------
{
  const arquivos = git(["ls-files", "--", "*.env*"]).trim();
  if (arquivos) {
    reprovar("G3", `arquivo de ambiente versionado:\n${arquivos}`);
  }
}

// ---------------------------------------------------------------------------
// G4 — literal com FORMA de chave
//
// Probabilístico, e declarado: uma chave de 43 caracteres base64url quase
// sempre tem minúscula, maiúscula E dígito. Pega o acidente de copiar e colar,
// não a ocultação deliberada — e nunca imprime o conteúdo do que acha.
// ---------------------------------------------------------------------------
{
  const arquivos = git(["ls-files", "--", "src", "next.config.*"])
    .split("\n")
    .filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(f));

  const LITERAL = /["'`]([A-Za-z0-9_-]{40,})["'`]/g;
  for (const arquivo of arquivos) {
    let conteudo;
    try {
      conteudo = readFileSync(arquivo, "utf8");
    } catch {
      reprovar("G4", `não deu para ler ${arquivo} — arquivo não conferido`);
      continue;
    }
    conteudo.split("\n").forEach((linha, i) => {
      for (const m of linha.matchAll(LITERAL)) {
        const texto = m[1];
        if (
          texto.length >= COMPRIMENTO_SUSPEITO &&
          /[a-z]/.test(texto) &&
          /[A-Z]/.test(texto) &&
          /[0-9]/.test(texto)
        ) {
          // Posição e tamanho. NUNCA o conteúdo: um gate que imprime o que
          // achou é o vazamento que ele veio impedir.
          reprovar(
            "G4",
            `${arquivo}:${i + 1} tem literal de ${texto.length} caracteres com forma de chave`,
          );
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------

if (falhas.length === 0) {
  console.log("gates de push: G1, G2, G2b, G3, G4 — todos OK");
  process.exit(0);
}

console.error("gates de push REPROVARAM:\n");
for (const { gate, detalhe } of falhas) {
  console.error(`[${gate}] ${detalhe}\n`);
}
console.error(
  "INV-062b — a chave privada VAPID não pode alcançar o navegador.\n" +
    "Se um destes for falso positivo, corrija o gate; não o desligue.",
);
process.exit(1);
