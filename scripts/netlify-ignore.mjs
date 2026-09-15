/**
 * **Pular o build da Netlify quando o commit não muda o site publicado.**
 *
 * Chamado pelo `ignore` do `netlify.toml`. A Netlify cancela o build com
 * **exit 0** e constrói com **exit 1**.
 *
 * ## Por que existe
 *
 * Cada deploy de produção custa **15 créditos**, e o tamanho do commit não
 * importa. Entre 2026-09-08 e 2026-09-15 foram 26 merges em `main` nos três
 * frontends (~351 dos 500 créditos). Seis deles não mudavam nada para quem usa:
 * dois só atualizavam a planta (`ARCHITECTURE.md`), e quatro do SAdmin só
 * regeneravam `api-types.ts`, que é só tipo e some na compilação.
 *
 * ## A regra: na dúvida, constrói
 *
 * Pular deploy necessário é pior que pagar um desnecessário: o site ficaria
 * velho sem aviso. Por isso:
 *
 * - só pula se **todo** arquivo mudado estiver na lista `SEM_EFEITO_NO_SITE`;
 * - sem os dois commits, ou com os dois iguais, **constrói**. É o caso do
 *   *Trigger deploy* manual, que continua sendo a saída para forçar um build
 *   (ex.: variável de ambiente trocada no painel, ou mudança no próprio
 *   `netlify.toml`, que esta lista ignora);
 * - se o `git diff` falhar (clone raso sem o commit anterior), **constrói**.
 *
 * **Arquivo idêntico em `admin`, `cliente` e `sadmin`** — poly-repo sem pacote
 * compartilhado (ADR-001), o mesmo custo declarado do `comprimir-imagem.ts`.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Caminhos relativos à raiz do repositório, com `/`. */
export const SEM_EFEITO_NO_SITE = [
  // Documentação — **menos em `public/`**, onde o `.md` é publicado como arquivo.
  /^(?!public\/).*\.md$/,
  // Testes e o que só roda neles.
  /\.test\.(ts|tsx|mts|mjs)$/,
  /^vitest\.(config|setup)\.[cm]?[jt]s$/,
  // Só tipos: `openapi-typescript` gera `interface` e `type`, nada que execute.
  /^src\/lib\/api-types\.ts$/,
  // CI e lint: rodam no GitHub, não entram no build.
  /^\.github\//,
  /^eslint\.config\.[cm]?js$/,
  // Esta própria regra. Mudar a configuração de build exige *Trigger deploy*.
  /^netlify\.toml$/,
  /^scripts\/netlify-ignore\.mjs$/,
];

export function semEfeitoNoSite(arquivo) {
  return SEM_EFEITO_NO_SITE.some((padrao) => padrao.test(arquivo));
}

/**
 * @param {{ anterior?: string, atual?: string, listar: (a: string, b: string) => string[] }} p
 * @returns {{ pular: boolean, motivo: string, arquivos: string[] }}
 */
export function decidir({ anterior, atual, listar }) {
  if (!anterior || !atual) {
    return { pular: false, motivo: "sem o commit anterior ou o atual", arquivos: [] };
  }
  if (anterior === atual) {
    return { pular: false, motivo: "mesmo commit: build pedido à mão", arquivos: [] };
  }
  let arquivos;
  try {
    arquivos = listar(anterior, atual);
  } catch (erro) {
    return {
      pular: false,
      motivo: `git diff falhou (${erro instanceof Error ? erro.message.split("\n")[0] : erro})`,
      arquivos: [],
    };
  }
  const relevantes = arquivos.filter((a) => !semEfeitoNoSite(a));
  return relevantes.length === 0
    ? { pular: true, motivo: "nenhum arquivo muda o site publicado", arquivos }
    : { pular: false, motivo: `${relevantes.length} arquivo(s) mudam o site`, arquivos: relevantes };
}

function listarPeloGit(anterior, atual) {
  // `--no-renames`: um arquivo renomeado aparece como saída E entrada — mover
  // um componente para um nome `.test.tsx` não pode esconder a remoção dele.
  return execFileSync("git", ["diff", "--name-only", "--no-renames", anterior, atual], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean);
}

const executadoDireto =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executadoDireto) {
  const decisao = decidir({
    anterior: process.env.CACHED_COMMIT_REF,
    atual: process.env.COMMIT_REF,
    listar: listarPeloGit,
  });
  console.log(`[netlify-ignore] ${decisao.pular ? "PULAR" : "CONSTRUIR"}: ${decisao.motivo}`);
  for (const arquivo of decisao.arquivos.slice(0, 20)) console.log(`  ${arquivo}`);
  process.exit(decisao.pular ? 0 : 1);
}
