"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "./form";

/**
 * Slotly Command — simple filterable list for customer search and service
 * search. Phase 0 provides the accessible input + filtered-list primitive;
 * keyboard-driven cmdk-style navigation lands with the search phases.
 */
export interface CommandOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface CommandProps {
  options: CommandOption[];
  value?: string;
  onSelect?: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}

export function Command({
  options,
  value,
  onSelect,
  placeholder = "Search…",
  emptyText = "No results found.",
  className,
}: CommandProps) {
  const [query, setQuery] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)
    );
  }, [options, query]);

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-[0.5rem] bg-popover text-popover-foreground",
        className
      )}
    >
      <div className="flex items-center border-b border-border px-3">
        <Search className="mr-2 size-4 shrink-0 opacity-50" aria-hidden />
        <Input
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 min-h-[44px] border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          role="searchbox"
        />
      </div>
      <div
        ref={listRef}
        className="max-h-[300px] overflow-y-auto p-1"
        role="listbox"
      >
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        )}
        {filtered.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={option.disabled}
              onClick={() => onSelect?.(option.value)}
              className={cn(
                "relative flex w-full cursor-default select-none items-center gap-2 rounded-[0.375rem] px-2 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                selected && "bg-primary/10 font-medium text-primary",
                !selected && "hover:bg-muted",
                option.disabled && "pointer-events-none opacity-50"
              )}
            >
              <span className="flex-1 truncate text-left">{option.label}</span>
              {option.hint && (
                <span className="truncate text-xs text-muted-foreground">
                  {option.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
