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
    ".github/workflows/ci.yml",
    "vitest.config.mts",
    "vitest.setup.ts",
    "eslint.config.mjs",
    "netlify.toml",
    "scripts/netlify-ignore.mjs",
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
