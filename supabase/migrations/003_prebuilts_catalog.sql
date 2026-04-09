-- Known prebuilts catalog.
-- Populated automatically whenever a user submits a URL for analysis.
-- Used to suggest similar-spec prebuilts at a lower price on the comparison page.
create table known_prebuilts (
  id           uuid        primary key default gen_random_uuid(),
  url          text        not null unique,
  name         text        not null,
  retailer     text        not null,
  price        numeric     not null,

  -- Extracted component identifiers (used for similarity matching)
  gpu_model    text,        -- e.g. "RTX 5060 12GB"
  gpu_tier     int,         -- numeric rank — higher is faster (from lib/prebuilts.ts)
  cpu_model    text,        -- e.g. "Ryzen 7 9800X3D"
  cpu_tier     int,
  ram_gb       int,
  storage_gb   int,

  image_url    text,
  last_seen    timestamptz  not null default now()
);

create index on known_prebuilts (gpu_tier, price);
create index on known_prebuilts (cpu_tier, price);
create index on known_prebuilts (last_seen);
