# Abiyasfaw Mobile

Expo React Native prototype for the member-facing blind match experience.

## What is included

- First-run onboarding for intention, city, language, faith comfort, family expectations, reveal pace, date style, and dealbreakers
- Local blind-match ranking based on onboarding choices
- Blind profile preview
- Match browser with fit score and match reasons
- Match-lens summary based on onboarding choices
- Cultural cue selection
- Prompt answer progress
- Voice prompt draft flow
- Voice reveal readiness
- Photo reveal rules gated by prompts, voice intro, and hosted date acceptance
- Hosted first-date choices
- Safety pause control
- Backend-backed profile and prompt answer persistence when the dashboard API is running

## Run

```bash
npm run start
npm run web
npm run android
npm run ios
```

From the repository root:

```bash
npm run mobile:start
npm run mobile:web
```

## Persistence

The app saves member state to the dashboard API at `http://localhost:3000/api/member-state` by default. Start the dashboard with `npm run dev` from the repository root before running Expo.

For device testing, set `EXPO_PUBLIC_ABIYASFAW_API_URL` to a reachable dashboard URL, for example `http://192.168.1.25:3000`. Use `EXPO_PUBLIC_ABIYASFAW_MEMBER_ID` to test multiple saved member profiles.
