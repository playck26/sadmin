"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, listCompanies, type Empresa } from "@/lib/api-client";

const PAGE_SIZE = 20;

export function CompaniesList() {
  const [data, setData] = useState<Empresa[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listCompanies(targetPage, PAGE_SIZE);
      setData(result.data);
      setTotal(result.total);
      setPage(result.page);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar as empresas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Busca dado ao montar — caso de uso explicitamente listado como
    // válido para useEffect na documentação do React.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(1);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] bg-[var(--color-primary-strong)] p-6 text-white shadow-[var(--shadow-elevated)] md:p-8">
        <span aria-hidden="true" className="court-lines pointer-events-none absolute inset-0 opacity-25" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-xs font-bold tracking-[0.15em] text-[var(--color-secondary)] uppercase">Ecossistema PlayCK</p><h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Empresas</h1><p className="mt-2 text-sm text-white/70">Administre arenas, escolas e seus acessos iniciais.</p></div>
        <Button asChild className="h-11 bg-white px-4 font-bold text-[var(--color-primary-strong)] hover:bg-white/90">
          <Link href="/empresas/nova"><Plus className="size-4" />Nova empresa</Link>
        </Button>
        </div>
      </section>

      <div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold">Empresas cadastradas</h2><p className="text-sm text-[var(--color-text-secondary)]">{loading ? "Atualizando lista" : `${total} registros`}</p></div><span className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-primary-container)] text-[var(--color-primary-strong)]"><Building2 className="size-5" /></span></div>

      {loading ? (
        <p className="text-[var(--color-text-secondary)]">Carregando...</p>
      ) : error ? (
        <p role="alert" className="text-[var(--color-error)]">
          {error}
        </p>
      ) : data.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">Nenhuma empresa cadastrada ainda.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-white shadow-[var(--shadow-low)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Esportes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((empresa) => (
                  <TableRow key={empresa.id}>
                    <TableCell className="font-medium">{empresa.nome}</TableCell>
                    <TableCell>{empresa.esportes.join(", ") || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={empresa.status === "ativa" ? "default" : "secondary"}>
                        {empresa.status === "ativa" ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/empresas/${empresa.id}`}
                        className="text-sm font-bold text-[var(--color-primary-strong)] hover:underline"
                      >
                        Editar
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => void load(page - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-[var(--color-text-secondary)]">
                Página {page} de {totalPages}
              </span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => void load(page + 1)}>
                Próxima
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
