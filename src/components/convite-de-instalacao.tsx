"use client";

import { useCallback, useSyncExternalStore } from "react";
import Image from "next/image";
import { Share, SquarePlus, X } from "lucide-react";
import {
  assinarInstalacao,
  consumirEvento,
  eventoDisponivel,
  lerModoDeConvite,
  limparDispensa,
  modoNoServidor,
  registrarDispensa,
} from "@/lib/instalacao-pwa";

/**
 * SPEC-050 — **o convite para instalar, que este app nunca teve.**
 *
 * A ADR-012 decidiu que `cliente` **e `admin` (e `sadmin`)** seriam PWA
 * instalável. Só o `cliente` foi: até esta spec,
 * `super.playck.com.br/manifest.webmanifest` respondia **404**, sem service
 * worker e sem ícone de instalação. Não era decisão revista — era a ADR não
 * cumprida em dois dos três frontends.
 *
 * ## O ganho aqui é menor, e a honestidade sobre isso importa
 *
 * No `cliente` o convite conserta um defeito de produto (aluno sem caminho de
 * instalação). No `admin`, ganha o gestor que opera de celular na beira da
 * quadra. **Aqui é painel interno da PlayCK, usado de mesa** — instalar rende
 * pouco mais que uma janela sem barra de endereço.
 *
 * Existe mesmo assim por duas razões, e nenhuma é "ficar bonito": a ADR-012
 * inclui o `sadmin` explicitamente, e **três cópias iguais são mais baratas de
 * manter que duas mais uma exceção** — a exceção é o que envelhece sem
 * ninguém notar, como este próprio 404 envelheceu.
 *
 * ## Dois modos, porque são dois mundos
 *
 * - **`botao`** (Chromium: Chrome/Edge desktop, Android) — existe um evento
 *   `beforeinstallprompt` guardado, e `prompt()` abre o diálogo **nativo**.
 * - **`instrucao`** (iOS) — `beforeinstallprompt` não existe no Safari e não
 *   vai existir. Não há diálogo a abrir: o único caminho é Compartilhar →
 *   "Adicionar à Tela de Início", e a única coisa útil é ensinar o caminho.
 *
 * ## Sem `useEffect`, e o porquê importa
 *
 * Instalação é **sistema externo**: dois eventos de `window` e uma chave de
 * `localStorage`. Ler sistema externo com `useEffect` + `setState` é o que o
 * `react-hooks/set-state-in-effect` recusa — e a primeira versão deste
 * componente levou exatamente esse erro no `eslint` dos três repositórios.
 * `useSyncExternalStore` é a ferramenta certa, e a decisão toda vive em
 * `lib/instalacao-pwa.ts`.
 *
 * ## A posição
 *
 * `bottom-2` e à **direita** a partir de `sm`: este app navega por
 * `super-admin-shell.tsx` e não tem nada fixo embaixo com o que colidir.
 * Centralizar um card de 390px no rodapé de um desktop pareceria erro de
 * layout. É a mesma escolha do `admin`; a cópia do `cliente` usa
 * `bottom-[94px]` porque lá existe uma `BottomNav` a não cobrir.
 *
 * Três cópias e não um pacote compartilhado por ADR-001 (poly-repo, sem
 * pacote comum) — a mesma razão pela qual os tokens de `DESIGN.md` são
 * copiados localmente.
 */
export function ConviteDeInstalacao() {
  const modo = useSyncExternalStore(
    assinarInstalacao,
    lerModoDeConvite,
    modoNoServidor,
  );

  const dispensar = useCallback(() => registrarDispensa(), []);

  /**
   * Um "não" no diálogo nativo conta como dispensa: perguntar de novo na
   * próxima tela seria pior que não ter convite nenhum. **Aceitar não conta** —
   * se a instalação falhar depois, a pessoa ficaria 15 dias sem convite por
   * ter dito "sim".
   */
  const instalar = useCallback(async () => {
    const evento = eventoDisponivel();
    if (!evento) return;
    try {
      await evento.prompt();
      const { outcome } = await evento.userChoice;
      if (outcome === "dismissed") registrarDispensa();
      else limparDispensa();
    } catch {
      // Diálogo recusado pelo navegador (evento já consumido, gesto perdido).
      // Não registra dispensa: não foi decisão da pessoa, então o convite volta
      // na próxima visita, quando um evento novo puder chegar.
    } finally {
      consumirEvento();
    }
  }, []);

  if (modo === "oculto") return null;

  return (
    <div
      role="region"
      aria-label="Instalar o PlayCK SAdmin"
      className="fixed inset-x-2 bottom-2 z-40 flex items-center gap-3 rounded-[28px] bg-surface p-3 shadow-[0_18px_48px_rgba(18,20,15,0.28)] ring-1 ring-border sm:left-auto sm:right-4 sm:w-[390px]"
    >
      <Image
        src="/icon-192.png"
        alt=""
        width={44}
        height={44}
        className="size-11 shrink-0 rounded-[14px] object-contain"
      />

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-[var(--color-text-primary)]">
          Instale o PlayCK SAdmin
        </p>
        {modo === "botao" ? (
          <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">
            Abre direto da tela de início, sem navegador.
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px] font-medium text-[var(--color-text-secondary)]">
            <span>Toque em</span>
            <Share className="size-[14px] shrink-0" aria-hidden="true" />
            <span className="font-bold">Compartilhar</span>
            <span>e depois em</span>
            <SquarePlus className="size-[14px] shrink-0" aria-hidden="true" />
            <span className="font-bold">Adicionar à Tela de Início</span>
          </p>
        )}
      </div>

      {modo === "botao" && (
        <button
          type="button"
          onClick={() => void instalar()}
          className="min-h-11 shrink-0 rounded-full bg-[var(--color-primary-strong)] px-4 text-[13px] font-bold text-white"
        >
          Instalar
        </button>
      )}

      {/*
        Alvo de 44px mesmo com ícone de 16px — um "x" pequeno num banner é o
        jeito clássico de tornar a dispensa impossível.
      */}
      <button
        type="button"
        onClick={dispensar}
        aria-label="Agora não"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)]"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
