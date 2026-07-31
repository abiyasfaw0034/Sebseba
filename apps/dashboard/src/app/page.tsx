import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Coffee,
  Filter,
  Heart,
  MapPin,
  MessageCircle,
  Mic2,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import { getHeldReviews } from "@/lib/conversations";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SafetyReview = {
  id: string;
  signal: string;
  owner: string;
  state: string;
};

const metrics = [
  { label: "Reveal-ready matches", value: "184", trend: "+18%", tone: "good" },
  { label: "Prompt completion", value: "72%", trend: "+9%", tone: "good" },
  { label: "Safety reviews", value: "23", trend: "-12%", tone: "watch" },
  { label: "Hosted dates booked", value: "312", trend: "+22%", tone: "good" },
];

const queue = [
  {
    code: "AB-024",
    name: "Selam",
    city: "Addis Ababa",
    cue: "Loves jazz nights, buna talks, and slow Sunday walks",
    score: "94",
    status: "Ready for host",
    stage: "3 prompts matched",
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
    stage: "2 prompts matched",
    language: "Amharic",
    tags: ["Mesob dining", "Travel", "Faith"],
  },
  {
    code: "AB-047",
    name: "Mimi",
    city: "Dire Dawa",
    cue: "Keeps first dates playful with language games and old stories",
    score: "88",
    status: "Venue pending",
    stage: "Voice reveal ready",
    language: "Afan Oromo + English",
    tags: ["Storytelling", "Dance", "Language prompts"],
  },
];

const workflow = [
  {
    label: "Prompt lock",
    value: "3/3",
    detail: "Both members answered the blind-first exchange.",
    icon: CheckCircle2,
  },
  {
    label: "Voice window",
    value: "12 min",
    detail: "Host can open a guided call before any photo reveal.",
    icon: Mic2,
  },
  {
    label: "Venue route",
    value: "Bole",
    detail: "Nearest hosted tables have privacy screens available.",
    icon: MapPin,
  },
];

const prompts = [
  { text: "What song would you play at a coffee ceremony?", category: "Music" },
  { text: "Choose a first date: buna, art walk, or tej tasting.", category: "Date plan" },
  { text: "Which family tradition shaped how you love?", category: "Values" },
  { text: "Pick a meal to share from one mesob.", category: "Food" },
];

const safetyReviews: SafetyReview[] = [
  { id: "SR-118", signal: "Photo reveal request before prompts", owner: "Hana", state: "Review" },
  { id: "SR-121", signal: "Repeated late cancellation", owner: "Dawit", state: "Watch" },
  { id: "SR-126", signal: "Venue feedback needs follow-up", owner: "Meklit", state: "Open" },
];

const events = [
  { title: "Blind Buna Rooms", time: "Today, 7:00 PM", seats: "18 seats", fill: "74%" },
  { title: "Habesha Story Swap", time: "Wed, 6:30 PM", seats: "12 seats", fill: "62%" },
  { title: "Addis Art Walk", time: "Sat, 4:00 PM", seats: "24 seats", fill: "81%" },
];

// Held chat messages now live in the shared conversation store (they used to be
// scattered across each member's private state). Surface them on the safety board.
const shortMemberId = (id: string) => (id.length > 12 ? `${id.slice(0, 12)}…` : id);

const readFlaggedChatReviews = async (): Promise<SafetyReview[]> => {
  const held = await getHeldReviews();

  return held.slice(0, 4).map((review) => ({
    id: review.id.slice(0, 8),
    signal: `${shortMemberId(review.senderId)} → ${shortMemberId(review.recipientId)}: ${review.text.slice(0, 90)} (${review.flagReason})`,
    owner: shortMemberId(review.senderId),
    state: "Held",
  }));
};

