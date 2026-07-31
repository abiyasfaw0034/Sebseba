import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

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

type OnboardingStep = {
  key: keyof OnboardingProfile;
  mode: 'single' | 'multi';
  kicker: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  options: string[];
};

type CandidateMatch = {
  id: string;
  handle: string;
  city: string;
  distance: string;
  intention: string;
  languages: string[];
  faithComfort: string;
  familyExpectation: string;
  revealPace: string;
  dateStyle: string;
  dealbreakers: string[];
  riskSignals: string[];
  cues: string[];
  intro: string;
  hostNote: string;
  voicePrompt: string;
};

type RankedMatch = CandidateMatch & {
  score: number;
  reasons: string[];
  sharedLanguages: string[];
  riskConflicts: string[];
};

type ChatMessageStatus = 'sent' | 'held';

// One member-to-member message, from the current viewer's perspective (the backend
// tags each message 'me' or 'them' and hides the peer's still-held messages).
type ThreadMessage = {
  id: string;
  author: 'me' | 'them';
  text: string;
  createdAt: string;
  status: ChatMessageStatus;
  flagged: boolean;
  flagReason?: string;
  readAt: string | null;
};

// One conversation summary for the match inbox / unread badges.
type InboxSummary = {
  peerId: string;
  lastMessageText: string;
  lastMessageAt: string;
  lastMessageAuthor: 'me' | 'them';
  lastMessageStatus: ChatMessageStatus;
  unreadCount: number;
};

type PersistedMemberState = {
  memberId?: string;
  onboardingComplete?: boolean;
  profile?: OnboardingProfile;
  selectedMatchId?: string;
  selectedCue?: string;
  selectedSpot?: string;
  selectedPrompt?: string;
  answeredPromptIds?: string[];
  promptAnswers?: Record<string, string>;
  activeVoicePromptId?: string;
  savedVoicePromptIds?: string[];
  acceptedDatePlan?: boolean;
  photoRevealRequested?: boolean;
  matchRevealConsentGranted?: boolean;
  photoRevealOpened?: boolean;
  revealPausedUntil?: string | null;
  updatedAt?: string;
};

type SyncStatus = 'loading' | 'saving' | 'saved' | 'offline';
type AppTab = 'Match' | 'Talks' | 'Dates' | 'Me';

const defaultOnboardingProfile: OnboardingProfile = {
  intention: 'Long-term',
  city: 'Addis Ababa',
  languages: ['Amharic', 'English'],
  faithComfort: 'Respectful of faith routines',
  familyExpectation: 'Family matters early',
  revealPace: 'Voice before photos',
  dateStyle: 'Buna first',
  dealbreakers: ['Rushed photos'],
};

const onboardingSteps: OnboardingStep[] = [
  {
    key: 'intention',
    mode: 'single',
    kicker: 'Dating intention',
    title: 'What are you hoping to build?',
    icon: 'heart-outline',
    options: ['Marriage-minded', 'Long-term', 'Intentional dating', 'Friendship first'],
  },
  {
    key: 'city',
    mode: 'single',
    kicker: 'Location',
    title: 'Where should matches start?',
    icon: 'location-outline',
    options: ['Addis Ababa', 'Hawassa', 'Dire Dawa', 'Adama', 'Diaspora'],
  },
  {
    key: 'languages',
    mode: 'multi',
    kicker: 'Language',
    title: 'Which languages feel natural?',
    icon: 'chatbubbles-outline',
    options: ['Amharic', 'Tigrinya', 'Afan Oromo', 'English', 'Diaspora mix'],
  },
  {
    key: 'faithComfort',
    mode: 'single',
    kicker: 'Faith comfort',
    title: 'How should faith fit dating?',
    icon: 'sunny-outline',
    options: ['Faith is central', 'Respectful of faith routines', 'Open, not defining', 'Prefer secular dating'],
  },
  {
    key: 'familyExpectation',
    mode: 'single',
    kicker: 'Family expectations',
    title: 'When should family context matter?',
    icon: 'people-outline',
    options: ['Family matters early', 'Introduce after trust', 'Private at first', 'Diaspora flexible'],
  },
  {
    key: 'revealPace',
    mode: 'single',
    kicker: 'Reveal pace',
    title: 'What unlocks photos for you?',
    icon: 'eye-off-outline',
    options: ['Voice before photos', 'Slow reveal', 'Prompt first', 'Open after host check'],
  },
  {
    key: 'dateStyle',
    mode: 'single',
    kicker: 'First date setting',
    title: 'What feels comfortable first?',
    icon: 'cafe-outline',
    options: ['Buna first', 'Mesob dinner', 'Art walk', 'Live music', 'Community event'],
  },
  {
    key: 'dealbreakers',
    mode: 'multi',
    kicker: 'Dealbreakers',
    title: 'What should we protect against?',
    icon: 'shield-checkmark-outline',
    options: ['Rushed photos', 'Disrespectful jokes', 'Late-night pressure', 'No hosted dates', 'Different faith pace'],
  },
];

const candidateMatches: CandidateMatch[] = [
  {
    id: 'AB-024',
    handle: 'Match 24',
    city: 'Addis Ababa',
    distance: '4 km away',
    intention: 'Long-term',
    languages: ['Amharic', 'English'],
    faithComfort: 'Respectful of faith routines',
    familyExpectation: 'Family matters early',
    revealPace: 'Voice before photos',
    dateStyle: 'Buna first',
    dealbreakers: ['Rushed photos', 'Late-night pressure'],
    riskSignals: [],
    cues: ['Buna conversation', 'Orthodox holidays', 'Ethio-jazz', 'Family stories'],
    intro: 'Enjoys quiet coffee rooms, old jazz records, and conversations that do not rush the reveal.',
    hostNote: 'Strong fit for a hosted buna table with a gentle voice intro.',
    voicePrompt: 'Tell a short story about a song that feels like home.',
  },
  {
    id: 'AB-031',
    handle: 'Match 31',
    city: 'Hawassa',
    distance: '270 km away',
    intention: 'Marriage-minded',
    languages: ['Amharic', 'Tigrinya'],
    faithComfort: 'Faith is central',
    familyExpectation: 'Family matters early',
    revealPace: 'Prompt first',
    dateStyle: 'Mesob dinner',
    dealbreakers: ['Disrespectful jokes', 'No hosted dates'],
    riskSignals: ['Different faith pace'],
    cues: ['Mesob dining', 'Weekend travel', 'Faith routines', 'Family values'],
    intro: 'Food explorer who likes structured plans, family context, and thoughtful questions before photos.',
    hostNote: 'Best if both people agree on faith pace before the voice reveal.',
    voicePrompt: 'Share what hospitality means at your family table.',
  },
  {
    id: 'AB-047',
    handle: 'Match 47',
    city: 'Dire Dawa',
    distance: '515 km away',
    intention: 'Intentional dating',
    languages: ['Afan Oromo', 'English'],
    faithComfort: 'Open, not defining',
    familyExpectation: 'Private at first',
    revealPace: 'Slow reveal',
    dateStyle: 'Art walk',
    dealbreakers: ['Rushed photos'],
    riskSignals: [],
    cues: ['Storytelling', 'Language games', 'Dance', 'Old city walks'],
    intro: 'Keeps first conversations playful with language games, stories, and low-pressure plans.',
    hostNote: 'Good fit for someone who wants privacy before family context.',
    voicePrompt: 'Describe a childhood place you would show someone you trust.',
  },
  {
    id: 'AB-052',
    handle: 'Match 52',
    city: 'Diaspora',
    distance: 'Remote first',
    intention: 'Long-term',
    languages: ['English', 'Diaspora mix', 'Amharic'],
    faithComfort: 'Respectful of faith routines',
    familyExpectation: 'Diaspora flexible',
    revealPace: 'Open after host check',
    dateStyle: 'Community event',
    dealbreakers: ['Late-night pressure', 'Disrespectful jokes'],
    riskSignals: [],
    cues: ['Diaspora stories', 'Community events', 'Music swaps', 'Family calls'],
    intro: 'Balances diaspora life with cultural roots and prefers host-checked reveals.',
    hostNote: 'Strong remote-first option when local distance is less important.',
    voicePrompt: 'Say what you miss most about home during holidays.',
  },
];

const promptExchange = [
  {
    id: 'song',
    cue: 'Music',
    question: 'Which song belongs in a first date playlist?',
  },
  {
    id: 'table',
    cue: 'Date table',
    question: 'Choose the first date table: buna, tibs, or art walk.',
  },
  {
    id: 'care',
    cue: 'Values',
    question: 'What tradition taught you how to care for people?',
  },
];

const promptExchangeIds = promptExchange.map((prompt) => prompt.id);

const voicePrompts = [
  {
    id: 'home',
    cue: 'Voice intro',
    question: 'Say 20 seconds about a song, place, or meal that feels like home.',
  },
  {
    id: 'pace',
    cue: 'Reveal pace',
    question: 'Tell your match what helps you feel comfortable before photos open.',
  },
  {
    id: 'date',
    cue: 'First date',
    question: 'Describe the first hosted date setting that would make you relax.',
  },
];

const dateSpots = [
  { name: 'Buna corner', detail: 'Quiet tables, hosted introductions', icon: 'coffee-outline' },
  { name: 'Mesob dinner', detail: 'Shared meal with guided prompts', icon: 'food-turkey' },
  { name: 'Art walk', detail: 'Low pressure weekend plan', icon: 'palette-outline' },
];

const tabs: { label: AppTab; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Match', icon: 'heart-outline' },
  { label: 'Talks', icon: 'chatbubble-ellipses-outline' },
  { label: 'Dates', icon: 'calendar-outline' },
  { label: 'Me', icon: 'person-outline' },
];

