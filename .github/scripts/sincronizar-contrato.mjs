/**
 * SPEC-067/TASK-002 — **o contrato fixado ainda é o atual?** Se não for, abre
 * (ou atualiza) UMA PR que o atualiza.
 *
 * ## Por que é outra pergunta, e não o gate
 *
 * O job `contrato` do CI responde *"os tipos correspondem ao contrato fixado?"*
 * e **bloqueia**. Este responde *"o contrato fixado ainda é o do `main` do
 * Back?"* e **não pode bloquear PR alheia**: 82 dos 277 commits do Back em 30
 * dias mexeram no contrato. Ele produz trabalho, não veredito.
 *
 * ## A PR automática é um ESPELHO, não uma contribuição
 *
 * A branch tem nome fixo (`contrato/sync`) e é **recriada do `main`** a cada
 * execução, em vez de continuada. Disso saem as três respostas que a 2ª rodada
 * de validação cobrou:
 *
 * - **duplicata?** impossível — a branch é uma; já aberta, o `push --force`
 *   atualiza a PR existente;
 * - **envelhece?** não — cada execução a reescreve sobre o `main` do dia;
 * - **conflito com PR humana?** não existe — lock e `api-types.ts` são
 *   **derivados**; a branch não mescla nada, recalcula.
 *
 * E se o contrato não mudou, **não faz nada**. Silêncio é o caso comum.
 *
 * ## Duas exigências do GitHub que a spec não previu
 *
 * 1. **PR aberta pelo `GITHUB_TOKEN` não dispara o CI** — a plataforma bloqueia
 *    eventos em cadeia, exceto `workflow_dispatch`. Sem nada, a PR ficaria
 *    para sempre "aguardando status". Por isso, depois de empurrar, este script
 *    dispara o `ci.yml` na branch.
 * 2. **O Actions só cria PR com "Allow GitHub Actions to create and approve pull
 *    requests" ligado** — medido desligado nos três repositórios em
 *    2026-09-22. É passo de painel (TASK-004), e a falha aqui diz isso.
 *
 * ## Saídas, e a linha que o workflow exige
 *
 *     EM DIA: ...            nada a fazer                    exit 0
 *     JA SINCRONIZADO: ...   a PR aberta já tem este conteúdo exit 0
 *     SINCRONIZADO: ...      empurrou e abriu/atualizou a PR  exit 0
 *     NAO CONFERIDO: ...     rede, lock, git, gh             exit 2
 *
 * `--simular` decide sem mexer em git nem em PR — é como se prova localmente.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  LOCK,
  ORIGEM,
  REPO_DO_BACK,
  TIPOS,
  baixarContrato,
  caminhoDoGerador,
  conteudoDoLock,
  executar,
  falhar,
  lerLock,
} from "./contrato-comum.mjs";

const BRANCH = "contrato/sync";
const BOT = [
  "-c",
  "user.name=github-actions[bot]",
  "-c",
  "user.email=41898282+github-actions[bot]@users.noreply.github.com",
];

/**
 * O contrato é o **conteúdo** do `openapi.json`, não o SHA. O Back tem 277
 * commits em 30 dias e só 82 mexem no contrato: comparar SHA abriria PR para os
 * outros 195, que não mudam tipo nenhum.
 */
export function decidir(contratoDoLock, contratoDoMain) {
  return contratoDoLock === contratoDoMain ? "em-dia" : "sincronizar";
}

