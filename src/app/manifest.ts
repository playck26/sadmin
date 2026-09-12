import type { MetadataRoute } from "next";

/**
 * SPEC-050 — **o manifest que a ADR-012 pedia e nunca existiu.**
 *
 * A ADR-012 decidiu que `cliente` **e `admin` (e `sadmin`)** seriam PWA
 * instalável. Só o `cliente` foi: `super.playck.com.br/manifest.webmanifest`
 * respondia **404** até esta spec, sem service worker e sem ícone de
 * instalação. Não foi decisão revista — foi a ADR não cumprida em dois dos
 * três frontends, e ninguém tinha conferido com um comando.
 *
 * Os campos e o porquê de cada um:
 *
 * - **`icons` com `purpose: "maskable"`** — o logo sangra até a borda (o laço
 *   dourado). Launcher adaptativo do Android recorta em círculo ou squircle e
 *   sem um `maskable` come o laço. Os arquivos saem de
 *   `harness/pwa/gerar-icones.mjs` na raiz da governança, que também
 *   **achatou o alfa**: ícone transparente vira fundo preto no iOS.
 * - **`id`** — âncora de identidade. Sem ele o navegador usa a `start_url`, e
 *   mudá-la um dia passaria a valer como "outro app", deixando um ícone órfão
 *   em quem já instalou.
 * - **`scope`** — o app é o site todo, declarado em vez de herdado de onde o
 *   arquivo mora.
 *
 * **Sem `orientation`**, ao contrário do `cliente` (que trava em `portrait`):
 * este é o painel interno da PlayCK, usado de mesa. Travar orientação
 * quebraria justamente o uso real, onde as tabelas de empresas precisam de
 * largura.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PlayCK SAdmin",
    short_name: "PlayCK SAdmin",
    description: "Painel do Super Admin — PlayCK",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "pt-BR",
    dir: "ltr",
    background_color: "#f7f8f5",
    theme_color: "#00763a",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
