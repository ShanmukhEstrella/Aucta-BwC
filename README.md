# Aucta — live auction marketplace (production starter)

React (Vite) + Supabase. Real Google sign-in, Postgres with row-level security,
Storage for photos, Realtime for live bidding, and server-side jobs for
auto-start / auto-close and notifications.

---

## 1. Create a Supabase project
1. Go to https://supabase.com → New project. Note the project URL and the **anon public** key
   (Project Settings → API).

## 2. Run the database setup
1. Open **SQL Editor** in Supabase.
2. Paste the entire contents of `supabase/schema.sql` and run it.
   This creates all tables, security policies, the atomic bidding function, the
   settlement + notification logic, the storage bucket, realtime, and a
   once-a-minute cron job that auto-starts and auto-closes auctions.

> If `create extension pg_cron` errors, enable it first under
> Database → Extensions → search "pg_cron" → enable, then re-run the file.

## 3. Turn on Google sign-in
1. In Supabase: **Authentication → Providers → Google → enable**.
2. Create OAuth credentials in Google Cloud Console
   (APIs & Services → Credentials → OAuth client ID → Web application).
   - **Authorized redirect URI**: the callback Supabase shows you on the Google
     provider page, i.e. `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
   - Paste the Google **Client ID** and **Client secret** back into Supabase.
3. In Supabase **Authentication → URL Configuration**, add your app's URLs
   (e.g. `http://localhost:5173` for dev and your deployed domain) to
   **Site URL** / **Redirect URLs**.

## 4. Run the frontend
```bash
cp .env.example .env        # then fill in your two values
npm install
npm run dev                 # http://localhost:5173
```

## 5. Make yourself an admin
Sign in once with Google, then in the Supabase SQL editor:
```sql
update public.profiles set is_admin = true where email = 'you@gmail.com';
```
Reload the app — an **Admin** button appears in the header.

## 6. Deploy
```bash
npm run build               # outputs ./dist
```
Host `dist/` on Vercel, Netlify, Cloudflare Pages, etc. Add your production URL
to Supabase Auth redirect URLs and to the Google OAuth authorized origins.
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables
on your host.

---

## How it works
- **Auth**: Supabase Google OAuth. A `profiles` row is auto-created on first
  sign-in; `is_admin` gates the admin console.
- **Bidding** goes through the `place_bid` Postgres function, which row-locks the
  lot, enforces the minimum increment, updates the high bid, and writes an
  append-only `bids` ledger row — so concurrent bids can't corrupt the winner.
- **Auctions** auto-start at their scheduled time (if auto-start is on) and
  auto-close after 5 minutes via the `run_auction_tick` cron; the browser also
  closes a room the instant its timer hits zero (the server call is idempotent).
- **Settlement** marks each lot sold/unsold and writes notifications to the
  seller and the winner. Verifying a lot notifies the seller it's scheduled.
- **Realtime**: the client subscribes to `listings`, `auctions`, `participants`,
  and `notifications`, so bids, joins, and results appear live.
- **Photos** are resized in the browser and uploaded to the public
  `lot-images` Storage bucket.

## Play with Friends (mock IPL mega auction)
Run `supabase/playroom.sql` once in the SQL Editor (after `schema.sql`; safe to
re-run). Then the **Play with friends** button lets a signed-in user create a
private room, share a 5-char code, and run an automated IPL-style mega auction:
- Each team gets a ₹100 cr purse; **each franchise can be taken by only one player** per room.
- Players are grouped into **sets** (Marquee → Batters → All-rounders →
  Wicket-keepers → Fast Bowlers → Spinners) and auctioned in order.
- **Squad rules enforced server-side:** 18 min / 25 max players, max 8 overseas —
  bids are blocked at the cap.
- **Auto auctioneer:** each bid adds 3s to the clock (capped at 15s), then it
  calls “going once / going twice / sold” with on-screen effects.
- **Sound** (toggle in the room): a tick in the final 5 seconds, plus once/twice
  and a hammer on sold — generated in-browser, no audio files.
- **Player stats** (matches, runs, wickets, avg, SR) expand as a dropdown on the
  player currently on the block.
- Built-in real-player roster grouped by set, plus add-your-own custom players.
- Final screen shows every team's squad, overseas count, and total spend.

> Real player/franchise names are isolated in `src/playApi.js`
> (`BUILTIN_ROSTER`, `FRANCHISES`) — swap to fictional names before any public
> launch, since those marks are trademarked.

## Already ran the old schema? Apply the migration
If your database predates the profile/onboarding fields, run
`supabase/migration_v2.sql` once in the SQL Editor. It adds the profile columns
(`dob`, `role_title`, `location`, `onboarded`) and the display-name columns on
listings, and updates `place_bid` / `end_auction`. Fresh installs of
`schema.sql` already include all of this.

## New-user onboarding
On first Google sign-in a one-time form collects the user's **name (their
username), date of birth, current role, and current location**, saved to
`profiles`. The chosen name is shown across the app (lots, bids, notifications).

## Email notifications (optional but recommended)
Every in-app notification can also be emailed. Setup:
1. Get a [Resend](https://resend.com) API key (or adapt the function to another
   provider). Verify a sending domain for production.
2. Deploy the function:
   ```bash
   supabase functions deploy notify-email --no-verify-jwt
   supabase secrets set RESEND_API_KEY=re_xxx NOTIFY_FROM="Aucta <noreply@yourdomain.com>"
   ```
3. In Supabase → **Database → Webhooks**, create a webhook: table
   `public.notifications`, event **Insert**, type **Supabase Edge Function**,
   pointing at `notify-email`. (Code is in `supabase/functions/notify-email/`.)

Now seller "scheduled / sold / unsold" and winner "you won" notifications are
delivered by email as well as in-app.

## Live bid status colours
While an auction is live, each lot card reflects your standing: a **green** glow
if you're the highest bidder, **red** if you've bid but been outbid, and a
neutral border if you haven't bid yet. Works in light and dark themes.

## Notes / next hardening steps
- Tailwind is loaded via the Play CDN for zero-config. For production, switch to
  a compiled Tailwind (PostCSS) build.
- The 5-minute room length lives in `start_auction` / `run_auction_tick`
  (`interval '5 minutes'`). Change it there.
- For finer-grained auto-close than 1 minute, move the tick to an Edge Function
  scheduled more frequently, or rely on the client-side close (already wired).
