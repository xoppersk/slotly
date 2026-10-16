import { Suspense } from "react";
import { CustomersClient } from "./CustomersClient";

type SP = Promise<Record<string, string | string[] | undefined>>;

async function CustomersInner({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
  return <CustomersClient q={one(sp.q)} filter={one(sp.filter) || "today"} />;
}

export default function CustomersPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={null}>
      <CustomersInner searchParams={searchParams} />
    </Suspense>
  );
}
