import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export type Account = {
  id: string;
  email: string;
  salt: string;
  passHash: string;
  createdAt: string;
};

type AccountStore = {
  accounts: Record<string, Account>;
};

export type SessionPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

const dataDirectory = path.join(process.cwd(), ".data");
const accountsFile = path.join(dataDirectory, "accounts.json");

// Dev fallback only. Set ABIYASFAW_AUTH_SECRET in the environment for anything real.
const authSecret = process.env.ABIYASFAW_AUTH_SECRET?.trim() || "abiyasfaw-dev-secret-change-me";
const tokenTtlSeconds = 60 * 60 * 24 * 30; // 30 days
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

const readAccountStore = async (): Promise<AccountStore> => {
  try {
    const raw = await readFile(accountsFile, "utf8");
    const parsed = JSON.parse(raw);

    if (isRecord(parsed) && isRecord(parsed.accounts)) {
      return { accounts: parsed.accounts as Record<string, Account> };
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

export const findAccountByEmail = async (email: string): Promise<Account | null> => {
  const store = await readAccountStore();
  return store.accounts[normalizeEmail(email)] ?? null;
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
  };

  store.accounts[normalizedEmail] = account;
  await writeAccountStore(store);

  return account;
};

export const signToken = (account: Pick<Account, "id" | "email">): string => {
  const iat = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub: account.id, email: account.email, iat, exp: iat + tokenTtlSeconds };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(createHmac("sha256", authSecret).update(encodedPayload).digest());
  return `${encodedPayload}.${signature}`;
};

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

/** Returns the authenticated memberId from a request's bearer token, or null. */
export const getAuthenticatedMemberId = (request: Request): string | null => {
  const payload = verifyToken(getBearerToken(request));
  return payload ? payload.sub : null;
};
