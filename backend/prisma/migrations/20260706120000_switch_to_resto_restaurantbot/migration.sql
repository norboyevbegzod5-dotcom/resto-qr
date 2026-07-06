-- Deactivate all bots except the new Resto bot
UPDATE "telegram_bots"
SET "isActive" = false, "updatedAt" = NOW()
WHERE "username" != 'resto_restaurantbot';

-- Ensure the new bot record exists with token
INSERT INTO "telegram_bots" ("name", "token", "username", "brandId", "isActive", "createdAt", "updatedAt")
SELECT
  'Resto',
  '8814406811:AAGbQ_MK6yP55L8ZNcQS0CZLGzYvjC1xp6Q',
  'resto_restaurantbot',
  (SELECT "id" FROM "brands" WHERE LOWER("name") = 'resto' OR "slug" = 'resto' LIMIT 1),
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "telegram_bots" WHERE "username" = 'resto_restaurantbot'
);

-- Reactivate and re-link to Resto brand if record already existed
UPDATE "telegram_bots"
SET
  "token" = '8814406811:AAGbQ_MK6yP55L8ZNcQS0CZLGzYvjC1xp6Q',
  "isActive" = true,
  "brandId" = COALESCE(
    "brandId",
    (SELECT "id" FROM "brands" WHERE LOWER("name") = 'resto' OR "slug" = 'resto' LIMIT 1)
  ),
  "updatedAt" = NOW()
WHERE "username" = 'resto_restaurantbot';
