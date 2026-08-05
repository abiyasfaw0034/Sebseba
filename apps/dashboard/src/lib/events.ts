// Hosted-date event inventory + booking. Backed by .data/events.json.
//
// This replaces the previously hardcoded "hosted dates" list on the ops console with a
// real store members can book seats into. Seat availability, fill %, and the dashboard
// numbers all derive from actual bookings. The store seeds a few upcoming rooms on first
// read so a fresh install still has inventory to show and book.

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type BookingStatus = "booked" | "cancelled";

export type EventBooking = {
  memberId: string;
  status: BookingStatus;
  bookedAt: string;
  updatedAt: string;
};

export type HostedEvent = {
  id: string;
  title: string;
  description: string;
  city: string;
  venue: string;
  startsAt: string; // ISO timestamp
  capacity: number;
  bookings: EventBooking[];
};

type EventStore = {
  events: Record<string, HostedEvent>;
};

// Member-facing view of an event (seat math resolved, plus whether the caller holds a seat).
export type EventListing = {
  id: string;
  title: string;
  description: string;
  city: string;
  venue: string;
  startsAt: string;
  whenLabel: string;
  capacity: number;
  seatsBooked: number;
  seatsLeft: number;
  fillPercent: number;
  booked: boolean;
};

// Dashboard inventory row (no per-viewer booked flag).
export type EventInventoryItem = Omit<EventListing, "booked">;

export type BookingResult =
  | { ok: true; listing: EventListing }
  | { ok: false; reason: "not-found" | "full" | "past" };

const dataDirectory = path.join(process.cwd(), ".data");
const eventsFile = path.join(dataDirectory, "events.json");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const generateEventId = (): string => `evt_${randomUUID().slice(0, 12)}`;

/** Builds the default seed inventory with upcoming dates relative to now. */
const buildSeedEvents = (): HostedEvent[] => {
  const now = new Date();

  const at = (daysFromNow: number, hour: number, minute: number): string => {
    const date = new Date(now);
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };

  return [
    {
      id: generateEventId(),
      title: "Blind Buna Rooms",
      description: "Small-group coffee ceremony introductions with a host guiding the first questions.",
      city: "Addis Ababa",
      venue: "Tomoca courtyard",
      startsAt: at(0, 19, 0),
      capacity: 18,
      bookings: [],
    },
    {
      id: generateEventId(),
      title: "Habesha Story Swap",
      description: "Members trade a family story before names or photos are shared.",
      city: "Addis Ababa",
      venue: "Fendika cultural hall",
      startsAt: at(3, 18, 30),
      capacity: 12,
      bookings: [],
    },
    {
      id: generateEventId(),
      title: "Addis Art Walk",
      description: "A guided gallery walk designed for low-pressure, side-by-side first conversations.",
      city: "Addis Ababa",
      venue: "Zoma Museum",
      startsAt: at(6, 16, 0),
      capacity: 24,
      bookings: [],
    },
  ];
};

const normalizeEvent = (raw: unknown): HostedEvent | null => {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.title !== "string") {
    return null;
  }

  const bookings = Array.isArray(raw.bookings)
    ? raw.bookings.flatMap<EventBooking>((booking) => {
        if (!isRecord(booking) || typeof booking.memberId !== "string") {
          return [];
        }
        const status: BookingStatus = booking.status === "cancelled" ? "cancelled" : "booked";
        const bookedAt = typeof booking.bookedAt === "string" ? booking.bookedAt : new Date().toISOString();
        return [
          {
            memberId: booking.memberId,
            status,
            bookedAt,
            updatedAt: typeof booking.updatedAt === "string" ? booking.updatedAt : bookedAt,
          },
        ];
      })
    : [];

  return {
    id: raw.id,
    title: raw.title,
    description: typeof raw.description === "string" ? raw.description : "",
    city: typeof raw.city === "string" ? raw.city : "Addis Ababa",
    venue: typeof raw.venue === "string" ? raw.venue : "",
    startsAt: typeof raw.startsAt === "string" ? raw.startsAt : new Date().toISOString(),
    capacity: typeof raw.capacity === "number" && raw.capacity > 0 ? Math.floor(raw.capacity) : 12,
    bookings,
  };
};

