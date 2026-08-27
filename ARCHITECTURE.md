# ARCHITECTURE — `sadmin` (PlayCK)

**Fonte: análise direta do código.** Data: 2026-08-25.

Planta **AS-IS**. Intenção arquitetural vive em `TARGET_ARCHITECTURE.md`
(raiz do workspace) + ADRs em `DECISIONS.md`. Divergência entre este
documento e o código é defeito **deste documento**.

**Quem usa:** `super_admin` — a operação da PlayCK, não o cliente · **Produção:** `super.playck.com.br`

Gestão de tenants: criar empresa com o admin inicial, renomear, ativar e
inativar. É o menor dos três e o único que não é usado pelo cliente final.

---

## 1. Stack real

| Lib | Versão | Papel |
|---|---|---|
| `next` | 16.3.0 | framework (App Router) |
| `react`, `react-dom` | 19.2.8 | UI |
| `radix-ui` | ^1.6.7 | primitivos acessíveis |
| `shadcn` | ^4.16.2 | componentes gerados em `components/ui/` |
| `tailwind-merge`, `clsx`, `class-variance-authority` | — | composição de classes |
| `lucide-react` | ^1.29.0 | ícones |

**NÃO existem no projeto:** biblioteca de estado global (Redux, Zustand,
Jotai, Recoil), React Query/SWR, form library (React Hook Form, Formik),
cliente HTTP (axios), i18n, biblioteca de datas (date-fns, dayjs — usa-se
`Intl` e `Date` nativos), Storybook, Sentry.

## 2. Visão geral e fluxo de referência

```
page.tsx (server component, fino)
   → components/*.tsx ("use client")
       → lib/api-client.ts  (authFetch: token, refresh, 401/403)
           → back (api.playck.com.br)
```

**Fluxo de referência — criar empresa** (o molde a replicar):

1. `app/(app)/empresas/nova/page.tsx` renderiza o form;
2. `lib/api-client.ts::createCompany` chama `POST /companies`;
3. o backend cria **empresa + admin inicial + horário padrão dos 7 dias**
   numa transação só — a tela não orquestra nada disso.

## 3. Rotas e componentes

| Rota | Papel |
|---|---|
| `/login` | entrada (`super_admin`) |
| `/empresas` (+ `nova`, `[id]`) | lista, criação e edição de tenants. **SPEC-016:** `[id]` traz o card `company-admins-card` — lista os gestores e gera senha temporária para quem perdeu o acesso, exibida **uma vez só** |

## 4. Estado

| Tipo | Onde vive |
|---|---|
| Server state | `useState` + `useEffect` por tela, via `lib/api-client.ts` |
| Sessão | `lib/auth-storage.ts` — access token em `localStorage`; refresh em cookie `httpOnly` |
| UI local | `useState` no componente |
| Global | **não existe** |

**Nada de global.** É o app mais simples: uma listagem e dois formulários.

## 5. Camada de API — a regra que mais importa

Todo acesso autenticado passa por **`authFetch`** (`lib/api-client.ts`), que
concentra três comportamentos:

1. **anexa o access token** do `localStorage`;
2. **renova a sessão em `401`** chamando `/auth/refresh` com
   `credentials: "include"`, e repete a requisição uma vez. A renovação é
   **compartilhada** entre chamadas simultâneas: sem isso, três `401` ao
   mesmo tempo disparariam três refreshes, e a rotação do backend trataria
   os concorrentes como reuso de token, **revogando a sessão inteira**;
3. **desvia em `403 SENHA_TEMPORARIA`** para a tela de primeiro acesso
   (só no `cliente`), em vez de mostrar erro seco.

**Chamar `fetch` direto numa tela é violação de camada** — perde as três
coisas acima.

## 6. Tipos do contrato

`lib/api-types.ts` é **gerado** do `openapi.json` do `back`
(`pnpm run gen:api-types`). Não editar à mão.

**Gap conhecido:** o CI **não** valida se esse arquivo está atualizado — a
mitigação é lembrar de rodar o comando, que é o tipo de mitigação que falha
em silêncio. Ver Gaps.

## 7. Requisitos de plataforma

