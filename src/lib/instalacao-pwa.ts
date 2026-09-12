/**
 * SPEC-050 — **a decisão de convidar para instalar, separada da tela.**
 *
 * O app era instalável desde a ADR-012 (manifest + service worker) e **nunca
 * convidou ninguém**: não havia um `beforeinstallprompt` em nenhum dos quatro
 * repositórios. Tudo dependia da heurística do navegador, que é deliberadamente
 * de uma vez só — o Chrome suprime o próprio banner por meses depois da
 * primeira dispensa, o desktop nunca mostra banner (só o ícone na barra de
 * endereço) e **o iOS não implementa o evento**. Daí o sintoma relatado: "só
 * apareceu uma única vez".
 *
 * Este arquivo tem a lógica que decide **se** cabe convidar. A tela
 * (`convite-de-instalacao.tsx`) só desenha o que ele responde — a mesma
 * separação que `capacidade-operacao.ts` mantém com `aviso-de-prazo.tsx`, e
 * pela mesma razão: o que quebra em produção é a decisão, e decisão se testa
 * sem DOM.
 *
 * ## Por que é um *store*, e não um `useEffect` no componente
 *
 * A primeira versão lia o estado num `useEffect` e chamava `setState` ali
 * dentro. O `eslint` recusou, com razão, por `react-hooks/set-state-in-effect`
 * — a mesma regra que `aviso-de-prazo.tsx` documenta ter respeitado. Instalação
 * é **sistema externo** (dois eventos de `window` e uma chave de
 * `localStorage`), e a forma certa de ler sistema externo no React é
 * `useSyncExternalStore`, que este projeto já usa em `bottom-nav.tsx`.
 *
 * Daí o formato: `assinarInstalacao` é o `subscribe`, `lerModoDeConvite` é o
 * `getSnapshot` (devolve string, então é estável por valor) e
 * `modoNoServidor` é o `getServerSnapshot`.
 */

/**
 * **Não reaproveita o prefixo `playck_sadmin_` de `auth-storage`.** Aquelas
 * duas chaves saem juntas no `clearAccessToken()`, porque token órfão é sobra
 * que a próxima pessoa herda. Esta **não pode sair no logout**: quem dispensou
 * o convite dispensou como pessoa, não como sessão, e ressuscitá-lo a cada
 * `logout` transformaria o conserto em praga.
 */
const CHAVE_DISPENSA = "playck_instalacao_dispensada_em";

/**
 * Quinze dias entre um "agora não" e o próximo convite.
 *
 * O número é um meio entre os dois jeitos de errar: perguntar de novo na
 * sessão seguinte é o que faz o usuário desinstalar o app em vez do banner, e
 * nunca mais perguntar repete exatamente o defeito que esta spec conserta.
 */
export const DIAS_DE_SILENCIO = 15;

const MS_POR_DIA = 86_400_000;

/** O evento do Chromium, que o `lib.dom` do TypeScript não declara. */
export type EventoDeInstalacao = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    /**
     * Onde o script de captura do `layout.tsx` guarda o evento — e a **única**
     * fonte de verdade dele, de propósito. Uma cópia em variável de módulo
     * criaria dois lugares para o mesmo fato, e o segundo sobreviveria entre
     * testes sem ninguém pedir.
     */
    __playckEventoDeInstalacao?: EventoDeInstalacao;
  }
}

export type ModoDeConvite = "oculto" | "botao" | "instrucao";

const assinantes = new Set<() => void>();

function avisar(): void {
  for (const assinante of assinantes) assinante();
}

/**
 * **O detalhe que decide se este conserto funciona.**
 *
 * O Chrome dispara `beforeinstallprompt` logo depois do `load`, que costuma
 * ser **antes** de a hidratação do React acontecer. Se a única escuta fosse a
 * daqui, o evento chegaria antes de haver assinante e o convite não apareceria
 * numa carga fria — o mesmo sintoma de não haver código nenhum, que é o que
 * estávamos consertando.
 *
 * Por isso o `layout.tsx` assina o evento num **`<script>` inline** no topo do
 * `<body>` — que executa durante o parse do HTML — e o deixa em
 * `window.__playckEventoDeInstalacao`. Esta função lê **de lá** e, a partir
 * daqui, também escuta o que chegar depois (o Chrome reavalia os critérios de
 * instalabilidade durante a navegação).
 *
 * *`<script>` cru e não `next/script`: a estratégia `beforeInteractive` dele
 * não emite script inline, e sim uma fila `self.__next_s` que o runtime do Next
 * injeta quando sobe — conferido no HTML do build. Ver o comentário no
 * `layout.tsx`.*
 */
export function eventoDisponivel(): EventoDeInstalacao | null {
  if (typeof window === "undefined") return null;
  return window.__playckEventoDeInstalacao ?? null;
}

/**
 * **O evento serve uma vez só.** Depois de `prompt()` o Chrome o considera
 * consumido; guardá-lo para um segundo toque daria erro silencioso.
 */
