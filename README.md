# Price Tracker

A Chrome extension that tracks product prices across e-commerce sites and notifies you when they drop.

![Price Tracker popup](public/icons/icon128.png)

## Features

- **Track any product** — visit a product page and click "Track price" to start monitoring
- **Automatic price checks** — scans all tracked products every 30 minutes in the background
- **Manual scan** — trigger an immediate check from the popup with "Scan prices"
- **Drop notifications** — get a Chrome notification with the old and new price when a drop is detected
- **Price history** — view the full price history for any tracked product
- **Multi-currency** — handles USD, CAD, EUR, GBP, KYD, and more
- **Sale price aware** — prefers sale/current prices over crossed-out regular prices

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com) and run the following SQL in the **SQL Editor**:

```sql
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  url         text not null,
  title       text,
  image_url   text,
  created_at  timestamptz not null default now(),
  unique (user_id, url)
);

create table public.price_history (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  price        numeric(12, 2) not null,
  currency     text not null default 'USD',
  detected_at  timestamptz not null default now()
);

create view public.products_with_latest_price as
select
  p.id, p.user_id, p.url, p.title, p.image_url, p.created_at,
  ph.price        as latest_price,
  ph.currency     as latest_currency,
  ph.detected_at  as price_detected_at
from public.products p
left join lateral (
  select price, currency, detected_at
  from public.price_history
  where product_id = p.id
  order by detected_at desc
  limit 1
) ph on true;

alter table public.products      enable row level security;
alter table public.price_history enable row level security;

create policy "users own their products"
  on public.products for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users own their price history"
  on public.price_history for all
  using (exists (
    select 1 from public.products where id = product_id and user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.products where id = product_id and user_id = auth.uid()
  ));
```

### 2. Environment

```bash
cp .env.example .env
```

Fill in your Supabase project URL and anon key (found in **Settings → API**):

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Install & build

```bash
pnpm install
pnpm build
```

### 4. Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder

## Development

```bash
pnpm build   # production build
```

To debug the background service worker: `chrome://extensions` → Price Tracker → **Service Worker** → Console.

## How it works

**Price extraction** uses three strategies in order:
1. **JSON-LD** — parses `application/ld+json` Product/Offer structured data
2. **Meta tags** — checks `og:price:amount`, `product:price:amount`, `itemprop="price"`
3. **CSS selectors** — falls back to known price element patterns (sale prices are checked before regular prices; struck-through prices are skipped)

**Background checks** open a silent tab for each unvisited product URL, extract the price, record it in Supabase, and fire a notification if the price dropped. If the product page is already open in a tab, that tab is used directly.

## Stack

- [Preact](https://preactjs.com) — popup UI
- [Supabase](https://supabase.com) — auth + database
- [Vite](https://vitejs.dev) + [@crxjs/vite-plugin](https://crxjs.dev) — build tooling
- TypeScript, Chrome MV3
