export const REPORT_BUNDLE_INTENT_RE =
  /\b(report|summary|analysis|research|benchmark|compare|comparison|pricing|price|cost|cost of living|market|survey|climate|weather|temperature|temp|humidity|rainfall)\b/i;

const REPORT_STOP_WORDS_RE =
  /\b(a|an|the|please|make|create|write|generate|build|prepare|give|show|tell|need|want|me|my|for|with|into|as|artifact|artifacts|report|summary|analysis|research|brief|document|csv|markdown|on|about)\b/gi;

export function slugifyReportStem(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(REPORT_STOP_WORDS_RE, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || "report";
}

export function inferReportBundlePaths(userMessage: string) {
  const stem = slugifyReportStem(userMessage);
  const baseDir = `reports/${stem}`;

  return {
    baseDir,
    reportPath: `${baseDir}/report.md`,
    dataPath: `${baseDir}/data.csv`,
    sourcesPath: `${baseDir}/sources.md`,
    dashboardPath: `${baseDir}/dashboard.html`,
  };
}
