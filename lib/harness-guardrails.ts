import type {
  ChatActivityEvidenceStrength,
  ChatArtifacts,
} from "@/types/chat";
import type { HarnessToolResult } from "@/lib/harness-protocol";
import { inferReportBundlePaths, REPORT_BUNDLE_INTENT_RE } from "@/lib/report-bundles";

export type TurnIntent =
  | "chat"
  | "factual_answer"
  | "artifact_edit"
  | "data_report";

export interface TurnPolicy {
  intent: TurnIntent;
  requiresEvidence: boolean;
  preferArtifacts: boolean;
  preferReportBundle: boolean;
  requireSourcesFile: boolean;
  traceMode: "verbose";
}

export interface TurnEvidenceSummary {
  strongEvidenceCount: number;
  weakEvidenceCount: number;
  successfulExternalUrls: string[];
  successfulReadPaths: string[];
  successfulArtifactPaths: string[];
}

export type ReportBundleValidationResult =
  | { ok: true }
  | { ok: false; error: string };

const ARTIFACT_EDIT_RE =
  /\b(edit|update|modify|rewrite|revise|change|fix|refactor|rename|replace)\b/i;
const FACTUAL_INTENT_RE =
  /\b(avg|average|temperature|humidity|rainfall|price|pricing|cost|stats?|statistics|benchmark|comparison|compare|climate|metrics?|numbers?|facts?)\b/i;
const ARTIFACT_TARGET_RE =
  /\b(file|artifact|report|csv|dashboard|markdown|document|component|page)\b/i;

function contentHasMarkdownTable(content: string): boolean {
  return /^\|.+\|\s*$/m.test(content) && /^\|\s*[-:| ]+\|\s*$/m.test(content);
}

function contentHasCsvData(content: string): boolean {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  if (lines.length < 2) {
    return false;
  }

  const columnCounts = lines.map((line) => line.split(",").length);
  return columnCounts.every((count) => count > 1 && count === columnCounts[0]);
}

function contentHasRepeatedStructuredRows(content: string): boolean {
  const structuredRows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter(
      (line) =>
        /^[-*]?\s*[A-Za-z][A-Za-z ()/,-]{2,24}\s*[:|-]\s*.*\d/.test(line) ||
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b.*\d/i.test(
          line
        )
    );

  return structuredRows.length >= 3;
}

function contentHasNumericClaims(content: string): boolean {
  if (
    contentHasMarkdownTable(content) ||
    contentHasCsvData(content) ||
    contentHasRepeatedStructuredRows(content)
  ) {
    return true;
  }

  const numericMatches = content.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  return numericMatches.length >= 3;
}

function getSiblingArtifactPath(reportPath: string, filename: string): string {
  return `${reportPath.replace(/\/report\.md$/, "")}/${filename}`;
}

export function classifyTurnIntent(
  userMessage: string,
  hasArtifacts: boolean
): TurnIntent {
  if (ARTIFACT_EDIT_RE.test(userMessage) && (ARTIFACT_TARGET_RE.test(userMessage) || hasArtifacts)) {
    return "artifact_edit";
  }

  if (REPORT_BUNDLE_INTENT_RE.test(userMessage)) {
    return "data_report";
  }

  if (FACTUAL_INTENT_RE.test(userMessage)) {
    return "factual_answer";
  }

  return "chat";
}

export function buildTurnPolicy(
  userMessage: string,
  hasArtifacts: boolean
): TurnPolicy {
  const intent = classifyTurnIntent(userMessage, hasArtifacts);

  return {
    intent,
    requiresEvidence: intent === "data_report" || intent === "factual_answer",
    preferArtifacts: intent === "data_report" || intent === "artifact_edit",
    preferReportBundle: intent === "data_report",
    requireSourcesFile: intent === "data_report",
    traceMode: "verbose",
  };
}

export function createTurnEvidenceSummary(): TurnEvidenceSummary {
  return {
    strongEvidenceCount: 0,
    weakEvidenceCount: 0,
    successfulExternalUrls: [],
    successfulReadPaths: [],
    successfulArtifactPaths: [],
  };
}

export function getToolEvidenceStrength(toolName: string): ChatActivityEvidenceStrength {
  switch (toolName) {
    case "fetch_url":
    case "read_file":
      return "strong";
    case "list_files":
    case "search_files":
      return "weak";
    default:
      return "none";
  }
}

export function recordArtifactSourceEvidence(
  summary: TurnEvidenceSummary,
  paths: string[]
): ChatActivityEvidenceStrength {
  if (paths.length === 0) {
    return "none";
  }

  summary.strongEvidenceCount += 1;
  summary.successfulArtifactPaths.push(...paths);
  return "strong";
}

