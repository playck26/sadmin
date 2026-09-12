import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConviteDeInstalacao } from "./convite-de-instalacao";
import type { EventoDeInstalacao } from "@/lib/instalacao-pwa";

/**
 * SPEC-050 — **o que a pessoa vê, em cada um dos dois mundos.**
 *
 * `instalacao-pwa.test.ts` prova a decisão; este arquivo prova a tela. São
 * coisas diferentes, e a que falha em produção é esta: uma decisão certa
 * consumida por uma tela que só desenha o botão deixa todo operador de iPhone
 * sem caminho de instalação, porque lá não existe botão a oferecer.
 *
 * O caso mais importante do arquivo é o da **carga fria** — o evento que
 * chegou antes do React. Era o defeito mais provável desta feature, e é o
 * único que reproduz o sintoma original ("só apareceu uma única vez") mesmo
 * com todo o código novo no lugar.
 */
const UA_ORIGINAL = navigator.userAgent;

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

/** Um `beforeinstallprompt` de mentira, com as duas coisas que o real tem. */
function eventoFalso(outcome: "accepted" | "dismissed" = "accepted") {
  const e = new Event("beforeinstallprompt", {
    cancelable: true,
  }) as EventoDeInstalacao;
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(e, { prompt, userChoice: Promise.resolve({ outcome }) });
  return { e, prompt };
}

const CHAVE = "playck_instalacao_dispensada_em";

beforeEach(() => {
  window.localStorage.clear();
  delete window.__playckEventoDeInstalacao;
  definirUA("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120", 5);
});

afterEach(() => {
  definirUA(UA_ORIGINAL);
  vi.unstubAllGlobals();
  delete (navigator as Navigator & { standalone?: boolean }).standalone;
  vi.clearAllMocks();
});

const convite = () => screen.queryByRole("region", { name: "Instalar o PlayCK SAdmin" });

describe("ConviteDeInstalacao — a carga fria, que é o caso que importa", () => {
  /**
   * **O defeito que este teste impede.** O Chrome dispara
   * `beforeinstallprompt` logo depois do `load`, normalmente antes de um
   * `useEffect` assinar o evento. Sem a leitura do evento capturado pelo
   * script do `layout.tsx`, o convite não apareceria — exatamente o sintoma
   * que a SPEC-050 conserta, agora com código no lugar.
   */
  it("evento capturado ANTES da hidratação: o convite aparece", async () => {
    const { e } = eventoFalso();
    window.__playckEventoDeInstalacao = e;

    render(<ConviteDeInstalacao />);

    expect(await screen.findByRole("button", { name: "Instalar" })).toBeInTheDocument();
    expect(convite()).toBeInTheDocument();
  });

  it("sem evento e fora do iOS: não convida nada — não há o que oferecer", async () => {
    render(<ConviteDeInstalacao />);
    await waitFor(() => expect(convite()).toBeNull());
    expect(screen.queryByRole("button", { name: "Instalar" })).toBeNull();
  });

  it("evento que chega DEPOIS do mount também abre o convite", async () => {
    render(<ConviteDeInstalacao />);
    await waitFor(() => expect(convite()).toBeNull());

    const { e } = eventoFalso();
    act(() => {
      window.dispatchEvent(e);
    });

    expect(await screen.findByRole("button", { name: "Instalar" })).toBeInTheDocument();
  });
});

