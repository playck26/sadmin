import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-court-dark)] p-4">
      <span aria-hidden="true" className="court-lines pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative z-10 min-w-0 w-full max-w-sm"><LoginForm /></div>
    </main>
  );
}
