import { describe, expect, it } from "vitest";
import { decidir, semEfeitoNoSite } from "./netlify-ignore.mjs";

/**
 * O `ignore` do `netlify.toml` decide se um merge gasta 15 créditos. O erro caro
 * é o que pula um deploy necessário — o site fica velho sem aviso —, e por isso
 * a maior parte destes casos é de "tem de construir".
 */

const comArquivos = (arquivos) => () => arquivos;

describe("semEfeitoNoSite", () => {
  it.each([
    "ARCHITECTURE.md",
    "docs/notas.md",
    "src/components/court-manager.test.tsx",
    "src/lib/api-client-adicionais.test.ts",
    "scripts/netlify-ignore.test.mjs",
    "src/lib/api-types.ts",
    "src/lib/contrato.lock.json",
    ".github/workflows/ci.yml",
    ".github/scripts/conferir-contrato.mjs",
    "vitest.config.mts",
    "vitest.setup.ts",
    "eslint.config.mjs",
    "netlify.toml",
    "scripts/netlify-ignore.mjs",
    "scripts/gates-de-push.mjs",
  ])("%s não muda o site", (arquivo) => {
    expect(semEfeitoNoSite(arquivo)).toBe(true);
  });

  it.each([
    "src/components/court-manager.tsx",
    "src/lib/api-client.ts",
    "src/app/(app)/reservas/page.tsx",
    "src/app/manifest.ts",
    "public/sw.js",
    // Em `public/`, o `.md` é publicado como arquivo do site.
    "public/termos.md",
    "package.json",
    "pnpm-lock.yaml",
    "next.config.ts",
    "tsconfig.json",
    "postcss.config.mjs",
    "src/app/globals.css",
    // Parecido com api-types, mas não é só tipo.
    "src/lib/api-types-helpers.ts",
  ])("%s muda o site", (arquivo) => {
    expect(semEfeitoNoSite(arquivo)).toBe(false);
  });
});

describe("decidir", () => {
  it("só a planta mudou: pula", () => {
    expect(
      decidir({ anterior: "a", atual: "b", listar: comArquivos(["ARCHITECTURE.md"]) }).pular,
    ).toBe(true);
  });

  it("tipos e testes: pula", () => {
    const r = decidir({
      anterior: "a",
      atual: "b",
      listar: comArquivos(["src/lib/api-types.ts", "src/components/x.test.tsx"]),
    });
    expect(r.pular).toBe(true);
  });

  it("UM arquivo de código no meio da documentação: constrói, e diz qual", () => {
    const r = decidir({
      anterior: "a",
      atual: "b",
      listar: comArquivos(["ARCHITECTURE.md", "src/components/x.tsx", "x.test.tsx"]),
    });
    expect(r.pular).toBe(false);
    expect(r.arquivos).toEqual(["src/components/x.tsx"]);
  });

  /**
   * **O caso real que custou 45 créditos.** Em 2026-09-19 os três frontends
   * mergearam os gates de segredo da SPEC-062/TASK-006 tocando exatamente
   * estes dois arquivos, e os três construíram: a lista conhecia o `.github/`
   * e não conhecia o `gates-de-push.mjs`. A regra estava certa; a lista é que
   * estava incompleta. Este teste existe para que a lista não volte a ficar.
   */
  it("merge só dos gates de push: pula — foi o que falhou em 2026-09-19", () => {
    const r = decidir({
      anterior: "6ef1de4",
      atual: "1644364",
      listar: comArquivos([".github/workflows/ci.yml", "scripts/gates-de-push.mjs"]),
    });
    expect(r.pular).toBe(true);
  });

  it("SPEC-067/AC-011 — o merge do gate de contrato: pula", () => {
    // Lock, gate e workflow. **Sem o padrao do lock, isto construia nos tres
    // frontends: 45 creditos para uma mudanca que nao toca o site.**
    const r = decidir({
      anterior: "aaaaaaa",
      atual: "bbbbbbb",
      listar: comArquivos([
        ".github/workflows/ci.yml",
        ".github/scripts/conferir-contrato.mjs",
        "scripts/netlify-ignore.mjs",
        "src/lib/contrato.lock.json",
      ]),
    });
    expect(r.pular).toBe(true);
  });

  it("SPEC-067 — lock junto com codigo de verdade: constrói", () => {
    // O par negativo: o padrao novo nao pode virar passe livre para o commit
    // que tambem mexe no site.
    const r = decidir({
      anterior: "aaaaaaa",
      atual: "bbbbbbb",
      listar: comArquivos(["src/lib/contrato.lock.json", "src/lib/api-client.ts"]),
    });
    expect(r.pular).toBe(false);
  });

  it("mesmo commit (Trigger deploy manual): constrói — é a saída para forçar", () => {
    expect(decidir({ anterior: "a", atual: "a", listar: comArquivos([]) }).pular).toBe(false);
  });

  it("sem o commit anterior (primeiro build, cache limpo): constrói", () => {
    expect(decidir({ anterior: undefined, atual: "b", listar: comArquivos([]) }).pular).toBe(false);
    expect(decidir({ anterior: "", atual: "b", listar: comArquivos([]) }).pular).toBe(false);
  });

  it("git diff falhou (clone raso sem o commit anterior): constrói", () => {
    const r = decidir({
      anterior: "a",
      atual: "b",
      listar: () => {
        throw new Error("fatal: bad object a");
      },
    });
    expect(r.pular).toBe(false);
    expect(r.motivo).toContain("git diff falhou");
  });

  it("commits diferentes com a mesma árvore: pula — o site seria o mesmo", () => {
    expect(decidir({ anterior: "a", atual: "b", listar: comArquivos([]) }).pular).toBe(true);
  });
});
