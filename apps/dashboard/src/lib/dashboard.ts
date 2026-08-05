// Server-side aggregation for the operations console. Reads the real .data stores
// (member state, accounts, conversations) and derives the metrics, compatibility queue,
// safety board, and reveal-workflow stats the dashboard renders. Everything falls back to
// representative sample data when the store is empty so a fresh install still looks alive.

import { readFile } from "fs/promises";
import path from "path";
import { listAccountSummaries } from "@/lib/auth";
import { getHeldReviews } from "@/lib/conversations";

// The blind-first prompt exchange has three prompts (see apps/mobile promptExchange).
const PROMPT_TARGET = 3;

const dataFile = path.join(process.cwd(), ".data", "member-state.json");

type Tone = "good" | "watch";

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
};

export type QueueMember = {
  code: string;
  name: string;
  city: string;
  cue: string;
  score: string;
  status: string;
  stage: string;
  language: string;
  tags: string[];
};

export type DashboardSafetyReview = {
  id: string;
  signal: string;
  owner: string;
  state: string;
};

export type WorkflowStat = {
  label: string;
  value: string;
  detail: string;
};

export type DashboardData = {
  metrics: DashboardMetric[];
  queue: QueueMember[];
  usingRealQueue: boolean;
  safetyReviews: DashboardSafetyReview[];
  usingRealSafety: boolean;
  workflow: WorkflowStat[];
  totalMembers: number;
  onboardedMembers: number;
};

type MemberRecord = {
  id: string;
  profile: {
    intention: string;
    city: string;
    languages: string[];
    faithComfort: string;
    familyExpectation: string;
    revealPace: string;
    dateStyle: string;
    dealbreakers: string[];
  };
  onboardingComplete: boolean;
  answeredCount: number;
  savedVoiceCount: number;
  acceptedDatePlan: boolean;
  photoRevealRequested: boolean;
  matchRevealConsentGranted: boolean;
  photoRevealOpened: boolean;
  revealPaused: boolean;
  selectedSpot: string;
  updatedAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback: string, maxLength = 120): string => {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
};

const asStringArray = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
  return items.length ? items : fallback;
};

const countAnswered = (member: Record<string, unknown>): number => {
  const ids = Array.isArray(member.answeredPromptIds)
    ? member.answeredPromptIds.filter((item) => typeof item === "string")
    : [];
  const answerKeys = isRecord(member.promptAnswers) ? Object.keys(member.promptAnswers) : [];
  return new Set([...ids, ...answerKeys]).size;
};

const readMembers = async (): Promise<MemberRecord[]> => {
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!isRecord(parsed) || !isRecord(parsed.members)) {
      return [];
    }

    return Object.entries(parsed.members).flatMap<MemberRecord>(([memberId, value]) => {
      if (!isRecord(value)) {
        return [];
      }

      const profileInput = isRecord(value.profile) ? value.profile : {};
      const revealPausedUntil = asString(value.revealPausedUntil, "", 40);
      const revealPaused = revealPausedUntil ? new Date(revealPausedUntil).getTime() > Date.now() : false;

      return [
        {
          id: memberId,
          profile: {
            intention: asString(profileInput.intention, "Long-term"),
            city: asString(profileInput.city, "Addis Ababa"),
            languages: asStringArray(profileInput.languages, ["Amharic"]),
            faithComfort: asString(profileInput.faithComfort, "Respectful of faith routines"),
            familyExpectation: asString(profileInput.familyExpectation, "Introduce after trust"),
            revealPace: asString(profileInput.revealPace, "Voice before photos"),
            dateStyle: asString(profileInput.dateStyle, "Buna first"),
            dealbreakers: asStringArray(profileInput.dealbreakers, []),
          },
          onboardingComplete: value.onboardingComplete === true,
          answeredCount: countAnswered(value),
          savedVoiceCount: Array.isArray(value.savedVoicePromptIds)
            ? value.savedVoicePromptIds.filter((item) => typeof item === "string").length
            : 0,
          acceptedDatePlan: value.acceptedDatePlan === true,
          photoRevealRequested: value.photoRevealRequested === true,
          matchRevealConsentGranted: value.matchRevealConsentGranted === true,
          photoRevealOpened: value.photoRevealOpened === true,
          revealPaused,
          selectedSpot: asString(value.selectedSpot, "Buna corner", 40),
          updatedAt: asString(value.updatedAt, "", 40),
        },
      ];
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Could not read members for dashboard", error);
    }
    return [];
  }
};

