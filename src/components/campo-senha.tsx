"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Campo de senha com botão de revelar. Existe porque as três telas novas de
 * SPEC-009 pedem senha (às vezes duas vezes) e repetir o bloco em cada uma
 * faria a regra de acessibilidade e o comportamento divergirem entre elas.
 */
export function CampoSenha({
  id,
  label,
  valor,
  onChange,
  disabled,
  autoComplete = "new-password",
  placeholder = "Mínimo de 8 caracteres",
}: {
  id: string;
  label: string;
  valor: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [mostrar, setMostrar] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]"
          aria-hidden="true"
        />
        <Input
          id={id}
          type={mostrar ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          minLength={8}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="pr-10 pl-10"
        />
        <button
          type="button"
          onClick={() => setMostrar((v) => !v)}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--color-text-secondary)]"
          aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
        >
          {mostrar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