const writeEventStore = async (store: EventStore): Promise<void> => {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(eventsFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
};

const readEventStore = async (): Promise<EventStore> => {
  try {
    const raw = await readFile(eventsFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (isRecord(parsed) && isRecord(parsed.events)) {
      const events: Record<string, HostedEvent> = {};
      for (const [key, value] of Object.entries(parsed.events)) {
        const event = normalizeEvent(value);
        if (event) {
          events[key] = event;
        }
      }
      if (Object.keys(events).length > 0) {
        return { events };
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Could not read event store", error);
    }
  }

  // Empty or missing store — seed default inventory and persist it.
  const seeded: EventStore = { events: {} };
  for (const event of buildSeedEvents()) {
    seeded.events[event.id] = event;
  }
  await writeEventStore(seeded);
  return seeded;
};

const activeBookings = (event: HostedEvent): EventBooking[] =>
  event.bookings.filter((booking) => booking.status === "booked");

const whenLabel = (startsAt: string): string => {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) {
    return "Scheduled";
  }

  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((date.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));

  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Tomorrow, ${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
    return `${weekday}, ${time}`;
  }

  const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
  return `${monthDay}, ${time}`;
};

const toListing = (event: HostedEvent, viewerId?: string): EventListing => {
  const active = activeBookings(event);
  const seatsBooked = active.length;
  const seatsLeft = Math.max(0, event.capacity - seatsBooked);
  const fillPercent = event.capacity > 0 ? Math.round((seatsBooked / event.capacity) * 100) : 0;

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    city: event.city,
    venue: event.venue,
    startsAt: event.startsAt,
    whenLabel: whenLabel(event.startsAt),
    capacity: event.capacity,
    seatsBooked,
    seatsLeft,
    fillPercent,
    booked: viewerId ? active.some((booking) => booking.memberId === viewerId) : false,
  };
};

const byStartAscending = (a: { startsAt: string }, b: { startsAt: string }): number =>
  a.startsAt.localeCompare(b.startsAt);

/** Upcoming events (those that haven't started yet), member-facing, sorted soonest-first. */
export const listUpcomingEvents = async (viewerId?: string): Promise<EventListing[]> => {
  const store = await readEventStore();
  const now = Date.now();

  return Object.values(store.events)
    .filter((event) => new Date(event.startsAt).getTime() >= now)
    .map((event) => toListing(event, viewerId))
    .sort(byStartAscending);
};

/** All events, newest inventory first — used by the ops dashboard. */
export const getEventInventory = async (): Promise<EventInventoryItem[]> => {
  const store = await readEventStore();
  return Object.values(store.events)
    .map((event) => {
      const { booked: _booked, ...rest } = toListing(event);
      void _booked;
      return rest;
    })
    .sort(byStartAscending);
};

export const bookEvent = async (eventId: string, memberId: string): Promise<BookingResult> => {
  const store = await readEventStore();
  const event = store.events[eventId];

  if (!event) {
    return { ok: false, reason: "not-found" };
  }

  if (new Date(event.startsAt).getTime() < Date.now()) {
    return { ok: false, reason: "past" };
  }

  const existing = event.bookings.find((booking) => booking.memberId === memberId);
  const now = new Date().toISOString();

  if (existing?.status === "booked") {
    // Idempotent — already holding a seat.
    return { ok: true, listing: toListing(event, memberId) };
  }

  if (activeBookings(event).length >= event.capacity) {
    return { ok: false, reason: "full" };
  }

  if (existing) {
    existing.status = "booked";
    existing.updatedAt = now;
  } else {
    event.bookings.push({ memberId, status: "booked", bookedAt: now, updatedAt: now });
  }

  await writeEventStore(store);
  return { ok: true, listing: toListing(event, memberId) };
};

export const cancelBooking = async (eventId: string, memberId: string): Promise<BookingResult> => {
  const store = await readEventStore();
  const event = store.events[eventId];

  if (!event) {
    return { ok: false, reason: "not-found" };
  }

  const existing = event.bookings.find((booking) => booking.memberId === memberId);

  if (existing && existing.status === "booked") {
    existing.status = "cancelled";
    existing.updatedAt = new Date().toISOString();
    await writeEventStore(store);
  }

  return { ok: true, listing: toListing(event, memberId) };
};

export type EventReport = {
  totalEvents: number;
  upcomingEvents: number;
  totalCapacity: number;
  seatsBooked: number;
  seatsLeft: number;
  fillPercent: number;
  uniqueMembersBooked: number;
  byCity: { city: string; events: number; seatsBooked: number }[];
};

/** Aggregate booking figures for the dashboard reports section. */
export const getEventReport = async (): Promise<EventReport> => {
  const store = await readEventStore();
  const events = Object.values(store.events);
  const now = Date.now();

  let totalCapacity = 0;
  let seatsBooked = 0;
  const members = new Set<string>();
  const cityMap = new Map<string, { events: number; seatsBooked: number }>();

  for (const event of events) {
    const active = activeBookings(event);
    totalCapacity += event.capacity;
    seatsBooked += active.length;
    active.forEach((booking) => members.add(booking.memberId));

    const city = cityMap.get(event.city) ?? { events: 0, seatsBooked: 0 };
    city.events += 1;
    city.seatsBooked += active.length;
    cityMap.set(event.city, city);
  }

  return {
    totalEvents: events.length,
    upcomingEvents: events.filter((event) => new Date(event.startsAt).getTime() >= now).length,
    totalCapacity,
    seatsBooked,
    seatsLeft: Math.max(0, totalCapacity - seatsBooked),
    fillPercent: totalCapacity > 0 ? Math.round((seatsBooked / totalCapacity) * 100) : 0,
    uniqueMembersBooked: members.size,
    byCity: [...cityMap.entries()]
      .map(([city, stats]) => ({ city, ...stats }))
      .sort((a, b) => b.seatsBooked - a.seatsBooked),
  };
};

/** Flat rows for the CSV export of the event inventory. */
export const getEventExportRows = async (): Promise<
  { id: string; title: string; city: string; venue: string; startsAt: string; capacity: number; seatsBooked: number; seatsLeft: number; fillPercent: number }[]
> => {
  const inventory = await getEventInventory();
  return inventory.map(({ whenLabel: _label, description: _desc, ...rest }) => {
    void _label;
    void _desc;
    return rest;
  });
};
