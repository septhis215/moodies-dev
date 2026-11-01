-- Moodies authenticates through Nest, not Supabase Auth. These tables are backend-only.
-- Existing rows and the database owner's access are preserved. No permissive API policies.
BEGIN;

ALTER TABLE public.achievement_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_award_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watched_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_title_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_trend_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Quiz" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.achievement_rule_versions, public.achievement_accounts,
  public.achievement_events, public.achievement_facts, public.achievement_metrics,
  public.achievement_award_log, public.achievement_notifications, public.watched_titles,
  public.quiz_completions, public.achievement_title_snapshots, public.achievement_trend_snapshots,
  public.achievements, public.badge_definitions, public.user_achievements, public."Quiz", public.mood_logs
FROM PUBLIC;

-- PostgreSQL otherwise grants EXECUTE to PUBLIC, which can expose functions through /rpc.
REVOKE EXECUTE ON FUNCTION public.achievement_emit(text,text,text,jsonb,timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.achievement_metrics(text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.achievement_capture_row() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.achievement_capture_library_delete() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.achievement_account_deleted() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.achievement_rule_immutable() FROM PUBLIC;

-- Supabase roles are absent on ordinary PostgreSQL installations. Revoke their explicit
-- default grants when present, without changing service_role or other application roles.
DO $achievement_api_grants$
DECLARE api_role text; target_table text; target_function regprocedure;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
      FOREACH target_table IN ARRAY ARRAY[
        'achievement_rule_versions','achievement_accounts','achievement_events','achievement_facts',
        'achievement_metrics','achievement_award_log','achievement_notifications','watched_titles',
        'quiz_completions','achievement_title_snapshots','achievement_trend_snapshots',
        'achievements','badge_definitions','user_achievements','Quiz','mood_logs'
      ] LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I',target_table,api_role);
      END LOOP;
      FOREACH target_function IN ARRAY ARRAY[
        'public.achievement_emit(text,text,text,jsonb,timestamptz)'::regprocedure,
        'public.achievement_metrics(text,text)'::regprocedure,
        'public.achievement_capture_row()'::regprocedure,
        'public.achievement_capture_library_delete()'::regprocedure,
        'public.achievement_account_deleted()'::regprocedure,
        'public.achievement_rule_immutable()'::regprocedure
      ] LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM %I',target_function,api_role);
      END LOOP;
    END IF;
  END LOOP;
END $achievement_api_grants$;

COMMIT;
