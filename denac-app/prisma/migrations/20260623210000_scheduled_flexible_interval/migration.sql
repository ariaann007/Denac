-- Rename frequency -> intervalType
ALTER TABLE "ScheduledEntry" RENAME COLUMN "frequency" TO "intervalType";

-- Add intervalValue column (default 1 for existing rows)
ALTER TABLE "ScheduledEntry" ADD COLUMN "intervalValue" INTEGER NOT NULL DEFAULT 1;

-- Make dayOfMonth nullable (was defaulted to 1, now optional)
ALTER TABLE "ScheduledEntry" ALTER COLUMN "dayOfMonth" DROP NOT NULL;
ALTER TABLE "ScheduledEntry" ALTER COLUMN "dayOfMonth" DROP DEFAULT;

-- Migrate legacy values: MONTHLY->MONTHS, WEEKLY->WEEKS, YEARLY->YEARS
UPDATE "ScheduledEntry" SET "intervalType" = 'MONTHS' WHERE "intervalType" = 'MONTHLY';
UPDATE "ScheduledEntry" SET "intervalType" = 'WEEKS'  WHERE "intervalType" = 'WEEKLY';
UPDATE "ScheduledEntry" SET "intervalType" = 'YEARS'  WHERE "intervalType" = 'YEARLY';