const chatModerationRules = [
  {
    label: 'contact detail',
    pattern:
      /(\+?\d[\d\s().-]{7,}\d)|\b[\w.-]+@[\w.-]+\.\w{2,}\b|(^|\s)@[a-z0-9_.]{2,}\b/i,
  },
  {
    label: 'off-app request',
    pattern: /\b(text me|call me|dm me|outside (the )?app|move to|whatsapp|telegram|instagram|snapchat)\b/i,
  },
  {
    label: 'photo pressure',
    pattern:
      /\b(send|show|share|drop|need|want)\b.{0,24}\b(photos?|pics?|pictures?|selfie|image)\b|\b(photos?|pics?|pictures?|selfie|image)\b.{0,24}\b(send|show|share|drop)\b/i,
  },
  {
    label: 'boundary pressure',
    pattern: /\b(skip the host|no host|prove it|right now|don't tell|dont tell)\b/i,
  },
];

const getChatModerationTags = (message: string) =>
  chatModerationRules.filter((rule) => rule.pattern.test(message)).map((rule) => rule.label);

const formatChatTime = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Now';
  }

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const apiBaseUrl = process.env.EXPO_PUBLIC_ABIYASFAW_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
const memberStateEndpoint = `${apiBaseUrl}/api/member-state`;
const candidatesEndpoint = `${apiBaseUrl}/api/candidates`;
const messagesEndpoint = `${apiBaseUrl}/api/messages`;
const inboxEndpoint = `${apiBaseUrl}/api/inbox`;
const authRegisterEndpoint = `${apiBaseUrl}/api/auth/register`;
const authLoginEndpoint = `${apiBaseUrl}/api/auth/login`;
const authSessionEndpoint = `${apiBaseUrl}/api/auth/session`;

type CandidateSummary = {
  id: string;
  profile: OnboardingProfile;
  answeredPromptCount: number;
};

const cueByDateStyle: Record<string, string> = {
  'Buna first': 'Buna conversation',
  'Mesob dinner': 'Mesob dining',
  'Art walk': 'Old city walks',
  'Live music': 'Ethio-jazz',
  'Community event': 'Community events',
};

const cueByFaith: Record<string, string> = {
  'Faith is central': 'Faith routines',
  'Respectful of faith routines': 'Orthodox holidays',
  'Open, not defining': 'Open conversations',
  'Prefer secular dating': 'City life',
};

const buildCuesFromProfile = (profile: OnboardingProfile): string[] => {
  const cues = [
    cueByDateStyle[profile.dateStyle] ?? 'Buna conversation',
    cueByFaith[profile.faithComfort] ?? 'Family stories',
    profile.languages[0] ? `${profile.languages[0]} chats` : 'Language games',
    'Family stories',
  ];
  return Array.from(new Set(cues)).slice(0, 4);
};

// Turns another member's onboarding profile into a blind-match card. Curated fields
// (handle, cues, intro) are synthesized from their profile since real members do not
// carry the hand-authored copy the seed samples have.
const buildCandidateFromSummary = (summary: CandidateSummary): CandidateMatch => {
  const profile = summary.profile;
  const suffix = (summary.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || 'MTCH').toUpperCase();
  const prompts = summary.answeredPromptCount;

  return {
    id: summary.id,
    handle: `Match ${suffix}`,
    city: profile.city,
    distance: profile.city === 'Diaspora' ? 'Remote first' : 'Nearby',
    intention: profile.intention,
    languages: profile.languages,
    faithComfort: profile.faithComfort,
    familyExpectation: profile.familyExpectation,
    revealPace: profile.revealPace,
    dateStyle: profile.dateStyle,
    dealbreakers: profile.dealbreakers,
    riskSignals: [],
    cues: buildCuesFromProfile(profile),
    intro: `${profile.intention} in ${profile.city}. Prefers ${profile.revealPace.toLowerCase()} and a ${profile.dateStyle.toLowerCase()} first date.`,
    hostNote: `${prompts} prompt${prompts === 1 ? '' : 's'} answered. A host can open a voice intro once you both feel ready.`,
    voicePrompt: 'Share a short story about a song, place, or meal that feels like home.',
  };
};

const sessionTokenKey = 'abiyasfaw_session_token';
// SecureStore is unavailable on web; fall back to localStorage there, with an in-memory mirror everywhere.
let memoryToken: string | null = null;

const persistSessionToken = async (token: string) => {
  memoryToken = token;
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(sessionTokenKey, token);
      }
    } else {
      await SecureStore.setItemAsync(sessionTokenKey, token);
    }
  } catch {
    // Keep the in-memory token even if secure storage is unavailable.
  }
};

const loadSessionToken = async (): Promise<string | null> => {
  if (memoryToken) {
    return memoryToken;
  }

  try {
    if (Platform.OS === 'web') {
      memoryToken = typeof localStorage !== 'undefined' ? localStorage.getItem(sessionTokenKey) : null;
    } else {
      memoryToken = await SecureStore.getItemAsync(sessionTokenKey);
    }
  } catch {
    memoryToken = null;
  }

  return memoryToken;
};

const clearSessionToken = async () => {
  memoryToken = null;
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(sessionTokenKey);
      }
    } else {
      await SecureStore.deleteItemAsync(sessionTokenKey);
    }
  } catch {
    // Ignore secure storage errors on sign-out.
  }
};

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';
type AuthMode = 'login' | 'register';

const syncCopy: Record<SyncStatus, string> = {
  loading: 'Loading profile',
  saving: 'Saving profile',
  saved: 'Profile saved',
  offline: 'Offline mode',
};

const mapDateStyleToSpot = (dateStyle: string) => {
  if (dateStyle === 'Mesob dinner') {
    return 'Mesob dinner';
  }

  if (dateStyle === 'Art walk' || dateStyle === 'Community event') {
    return 'Art walk';
  }

  return 'Buna corner';
};

const intentionGroups = [
  ['Marriage-minded', 'Long-term', 'Intentional dating'],
  ['Friendship first', 'Intentional dating'],
];

const areIntentionsCompatible = (first: string, second: string) =>
  first === second || intentionGroups.some((group) => group.includes(first) && group.includes(second));

const rankCandidate = (user: OnboardingProfile, candidate: CandidateMatch): RankedMatch => {
  const sharedLanguages = user.languages.filter((language) => candidate.languages.includes(language));
  const riskConflicts = user.dealbreakers.filter((dealbreaker) => candidate.riskSignals.includes(dealbreaker));
  const sharedBoundaries = user.dealbreakers.filter((dealbreaker) => candidate.dealbreakers.includes(dealbreaker));
  let score = 44;
  const reasons: string[] = [];

  if (areIntentionsCompatible(user.intention, candidate.intention)) {
    score += user.intention === candidate.intention ? 14 : 9;
    reasons.push(`${candidate.intention} intention`);
  }

  if (user.city === candidate.city) {
    score += 12;
    reasons.push(`${candidate.city} location`);
  } else if (user.city === 'Diaspora' || candidate.city === 'Diaspora') {
    score += 7;
    reasons.push('diaspora-friendly distance');
  }

  if (sharedLanguages.length > 0) {
    score += Math.min(18, sharedLanguages.length * 6);
    reasons.push(`${sharedLanguages.join(' + ')} language fit`);
  }

  if (user.faithComfort === candidate.faithComfort) {
    score += 10;
    reasons.push('faith pace aligned');
  }

  if (user.familyExpectation === candidate.familyExpectation) {
    score += 8;
    reasons.push('family expectations aligned');
  }

  if (user.revealPace === candidate.revealPace) {
    score += 10;
    reasons.push(candidate.revealPace.toLowerCase());
  }

  if (user.dateStyle === candidate.dateStyle || mapDateStyleToSpot(user.dateStyle) === mapDateStyleToSpot(candidate.dateStyle)) {
    score += 8;
    reasons.push(`${candidate.dateStyle} date style`);
  }

  if (sharedBoundaries.length > 0) {
    score += Math.min(6, sharedBoundaries.length * 3);
    reasons.push('shared safety boundaries');
  }

  score -= riskConflicts.length * 9;

  return {
    ...candidate,
    score: Math.max(42, Math.min(98, score)),
    reasons: reasons.slice(0, 4),
    sharedLanguages,
    riskConflicts,
  };
};

