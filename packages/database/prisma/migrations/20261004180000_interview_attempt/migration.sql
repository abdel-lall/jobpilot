-- CreateEnum
CREATE TYPE "InterviewAttemptStatus" AS ENUM ('in_progress');

-- CreateTable
CREATE TABLE "InterviewAttempt" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "InterviewAttemptStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewQuestion" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "expectedConcepts" JSONB NOT NULL,
    "rubric" TEXT NOT NULL,
    "answer" TEXT,
    "feedback" TEXT,
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewQuestion_attemptId_position_key" ON "InterviewQuestion"("attemptId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewQuestion_jobId_normalizedText_key" ON "InterviewQuestion"("jobId", "normalizedText");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewAttempt_one_in_progress_per_job"
ON "InterviewAttempt" ("jobId")
WHERE "status" = 'in_progress';

-- AddForeignKey
ALTER TABLE "InterviewAttempt" ADD CONSTRAINT "InterviewAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "InterviewAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
