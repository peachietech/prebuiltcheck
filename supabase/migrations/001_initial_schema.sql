-- Pending comparisons (before retailer lookup, after scraping)
create table pending_comparisons (
  id uuid primary key default gen_random_uuid(),
  prebuilt_url text not null,
  prebuilt_name text not null,
  prebuilt_price numeric,
  prebuilt_image_url text,
  retailer text not null,
  extracted_parts jsonb not null,
  created_at timestamptz not null default now()
);

-- Final comparisons (after retailer lookup)
create table comparisons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  user_id uuid references auth.users(id),
  prebuilt_url text not null,
  prebuilt_name text not null,
  prebuilt_price numeric not null,
  prebuilt_image_url text,
  retailer text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Individual parts for each comparison
create table parts (
  id uuid primary key default gen_random_uuid(),
  comparison_id uuid not null references comparisons(id) on delete cascade,
  type text not null check (type in ('cpu','gpu','motherboard','memory','storage','psu','case','cooling')),
  name text not null,
  lowest_price numeric not null,
  lowest_retailer text not null,
  lowest_affiliate_url text not null,
  black_price numeric,
  black_retailer text,
  black_affiliate_url text,
  white_price numeric,
  white_retailer text,
  white_affiliate_url text,
  last_price_updated timestamptz not null default now()
);

create index on parts(comparison_id);
create index on comparisons(slug);
create index on comparisons(prebuilt_url);
