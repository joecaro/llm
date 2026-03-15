import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Chat, ChatArtifactFile, ChatArtifacts } from "@/types/chat";
import { normalizeChat } from "@/utils/create-empty-chat";
import { inferArtifactDescription, inferArtifactKind } from "@/utils/artifact-descriptor";
import { normalizeArtifactPath } from "@/utils/artifact-apply";

const STORAGE_VERSION = 1;
const APP_HOME = process.env.JOELLM_HOME?.trim() || path.join(os.homedir(), ".joellm");
const CONVERSATIONS_DIR = path.join(APP_HOME, "conversations");
const STATE_FILE = path.join(APP_HOME, "state.json");

type PersistedArtifactFile = Omit<ChatArtifactFile, "content">;

interface PersistedChatArtifacts {
  files: Record<string, PersistedArtifactFile>;
  order: string[];
}

interface PersistedConversationFile {
  version: number;
  chat: Omit<Chat, "artifacts"> & {
    artifacts: PersistedChatArtifacts;
  };
}

interface PersistedStateFile {
  version: number;
  currentChatId: string | null;
  order: string[];
}

export interface ConversationStateSnapshot {
  chats: Chat[];
  currentChatId: string | null;
  storageRoot: string;
}

function getConversationDir(chatId: string): string {
  return path.join(CONVERSATIONS_DIR, chatId);
}

function getConversationFile(chatId: string): string {
  return path.join(getConversationDir(chatId), "conversation.json");
}

function getArtifactsDir(chatId: string): string {
  return path.join(getConversationDir(chatId), "artifacts");
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureStorageRoot() {
  await fs.mkdir(CONVERSATIONS_DIR, { recursive: true });
}

function buildArtifactMetadata(file: ChatArtifactFile): PersistedArtifactFile {
  return {
    path: file.path,
    language: file.language,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    createdByMessageId: file.createdByMessageId,
    updatedByMessageId: file.updatedByMessageId,
    description:
      file.description ??
      inferArtifactDescription({
        path: file.path,
        language: file.language,
        content: file.content,
      }),
    kind:
      file.kind ??
      inferArtifactKind({
        path: file.path,
        language: file.language,
      }),
  };
}

async function writeArtifactFile(chatId: string, file: ChatArtifactFile) {
  const normalizedPath = normalizeArtifactPath(file.path);
  const artifactPath = path.join(getArtifactsDir(chatId), normalizedPath);
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, file.content, "utf8");
}

async function readArtifactFile(chatId: string, relativePath: string): Promise<string> {
  const normalizedPath = normalizeArtifactPath(relativePath);
  const artifactPath = path.join(getArtifactsDir(chatId), normalizedPath);
  return fs.readFile(artifactPath, "utf8");
}

async function loadStateFile(): Promise<PersistedStateFile | null> {
  if (!(await fileExists(STATE_FILE))) {
    return null;
  }

  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedStateFile;
    return {
      version: parsed.version ?? STORAGE_VERSION,
      currentChatId: parsed.currentChatId ?? null,
      order: Array.isArray(parsed.order)
        ? parsed.order.filter((entry): entry is string => typeof entry === "string")
        : [],
    };
  } catch (error) {
    console.error("Failed to read joellm state file:", error);
    return null;
  }
}

