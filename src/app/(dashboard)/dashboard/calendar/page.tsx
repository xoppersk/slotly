import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { getCurrentBusiness } from "@/lib/business";
import { toBusinessDayKey, businessLocalRangeToUtc } from "@/lib/timezone";
import { addDaysYmd } from "@/lib/availability";
import { Button } from "@/components/ui/button";
import { formatDayLabel } from "@/lib/availability";
import { WeekCalendar } from "./_components/week-calendar";

interface CalendarPageProps {
  searchParams: Promise<{ week?: string }>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Monday of the week containing `dateKey` (business-local). Anchored at
 *  local noon so DST transitions and far-flung offsets never shift the day. */
function mondayOf(dateKey: string, timezone: string): string {
  const { startsAtUtc: noon } = businessLocalRangeToUtc(
    dateKey,
    "12:00",
    "12:01",
    timezone
  );
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(noon);
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return addDaysYmd(dateKey, -(((index < 0 ? 0 : index) + 6) % 7));
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const ctx = await getCurrentBusiness();
  if (!ctx) return null;
  const { business, membership } = ctx;
  const tz = business.timezone;
  const isOwner = membership.role === "owner";

  const params = await searchParams;
  const todayKey = toBusinessDayKey(new Date().toISOString(), tz);
  const anchor =
    params.week && DATE_RE.test(params.week) ? params.week : todayKey;
  const weekStart = mondayOf(anchor, tz);
  const weekEnd = addDaysYmd(weekStart, 6);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="tnum text-sm text-muted-foreground">
            {formatDayLabel(weekStart, tz)} – {formatDayLabel(weekEnd, tz)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild aria-label="Previous week">
            <Link href={`/dashboard/calendar?week=${addDaysYmd(weekStart, -7)}`}>
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/calendar">This week</Link>
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="Next week">
            <Link href={`/dashboard/calendar?week=${addDaysYmd(weekStart, 7)}`}>
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </header>

      <WeekCalendar
        businessId={business.id}
        weekStart={weekStart}
        timezone={tz}
        todayKey={todayKey}
        isOwner={isOwner}
      />

      {isOwner && (
        <p className="text-xs text-muted-foreground">
          Tip: click any empty day to block it. Click a booking to open its
          details.
        </p>
      )}
    </div>
  );
}
