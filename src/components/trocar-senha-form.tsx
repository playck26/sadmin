"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CampoSenha } from "@/components/campo-senha";
import { ApiError, trocarSenha } from "@/lib/api-client";
import { saveAccessToken } from "@/lib/auth-storage";

/**
 * SPEC-014:TASK-000 — troca de senha do painel.
 *
 * Esta tela faltava aqui, e a falta tinha consequencia concreta: as contas
 * de administracao seguiam com a senha do seed — que esta num repositorio
 * **publico** — porque nao havia porta para troca-la. INV-008 tambem nao
 * tinha saida: uma conta de admin com senha temporaria ficava trancada,
 * sem tela para sair da trava.
 *
 * Portada do app do aluno (SPEC-009/REQ-004), nao reinventada. A senha
 * atual e pedida porque confirmar posse antes de fixar a definitiva nao e
 * burocracia quando a anterior pode ter circulado por WhatsApp — ou por
 * um repositorio publico.
 */
export function TrocarSenhaForm({ destino }: { destino: string }) {
  const router = useRouter();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (novaSenha !== confirmacao) {
      setError("As duas senhas nao sao iguais.");
      return;
    }

    setLoading(true);
    try {
      const { accessToken } = await trocarSenha({ senhaAtual, novaSenha });
      // O backend revoga as sessoes antigas e devolve um par novo: sem
      // guardar este token, a pessoa cairia no login logo depois de fazer
      // exatamente o que o sistema exigiu.
      saveAccessToken(accessToken);
      router.push(destino);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Nao foi possivel trocar a senha. Tente de novo.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <CampoSenha
        id="senha-atual"
        label="Senha atual"
        valor={senhaAtual}
        onChange={setSenhaAtual}
        disabled={loading}
        autoComplete="current-password"
        placeholder="A senha que voce usa hoje"
      />
      <CampoSenha
        id="nova-senha"
        label="Sua nova senha"
        valor={novaSenha}
        onChange={setNovaSenha}
        disabled={loading}
      />
      <CampoSenha
        id="confirmacao"
        label="Repita a nova senha"
        valor={confirmacao}
        onChange={setConfirmacao}
        disabled={loading}
      />

      {error ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="mt-2 w-full">
        {loading ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}
