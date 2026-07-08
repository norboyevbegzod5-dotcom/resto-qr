-- Restore Uzbekona bot token
UPDATE "telegram_bots"
SET
  "token" = '8501554362:AAFD3wWCO8HoOQAaKsv_GFoh-XNKr_bCvmA',
  "isActive" = true,
  "updatedAt" = NOW()
WHERE LOWER("username") = 'uzbekona_deliverybot';
