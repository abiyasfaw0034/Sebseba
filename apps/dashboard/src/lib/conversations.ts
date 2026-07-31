// Shared, member-to-member chat store. This is the single source of truth for chat:
// a message sent by one member is delivered to the other via this store (previously
// chat lived inside each member's private member-state, so it could never cross
// members). Backed by .data/conversations.json, keyed by a stable participant-pair id.
//
// Held (moderation-flagged) messages are stored but withheld from the recipient — the
// sender still sees their own held message, and the dashboard safety board reads them
// via getHeldReviews().

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getChatModerationTags } from "@/lib/moderation";

export type ConversationMessageStatus = "sent" | "held";

export type StoredMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
  flagged: boolean;
  status: ConversationMessageStatus;
  flagReason?: string;
  readAt: string | null;
};

export type Conversation = {
  id: string;
  participants: [string, string];
  messages: StoredMessage[];
};

type ConversationStore = {
  conversations: Record<string, Conversation>;
};

// Client-facing shape: the message from a given viewer's perspective.
export type ThreadMessage = {
  id: string;
  author: "me" | "them";
  text: string;
  createdAt: string;
  status: ConversationMessageStatus;
  flagged: boolean;
  flagReason?: string;
  readAt: string | null;
};

export type InboxSummary = {
  peerId: string;
  lastMessageText: string;
  lastMessageAt: string;
  lastMessageAuthor: "me" | "them";
  lastMessageStatus: ConversationMessageStatus;
  unreadCount: number;
};

export type HeldReview = {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  flagReason: string;
  createdAt: string;
};

const MAX_MESSAGES_PER_CONVERSATION = 240;
const MAX_TEXT_LENGTH = 500;

const dataDirectory = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDirectory, "conversations.json");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Stable id for the conversation between two members, independent of who sends first. */
export const conversationKey = (a: string, b: string): string => [a, b].sort().join("__");

const readStore = async (): Promise<ConversationStore> => {
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (isRecord(parsed) && isRecord(parsed.conversations)) {
      return { conversations: parsed.conversations as Record<string, Conversation> };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Could not read conversation store", error);
    }
  }

  return { conversations: {} };
};

const writeStore = async (store: ConversationStore) => {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
};

const toThreadMessage = (message: StoredMessage, viewerId: string): ThreadMessage => ({
  id: message.id,
  author: message.senderId === viewerId ? "me" : "them",
  text: message.text,
  createdAt: message.createdAt,
  status: message.status,
  flagged: message.flagged,
  flagReason: message.flagReason,
  readAt: message.readAt,
});

// A message is visible to a viewer if they sent it (they always see their own, held or
// not) or it was delivered to them (status "sent"). Held messages are hidden from the
// recipient until a host clears them.
const isVisibleTo = (message: StoredMessage, viewerId: string): boolean =>
  message.senderId === viewerId || message.status === "sent";

export const sendMessage = async ({
  senderId,
  recipientId,
  text,
}: {
  senderId: string;
  recipientId: string;
  text: string;
}): Promise<ThreadMessage> => {
  const clean = text.trim().replace(/\s+/g, " ").slice(0, MAX_TEXT_LENGTH);

  if (!clean) {
    throw new Error("empty-message");
  }

  if (senderId === recipientId) {
    throw new Error("invalid-recipient");
  }

  const tags = getChatModerationTags(clean);
  const flagged = tags.length > 0;
  const message: StoredMessage = {
    id: randomUUID(),
    senderId,
    recipientId,
    text: clean,
    createdAt: new Date().toISOString(),
    flagged,
    status: flagged ? "held" : "sent",
    flagReason: flagged ? tags.join(" + ") : undefined,
    readAt: null,
  };

  const store = await readStore();
  const key = conversationKey(senderId, recipientId);
  const participants = [senderId, recipientId].sort() as [string, string];
  const existing = store.conversations[key];
  const conversation: Conversation = existing
    ? { ...existing, participants }
    : { id: key, participants, messages: [] };

  conversation.messages = [...conversation.messages, message].slice(-MAX_MESSAGES_PER_CONVERSATION);
  store.conversations[key] = conversation;
  await writeStore(store);

  return toThreadMessage(message, senderId);
};

export const getThread = async (memberId: string, peerId: string): Promise<ThreadMessage[]> => {
  const store = await readStore();
  const conversation = store.conversations[conversationKey(memberId, peerId)];

  if (!conversation) {
    return [];
  }

  return conversation.messages
    .filter((message) => isVisibleTo(message, memberId))
    .map((message) => toThreadMessage(message, memberId));
};

/** Marks every delivered message the peer sent to this member as read. Returns how many were newly read. */
export const markThreadRead = async (memberId: string, peerId: string): Promise<number> => {
  const store = await readStore();
  const key = conversationKey(memberId, peerId);
  const conversation = store.conversations[key];

  if (!conversation) {
    return 0;
  }

  const now = new Date().toISOString();
  let changed = 0;

  conversation.messages = conversation.messages.map((message) => {
    if (message.recipientId === memberId && message.status === "sent" && message.readAt === null) {
      changed += 1;
      return { ...message, readAt: now };
    }

    return message;
  });

  if (changed > 0) {
    store.conversations[key] = conversation;
    await writeStore(store);
  }

  return changed;
};

export const getInbox = async (memberId: string): Promise<InboxSummary[]> => {
  const store = await readStore();
  const summaries: InboxSummary[] = [];

  for (const conversation of Object.values(store.conversations)) {
    if (!conversation.participants.includes(memberId)) {
      continue;
    }

    const peerId = conversation.participants.find((participant) => participant !== memberId);

    if (!peerId) {
      continue;
    }

    const visible = conversation.messages.filter((message) => isVisibleTo(message, memberId));

    if (visible.length === 0) {
      continue;
    }

    const last = visible[visible.length - 1];
    const unreadCount = conversation.messages.filter(
      (message) => message.recipientId === memberId && message.status === "sent" && message.readAt === null,
    ).length;

    summaries.push({
      peerId,
      lastMessageText: last.text,
      lastMessageAt: last.createdAt,
      lastMessageAuthor: last.senderId === memberId ? "me" : "them",
      lastMessageStatus: last.status,
      unreadCount,
    });
  }

  return summaries.sort((first, second) => (second.lastMessageAt > first.lastMessageAt ? 1 : -1));
};

/** All held messages across every conversation, newest first — for the dashboard safety board. */
export const getHeldReviews = async (): Promise<HeldReview[]> => {
  const store = await readStore();
  const held: HeldReview[] = [];

  for (const conversation of Object.values(store.conversations)) {
    for (const message of conversation.messages) {
      if (message.status === "held") {
        held.push({
          id: message.id,
          senderId: message.senderId,
          recipientId: message.recipientId,
          text: message.text,
          flagReason: message.flagReason ?? "host review",
          createdAt: message.createdAt,
        });
      }
    }
  }

  return held.sort((first, second) => (second.createdAt > first.createdAt ? 1 : -1));
};
