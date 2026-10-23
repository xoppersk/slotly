"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BusinessSwitcher({
  businesses,
  currentId,
  className,
}: {
  businesses: Array<{ id: string; name: string }>;
  currentId: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const current = businesses.find((b) => b.id === currentId);

  if (businesses.length <= 1) {
    return <span className={className}>{current?.name}</span>;
  }

  return (
    <div className={className} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox">
        {current?.name} ▾
      </button>
      {open ? (
        <ul role="listbox" style={{ position: "absolute", zIndex: 50 }}>
          {businesses.map((b) => (
            <li key={b.id} role="option" aria-selected={b.id === currentId}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  document.cookie = `slotly_business_id=${b.id}; path=/; max-age=31536000`;
                  router.refresh();
                }}
              >
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
