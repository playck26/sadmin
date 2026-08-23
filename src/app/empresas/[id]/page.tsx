import { EditCompanyForm } from "@/components/edit-company-form";

export default async function EditarEmpresaPage({ params }: PageProps<"/empresas/[id]">) {
  const { id } = await params;

  return (
    <div className="flex justify-center py-2 md:py-6">
      <EditCompanyForm id={id} />
    </div>
  );
}
