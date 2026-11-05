-- Persist only the hash of each reusable classroom join code.
ALTER TABLE "SchoolClass" ADD COLUMN "joinCodeHash" TEXT;

-- Class names are unique per teacher, rather than globally.
DROP INDEX "SchoolClass_name_key";
CREATE UNIQUE INDEX "SchoolClass_teacherId_name_key" ON "SchoolClass"("teacherId", "name");
CREATE UNIQUE INDEX "SchoolClass_joinCodeHash_key" ON "SchoolClass"("joinCodeHash");
