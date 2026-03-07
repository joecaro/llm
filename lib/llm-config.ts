const STORAGE_KEY = "llm-server-config";

export interface LlmConfig {
  host: string;
  port: string;
  endpoint: string;
}

const DEFAULT_CONFIG: LlmConfig = {
  host: "windows-machine",
  port: "8080",
  endpoint: "/v1/chat/completions",
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
  const { host, port, endpoint } = getLlmConfig();
  const portPart = port ? `:${port}` : "";
  return `http://${host}${portPart}${endpoint}`;
}
