"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea, Checkbox } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { requestTimeOff } from "./actions";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_dates: "Pick valid start and end dates.",
  partial_day_single_day_only: "Partial-day requests must be on one day.",
  invalid_times: "Pick a valid start and end time.",
  invalid_range: "The end must be after the start.",
  reason_too_long: "The reason is too long (500 characters max).",
  request_failed: "Could not submit the request — please try again.",
  not_authorized: "You don't have access to this.",
  not_signed_in: "Please sign in and try again.",
};

/** Staff self-service time-off request form. */
export function RequestTimeOffForm({ minDate }: { minDate: string }) {
  const [startDate, setStartDate] = React.useState(minDate);
  const [endDate, setEndDate] = React.useState(minDate);
  const [allDay, setAllDay] = React.useState(true);
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("17:00");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const valid =
    DATE_RE.test(startDate) &&
    DATE_RE.test(endDate) &&
    startDate >= minDate &&
    (allDay || (TIME_RE.test(startTime) && TIME_RE.test(endTime)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await requestTimeOff({
        startDate,
        endDate,
        allDay,
        startTime: allDay ? undefined : startTime,
        endTime: allDay ? undefined : endTime,
        reason,
      });
      if (!result.ok) {
        setError(ERROR_MESSAGES[result.error] ?? "Could not submit the request.");
      } else {
        toast.success("Time-off request sent for approval");
        setReason("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <h2 className="text-base font-semibold tracking-tight">
            Request time off
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to-start-date">Start date</Label>
              <Input
                id="to-start-date"
                type="date"
                value={startDate}
                min={minDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to-end-date">End date</Label>
              <Input
                id="to-end-date"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={allDay}
              onCheckedChange={(v) => setAllDay(v === true)}
            />
            All day
          </label>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="to-start-time">From</Label>
                <Input
                  id="to-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="to-end-time">Until</Label>
                <Input
                  id="to-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="to-reason">Reason (optional)</Label>
            <Textarea
              id="to-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Family event"
              maxLength={500}
              rows={2}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            variant="primary"
            type="submit"
            disabled={submitting || !valid}
            className="self-start"
          >
            {submitting ? "Sending…" : "Send request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
