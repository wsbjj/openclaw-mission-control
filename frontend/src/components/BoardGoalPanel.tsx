"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { parseApiDatetime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

type BoardGoal = {
  board_type?: string;
  objective?: string | null;
  success_metrics?: Record<string, unknown> | null;
  target_date?: string | null;
  goal_confirmed?: boolean;
};

type BoardGoalPanelProps = {
  board?: BoardGoal | null;
  onStartOnboarding?: () => void;
  onEdit?: () => void;
};

const formatTargetDate = (value?: string | null) => {
  if (!value) return "—";
  const date = parseApiDatetime(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function BoardGoalPanel({
  board,
  onStartOnboarding,
  onEdit,
}: BoardGoalPanelProps) {
  const t = useT();
  const metricsEntries = (() => {
    if (!board?.success_metrics) return [];
    if (Array.isArray(board.success_metrics)) {
      return board.success_metrics.map((value, index) => [
        `${t("goalPanel.metric")} ${index + 1}`,
        value,
      ]);
    }
    if (typeof board.success_metrics === "object") {
      return Object.entries(board.success_metrics);
    }
    return [[t("goalPanel.metric"), board.success_metrics]];
  })();

  const isGoalBoard = board?.board_type !== "general";
  const isConfirmed = Boolean(board?.goal_confirmed);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 border-b border-[color:var(--border)] pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("goalPanel.boardGoal")}
            </p>
            <p className="mt-1 text-lg font-semibold text-strong">
              {board ? t("goalPanel.missionOverview") : t("goalPanel.loadingBoardGoal")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {board ? (
              <>
                <Badge variant={isGoalBoard ? "accent" : "outline"}>
                  {isGoalBoard ? t("goalPanel.goalBoard") : t("goalPanel.generalBoard")}
                </Badge>
                {isGoalBoard ? (
                  <Badge variant={isConfirmed ? "success" : "warning"}>
                    {isConfirmed ? t("goalPanel.confirmed") : t("goalPanel.needsConfirmation")}
                  </Badge>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        {board ? (
          <p className="text-sm text-muted">
            {isGoalBoard
              ? t("goalPanel.goalBoardDesc")
              : t("goalPanel.generalBoardDesc")}
          </p>
        ) : (
          <div className="h-4 w-32 animate-pulse rounded-full bg-[color:var(--surface-muted)]" />
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t("goalPanel.objective")}
          </p>
          <p
            className={cn(
              "text-sm",
              board?.objective ? "text-strong" : "text-muted",
            )}
          >
            {board?.objective ||
              (isGoalBoard ? t("goalPanel.noObjectiveYet") : t("goalPanel.notRequired"))}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t("goalPanel.successMetrics")}
          </p>
          {metricsEntries.length > 0 ? (
            <ul className="space-y-1 text-sm text-strong">
              {metricsEntries.map(([key, value]) => (
                <li key={`${key}`} className="flex gap-2">
                  <span className="font-medium text-strong">{key}:</span>
                  <span className="text-muted">{String(value)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              {isGoalBoard ? t("goalPanel.noMetricsDefinedYet") : t("goalPanel.notRequired")}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t("goalPanel.targetDate")}
          </p>
          <p className="text-sm text-strong">
            {formatTargetDate(board?.target_date)}
          </p>
        </div>
        {onStartOnboarding || onEdit ? (
          <div className="flex flex-wrap gap-2">
            {onStartOnboarding && isGoalBoard && !isConfirmed ? (
              <Button variant="primary" onClick={onStartOnboarding}>
                {t("goalPanel.startOnboarding")}
              </Button>
            ) : null}
            {onEdit ? (
              <Button variant="secondary" onClick={onEdit}>
                {t("goalPanel.editBoard")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default BoardGoalPanel;
