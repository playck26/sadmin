"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ApiError,
  gerarSenhaDeAdmin,
  listCompanyAdmins,
  type AdminDaEmpresa,
  type SenhaTemporariaGerada,
} from "@/lib/api-client";

/**
 * SPEC-016 — devolver o acesso de um gestor trancado do lado de fora.
 *
 * Antes desta tela, um `company_admin` que esquecesse a senha só voltava com
 * `UPDATE` direto no banco: aluno e professor tinham recuperação, quem opera
 * o produto não tinha.
 *
 * A senha aparece **uma única vez** (AC-009). Não há rota que a devolva
 * depois — nem esta, nem nenhuma outra —, e a tela precisa deixar isso
 * explícito antes de a pessoa fechar a página.
 */
export function CompanyAdminsCard({ companyId }: { companyId: string }) {
  const [admins, setAdmins] = useState<AdminDaEmpresa[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerandoId, setGerandoId] = useState<string | null>(null);
  const [gerada, setGerada] = useState<SenhaTemporariaGerada | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    listCompanyAdmins(companyId)
      .then(setAdmins)
      .catch((e: unknown) =>
        setErro(
          e instanceof ApiError
            ? e.message
            : "Não foi possível carregar os administradores.",
        ),
      );
  }, [companyId]);

  async function gerar(usuarioId: string) {
    setErro(null);
    setGerada(null);
    setCopiado(false);
    setGerandoId(usuarioId);
    try {
      setGerada(await gerarSenhaDeAdmin(companyId, usuarioId));
      setAdmins(await listCompanyAdmins(companyId));
    } catch (e) {
      setErro(
        e instanceof ApiError ? e.message : "Não foi possível gerar a senha.",
      );
    } finally {
      setGerandoId(null);
    }
  }

  async function copiar(senha: string) {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
    } catch {
      // A senha continua visível e selecionável na tela; falhar em silêncio
      // aqui é melhor que um alerta de erro para uma conveniência.
      setCopiado(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Administradores</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Gerar uma senha nova derruba as sessões abertas do gestor e obriga
          ele a escolher outra no primeiro acesso.
        </p>

        {erro ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {erro}
          </p>
        ) : null}

        {gerada ? (
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-primary)] p-3">
            <p className="text-sm font-semibold">
              Senha de {gerada.usuario.nome}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-[var(--color-surface-variant)] px-3 py-2 font-mono text-base">
                {gerada.senhaTemporaria}
              </code>
              <Button
                type="button"
                variant="outline"
                onClick={() => void copiar(gerada.senhaTemporaria)}
              >
                {copiado ? "Copiada" : "Copiar"}
              </Button>
            </div>
            <p className="text-sm font-semibold text-[var(--color-error)]">
              Anote agora: ela não será mostrada de novo.
            </p>
            <p className="text-sm text-[var(--color-on-surface-variant)]">
              Vale 7 dias e precisa ser trocada no primeiro acesso. Entregue
              por um canal que você confie.
            </p>
            {gerada.empresaInativa ? (
              <p className="text-sm text-[var(--color-error)]">
                Esta empresa está inativa, então a senha só vai funcionar
                depois de reativá-la.
              </p>
            ) : null}
          </div>
        ) : null}

        {admins === null ? (
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Carregando...
          </p>
        ) : admins.length === 0 ? (
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Esta empresa não tem administrador cadastrado.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {admins.map((admin) => (
              <li
                key={admin.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{admin.nome}</p>
                  <p className="truncate text-sm text-[var(--color-on-surface-variant)]">
                    {admin.email}
                  </p>
                  {admin.senhaTemporaria ? (
                    <p className="text-sm text-[var(--color-on-surface-variant)]">
                      Está com senha temporária, ainda não trocada.
                    </p>
                  ) : null}
                  {admin.status !== "ativo" ? (
                    <p className="text-sm text-[var(--color-error)]">
                      Conta inativa — reative antes de gerar senha.
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={gerandoId === admin.id}
                  onClick={() => void gerar(admin.id)}
                >
                  {gerandoId === admin.id ? "Gerando..." : "Gerar senha nova"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
