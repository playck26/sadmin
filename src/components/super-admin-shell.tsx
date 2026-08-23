"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, LogOut, Plus, ShieldCheck } from "lucide-react";
import { clearAccessToken } from "@/lib/auth-storage";

const NAV_ITEMS = [
  { href: "/empresas", label: "Empresas", icon: Building2, exact: true },
  { href: "/empresas/nova", label: "Nova empresa", icon: Plus, exact: false },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearAccessToken();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-background md:pl-[260px]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[260px] flex-col bg-[var(--color-court-dark)] p-4 text-white md:flex">
        <Link href="/empresas" className="flex items-center gap-3 px-1 py-2">
          <span className="flex size-12 items-center justify-center rounded-lg bg-white shadow-lg">
            <Image src="/playck-logo.png" alt="PlayCK" width={42} height={42} className="size-10 object-contain" priority />
          </span>
          <span><strong className="block text-xl leading-none">PlayCK</strong><small className="mt-1 block text-[10px] font-bold tracking-[0.14em] text-white/50 uppercase">Super Admin</small></span>
        </Link>
        <div className="my-6 h-px bg-white/10" />
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href;
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold ${active ? "bg-[var(--color-secondary)] text-[var(--color-court-dark)]" : "text-white/62 hover:bg-white/8 hover:text-white"}`}><Icon className="size-5" />{item.label}</Link>;
          })}
        </nav>
        <div className="mt-auto rounded-lg border border-white/10 bg-white/6 p-3">
          <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-primary)]"><ShieldCheck className="size-5" /></span><span className="text-xs"><strong className="block text-sm">Acesso global</strong><span className="text-white/45">Ambiente PlayCK</span></span></div>
          <button type="button" onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/12 py-2 text-xs font-bold text-white/70 hover:bg-white/8 hover:text-white"><LogOut className="size-4" />Sair</button>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur md:hidden">
        <div className="flex h-16 items-center gap-3 px-4"><Image src="/playck-logo.png" alt="PlayCK" width={38} height={38} className="size-10 rounded-lg bg-white object-contain ring-1 ring-border" /><div className="mr-auto"><strong className="block leading-none">PlayCK</strong><small className="text-[10px] font-bold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">Super Admin</small></div><button type="button" aria-label="Sair" onClick={logout} className="flex size-10 items-center justify-center rounded-lg bg-white text-[var(--color-text-secondary)] ring-1 ring-border"><LogOut className="size-5" /></button></div>
        <nav className="flex gap-2 px-4 pb-2">{NAV_ITEMS.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold ${pathname === item.href ? "bg-[var(--color-primary-strong)] text-white" : "bg-white ring-1 ring-border"}`}><Icon className="size-4" />{item.label}</Link>; })}</nav>
      </header>

      <main className="min-h-screen px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
