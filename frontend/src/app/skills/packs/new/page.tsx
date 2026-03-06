"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";

import { useAuth } from "@/auth/clerk";

import { ApiError } from "@/api/mutator";
import { useCreateSkillPackApiV1SkillsPacksPost } from "@/api/generated/skills/skills";
import { MarketplaceSkillForm } from "@/components/skills/MarketplaceSkillForm";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import { useT } from "@/lib/i18n";

export default function NewSkillPackPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isAdmin } = useOrganizationMembership(isSignedIn);
  const t = useT();

  const createMutation = useCreateSkillPackApiV1SkillsPacksPost<ApiError>();

  return (
    <DashboardPageLayout
      signedOut={{
        message: t("skillPack.signInToAdd"),
        forceRedirectUrl: "/skills/packs/new",
      }}
      title={t("skillPack.addPack")}
      description={t("skillPack.addDescription")}
      isAdmin={isAdmin}
      adminOnlyMessage={t("skillPack.adminOnly")}
      stickyHeader
    >
      <MarketplaceSkillForm
        sourceLabel={t("skillPack.packUrl")}
        nameLabel={t("skillPack.nameLabel")}
        descriptionLabel={t("skillPack.descriptionLabel")}
        descriptionPlaceholder={t("skillPack.descriptionPlaceholder")}
        branchLabel={t("skillPack.branchLabel")}
        branchPlaceholder="main"
        showBranch
        requiredUrlMessage={t("skillPack.urlRequired")}
        invalidUrlMessage={t("skillPack.urlInvalid")}
        submitLabel={t("skillPack.addPack")}
        submittingLabel={t("skillPack.adding")}
        isSubmitting={createMutation.isPending}
        onCancel={() => router.push("/skills/packs")}
        onSubmit={async (values) => {
          const result = await createMutation.mutateAsync({
            data: {
              source_url: values.sourceUrl,
              name: values.name || undefined,
              description: values.description || undefined,
              branch: values.branch || "main",
              metadata: {},
            },
          });
          if (result.status !== 200) {
            throw new Error(t("skillPack.unableToAdd"));
          }
          router.push("/skills/packs");
        }}
      />
    </DashboardPageLayout>
  );
}
