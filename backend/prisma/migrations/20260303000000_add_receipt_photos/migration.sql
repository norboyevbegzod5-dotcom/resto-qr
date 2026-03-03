-- CreateTable
CREATE TABLE "receipt_photos" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receipt_photos_userId_idx" ON "receipt_photos"("userId");

-- AddForeignKey
ALTER TABLE "receipt_photos" ADD CONSTRAINT "receipt_photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
