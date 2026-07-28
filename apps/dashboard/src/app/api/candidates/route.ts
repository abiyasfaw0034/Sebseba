import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http";
import { getAuthenticatedMemberId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const methods = "GET, OPTIONS";
const dataFile = path.join(process.cwd(), ".data", "member-state.json");

type CandidateProfile = {
  intention: string;
  city: string;
  languages: string[];
  faithComfort: string;
  familyExpectation: string;
  revealPace: string;
  dateStyle: string;
  dealbreakers: string[];
};

type CandidateSummary = {
  id: string;
  profile: CandidateProfile;
  answeredPromptCount: number;
  updatedAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback: string, maxLength = 240) => {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
};

const asStringArray = (value: unknown, fallback: string[]) => {
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

const buildProfile = (value: unknown): CandidateProfile => {
  const input = isRecord(value) ? value : {};
  return {
    intention: asString(input.intention, "Long-term"),
    city: asString(input.city, "Addis Ababa"),
    languages: asStringArray(input.languages, ["Amharic"]),
    faithComfort: asString(input.faithComfort, "Respectful of faith routines"),
    familyExpectation: asString(input.familyExpectation, "Introduce after trust"),
    revealPace: asString(input.revealPace, "Voice before photos"),
    dateStyle: asString(input.dateStyle, "Buna first"),
    dealbreakers: asStringArray(input.dealbreakers, []),
  };
};

const countAnsweredPrompts = (member: Record<string, unknown>): number => {
  const ids = Array.isArray(member.answeredPromptIds)
    ? member.answeredPromptIds.filter((item) => typeof item === "string")
    : [];
  const answerKeys = isRecord(member.promptAnswers) ? Object.keys(member.promptAnswers) : [];
  return new Set([...ids, ...answerKeys]).size;
};

const readCandidates = async (selfId: string): Promise<CandidateSummary[]> => {
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!isRecord(parsed) || !isRecord(parsed.members)) {
      return [];
    }

    const candidates = Object.entries(parsed.members).flatMap<CandidateSummary>(([memberId, member]) => {
      if (!isRecord(member) || memberId === selfId || member.onboardingComplete !== true) {
        return [];
      }

      return [
        {
          id: memberId,
          profile: buildProfile(member.profile),
          answeredPromptCount: countAnsweredPrompts(member),
          updatedAt: asString(member.updatedAt, "", 40),
        },
      ];
    });

    return candidates
      .sort((first, second) => (second.updatedAt > first.updatedAt ? 1 : -1))
      .slice(0, 25);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Could not read candidates", error);
    }
    return [];
  }
};

export const OPTIONS = () => corsPreflight(methods);

export const GET = async (request: NextRequest) => {
  const memberId = getAuthenticatedMemberId(request);

  if (!memberId) {
    return withCors(NextResponse.json({ error: "Authentication required." }, { status: 401 }), methods);
  }

  const candidates = await readCandidates(memberId);
  return withCors(NextResponse.json({ candidates }), methods);
};
