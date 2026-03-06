"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";

import { useAuth } from "@/auth/clerk";

import { ApiError } from "@/api/mutator";
import { useCreateTagApiV1TagsPost } from "@/api/generated/tags/tags";
import { TagForm } from "@/components/tags/TagForm";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import { useT } from "@/lib/i18n";

export default function NewTagPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isAdmin } = useOrganizationMembership(isSignedIn);
  const t = useT();

  const createMutation = useCreateTagApiV1TagsPost<ApiError>({
    mutation: {
      retry: false,
    },
  });

  return (
    <DashboardPageLayout
      signedOut={{
        message: t("tag.signInToCreate"),
        forceRedirectUrl: "/tags/add",
        signUpForceRedirectUrl: "/tags/add",
      }}
      title={t("tag.createTag")}
      description={t("tag.createDescription")}
      isAdmin={isAdmin}
      adminOnlyMessage={t("tag.adminOnly")}
    >
      <TagForm
        isSubmitting={createMutation.isPending}
        submitLabel={t("tag.createTag")}
        submittingLabel={t("tag.creating")}
        onCancel={() => router.push("/tags")}
        onSubmit={async (values) => {
          const result = await createMutation.mutateAsync({
            data: values,
          });
          if (result.status !== 200) {
            throw new Error(t("tag.unableToCreate"));
          }
          router.push("/tags");
        }}
      />
    </DashboardPageLayout>
  );
}
