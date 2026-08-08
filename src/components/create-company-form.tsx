"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, createCompany } from "@/lib/api-client";

export function CreateCompanyForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [esportes, setEsportes] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [adminNome, setAdminNome] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminSenha, setAdminSenha] = useState("");
  const [adminTelefone, setAdminTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createCompany({
        nome,
        esportes: esportes
          .split(",")
          .map((esporte) => esporte.trim())
          .filter(Boolean),
        logoUrl: logoUrl || undefined,
        adminInicial: {
          nome: adminNome,
          email: adminEmail,
          senha: adminSenha,
          telefone: adminTelefone || undefined,
        },
      });
      router.push("/empresas");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar a empresa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Nova empresa</CardTitle>
        <CardDescription>Cadastra a empresa e o primeiro admin dela juntos</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome da empresa</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} disabled={loading} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="esportes">Esportes (separados por vírgula)</Label>
            <Input
              id="esportes"
              placeholder="tenis, padel"
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

          <hr className="border-border" />
          <p className="text-sm font-medium text-foreground">Admin inicial</p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="adminNome">Nome</Label>
            <Input
              id="adminNome"
              required
              value={adminNome}
              onChange={(e) => setAdminNome(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adminEmail">Email</Label>
            <Input
              id="adminEmail"
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adminSenha">Senha</Label>
            <Input
              id="adminSenha"
              type="password"
              required
              minLength={8}
              value={adminSenha}
              onChange={(e) => setAdminSenha(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adminTelefone">Telefone (opcional)</Label>
            <Input
              id="adminTelefone"
              value={adminTelefone}
              onChange={(e) => setAdminTelefone(e.target.value)}
              disabled={loading}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Criando..." : "Criar empresa"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
