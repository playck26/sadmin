import { EditCompanyForm } from "@/components/edit-company-form";

export default async function EditarEmpresaPage({ params }: PageProps<"/empresas/[id]">) {
  const { id } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <EditCompanyForm id={id} />
    </main>
  );
}
