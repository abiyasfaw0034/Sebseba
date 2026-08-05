import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Coffee,
  Download,
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
import { getDashboardData } from "@/lib/dashboard";
import { getEventInventory, getEventReport } from "@/lib/events";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

// The reveal-workflow cards keep their icons here (data comes from the store).
const workflowIcons = [CheckCircle2, Mic2, MapPin];

// The prompt library and hosted-date rooms are curated content, not member data.
const prompts = [
  { text: "What song would you play at a coffee ceremony?", category: "Music" },
  { text: "Choose a first date: buna, art walk, or tej tasting.", category: "Date plan" },
  { text: "Which family tradition shaped how you love?", category: "Values" },
  { text: "Pick a meal to share from one mesob.", category: "Food" },
];

export default async function Home() {
  const [dashboard, eventInventory, eventReport] = await Promise.all([
    getDashboardData(),
    getEventInventory(),
    getEventReport(),
  ]);
  const dashboardMetrics = dashboard.metrics;
  const visibleSafetyReviews = dashboard.safetyReviews;
  const upcomingEvents = eventInventory.slice(0, 4);

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
              <p>{metric.detail}</p>
            </article>
          ))}
        </section>

        <section className={styles.grid}>
          <div className={styles.matchColumn}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.kicker}>Compatibility queue</span>
                <h2>
                  {dashboard.usingRealQueue
                    ? `${dashboard.onboardedMembers} blind profile${dashboard.onboardedMembers === 1 ? "" : "s"} ready for review`
                    : "Blind profiles ready for review"}
                </h2>
              </div>
              <button className={styles.secondaryButton}>
                <Filter size={17} aria-hidden />
                Filter
              </button>
            </div>

            <div className={styles.queueList}>
              {dashboard.queue.map((person) => (
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
                {dashboard.workflow.map((step, index) => {
                  const Icon = workflowIcons[index] ?? CheckCircle2;
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

            <section className={styles.workflowPanel} aria-label="Reports">
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.kicker}>Reports</span>
                  <h2>Booking &amp; member exports</h2>
                </div>
                <BarChart3 size={19} aria-hidden />
              </div>
              <div className={styles.workflowGrid}>
                <article className={styles.workflowCard}>
                  <CalendarDays size={20} aria-hidden />
                  <span>Seats booked</span>
                  <strong>
                    {eventReport.seatsBooked}/{eventReport.totalCapacity}
                  </strong>
                  <p>{eventReport.fillPercent}% of hosted capacity filled.</p>
                </article>
                <article className={styles.workflowCard}>
                  <UsersRound size={20} aria-hidden />
                  <span>Members booked</span>
                  <strong>{eventReport.uniqueMembersBooked}</strong>
                  <p>distinct members hold a hosted-room seat.</p>
                </article>
                <article className={styles.workflowCard}>
                  <MapPin size={20} aria-hidden />
                  <span>Top city</span>
                  <strong>{eventReport.byCity[0]?.city ?? "—"}</strong>
                  <p>
                    {eventReport.byCity[0]
                      ? `${eventReport.byCity[0].seatsBooked} seats across ${eventReport.byCity[0].events} room${eventReport.byCity[0].events === 1 ? "" : "s"}.`
                      : "no rooms scheduled yet."}
                  </p>
                </article>
              </div>
              <div className={styles.exportRow}>
                <a className={styles.secondaryButton} href="/api/reports/export?dataset=members" download>
                  <Download size={16} aria-hidden />
                  Members CSV
                </a>
                <a className={styles.secondaryButton} href="/api/reports/export?dataset=events" download>
                  <Download size={16} aria-hidden />
                  Events CSV
                </a>
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
                  <h2>
                    {eventReport.upcomingEvents > 0
                      ? `${eventReport.upcomingEvents} upcoming room${eventReport.upcomingEvents === 1 ? "" : "s"}`
                      : "Upcoming rooms"}
                  </h2>
                </div>
                <UsersRound size={19} aria-hidden />
              </div>
              <div className={styles.eventList}>
                {upcomingEvents.map((event) => (
                  <article key={event.id}>
                    <div>
                      <h3>{event.title}</h3>
                      <span>
                        {event.whenLabel} · {event.venue}
                      </span>
                    </div>
                    <div className={styles.eventStats}>
                      <p>
                        {event.seatsBooked}/{event.capacity} booked · {event.seatsLeft} left
                      </p>
                      <div className={styles.progressTrack} aria-label={`${event.fillPercent}% filled`}>
                        <span style={{ width: `${event.fillPercent}%` }} />
                      </div>
                    </div>
                  </article>
                ))}
                {upcomingEvents.length === 0 ? (
                  <p className={styles.emptyNote}>No upcoming rooms scheduled.</p>
                ) : null}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
