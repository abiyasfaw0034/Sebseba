import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http";
import { getAuthenticatedMemberId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OnboardingProfile = {
  intention: string;
  city: string;
  languages: string[];
  faithComfort: string;
  familyExpectation: string;
  revealPace: string;
  dateStyle: string;
  dealbreakers: string[];
};

type ChatMessageAuthor = "member" | "match" | "host";
type ChatMessageStatus = "sent" | "held";

type ChatMessage = {
  id: string;
  matchId: string;
  author: ChatMessageAuthor;
  text: string;
  createdAt: string;
  flagged: boolean;
  status: ChatMessageStatus;
  flagReason?: string;
};

type MemberState = {
  memberId: string;
  onboardingComplete: boolean;
  profile: OnboardingProfile;
  selectedMatchId: string;
  selectedCue: string;
  selectedSpot: string;
  selectedPrompt: string;
  answeredPromptIds: string[];
  promptAnswers: Record<string, string>;
  activeVoicePromptId: string;
  savedVoicePromptIds: string[];
  acceptedDatePlan: boolean;
  photoRevealRequested: boolean;
  matchRevealConsentGranted: boolean;
  photoRevealOpened: boolean;
  revealPausedUntil: string | null;
  chatMessages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

type MemberStateStore = {
  members: Record<string, MemberState>;
};

const defaultProfile: OnboardingProfile = {
  intention: "Long-term",
  city: "Addis Ababa",
  languages: ["Amharic", "English"],
  faithComfort: "Respectful of faith routines",
  familyExpectation: "Family matters early",
  revealPace: "Voice before photos",
  dateStyle: "Buna first",
  dealbreakers: ["Rushed photos"],
};

const dataDirectory = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDirectory, "member-state.json");

const chatModerationRules = [
  {
    label: "contact detail",
    pattern:
      /(\+?\d[\d\s().-]{7,}\d)|\b[\w.-]+@[\w.-]+\.\w{2,}\b|(^|\s)@[a-z0-9_.]{2,}\b/i,
  },
  {
    label: "off-app request",
    pattern: /\b(text me|call me|dm me|outside (the )?app|move to|whatsapp|telegram|instagram|snapchat)\b/i,
  },
  {
    label: "photo pressure",
    pattern:
      /\b(send|show|share|drop|need|want)\b.{0,24}\b(photos?|pics?|pictures?|selfie|image)\b|\b(photos?|pics?|pictures?|selfie|image)\b.{0,24}\b(send|show|share|drop)\b/i,
  },
  {
    label: "boundary pressure",
    pattern: /\b(skip the host|no host|prove it|right now|don't tell|dont tell)\b/i,
  },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback: string, maxLength = 240) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
};

const asNullableIsoString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const asStringArray = (value: unknown, fallback: string[], maxItems = 12) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const unique = new Set<string>();
  value.forEach((item) => {
    if (typeof item === "string") {
      const normalized = item.trim();
      if (normalized) {
        unique.add(normalized.slice(0, 240));
      }
    }
  });

  return unique.size > 0 ? Array.from(unique).slice(0, maxItems) : fallback;
};

const asBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const asChatAuthor = (value: unknown): ChatMessageAuthor =>
  value === "match" || value === "host" || value === "member" ? value : "member";

const normalizeProfile =(value: unknown, fallback: OnboardingProfile = defaultProfile): OnboardingProfile => {
  const input = isRecord(value) ? value : {};

  return {
    intention: asString(input.intention, fallback.intention),
    city: asString(input.city, fallback.city),
    languages: asStringArray(input.languages, fallback.languages),
    faithComfort: asString(input.faithComfort, fallback.faithComfort),
    familyExpectation: asString(input.familyExpectation, fallback.familyExpectation),
    revealPace: asString(input.revealPace, fallback.revealPace),
    dateStyle: asString(input.dateStyle, fallback.dateStyle),
    dealbreakers: asStringArray(input.dealbreakers, fallback.dealbreakers),
  };
};

const normalizePromptAnswers = (value: unknown, fallback: Record<string, string>) => {
  if (!isRecord(value)) {
    return fallback;
  }

  return Object.entries(value).reduce<Record<string, string>>((answers, [key, answer]) => {
    if (typeof answer === "string") {
      const normalizedKey = key.trim().slice(0, 80);
      const normalizedAnswer = answer.trim().slice(0, 1200);

      if (normalizedKey && normalizedAnswer) {
        answers[normalizedKey] = normalizedAnswer;
      }
    }

    return answers;
  }, {});
};

const getChatModerationTags = (message: string) =>
  chatModerationRules.filter((rule) => rule.pattern.test(message)).map((rule) => rule.label);

const normalizeChatMessages = (value: unknown, fallback: ChatMessage[]) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const messages = value.reduce<ChatMessage[]>((normalized, item) => {
    if (!isRecord(item)) {
      return normalized;
    }

    const text = asString(item.text, "", 500);

    if (!text) {
      return normalized;
    }

    const moderationTags = getChatModerationTags(text);
    const flagged = asBoolean(item.flagged, false) || item.status === "held" || moderationTags.length > 0;
    const fallbackFlagReason = moderationTags.join(" + ");
    const flagReason = flagged ? asString(item.flagReason, fallbackFlagReason || "host review", 160) : undefined;

    normalized.push({
      id: asString(item.id, `chat-${normalized.length + 1}`, 120),
      matchId: asString(item.matchId, "AB-024", 80),
      author: asChatAuthor(item.author),
      text,
      createdAt: asNullableIsoString(item.createdAt) ?? new Date().toISOString(),
      flagged,
      status: flagged ? "held" : "sent",
      flagReason,
    });

    return normalized;
  }, []);

  return messages.slice(-120);
};

