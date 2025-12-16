/*
  Warnings:

  - You are about to drop the column `createdAt` on the `LinkSubmission` table. All the data in the column will be lost.
  - You are about to drop the column `linkId` on the `LinkSubmission` table. All the data in the column will be lost.
  - You are about to drop the column `proof` on the `LinkSubmission` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `LinkSubmission` table. All the data in the column will be lost.
  - Added the required column `promotedLinkId` to the `LinkSubmission` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "LinkSubmission" DROP CONSTRAINT "LinkSubmission_linkId_fkey";

-- DropForeignKey
ALTER TABLE "LinkSubmission" DROP CONSTRAINT "LinkSubmission_userId_fkey";

-- DropForeignKey
ALTER TABLE "TopUpRequest" DROP CONSTRAINT "TopUpRequest_packageId_fkey";

-- DropForeignKey
ALTER TABLE "TopUpRequest" DROP CONSTRAINT "TopUpRequest_walletId_fkey";

-- AlterTable
ALTER TABLE "LinkSubmission" DROP COLUMN "createdAt",
DROP COLUMN "linkId",
DROP COLUMN "proof",
DROP COLUMN "userId",
ADD COLUMN     "promotedLinkId" INTEGER NOT NULL,
ADD COLUMN     "screenshots" TEXT[],
ADD COLUMN     "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "visitorId" INTEGER;

-- AlterTable
ALTER TABLE "TopUpPackage" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BDT';

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- AddForeignKey
ALTER TABLE "TopUpRequest" ADD CONSTRAINT "TopUpRequest_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TopUpPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopUpRequest" ADD CONSTRAINT "TopUpRequest_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "TopUpWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkSubmission" ADD CONSTRAINT "LinkSubmission_promotedLinkId_fkey" FOREIGN KEY ("promotedLinkId") REFERENCES "PromotedLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkSubmission" ADD CONSTRAINT "LinkSubmission_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