export default async function Home() {
  const flaggedChatReviews = await readFlaggedChatReviews();
  const dashboardMetrics = metrics.map((metric) =>
    metric.label === "Safety reviews"
      ? {
          ...metric,
          value: String(Number(metric.value) + flaggedChatReviews.length),
          trend: flaggedChatReviews.length ? `${flaggedChatReviews.length} chat holds` : metric.trend,
        }
      : metric,
  );
  const visibleSafetyReviews = [...flaggedChatReviews, ...safetyReviews].slice(0, 5);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Dashboard navigation">
        <div className={styles.brand}>
          <span className={styles.brandMark}>A</span>
          <div>
            <p>Abiyasfaw</p>
            <span>Operations console</span>
          </div>
        </div>

        <nav className={styles.nav}>
          <a className={styles.navActive} href="#">
            <Heart size={18} aria-hidden />
            Matchmaking
          </a>
          <a href="#">
            <MessageCircle size={18} aria-hidden />
            Conversations
          </a>
          <a href="#">
            <CalendarDays size={18} aria-hidden />
            Date rooms
          </a>
          <a href="#">
            <ShieldCheck size={18} aria-hidden />
            Safety
          </a>
        </nav>

        <div className={styles.sidebarPanel}>
          <Coffee size={20} aria-hidden />
          <p>Buna room capacity</p>
          <strong>74%</strong>
          <span>6 hosted tables open tonight</span>
        </div>
      </aside>

      <main className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <span className={styles.kicker}>Saturday match room</span>
            <h1>Move blind matches from cultural cue to hosted date.</h1>
          </div>
          <div className={styles.actions}>
            <button aria-label="Search members" className={styles.iconButton}>
              <Search size={18} aria-hidden />
            </button>
            <button aria-label="Notifications" className={styles.iconButton}>
              <Bell size={18} aria-hidden />
            </button>
            <button className={styles.primaryButton}>
              <RefreshCw size={18} aria-hidden />
              Refresh queue
            </button>
          </div>
        </header>

        <section className={styles.metrics} aria-label="Today metrics">
          {dashboardMetrics.map((metric) => (
            <article className={styles.metric} data-tone={metric.tone} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.trend} vs last week</p>
            </article>
          ))}
        </section>

        <section className={styles.grid}>
          <div className={styles.matchColumn}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.kicker}>Compatibility queue</span>
                <h2>Blind profiles ready for review</h2>
              </div>
              <button className={styles.secondaryButton}>
                <Filter size={17} aria-hidden />
                Filter
              </button>
            </div>

            <div className={styles.queueList}>
              {queue.map((person) => (
                <article className={styles.profileRow} key={person.code}>
                  <div className={styles.avatar} aria-hidden>
                    {person.name.slice(0, 1)}
                  </div>
                  <div className={styles.profileCopy}>
                    <div className={styles.profileTop}>
                      <h3>{person.name}</h3>
                      <span>{person.code}</span>
                      <strong>{person.status}</strong>
                    </div>
                    <p>{person.cue}</p>
                    <div className={styles.profileMetaLine}>
                      <span>{person.city}</span>
                      <span>{person.stage}</span>
                      <span>{person.language}</span>
                    </div>
                    <div className={styles.tags}>
                      {person.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className={styles.score}>
                    <strong>{person.score}</strong>
                    <span>fit</span>
                  </div>
                  <button aria-label={`Open ${person.name}`} className={styles.rowButton}>
                    <ChevronRight size={18} aria-hidden />
                  </button>
                </article>
              ))}
            </div>

            <section className={styles.workflowPanel} aria-label="Match workflow">
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.kicker}>Reveal workflow</span>
                  <h2>Guardrails before photos open</h2>
                </div>
                <SlidersHorizontal size={19} aria-hidden />
              </div>
              <div className={styles.workflowGrid}>
                {workflow.map((step) => {
                  const Icon = step.icon;
                  return (
                    <article className={styles.workflowCard} key={step.label}>
                      <Icon size={20} aria-hidden />
                      <span>{step.label}</span>
                      <strong>{step.value}</strong>
                      <p>{step.detail}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <div className={styles.sideColumn}>
            <section className={styles.visualPanel}>
              <Image
                src="/culture-match.png"
                alt="Ethiopian cafe courtyard prepared for a blind date"
                fill
                sizes="(max-width: 900px) 100vw, 360px"
                priority
              />
              <div className={styles.visualOverlay}>
                <span>Tonight</span>
                <strong>32 hosted introductions</strong>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.kicker}>Prompt library</span>
                  <h2>Culture-first icebreakers</h2>
                </div>
                <Sparkles size={19} aria-hidden />
              </div>
              <div className={styles.promptList}>
                {prompts.map((prompt) => (
                  <button key={prompt.text}>
                    <span>{prompt.category}</span>
                    {prompt.text}
                    <ChevronRight size={16} aria-hidden />
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.kicker}>Safety board</span>
                  <h2>Human review queue</h2>
                </div>
                <AlertTriangle size={19} aria-hidden />
              </div>
              <div className={styles.safetyList}>
                {visibleSafetyReviews.map((review) => (
                  <article key={review.id}>
                    <div>
                      <strong>{review.id}</strong>
                      <small>{review.owner}</small>
                      <p>{review.signal}</p>
                    </div>
                    <span>{review.state}</span>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.kicker}>Hosted dates</span>
                  <h2>Upcoming rooms</h2>
                </div>
                <UsersRound size={19} aria-hidden />
              </div>
              <div className={styles.eventList}>
                {events.map((event) => (
                  <article key={event.title}>
                    <div>
                      <h3>{event.title}</h3>
                      <span>{event.time}</span>
                    </div>
                    <div className={styles.eventStats}>
                      <p>{event.seats}</p>
                      <div className={styles.progressTrack} aria-label={`${event.fill} filled`}>
                        <span style={{ width: event.fill }} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
