import { TrocarSenhaForm } from "@/components/trocar-senha-form";

export default function PrimeiroAcessoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-xl border border-border bg-[var(--color-surface)] p-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Crie sua senha</h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Escolha uma senha sua para continuar. A anterior deixa de valer e
            as outras sessoes sao encerradas.
          </p>
        </div>
        <TrocarSenhaForm destino="/empresas" />
      </div>
    </main>
  );
}
