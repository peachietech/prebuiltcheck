-- Price cache: stores the last-known retailer prices for a component search.
-- One row per part (identified by a normalised search_key), containing all
-- retailer results as a JSONB object.  The compare route checks this table
-- before hitting any retailer API; a stale or missing row triggers a live
-- fetch which then updates this table.
create table price_cache (
  search_key  text        primary key,
  results     jsonb       not null,   -- { retailer: { price, name, affiliateUrl } | null }
  fetched_at  timestamptz not null default now()
);

-- Fast expiry scan: lets a future cleanup job delete stale rows efficiently.
create index on price_cache (fetched_at);