const shortId = (id: string): string => {
  const suffix = id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "0000";
  return `AB-${suffix}`;
};

const nameFromEmail = (email: string | undefined, memberId: string): string => {
  const local = email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (local) {
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return `Member ${memberId.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()}`;
};

const memberStatus = (member: MemberRecord): string => {
  if (member.photoRevealOpened) return "Photos open";
  if (member.photoRevealRequested) return "Reveal requested";
  if (member.acceptedDatePlan) return "Date accepted";
  if (member.savedVoiceCount > 0) return "Voice reveal ready";
  if (member.answeredCount >= PROMPT_TARGET) return "Ready for host";
  if (member.answeredCount > 0) return "Needs prompt";
  return "Onboarding";
};

const readinessScore = (member: MemberRecord): number => {
  let score = 40;
  if (member.onboardingComplete) score += 12;
  score += Math.min(PROMPT_TARGET, member.answeredCount) * (21 / PROMPT_TARGET);
  if (member.savedVoiceCount > 0) score += 10;
  if (member.acceptedDatePlan) score += 9;
  if (member.photoRevealRequested) score += 4;
  if (member.matchRevealConsentGranted) score += 3;
  return Math.max(42, Math.min(99, Math.round(score)));
};

const memberTags = (member: MemberRecord): string[] => {
  const { profile } = member;
  const tags = [profile.intention, profile.dateStyle, profile.faithComfort, profile.dealbreakers[0]];
  return tags.filter((tag): tag is string => Boolean(tag)).slice(0, 3);
};

const toQueueMember = (member: MemberRecord, email: string | undefined): QueueMember => {
  const { profile } = member;
  const stageBase = `${Math.min(PROMPT_TARGET, member.answeredCount)}/${PROMPT_TARGET} prompts`;
  return {
    code: shortId(member.id),
    name: nameFromEmail(email, member.id),
    city: profile.city,
    cue: `${profile.intention} in ${profile.city}. Prefers ${profile.revealPace.toLowerCase()} and a ${profile.dateStyle.toLowerCase()} first date.`,
    score: `${readinessScore(member)}`,
    status: memberStatus(member),
    stage: member.revealPaused ? `${stageBase} · reveal paused` : stageBase,
    language: profile.languages.join(" + "),
    tags: memberTags(member),
  };
};

// --- Sample fallbacks (used only when the real store is empty) ---

const sampleQueue: QueueMember[] = [
  {
    code: "AB-024",
    name: "Selam",
    city: "Addis Ababa",
    cue: "Loves jazz nights, buna talks, and slow Sunday walks",
    score: "94",
    status: "Ready for host",
    stage: "3/3 prompts",
    language: "Amharic + English",
    tags: ["Coffee ceremony", "Live music", "Family values"],
  },
  {
    code: "AB-031",
    name: "Nahom",
    city: "Hawassa",
    cue: "Food explorer looking for someone who can debate best shiro",
    score: "91",
    status: "Needs prompt",
    stage: "2/3 prompts",
    language: "Amharic",
    tags: ["Mesob dining", "Travel", "Faith"],
  },
  {
    code: "AB-047",
    name: "Mimi",
    city: "Dire Dawa",
    cue: "Keeps first dates playful with language games and old stories",
    score: "88",
    status: "Voice reveal ready",
    stage: "3/3 prompts",
    language: "Afan Oromo + English",
    tags: ["Storytelling", "Dance", "Language prompts"],
  },
];

const sampleSafety: DashboardSafetyReview[] = [
  { id: "SR-118", signal: "Photo reveal request before prompts", owner: "Hana", state: "Review" },
  { id: "SR-121", signal: "Repeated late cancellation", owner: "Dawit", state: "Watch" },
  { id: "SR-126", signal: "Venue feedback needs follow-up", owner: "Meklit", state: "Open" },
];

const mostCommon = (values: string[]): string | null => {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
};

export type MemberExportRow = {
  code: string;
  name: string;
  city: string;
  language: string;
  status: string;
  score: number;
  promptsAnswered: number;
  voiceSaved: number;
  onboardingComplete: boolean;
  dateAccepted: boolean;
  revealRequested: boolean;
  revealOpened: boolean;
};

/** Flat member rows for the CSV export on the ops console. */
export const getMemberExportRows = async (): Promise<MemberExportRow[]> => {
  const [members, accounts] = await Promise.all([readMembers(), listAccountSummaries()]);
  const emailById = new Map(accounts.map((account) => [account.id, account.email]));

  return members.map((member) => ({
    code: shortId(member.id),
    name: nameFromEmail(emailById.get(member.id), member.id),
    city: member.profile.city,
    language: member.profile.languages.join(" + "),
    status: memberStatus(member),
    score: readinessScore(member),
    promptsAnswered: member.answeredCount,
    voiceSaved: member.savedVoiceCount,
    onboardingComplete: member.onboardingComplete,
    dateAccepted: member.acceptedDatePlan,
    revealRequested: member.photoRevealRequested,
    revealOpened: member.photoRevealOpened,
  }));
};

export const getDashboardData = async (): Promise<DashboardData> => {
  const [members, accounts, heldChat] = await Promise.all([
    readMembers(),
    listAccountSummaries(),
    getHeldReviews(),
  ]);

  const emailById = new Map(accounts.map((account) => [account.id, account.email]));
  const nameById = (id: string) => nameFromEmail(emailById.get(id), id);

  const onboarded = members.filter((member) => member.onboardingComplete);
  const totalPromptAnswers = members.reduce((sum, member) => sum + member.answeredCount, 0);
  const revealRequested = members.filter((member) => member.photoRevealRequested).length;
  const revealOpened = members.filter((member) => member.photoRevealOpened).length;
  const fullyAnswered = members.filter((member) => member.answeredCount >= PROMPT_TARGET).length;
  const withVoice = members.filter((member) => member.savedVoiceCount > 0).length;
  const avgAnswers = members.length ? (totalPromptAnswers / members.length).toFixed(1) : "0";

  // Safety: reveal requested before the prompt exchange is complete, plus held chat.
  const revealBeforePrompts: DashboardSafetyReview[] = members
    .filter((member) => member.photoRevealRequested && member.answeredCount < PROMPT_TARGET)
    .map((member) => ({
      id: `RV-${member.id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()}`,
      signal: `${nameById(member.id)} requested a photo reveal before finishing prompts`,
      owner: nameById(member.id),
      state: "Review",
    }));

  const heldReviews: DashboardSafetyReview[] = heldChat.map((review) => ({
    id: review.id.slice(0, 8),
    signal: `${nameById(review.senderId)} → ${nameById(review.recipientId)}: ${review.text.slice(0, 80)} (${review.flagReason})`,
    owner: nameById(review.senderId),
    state: "Held",
  }));

  const realSafety = [...heldReviews, ...revealBeforePrompts];
  const safetyCount = realSafety.length;

  const metrics: DashboardMetric[] = [
    {
      label: "Members onboarded",
      value: `${onboarded.length}`,
      detail: `of ${members.length || accounts.length} registered`,
      tone: "good",
    },
    {
      label: "Prompt answers logged",
      value: `${totalPromptAnswers}`,
      detail: `avg ${avgAnswers} per member`,
      tone: "good",
    },
    {
      label: "Reveal requests",
      value: `${revealRequested}`,
      detail: revealOpened ? `${revealOpened} mutually opened` : "awaiting mutual consent",
      tone: "good",
    },
    {
      label: "Safety holds",
      value: `${safetyCount}`,
      detail: safetyCount ? "need host review" : "queue clear",
      tone: safetyCount > 0 ? "watch" : "good",
    },
  ];

  const realQueue = [...onboarded]
    .sort((first, second) => {
      const scoreDelta = readinessScore(second) - readinessScore(first);
      if (scoreDelta !== 0) return scoreDelta;
      return second.updatedAt > first.updatedAt ? 1 : -1;
    })
    .slice(0, 6)
    .map((member) => toQueueMember(member, emailById.get(member.id)));

  const workflow: WorkflowStat[] = [
    {
      label: "Prompt lock",
      value: `${fullyAnswered}`,
      detail: "members completed the blind-first exchange.",
    },
    {
      label: "Voice window",
      value: `${withVoice}`,
      detail: "have saved a voice intro before any photo reveal.",
    },
    {
      label: "Venue route",
      value: mostCommon(onboarded.map((member) => member.selectedSpot)) ?? "—",
      detail: "most requested hosted table this room.",
    },
  ];

  return {
    metrics,
    queue: realQueue.length ? realQueue : sampleQueue,
    usingRealQueue: realQueue.length > 0,
    safetyReviews: (realSafety.length ? realSafety : sampleSafety).slice(0, 5),
    usingRealSafety: realSafety.length > 0,
    workflow,
    totalMembers: members.length,
    onboardedMembers: onboarded.length,
  };
};
