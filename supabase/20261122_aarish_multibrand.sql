-- Aarish Co. + Aarish Jewelry multi-brand migration.
-- Run after supabase/schema.sql. This migration is additive and does not drop
-- existing tables or rows. Existing products are archived from the storefront
-- so restaurant content is not presented as fashion inventory.

create extension if not exists pgcrypto;

alter table public.products
  add column if not exists brand text not null default 'clothing'
    check (brand in ('clothing', 'jewelry')),
  add column if not exists sale_price numeric(10,2)
    check (sale_price is null or sale_price >= 0),
  add column if not exists material text not null default '',
  add column if not exists color text not null default '',
  add column if not exists dimensions text not null default '',
  add column if not exists sizes jsonb not null default '[]'::jsonb,
  add column if not exists attributes jsonb not null default '{}'::jsonb,
  add column if not exists stock_quantity integer not null default 0
    check (stock_quantity >= 0);

alter table public.order_items
  add column if not exists brand text not null default 'clothing'
    check (brand in ('clothing', 'jewelry')),
  add column if not exists variant_id uuid;

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('clothing', 'jewelry')),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (brand, slug)
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text,
  size text not null default '',
  color text not null default '',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);

create index if not exists products_brand_available_idx
  on public.products (brand, available, created_at desc);
create index if not exists product_images_product_idx
  on public.product_images (product_id, sort_order);
create index if not exists product_variants_product_idx
  on public.product_variants (product_id);
create index if not exists order_items_brand_idx
  on public.order_items (brand);

insert into public.product_categories (brand, name, slug) values
  ('clothing', 'T-shirts', 't-shirts'),
  ('clothing', 'Shirts', 'shirts'),
  ('clothing', 'Casual wear', 'casual-wear'),
  ('jewelry', 'Necklaces', 'necklaces'),
  ('jewelry', 'Bangles', 'bangles'),
  ('jewelry', 'Bracelets', 'bracelets'),
  ('jewelry', 'Earrings', 'earrings'),
  ('jewelry', 'Rings', 'rings')
on conflict (brand, slug) do nothing;

-- Existing restaurant rows are retained for audit/history but hidden.
update public.products
set available = false
where coalesce(brand, 'clothing') = 'clothing'
  and (name ilike '%shawarma%' or name ilike '%burger%' or name ilike '%fries%'
    or name ilike '%wrap%' or name ilike '%brownie%' or name ilike '%lemonade%');

update public.orders set status = case status
  when 'new' then 'pending'
  when 'preparing' then 'processing'
  when 'out_for_delivery' then 'shipped'
  when 'completed' then 'delivered'
  else status end;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'));

alter table public.product_images enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_variants enable row level security;

drop policy if exists "Public can view product images" on public.product_images;
create policy "Public can view product images"
  on public.product_images for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and (p.available or public.is_store_owner())
  ));
drop policy if exists "Owners manage product images" on public.product_images;
create policy "Owners manage product images"
  on public.product_images for all to authenticated
  using (public.is_store_owner()) with check (public.is_store_owner());

drop policy if exists "Public can view product categories" on public.product_categories;
create policy "Public can view product categories"
  on public.product_categories for select to anon, authenticated using (true);
drop policy if exists "Owners manage product categories" on public.product_categories;
create policy "Owners manage product categories"
  on public.product_categories for all to authenticated
  using (public.is_store_owner()) with check (public.is_store_owner());

drop policy if exists "Public can view available variants" on public.product_variants;
create policy "Public can view available variants"
  on public.product_variants for select to anon, authenticated
  using (available or public.is_store_owner());
drop policy if exists "Owners manage variants" on public.product_variants;
create policy "Owners manage variants"
  on public.product_variants for all to authenticated
  using (public.is_store_owner()) with check (public.is_store_owner());

drop policy if exists "Owners view all order items" on public.order_items;
create policy "Owners view all order items"
  on public.order_items for select to authenticated using (public.is_store_owner());

create or replace function public.place_order(
  p_customer_name text, p_customer_phone text, p_customer_email text default '',
  p_delivery_address text default '', p_delivery_notes text default '',
  p_items jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_subtotal numeric(10,2) := 0;
  v_fee numeric(10,2) := 150;
  v_item jsonb;
  v_pid uuid;
  v_qty integer;
  v_variant uuid;
  v_product public.products%rowtype;
  v_variant_row public.product_variants%rowtype;
  v_count integer := 0;
  v_unit_price numeric(10,2);
begin
  if length(trim(coalesce(p_customer_name, ''))) not between 1 and 100
    or length(trim(coalesce(p_customer_phone, ''))) not between 1 and 40
    or length(trim(coalesce(p_delivery_address, ''))) not between 1 and 500 then
    raise exception 'Please provide your name, phone number and delivery address.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 30 then
    raise exception 'Your cart is empty or contains too many different items.';
  end if;
  select delivery_fee into v_fee from public.store_settings where id = 1;
  v_fee := coalesce(v_fee, 150);

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_variant := nullif(v_item->>'variant_id', '')::uuid;
    if v_qty < 1 or v_qty > 20 then
      raise exception 'Each quantity must be between 1 and 20.';
    end if;
    select * into v_product from public.products
      where id = v_pid and available = true;
    if not found then
      raise exception 'A product is no longer available. Please refresh your cart.';
    end if;
    v_unit_price := coalesce(v_product.sale_price, v_product.price);
    if v_variant is not null then
      select * into v_variant_row from public.product_variants
        where id = v_variant and product_id = v_pid and available = true
        for update;
      if not found or v_variant_row.stock_quantity < v_qty then
        raise exception 'A selected product variant is out of stock.';
      end if;
      update public.product_variants
      set stock_quantity = stock_quantity - v_qty, updated_at = now()
      where id = v_variant;
    else
      if v_product.stock_quantity < v_qty then
        raise exception 'A product is out of stock.';
      end if;
      update public.products
      set stock_quantity = stock_quantity - v_qty, updated_at = now()
      where id = v_pid;
    end if;
    v_subtotal := v_subtotal + (v_unit_price * v_qty);
    v_count := v_count + v_qty;
  end loop;
  if v_count > 100 then raise exception 'Your order contains too many items.'; end if;

  insert into public.orders (
    customer_name, customer_phone, customer_email, delivery_address,
    delivery_notes, subtotal, delivery_fee, total
  ) values (
    trim(p_customer_name), trim(p_customer_phone), left(coalesce(p_customer_email, ''), 160),
    trim(p_delivery_address), left(coalesce(p_delivery_notes, ''), 500),
    v_subtotal, v_fee, v_subtotal + v_fee
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_variant := nullif(v_item->>'variant_id', '')::uuid;
    select * into v_product from public.products where id = v_pid;
    insert into public.order_items (
      order_id, product_id, product_name, unit_price, quantity, line_total, brand, variant_id
    ) values (
      v_order.id, v_product.id, v_product.name,
      coalesce(v_product.sale_price, v_product.price), v_qty,
      coalesce(v_product.sale_price, v_product.price) * v_qty,
      v_product.brand, v_variant
    );
  end loop;
  return jsonb_build_object(
    'id', v_order.id, 'order_number', v_order.order_number,
    'status', v_order.status, 'total', v_order.total
  );
end;
$$;

revoke all on function public.place_order(text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.is_store_owner() to anon, authenticated;

update public.store_settings
set store_name = 'Aarish Co. + Aarish Jewelry',
    tagline = 'Two expressions of refined everyday style.'
where id = 1 and store_name = 'Savor & Co.';
