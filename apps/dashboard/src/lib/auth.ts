import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

/** A logged-in device/session. Revoking one invalidates its token even before expiry. */
export type StoredSession = {
  sid: string;
  createdAt: string;
  lastSeenAt: string;
  label: string;
};

export type Account = {
  id: string;
  email: string;
  salt: string;
  passHash: string;
  createdAt: string;
  sessions: StoredSession[];
  /** Single-use nonce backing the current password-reset token; rotated on use. */
  resetNonce?: string;
  resetRequestedAt?: string;
};

type AccountStore = {
  accounts: Record<string, Account>;
};

export type SessionPayload = {
  sub: string;
  email: string;
  /** Session id — must still be present in the account's session list to be valid. */
  sid: string;
  iat: number;
  exp: number;
};

type ResetPayload = {
  sub: string;
  email: string;
  purpose: "reset";
  nonce: string;
  iat: number;
  exp: number;
};

const dataDirectory = path.join(process.cwd(), ".data");
const accountsFile = path.join(dataDirectory, "accounts.json");

// Dev fallback only. Set ABIYASFAW_AUTH_SECRET in the environment for anything real.
const authSecret = process.env.ABIYASFAW_AUTH_SECRET?.trim() || "abiyasfaw-dev-secret-change-me";
const tokenTtlSeconds = 60 * 60 * 24 * 30; // 30 days
const resetTtlSeconds = 60 * 30; // 30 minutes
const maxSessionsPerAccount = 12;
const memberIdPattern = /^[a-zA-Z0-9_.:-]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const normalizeEmail = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

export const isValidPassword = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 8 && value.length <= 200;

const base64UrlEncode = (input: string | Buffer): string =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const base64UrlDecode = (input: string): Buffer =>
  Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");

const hashPassword = (password: string, salt: string): string =>
  scryptSync(password, salt, 64).toString("hex");

export const createPasswordHash = (password: string): { salt: string; passHash: string } => {
  const salt = randomBytes(16).toString("hex");
  return { salt, passHash: hashPassword(password, salt) };
};

export const verifyPassword = (password: string, salt: string, passHash: string): boolean => {
  const candidate = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(passHash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
};

const generateMemberId = (): string => `mbr_${randomBytes(9).toString("hex")}`;
const generateSid = (): string => `ses_${randomBytes(12).toString("hex")}`;

/** Ensures an account read from disk has the fields newer code relies on. */
const normalizeAccount = (raw: unknown): Account | null => {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.email !== "string") {
    return null;
  }

  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.filter(
        (session): session is StoredSession => isRecord(session) && typeof session.sid === "string",
      )
    : [];

  return {
    id: raw.id,
    email: raw.email,
    salt: typeof raw.salt === "string" ? raw.salt : "",
    passHash: typeof raw.passHash === "string" ? raw.passHash : "",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    sessions,
    resetNonce: typeof raw.resetNonce === "string" ? raw.resetNonce : undefined,
    resetRequestedAt: typeof raw.resetRequestedAt === "string" ? raw.resetRequestedAt : undefined,
  };
};

const readAccountStore = async (): Promise<AccountStore> => {
  try {
    const raw = await readFile(accountsFile, "utf8");
    const parsed = JSON.parse(raw);

    if (isRecord(parsed) && isRecord(parsed.accounts)) {
      const accounts: Record<string, Account> = {};
      for (const [key, value] of Object.entries(parsed.accounts)) {
        const account = normalizeAccount(value);
        if (account) {
          accounts[key] = account;
        }
      }
      return { accounts };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Could not read account store", error);
    }
  }

  return { accounts: {} };
};