describe("ConviteDeInstalacao — os dois mundos", () => {
  it("Chromium: oferece BOTÃO, e o clique abre o diálogo nativo", async () => {
    const { e, prompt } = eventoFalso("accepted");
    window.__playckEventoDeInstalacao = e;

    render(<ConviteDeInstalacao />);
    const botao = await screen.findByRole("button", { name: "Instalar" });
    botao.click();

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
  });

  /**
   * **iOS não tem botão a oferecer.** `beforeinstallprompt` não existe no
   * Safari e não vai existir; a única coisa útil é ensinar o caminho do menu
   * Compartilhar. Tratar iOS como Chromium deixaria metade do público de um
   * app de aluno sem instalação nenhuma.
   */
  it("iOS: ensina o caminho, e NÃO finge que existe botão", async () => {
    definirUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari");

    render(<ConviteDeInstalacao />);

    expect(await screen.findByText("Compartilhar")).toBeInTheDocument();
    expect(screen.getByText("Adicionar à Tela de Início")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Instalar" })).toBeNull();
  });

  it("os dois modos NÃO desenham a mesma tela", async () => {
    const { e } = eventoFalso();
    window.__playckEventoDeInstalacao = e;
    const chromium = render(<ConviteDeInstalacao />);
    await screen.findByRole("button", { name: "Instalar" });
    const textoChromium = chromium.container.textContent;
    chromium.unmount();

    delete window.__playckEventoDeInstalacao;
    definirUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari");
    const ios = render(<ConviteDeInstalacao />);
    await screen.findByText("Compartilhar");

    expect(ios.container.textContent).not.toBe(textoChromium);
  });
});

describe("ConviteDeInstalacao — quem não deve ser convidado", () => {
  it("já instalado (display-mode standalone): silêncio", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q === "(display-mode: standalone)",
    }));
    const { e } = eventoFalso();
    window.__playckEventoDeInstalacao = e;

    render(<ConviteDeInstalacao />);
    await waitFor(() => expect(convite()).toBeNull());
  });

  it("já instalado no iOS (navigator.standalone): silêncio", async () => {
    definirUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari");
    (navigator as Navigator & { standalone?: boolean }).standalone = true;

    render(<ConviteDeInstalacao />);
    await waitFor(() => expect(convite()).toBeNull());
  });

  it("dispensa recente: silêncio, mesmo com evento na mão", async () => {
    window.localStorage.setItem(CHAVE, String(Date.now()));
    const { e } = eventoFalso();
    window.__playckEventoDeInstalacao = e;

    render(<ConviteDeInstalacao />);
    await waitFor(() => expect(convite()).toBeNull());
  });

  it("dispensa velha (16 dias): convida de novo", async () => {
    window.localStorage.setItem(CHAVE, String(Date.now() - 16 * 86_400_000));
    const { e } = eventoFalso();
    window.__playckEventoDeInstalacao = e;

    render(<ConviteDeInstalacao />);
    expect(await screen.findByRole("button", { name: "Instalar" })).toBeInTheDocument();
  });
});

describe("ConviteDeInstalacao — dispensar é definitivo por 15 dias", () => {
  it("'Agora não' esconde e REGISTRA — sem registro o convite vira praga", async () => {
    const { e } = eventoFalso();
    window.__playckEventoDeInstalacao = e;

    render(<ConviteDeInstalacao />);
    const fechar = await screen.findByRole("button", { name: "Agora não" });
    fechar.click();

    await waitFor(() => expect(convite()).toBeNull());
    expect(window.localStorage.getItem(CHAVE)).not.toBeNull();
  });

  /**
   * Um "não" no diálogo **nativo** também é um "não". Sem isto, quem recusasse
   * no diálogo do Chrome receberia o convite de novo na tela seguinte.
   */
  it("recusa no diálogo nativo conta como dispensa", async () => {
    const { e } = eventoFalso("dismissed");
    window.__playckEventoDeInstalacao = e;

    render(<ConviteDeInstalacao />);
    (await screen.findByRole("button", { name: "Instalar" })).click();

    await waitFor(() => expect(window.localStorage.getItem(CHAVE)).not.toBeNull());
  });

  /**
   * Aceitar **não** pode registrar dispensa: se a instalação falhar depois,
   * a pessoa ficaria 15 dias sem convite por ter dito "sim".
   */
  it("aceitar NÃO registra dispensa", async () => {
    const { e } = eventoFalso("accepted");
    window.__playckEventoDeInstalacao = e;

    render(<ConviteDeInstalacao />);
    (await screen.findByRole("button", { name: "Instalar" })).click();

    await waitFor(() => expect(convite()).toBeNull());
    expect(window.localStorage.getItem(CHAVE)).toBeNull();
  });

  it("appinstalled esconde o convite e limpa a dispensa", async () => {
    window.localStorage.setItem(CHAVE, String(Date.now() - 16 * 86_400_000));
    const { e } = eventoFalso();
    window.__playckEventoDeInstalacao = e;

    render(<ConviteDeInstalacao />);
    await screen.findByRole("button", { name: "Instalar" });

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    await waitFor(() => expect(convite()).toBeNull());
    expect(window.localStorage.getItem(CHAVE)).toBeNull();
  });
});
