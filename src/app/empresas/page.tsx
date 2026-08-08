import { CompaniesList } from "@/components/companies-list";

export default function EmpresasPage() {
  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <CompaniesList />
      </div>
    </main>
  );
}
