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
