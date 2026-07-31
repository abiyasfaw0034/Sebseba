// Reveal-safe chat moderation. Shared by the messages route (authoritative check on
// send) and the member-state route history. Keep this in sync with the mobile
// compose-time hint in apps/mobile/App.tsx (getChatModerationTags) — the server is
// the source of truth; the client copy is only a preview.

export type ModerationRule = {
  label: string;
  pattern: RegExp;
};

export const chatModerationRules: ModerationRule[] = [
  {
    label: "contact detail",
    pattern:
      /(\+?\d[\d\s().-]{7,}\d)|\b[\w.-]+@[\w.-]+\.\w{2,}\b|(^|\s)@[a-z0-9_.]{2,}\b/i,
  },
  {
    label: "off-app request",
    pattern: /\b(text me|call me|dm me|outside (the )?app|move to|whatsapp|telegram|instagram|snapchat)\b/i,
  },
  {
    label: "photo pressure",
    pattern:
      /\b(send|show|share|drop|need|want)\b.{0,24}\b(photos?|pics?|pictures?|selfie|image)\b|\b(photos?|pics?|pictures?|selfie|image)\b.{0,24}\b(send|show|share|drop)\b/i,
  },
  {
    label: "boundary pressure",
    pattern: /\b(skip the host|no host|prove it|right now|don't tell|dont tell)\b/i,
  },
];

export const getChatModerationTags = (message: string): string[] =>
  chatModerationRules.filter((rule) => rule.pattern.test(message)).map((rule) => rule.label);