const writeAccountStore = async (store: AccountStore): Promise<void> => {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(accountsFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
};

/** Read-modify-write helper keyed by email. Returns null if the account is missing. */
const mutateAccount = async <T>(
  email: string,
  mutator: (account: Account) => T,
): Promise<{ account: Account; result: T } | null> => {
  const normalizedEmail = normalizeEmail(email);
  const store = await readAccountStore();
  const account = store.accounts[normalizedEmail];

  if (!account) {
    return null;
  }

  const result = mutator(account);
  await writeAccountStore(store);
  return { account, result };
};

export const findAccountByEmail = async (email: string): Promise<Account | null> => {
  const store = await readAccountStore();
  return store.accounts[normalizeEmail(email)] ?? null;
};

export type AccountSummary = Pick<Account, "id" | "email" | "createdAt">;

/** Non-sensitive account list (no salt/hash) for server-side views like the ops dashboard. */
export const listAccountSummaries = async (): Promise<AccountSummary[]> => {
  const store = await readAccountStore();
  return Object.values(store.accounts).map(({ id, email, createdAt }) => ({ id, email, createdAt }));
};

export const createAccount = async (email: string, password: string): Promise<Account> => {
  const normalizedEmail = normalizeEmail(email);
  const store = await readAccountStore();

  if (store.accounts[normalizedEmail]) {
    throw new Error("account-exists");
  }

  const { salt, passHash } = createPasswordHash(password);
  const account: Account = {
    id: generateMemberId(),
    email: normalizedEmail,
    salt,
    passHash,
    createdAt: new Date().toISOString(),
    sessions: [],
  };

  store.accounts[normalizedEmail] = account;
  await writeAccountStore(store);

  return account;
};

// --- Sessions -------------------------------------------------------------

/** Registers a new active session for the account and returns its session id. */
export const startSession = async (email: string, label: string): Promise<string> => {
  const sid = generateSid();
  const now = new Date().toISOString();
  const cleanLabel = label.trim().slice(0, 80) || "Unknown device";

  const outcome = await mutateAccount(email, (account) => {
    account.sessions.push({ sid, createdAt: now, lastSeenAt: now, label: cleanLabel });
    // Keep only the most recent sessions so the list can't grow without bound.
    if (account.sessions.length > maxSessionsPerAccount) {
      account.sessions = account.sessions.slice(-maxSessionsPerAccount);
    }
  });

  if (!outcome) {
    throw new Error("account-missing");
  }

  return sid;
};

export const listSessions = async (email: string): Promise<StoredSession[]> => {
  const account = await findAccountByEmail(email);
  if (!account) {
    return [];
  }
  return [...account.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/** Revokes a single session. Returns true if a matching session was found and removed. */
export const revokeSession = async (email: string, sid: string): Promise<boolean> => {
  const outcome = await mutateAccount(email, (account) => {
    const before = account.sessions.length;
    account.sessions = account.sessions.filter((session) => session.sid !== sid);
    return before !== account.sessions.length;
  });
  return outcome?.result ?? false;
};

/** Revokes every session except `keepSid` (sign out other devices). Returns the count removed. */
export const revokeOtherSessions = async (email: string, keepSid: string): Promise<number> => {
  const outcome = await mutateAccount(email, (account) => {
    const before = account.sessions.length;
    account.sessions = account.sessions.filter((session) => session.sid === keepSid);
    return before - account.sessions.length;
  });
  return outcome?.result ?? 0;
};

/** Revokes all sessions (sign out everywhere). Returns the count removed. */
export const revokeAllSessions = async (email: string): Promise<number> => {
  const outcome = await mutateAccount(email, (account) => {
    const before = account.sessions.length;
    account.sessions = [];
    return before;
  });
  return outcome?.result ?? 0;
};

// --- Tokens ---------------------------------------------------------------

export const signToken = (account: Pick<Account, "id" | "email">, sid: string): string => {
  const iat = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub: account.id, email: account.email, sid, iat, exp: iat + tokenTtlSeconds };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(createHmac("sha256", authSecret).update(encodedPayload).digest());
  return `${encodedPayload}.${signature}`;
};

/** Verifies the HMAC signature and expiry only (stateless). Does NOT check session revocation. */
export const verifyToken = (token: unknown): SessionPayload | null => {
  if (typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = base64UrlEncode(createHmac("sha256", authSecret).update(encodedPayload).digest());
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as SessionPayload;

    if (
      !payload ||
      typeof payload.sub !== "string" ||
      !memberIdPattern.test(payload.sub) ||
      typeof payload.sid !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

export const getBearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");

  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
};

export type AuthenticatedRequest = { memberId: string; email: string; sid: string };

/**
 * Full request authentication: verifies the token signature/expiry AND that the
 * session is still active (not revoked). This is what protected routes should use.
 */
export const authenticateRequest = async (request: Request): Promise<AuthenticatedRequest | null> => {
  const payload = verifyToken(getBearerToken(request));

  if (!payload) {
    return null;
  }

  const account = await findAccountByEmail(payload.email);

  if (!account || account.id !== payload.sub) {
    return null;
  }

  const active = account.sessions.some((session) => session.sid === payload.sid);

  if (!active) {
    return null;
  }

  return { memberId: payload.sub, email: payload.email, sid: payload.sid };
};

// --- Password reset -------------------------------------------------------

const signResetToken = (payload: ResetPayload): string => {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  // A distinct HMAC prefix keeps reset tokens from being usable as session tokens and vice versa.
  const signature = base64UrlEncode(
    createHmac("sha256", authSecret).update(`reset:${encodedPayload}`).digest(),
  );
  return `${encodedPayload}.${signature}`;
};

/**
 * Issues a single-use password-reset token, storing its nonce on the account.
 * Returns null when no account matches (caller should still respond generically).
 */
export const createResetToken = async (email: string): Promise<{ token: string; expiresInMinutes: number } | null> => {
  const nonce = randomBytes(16).toString("hex");
  const now = Math.floor(Date.now() / 1000);

  const outcome = await mutateAccount(email, (account) => {
    account.resetNonce = nonce;
    account.resetRequestedAt = new Date().toISOString();
    const payload: ResetPayload = {
      sub: account.id,
      email: account.email,
      purpose: "reset",
      nonce,
      iat: now,
      exp: now + resetTtlSeconds,
    };
    return signResetToken(payload);
  });

  if (!outcome) {
    return null;
  }

  return { token: outcome.result, expiresInMinutes: Math.floor(resetTtlSeconds / 60) };
};

const verifyResetToken = async (token: unknown): Promise<{ email: string } | null> => {
  if (typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = base64UrlEncode(
    createHmac("sha256", authSecret).update(`reset:${encodedPayload}`).digest(),
  );
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  let payload: ResetPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as ResetPayload;
  } catch {
    return null;
  }

  if (
    !payload ||
    payload.purpose !== "reset" ||
    typeof payload.email !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp < Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  const account = await findAccountByEmail(payload.email);

  // The nonce must match the one currently on the account, making the token single-use.
  if (!account || account.id !== payload.sub || account.resetNonce !== payload.nonce) {
    return null;
  }

  return { email: account.email };
};

/**
 * Consumes a reset token and sets a new password. On success it also rotates the
 * nonce (invalidating the used token) and revokes ALL sessions, forcing re-login.
 */
export const resetPassword = async (token: unknown, newPassword: string): Promise<boolean> => {
  const verified = await verifyResetToken(token);

  if (!verified) {
    return false;
  }

  const { salt, passHash } = createPasswordHash(newPassword);

  const outcome = await mutateAccount(verified.email, (account) => {
    account.salt = salt;
    account.passHash = passHash;
    account.resetNonce = undefined;
    account.resetRequestedAt = undefined;
    account.sessions = [];
  });

  return outcome !== null;
};
