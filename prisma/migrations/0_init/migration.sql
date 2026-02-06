-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "address" TEXT,
    "agendaUrl" TEXT,
    "liveStreamUrl" TEXT,
    "meetingType" TEXT NOT NULL DEFAULT 'REGULAR',
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityCache" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "lastScraped" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Meeting_cityId_idx" ON "Meeting"("cityId");

-- CreateIndex
CREATE INDEX "Meeting_date_idx" ON "Meeting"("date");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_cityId_externalId_key" ON "Meeting"("cityId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "CityCache_cityId_key" ON "CityCache"("cityId");
