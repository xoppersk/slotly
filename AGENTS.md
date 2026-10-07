# AGENTS.md — Slotly

Booking/scheduling platform for service businesses. Phase 0 scaffold:
configs, design tokens, shadcn-style UI primitives, booking signature
components, app shells, CI + bundle gate.

## Commands

| Task           | Command                 |
|----------------|-------------------------|
| Dev server     | `npm run dev`           |
| Production build | `npm run build`       |
| Lint           | `npm run lint`          |
| Typecheck      | `npm run typecheck`     |
| Unit tests     | `npm test`              |
| Watch tests    | `npm run test:watch`    |
| Bundle gate    | `npm run bundle:gate`   |

CI runs lint → typecheck → test → build → bundle gate on every push/PR.

## Conventions

- **Stack naming:** always say PostgreSQL / Row Level Security / JWT
  explicitly — never bury them behind the "Supabase" brand. Employers read
  for Postgres, RLS, and JWT.
- **Design tokens** live in `src/app/globals.css` (`@theme inline` →
  CSS vars). Use Tailwind classes (`bg-primary`, `text-muted-foreground`,
  `bg-slot-selected`) — never hardcode the hex values from the design brief.
- **Times, dates, prices** always render with the `tnum` utility
  (`font-variant-numeric: tabular-nums`) so slot grids align.
- **Money** is stored as integer cents; format with
  `formatCents()` from `src/lib/format.ts`.
- **Env:** server secrets go through `getEnv()` in `src/lib/env.ts`
  (throws on `sk_live_` — Stripe test mode only). Never import `env.ts`
  from a client component.
- **Supabase:** browser client `src/lib/supabase/client.ts` (RLS applies);
  server client `src/lib/supabase/server.ts`; service-role client
  `src/lib/supabase/service-role.ts` (webhooks + cron only, bypasses RLS).
  `src/lib/supabase/types.ts` is a stub — the migration phase generates
  real types.
- **UI components:** `src/components/ui/` are typed shadcn-style wrappers
  on `radix-ui`. Booking signature components live in
  `src/components/booking/` (SlotPill, WeekStrip, TimezoneBanner,
  BookingSummaryCard, HoldCountdown) plus `StatusChip` and `EmptyState`
  in `src/components/ui/`.
- **Routes:** `(marketing)` = public pages incl. the root home;
  `(auth)` = centered-card auth shell; `(dashboard)` = sidebar owner app
  (Today, Bookings, Calendar, Services, Staff, Availability, Customers,
  Settings). Business booking pages (`/[slug]`) stay light-first.
- **Bundle budget:** 700 KB raw per route (CI: `BUNDLE_BUDGET_KB`), with
  the booking page targeting ≤180 KB gzipped. Tighten per route later.
- **No emojis** in UI. Dark mode is dashboard-only via `.dark` class.
