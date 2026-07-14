-- CreateTable
CREATE TABLE "broadcasts" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "botId" INTEGER,
    "botUsername" TEXT,
    "total" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_recipients" (
    "id" SERIAL NOT NULL,
    "broadcastId" INTEGER NOT NULL,
    "userId" INTEGER,
    "chatId" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcast_recipients_broadcastId_idx" ON "broadcast_recipients"("broadcastId");

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