export function recordToolResultEvidence(
  summary: TurnEvidenceSummary,
  result: HarnessToolResult
): ChatActivityEvidenceStrength {
  if (!result.ok) {
    return "none";
  }

  const strength = getToolEvidenceStrength(result.name);

  if (strength === "strong") {
    summary.strongEvidenceCount += 1;
  } else if (strength === "weak") {
    summary.weakEvidenceCount += 1;
  }

  if (result.name === "fetch_url" && typeof result.input.url === "string") {
    summary.successfulExternalUrls.push(result.input.url);
  }

  if (result.name === "read_file" && typeof result.input.path === "string") {
    summary.successfulReadPaths.push(result.input.path);
  }

  return strength;
}

export function validateReportBundle(params: {
  userMessage: string;
  artifacts: ChatArtifacts;
  changedPaths: string[];
  evidence: TurnEvidenceSummary;
}): ReportBundleValidationResult {
  const canonical = inferReportBundlePaths(params.userMessage);
  const reportPath =
    params.changedPaths.find(
      (path) => path.startsWith("reports/") && path.endsWith("/report.md")
    ) ?? canonical.reportPath;
  const reportFile = params.artifacts.files[reportPath];

  if (!reportFile) {
    return {
      ok: false,
      error:
        "This request is a data-backed report. Finalize with explicit artifact files and include a canonical `reports/<topic>/report.md` file.",
    };
  }

  const dataPath = getSiblingArtifactPath(reportPath, "data.csv");
  const sourcesPath = getSiblingArtifactPath(reportPath, "sources.md");
  const dashboardHtmlPath = getSiblingArtifactPath(reportPath, "dashboard.html");
  const dashboardTsxPath = getSiblingArtifactPath(reportPath, "dashboard.tsx");
  const reportContent = reportFile.content;
  const hasCsv = Boolean(params.artifacts.files[dataPath]);
  const hasSources = Boolean(params.artifacts.files[sourcesPath]);
  const hasDashboard =
    Boolean(params.artifacts.files[dashboardHtmlPath]) ||
    Boolean(params.artifacts.files[dashboardTsxPath]);
  const hasValidMermaid = /```mermaid[\s\S]*?```/i.test(reportContent);
  const hasFakeDashboard =
    /\[mermaid\]/i.test(reportContent) ||
    /```markdown[\s\S]*?\[mermaid\]/i.test(reportContent);

  if (
    (contentHasMarkdownTable(reportContent) ||
      contentHasRepeatedStructuredRows(reportContent)) &&
    !hasCsv
  ) {
    return {
      ok: false,
      error: `This report bundle is missing "${dataPath}". When the report contains structured tables or numeric rows, include a sibling CSV artifact.`,
    };
  }

  if (params.evidence.successfulExternalUrls.length > 0 && !hasSources) {
    return {
      ok: false,
      error: `This report bundle is missing "${sourcesPath}". When external URLs are fetched successfully during the turn, include a sibling sources file for provenance.`,
    };
  }

  if (hasFakeDashboard && !hasDashboard && !hasValidMermaid) {
    return {
      ok: false,
      error:
        "The report includes pseudo-dashboard markup like `[mermaid]`. Use a standard fenced ```mermaid block in `report.md`, or create a real `dashboard.html` or `dashboard.tsx` artifact.",
    };
  }

  return { ok: true };
}

export function validateTurnFinalization(params: {
  policy: TurnPolicy;
  userMessage: string;
  evidence: TurnEvidenceSummary;
  content: string;
  artifacts: ChatArtifacts;
  changedPaths: string[];
  hasExplicitArtifacts: boolean;
}): { ok: true } | { ok: false; error: string } {
  const hasStrongEvidence = params.evidence.strongEvidenceCount > 0;
  const contentRequiresEvidence =
    params.policy.intent === "data_report" ||
    (params.policy.intent === "factual_answer" && contentHasNumericClaims(params.content));

  if (contentRequiresEvidence && !hasStrongEvidence) {
    return {
      ok: false,
      error:
        "This turn is making factual numeric or report-style claims without any strong evidence-gathering step. Request context first with `fetch_url`, `read_file`, or `<artifact-request ... />`, then finalize.",
    };
  }

  if (params.policy.preferReportBundle && !params.hasExplicitArtifacts) {
    return {
      ok: false,
      error:
        "This request is a data-backed report. Finalize with explicit artifact files instead of plain prose. Create at least `reports/<topic>/report.md`, and add `data.csv` when you present structured values.",
    };
  }

  if (params.policy.preferReportBundle) {
    return validateReportBundle({
      userMessage: params.userMessage,
      artifacts: params.artifacts,
      changedPaths: params.changedPaths,
      evidence: params.evidence,
    });
  }

  return { ok: true };
}
