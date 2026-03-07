const STORAGE_KEY = "llm-server-config";

export interface LlmConfig {
  host: string;
  port: string;
  endpoint: string;
  https: boolean;
}

const DEFAULT_CONFIG: LlmConfig = {
  host: "windows-machine",
  port: "8080",
  endpoint: "/v1/chat/completions",
  https: false,
};

export function getLlmConfig(): LlmConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_CONFIG;
}

export function saveLlmConfig(config: LlmConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function getLlmUrl(): string {
  const { host, port, endpoint, https } = getLlmConfig();
  const protocol = https ? "https" : "http";
  const portPart = port ? `:${port}` : "";
  return `${protocol}://${host}${portPart}${endpoint}`;
}