Web responsivo, português do Brasil, tema claro. Sem offline (o service
worker do `cliente` registra, mas não há estratégia de cache de dados).
Deploy: Netlify (plano Personal desde 2026-08-22, ADR-014).

## 8. Regras de camada (com gate)

| Regra | Gate |
|---|---|
| `page.tsx` fina; lógica em componente cliente | revisão |
| Todo acesso autenticado por `authFetch` | busca por `fetch(` fora de `lib/` — **0 violações em 2026-08-22** |
| `api-types.ts` nunca editado à mão | arquivo é gerado; diff denuncia |
| Sem estado global sem ADR | busca por libs de estado no CI seria o gate — **hoje não existe** |
| `typecheck`, `lint`, `test`, `build` verdes | CI (GitHub Actions) a cada push |

### Miniatura da logo na lista de empresas (SPEC-018/TASK-006)

`logo-da-empresa.tsx` — mesmo componente do `admin` e do `cliente` (ADR-001,
duplicado de propósito). Aparece ao lado do nome, na lista de empresas, para
distinguir clube de relance quando a lista crescer.

**Não virou coluna própria**, e é decisão: o nome continua sendo o dado, e a
logo é apoio. Sem logo, a inicial do clube.

A URL vem resolvida pelo servidor (`LogoDaEmpresaService`), com o fallback
para a `logo_url` antiga (AC-013) — o campo "URL do logo" do formulário de
criação continua valendo e **não migra**.

### O campo "Esportes" não é mais uma coluna (SPEC-020/TASK-008)

`companies-list.tsx` faz `empresa.esportes.join(", ")` e os dois formulários
mandam `esportes` como lista de texto. **Isso continua certo, e continua
funcionando — mas o que está do outro lado mudou em 2026-08-26.**

`empresas.esportes` (a coluna `text[]`) **foi derrubada** pela TASK-004. O
campo `esportes` que a API devolve hoje é uma **projeção do catálogo**
`esportes_de_quadra`, montada em `CompaniesService.comEsportes()`; o que o
formulário manda **semeia esse catálogo**, não uma coluna.

Três consequências que não se leem no código daqui:

| O que parece | O que é |
|---|---|
| Editar "Esportes" mexe num campo da empresa | Editar **sincroniza o catálogo** que o gestor também edita em `admin`, na tela de catálogos |
| A lista aceita o que for digitado | Nomes repetidos ignorando maiúscula são deduplicados no `back` antes de gravar — o catálogo tem `UNIQUE(company_id, nome)`, e "Tenis, tenis" derrubaria a criação da empresa inteira |
| Remover um esporte da lista some com ele | Se alguma quadra usa a opção, o `back` recusa (INV-055) |

**A forma da resposta foi preservada de propósito**, e a decisão está
registrada em `companies.service.ts`: se `esportes` tivesse virado array de
objetos, esta lista quebraria exatamente como o app do aluno quebrou no
DEF-012 — `undefined.join()` é tela branca, não texto errado. Foi a única
tela dos quatro repositórios que atravessou a SPEC-020 **sem precisar de
alteração**, e isso foi construído, não sorte.

**Ao mexer nesta tela, ler antes `DATA_MODEL.md` (`esportes_de_quadra`) e a
seção 6 desta planta** — o tipo gerado continua dizendo `string[]`, e ele não
tem como contar de onde a lista vem.

## 9. Gaps e pontos de atenção

| # | Gap | Severidade |
|---|---|---|
| 1 | **`api-types.ts` pode ficar stale**: o CI não compara com o `openapi.json` do `back`. Já aconteceu — o `sadmin` acumulou 1.461 linhas de diferença | Média |
| 2 | **Sem estado global e sem cache de servidor**: cada tela refaz suas chamadas. Adequado hoje; vira problema quando duas telas precisarem do mesmo dado fresco | Média |
| 3 | Sem tratamento de offline apesar do service worker registrado (`cliente`) | Baixa |
| 4 | Cobertura de teste concentrada em poucos componentes | Média |
| 5 | Ícones e paleta ainda derivados de inferência, sem arquivo de marca oficial | Baixa |
