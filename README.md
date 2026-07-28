# Abiyasfaw

Blind dating platform inspired by Ethiopian culture.

## Apps

- `apps/dashboard` - Next.js dashboard for operations, moderation, event planning, and match health.
- `apps/mobile` - React Native Expo app for blind-first matching, cultural prompts, and date planning.

## Scripts

```bash
npm run dev
npm run expo
```

Use `npm run dev` for the Next.js dashboard and `npm run expo` for the Expo mobile app.
For browser-based mobile preview, run `npm run expo:web`.

## Accounts and authentication

The dashboard backend now issues private member accounts. Passwords are hashed
(scrypt) and a signed session token (HMAC) is returned on sign-in:

- `POST /api/auth/register` — `{ email, password }` → `{ token, memberId, email }`
- `POST /api/auth/login` — `{ email, password }` → `{ token, memberId, email }`
- `GET /api/auth/session` — `Authorization: Bearer <token>` → `{ memberId, email }`

Accounts are stored in `apps/dashboard/.data/accounts.json` (git-ignored). Set
`ABIYASFAW_AUTH_SECRET` in the dashboard environment to sign tokens with a real
secret; a dev fallback is used when it is unset.

## Local persistence

The member-state backend is now private — it derives the member from the bearer
token, so a token is required and the `memberId` can no longer be spoofed:

- `GET /api/member-state` — `Authorization: Bearer <token>`
- `PUT /api/member-state` — `Authorization: Bearer <token>`

It stores each account's onboarding profile, prompt answers, reveal progress
(including mutual photo-reveal consent), voice draft choices, hosted-date
choices, and reveal-safe chat messages in `apps/dashboard/.data/member-state.json`,
keyed by the authenticated member id and ignored by git.

The mobile app keeps the session token in `expo-secure-store` (device keychain),
falling back to `localStorage` on web.

Start the dashboard before the mobile app when you want persistence:

```bash
npm run dev
```

The mobile app defaults to `http://localhost:3000`. For a physical phone or native emulator, set `EXPO_PUBLIC_ABIYASFAW_API_URL` to the dashboard URL that device can reach.

Build and lint shortcuts:

```bash
npm run build
npm run lint
```

Each app owns its own dependencies and package lock. The longer app-specific scripts are still available when needed.
