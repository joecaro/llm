export type HarnessToolName =
  | "list_files"
  | "search_files"
  | "read_file"
  | "run_command"
  | "web_search"
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
    name: "web_search",
    summary: "Search the web through an optional configured provider.",
    example: { query: "latest Next.js app router docs", maxResults: 5 },
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
    "Use request-only mode when you need more information from artifacts, local files, commands, or the web.",
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
