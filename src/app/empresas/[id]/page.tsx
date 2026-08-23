import { CompanyAdminsCard } from "@/components/company-admins-card";
import { EditCompanyForm } from "@/components/edit-company-form";

export default async function EditarEmpresaPage({ params }: PageProps<"/empresas/[id]">) {
  const { id } = await params;

  return (
    <div className="flex flex-col items-center gap-6 py-2 md:py-6">
      <EditCompanyForm id={id} />
      {/* SPEC-016 — a recuperação de acesso do gestor vive aqui, e não numa
          tela própria: quem precisa dela já está olhando a empresa. */}
      <div className="w-full max-w-2xl">
        <CompanyAdminsCard companyId={id} />
      </div>
    </div>
  );
}
