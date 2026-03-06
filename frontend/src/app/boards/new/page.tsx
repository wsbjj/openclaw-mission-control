"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/auth/clerk";

import { ApiError } from "@/api/mutator";
import { useCreateBoardApiV1BoardsPost } from "@/api/generated/boards/boards";
import {
  type listBoardGroupsApiV1BoardGroupsGetResponse,
  useListBoardGroupsApiV1BoardGroupsGet,
} from "@/api/generated/board-groups/board-groups";
import {
  type listGatewaysApiV1GatewaysGetResponse,
  useListGatewaysApiV1GatewaysGet,
} from "@/api/generated/gateways/gateways";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import type { BoardGroupRead } from "@/api/generated/model";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "board";

export default function NewBoardPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const t = useT();

  const { isAdmin } = useOrganizationMembership(isSignedIn);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gatewayId, setGatewayId] = useState<string>("");
  const [boardGroupId, setBoardGroupId] = useState<string>("none");

  const [error, setError] = useState<string | null>(null);

  const gatewaysQuery = useListGatewaysApiV1GatewaysGet<
    listGatewaysApiV1GatewaysGetResponse,
    ApiError
  >(undefined, {
    query: {
      enabled: Boolean(isSignedIn && isAdmin),
      refetchOnMount: "always",
      retry: false,
    },
  });

  const groupsQuery = useListBoardGroupsApiV1BoardGroupsGet<
    listBoardGroupsApiV1BoardGroupsGetResponse,
    ApiError
  >(undefined, {
    query: {
      enabled: Boolean(isSignedIn && isAdmin),
      refetchOnMount: "always",
      retry: false,
    },
  });

  const createBoardMutation = useCreateBoardApiV1BoardsPost<ApiError>({
    mutation: {
      onSuccess: (result) => {
        if (result.status === 200) {
          router.push(`/boards/${result.data.id}/edit?onboarding=1`);
        }
      },
      onError: (err) => {
        setError(err.message || t("board.somethingWentWrong"));
      },
    },
  });

  const gateways = useMemo(() => {
    if (gatewaysQuery.data?.status !== 200) return [];
    return gatewaysQuery.data.data.items ?? [];
  }, [gatewaysQuery.data]);
  const groups = useMemo<BoardGroupRead[]>(() => {
    if (groupsQuery.data?.status !== 200) return [];
    return groupsQuery.data.data.items ?? [];
  }, [groupsQuery.data]);
  const displayGatewayId = gatewayId || gateways[0]?.id || "";
  const isLoading =
    gatewaysQuery.isLoading ||
    groupsQuery.isLoading ||
    createBoardMutation.isPending;
  const errorMessage =
    error ?? gatewaysQuery.error?.message ?? groupsQuery.error?.message ?? null;

  const isFormReady = Boolean(
    name.trim() && description.trim() && displayGatewayId,
  );

  const gatewayOptions = useMemo(
    () =>
      gateways.map((gateway) => ({ value: gateway.id, label: gateway.name })),
    [gateways],
  );

  const groupOptions = useMemo(
    () => [
      { value: "none", label: t("board.noGroup") },
      ...groups.map((group) => ({ value: group.id, label: group.name })),
    ],
    [groups, t],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSignedIn) return;
    const trimmedName = name.trim();
    const resolvedGatewayId = displayGatewayId;
    if (!trimmedName) {
      setError(t("board.nameRequired"));
      return;
    }
    if (!resolvedGatewayId) {
      setError(t("board.selectGateway"));
      return;
    }
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setError(t("board.descriptionRequired"));
      return;
    }

    setError(null);

    createBoardMutation.mutate({
      data: {
        name: trimmedName,
        slug: slugify(trimmedName),
        description: trimmedDescription,
        gateway_id: resolvedGatewayId,
        board_group_id: boardGroupId === "none" ? null : boardGroupId,
      },
    });
  };

  return (
    <DashboardPageLayout
      signedOut={{
        message: t("board.signInToCreate"),
        forceRedirectUrl: "/boards/new",
        signUpForceRedirectUrl: "/boards/new",
      }}
      title={t("board.createBoard")}
      description={t("board.createDescription")}
      isAdmin={isAdmin}
      adminOnlyMessage={t("board.adminOnly")}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">
                {t("board.boardName")} <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("board.boardNamePlaceholder")}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">
                {t("board.gateway")} <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                ariaLabel={t("board.selectGatewayAria")}
                value={displayGatewayId}
                onValueChange={setGatewayId}
                options={gatewayOptions}
                placeholder={t("board.selectGateway")}
                searchPlaceholder={t("board.searchGateways")}
                emptyMessage={t("board.noGatewaysFound")}
                triggerClassName="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                contentClassName="rounded-xl border border-slate-200 shadow-lg"
                itemClassName="px-4 py-3 text-sm text-slate-700 data-[selected=true]:bg-slate-50 data-[selected=true]:text-slate-900"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">
                {t("board.boardGroup")}
              </label>
              <SearchableSelect
                ariaLabel={t("board.selectBoardGroupAria")}
                value={boardGroupId}
                onValueChange={setBoardGroupId}
                options={groupOptions}
                placeholder={t("board.noGroup")}
                searchPlaceholder={t("board.searchGroups")}
                emptyMessage={t("board.noGroupsFound")}
                triggerClassName="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                contentClassName="rounded-xl border border-slate-200 shadow-lg"
                itemClassName="px-4 py-3 text-sm text-slate-700 data-[selected=true]:bg-slate-50 data-[selected=true]:text-slate-900"
                disabled={isLoading}
              />
              <p className="text-xs text-slate-500">
                {t("board.boardGroupHint")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">
              {t("board.description")} <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("board.descriptionPlaceholder")}
              className="min-h-[120px]"
              disabled={isLoading}
            />
          </div>
        </div>

        {gateways.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p>
              {t("board.noGatewaysAvailable")}{" "}
              <Link
                href="/gateways"
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                {t("board.gatewaysLink")}
              </Link>{" "}
              {t("board.toContinue")}
            </p>
          </div>
        ) : null}

        {errorMessage ? (
          <p className="text-sm text-red-500">{errorMessage}</p>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/boards")}
            disabled={isLoading}
          >
            {t("board.cancel")}
          </Button>
          <Button type="submit" disabled={isLoading || !isFormReady}>
            {isLoading ? t("board.creating") : t("board.createBoard")}
          </Button>
        </div>
      </form>
    </DashboardPageLayout>
  );
}
