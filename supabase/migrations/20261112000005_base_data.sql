-- =============================================================================
-- Eloah Make Up — Dados estruturais iniciais (não são dados de vendas)
-- Configuração única da loja e árvore de categorias. Seguro para reexecução.
-- =============================================================================

insert into public.store_settings (id, store_name, tagline, max_installments, min_installment_value, testimonials)
values (
  1,
  'Eloah Make Up',
  'Maquiagem que revela a sua melhor versão.',
  6,
  20,
  '[]'::jsonb
)
on conflict (id) do nothing;

insert into public.categories (name, slug, description, position)
values
  ('Maquiagens', 'maquiagens', 'Rosto, olhos e lábios com acabamento profissional.', 1),
  ('Acessórios', 'acessorios', 'Pincéis, esponjas, necessaires e tudo para a sua rotina.', 2)
on conflict (slug) do nothing;

insert into public.categories (name, slug, parent_id, position)
select x.name, x.slug, c.id, x.position
  from (values
    ('Rosto',       'rosto',       'maquiagens', 1),
    ('Olhos',       'olhos',       'maquiagens', 2),
    ('Lábios',      'labios',      'maquiagens', 3),
    ('Sobrancelhas','sobrancelhas','maquiagens', 4),
    ('Pincéis',     'pinceis',     'acessorios', 1),
    ('Esponjas',    'esponjas',    'acessorios', 2),
    ('Necessaires', 'necessaires', 'acessorios', 3)
  ) as x(name, slug, parent_slug, position)
  join public.categories c on c.slug = x.parent_slug
on conflict (slug) do nothing;
