"use client";

/**
 * SPEC-018/TASK-006 — a marca do clube na tela.
 *
 * **Até 2026-08-25 a logo era coletada e nunca exibida.** O SAdmin tinha o
 * campo "URL do logo" desde a SPEC-002, duas rotas devolviam `logoUrl`, e
 * nenhum componente a desenhava. Este é o componente que fecha esse buraco.
 *
 * **A fonte da URL é sempre o servidor**, nunca a chave: quem resolve
 * `logo_key` → URL (com o fallback para a `logo_url` antiga, AC-013) é o
 * `LogoDaEmpresaService` no `back`. O frontend não sabe montar chave, e é
 * assim que deve continuar.
 *
 * Duplicado em `admin` e `cliente` (ADR-001, poly-repo).
 */

export interface LogoDaEmpresaProps {
  /** Já resolvida pelo servidor. `null` quando a empresa não tem logo. */
  url: string | null;
  /** Usado no `alt` e para desenhar a inicial quando não há imagem. */
  nome?: string;
  /** Classe do contêiner — quem chama decide o tamanho. */
  className?: string;
}

export function LogoDaEmpresa({
  url,
  nome,
  className = "size-10",
}: LogoDaEmpresaProps) {
  if (url) {
    return (
      // `img` e não `next/image`: o domínio do bucket muda por ambiente, e
      // configurar `remotePatterns` para cada um seria acoplar o build à
      // infraestrutura. A imagem já sai comprimida do navegador de quem a
      // subiu (no máximo 2000px, WebP q90).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={nome ? `Logo ${nome}` : "Logo do clube"}
        className={`${className} rounded-xl object-contain`}
      />
    );
  }

  // **Sem logo não cai para a marca do PlayCK.** O aluno abre o app do
  // clube dele; mostrar a marca de um fornecedor no lugar seria dizer a
  // coisa errada. A inicial do clube é neutra e some assim que houver logo.
  return (
    <span
      aria-hidden={nome ? undefined : true}
      aria-label={nome ? `Logo ${nome}` : undefined}
      role={nome ? "img" : undefined}
      className={`${className} flex items-center justify-center rounded-xl bg-[var(--color-primary-strong)] text-lg font-extrabold text-white`}
    >
      {(nome?.trim().charAt(0) || "•").toUpperCase()}
    </span>
  );
}
