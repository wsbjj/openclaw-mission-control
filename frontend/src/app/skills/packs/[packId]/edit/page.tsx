"use client";

export const dynamic = "force-dynamic";

import { useParams, useRouter } from "next/navigation";

import { useAuth } from "@/auth/clerk";

import { ApiError } from "@/api/mutator";
import {
  type getSkillPackApiV1SkillsPacksPackIdGetResponse,
  useGetSkillPackApiV1SkillsPacksPackIdGet,
  useUpdateSkillPackApiV1SkillsPacksPackIdPatch,
} from "@/api/generated/skills/skills";
import { MarketplaceSkillForm } from "@/components/skills/MarketplaceSkillForm";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import { useT } from "@/lib/i18n";

export default function EditSkillPackPage() {
  const router = useRouter();
  const params = useParams();
  const { isSignedIn } = useAuth();
  const { isAdmin } = useOrganizationMembership(isSignedIn);
  const t = useT();

  const packIdParam = params?.packId;
  const packId = Array.isArray(packIdParam) ? packIdParam[0] : packIdParam;

  const packQuery = useGetSkillPackApiV1SkillsPacksPackIdGet<
    getSkillPackApiV1SkillsPacksPackIdGetResponse,
    ApiError
  >(packId ?? "", {
    query: {
      enabled: Boolean(isSignedIn && isAdmin && packId),
      refetchOnMount: "always",
      retry: false,
    },
  });

  const pack = packQuery.data?.status === 200 ? packQuery.data.data : null;

  const saveMutation =
    useUpdateSkillPackApiV1SkillsPacksPackIdPatch<ApiError>();

  return (
    <DashboardPageLayout
      signedOut={{
        message: t("skillPack.signInToEdit"),
        forceRedirectUrl: `/skills/packs/${packId ?? ""}/edit`,
      }}
      title={pack ? t("skillPack.editPackNamed", { name: pack.name }) : t("skillPack.editPack")}
      description={t("skillPack.editDescription")}
      isAdmin={isAdmin}
      adminOnlyMessage={t("skillPack.adminOnly")}
      stickyHeader
    >
      {packQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          {t("skillPack.loadingPack")}
        </div>
      ) : packQuery.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          {packQuery.error.message}
        </div>
      ) : !pack ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          {t("skillPack.packNotFound")}
        </div>
      ) : (
        <MarketplaceSkillForm
          key={pack.id}
          initialValues={{
            sourceUrl: pack.source_url,
            name: pack.name,
            description: pack.description ?? "",
            branch: pack.branch || "main",
          }}
          sourceLabel={t("skillPack.packUrl")}
          nameLabel={t("skillPack.nameLabel")}
          descriptionLabel={t("skillPack.descriptionLabel")}
          branchLabel={t("skillPack.branchLabel")}
          branchPlaceholder="main"
          showBranch
          descriptionPlaceholder={t("skillPack.descriptionPlaceholder")}
          requiredUrlMessage={t("skillPack.urlRequired")}
          invalidUrlMessage={t("skillPack.urlInvalid")}
          submitLabel={t("skillPack.saveChanges")}
          submittingLabel={t("skillPack.saving")}
          isSubmitting={saveMutation.isPending}
          onCancel={() => router.push("/skills/packs")}
          onSubmit={async (values) => {
            const result = await saveMutation.mutateAsync({
              packId: pack.id,
              data: {
                source_url: values.sourceUrl,
                name: values.name || undefined,
                description: values.description || undefined,
                branch: values.branch || "main",
                metadata: pack.metadata || {},
              },
            });
            if (result.status !== 200) {
              throw new Error(t("skillPack.unableToUpdate"));
            }
            router.push("/skills/packs");
          }}
        />
      )}
    </DashboardPageLayout>
  );
}