const createDefaultState = (memberId: string, timestamp = new Date().toISOString()): MemberState => ({
  memberId,
  onboardingComplete: false,
  profile: defaultProfile,
  selectedMatchId: "AB-024",
  selectedCue: "Buna conversation",
  selectedSpot: "Buna corner",
  selectedPrompt: "song",
  answeredPromptIds: [],
  promptAnswers: {},
  activeVoicePromptId: "home",
  savedVoicePromptIds: [],
  acceptedDatePlan: false,
  photoRevealRequested: false,
  matchRevealConsentGranted: false,
  photoRevealOpened: false,
  revealPausedUntil: null,
  chatMessages: [],
  createdAt: timestamp,
  updatedAt: timestamp,
});

const normalizeState = (memberId: string, value: unknown, fallback = createDefaultState(memberId)): MemberState => {
  const input = isRecord(value) ? value : {};
  const promptAnswers = normalizePromptAnswers(input.promptAnswers, fallback.promptAnswers);
  const answeredPromptIds = asStringArray(input.answeredPromptIds, fallback.answeredPromptIds, 24);
  const photoRevealRequested = asBoolean(input.photoRevealRequested, fallback.photoRevealRequested);
  const matchRevealConsentGranted =
    photoRevealRequested && asBoolean(input.matchRevealConsentGranted, fallback.matchRevealConsentGranted);
  const photoRevealOpened = matchRevealConsentGranted && asBoolean(input.photoRevealOpened, fallback.photoRevealOpened);

  return {
    memberId,
    onboardingComplete: asBoolean(input.onboardingComplete, fallback.onboardingComplete),
    profile: normalizeProfile(input.profile, fallback.profile),
    selectedMatchId: asString(input.selectedMatchId, fallback.selectedMatchId, 80),
    selectedCue: asString(input.selectedCue, fallback.selectedCue),
    selectedSpot: asString(input.selectedSpot, fallback.selectedSpot),
    selectedPrompt: asString(input.selectedPrompt, fallback.selectedPrompt, 80),
    answeredPromptIds: Array.from(new Set([...answeredPromptIds, ...Object.keys(promptAnswers)])),
    promptAnswers,
    activeVoicePromptId: asString(input.activeVoicePromptId, fallback.activeVoicePromptId, 80),
    savedVoicePromptIds: asStringArray(input.savedVoicePromptIds, fallback.savedVoicePromptIds, 24),
    acceptedDatePlan: asBoolean(input.acceptedDatePlan, fallback.acceptedDatePlan),
    photoRevealRequested,
    matchRevealConsentGranted,
    photoRevealOpened,
    revealPausedUntil: asNullableIsoString(input.revealPausedUntil) ?? fallback.revealPausedUntil,
    chatMessages: normalizeChatMessages(input.chatMessages, fallback.chatMessages),
    createdAt: asNullableIsoString(input.createdAt) ?? fallback.createdAt,
    updatedAt: asNullableIsoString(input.updatedAt) ?? fallback.updatedAt,
  };
};

const readStore = async (): Promise<MemberStateStore> => {
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);

    if (isRecord(parsed) && isRecord(parsed.members)) {
      return { members: parsed.members as Record<string, MemberState> };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Could not read member state store", error);
    }
  }

  return { members: {} };
};

const writeStore = async (store: MemberStateStore) => {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
};

export const OPTIONS = () => corsPreflight("GET, PUT, OPTIONS");

export const GET = async (request: NextRequest) => {
  const memberId = getAuthenticatedMemberId(request);

  if (!memberId) {
    return withCors(NextResponse.json({ error: "Authentication required." }, { status: 401 }));
  }

  const store = await readStore();
  const current = store.members[memberId];

  return withCors(NextResponse.json(current ? normalizeState(memberId, current) : createDefaultState(memberId)));
};

export const PUT = async (request: NextRequest) => {
  const memberId = getAuthenticatedMemberId(request);

  if (!memberId) {
    return withCors(NextResponse.json({ error: "Authentication required." }, { status: 401 }));
  }

  const body = await request.json().catch(() => null);

  if (!isRecord(body)) {
    return withCors(NextResponse.json({ error: "Expected a JSON object body." }, { status: 400 }));
  }

  const store = await readStore();
  const now = new Date().toISOString();
  const previous = store.members[memberId] ? normalizeState(memberId, store.members[memberId]) : createDefaultState(memberId, now);
  const next = normalizeState(
    memberId,
    {
      ...previous,
      ...body,
      memberId,
      createdAt: previous.createdAt,
      updatedAt: now,
    },
    previous,
  );

  store.members[memberId] = next;
  await writeStore(store);

  return withCors(NextResponse.json(next));
};