async function listConversationIds(): Promise<string[]> {
  if (!(await fileExists(CONVERSATIONS_DIR))) {
    return [];
  }

  const entries = await fs.readdir(CONVERSATIONS_DIR, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function loadConversation(chatId: string): Promise<Chat | null> {
  const conversationFile = getConversationFile(chatId);

  if (!(await fileExists(conversationFile))) {
    return null;
  }

  try {
    const raw = await fs.readFile(conversationFile, "utf8");
    const parsed = JSON.parse(raw) as PersistedConversationFile;
    const metadataArtifacts = parsed.chat.artifacts ?? {
      files: {},
      order: [],
    };
    const normalized = normalizeChat({
      ...parsed.chat,
      artifacts: {
        files: {},
        order: Array.isArray(metadataArtifacts?.order)
          ? metadataArtifacts.order
          : [],
      },
    });
    const files: ChatArtifacts["files"] = {};

    for (const artifactPath of normalized.artifacts.order) {
      const metadata = metadataArtifacts.files[artifactPath];

      if (!metadata) {
        continue;
      }

      let content = "";

      try {
        content = await readArtifactFile(chatId, artifactPath);
      } catch {
        content = "";
      }

      files[artifactPath] = {
        ...metadata,
        content,
        description:
          metadata.description ??
          inferArtifactDescription({
            path: artifactPath,
            language: metadata.language,
            content,
          }),
        kind:
          metadata.kind ??
          inferArtifactKind({
            path: artifactPath,
            language: metadata.language,
          }),
      };
    }

    return {
      ...normalized,
      artifacts: {
        files,
        order: normalized.artifacts.order.filter((artifactPath) => Boolean(files[artifactPath])),
      },
    };
  } catch (error) {
    console.error(`Failed to load conversation ${chatId}:`, error);
    return null;
  }
}

export async function loadConversationState(): Promise<ConversationStateSnapshot> {
  await ensureStorageRoot();
  const state = await loadStateFile();
  const knownIds = await listConversationIds();
  const orderedIds = [
    ...(state?.order ?? []),
    ...knownIds.filter((id) => !(state?.order ?? []).includes(id)),
  ];
  const chats = (
    await Promise.all(orderedIds.map((chatId) => loadConversation(chatId)))
  ).filter((chat): chat is Chat => Boolean(chat));

  return {
    chats,
    currentChatId: state?.currentChatId ?? chats[0]?.id ?? null,
    storageRoot: APP_HOME,
  };
}

async function saveConversation(chat: Chat): Promise<void> {
  const normalized = normalizeChat(chat);
  const conversationDir = getConversationDir(normalized.id);
  const artifactsDir = getArtifactsDir(normalized.id);
  const artifactMetadata: PersistedChatArtifacts["files"] = {};

  await fs.mkdir(conversationDir, { recursive: true });
  await fs.rm(artifactsDir, { recursive: true, force: true });
  await fs.mkdir(artifactsDir, { recursive: true });

  for (const artifactPath of normalized.artifacts.order) {
    const file = normalized.artifacts.files[artifactPath];

    if (!file) {
      continue;
    }

    const normalizedPath = normalizeArtifactPath(file.path);
    const enrichedFile: ChatArtifactFile = {
      ...file,
      path: normalizedPath,
      description:
        file.description ??
        inferArtifactDescription({
          path: normalizedPath,
          language: file.language,
          content: file.content,
        }),
      kind:
        file.kind ??
        inferArtifactKind({
          path: normalizedPath,
          language: file.language,
        }),
    };

    await writeArtifactFile(normalized.id, enrichedFile);
    artifactMetadata[normalizedPath] = buildArtifactMetadata(enrichedFile);
  }

  const persisted: PersistedConversationFile = {
    version: STORAGE_VERSION,
    chat: {
      ...normalized,
      artifacts: {
        order: normalized.artifacts.order
          .map((artifactPath) => normalizeArtifactPath(artifactPath))
          .filter((artifactPath) => Boolean(artifactMetadata[artifactPath])),
        files: artifactMetadata,
      },
    },
  };

  await fs.writeFile(
    getConversationFile(normalized.id),
    JSON.stringify(persisted, null, 2),
    "utf8"
  );
}

export async function saveConversationState(params: {
  chats: Chat[];
  currentChatId: string | null;
}): Promise<void> {
  await ensureStorageRoot();
  const normalizedChats = params.chats.map((chat) => normalizeChat(chat));

  await Promise.all(normalizedChats.map((chat) => saveConversation(chat)));

  const desiredIds = new Set(normalizedChats.map((chat) => chat.id));
  const existingIds = await listConversationIds();

  await Promise.all(
    existingIds
      .filter((chatId) => !desiredIds.has(chatId))
      .map((chatId) => fs.rm(getConversationDir(chatId), { recursive: true, force: true }))
  );

  const stateFile: PersistedStateFile = {
    version: STORAGE_VERSION,
    currentChatId: params.currentChatId,
    order: normalizedChats.map((chat) => chat.id),
  };

  await fs.writeFile(STATE_FILE, JSON.stringify(stateFile, null, 2), "utf8");
}
