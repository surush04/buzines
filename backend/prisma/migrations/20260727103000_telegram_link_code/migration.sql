-- AlterTable
ALTER TABLE "employees" ADD COLUMN "telegram_link_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "employees_telegram_link_code_key" ON "employees"("telegram_link_code");
