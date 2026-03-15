import type { ChatArtifacts } from "@/types/chat";
import { normalizeArtifactPath } from "@/utils/artifact-apply";

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildArtifactManifest(artifacts: ChatArtifacts): string {
  const lines = artifacts.order
    .map((path) => artifacts.files[path])
    .filter(Boolean)
    .map(
      (file) =>
        `<file path="${escapeAttribute(file.path)}" language="${escapeAttribute(
          file.language
        )}" kind="${escapeAttribute(file.kind ?? file.language)}" description="${escapeAttribute(
          file.description ?? file.path
        )}" chars="${file.content.length}" updatedAt="${new Date(file.updatedAt).toISOString()}" />`
    );

  return [
    "Artifact manifest for this chat. Request file contents with <artifact-request path=\"...\" /> before editing if the manifest alone is not enough.",
    "<artifact-manifest>",
    ...lines,
    "</artifact-manifest>",
  ].join("\n");
}

export function buildArtifactSourceContext(
  artifacts: ChatArtifacts,
  paths: string[]
): { ok: true; content: string } | { ok: false; error: string } {
  let uniquePaths: string[];

  try {
    uniquePaths = [...new Set(paths.map((path) => normalizeArtifactPath(path)))];
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "One or more requested artifact paths were invalid.",
    };
  }

  const missingPath = uniquePaths.find((path) => !artifacts.files[path]);

  if (missingPath) {
    return {
      ok: false,
      error: `The requested artifact "${missingPath}" does not exist in the current chat.`,
    };
  }

  const sources = uniquePaths.map((path) => {
    const file = artifacts.files[path];
    return `<artifact-source path="${file.path}" language="${file.language}">\n${file.content}\n</artifact-source>`;
  });

  return {
    ok: true,
    content: [
      "Here are the requested artifact sources. Respond with either valid artifact operations or a normal assistant reply.",
      ...sources,
    ].join("\n\n"),
  };
}

export function buildArtifactProtocolError(error: string): string {
  return [
    "The previous artifact response was invalid.",
    error,
    "Choose exactly one mode per response:",
    '1. Request files only with <artifact-request path="..." /> tags.',
    '2. Create files with <artifact path="...">...</artifact> blocks.',
    '3. Update existing files with <artifact-replace path="..."><search>...</search><replace>...</replace></artifact-replace> blocks.',
  ].join("\n");
}
