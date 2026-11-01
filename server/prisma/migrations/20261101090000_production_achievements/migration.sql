-- Apply before enabling the achievement worker. This migration does not drop user data.
BEGIN;
-- DropForeignKey
ALTER TABLE "Quiz" DROP CONSTRAINT "Quiz_userId_fkey";

-- AlterTable
ALTER TABLE "achievements" ADD COLUMN     "ruleVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "user_achievements" ADD COLUMN     "ruleVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "achievement_rule_versions" (
    "id" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "target" TEXT NOT NULL,
    "requiredCount" INTEGER,
    "definition" JSONB NOT NULL,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_accounts" (
    "userId" TEXT NOT NULL,
    "timezone" TEXT,
    "nextSequence" BIGINT NOT NULL DEFAULT 0,
    "projectedSequence" BIGINT NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "achievement_accounts_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "achievement_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sequence" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMPTZ(3),
    "errorCode" TEXT,
    "processedAt" TIMESTAMPTZ(3),

    CONSTRAINT "achievement_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_facts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "day" VARCHAR(10),
    "details" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "sourceEventId" TEXT,

    CONSTRAINT "achievement_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_metrics" (
    "userId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "lastSequence" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "achievement_metrics_pkey" PRIMARY KEY ("userId","metric")
);

-- CreateTable
CREATE TABLE "achievement_award_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "evidence" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_award_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "seenAt" TIMESTAMPTZ(3),
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watched_titles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "watchedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watched_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "quizType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "completedDay" VARCHAR(10) NOT NULL,
    "completedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_title_snapshots" (
    "key" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_title_snapshots_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "achievement_trend_snapshots" (
    "id" TEXT NOT NULL,
    "keys" TEXT[],
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,
    "validUntil" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "achievement_trend_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "achievement_rule_versions_achievementId_version_key" ON "achievement_rule_versions"("achievementId", "version");

-- CreateIndex
CREATE INDEX "achievement_events_status_availableAt_idx" ON "achievement_events"("status", "availableAt");

-- CreateIndex
CREATE INDEX "achievement_events_status_leaseUntil_idx" ON "achievement_events"("status", "leaseUntil");

-- CreateIndex
CREATE INDEX "achievement_events_status_processedAt_idx" ON "achievement_events"("status", "processedAt");

-- CreateIndex
CREATE INDEX "achievement_events_userId_status_sequence_idx" ON "achievement_events"("userId", "status", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_events_userId_sequence_key" ON "achievement_events"("userId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_events_userId_key_key" ON "achievement_events"("userId", "key");

-- CreateIndex
CREATE INDEX "achievement_facts_userId_metric_day_idx" ON "achievement_facts"("userId", "metric", "day");

-- CreateIndex
CREATE INDEX "achievement_facts_sourceEventId_idx" ON "achievement_facts"("sourceEventId");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_facts_userId_metric_key_key" ON "achievement_facts"("userId", "metric", "key");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_award_log_idempotencyKey_key" ON "achievement_award_log"("idempotencyKey");

-- CreateIndex
CREATE INDEX "achievement_award_log_userId_createdAt_idx" ON "achievement_award_log"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "achievement_award_log_achievementId_idx" ON "achievement_award_log"("achievementId");

-- CreateIndex
CREATE INDEX "achievement_award_log_sourceEventId_idx" ON "achievement_award_log"("sourceEventId");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_notifications_awardId_key" ON "achievement_notifications"("awardId");

-- CreateIndex
CREATE INDEX "achievement_notifications_userId_seenAt_leaseUntil_idx" ON "achievement_notifications"("userId", "seenAt", "leaseUntil");

-- CreateIndex
CREATE INDEX "watched_titles_userId_watchedAt_idx" ON "watched_titles"("userId", "watchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "watched_titles_userId_tmdbId_mediaType_key" ON "watched_titles"("userId", "tmdbId", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_completions_quizId_key" ON "quiz_completions"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_completions_userId_attemptId_key" ON "quiz_completions"("userId", "attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_completions_userId_quizType_completedDay_key" ON "quiz_completions"("userId", "quizType", "completedDay");

-- CreateIndex
CREATE INDEX "achievement_title_snapshots_fetchedAt_idx" ON "achievement_title_snapshots"("fetchedAt");

-- CreateIndex
CREATE INDEX "achievement_trend_snapshots_capturedAt_validUntil_idx" ON "achievement_trend_snapshots"("capturedAt", "validUntil");

-- CreateIndex
CREATE INDEX "Quiz_userId_createdAt_idx" ON "Quiz"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_userId_status_idx" ON "reviews"("userId", "status");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_rule_versions" ADD CONSTRAINT "achievement_rule_versions_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_accounts" ADD CONSTRAINT "achievement_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_events" ADD CONSTRAINT "achievement_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_facts" ADD CONSTRAINT "achievement_facts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_facts" ADD CONSTRAINT "achievement_facts_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "achievement_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_metrics" ADD CONSTRAINT "achievement_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_award_log" ADD CONSTRAINT "achievement_award_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_award_log" ADD CONSTRAINT "achievement_award_log_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_award_log" ADD CONSTRAINT "achievement_award_log_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "achievement_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_notifications" ADD CONSTRAINT "achievement_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_notifications" ADD CONSTRAINT "achievement_notifications_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "achievement_award_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watched_titles" ADD CONSTRAINT "watched_titles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_completions" ADD CONSTRAINT "quiz_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_completions" ADD CONSTRAINT "quiz_completions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Source writes and minimal achievement evidence commit in the same transaction.
-- These functions deliberately run as the invoking database role.
ALTER TABLE achievement_events ADD CONSTRAINT achievement_event_state CHECK (status IN ('pending','processing','completed','dead'));
ALTER TABLE achievement_events ADD CONSTRAINT achievement_event_payload CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 16384);
ALTER TABLE achievement_events ADD CONSTRAINT achievement_event_attempts CHECK (attempts >= 0);
ALTER TABLE user_achievements ADD CONSTRAINT achievement_progress_nonnegative CHECK ("currentProgress" >= 0 AND "completionPercentage" BETWEEN 0 AND 100);
ALTER TABLE watched_titles ADD CONSTRAINT watched_title_positive CHECK ("tmdbId" > 0);
ALTER TABLE achievement_award_log ADD CONSTRAINT achievement_award_action CHECK (action IN ('grant','revoke','legacy'));

CREATE FUNCTION achievement_emit(p_user text, p_kind text, p_key text, p_payload jsonb, p_at timestamptz DEFAULT clock_timestamp())
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n bigint; event_id text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = p_user) THEN RETURN NULL; END IF;
  INSERT INTO achievement_accounts ("userId", "updatedAt") VALUES (p_user, clock_timestamp()) ON CONFLICT DO NOTHING;
  UPDATE achievement_accounts SET "nextSequence" = "nextSequence" + 1, "updatedAt" = clock_timestamp() WHERE "userId" = p_user RETURNING "nextSequence" INTO n;
  INSERT INTO achievement_events (id,"userId",sequence,kind,key,payload,"occurredAt")
  VALUES (gen_random_uuid()::text,p_user,n,p_kind,p_key,p_payload || jsonb_build_object('ruleVersion',coalesce((p_payload->>'ruleVersion')::int,(SELECT max("ruleVersion") FROM achievements WHERE active),1)),p_at)
  ON CONFLICT ("userId",key) DO NOTHING RETURNING id INTO event_id;
  IF event_id IS NOT NULL THEN
    UPDATE achievement_accounts SET revision=revision+1 WHERE "userId"=p_user;
  END IF;
  RETURN event_id;
END $$;

CREATE FUNCTION achievement_metrics(p_user text, p_group text DEFAULT 'all') RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE result jsonb := '{}'::jsonb; basic integer; styled integer; identity_complete integer;
BEGIN
  IF p_group IN ('all','watchlist') THEN
    result := result || jsonb_build_object('watchlist_titles',(SELECT count(*) FROM watchlist_items WHERE "userId"=p_user));
  END IF;
  IF p_group IN ('all','liked') THEN
    result := result || jsonb_build_object('liked_titles',(SELECT count(*) FROM liked_items WHERE "userId"=p_user));
  END IF;
  IF p_group IN ('all','watched') THEN
    result := result || jsonb_build_object('watched_movies',(SELECT count(*) FROM watched_titles WHERE "userId"=p_user AND "mediaType"='MOVIE'),
      'watched_series',(SELECT count(*) FROM watched_titles WHERE "userId"=p_user AND "mediaType"='TV'));
  END IF;
  IF p_group IN ('all','reviews') THEN
    result := result || jsonb_build_object('reviews',(SELECT count(*) FROM reviews WHERE "userId"=p_user AND status='PUBLISHED'));
  END IF;
  IF p_group IN ('all','community') THEN
    result := result || jsonb_build_object('community_posts',(SELECT count(*) FROM community_posts WHERE "userId"=p_user),
      'community_posts_comments',(SELECT count(*) FROM community_posts WHERE "userId"=p_user)+(SELECT count(*) FROM community_replies WHERE "userId"=p_user));
  END IF;
  IF p_group IN ('all','reviews','community','reactions') THEN
    result := result || jsonb_build_object('community_likes_received',
      (SELECT count(*) FROM review_reactions r JOIN reviews p ON p.id=r."reviewId" WHERE p."userId"=p_user AND p.status='PUBLISHED' AND r.type='LIKE' AND r."userId"<>p_user)
      +(SELECT count(*) FROM community_post_reactions r JOIN community_posts p ON p.id=r."postId" WHERE p."userId"=p_user AND r.type='LIKE' AND r."userId"<>p_user));
  END IF;
  IF p_group IN ('all','moods') THEN
    result := result || jsonb_build_object('mood_selections',(SELECT count(*) FROM mood_logs WHERE "userId"=p_user),
      'distinct_moods',(SELECT count(DISTINCT "moodId") FROM mood_logs WHERE "userId"=p_user),
      'all_moods',(SELECT count(DISTINCT l."moodId") FROM mood_logs l JOIN moods m ON m.id=l."moodId" WHERE l."userId"=p_user AND m."isActive"));
  END IF;
  IF p_group IN ('all','quiz') THEN
    result := result || jsonb_build_object('quizzes',(SELECT count(*) FROM quiz_completions WHERE "userId"=p_user),
      'all_quiz_types',(SELECT count(DISTINCT "quizType") FROM quiz_completions WHERE "userId"=p_user AND "quizType"='signal-reel'));
  END IF;
  IF p_group IN ('all','profile','quiz','moods') THEN
    SELECT (coalesce(length(btrim(name)),0)>0 AND length(btrim(username))>0)::int,
      (coalesce(length(btrim("avatarUrl")),0)>0 AND (cardinality("preferredGenres")>0 OR cardinality("preferredLanguages")>0))::int
    INTO basic,styled FROM "User" WHERE id=p_user;
    identity_complete := CASE WHEN basic=1 AND styled=1 AND EXISTS(SELECT 1 FROM quiz_completions WHERE "userId"=p_user) AND EXISTS(SELECT 1 FROM mood_logs WHERE "userId"=p_user) THEN 1 ELSE 0 END;
    result := result || jsonb_build_object('profile_basic',coalesce(basic,0),'profile_stylist',coalesce(styled,0),'full_identity',identity_complete);
  END IF;
  RETURN result;
END $$;

CREATE FUNCTION achievement_capture_row() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE row_data jsonb; owner_id text; group_name text; body jsonb; media_type text;
BEGIN
  row_data := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  owner_id := row_data->>'userId';
  CASE TG_TABLE_NAME
    WHEN 'User' THEN
      IF TG_OP='UPDATE' AND (NEW.name,NEW.username,NEW."avatarUrl",NEW."preferredGenres",NEW."preferredLanguages") IS NOT DISTINCT FROM
        (OLD.name,OLD.username,OLD."avatarUrl",OLD."preferredGenres",OLD."preferredLanguages") THEN RETURN NULL; END IF;
      owner_id := row_data->>'id'; group_name := 'profile';
    WHEN 'watchlist_items' THEN group_name := 'watchlist';
    WHEN 'liked_items' THEN group_name := 'liked';
    WHEN 'watched_titles' THEN group_name := 'watched';
    WHEN 'reviews' THEN group_name := 'reviews';
    WHEN 'community_posts' THEN group_name := 'community';
    WHEN 'community_replies' THEN group_name := 'community';
    WHEN 'mood_logs' THEN group_name := 'moods';
    WHEN 'quiz_completions' THEN group_name := 'quiz';
    WHEN 'review_reactions' THEN
      SELECT "userId" INTO owner_id FROM reviews WHERE id=row_data->>'reviewId'; group_name := 'reactions';
    WHEN 'community_post_reactions' THEN
      SELECT "userId" INTO owner_id FROM community_posts WHERE id=row_data->>'postId'; group_name := 'reactions';
    ELSE RAISE EXCEPTION 'Unsupported achievement source';
  END CASE;
  IF owner_id IS NULL OR NOT EXISTS(SELECT 1 FROM "User" WHERE id=owner_id) THEN RETURN NULL; END IF;
  -- Acquire the per-account sequence lock before reading the qualifying snapshot.
  INSERT INTO achievement_accounts ("userId","updatedAt") VALUES(owner_id,clock_timestamp()) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM achievement_accounts WHERE "userId"=owner_id FOR UPDATE;
  body := jsonb_build_object('metrics',achievement_metrics(owner_id,group_name),'source',TG_TABLE_NAME||':'||TG_OP);
  IF group_name='moods' THEN body := body || jsonb_build_object('required',jsonb_build_object('all_moods',(SELECT count(*) FROM moods WHERE "isActive"))); END IF;
  IF group_name IN ('watchlist','liked','watched') AND TG_OP='INSERT' THEN
    media_type := CASE WHEN row_data->>'mediaType'='TV' THEN 'tv' ELSE 'movie' END;
    body := body || jsonb_build_object('title',jsonb_build_object('id',(row_data->>'tmdbId')::int,'type',media_type));
  END IF;
  PERFORM achievement_emit(owner_id,'metrics',TG_TABLE_NAME||':'||TG_OP||':'||coalesce(row_data->>'id','')||':'||gen_random_uuid()::text,body);
  RETURN NULL;
END $$;

-- Clearing a library emits one snapshot per user, rather than one count query per deleted title.
CREATE FUNCTION achievement_capture_library_delete() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE owner_id text; group_name text;
BEGIN
  group_name := CASE TG_TABLE_NAME WHEN 'watchlist_items' THEN 'watchlist' WHEN 'liked_items' THEN 'liked' ELSE 'watched' END;
  FOR owner_id IN SELECT DISTINCT "userId" FROM old_rows LOOP
    IF EXISTS(SELECT 1 FROM "User" WHERE id=owner_id) THEN
      INSERT INTO achievement_accounts ("userId","updatedAt") VALUES(owner_id,clock_timestamp()) ON CONFLICT DO NOTHING;
      PERFORM 1 FROM achievement_accounts WHERE "userId"=owner_id FOR UPDATE;
      PERFORM achievement_emit(owner_id,'metrics',TG_TABLE_NAME||':clear:'||gen_random_uuid()::text,
        jsonb_build_object('metrics',achievement_metrics(owner_id,group_name),'source',TG_TABLE_NAME||':DELETE'));
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

DO $$ DECLARE source text; BEGIN
  FOREACH source IN ARRAY ARRAY['watchlist_items','liked_items','watched_titles'] LOOP
    EXECUTE format('CREATE TRIGGER achievement_insert AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION achievement_capture_row()',source);
    EXECUTE format('CREATE TRIGGER achievement_delete AFTER DELETE ON %I REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION achievement_capture_library_delete()',source);
  END LOOP;
  FOREACH source IN ARRAY ARRAY['reviews','community_posts','community_replies','mood_logs','quiz_completions','review_reactions','community_post_reactions'] LOOP
    EXECUTE format('CREATE TRIGGER achievement_change AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION achievement_capture_row()',source);
  END LOOP;
END $$;
CREATE TRIGGER achievement_profile AFTER INSERT OR UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION achievement_capture_row();

-- The legacy mood log table has no User foreign key; remove this private evidence explicitly.
CREATE FUNCTION achievement_account_deleted() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  DELETE FROM mood_logs WHERE "userId"=OLD.id;
  RETURN NULL;
END $$;
CREATE TRIGGER achievement_account_deleted AFTER DELETE ON "User" FOR EACH ROW EXECUTE FUNCTION achievement_account_deleted();

CREATE FUNCTION achievement_rule_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Published achievement rule versions are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER achievement_rule_immutable BEFORE UPDATE ON achievement_rule_versions FOR EACH ROW EXECUTE FUNCTION achievement_rule_immutable();

COMMIT;
