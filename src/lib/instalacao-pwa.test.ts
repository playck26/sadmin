import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DIAS_DE_SILENCIO,
  assinarInstalacao,
  consumirEvento,
  dispensaAtiva,
  ehIOS,
  estaInstalado,
  eventoDisponivel,
  lerModoDeConvite,
  limparDispensa,
  modoNoServidor,
  registrarDispensa,
  type EventoDeInstalacao,
} from "./instalacao-pwa";

/**
 * SPEC-050 — **a decisão de convidar, provada sem DOM.**
 *
 * O que quebra em produção aqui não é o desenho do banner: é decidir errado
 * *se* cabe convidar. Três decisões erradas dão três defeitos distintos —
 * convidar quem já instalou, convidar quem disse "agora não" ontem, e não
 * convidar ninguém no iPad (que se anuncia como Mac).
 */
const MS_POR_DIA = 86_400_000;
const CHAVE = "playck_instalacao_dispensada_em";

function definirUA(userAgent: string, maxTouchPoints = 0) {
  Object.defineProperty(navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: maxTouchPoints,
    configurable: true,
  });
}

function eventoFalso() {
  return new Event("beforeinstallprompt", {
    cancelable: true,
  }) as EventoDeInstalacao;
}

const UA_ORIGINAL = navigator.userAgent;
/** Chromium sem toque é o piso neutro: nem iOS, nem iPad disfarçado de Mac. */
const UA_CHROMIUM = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120";

beforeEach(() => {
  window.localStorage.clear();
  delete window.__playckEventoDeInstalacao;
  definirUA(UA_CHROMIUM);
});

afterEach(() => {
  definirUA(UA_ORIGINAL);
  vi.unstubAllGlobals();
  delete (navigator as Navigator & { standalone?: boolean }).standalone;
});

describe("estaInstalado — quem já instalou não é convidado", () => {
  /**
   * O jsdom não implementa `matchMedia`. Que o código sobreviva a isso não é
   * detalhe de teste: é a garantia de que uma ausência de API não derruba a
   * página inteira por causa de um convite decorativo.
   */
  it("sem matchMedia e sem navigator.standalone: não está instalado", () => {
    expect(estaInstalado()).toBe(false);
  });

  it.each(["standalone", "fullscreen", "minimal-ui"])(
    "display-mode %s conta como instalado",
    (modo) => {
      vi.stubGlobal("matchMedia", (q: string) => ({
        matches: q === `(display-mode: ${modo})`,
      }));
      expect(estaInstalado()).toBe(true);
    },
  );

  it("display-mode browser NÃO é instalado", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(estaInstalado()).toBe(false);
  });

  /**
   * **A única resposta do iOS.** O Safari não implementa `display-mode`, então
   * sem este ramo o app instalado no iPhone seria convidado a se instalar de
   * novo, para sempre.
   */
  it("navigator.standalone do iOS conta como instalado", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    (navigator as Navigator & { standalone?: boolean }).standalone = true;
    expect(estaInstalado()).toBe(true);
  });
});

describe("ehIOS — onde beforeinstallprompt nunca vai existir", () => {
  it("iPhone", () => {
    definirUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari");
    expect(ehIOS()).toBe(true);
  });

  /**
   * **O iPad se anuncia como `Macintosh` desde o iPadOS 13.** Um teste só de
   * `/iPad/` deixa todo iPad de fora — e é justamente a plataforma em que o
   * convite é o *único* caminho de instalação.
   */
  it("iPad moderno: diz Macintosh, mas tem toque", () => {
    definirUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari", 5);
    expect(ehIOS()).toBe(true);
  });

  it("Mac de verdade: diz Macintosh e NÃO tem toque", () => {
    definirUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari", 0);
    expect(ehIOS()).toBe(false);
  });

  it("Android não é iOS", () => {
    definirUA("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120", 5);
    expect(ehIOS()).toBe(false);
  });
});

describe("dispensa — o silêncio tem prazo, e o prazo tem fim", () => {
  it("nunca dispensou: pode convidar", () => {
    expect(dispensaAtiva()).toBe(false);
  });

  it("dispensou agora: fica em silêncio", () => {
    const agora = 1_700_000_000_000;
    registrarDispensa(agora);
    expect(dispensaAtiva(agora)).toBe(true);
    expect(dispensaAtiva(agora + 14 * MS_POR_DIA)).toBe(true);
  });

  /**
   * **O prazo tem de acabar.** Um silêncio eterno reintroduz exatamente o
   * defeito que a SPEC-050 conserta: o convite que aparece uma única vez.
   */
  it(`depois de ${DIAS_DE_SILENCIO} dias, convida de novo`, () => {
    const agora = 1_700_000_000_000;
    registrarDispensa(agora);
    expect(dispensaAtiva(agora + DIAS_DE_SILENCIO * MS_POR_DIA)).toBe(false);
  });

  it("limparDispensa devolve o convite na hora", () => {
    const agora = 1_700_000_000_000;
    registrarDispensa(agora);
    limparDispensa();
    expect(dispensaAtiva(agora)).toBe(false);
  });

  /**
   * O valor vem do `localStorage`, que é do navegador e não nosso — a mesma
   * desconfiança que `getPapel()` declara. Lixo lá não pode virar silêncio.
   */
  it.each(["banana", "", "0", "-5", "NaN"])(
    "valor inválido (%s) não silencia o convite",
    (bruto) => {
      window.localStorage.setItem(CHAVE, bruto);
      expect(dispensaAtiva(1_700_000_000_000)).toBe(false);
    },
  );

  /**
   * Relógio para trás (fuso, troca de máquina — este projeto já trocou três
   * vezes) não pode virar silêncio eterno: uma dispensa "no futuro" conta como
   * expirada, e não como 15 dias a partir de uma data que nunca chega.
   */
  it("dispensa no futuro conta como expirada, não como silêncio eterno", () => {
    const agora = 1_700_000_000_000;
    registrarDispensa(agora + 90 * MS_POR_DIA);
    expect(dispensaAtiva(agora)).toBe(false);
  });

  /**
   * A chave **não** leva o prefixo `playck_sadmin_` de `auth-storage` de
   * propósito, e este teste trava isso: aquelas duas chaves saem juntas no
   * `clearAccessToken()`, e uma dispensa que morre no logout faria o convite
   * voltar a cada sessão.
   */
  it("a dispensa NÃO usa o prefixo que o logout limpa", () => {
    registrarDispensa(1_700_000_000_000);
    const chaves = Object.keys(window.localStorage);
    expect(chaves).toContain(CHAVE);
    expect(chaves.some((k) => k.startsWith("playck_sadmin_"))).toBe(false);
  });
});

