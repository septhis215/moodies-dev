/*
  Reconciliation migration (written idempotently on purpose).

  - Drops the unused legacy `Badge` table. It was already removed on production
    out-of-band, which caused migrate-history drift; `IF EXISTS` makes this a safe
    no-op there while still dropping it on fresh/dev databases. CASCADE clears its
    own FK (Badge_userId_fkey).
  - Adds the EmailVerification indexes. `IF NOT EXISTS` keeps this safe if the
    indexes were already created manually on production.
*/

-- DropTable (idempotent)
DROP TABLE IF EXISTS "Badge" CASCADE;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "EmailVerification_email_code_idx" ON "EmailVerification"("email", "code");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "EmailVerification_expiresAt_idx" ON "EmailVerification"("expiresAt");
