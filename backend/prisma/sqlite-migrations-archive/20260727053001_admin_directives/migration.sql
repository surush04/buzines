-- CreateTable
CREATE TABLE "admin_directives" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "ai_analysis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "progress" REAL NOT NULL DEFAULT 0,
    "project_id" TEXT,
    "tasks_total" INTEGER NOT NULL DEFAULT 0,
    "tasks_done" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "admin_directives_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "admin_directives_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
