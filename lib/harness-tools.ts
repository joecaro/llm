import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { HarnessToolCall, HarnessToolResult } from "@/lib/harness-protocol";

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = process.cwd();
const MAX_RESULTS_DEFAULT = 60;
const MAX_RESULT_LINES = 200;
const MAX_OUTPUT_CHARS = 16000;
const ALLOWED_COMMANDS = new Set([
  "bash",
  "bun",
  "git",
  "node",
  "npm",
  "pnpm",
  "python",
  "python3",
  "rg",
  "sh",
  "uv",
  "yarn",
]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function getString(
  input: Record<string, unknown>,
  key: string,
  fallback?: string
): string {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value : fallback ?? "";
}

function getBoolean(
  input: Record<string, unknown>,
  key: string,
  fallback = false
): boolean {
  const value = input[key];
  return typeof value === "boolean" ? value : fallback;
}

function getNumber(
  input: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  const value = input[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getStringArray(
  input: Record<string, unknown>,
  key: string
): string[] {
  const value = input[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function resolveWorkspacePath(rawPath: string): string {
  const requested = rawPath.trim() || ".";
  const resolved = path.resolve(WORKSPACE_ROOT, requested);
  const normalizedRoot = `${WORKSPACE_ROOT}${path.sep}`;

  if (resolved !== WORKSPACE_ROOT && !resolved.startsWith(normalizedRoot)) {
    throw new Error(`Path "${rawPath}" must stay inside the workspace.`);
  }

  return resolved;
}

function toDisplayPath(absolutePath: string): string {
  const relative = path.relative(WORKSPACE_ROOT, absolutePath);
  return relative || ".";
}

function truncate(text: string, maxChars = MAX_OUTPUT_CHARS): string {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n...truncated ${text.length - maxChars} characters`;
}

function formatLines(lines: string[], maxResults: number): string {
  const limited = lines.slice(0, maxResults);
  return limited.join("\n");
}

function normalizeGlobArgs(globs: string[]): string[] {
  return globs.flatMap((glob) => ["--glob", glob]);
}

async function listFiles(input: Record<string, unknown>): Promise<string> {
  const target = resolveWorkspacePath(getString(input, "path", "."));
  const relativeTarget = toDisplayPath(target);
  const maxResults = clamp(
    getNumber(input, "maxResults", MAX_RESULTS_DEFAULT),
    1,
    MAX_RESULT_LINES
  );
  const globs = getStringArray(input, "glob");

  try {
    const { stdout } = await execFileAsync(
      "rg",
      [
        "--files",
        "--hidden",
        ...normalizeGlobArgs(globs),
        relativeTarget,
      ],
      {
        cwd: WORKSPACE_ROOT,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      }
    );

    const lines = stdout.split(/\r?\n/).filter(Boolean);

    if (lines.length === 0) {
      return `No files found under ${relativeTarget}.`;
    }

    return [
      `Listed ${lines.length} file(s) under ${relativeTarget}. Showing up to ${maxResults}.`,
      formatLines(lines, maxResults),
    ].join("\n");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("The `rg` binary is not available for file listing.");
    }
    throw error;
  }
}

async function searchFiles(input: Record<string, unknown>): Promise<string> {
  const pattern = getString(input, "pattern");

  if (!pattern) {
    throw new Error("`search_files` requires a non-empty `pattern`.");
  }

  const target = resolveWorkspacePath(getString(input, "path", "."));
  const relativeTarget = toDisplayPath(target);
  const maxResults = clamp(
    getNumber(input, "maxResults", MAX_RESULTS_DEFAULT),
    1,
    MAX_RESULT_LINES
  );
  const globs = getStringArray(input, "glob");
  const literal = getBoolean(input, "literal", false);

  try {
    const { stdout } = await execFileAsync(
      "rg",
      [
        "-n",
        "--hidden",
        "--color",
        "never",
        "--smart-case",
        ...(literal ? ["-F"] : []),
        ...normalizeGlobArgs(globs),
        "--",
        pattern,
        relativeTarget,
      ],
      {
        cwd: WORKSPACE_ROOT,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      }
    );

    const lines = stdout.split(/\r?\n/).filter(Boolean);

    if (lines.length === 0) {
      return `No matches for "${pattern}" in ${relativeTarget}.`;
    }

    return [
      `Found ${lines.length} match(es) for "${pattern}" in ${relativeTarget}. Showing up to ${maxResults}.`,
      formatLines(lines, maxResults),
    ].join("\n");
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number | string;
    };
    const exitCode = execError.code == null ? "" : String(execError.code);

    if (exitCode === "1") {
      return `No matches for "${pattern}" in ${relativeTarget}.`;
    }

    if (exitCode === "ENOENT") {
      throw new Error("The `rg` binary is not available for file search.");
    }

    throw error;
  }
}

async function readFile(input: Record<string, unknown>): Promise<string> {
  const targetPath = getString(input, "path");

  if (!targetPath) {
    throw new Error("`read_file` requires a `path`.");
  }

  const absolutePath = resolveWorkspacePath(targetPath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const startLine = clamp(getNumber(input, "startLine", 1), 1, lines.length || 1);
  const maxLines = clamp(getNumber(input, "maxLines", 200), 1, 500);
  const requestedEnd = getNumber(
    input,
    "endLine",
    Math.min(lines.length || 1, startLine + maxLines - 1)
  );
  const endLine = clamp(requestedEnd, startLine, lines.length || startLine);
  const excerpt = lines.slice(startLine - 1, endLine);

  const numbered = excerpt
    .map((line, index) => `${startLine + index}: ${line}`)
    .join("\n");

  return [
    `Read ${toDisplayPath(absolutePath)} lines ${startLine}-${endLine}:`,
    truncate(numbered),
  ].join("\n");
}

function resolveCommand(command: string): string {
  if (ALLOWED_COMMANDS.has(command)) {
    return command;
  }

  if (command.startsWith("./") || command.includes("/")) {
    return resolveWorkspacePath(command);
  }

  throw new Error(
    `Command "${command}" is not allowed. Use one of: ${Array.from(ALLOWED_COMMANDS)
      .sort()
      .join(", ")}`
  );
}

async function runCommand(input: Record<string, unknown>): Promise<string> {
  const command = getString(input, "command");

  if (!command) {
    throw new Error("`run_command` requires a `command`.");
  }

  const executable = resolveCommand(command);
  const args = getStringArray(input, "args");
  const cwd = resolveWorkspacePath(getString(input, "cwd", "."));
  const timeoutMs = clamp(getNumber(input, "timeoutMs", 15000), 1000, 30000);
  const maxChars = clamp(getNumber(input, "maxChars", MAX_OUTPUT_CHARS), 2000, 40000);

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: process.env,
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let truncatedOutput = false;

    const append = (current: string, chunk: Buffer | string): string => {
      if (current.length >= maxChars) {
        truncatedOutput = true;
        return current;
      }

      const remaining = maxChars - current.length;
      const next =
        typeof chunk === "string" ? chunk : chunk.toString("utf8");

      if (next.length > remaining) {
        truncatedOutput = true;
        return `${current}${next.slice(0, remaining)}`;
      }

      return `${current}${next}`;
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout = append(stdout, chunk);
    });

    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr = append(stderr, chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);

      const sections = [
        `Command: ${command}${args.length ? ` ${args.join(" ")}` : ""}`,
        `Cwd: ${toDisplayPath(cwd)}`,
        `Exit: ${code ?? "null"}${signal ? ` (signal: ${signal})` : ""}${
          timedOut ? " (timed out)" : ""
        }`,
      ];

      if (stdout.trim()) {
        sections.push(`Stdout:\n${truncate(stdout, maxChars)}`);
      }

      if (stderr.trim()) {
        sections.push(`Stderr:\n${truncate(stderr, maxChars)}`);
      }

      if (truncatedOutput) {
        sections.push("Output was truncated.");
      }

      resolve(sections.join("\n\n"));
    });
  });
}

async function webSearch(input: Record<string, unknown>): Promise<string> {
  const query = getString(input, "query");

  if (!query) {
    throw new Error("`web_search` requires a `query`.");
  }

  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "`web_search` is not configured. Set `TAVILY_API_KEY` on the server to enable it."
    );
  }

  const maxResults = clamp(getNumber(input, "maxResults", 5), 1, 10);
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
      search_depth: "advanced",
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Web search failed: ${message || response.statusText}`);
  }

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  const results = Array.isArray(data.results) ? data.results : [];

  if (results.length === 0) {
    return `No web search results for "${query}".`;
  }

  return [
    `Top web results for "${query}":`,
    ...results.map((result, index) =>
      [
        `${index + 1}. ${result.title ?? "Untitled"}`,
        `URL: ${result.url ?? "unknown"}`,
        `Snippet: ${truncate(result.content ?? "", 1200)}`,
      ].join("\n")
    ),
  ].join("\n\n");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchUrl(input: Record<string, unknown>): Promise<string> {
  const url = getString(input, "url");

  if (!url) {
    throw new Error("`fetch_url` requires a `url`.");
  }

  const parsedUrl = new URL(url);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("`fetch_url` only supports http and https URLs.");
  }

  const maxChars = clamp(getNumber(input, "maxChars", 8000), 1000, 20000);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "llm-harness/1.0",
    },
  });
  const body = await response.text();
  const contentType = response.headers.get("content-type") ?? "unknown";
  const extracted = contentType.includes("text/html") ? stripHtml(body) : body;

  return [
    `Fetched ${url}`,
    `Status: ${response.status}`,
    `Content-Type: ${contentType}`,
    "",
    truncate(extracted, maxChars),
  ].join("\n");
}

export async function executeHarnessToolCalls(
  calls: HarnessToolCall[]
): Promise<HarnessToolResult[]> {
  const results: HarnessToolResult[] = [];

  for (const call of calls) {
    const safeInput = isRecord(call.input) ? call.input : {};

    try {
      let output = "";

      switch (call.name) {
        case "list_files":
          output = await listFiles(safeInput);
          break;
        case "search_files":
          output = await searchFiles(safeInput);
          break;
        case "read_file":
          output = await readFile(safeInput);
          break;
        case "run_command":
          output = await runCommand(safeInput);
          break;
        case "web_search":
          output = await webSearch(safeInput);
          break;
        case "fetch_url":
          output = await fetchUrl(safeInput);
          break;
        default:
          throw new Error(`Unknown tool "${call.name}".`);
      }

      results.push({
        name: call.name,
        input: safeInput,
        ok: true,
        output,
      });
    } catch (error) {
      results.push({
        name: call.name,
        input: safeInput,
        ok: false,
        error:
          error instanceof Error ? error.message : "Tool execution failed.",
      });
    }
  }

  return results;
}
