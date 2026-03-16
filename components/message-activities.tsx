"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  CircleAlert,
  CircleCheckBig,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ChatActivityEvent,
  ChatActivityEvidenceStrength,
} from "@/types/chat";

const DETAIL_PREVIEW_LIMIT = 1600;

function truncate(value: string, maxLength = DETAIL_PREVIEW_LIMIT): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n...truncated ${value.length - maxLength} characters`;
}

function formatDuration(durationMs?: number): string | null {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) {
    return null;
  }

  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  if (durationMs < 10000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  return `${Math.round(durationMs / 1000)}s`;
}

function formatTimestamp(value?: number): string | null {
  if (typeof value !== "number") {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function getActivityIcon(activity: ChatActivityEvent) {
  if (activity.status === "failed") {
    return <CircleAlert className="w-4 h-4 text-destructive shrink-0" />;
  }

  if (activity.status === "completed") {
    return <CircleCheckBig className="w-4 h-4 text-emerald-600 shrink-0" />;
  }

  return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />;
}

function getStatusLabel(activity: ChatActivityEvent): string {
  switch (activity.status) {
    case "running":
      return "Running";
    case "completed":
      return "Done";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
    default:
      return activity.status;
  }
}

function getSummaryActivity(
  activities: ChatActivityEvent[]
): ChatActivityEvent | undefined {
  return (
    [...activities].reverse().find((activity) => activity.status === "running") ??
    [...activities].reverse().find((activity) => activity.kind === "finalize") ??
    activities[activities.length - 1]
  );
}

function stringifyDetail(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getEvidenceBadge(strength?: ChatActivityEvidenceStrength) {
  switch (strength) {
    case "strong":
      return {
        label: "Strong evidence",
        className: "border-sky-500/30 bg-sky-500/10 text-sky-700",
      };
    case "weak":
      return {
        label: "Weak evidence",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700",
      };
    default:
      return null;
  }
}

function getEvidenceRowTone(strength?: ChatActivityEvidenceStrength): string {
  switch (strength) {
    case "strong":
      return "border-sky-500/20 bg-sky-500/5";
    case "weak":
      return "border-amber-500/20 bg-amber-500/5";
    default:
      return "border-border/80 bg-background/40";
  }
}

type ActivityGroup = {
  id: string;
  label: string;
  activities: ChatActivityEvent[];
};

function groupActivities(activities: ChatActivityEvent[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  const groupMap = new Map<string, ActivityGroup>();

  for (const activity of activities) {
    const isFinalization = activity.kind === "finalize";
    const attemptLabel =
      activity.detail?.attemptLabel ??
      (typeof activity.detail?.pass === "number"
        ? `Attempt ${activity.detail.pass}`
        : null);
    const key = isFinalization
      ? "finalization"
      : attemptLabel
        ? `attempt:${attemptLabel}`
        : "activity";
    const label = isFinalization ? "Finalization" : attemptLabel ?? "Activity";
    const existing = groupMap.get(key);

    if (existing) {
      existing.activities.push(activity);
      continue;
    }

    const group = {
      id: key,
      label,
      activities: [activity],
    };
    groupMap.set(key, group);
    groups.push(group);
  }

  return groups;
}

function ActivityDetailBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = value.length > DETAIL_PREVIEW_LIMIT;
  const displayValue = expanded ? value : truncate(value);

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <pre className="overflow-x-auto rounded-md border border-border/80 bg-background/70 p-3 text-xs whitespace-pre-wrap break-words">
        {displayValue}
      </pre>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="text-xs text-primary underline underline-offset-2"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function ActivityRow({ activity }: { activity: ChatActivityEvent }) {
  const evidenceBadge = getEvidenceBadge(activity.detail?.evidenceStrength);
  const duration = formatDuration(
    activity.detail?.durationMs ??
      (typeof activity.endedAt === "number"
        ? activity.endedAt - activity.startedAt
        : undefined)
  );
  const startedAt = formatTimestamp(activity.startedAt);
  const endedAt = formatTimestamp(activity.endedAt);
  const input = stringifyDetail(activity.detail?.input);
  const output = stringifyDetail(activity.detail?.output);
  const error = stringifyDetail(activity.detail?.error);
  const artifactPaths = activity.detail?.artifactPaths?.length
    ? activity.detail.artifactPaths.join("\n")
    : null;
  const hasRawDetails = Boolean(input || output || error || artifactPaths);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-3",
        getEvidenceRowTone(activity.detail?.evidenceStrength)
      )}
    >
      <div className="flex items-start gap-3">
        {getActivityIcon(activity)}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-primary">{activity.label}</span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                activity.status === "failed"
                  ? "border-destructive/40 text-destructive"
                  : activity.status === "completed"
                    ? "border-emerald-600/30 text-emerald-700"
                    : "border-border text-muted-foreground"
              )}
            >
              {getStatusLabel(activity)}
            </span>
            {activity.detail?.toolName && (
              <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-primary">
                {activity.detail.toolName}
              </code>
            )}
            {evidenceBadge && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  evidenceBadge.className
                )}
              >
                {evidenceBadge.label}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {startedAt && <span>Started {startedAt}</span>}
            {endedAt && activity.endedAt && <span>Ended {endedAt}</span>}
            {duration && <span>Duration {duration}</span>}
          </div>
        </div>
      </div>

      {hasRawDetails && (
        <details className="group rounded-md border border-border/70 bg-muted/20">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground">
            Raw details
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 border-t border-border/70 px-3 py-3">
            {artifactPaths && <ActivityDetailBlock label="Artifacts" value={artifactPaths} />}
            {input && <ActivityDetailBlock label="Input" value={input} />}
            {output && <ActivityDetailBlock label="Output" value={output} />}
            {error && <ActivityDetailBlock label="Error" value={error} />}
          </div>
        </details>
      )}
    </div>
  );
}

export function MessageActivities({
  activities,
}: {
  activities?: ChatActivityEvent[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedActivities = useMemo(
    () => (activities ?? []).filter(Boolean),
    [activities]
  );

  if (normalizedActivities.length === 0) {
    return null;
  }

  const summaryActivity = getSummaryActivity(normalizedActivities);
  const latestActivity = normalizedActivities[normalizedActivities.length - 1];
  const runningCount = normalizedActivities.filter(
    (activity) => activity.status === "running"
  ).length;
  const completedCount = normalizedActivities.filter(
    (activity) => activity.status === "completed"
  ).length;
  const retryCount = normalizedActivities.filter(
    (activity) => activity.kind === "protocol_retry"
  ).length;
  const strongEvidenceCount = normalizedActivities.filter(
    (activity) => activity.detail?.evidenceStrength === "strong"
  ).length;
  const weakEvidenceCount = normalizedActivities.filter(
    (activity) => activity.detail?.evidenceStrength === "weak"
  ).length;
  const hasFailure = normalizedActivities.some(
    (activity) => activity.status === "failed"
  );
  const hasRecovered = Boolean(
    hasFailure && summaryActivity?.kind === "finalize" && summaryActivity.status === "completed"
  );
  const expanded = isOpen || hasFailure || retryCount > 0;
  const groupedActivities = groupActivities(normalizedActivities);
  const summaryLabel = summaryActivity
    ? summaryActivity.status === "running"
      ? `${summaryActivity.label}...`
      : hasRecovered
        ? "Completed after retries"
        : summaryActivity.status === "completed"
          ? summaryActivity.label
          : latestActivity?.status === "failed"
            ? `${latestActivity.label} failed`
            : summaryActivity.label
    : "Working";

  const summaryMeta = [
    `${normalizedActivities.length} step${normalizedActivities.length === 1 ? "" : "s"}`,
    retryCount > 0 ? `${retryCount} retr${retryCount === 1 ? "y" : "ies"}` : null,
    completedCount > 0 ? `${completedCount} done` : null,
    strongEvidenceCount > 0
      ? `${strongEvidenceCount} strong evidence`
      : null,
    weakEvidenceCount > 0 ? `${weakEvidenceCount} weak evidence` : null,
    !hasRecovered && hasFailure ? "attention needed" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-lg border border-border/80 bg-muted/35 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        {summaryActivity ? (
          getActivityIcon(summaryActivity)
        ) : (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-primary">{summaryLabel}</div>
          <div className="text-xs text-muted-foreground">
            {runningCount > 0 ? `${summaryMeta}, ${runningCount} active` : summaryMeta}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border/80 px-3 py-3">
          {groupedActivities.map((group) => (
            <section key={group.id} className="space-y-3">
              <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {group.label}
              </div>
              {group.activities.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
