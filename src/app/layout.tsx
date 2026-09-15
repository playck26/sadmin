import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { ConviteDeInstalacao } from "@/components/convite-de-instalacao";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlayCK SAdmin",
  description: "Painel do Super Admin — PlayCK",
  /**
   * SPEC-050 — os metadados que faltavam para o iOS.
   *
   * `title` emite `apple-mobile-web-app-title`, que é o nome **sob o ícone** na
   * tela de início. Sem ele o iOS usa o `<title>` da página em que a pessoa
   * estava ao instalar — quem adicionasse a partir da lista de empresas ficaria com um
   * ícone nomeado pela tela, não pelo app.
   *
   * **`capable: true` emite `mobile-web-app-capable`, e NÃO a versão com
   * prefixo Apple** — conferido no HTML do build, não suposto. O Next 16 já
   * migrou para o nome padronizado, e o de prefixo Apple está depreciado no
   * Chrome. Não passamos a Apple-prefixada à mão: desde o iOS 11.3 o Safari lê
   * `display: standalone` do próprio manifest, então a tag legada não compra
   * nada em 2026.
   */
  appleWebApp: {
    capable: true,
    title: "PlayCK SAdmin",
    statusBarStyle: "default",
  },
};

/**
 * SPEC-050 — `theme_color` no manifest não pinta navegador: a barra de
 * endereço e a barra de status do Android leem a `<meta name="theme-color">`,
 * que o Next só emite a partir deste export. Mesmo valor do manifest de
 * propósito — dois verdes diferentes entre a barra e o app instalado seria
 * pior que nenhum.
 */
export const viewport: Viewport = {
  themeColor: "#00763a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased font-sans`}>
      <body className="min-h-full flex flex-col">
        {/*
          SPEC-050 — **a corrida que o React perde.**

          O Chrome dispara `beforeinstallprompt` logo depois do `load`, que
          costuma ser antes de um `useEffect` conseguir assinar o evento. Um
          convite que só assina no efeito não aparece numa carga fria — o mesmo
          sintoma de não haver código nenhum, que é o defeito que a SPEC-050
          conserta.

          **É `<script>` cru, e não o componente `Script` do Next, por
          medição.** A primeira versão usava a estratégia `beforeInteractive`
          dele, e o HTML do build mostrou que aquilo **não vira script
          inline**: vira um `(self.__next_s=self.__next_s||[]).push(...)`, uma
          fila que o runtime do Next injeta quando ele mesmo sobe. A captura
          passaria a depender do bootstrap do framework — exatamente o tipo de
          dependência que esta decisão existe para remover. Um `<script>`
          inline no topo do `<body>` executa **durante o parse do HTML**, antes
          de qualquer chunk da aplicação rodar.

          O `preventDefault()` também suprime o mini-infobar do Chrome, que é o
          que queremos: o convite passa a ser nosso, com nossa regra de quando
          voltar, em vez do banner de uma vez só do navegador.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__playckEventoDeInstalacao=e});',
          }}
        />
        {children}
        <ConviteDeInstalacao />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