function AppContent() {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile>(defaultOnboardingProfile);
  const [selectedMatchId, setSelectedMatchId] = useState(candidateMatches[0].id);
  const [selectedCue, setSelectedCue] = useState(candidateMatches[0].cues[0]);
  const [selectedSpot, setSelectedSpot] = useState(mapDateStyleToSpot(defaultOnboardingProfile.dateStyle));
  const [selectedPrompt, setSelectedPrompt] = useState(promptExchange[0].id);
  const [answeredPromptIds, setAnsweredPromptIds] = useState<string[]>([]);
  const [promptAnswers, setPromptAnswers] = useState<Record<string, string>>({});
  const [activeVoicePromptId, setActiveVoicePromptId] = useState(voicePrompts[0].id);
  const [savedVoicePromptIds, setSavedVoicePromptIds] = useState<string[]>([]);
  const [acceptedDatePlan, setAcceptedDatePlan] = useState(false);
  const [photoRevealRequested, setPhotoRevealRequested] = useState(false);
  const [matchRevealConsentGranted, setMatchRevealConsentGranted] = useState(false);
  const [photoRevealOpened, setPhotoRevealOpened] = useState(false);
  const [revealPausedUntil, setRevealPausedUntil] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [inboxSummaries, setInboxSummaries] = useState<InboxSummary[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [memberStateLoaded, setMemberStateLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [activeTab, setActiveTab] = useState<AppTab>('Match');
  const [remoteCandidates, setRemoteCandidates] = useState<CandidateMatch[]>([]);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authMemberId, setAuthMemberId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authPasswordInput, setAuthPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const saveRequestRef = useRef(0);
  const { width } = useWindowDimensions();

  const cardWidth = useMemo(() => Math.min(width - 32, 430), [width]);
  // Real members (from the backend) when any exist; the seed samples otherwise.
  const activeCandidates = remoteCandidates.length > 0 ? remoteCandidates : candidateMatches;
  const usingRemoteCandidates = remoteCandidates.length > 0;
  const rankedMatches = useMemo(
    () => activeCandidates.map((candidate) => rankCandidate(onboardingProfile, candidate)).sort((a, b) => b.score - a.score),
    [activeCandidates, onboardingProfile],
  );
  const selectedMatch = rankedMatches.find((match) => match.id === selectedMatchId) ?? rankedMatches[0];
  const visibleSelectedCue = selectedMatch.cues.includes(selectedCue) ? selectedCue : selectedMatch.cues[0];
  const selectedPromptDetail =
    promptExchange.find((prompt) => prompt.id === selectedPrompt) ?? promptExchange[0];
  const activeVoicePrompt = voicePrompts.find((prompt) => prompt.id === activeVoicePromptId) ?? voicePrompts[0];
  const persistedAnsweredPromptIds = useMemo(
    () => Array.from(new Set([...answeredPromptIds, ...Object.keys(promptAnswers)])).filter((promptId) =>
      promptExchangeIds.includes(promptId),
    ),
    [answeredPromptIds, promptAnswers],
  );
  const answeredCount = persistedAnsweredPromptIds.length;
  const revealProgress = Math.round((answeredCount / promptExchange.length) * 100);
  const promptsRemaining = promptExchange.length - answeredCount;
  const selectedPromptAnswer = promptAnswers[selectedPrompt] ?? '';
  const activeOnboardingStep = onboardingSteps[onboardingIndex];
  const onboardingProgress = Math.round(((onboardingIndex + 1) / onboardingSteps.length) * 100);
  const revealPauseActive = revealPausedUntil ? new Date(revealPausedUntil).getTime() > Date.now() : false;
  const syncDetail =
    syncStatus === 'saved' && lastSyncedAt
      ? `Profile saved ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : syncCopy[syncStatus];
  const matchSignals = [
    { label: 'Best overlap', value: selectedMatch.reasons[0] ?? 'values aligned' },
    { label: 'Language fit', value: selectedMatch.sharedLanguages.join(' + ') || 'Host-assisted' },
    { label: 'Reveal pace', value: selectedMatch.revealPace },
  ];
  const revealRequirements = [
    { label: 'Prompt exchange complete', complete: answeredCount === promptExchange.length },
    { label: 'Voice intro saved', complete: savedVoicePromptIds.length > 0 },
    { label: 'Hosted date accepted', complete: acceptedDatePlan },
  ];
  const canRequestPhotoReveal = revealRequirements.every((requirement) => requirement.complete) && !revealPauseActive;
  const revealGateReady = canRequestPhotoReveal && photoRevealRequested && matchRevealConsentGranted;
  // Real member-to-member chat only works against a real backend member. Seed sample
  // matches (shown when no real members exist yet) have no peer to deliver to.
  const activePeerId = usingRemoteCandidates ? selectedMatch.id : null;
  const chatAvailable = Boolean(activePeerId);
  const selectedHeldChatCount = threadMessages.filter((message) => message.status === 'held').length;
  const unreadByPeer = useMemo(() => {
    const counts: Record<string, number> = {};
    inboxSummaries.forEach((summary) => {
      counts[summary.peerId] = summary.unreadCount;
    });
    return counts;
  }, [inboxSummaries]);
  const totalUnread = useMemo(
    () => inboxSummaries.reduce((sum, summary) => sum + summary.unreadCount, 0),
    [inboxSummaries],
  );
  const chatDraftModerationTags = getChatModerationTags(chatDraft);
  const chatQuickStarts = [
    {
      label: 'Cue',
      text: `I liked the ${visibleSelectedCue.toLowerCase()} cue. What would you ask over buna?`,
    },
    {
      label: 'Pace',
      text: `Your ${selectedMatch.revealPace.toLowerCase()} pace feels comfortable to me too.`,
    },
    {
      label: 'Date',
      text: `${selectedSpot} sounds relaxed. What kind of first question makes you open up?`,
    },
  ];

  const signOut = async () => {
    await clearSessionToken();
    setAuthToken(null);
    setAuthMemberId(null);
    setAuthEmail(null);
    setAuthPasswordInput('');
    setAuthError(null);
    setMemberStateLoaded(false);
    setAuthStatus('unauthenticated');
  };

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const token = await loadSessionToken();

      if (!token) {
        if (!cancelled) {
          setAuthStatus('unauthenticated');
        }
        return;
      }

      try {
        const response = await fetch(authSessionEndpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(`Session check failed: ${response.status}`);
        }

        const session = (await response.json()) as { memberId?: string; email?: string };

        if (cancelled) {
          return;
        }

        setAuthToken(token);
        setAuthMemberId(session.memberId ?? null);
        setAuthEmail(session.email ?? null);
        setAuthStatus('authenticated');
      } catch {
        await clearSessionToken();

        if (!cancelled) {
          setAuthStatus('unauthenticated');
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authToken) {
      return undefined;
    }

    let cancelled = false;

    const loadMemberState = async () => {
      setMemberStateLoaded(false);
      setSyncStatus('loading');

      try {
        const response = await fetch(memberStateEndpoint, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (response.status === 401) {
          throw new Error('unauthorized');
        }

        if (!response.ok) {
          throw new Error(`Member state load failed: ${response.status}`);
        }

        const state = (await response.json()) as PersistedMemberState;
        const profile = {
          ...defaultOnboardingProfile,
          ...state.profile,
          languages: state.profile?.languages?.length ? state.profile.languages : defaultOnboardingProfile.languages,
          dealbreakers: state.profile?.dealbreakers?.length ? state.profile.dealbreakers : defaultOnboardingProfile.dealbreakers,
        };

        if (cancelled) {
          return;
        }

        setOnboardingProfile(profile);
        setOnboardingComplete(Boolean(state.onboardingComplete));
        setShowOnboarding(!state.onboardingComplete);
        setSelectedMatchId(state.selectedMatchId ?? candidateMatches[0].id);
        setSelectedCue(state.selectedCue ?? candidateMatches[0].cues[0]);
        setSelectedSpot(state.selectedSpot ?? mapDateStyleToSpot(profile.dateStyle));
        setSelectedPrompt(state.selectedPrompt ?? promptExchange[0].id);
        setAnsweredPromptIds(state.answeredPromptIds ?? []);
        setPromptAnswers(state.promptAnswers ?? {});
        setActiveVoicePromptId(state.activeVoicePromptId ?? voicePrompts[0].id);
        setSavedVoicePromptIds(state.savedVoicePromptIds ?? []);
        setAcceptedDatePlan(Boolean(state.acceptedDatePlan));
        setPhotoRevealRequested(Boolean(state.photoRevealRequested));
        setMatchRevealConsentGranted(Boolean(state.matchRevealConsentGranted));
        setPhotoRevealOpened(Boolean(state.photoRevealOpened));
        setRevealPausedUntil(state.revealPausedUntil ?? null);
        setLastSyncedAt(state.updatedAt ?? new Date().toISOString());
        setSyncStatus('saved');
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof Error && error.message === 'unauthorized') {
          await signOut();
          return;
        }

        setSyncStatus('offline');
      } finally {
        if (!cancelled) {
          setMemberStateLoaded(true);
        }
      }
    };

    loadMemberState();

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      setRemoteCandidates([]);
      return undefined;
    }

    let cancelled = false;

    const loadCandidates = async () => {
      try {
        const response = await fetch(candidatesEndpoint, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (!response.ok) {
          throw new Error(`Candidate load failed: ${response.status}`);
        }

        const data = (await response.json()) as { candidates?: CandidateSummary[] };
        const summaries = Array.isArray(data.candidates) ? data.candidates : [];
        const candidates = summaries
          .filter((summary) => summary && typeof summary.id === 'string' && summary.profile)
          .map(buildCandidateFromSummary);

        if (!cancelled) {
          setRemoteCandidates(candidates);
        }
      } catch {
        if (!cancelled) {
          setRemoteCandidates([]);
        }
      }
    };

    loadCandidates();

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    setDraft(promptAnswers[selectedPrompt] ?? '');
  }, [promptAnswers, selectedPrompt]);

  // Poll the match inbox for unread counts while signed in.
  useEffect(() => {
    if (!authToken) {
      setInboxSummaries([]);
      return undefined;
    }

    let cancelled = false;

    const loadInbox = async () => {
      try {
        const response = await fetch(inboxEndpoint, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (response.status === 401) {
          await signOut();
          return;
        }

        if (!response.ok) {
          throw new Error(`Inbox load failed: ${response.status}`);
        }

        const data = (await response.json()) as { conversations?: InboxSummary[] };

        if (!cancelled) {
          setInboxSummaries(Array.isArray(data.conversations) ? data.conversations : []);
        }
      } catch {
        // Keep the last known inbox on a transient failure.
      }
    };

    loadInbox();
    const interval = setInterval(loadInbox, 6000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authToken]);

  // Load and poll the open conversation (Talks tab, real peer), marking it read on open.
  useEffect(() => {
    if (!authToken || activeTab !== 'Talks' || !activePeerId) {
      return undefined;
    }

    let cancelled = false;
    const peerId = activePeerId;

    const loadThread = async (showSpinner: boolean) => {
      if (showSpinner) {
        setThreadLoading(true);
      }

      try {
        const response = await fetch(`${messagesEndpoint}?peerId=${encodeURIComponent(peerId)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (response.status === 401) {
          await signOut();
          return;
        }

        if (!response.ok) {
          throw new Error(`Thread load failed: ${response.status}`);
        }

        const data = (await response.json()) as { messages?: ThreadMessage[] };

        if (!cancelled) {
          setThreadMessages(Array.isArray(data.messages) ? data.messages : []);
        }
      } catch {
        // Keep the last known thread on a transient failure.
      } finally {
        if (!cancelled && showSpinner) {
          setThreadLoading(false);
        }
      }
    };

    const markRead = async () => {
      try {
        await fetch(inboxEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ peerId }),
        });

        if (!cancelled) {
          setInboxSummaries((current) =>
            current.map((summary) => (summary.peerId === peerId ? { ...summary, unreadCount: 0 } : summary)),
          );
        }
      } catch {
        // A failed read-receipt is non-critical; the next poll retries.
      }
    };

    setThreadMessages([]);
    loadThread(true);
    markRead();

    const interval = setInterval(() => {
      loadThread(false);
      markRead();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authToken, activeTab, activePeerId]);

  useEffect(() => {
    if (!memberStateLoaded || !authToken) {
      return undefined;
    }

    const timeout = setTimeout(async () => {
      const requestId = saveRequestRef.current + 1;
      saveRequestRef.current = requestId;
      setSyncStatus('saving');

      const payload: PersistedMemberState = {
        memberId: authMemberId ?? undefined,
        onboardingComplete,
        profile: onboardingProfile,
        selectedMatchId,
        selectedCue,
        selectedSpot,
        selectedPrompt,
        answeredPromptIds: persistedAnsweredPromptIds,
        promptAnswers,
        activeVoicePromptId,
        savedVoicePromptIds,
        acceptedDatePlan,
        photoRevealRequested,
        matchRevealConsentGranted,
        photoRevealOpened,
        revealPausedUntil,
      };

      try {
        const response = await fetch(memberStateEndpoint, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          await signOut();
          return;
        }

        if (!response.ok) {
          throw new Error(`Member state save failed: ${response.status}`);
        }

        const savedState = (await response.json()) as PersistedMemberState;

        if (saveRequestRef.current === requestId) {
          setLastSyncedAt(savedState.updatedAt ?? new Date().toISOString());
          setSyncStatus('saved');
        }
      } catch {
        if (saveRequestRef.current === requestId) {
          setSyncStatus('offline');
        }
      }
    }, 650);

    return () => clearTimeout(timeout);
  }, [
    authMemberId,
    authToken,
    acceptedDatePlan,
    activeVoicePromptId,
    matchRevealConsentGranted,
    photoRevealOpened,
    memberStateLoaded,
    onboardingComplete,
    onboardingProfile,
    persistedAnsweredPromptIds,
    photoRevealRequested,
    promptAnswers,
    revealPausedUntil,
    savedVoicePromptIds,
    selectedCue,
    selectedMatchId,
    selectedPrompt,
    selectedSpot,
  ]);

  const updateOnboardingValue = <Key extends keyof OnboardingProfile>(
    key: Key,
    value: OnboardingProfile[Key],
  ) => {
    setOnboardingProfile((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const toggleMultiChoice = (key: 'languages' | 'dealbreakers', option: string) => {
    setOnboardingProfile((current) => {
      const selected = current[key];
      const exists = selected.includes(option);
      const nextValue = exists ? selected.filter((item) => item !== option) : [...selected, option];

      return {
        ...current,
        [key]: nextValue.length ? nextValue : selected,
      };
    });
  };

  const completeOnboardingStep = () => {
    if (onboardingIndex === onboardingSteps.length - 1) {
      setOnboardingComplete(true);
      setShowOnboarding(false);
      setSelectedMatchId(rankedMatches[0].id);
      setSelectedCue(rankedMatches[0].cues[0]);
      setSelectedSpot(mapDateStyleToSpot(onboardingProfile.dateStyle));
      setAcceptedDatePlan(false);
      setPhotoRevealRequested(false);
      setMatchRevealConsentGranted(false);
      setPhotoRevealOpened(false);
      return;
    }

    setOnboardingIndex((current) => current + 1);
  };

  const goBackOnboardingStep = () => {
    setOnboardingIndex((current) => Math.max(0, current - 1));
  };

  const chooseMatch = (match: RankedMatch) => {
    setSelectedMatchId(match.id);
    setSelectedCue(match.cues[0]);
    setSelectedSpot(mapDateStyleToSpot(match.dateStyle));
    setActiveTab('Match');
    setAcceptedDatePlan(false);
    setPhotoRevealRequested(false);
    setMatchRevealConsentGranted(false);
    setPhotoRevealOpened(false);
  };

  const saveAnswer = () => {
    const answer = draft.trim();

    if (!answer || persistedAnsweredPromptIds.includes(selectedPrompt)) {
      return;
    }

    setPromptAnswers((current) => ({
      ...current,
      [selectedPrompt]: answer,
    }));
    setAnsweredPromptIds((current) => Array.from(new Set([...current, selectedPrompt])));
  };

  const saveVoiceDraft = () => {
    if (savedVoicePromptIds.includes(activeVoicePromptId)) {
      return;
    }

    setSavedVoicePromptIds((current) => [...current, activeVoicePromptId]);
  };

  const requestPhotoReveal = () => {
    if (!canRequestPhotoReveal || photoRevealRequested) {
      return;
    }

    setPhotoRevealRequested(true);
    setPhotoRevealOpened(false);
    setMatchRevealConsentGranted(false);
  };

  const grantMatchRevealConsent = () => {
    if (!photoRevealRequested || revealPauseActive) {
      return;
    }

    setMatchRevealConsentGranted(true);
    setPhotoRevealOpened(true);
  };

  const resetPhotoRevealConsent = () => {
    setPhotoRevealRequested(false);
    setMatchRevealConsentGranted(false);
    setPhotoRevealOpened(false);
  };

  const sendChatMessage = async () => {
    const text = chatDraft.trim().replace(/\s+/g, ' ').slice(0, 500);

    if (!text || chatSending || !activePeerId || !authToken) {
      return;
    }

    setChatSending(true);
    setChatError(null);

    try {
      const response = await fetch(messagesEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ toMemberId: activePeerId, text }),
      });

      if (response.status === 401) {
        await signOut();
        return;
      }

      if (!response.ok) {
        throw new Error(`Send failed: ${response.status}`);
      }

      const data = (await response.json()) as { message?: ThreadMessage };

      if (data.message) {
        const delivered = data.message;
        // Append our own message immediately; the peer receives it via their poll.
        setThreadMessages((current) => [...current, delivered].slice(-120));
      }

      setChatDraft('');
    } catch {
      setChatError('Could not send. Check your connection and try again.');
    } finally {
      setChatSending(false);
    }
  };

  const toggleAuthMode = () => {
    setAuthMode((current) => (current === 'login' ? 'register' : 'login'));
    setAuthError(null);
  };

  const submitAuth = async () => {
    if (authSubmitting) {
      return;
    }

    const email = authEmailInput.trim().toLowerCase();
    const password = authPasswordInput;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError('Enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }

    setAuthSubmitting(true);
    setAuthError(null);

    try {
      const response = await fetch(authMode === 'login' ? authLoginEndpoint : authRegisterEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json().catch(() => null)) as
        | { token?: string; memberId?: string; email?: string; error?: string }
        | null;

      if (!response.ok || !data?.token || !data?.memberId) {
        setAuthError(data?.error ?? 'Could not sign you in. Please try again.');
        return;
      }

      await persistSessionToken(data.token);
      setAuthToken(data.token);
      setAuthMemberId(data.memberId);
      setAuthEmail(data.email ?? email);
      setAuthPasswordInput('');
      setAuthStatus('authenticated');
    } catch {
      setAuthError('Could not reach the server. Check your connection and try again.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  if (authStatus === 'checking') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.splash}>
          <ActivityIndicator color="#0c5a41" size="large" />
          <Text style={styles.splashText}>Loading Abiyasfaw</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (authStatus !== 'authenticated') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>Abiyasfaw</Text>
              <Text style={styles.subtle}>
                {authMode === 'login' ? 'Sign in to your private account' : 'Create your private account'}
              </Text>
            </View>
          </View>

          <View style={[styles.card, { width: cardWidth }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.kicker}>{authMode === 'login' ? 'Welcome back' : 'Get started'}</Text>
                <Text style={styles.sectionTitle}>
                  {authMode === 'login' ? 'Sign in to keep matching' : 'Your matches stay private'}
                </Text>
              </View>
              <Ionicons name="lock-closed-outline" size={23} color="#0c5a41" />
            </View>

            <View style={styles.authField}>
              <Text style={styles.answerLabel}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setAuthEmailInput}
                placeholder="you@example.com"
                placeholderTextColor="#7a8377"
                style={styles.authInput}
                textContentType="emailAddress"
                value={authEmailInput}
              />
            </View>

            <View style={styles.authField}>
              <Text style={styles.answerLabel}>Password</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                autoCorrect={false}
                onChangeText={setAuthPasswordInput}
                onSubmitEditing={submitAuth}
                placeholder="At least 8 characters"
                placeholderTextColor="#7a8377"
                secureTextEntry
                style={styles.authInput}
                textContentType="password"
                value={authPasswordInput}
              />
            </View>

            {authError ? (
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle-outline" size={18} color="#c62b23" />
                <Text style={styles.warningText}>{authError}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={authSubmitting}
              onPress={submitAuth}
              style={[styles.saveButton, authSubmitting ? styles.buttonDisabled : null]}
            >
              <Ionicons name={authMode === 'login' ? 'log-in-outline' : 'person-add-outline'} size={17} color="#ffffff" />
              <Text style={styles.saveButtonText}>
                {authSubmitting ? 'Please wait' : authMode === 'login' ? 'Sign in' : 'Create account'}
              </Text>
            </Pressable>

            <Pressable accessibilityRole="button" onPress={toggleAuthMode} style={styles.authToggle}>
              <Text style={styles.authToggleText}>
                {authMode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.safetyRow, { width: cardWidth }]}>
            <View style={styles.safetyIcon}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#0c5a41" />
            </View>
            <Text style={styles.safetyText}>
              Your onboarding lens, prompts, and reveal progress are tied to this account and stay private to you.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (showOnboarding || !onboardingComplete) {
    const currentValue = onboardingProfile[activeOnboardingStep.key];

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>Abiyasfaw</Text>
              <Text style={styles.subtle}>Build your match lens</Text>
              <Text style={[styles.syncText, syncStatus === 'offline' ? styles.syncTextOffline : null]}>{syncDetail}</Text>
            </View>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>
                {onboardingIndex + 1}/{onboardingSteps.length}
              </Text>
            </View>
          </View>

          <View style={[styles.onboardingHero, { width: cardWidth }]}>
            <View style={styles.onboardingIcon}>
              <Ionicons name={activeOnboardingStep.icon} size={28} color="#ffffff" />
            </View>
            <Text style={styles.kicker}>{activeOnboardingStep.kicker}</Text>
            <Text style={styles.onboardingTitle}>{activeOnboardingStep.title}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${onboardingProgress}%` }]} />
            </View>
          </View>

          <View style={[styles.card, { width: cardWidth }]}>
            <View style={styles.choiceList}>
              {activeOnboardingStep.options.map((option) => {
                const selected = Array.isArray(currentValue)
                  ? currentValue.includes(option)
                  : currentValue === option;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={option}
                    onPress={() => {
                      if (activeOnboardingStep.mode === 'multi') {
                        toggleMultiChoice(activeOnboardingStep.key as 'languages' | 'dealbreakers', option);
                      } else {
                        updateOnboardingValue(
                          activeOnboardingStep.key,
                          option as OnboardingProfile[typeof activeOnboardingStep.key],
                        );
                      }
                    }}
                    style={[styles.choiceRow, selected ? styles.choiceRowActive : null]}
                  >
                    <View style={[styles.choiceMarker, selected ? styles.choiceMarkerActive : null]}>
                      {selected ? <Ionicons name="checkmark" size={16} color="#ffffff" /> : null}
                    </View>
                    <Text style={[styles.choiceText, selected ? styles.choiceTextActive : null]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.onboardingSummary}>
              <Text style={styles.answerLabel}>Current lens</Text>
              <Text style={styles.onboardingSummaryText}>
                {onboardingProfile.intention} in {onboardingProfile.city}, {onboardingProfile.revealPace.toLowerCase()}.
              </Text>
            </View>
          </View>

          <View style={[styles.onboardingActions, { width: cardWidth }]}>
            <Pressable
              accessibilityRole="button"
              disabled={onboardingIndex === 0}
              onPress={goBackOnboardingStep}
              style={[styles.backButton, onboardingIndex === 0 ? styles.buttonDisabled : null]}
            >
              <Ionicons name="arrow-back" size={18} color="#1f241f" />
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={completeOnboardingStep} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>
                {onboardingIndex === onboardingSteps.length - 1 ? 'Start matching' : 'Continue'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.brand}>Abiyasfaw</Text>
            <Text style={styles.subtle} numberOfLines={1}>
              {authEmail ?? 'Blind match room'}
            </Text>
            <Text style={[styles.syncText, syncStatus === 'offline' ? styles.syncTextOffline : null]}>{syncDetail}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="Edit onboarding"
              onPress={() => setShowOnboarding(true)}
              style={styles.iconButton}
            >
              <Ionicons name="create-outline" size={21} color="#1f241f" />
            </Pressable>
            <Pressable accessibilityLabel="Sign out" onPress={signOut} style={styles.iconButton}>
              <Ionicons name="log-out-outline" size={21} color="#c62b23" />
            </Pressable>
          </View>
        </View>

        {activeTab === 'Talks' ? (
          <>
            <View style={[styles.card, { width: cardWidth }]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.kicker}>Reveal-safe chat</Text>
                  <Text style={styles.sectionTitle}>Talk with {selectedMatch.handle}</Text>
                </View>
                <Ionicons name="chatbubble-ellipses-outline" size={23} color="#0c5a41" />
              </View>
              <View style={styles.chatMatchRow}>
                <View style={styles.chatAvatar}>
                  <Text style={styles.chatAvatarText}>{selectedMatch.handle.replace('Match ', '')}</Text>
                </View>
                <View style={styles.chatMatchCopy}>
                  <Text style={styles.rankedName}>{selectedMatch.handle}</Text>
                  <Text style={styles.rankedMeta}>
                    {selectedMatch.score}% fit - {selectedMatch.city}
                  </Text>
                  <Text style={styles.rankedReason}>{selectedMatch.hostNote}</Text>
                </View>
              </View>
              <View style={styles.guardrailGrid}>
                <View style={styles.guardrailTile}>
                  <Ionicons name="call-outline" size={17} color="#0c5a41" />
                  <Text style={styles.guardrailText}>Contacts held</Text>
                </View>
                <View style={styles.guardrailTile}>
                  <Ionicons name="image-outline" size={17} color="#0c5a41" />
                  <Text style={styles.guardrailText}>Photo pressure held</Text>
                </View>
                <View style={styles.guardrailTile}>
                  <Ionicons name="shield-checkmark-outline" size={17} color="#0c5a41" />
                  <Text style={styles.guardrailText}>{selectedHeldChatCount} host holds</Text>
                </View>
              </View>
            </View>

            <View style={[styles.card, { width: cardWidth }]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.kicker}>Conversation</Text>
                  <Text style={styles.sectionTitle}>
                    {threadMessages.length ? `${threadMessages.length} messages` : 'Start from a cultural cue'}
                  </Text>
                </View>
                {threadLoading ? (
                  <ActivityIndicator size="small" color="#0c5a41" />
                ) : (
                  <Ionicons name="lock-closed-outline" size={22} color="#0c5a41" />
                )}
              </View>
              <View style={styles.chatList}>
                <View style={[styles.chatBubble, styles.chatBubbleHost]}>
                  <View style={styles.chatBubbleHeader}>
                    <Text style={styles.chatAuthor}>Host</Text>
                    <Text style={styles.chatTime}>Now</Text>
                  </View>
                  <Text style={styles.chatMessageText}>
                    Keep the first thread blind: prompts, voice pace, and hosted-date comfort stay in bounds.
                  </Text>
                </View>
                {!chatAvailable ? (
                  <View style={styles.emptyChatBox}>
                    <Ionicons name="people-outline" size={18} color="#0c5a41" />
                    <Text style={styles.emptyChatText}>
                      Live chat opens once you match with a real member. Sample matches are for preview only.
                    </Text>
                  </View>
                ) : threadMessages.length === 0 ? (
                  <View style={styles.emptyChatBox}>
                    <Ionicons name="sparkles-outline" size={18} color="#0c5a41" />
                    <Text style={styles.emptyChatText}>
                      Try asking about {visibleSelectedCue.toLowerCase()} before any reveal request.
                    </Text>
                  </View>
                ) : null}
                {threadMessages.map((message) => {
                  const held = message.status === 'held';
                  const mine = message.author === 'me';

                  return (
                    <View
                      key={message.id}
                      style={[
                        styles.chatBubble,
                        mine ? styles.chatBubbleMine : styles.chatBubbleOther,
                        held ? styles.chatBubbleHeld : null,
                      ]}
                    >
                      <View style={styles.chatBubbleHeader}>
                        <Text style={styles.chatAuthor}>{mine ? 'You' : selectedMatch.handle}</Text>
                        <Text style={styles.chatTime}>{formatChatTime(message.createdAt)}</Text>
                      </View>
                      <Text style={styles.chatMessageText}>{message.text}</Text>
                      {held ? (
                        <View style={styles.heldBadge}>
                          <Ionicons name="alert-circle-outline" size={14} color="#9f201a" />
                          <Text style={styles.heldBadgeText}>Held for host: {message.flagReason}</Text>
                        </View>
                      ) : mine ? (
                        <Text style={styles.chatReceipt}>{message.readAt ? 'Read' : 'Delivered'}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={[styles.card, { width: cardWidth }]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.kicker}>Message composer</Text>
                  <Text style={styles.sectionTitle}>Write inside the reveal rules</Text>
                </View>
                <Ionicons name="send-outline" size={22} color="#0c5a41" />
              </View>
              <View style={styles.quickReplyGrid}>
                {chatQuickStarts.map((starter) => (
                  <Pressable
                    accessibilityRole="button"
                    key={starter.label}
                    onPress={() => setChatDraft(starter.text)}
                    style={styles.quickReplyChip}
                  >
                    <Text style={styles.quickReplyLabel}>{starter.label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                maxLength={500}
                multiline
                onChangeText={setChatDraft}
                placeholder="Send a blind-first message"
                placeholderTextColor="#7a8377"
                style={styles.answerInput}
                value={chatDraft}
              />
              <View style={[styles.moderationBox, chatDraftModerationTags.length ? styles.moderationBoxHeld : null]}>
                <Ionicons
                  name={chatDraftModerationTags.length ? 'alert-circle-outline' : 'checkmark-circle'}
                  size={17}
                  color={chatDraftModerationTags.length ? '#9f201a' : '#0c5a41'}
                />
                <Text style={[styles.moderationText, chatDraftModerationTags.length ? styles.moderationTextHeld : null]}>
                  {!chatAvailable
                    ? 'Live delivery opens with a real match'
                    : chatDraftModerationTags.length
                      ? `Will be held: ${chatDraftModerationTags.join(', ')}`
                      : 'Ready for blind-safe delivery'}
                </Text>
              </View>
              {chatError ? <Text style={styles.chatErrorText}>{chatError}</Text> : null}
              <Pressable
                accessibilityRole="button"
                disabled={!chatDraft.trim() || !chatAvailable || chatSending}
                onPress={sendChatMessage}
                style={[
                  styles.saveButton,
                  !chatDraft.trim() || !chatAvailable || chatSending ? styles.buttonDisabled : null,
                ]}
              >
                {chatSending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="send-outline" size={17} color="#ffffff" />
                )}
                <Text style={styles.saveButtonText}>
                  {chatSending
                    ? 'Sending…'
                    : chatDraftModerationTags.length
                      ? 'Send to host review'
                      : 'Send message'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {activeTab === 'Match' ? (
          <>
        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Ranked blind matches</Text>
              <Text style={styles.sectionTitle}>
                {usingRemoteCandidates ? 'Real members near your lens' : 'Choose by fit before photos'}
              </Text>
            </View>
            <Ionicons name="git-branch-outline" size={23} color="#0c5a41" />
          </View>
          <View style={styles.rankedList}>
            {rankedMatches.map((match) => {
              const active = match.id === selectedMatch.id;
              const unread = unreadByPeer[match.id] ?? 0;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={match.id}
                  onPress={() => chooseMatch(match)}
                  style={[styles.rankedRow, active ? styles.rankedRowActive : null]}
                >
                  <View style={styles.rankedScore}>
                    <Text style={styles.rankedScoreText}>{match.score}</Text>
                    <Text style={styles.rankedScoreLabel}>fit</Text>
                  </View>
                  <View style={styles.rankedCopy}>
                    <View style={styles.rankedNameRow}>
                      <Text style={styles.rankedName}>{match.handle}</Text>
                      {unread > 0 ? (
                        <View style={styles.unreadPill}>
                          <Text style={styles.unreadPillText}>{unread > 9 ? '9+' : `${unread}`}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rankedMeta}>
                      {match.city} - {match.distance}
                    </Text>
                    <Text style={styles.rankedReason}>{match.reasons[0] ?? match.hostNote}</Text>
                  </View>
                  <Ionicons name={active ? 'checkmark-circle' : 'chevron-forward'} size={20} color="#0c5a41" />
                </Pressable>
              );
            })}
          </View>
        </View>

        <ImageBackground
          source={require('./assets/culture-match.png')}
          imageStyle={styles.heroImage}
          style={[styles.hero, { width: cardWidth }]}
        >
          <View style={[styles.heroShade, photoRevealOpened ? styles.heroShadeRevealed : null]}>
            <View style={styles.heroTop}>
              <View style={styles.statusPill}>
                <Ionicons
                  name={photoRevealOpened ? 'eye-outline' : photoRevealRequested ? 'image-outline' : 'eye-off-outline'}
                  size={14}
                  color="#ffffff"
                />
                <Text style={styles.statusPillText}>
                  {photoRevealOpened ? 'Photo revealed' : photoRevealRequested ? 'Reveal requested' : 'Blind profile'}
                </Text>
              </View>
              <Text style={styles.fitScore}>{selectedMatch.score}%</Text>
            </View>
            <View>
              <Text style={styles.profileName}>{selectedMatch.handle}</Text>
              <Text style={styles.profileMeta}>
                {selectedMatch.city} - {selectedMatch.distance}
              </Text>
            </View>
          </View>
        </ImageBackground>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Why this match</Text>
              <Text style={styles.sectionTitle}>{selectedMatch.intro}</Text>
            </View>
            <Ionicons name="sparkles-outline" size={23} color="#0c5a41" />
          </View>
          <View style={styles.reasonList}>
            {selectedMatch.reasons.map((reason) => (
              <View key={reason} style={styles.reasonRow}>
                <Ionicons name="checkmark-circle" size={18} color="#0c5a41" />
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>
          {selectedMatch.riskConflicts.length > 0 ? (
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#c62b23" />
              <Text style={styles.warningText}>
                Host should review: {selectedMatch.riskConflicts.join(', ')}.
              </Text>
            </View>
          ) : (
            <View style={styles.hostNoteBox}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#0c5a41" />
              <Text style={styles.hostNoteText}>{selectedMatch.hostNote}</Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Your match lens</Text>
              <Text style={styles.sectionTitle}>{onboardingProfile.intention}</Text>
            </View>
            <Ionicons name="options-outline" size={23} color="#0c5a41" />
          </View>
          <View style={styles.lensGrid}>
            <View style={styles.lensRow}>
              <Text style={styles.lensLabel}>City</Text>
              <Text style={styles.lensValue}>{onboardingProfile.city}</Text>
            </View>
            <View style={styles.lensRow}>
              <Text style={styles.lensLabel}>Language</Text>
              <Text style={styles.lensValue}>{onboardingProfile.languages.join(' + ')}</Text>
            </View>
            <View style={styles.lensRow}>
              <Text style={styles.lensLabel}>Faith</Text>
              <Text style={styles.lensValue}>{onboardingProfile.faithComfort}</Text>
            </View>
            <View style={styles.lensRow}>
              <Text style={styles.lensLabel}>Date</Text>
              <Text style={styles.lensValue}>{onboardingProfile.dateStyle}</Text>
            </View>
          </View>
        </View>
          </>
        ) : null}

        {activeTab === 'Dates' ? (
          <>
        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Reveal progress</Text>
              <Text style={styles.sectionTitle}>
                {promptsRemaining === 0 ? 'Voice reveal is ready' : `${promptsRemaining} prompts left`}
              </Text>
            </View>
            <Ionicons name="mic-outline" size={23} color="#0c5a41" />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${revealProgress}%` }]} />
          </View>
          <Text style={styles.revealText}>
            {answeredCount}/{promptExchange.length} answered. Photos stay locked until the prompt exchange, voice intro, and hosted date are ready.
          </Text>
          <View style={styles.signalGrid}>
            {matchSignals.map((signal) => (
              <View key={signal.label} style={styles.signalTile}>
                <Text style={styles.signalValue}>{signal.value}</Text>
                <Text style={styles.signalLabel}>{signal.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Photo reveal rules</Text>
              <Text style={styles.sectionTitle}>
                {revealPauseActive
                  ? 'Reveal pause active'
                  : revealGateReady
                    ? 'Photos are open'
                    : photoRevealRequested
                      ? 'Waiting for mutual approval'
                      : canRequestPhotoReveal
                        ? 'Ready to request reveal'
                        : 'Still blind by design'}
              </Text>
            </View>
            <Ionicons name="lock-closed-outline" size={23} color="#0c5a41" />
          </View>
          <View style={styles.unlockList}>
            {revealRequirements.map((requirement) => (
              <View key={requirement.label} style={styles.unlockRow}>
                <Ionicons
                  name={requirement.complete ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={requirement.complete ? '#0c5a41' : '#667064'}
                />
                <Text style={styles.unlockText}>{requirement.label}</Text>
              </View>
            ))}
          </View>
          {photoRevealRequested ? (
            <View style={styles.unlockList}>
              <View style={styles.unlockRow}>
                <Ionicons name="checkmark-circle" size={18} color="#0c5a41" />
                <Text style={styles.unlockText}>You requested the reveal</Text>
              </View>
              <View style={styles.unlockRow}>
                <Ionicons
                  name={matchRevealConsentGranted ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={matchRevealConsentGranted ? '#0c5a41' : '#667064'}
                />
                <Text style={styles.unlockText}>
                  {matchRevealConsentGranted
                    ? `${selectedMatch.handle} agreed to reveal`
                    : `Waiting for ${selectedMatch.handle} to agree`}
                </Text>
              </View>
            </View>
          ) : null}

          {revealGateReady ? (
            <View style={styles.hostNoteBox}>
              <Ionicons name="eye-outline" size={18} color="#0c5a41" />
              <Text style={styles.hostNoteText}>
                Photos are open for both of you. The reveal stays mutual - either person can re-blind or pause it.
              </Text>
            </View>
          ) : null}

          {!photoRevealRequested ? (
            <Pressable
              accessibilityRole="button"
              disabled={!canRequestPhotoReveal}
              onPress={requestPhotoReveal}
              style={[styles.saveButton, !canRequestPhotoReveal ? styles.buttonDisabled : null]}
            >
              <Ionicons name="image-outline" size={17} color="#ffffff" />
              <Text style={styles.saveButtonText}>
                {revealPauseActive ? 'Reveal paused' : 'Request photo reveal'}
              </Text>
            </Pressable>
          ) : !matchRevealConsentGranted ? (
            <Pressable
              accessibilityRole="button"
              disabled={revealPauseActive}
              onPress={grantMatchRevealConsent}
              style={[styles.saveButton, revealPauseActive ? styles.buttonDisabled : null]}
            >
              <Ionicons name="heart-outline" size={17} color="#ffffff" />
              <Text style={styles.saveButtonText}>
                {revealPauseActive ? 'Reveal paused' : `Confirm ${selectedMatch.handle} agrees`}
              </Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={resetPhotoRevealConsent} style={styles.reportButton}>
              <Ionicons name="eye-off-outline" size={18} color="#1f241f" />
              <Text style={styles.reportButtonText}>Re-blind this match</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Today cue</Text>
              <Text style={styles.sectionTitle}>{visibleSelectedCue}</Text>
            </View>
            <MaterialCommunityIcons name="coffee-outline" size={24} color="#0c5a41" />
          </View>

          <View style={styles.cueGrid}>
            {selectedMatch.cues.map((cue) => {
              const active = cue === visibleSelectedCue;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={cue}
                  onPress={() => setSelectedCue(cue)}
                  style={[styles.cueChip, active ? styles.cueChipActive : null]}
                >
                  <Text style={[styles.cueText, active ? styles.cueTextActive : null]}>{cue}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Prompt exchange</Text>
              <Text style={styles.sectionTitle}>Answer before seeing photos</Text>
            </View>
            <Ionicons name="sparkles-outline" size={23} color="#0c5a41" />
          </View>

          {promptExchange.map((prompt, index) => {
            const active = prompt.id === selectedPrompt;
            const answered = persistedAnsweredPromptIds.includes(prompt.id);
            return (
              <Pressable
                accessibilityRole="button"
                key={prompt.id}
                onPress={() => setSelectedPrompt(prompt.id)}
                style={[styles.promptRow, active ? styles.promptRowActive : null]}
              >
                <View style={[styles.promptIndex, answered ? styles.promptIndexDone : null]}>
                  {answered ? (
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                  ) : (
                    <Text style={styles.promptIndexText}>{index + 1}</Text>
                  )}
                </View>
                <View style={styles.promptCopy}>
                  <Text style={styles.promptCue}>{prompt.cue}</Text>
                  <Text style={styles.promptText}>{prompt.question}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#667064" />
              </Pressable>
            );
          })}

          <View style={styles.answerBox}>
            <Text style={styles.answerLabel}>{selectedPromptDetail.cue}</Text>
            <TextInput
              editable={!persistedAnsweredPromptIds.includes(selectedPrompt)}
              multiline
              onChangeText={setDraft}
              placeholder="Write a short answer"
              placeholderTextColor="#7a8377"
              style={[styles.answerInput, selectedPromptAnswer ? styles.answerInputSaved : null]}
              value={draft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!draft.trim() || persistedAnsweredPromptIds.includes(selectedPrompt)}
              onPress={saveAnswer}
              style={[
                styles.saveButton,
                !draft.trim() || persistedAnsweredPromptIds.includes(selectedPrompt) ? styles.buttonDisabled : null,
              ]}
            >
              <Ionicons name="send-outline" size={17} color="#ffffff" />
              <Text style={styles.saveButtonText}>
                {persistedAnsweredPromptIds.includes(selectedPrompt) ? 'Saved' : 'Save answer'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Voice prompt</Text>
              <Text style={styles.sectionTitle}>{activeVoicePrompt.question}</Text>
            </View>
            <Ionicons name="mic-circle-outline" size={25} color="#0c5a41" />
          </View>
          <Text style={styles.revealText}>{selectedMatch.voicePrompt}</Text>
          <View style={styles.voicePromptList}>
            {voicePrompts.map((prompt) => {
              const active = prompt.id === activeVoicePromptId;
              const saved = savedVoicePromptIds.includes(prompt.id);

              return (
                <Pressable
                  accessibilityRole="button"
                  key={prompt.id}
                  onPress={() => setActiveVoicePromptId(prompt.id)}
                  style={[styles.voicePromptRow, active ? styles.voicePromptRowActive : null]}
                >
                  <Ionicons
                    name={saved ? 'checkmark-circle' : 'mic-outline'}
                    size={18}
                    color={saved ? '#0c5a41' : '#667064'}
                  />
                  <View style={styles.promptCopy}>
                    <Text style={styles.promptCue}>{prompt.cue}</Text>
                    <Text style={styles.promptText}>{prompt.question}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={savedVoicePromptIds.includes(activeVoicePromptId)}
            onPress={saveVoiceDraft}
            style={[
              styles.reportButton,
              savedVoicePromptIds.includes(activeVoicePromptId) ? styles.buttonDisabled : null,
            ]}
          >
            <Ionicons name="mic-outline" size={18} color="#1f241f" />
            <Text style={styles.reportButtonText}>
              {savedVoicePromptIds.includes(activeVoicePromptId) ? 'Voice draft saved' : 'Save voice draft'}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>First date plan</Text>
              <Text style={styles.sectionTitle}>{acceptedDatePlan ? 'Hosted date accepted' : 'Pick a hosted setting'}</Text>
            </View>
            <Ionicons name="calendar-outline" size={23} color="#0c5a41" />
          </View>

          {dateSpots.map((spot) => {
            const active = spot.name === selectedSpot;
            return (
              <Pressable
                accessibilityRole="button"
                key={spot.name}
                onPress={() => {
                  setSelectedSpot(spot.name);
                  setAcceptedDatePlan(false);
                  resetPhotoRevealConsent();
                }}
                style={[styles.spotRow, active ? styles.spotRowActive : null]}
              >
                <MaterialCommunityIcons
                  name={spot.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={22}
                  color={active ? '#ffffff' : '#0c5a41'}
                />
                <View style={styles.spotCopy}>
                  <Text style={[styles.spotName, active ? styles.spotNameActive : null]}>{spot.name}</Text>
                  <Text style={[styles.spotDetail, active ? styles.spotDetailActive : null]}>{spot.detail}</Text>
                </View>
                {active ? <Ionicons name="checkmark-circle" size={21} color="#f0d478" /> : null}
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setAcceptedDatePlan(true);
              resetPhotoRevealConsent();
            }}
            style={styles.saveButton}
          >
            <Ionicons name="calendar" size={17} color="#ffffff" />
            <Text style={styles.saveButtonText}>
              {acceptedDatePlan ? `${selectedSpot} accepted` : `Accept ${selectedSpot}`}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Safety controls</Text>
              <Text style={styles.sectionTitle}>
                {revealPauseActive ? 'Reveal is paused for review' : 'Keep the reveal pace mutual'}
              </Text>
            </View>
            <Ionicons name="shield-checkmark-outline" size={24} color="#0c5a41" />
          </View>
          <View style={styles.safetyRow}>
            <View style={styles.safetyIcon}>
              <Ionicons name="lock-closed-outline" size={18} color="#c62b23" />
            </View>
            <Text style={styles.safetyText}>
              Photos stay hidden until both people finish prompts, save a voice intro, and accept the hosted date plan.
            </Text>
          </View>
          <View style={styles.dealbreakerList}>
            {onboardingProfile.dealbreakers.map((dealbreaker) => (
              <View key={dealbreaker} style={styles.dealbreakerPill}>
                <Text style={styles.dealbreakerText}>{dealbreaker}</Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setRevealPausedUntil(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
              resetPhotoRevealConsent();
            }}
            style={styles.reportButton}
          >
            <Ionicons name="time-outline" size={18} color="#1f241f" />
            <Text style={styles.reportButtonText}>
              {revealPauseActive ? 'Reveal paused for 24 hours' : 'Pause reveal for 24 hours'}
            </Text>
          </Pressable>
        </View>
          </>
        ) : null}

        {activeTab === 'Me' ? (
          <>
        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Your account</Text>
              <Text style={styles.sectionTitle} numberOfLines={1}>
                {authEmail ?? 'Signed in'}
              </Text>
            </View>
            <Ionicons name="person-circle-outline" size={24} color="#0c5a41" />
          </View>
          <View style={styles.lensGrid}>
            <View style={styles.lensRow}>
              <Text style={styles.lensLabel}>Member</Text>
              <Text style={styles.lensValue} numberOfLines={1}>
                {authMemberId ?? '—'}
              </Text>
            </View>
            <View style={styles.lensRow}>
              <Text style={styles.lensLabel}>Matches</Text>
              <Text style={styles.lensValue}>
                {usingRemoteCandidates ? `${rankedMatches.length} real members` : 'Sample matches'}
              </Text>
            </View>
            <View style={styles.lensRow}>
              <Text style={styles.lensLabel}>Sync</Text>
              <Text style={styles.lensValue}>{syncDetail}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={signOut} style={styles.saveButton}>
            <Ionicons name="log-out-outline" size={17} color="#ffffff" />
            <Text style={styles.saveButtonText}>Sign out</Text>
          </Pressable>
        </View>

        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Your match lens</Text>
              <Text style={styles.sectionTitle}>{onboardingProfile.intention}</Text>
            </View>
            <Ionicons name="options-outline" size={23} color="#0c5a41" />
          </View>
          <View style={styles.lensGrid}>
            <View style={styles.lensRow}>
              <Text style={styles.lensLabel}>City</Text>
              <Text style={styles.lensValue}>{onboardingProfile.city}</Text>
            </View>
            <View style={styles.lensRow}>
              <Text style={styles.lensLabel}>Language</Text>
              <Text style={styles.lensValue}>{onboardingProfile.languages.join(' + ')}</Text>
            </View>
            <View style={styles.lensRow}>
              <Text style={styles.lensLabel}>Faith</Text>
              <Text style={styles.lensValue}>{onboardingProfile.faithComfort}</Text>
            </View>
            <View style={styles.lensRow}>
              <Text style={styles.lensLabel}>Reveal pace</Text>
              <Text style={styles.lensValue}>{onboardingProfile.revealPace}</Text>
            </View>
          </View>
          <View style={styles.dealbreakerList}>
            {onboardingProfile.dealbreakers.map((dealbreaker) => (
              <View key={dealbreaker} style={styles.dealbreakerPill}>
                <Text style={styles.dealbreakerText}>{dealbreaker}</Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowOnboarding(true)}
            style={styles.reportButton}
          >
            <Ionicons name="create-outline" size={18} color="#1f241f" />
            <Text style={styles.reportButtonText}>Edit onboarding</Text>
          </Pressable>
        </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = tab.label === activeTab;
          const badge = tab.label === 'Talks' ? totalUnread : 0;

          return (
            <Pressable
              key={tab.label}
              accessibilityRole="button"
              onPress={() => setActiveTab(tab.label)}
              style={styles.tabItem}
            >
              <View style={styles.tabIconWrap}>
                <Ionicons
                  name={tab.icon as keyof typeof Ionicons.glyphMap}
                  size={21}
                  color={active ? '#c62b23' : '#667064'}
                />
                {badge > 0 ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{badge > 9 ? '9+' : `${badge}`}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6f1',
  },
  scrollContent: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
  },
  header: {
    width: '100%',
    maxWidth: 430,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerCopy: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  splashText: {
    color: '#0c5a41',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  authField: {
    gap: 6,
  },
  authInput: {
    minHeight: 50,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#1f241f',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(31, 36, 31, 0.16)',
    fontSize: 15,
    fontWeight: '700',
  },
  authToggle: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authToggleText: {
    color: '#0c5a41',
    fontSize: 13,
    fontWeight: '900',
  },
  brand: {
    color: '#1f241f',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtle: {
    color: '#667064',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  syncText: {
    color: '#0c5a41',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 3,
    textTransform: 'uppercase',
  },
  syncTextOffline: {
    color: '#9f201a',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(31, 36, 31, 0.1)',
  },
  stepBadge: {
    minWidth: 54,
    minHeight: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#1f241f',
  },
  stepBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  onboardingHero: {
    minHeight: 220,
    borderRadius: 8,
    padding: 18,
    gap: 12,
    justifyContent: 'flex-end',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(31, 36, 31, 0.1)',
  },
  onboardingIcon: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c5a41',
  },
  onboardingTitle: {
    color: '#1f241f',
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: 0,
  },
  choiceList: {
    gap: 9,
  },
  choiceRow: {
    minHeight: 56,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#f7f9f4',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  choiceRowActive: {
    borderColor: '#0c5a41',
    backgroundColor: '#edf1ea',
  },
  choiceMarker: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e1e7de',
  },
  choiceMarkerActive: {
    backgroundColor: '#0c5a41',
  },
  choiceText: {
    flex: 1,
    color: '#3d443c',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  choiceTextActive: {
    color: '#1f241f',
  },
  onboardingSummary: {
    borderRadius: 8,
    padding: 12,
    gap: 4,
    backgroundColor: '#edf1ea',
  },
  onboardingSummaryText: {
    color: '#1f241f',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  onboardingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  backButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(31, 36, 31, 0.1)',
  },
  backButtonText: {
    color: '#1f241f',
    fontSize: 14,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  card: {
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(31, 36, 31, 0.1)',
    gap: 14,
  },
  sectionHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  kicker: {
    color: '#0c5a41',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#1f241f',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 3,
    maxWidth: 292,
  },
  rankedList: {
    gap: 9,
  },
  rankedRow: {
    minHeight: 74,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#f7f9f4',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rankedRowActive: {
    borderColor: '#0c5a41',
    backgroundColor: '#edf1ea',
  },
  rankedScore: {
    width: 48,
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0d478',
  },
  rankedScoreText: {
    color: '#1f241f',
    fontSize: 17,
    fontWeight: '900',
  },
  rankedScoreLabel: {
    color: '#4d421b',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  rankedCopy: {
    flex: 1,
    gap: 2,
  },
  rankedName: {
    color: '#1f241f',
    fontSize: 15,
    fontWeight: '900',
  },
  rankedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c62b23',
  },
  unreadPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  rankedMeta: {
    color: '#667064',
    fontSize: 12,
    fontWeight: '800',
  },
  rankedReason: {
    color: '#3d443c',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  hero: {
    height: 260,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#1f241f',
  },
  heroImage: {
    borderRadius: 8,
  },
  heroShade: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(18, 21, 18, 0.28)',
  },
  heroShadeRevealed: {
    backgroundColor: 'rgba(18, 21, 18, 0.1)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(31, 36, 31, 0.74)',
  },
  statusPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  fitScore: {
    minWidth: 58,
    textAlign: 'center',
    borderRadius: 8,
    overflow: 'hidden',
    paddingVertical: 8,
    color: '#1f241f',
    backgroundColor: '#f0d478',
    fontSize: 17,
    fontWeight: '900',
  },
  profileName: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
  },
  profileMeta: {
    color: '#edf1ea',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  reasonList: {
    gap: 8,
  },
  reasonRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reasonText: {
    flex: 1,
    color: '#3d443c',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  warningBox: {
    minHeight: 48,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(198, 43, 35, 0.1)',
  },
  warningText: {
    flex: 1,
    color: '#9f201a',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  hostNoteBox: {
    minHeight: 48,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#edf1ea',
  },
  hostNoteText: {
    flex: 1,
    color: '#2f362f',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  chatMatchRow: {
    minHeight: 82,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f7f9f4',
  },
  chatAvatar: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f241f',
  },
  chatAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  chatMatchCopy: {
    flex: 1,
    gap: 2,
  },
  guardrailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  guardrailTile: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#edf1ea',
  },
  guardrailText: {
    color: '#2f362f',
    fontSize: 12,
    fontWeight: '900',
  },
  chatList: {
    gap: 10,
  },
  chatBubble: {
    maxWidth: '92%',
    minHeight: 68,
    borderRadius: 8,
    padding: 12,
    gap: 7,
    backgroundColor: '#f7f9f4',
  },
  chatBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#edf1ea',
  },
  chatBubbleOther: {
    alignSelf: 'flex-start',
  },
  chatBubbleHost: {
    alignSelf: 'stretch',
    maxWidth: '100%',
    backgroundColor: '#f0d478',
  },
  chatBubbleHeld: {
    backgroundColor: 'rgba(198, 43, 35, 0.1)',
  },
  chatBubbleHeader: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  chatAuthor: {
    color: '#0c5a41',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  chatTime: {
    color: '#667064',
    fontSize: 11,
    fontWeight: '800',
  },
  chatMessageText: {
    color: '#2f362f',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  emptyChatBox: {
    minHeight: 54,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#edf1ea',
  },
  emptyChatText: {
    flex: 1,
    color: '#3d443c',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  heldBadge: {
    minHeight: 28,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
  },
  heldBadgeText: {
    flex: 1,
    color: '#9f201a',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  chatReceipt: {
    alignSelf: 'flex-end',
    color: '#667064',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  chatErrorText: {
    color: '#9f201a',
    fontSize: 12,
    fontWeight: '800',
  },
  quickReplyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickReplyChip: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf1ea',
  },
  quickReplyLabel: {
    color: '#0c5a41',
    fontSize: 12,
    fontWeight: '900',
  },
  moderationBox: {
    minHeight: 44,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#edf1ea',
  },
  moderationBoxHeld: {
    backgroundColor: 'rgba(198, 43, 35, 0.1)',
  },
  moderationText: {
    flex: 1,
    color: '#2f362f',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  moderationTextHeld: {
    color: '#9f201a',
  },
  lensGrid: {
    gap: 8,
  },
  lensRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(31, 36, 31, 0.08)',
    paddingBottom: 8,
  },
  lensLabel: {
    color: '#667064',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  lensValue: {
    flex: 1,
    color: '#1f241f',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#e1e7de',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0c5a41',
  },
  revealText: {
    color: '#3d443c',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  signalGrid: {
    gap: 8,
  },
  signalTile: {
    minHeight: 54,
    borderRadius: 8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(31, 36, 31, 0.08)',
  },
  signalValue: {
    color: '#1f241f',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  signalLabel: {
    color: '#667064',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'uppercase',
  },
  unlockList: {
    gap: 8,
  },
  unlockRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unlockText: {
    flex: 1,
    color: '#3d443c',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  cueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cueChip: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf1ea',
  },
  cueChipActive: {
    backgroundColor: '#0c5a41',
  },
  cueText: {
    color: '#3d443c',
    fontSize: 12,
    fontWeight: '800',
  },
  cueTextActive: {
    color: '#ffffff',
  },
  promptRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#f7f9f4',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  promptRowActive: {
    borderColor: '#0c5a41',
  },
  promptIndex: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0d478',
  },
  promptIndexDone: {
    backgroundColor: '#0c5a41',
  },
  promptIndexText: {
    color: '#1f241f',
    fontSize: 13,
    fontWeight: '900',
  },
  promptCopy: {
    flex: 1,
    gap: 2,
  },
  promptCue: {
    color: '#0c5a41',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  promptText: {
    color: '#2f362f',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  answerBox: {
    borderRadius: 8,
    padding: 12,
    gap: 10,
    backgroundColor: '#edf1ea',
  },
  answerLabel: {
    color: '#0c5a41',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  answerInput: {
    minHeight: 84,
    borderRadius: 8,
    padding: 12,
    color: '#1f241f',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(31, 36, 31, 0.1)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    textAlignVertical: 'top',
  },
  answerInputSaved: {
    backgroundColor: '#f7f9f4',
    color: '#3d443c',
  },
  saveButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#c62b23',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  voicePromptList: {
    gap: 9,
  },
  voicePromptRow: {
    minHeight: 62,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f7f9f4',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  voicePromptRowActive: {
    borderColor: '#0c5a41',
  },
  spotRow: {
    minHeight: 68,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f7f9f4',
  },
  spotRowActive: {
    backgroundColor: '#0c5a41',
  },
  spotCopy: {
    flex: 1,
  },
  spotName: {
    color: '#1f241f',
    fontSize: 15,
    fontWeight: '900',
  },
  spotNameActive: {
    color: '#ffffff',
  },
  spotDetail: {
    color: '#667064',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  spotDetailActive: {
    color: '#e7eee6',
  },
  safetyRow: {
    minHeight: 58,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f7f9f4',
  },
  safetyIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(198, 43, 35, 0.1)',
  },
  safetyText: {
    flex: 1,
    color: '#3d443c',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  dealbreakerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dealbreakerPill: {
    minHeight: 34,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(198, 43, 35, 0.1)',
  },
  dealbreakerText: {
    color: '#9f201a',
    fontSize: 12,
    fontWeight: '900',
  },
  reportButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#f0d478',
  },
  reportButtonText: {
    color: '#1f241f',
    fontSize: 14,
    fontWeight: '900',
  },
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    maxWidth: 430,
    alignSelf: 'center',
    minHeight: 64,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(31, 36, 31, 0.12)',
  },
  tabItem: {
    width: 68,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabIconWrap: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c62b23',
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  tabText: {
    color: '#667064',
    fontSize: 11,
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#c62b23',
  },
});
