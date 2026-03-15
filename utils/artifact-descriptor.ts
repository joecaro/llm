import type { ArtifactLanguage } from "@/types/chat";

function firstNonEmptyLine(content: string): string | null {
  const line = content
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(Boolean);

  return line ?? null;
}

function truncate(value: string, maxChars = 120): string {
  return value.length <= maxChars ? value : `${value.slice(0, maxChars - 1)}…`;
}

export function inferArtifactKind(params: {
  path: string;
  language: ArtifactLanguage;
}): string {
  const { path, language } = params;
  const lowerPath = path.toLowerCase();

  if (language === "csv") return "data";
  if (language === "md" || language === "text") return "document";
  if (language === "css") return "style";
  if (language === "html") return "markup";
  if (language === "json") return "data";

  if (language === "tsx" || language === "jsx") {
    if (lowerPath.includes("components/")) return "component";
    if (lowerPath.includes("pages/") || lowerPath.includes("app/")) return "page";
    return "ui";
  }

  return "code";
}

export function inferArtifactDescription(params: {
  path: string;
  language: ArtifactLanguage;
  content: string;
}): string {
  const { path, language, content } = params;
  const lowerPath = path.toLowerCase();

  if (language === "md" || language === "text") {
    const heading = content.match(/^\s*#{1,6}\s+(.+)$/m)?.[1]?.trim();
    if (heading) return truncate(heading);

    const firstLine = firstNonEmptyLine(content);
    if (firstLine) return truncate(firstLine.replace(/^[-*]\s+/, ""));
  }

  if (language === "csv") {
    const header = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);

    if (header) {
      return truncate(`CSV data with columns: ${header}`);
    }

    return "CSV data export";
  }

  if (language === "json") {
    return lowerPath.includes("schema") ? "JSON schema" : "JSON document";
  }

  if (language === "css") {
    return lowerPath.includes("theme") ? "Theme styles" : "Stylesheet";
  }

  if (language === "tsx" || language === "jsx") {
    const componentName =
      content.match(/export\s+default\s+function\s+([A-Z]\w*)/)?.[1] ??
      content.match(/export\s+(?:const|function|class)\s+([A-Z]\w*)/)?.[1];

    if (componentName) {
      return truncate(`UI component ${componentName}`);
    }

    return lowerPath.includes("page") ? "UI page" : "UI component";
  }

  if (language === "ts" || language === "js") {
    const exported =
      content.match(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/)?.[1] ??
      content.match(/export\s+const\s+([A-Za-z0-9_]+)/)?.[1];

    if (exported) {
      return truncate(`Code module for ${exported}`);
    }

    return "Code module";
  }

  if (language === "html") {
    return "HTML document";
  }

  return truncate(firstNonEmptyLine(content) ?? path.split("/").pop() ?? "Artifact");
}
