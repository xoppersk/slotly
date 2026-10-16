import { Suspense } from "react";
import { DASHBOARD_NOW } from "@/lib/api";
import { CalendarClient } from "./CalendarClient";

type SP = Promise<Record<string, string | string[] | undefined>>;

async function CalendarInner({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : DASHBOARD_NOW.date;
  return <CalendarClient date={date} />;
}

export default function CalendarPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={null}>
      <CalendarInner searchParams={searchParams} />
    </Suspense>
  );
}
