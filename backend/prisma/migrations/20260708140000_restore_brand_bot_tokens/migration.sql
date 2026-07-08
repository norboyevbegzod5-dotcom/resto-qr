-- Restore Dolcetta bot token that was revoked by the Resto migration
UPDATE "telegram_bots"
SET
  "token" = '8554702779:AAEIVW4iUEnAJEpKQK4p6mssAdkKAjJhScg',
  "isActive" = true,
  "updatedAt" = NOW()
WHERE LOWER("username") = 'dolcetta_deliverybot';

-- Re-enable Uzbekona (token must be set via UZBEKONA_BOT_TOKEN env or admin panel)
UPDATE "telegram_bots"
SET
  "isActive" = true,
  "updatedAt" = NOW()
WHERE LOWER("username") = 'uzbekona_deliverybot';
