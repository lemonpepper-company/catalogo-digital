-- Seed de demonstração: loja pública "Ateliê Mira" (slug: atelie-mira).
-- Alimenta o catálogo público de demo referenciado na landing ("Ver um catálogo").
-- Idempotente: seguro rodar em cima de um banco já semeado.

-- Owner de demonstração
-- Tokens abaixo precisam ser '' (não NULL): o GoTrue quebra com 500 em /recover
-- ao escanear NULL nessas colunas para usuários inseridos direto via SQL.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, phone_change_token)
values ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
        'demo@vtrinedigital.com.br', crypt('demo-seed', gen_salt('bf')), now(), now(), now(),
        '', '', '', '', '', '')
on conflict (id) do nothing;

insert into public.profiles (id, full_name)
values ('11111111-1111-1111-1111-111111111111', 'Demo Ateliê')
on conflict (id) do nothing;

insert into public.stores (id, owner_id, name, slug, plan, trial_ends_at, is_active,
                           whatsapp, accent_color, monogram, description, message_template)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
        'Ateliê Mira', 'atelie-mira', 'pro', now() + interval '3650 days', true,
        '5511999990000', '#C9A96E', 'AM', 'Vitrine digital premium · moda feminina autoral', null)
on conflict (id) do nothing;

insert into public.categories (id, store_id, name, position) values
  ('c1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Vestidos', 0),
  ('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Blusas', 1),
  ('c3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Calças', 2),
  ('c4444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Saias', 3)
on conflict (id) do nothing;

insert into public.products (id, store_id, name, price_cents, description, category_id,
                             sizes, sold_sizes, colors, images, stock, is_active, is_new) values
  ('a0000001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'Vestido midi linho areia', 28990,
   'Vestido midi em linho puro com caimento fluido, alças ajustáveis e botões de madeira na frente.',
   'c1111111-1111-1111-1111-111111111111',
   '{P,M,G,GG}', '{GG}',
   '[{"label":"Areia","hex":"#D8C9B0"},{"label":"Argila","hex":"#B07A5B"},{"label":"Preto","hex":"#1A1A1A"}]',
   '{https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=700&q=80&auto=format&fit=crop}',
   12, true, true),
  ('a0000002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'Blusa de tricô off-white', 16990,
   'Tricô leve de algodão com gola redonda e mangas longas.',
   'c2222222-2222-2222-2222-222222222222',
   '{PP,P,M,G}', '{}',
   '[{"label":"Off-white","hex":"#EFEBE2"},{"label":"Caramelo","hex":"#A9712F"}]',
   '{https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=700&q=80&auto=format&fit=crop}',
   7, true, false),
  ('a0000003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
   'Calça pantalona alfaiataria', 24990,
   'Pantalona de alfaiataria com cintura alta e pregas frontais.',
   'c3333333-3333-3333-3333-333333333333',
   '{36,38,40,42,44}', '{36}',
   '[{"label":"Preto","hex":"#1A1A1A"},{"label":"Areia","hex":"#D8C9B0"}]',
   '{https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=700&q=80&auto=format&fit=crop}',
   24, true, true),
  ('a0000005-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222',
   'Saia midi plissada', 15990,
   'Saia midi plissada com cós elástico confortável e movimento leve ao caminhar.',
   'c4444444-4444-4444-4444-444444444444',
   '{Único}', '{}',
   '[{"label":"Areia","hex":"#D8C9B0"},{"label":"Verde musgo","hex":"#5A6048"}]',
   '{https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=700&q=80&auto=format&fit=crop}',
   31, true, false),
  -- Esgotado: não deve aparecer no catálogo público (stock=0)
  ('a0000004-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222',
   'Vestido slip acetinado (esgotado)', 21990,
   'Slip dress em cetim com viés nas alças.',
   'c1111111-1111-1111-1111-111111111111',
   '{P,M,G}', '{P,M,G}',
   '[{"label":"Vinho","hex":"#5B2433"}]',
   '{https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=700&q=80&auto=format&fit=crop}',
   0, true, false),
  -- Inativo: não deve aparecer no catálogo público (is_active=false)
  ('a0000006-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222',
   'Blusa cropped canelado (inativo)', 8990,
   'Cropped canelado de manga curta.',
   'c2222222-2222-2222-2222-222222222222',
   '{PP,P,M}', '{PP}',
   '[{"label":"Preto","hex":"#1A1A1A"}]',
   '{https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=700&q=80&auto=format&fit=crop}',
   5, false, false)
on conflict (id) do nothing;
