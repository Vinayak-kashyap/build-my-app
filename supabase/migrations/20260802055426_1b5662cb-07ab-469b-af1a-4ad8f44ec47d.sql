
REVOKE ALL ON FUNCTION public.vote_weight(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_report_votes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_report_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_priority_score() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
