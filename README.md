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

## Local persistence

The dashboard app also exposes the prototype member-state backend:

- `GET /api/member-state?memberId=demo-member`
- `PUT /api/member-state?memberId=demo-member`

It stores onboarding profiles, prompt answers, reveal progress, voice draft choices, and hosted-date choices in `apps/dashboard/.data/member-state.json`, which is ignored by git.

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