export function consumirEvento(): void {
  if (typeof window === "undefined") return;
  delete window.__playckEventoDeInstalacao;
  avisar();
}

/**
 * O `subscribe` do `useSyncExternalStore`. Identidade estável porque é uma
 * função de módulo — passá-la inline remontaria a assinatura a cada render.
 */
export function assinarInstalacao(aoMudar: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  assinantes.add(aoMudar);

  const aoReceber = (e: Event) => {
    // Suprime o mini-infobar do Chrome de propósito: o convite passa a ser
    // nosso, com nossa regra de quando voltar, em vez do banner de uma vez só
    // do navegador.
    e.preventDefault();
    window.__playckEventoDeInstalacao = e as EventoDeInstalacao;
    avisar();
  };

  const aoInstalar = () => {
    delete window.__playckEventoDeInstalacao;
    // Instalou: a dispensa antiga pode ir embora, para que uma reinstalação
    // futura volte a poder convidar.
    limparDispensa();
  };

  window.addEventListener("beforeinstallprompt", aoReceber);
  window.addEventListener("appinstalled", aoInstalar);

  return () => {
    assinantes.delete(aoMudar);
    window.removeEventListener("beforeinstallprompt", aoReceber);
    window.removeEventListener("appinstalled", aoInstalar);
  };
}

/**
 * O `getSnapshot`. Devolve **string**, e isso não é detalhe: o
 * `useSyncExternalStore` compara snapshots por identidade, e um objeto novo a
 * cada chamada daria laço infinito de render.
 */
export function lerModoDeConvite(): ModoDeConvite {
  if (typeof window === "undefined") return "oculto";
  if (estaInstalado()) return "oculto";
  if (dispensaAtiva()) return "oculto";
  if (eventoDisponivel()) return "botao";
  return ehIOS() ? "instrucao" : "oculto";
}

/**
 * O `getServerSnapshot`. No servidor não há como saber, e "oculto" é a única
 * resposta que não causa divergência de hidratação: o convite aparece depois
 * da hidratação, nunca no HTML.
 */
export function modoNoServidor(): ModoDeConvite {
  return "oculto";
}

/**
 * Já está instalado? Então não há o que convidar.
 *
 * São três perguntas porque nenhuma responde sozinha: `standalone` cobre o
 * Android e o desktop instalados, `fullscreen`/`minimal-ui` cobrem manifests
 * com outro `display`, e `navigator.standalone` é a única resposta do **iOS**,
 * que não implementa `display-mode`.
 */
export function estaInstalado(): boolean {
  if (typeof window === "undefined") return false;

  const modos = ["standalone", "fullscreen", "minimal-ui"];
  const porMediaQuery = modos.some((modo) => {
    // `matchMedia` não existe em todo ambiente, e uma ausência aqui não pode
    // derrubar a tela inteira por causa de um convite.
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia(`(display-mode: ${modo})`).matches;
  });
  if (porMediaQuery) return true;

  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * iOS — onde `beforeinstallprompt` **não existe** e nunca vai existir.
 *
 * O segundo ramo não é excesso de zelo: desde o iPadOS 13 o iPad se anuncia
 * como `Macintosh`, e um teste só de `iPad` deixa todo iPad de fora — a
 * plataforma em que o convite é o *único* caminho de instalação, já que lá não
 * há botão nenhum a oferecer, só a instrução do menu Compartilhar.
 */
export function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Lê o instante da última dispensa. `null` para "nunca dispensou" e também
 * para lixo — o valor vem do `localStorage`, que é do navegador e não nosso,
 * a mesma desconfiança que `getPapel()` declara.
 */
function lerDispensa(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE_DISPENSA);
    if (bruto === null) return null;
    const quando = Number(bruto);
    return Number.isFinite(quando) && quando > 0 ? quando : null;
  } catch {
    // **Aqui o `try` existe e em `auth-storage` não, de propósito.** Em janela
    // privada o `localStorage` pode lançar no acesso; sem token o app não tem
    // o que fazer mesmo, mas um convite de instalação que derruba a página
    // seria um estrago muito maior que o benefício dele.
    return null;
  }
}

export function dispensaAtiva(agora: number = Date.now()): boolean {
  const quando = lerDispensa();
  if (quando === null) return false;
  // Relógio para trás (fuso, viagem, troca de máquina) não pode virar silêncio
  // eterno: uma dispensa no "futuro" conta como expirada.
  if (quando > agora) return false;
  return agora - quando < DIAS_DE_SILENCIO * MS_POR_DIA;
}

export function registrarDispensa(agora: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_DISPENSA, String(agora));
  } catch {
    // Não conseguir lembrar da dispensa é ruim (o convite volta na próxima
    // visita), mas não é motivo para quebrar a tela.
  }
  avisar();
}

export function limparDispensa(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHAVE_DISPENSA);
  } catch {
    // idem
  }
  avisar();
}
