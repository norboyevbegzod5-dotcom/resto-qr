export const BRAND_BOT_RESTORATIONS = [
  { username: 'dolcetta_deliverybot', envVar: 'DOLCETTA_BOT_TOKEN' },
  { username: 'uzbekona_deliverybot', envVar: 'UZBEKONA_BOT_TOKEN' },
] as const;

export function isValidBotToken(token: string | null | undefined): token is string {
  return !!token && !token.startsWith('revoked-') && token.includes(':');
}
