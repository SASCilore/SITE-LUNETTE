-- ============================================================
-- MONTURE — schéma Supabase
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ---------- TABLES ----------

create table if not exists brands (
  id text primary key,
  name text not null,
  origin text,
  description text,
  created_at timestamptz default now()
);

create table if not exists suppliers (
  id text primary key,
  name text not null,
  contact text,
  delay text,
  location text,
  brand_ids text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists products (
  id text primary key,
  name text not null,
  brand_id text references brands(id) on delete set null,
  category text,
  gender text,
  price numeric not null,
  cost numeric default 0,
  color_name text,
  color_hex text,
  shape text default 'square',
  calibre text,
  material text,
  stock text default 'En stock',
  supplier_id text references suppliers(id) on delete set null,
  featured boolean default false,
  description text,
  photo_url text,
  created_at timestamptz default now()
);

create table if not exists orders (
  id text primary key,
  client text,
  email text,
  order_date text,
  items jsonb not null default '[]',
  status text default 'En attente',
  created_at timestamptz default now()
);

-- ---------- ROW LEVEL SECURITY ----------

alter table brands enable row level security;
alter table suppliers enable row level security;
alter table products enable row level security;
alter table orders enable row level security;

-- Lecture publique (le site vitrine doit pouvoir afficher le catalogue sans être connecté)
create policy "Public read brands" on brands for select using (true);
create policy "Public read suppliers" on suppliers for select using (true);
create policy "Public read products" on products for select using (true);

-- Écriture réservée aux utilisateurs connectés (l'admin)
create policy "Admin write brands" on brands for insert with check (auth.role() = 'authenticated');
create policy "Admin update brands" on brands for update using (auth.role() = 'authenticated');
create policy "Admin delete brands" on brands for delete using (auth.role() = 'authenticated');

create policy "Admin write suppliers" on suppliers for insert with check (auth.role() = 'authenticated');
create policy "Admin update suppliers" on suppliers for update using (auth.role() = 'authenticated');
create policy "Admin delete suppliers" on suppliers for delete using (auth.role() = 'authenticated');

create policy "Admin write products" on products for insert with check (auth.role() = 'authenticated');
create policy "Admin update products" on products for update using (auth.role() = 'authenticated');
create policy "Admin delete products" on products for delete using (auth.role() = 'authenticated');

-- Commandes : n'importe quel visiteur peut en créer une (tunnel de commande), seul l'admin peut les consulter/gérer
create policy "Anyone can place an order" on orders for insert with check (true);
create policy "Admin read orders" on orders for select using (auth.role() = 'authenticated');
create policy "Admin update orders" on orders for update using (auth.role() = 'authenticated');
create policy "Admin delete orders" on orders for delete using (auth.role() = 'authenticated');

-- ---------- STOCKAGE (photos produits) ----------

insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

create policy "Public read product photos" on storage.objects
  for select using (bucket_id = 'product-photos');

create policy "Admin upload product photos" on storage.objects
  for insert with check (bucket_id = 'product-photos' and auth.role() = 'authenticated');

create policy "Admin update product photos" on storage.objects
  for update using (bucket_id = 'product-photos' and auth.role() = 'authenticated');

create policy "Admin delete product photos" on storage.objects
  for delete using (bucket_id = 'product-photos' and auth.role() = 'authenticated');

-- ============================================================
-- Données de démarrage (marques et fournisseurs de référence).
-- Les produits ne sont pas pré-remplis : importez votre vrai
-- catalogue via l'admin (CSV/Excel) une fois connecté.
-- ============================================================

insert into brands (id, name, origin, description) values
  ('rb', 'Ray-Ban', 'États-Unis', 'Icônes intemporelles depuis 1937.'),
  ('ok', 'Oakley', 'États-Unis', 'Performance sportive et lentilles techniques.'),
  ('pr', 'Prada', 'Italie', 'Haute couture milanaise, lignes graphiques.'),
  ('ps', 'Persol', 'Italie', 'Artisanat optique turinois depuis 1917.'),
  ('gc', 'Gucci', 'Italie', 'Maximalisme signature, écailles franches.'),
  ('ca', 'Carrera', 'Autriche', 'Héritage racing, montures légères.')
on conflict (id) do nothing;

insert into suppliers (id, name, contact, delay, location, brand_ids) values
  ('s1', 'Lux Optic Distribution', 'contact@luxoptic-dist.fr', '3–5 jours ouvrés', 'Lyon, France', array['rb','ok','ca']),
  ('s2', 'Milano Eyewear Group', 'orders@milanoeyewear.it', '5–8 jours ouvrés', 'Milan, Italie', array['pr','gc','ps']),
  ('s3', 'EuroFrame Wholesale', 'sales@euroframe.eu', '4–6 jours ouvrés', 'Anvers, Belgique', array['rb','ps','ca'])
on conflict (id) do nothing;
