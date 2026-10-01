CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "jobLocation" TEXT NOT NULL,
    "jobUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Job_userId_idx" ON "Job"("userId");

ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
