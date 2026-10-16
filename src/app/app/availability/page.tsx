import { Suspense } from "react";
import { AvailabilityClient } from "./AvailabilityClient";

type SP = Promise<Record<string, string | string[] | undefined>>;

async function AvailabilityInner({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) ?? "micah";
  return <AvailabilityClient tab={tab} />;
}

export default function AvailabilityPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={null}>
      <AvailabilityInner searchParams={searchParams} />
    </Suspense>
  );
}
