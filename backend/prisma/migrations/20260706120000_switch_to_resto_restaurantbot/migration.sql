-- Release tokens from old bots to avoid unique constraint violation
UPDATE "telegram_bots"
SET
  "token" = 'revoked-' || "id"::text,
  "isActive" = false,
  "updatedAt" = NOW()
WHERE "username" != 'resto_restaurantbot';

-- Upsert the new Resto bot
INSERT INTO "telegram_bots" ("name", "token", "username", "brandId", "isActive", "createdAt", "updatedAt")
VALUES (
  'Resto',
  '8814406811:AAGbQ_MK6yP55L8ZNcQS0CZLGzYvjC1xp6Q',
  'resto_restaurantbot',
  (SELECT "id" FROM "brands" WHERE LOWER("name") = 'resto' OR "slug" = 'resto' LIMIT 1),
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("username") DO UPDATE SET
  "token" = EXCLUDED."token",
  "isActive" = true,
  "brandId" = COALESCE("telegram_bots"."brandId", EXCLUDED."brandId"),
  "updatedAt" = NOW();
