"use client";
/* Business switcher — shown in the sidebar only when the signed-in
   user belongs to more than one business. The choice is stored in a
   cookie by the setActiveBusiness server action (membership-checked
   server-side) and read back by the server layout on every load. */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveBusiness } from "./actions";

export function BusinessSwitcher({
  businesses,
  activeId,
}: {
  businesses: { id: string; name: string }[];
  activeId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (businesses.length < 2) return null;
  return (
    <label style={{ display: "block", padding: "0 14px 10px" }}>
      <span className="sl-d-sr">Switch business</span>
      <select
        className="sl-d-sel"
        style={{ width: "100%" }}
        value={activeId}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          startTransition(async () => {
            await setActiveBusiness(id);
            router.refresh();
          });
        }}
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
