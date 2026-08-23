"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, login } from "@/lib/api-client";
import { saveAccessToken } from "@/lib/auth-storage";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login({ email, senha });
      saveAccessToken(result.accessToken);
      router.push("/empresas");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-w-0 w-full overflow-hidden rounded-[var(--radius-hero)] bg-white p-7 shadow-[var(--shadow-lift)]">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-5 flex size-20 items-center justify-center rounded-xl bg-white shadow-[var(--shadow-low)] ring-1 ring-border"><Image src="/playck-logo.png" alt="PlayCK" width={72} height={72} className="size-[70px] object-contain" priority /></span>
        <p className="text-xs font-bold tracking-[0.15em] text-[var(--color-primary-strong)] uppercase">Super Admin</p>
        <h1 className="mt-2 text-[28px] leading-tight font-extrabold">Controle da plataforma</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Gerencie as empresas que fazem parte da PlayCK.</p>
      </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="h-11 px-4"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={loading}
              className="h-11 px-4"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={loading} className="mt-2 h-12 text-sm font-bold">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
    </div>
  );
}
