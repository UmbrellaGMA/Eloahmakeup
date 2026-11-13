-- =============================================================================
-- Eloah Make Up — Endurecimento (Supabase Security Advisor)
-- Funções de trigger não devem ser chamáveis via /rest/v1/rpc.
-- (Triggers continuam disparando: EXECUTE não é verificado no disparo.)
-- is_admin() permanece executável por anon/authenticated de propósito: as
-- políticas RLS a chamam e ela só informa se o PRÓPRIO chamador é admin.
-- =============================================================================

revoke all on function public.orders_log_status() from public, anon, authenticated;
revoke all on function public.products_create_inventory() from public, anon, authenticated;
revoke all on function public.variants_after_change() from public, anon, authenticated;
revoke all on function public.orders_guard_update() from public, anon, authenticated;
revoke all on function public.require_privileged_write() from public, anon, authenticated;
revoke all on function public.products_set_search_text() from public, anon, authenticated;
revoke all on function public.addresses_single_default() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.is_owner() from public, anon;
