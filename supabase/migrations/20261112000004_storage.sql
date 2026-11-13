-- =============================================================================
-- Eloah Make Up — Supabase Storage
-- Buckets públicos para leitura; envio/alteração/exclusão só por administradores.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('products',      'products',      true, 5242880,  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('banners',       'banners',       true, 8388608,  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('branding',      'branding',      true, 2097152,  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon']),
  ('store-content', 'store-content', true, 8388608,  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists eloah_storage_public_read on storage.objects;
drop policy if exists eloah_storage_admin_insert on storage.objects;
drop policy if exists eloah_storage_admin_update on storage.objects;
drop policy if exists eloah_storage_admin_delete on storage.objects;

create policy eloah_storage_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('products', 'banners', 'branding', 'store-content'));

create policy eloah_storage_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('products', 'banners', 'branding', 'store-content')
    and (select public.is_admin())
  );

create policy eloah_storage_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('products', 'banners', 'branding', 'store-content')
    and (select public.is_admin())
  )
  with check (
    bucket_id in ('products', 'banners', 'branding', 'store-content')
    and (select public.is_admin())
  );

create policy eloah_storage_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('products', 'banners', 'branding', 'store-content')
    and (select public.is_admin())
  );