describe("eventoDisponivel — a corrida que o React perde", () => {
  it("sem captura: null", () => {
    expect(eventoDisponivel()).toBeNull();
  });

  /**
   * **O teste que representa o defeito mais provável desta feature.** O Chrome
   * dispara `beforeinstallprompt` logo após o `load`, antes de a hidratação
   * acontecer. O script do `layout.tsx` guarda o evento aqui; se esta leitura
   * não existisse, o convite não apareceria numa carga fria — o mesmo sintoma
   * de não haver código nenhum.
   */
  it("lê o evento que o script do layout guardou antes da hidratação", () => {
    const falso = eventoFalso();
    window.__playckEventoDeInstalacao = falso;
    expect(eventoDisponivel()).toBe(falso);
  });

  it("consumir apaga — o evento serve uma vez só", () => {
    window.__playckEventoDeInstalacao = eventoFalso();
    consumirEvento();
    expect(eventoDisponivel()).toBeNull();
  });
});

describe("lerModoDeConvite — a decisão inteira, em uma resposta", () => {
  it("Chromium com evento na mão: botão", () => {
    window.__playckEventoDeInstalacao = eventoFalso();
    expect(lerModoDeConvite()).toBe("botao");
  });

  it("Chromium sem evento: oculto — não há o que oferecer", () => {
    expect(lerModoDeConvite()).toBe("oculto");
  });

  it("iOS sem evento: instrução, porque o evento nunca virá", () => {
    definirUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari");
    expect(lerModoDeConvite()).toBe("instrucao");
  });

  it("já instalado vence o evento na mão", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q === "(display-mode: standalone)",
    }));
    window.__playckEventoDeInstalacao = eventoFalso();
    expect(lerModoDeConvite()).toBe("oculto");
  });

  it("dispensa recente vence o evento na mão", () => {
    registrarDispensa();
    window.__playckEventoDeInstalacao = eventoFalso();
    expect(lerModoDeConvite()).toBe("oculto");
  });

  /**
   * **O snapshot tem de ser estável por valor.** O `useSyncExternalStore`
   * compara snapshots por identidade; devolver objeto novo a cada chamada daria
   * laço infinito de render. É string, e este teste trava isso.
   */
  it("duas leituras seguidas devolvem o MESMO valor", () => {
    window.__playckEventoDeInstalacao = eventoFalso();
    expect(lerModoDeConvite()).toBe(lerModoDeConvite());
    expect(typeof lerModoDeConvite()).toBe("string");
  });

  it("no servidor é sempre oculto — o convite nunca vai no HTML", () => {
    expect(modoNoServidor()).toBe("oculto");
  });
});

describe("assinarInstalacao — o subscribe do store", () => {
  it("avisa quando o evento do navegador chega", () => {
    const aoMudar = vi.fn();
    const desassinar = assinarInstalacao(aoMudar);

    window.dispatchEvent(eventoFalso());

    expect(aoMudar).toHaveBeenCalled();
    expect(eventoDisponivel()).not.toBeNull();
    desassinar();
  });

  /**
   * `preventDefault()` suprime o mini-infobar do Chrome **de propósito**: o
   * convite passa a ser nosso, com nossa regra de quando voltar, em vez do
   * banner de uma vez só do navegador. Sem isto os dois apareceriam juntos.
   */
  it("suprime o banner do navegador ao capturar o evento", () => {
    const desassinar = assinarInstalacao(() => {});
    const e = eventoFalso();

    window.dispatchEvent(e);

    expect(e.defaultPrevented).toBe(true);
    desassinar();
  });

  it("appinstalled descarta o evento e limpa a dispensa", () => {
    registrarDispensa();
    window.__playckEventoDeInstalacao = eventoFalso();
    const aoMudar = vi.fn();
    const desassinar = assinarInstalacao(aoMudar);

    window.dispatchEvent(new Event("appinstalled"));

    expect(eventoDisponivel()).toBeNull();
    expect(window.localStorage.getItem(CHAVE)).toBeNull();
    expect(aoMudar).toHaveBeenCalled();
    desassinar();
  });

  /**
   * Desassinar tem de desligar a escuta de verdade. Um assinante que sobrevive
   * ao desmonte vira `setState` em componente morto a cada evento.
   */
  it("desassinar para de avisar", () => {
    const aoMudar = vi.fn();
    assinarInstalacao(aoMudar)();

    window.dispatchEvent(eventoFalso());

    expect(aoMudar).not.toHaveBeenCalled();
  });
});
