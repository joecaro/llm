export type HarnessToolName =
  | "list_files"
  | "search_files"
  | "read_file"
  | "run_command"
  | "fetch_url";

export interface HarnessToolCall {
  name: HarnessToolName | string;
  input: Record<string, unknown>;
}

export interface HarnessToolResult {
  name: string;
  input: Record<string, unknown>;
  ok: boolean;
  output?: string;
  error?: string;
  durationMs?: number;
}

const TOOL_DEFINITIONS: Array<{
  name: HarnessToolName;
  summary: string;
  example: Record<string, unknown>;
}> = [
  {
    name: "list_files",
    summary: "List files in the workspace or a subdirectory.",
    example: { path: "lib", glob: ["**/*.ts"], maxResults: 100 },
  },
  {
    name: "search_files",
    summary: "Search the workspace with ripgrep and return matching lines.",
    example: {
      pattern: "runHarnessAwareTurn",
      path: "lib",
      literal: true,
      maxResults: 30,
    },
  },
  {
    name: "read_file",
    summary: "Read a file, optionally limited to a line range.",
    example: { path: "lib/prompt.txt", startLine: 1, endLine: 120 },
  },
  {
    name: "run_command",
    summary: "Run an allowed local command inside the workspace.",
    example: { command: "yarn", args: ["lint"], cwd: ".", timeoutMs: 20000 },
  },
  {
    name: "fetch_url",
    summary: "Fetch a specific URL and extract readable text.",
    example: { url: "https://nextjs.org/docs", maxChars: 8000 },
  },
];

function renderJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}

export function buildHarnessToolManifest(): string {
  const toolLines = TOOL_DEFINITIONS.flatMap((tool) => [
    `- \`${tool.name}\`: ${tool.summary}`,
    `  Example:`,
    "  ```json",
    `  ${renderJson(tool.example).replace(/\n/g, "\n  ")}`,
    "  ```",
  ]);

  return [
    "## Context Harness",
    "You can gather additional context before giving a final answer.",
    "Use request-only mode when you need more information from artifacts, local files, commands, or direct URLs.",
    "",
    "### Request-Only Mode",
    'A request-only response may contain only `<artifact-request path="..." />` tags and/or `<tool-call name="...">{"..."}</tool-call>` blocks.',
    "Do not include prose, `<artifact>` writes, or `<artifact-replace>` edits in the same response.",
    "Tool-call bodies must be valid JSON objects.",
    "",
    "### Available Tools",
    ...toolLines,
    "",
    "Use tools to gather context.",
    "Use artifacts to persist deliverables such as reports, CSVs, and markdown documents with Mermaid diagrams.",
    "For data-backed analysis or research reports, prefer a small bundle such as `reports/<topic>/report.md` plus `reports/<topic>/data.csv` when structured values are available.",
    "For factual or data-backed work, gather context before making numeric claims, monthly tables, or comparisons.",
    "If you successfully fetch external URLs for a report, include `reports/<topic>/sources.md` for provenance.",
    "Do not invent structured datasets. If the source data is incomplete, gather more context or give a sourced prose summary instead.",
    "Use standard fenced ` ```mermaid ` blocks for Mermaid diagrams. Do not use placeholder syntax like `[mermaid]`.",
  ].join("\n");
}

export function buildHarnessProtocolError(error: string): string {
  return [
    "The previous harness response was invalid.",
    error,
    "Choose exactly one mode per response:",
    '1. Request-only mode with any mix of `<artifact-request path="..." />` and `<tool-call name="...">{"..."}</tool-call>`.',
    '2. Final mode with prose and/or `<artifact path="...">...</artifact>` or `<artifact-replace ...>...</artifact-replace>`.',
    "Do not mix request-only mode with prose or artifact writes.",
    "Use `<artifact-request ... />` only for files that already exist in the current artifact manifest.",
    "Tool-call bodies must be valid JSON objects.",
  ].join("\n");
}

export function buildHarnessToolResultsContext(
  results: HarnessToolResult[]
): string {
  if (results.length === 0) {
    return "No tool results were returned.";
  }

  const blocks = results.map((result) => {
    const payload = result.ok
      ? result.output ?? ""
      : result.error ?? "Tool execution failed.";

    return [
      `<tool-result name="${result.name}" ok="${result.ok ? "true" : "false"}">`,
      "Input:",
      renderJson(result.input),
      "",
      result.ok ? "Output:" : "Error:",
      payload,
      "</tool-result>",
    ].join("\n");
  });

  return [
    "Here are the requested tool results. You may request more context, or produce the final answer and any artifact updates.",
    ...blocks,
  ].join("\n\n");
}
