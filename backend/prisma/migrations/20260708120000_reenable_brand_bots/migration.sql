-- Re-enable brand bots that were incorrectly disabled by the Resto bot migration
UPDATE "telegram_bots" tb
SET "isActive" = true, "updatedAt" = NOW()
WHERE tb."username" != 'resto_restaurantbot'
  AND NOT EXISTS (
    SELECT 1 FROM "brands" b
    WHERE b."id" = tb."brandId"
      AND (LOWER(b."name") = 'resto' OR b."slug" = 'resto')
  );
