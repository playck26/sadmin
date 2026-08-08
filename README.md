# PlayCK — SAdmin

Painel do Super Admin (time PlayCK), Next.js App Router. Consome a API de
`back` — nenhum acesso direto ao banco (poly-repo, ADR-001).

## Setup local

```bash
pnpm install
cp .env.example .env.local
pnpm run gen:api-types   # exige ../Back/openapi.json (repo back ao lado deste, localmente)
pnpm run dev
```

Em produção/CI real (repositórios já separados), `gen:api-types` roda
apontando `BACK_OPENAPI_SOURCE` para a URL do `openapi.json` publicado
pelo `back`, não para um caminho relativo local.

**`src/lib/api-types.ts` é versionado (não gerado no CI).** O CI deste
repositório (`.github/workflows/ci.yml`) não roda `gen:api-types` — ele
não tem acesso ao `back` (repositório separado, ADR-001) nem a uma URL
pública de `openapi.json` até o `back` estar implantado. Isso significa
que o contrato pode ficar desatualizado (stale) se alguém mudar a API do
`back` e esquecer de regenerar os tipos aqui. **Ação obrigatória:**
sempre que `back` mudar um endpoint consumido por este app, rodar `pnpm
run gen:api-types` localmente e commitar o diff de `api-types.ts` no
mesmo PR. Automatizar essa checagem no CI fica para quando `back` tiver
uma URL pública estável (deploy real) — registrado como lacuna em
`STATUS.md`.

## Scripts

| Script | O que faz |
|---|---|
| `dev` | Sobe em modo desenvolvimento |
| `build` | Build de produção |
| `lint` | ESLint |
| `typecheck` | `tsc --noEmit` |
| `test` | Testes (Vitest + Testing Library) |
| `gen:api-types` | Gera `src/lib/api-types.ts` a partir do `openapi.json` do `back` (ADR-001) |

## Design

Tokens de `DESIGN.md` (raiz do repositório de documentação) copiados
localmente em `src/app/globals.css` — sem pacote compartilhado entre os
3 frontends (ADR-001). Componentes base: shadcn/ui.
