import { TrocarSenhaForm } from "@/components/trocar-senha-form";
import Image from "next/image";

export default function PrimeiroAcessoPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-court-dark)] p-6">
      <span aria-hidden="true" className="court-lines pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative z-10 flex w-full max-w-[420px] flex-col gap-6 rounded-[var(--radius-hero)] border border-border bg-[var(--color-surface)] p-8 shadow-[var(--shadow-lift)]">
        <Image src="/playck-logo.png" alt="PlayCK" width={64} height={64} className="size-16 self-center object-contain" priority />
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
