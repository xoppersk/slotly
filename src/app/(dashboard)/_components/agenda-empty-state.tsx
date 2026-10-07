"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Empty agenda with the spec's two actions: block the day, or copy the
 * public booking link to share with customers.
 */
export function AgendaEmptyState({ businessSlug }: { businessSlug: string }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const url = `${window.location.origin}/${businessSlug}/book`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API unavailable (permissions) — still show the URL.
      window.prompt("Copy your booking link:", url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <EmptyState
        title="No bookings today — your calendar is wide open"
        description="New bookings appear here the moment they are made."
      />
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" asChild>
          <Link href="/dashboard/calendar">Block time</Link>
        </Button>
        <Button variant="outline" onClick={copyLink} className="gap-1.5">
          {copied ? (
            <Check className="size-4 text-success" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? "Copied" : "Share booking link"}
        </Button>
      </div>
    </div>
  );
}