function rodar(programa, args, rotulo) {
  try {
    return execFileSync(programa, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (erro) {
    const detalhe = String(erro.stderr ?? erro.message).trim().slice(-400);
    if (/not permitted to create or approve pull requests/i.test(detalhe)) {
      falhar(
        2,
        "NAO CONFERIDO: o GitHub Actions nao tem permissao para criar PR neste " +
          "repositorio. Ligue Settings -> Actions -> General -> \"Allow GitHub " +
          "Actions to create and approve pull requests\" (SPEC-067/TASK-004).",
      );
    }
    falhar(2, `NAO CONFERIDO: ${rotulo} falhou (${detalhe})`);
  }
}

function shaDoMainDoBack() {
  const saida = rodar("git", ["ls-remote", REPO_DO_BACK, "refs/heads/main"], "git ls-remote do Back");
  const sha = saida.split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    falhar(2, `NAO CONFERIDO: nao achei o main do Back em ${REPO_DO_BACK}`);
  }
  return sha;
}

async function sincronizar() {
  const simular = process.argv.includes("--simular");
  const doLock = lerLock();
  const doMain = shaDoMainDoBack();
  const decisao = decidir(await baixarContrato(doLock), await baixarContrato(doMain));
  const de = `back@${doLock.slice(0, 7)}`;
  const para = `back@${doMain.slice(0, 7)}`;

  if (decisao === "em-dia") {
    console.log(`EM DIA: o contrato de ${de} e o mesmo do main (${para}). Nada a fazer.`);
    return;
  }
  if (simular) {
    console.log(
      `SIMULACAO: o contrato mudou (${de} -> ${para}). A execucao real recriaria ` +
        `${BRANCH} sobre o main, gravaria o lock e os tipos, e abriria ou atualizaria a PR.`,
    );
    return;
  }

  // A branch e RECRIADA do main, nunca continuada: e isso que a faz espelho.
  rodar("git", ["fetch", "origin", "main"], "git fetch do main");
  rodar("git", ["checkout", "-B", BRANCH, "origin/main"], "git checkout da branch");
  writeFileSync(LOCK, conteudoDoLock(doMain));
  rodar(process.execPath, [caminhoDoGerador(), ORIGEM(doMain), "-o", TIPOS], "o gerador de tipos");
  rodar("git", ["add", LOCK, TIPOS], "git add");

  // Idempotencia: se a branch remota ja tem exatamente esta arvore, nao
  // empurra -- empurrar de novo mudaria o SHA e dispararia CI a toa.
  const arvoreNova = rodar("git", ["write-tree"], "git write-tree");
  let arvoreRemota = "";
  try {
    execFileSync("git", ["fetch", "origin", BRANCH], { stdio: "ignore" });
    arvoreRemota = rodar("git", ["rev-parse", "FETCH_HEAD^{tree}"], "git rev-parse");
  } catch {
    // a branch ainda nao existe no remoto: primeira sincronizacao.
  }

  let empurrou = false;
  if (arvoreRemota !== arvoreNova) {
    rodar(
      "git",
      [...BOT, "commit", "-m", `contrato: ${para} (era ${de})\n\nPR-espelho da SPEC-067/TASK-002.`],
      "git commit",
    );
    rodar("git", ["push", "--force", "origin", BRANCH], "git push");
    empurrou = true;
  }

  const abertas = JSON.parse(
    rodar("gh", ["pr", "list", "--head", BRANCH, "--state", "open", "--json", "number"], "gh pr list"),
  );
  let numero = abertas[0]?.number;
  if (!numero) {
    const url = rodar(
      "gh",
      [
        "pr", "create", "--base", "main", "--head", BRANCH,
        "--title", `Contrato do Back: ${para}`,
        "--body",
        `PR-espelho da SPEC-067/TASK-002. O contrato do Back mudou de ${de} para ${para}; ` +
          `este commit atualiza \`${LOCK}\` e regenera \`${TIPOS}\`.\n\n` +
          "**Nao edite esta branch**: ela e recriada do `main` a cada execucao, e o que " +
          "estiver nela e sobrescrito. Revise o estado atual, nao o historico.",
      ],
      "gh pr create",
    );
    numero = Number(url.split("/").pop());
  }

  // PR aberta pelo GITHUB_TOKEN nao dispara o CI sozinha.
  if (empurrou) {
    rodar("gh", ["workflow", "run", "ci.yml", "--ref", BRANCH], "gh workflow run ci.yml");
    console.log(`SINCRONIZADO: PR #${numero}, ${de} -> ${para}. CI disparado na branch.`);
  } else {
    console.log(`JA SINCRONIZADO: a PR #${numero} ja tem o contrato de ${para}.`);
  }
}

await executar(sincronizar);
