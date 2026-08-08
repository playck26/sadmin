"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, getCompany, updateCompany, updateCompanyStatus, type Empresa } from "@/lib/api-client";

export function EditCompanyForm({ id }: { id: string }) {
  const router = useRouter();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [nome, setNome] = useState("");
  const [esportes, setEsportes] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCompany(id)
      .then((data) => {
        setEmpresa(data);
        setNome(data.nome);
        setEsportes(data.esportes.join(", "));
        setLogoUrl(data.logoUrl ?? "");
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Não foi possível carregar a empresa.");
      });
  }, [id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const updated = await updateCompany(id, {
        nome,
        esportes: esportes
          .split(",")
          .map((esporte) => esporte.trim())
          .filter(Boolean),
        logoUrl: logoUrl || undefined,
      });
      setEmpresa(updated);
      router.push("/empresas");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus() {
    if (!empresa) return;
    setStatusLoading(true);
    setError(null);
    try {
      const novoStatus = empresa.status === "ativa" ? "inativa" : "ativa";
      const updated = await updateCompanyStatus(id, novoStatus);
      setEmpresa(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível mudar o status.");
    } finally {
      setStatusLoading(false);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="text-[var(--color-error)]">
        {loadError}
      </p>
    );
  }

  if (!empresa) {
    return <p className="text-[var(--color-text-secondary)]">Carregando...</p>;
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">Editar empresa</CardTitle>
          <Badge variant={empresa.status === "ativa" ? "default" : "secondary"}>
            {empresa.status === "ativa" ? "Ativa" : "Inativa"}
          </Badge>
        </div>
        <CardDescription>Alterar dados básicos ou ativar/inativar</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome da empresa</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} disabled={loading} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="esportes">Esportes (separados por vírgula)</Label>
            <Input
              id="esportes"
              required
              value={esportes}
              onChange={(e) => setEsportes(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="logoUrl">URL do logo (opcional)</Label>
            <Input
              id="logoUrl"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              disabled={loading}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>

        <hr className="border-border" />

        <Button
          type="button"
          variant={empresa.status === "ativa" ? "destructive" : "outline"}
          disabled={statusLoading}
          onClick={() => void handleToggleStatus()}
        >
          {statusLoading
            ? "Aplicando..."
            : empresa.status === "ativa"
              ? "Inativar empresa"
              : "Reativar empresa"}
        </Button>
      </CardContent>
    </Card>
  );
}
