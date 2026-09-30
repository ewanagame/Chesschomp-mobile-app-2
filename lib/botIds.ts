/** Roster ids without image imports — keep aligned with entries in lib/bots.ts */
export const KNOWN_BOT_IDS = new Set([
  'gary',
  'chip',
  'loaf',
  'bruce',
  'cleo',
  'rex',
  'nori',
  'nile',
  'chomp',
]);

export function isKnownBotId(id: string): boolean {
  return KNOWN_BOT_IDS.has(id);
}
