-- AlterTable
ALTER TABLE "receipt_photos" ADD COLUMN "botId" INTEGER;

-- CreateIndex
CREATE INDEX "receipt_photos_botId_idx" ON "receipt_photos"("botId");

-- AddForeignKey
ALTER TABLE "receipt_photos" ADD CONSTRAINT "receipt_photos_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
