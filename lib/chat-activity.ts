import type {
  ChatActivityDetail,
  ChatActivityEvent,
  ChatActivityKind,
  ChatActivityStatus,
} from "@/types/chat";

export function buildActivityEventId(
  kind: string,
  pass: number,
  index = 0
): string {
  return `${kind}:${pass}:${index}`;
}

export function createActivityEvent(params: {
  id: string;
  kind: ChatActivityKind;
  status: ChatActivityStatus;
  label: string;
  detail?: ChatActivityDetail;
  startedAt?: number;
  endedAt?: number;
}): ChatActivityEvent {
  return {
    id: params.id,
    kind: params.kind,
    status: params.status,
    label: params.label,
    startedAt: params.startedAt ?? Date.now(),
    endedAt: params.endedAt,
    detail: params.detail,
  };
}

export function getPhaseLabel(phase: string): string {
  switch (phase) {
    case "thinking":
      return "Thinking";
    case "reading":
      return "Reading";
    case "calling-tools":
      return "Running tools";
    case "retrying":
      return "Retrying";
    case "applying":
      return "Applying changes";
    case "finalizing":
      return "Finalizing";
    default:
      return "Working";
  }
}

export function getArtifactActivityLabel(paths: string[]): string {
  if (paths.length === 0) {
    return "Reading artifacts";
  }

  if (paths.length === 1) {
    return `Reading ${paths[0]}`;
  }

  return `Reading ${paths.length} artifacts`;
}

export function getToolActivityLabel(
  toolName: string,
  input: Record<string, unknown>
): string {
  switch (toolName) {
    case "list_files": {
      const path = typeof input.path === "string" ? input.path : ".";
      return path === "." ? "Listing files" : `Listing files in ${path}`;
    }
    case "search_files": {
      const path = typeof input.path === "string" ? input.path : ".";
      return path === "." ? "Searching files" : `Searching files in ${path}`;
    }
    case "read_file": {
      const path = typeof input.path === "string" ? input.path : "file";
      return `Reading ${path}`;
    }
    case "run_command": {
      const command = typeof input.command === "string" ? input.command : "command";
      const args = Array.isArray(input.args)
        ? input.args.filter((value): value is string => typeof value === "string")
        : [];
      const label = [command, ...args].join(" ").trim();
      return label ? `Running ${label}` : "Running command";
    }
    case "fetch_url": {
      const url = typeof input.url === "string" ? input.url : "URL";
      return `Fetching ${url}`;
    }
    default:
      return `Running ${toolName}`;
  }
}
