"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { defaultWeeklyGrid, formatTimeLabel, type WeeklyDayInput } from "@/lib/management";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Input, Label, Switch } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoursGrid, TIME_OPTIONS } from "@/components/dashboard/hours-grid";

import {
  addBlackout,
  addOverride,
  deleteBlackout,
  deleteOverride,
  saveBookingRules,
  saveBusinessHours,
  saveStaffAvailability,
  type BookingRulesInput,
} from "./actions";
import { SlotPreview } from "./slot-preview";

export interface OverrideRow {
  id: string;
  date: string;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  reason: string | null;
  staff_id: string | null;
  staff_name: string | null;
}

export interface BlackoutRow {
  id: string;
  date: string;
  reason: string | null;
}

export interface StaffHoursEntry {
  inherit: boolean;
  grid: WeeklyDayInput[];
}

interface AvailabilityClientProps {
  businessId: string;
  businessTimezone: string;
  businessGrid: WeeklyDayInput[];
  staffList: { id: string; name: string }[];
  staffHours: Record<string, StaffHoursEntry>;
  overrides: OverrideRow[];
  blackouts: BlackoutRow[];
  rules: BookingRulesInput;
  upcomingBookings: number;
  previewServiceId: string | null;
}

function formatDateLong(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const SLOT_STEP_OPTIONS = [5, 10, 15, 20, 30, 60];

export function AvailabilityClient(props: AvailabilityClientProps) {
  const {
    businessId,
    businessTimezone,
    staffList,
    overrides,
    blackouts,
    upcomingBookings,
    previewServiceId,
  } = props;

  // ---- Weekly hours (business + per-staff), dirty-tracked -----------------
  // `saved` is the last persisted state; edits revert to it on Discard.
  const [grid, setGrid] = React.useState<WeeklyDayInput[]>(props.businessGrid);
  const [staffHours, setStaffHours] = React.useState<Record<string, StaffHoursEntry>>(props.staffHours);
  const [savedHours, setSavedHours] = React.useState(() => ({
    grid: props.businessGrid,
    staffHours: props.staffHours,
  }));
  const [hoursTab, setHoursTab] = React.useState<string>("business");
  const [savingHours, setSavingHours] = React.useState(false);
  const hoursDirty =
    JSON.stringify({ grid, staffHours }) !== JSON.stringify(savedHours);

  // ---- Booking rules, dirty-tracked ---------------------------------------
  const [rules, setRules] = React.useState<BookingRulesInput>(props.rules);
  const [savedRules, setSavedRules] = React.useState<BookingRulesInput>(props.rules);
  const [savingRules, setSavingRules] = React.useState(false);
  const rulesDirty = JSON.stringify(rules) !== JSON.stringify(savedRules);

  // ---- Override / blackout forms (saved immediately) -----------------------
  const [ovDate, setOvDate] = React.useState<Date | null>(null);
  const [ovStaff, setOvStaff] = React.useState<string>("everyone");
  const [ovClosed, setOvClosed] = React.useState(false);
  const [ovOpen, setOvOpen] = React.useState("09:00");
  const [ovClose, setOvClose] = React.useState("17:00");
  const [ovReason, setOvReason] = React.useState("");
  const [ovBusy, setOvBusy] = React.useState(false);

  const [blDate, setBlDate] = React.useState<Date | null>(null);
  const [blReason, setBlReason] = React.useState("");
  const [blBusy, setBlBusy] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const selectedStaffId = hoursTab === "business" ? null : hoursTab;
  const selectedEntry: StaffHoursEntry = selectedStaffId
    ? (staffHours[selectedStaffId] ?? { inherit: true, grid: defaultWeeklyGrid() })
    : { inherit: false, grid };

  const setSelectedGrid = (next: WeeklyDayInput[]) => {
    if (!selectedStaffId) setGrid(next);
    else
      setStaffHours((prev) => ({
        ...prev,
        [selectedStaffId]: {
          inherit: prev[selectedStaffId]?.inherit ?? true,
          grid: next,
        },
      }));
  };

  const setSelectedInherit = (inherit: boolean) => {
    if (!selectedStaffId) return;
    setStaffHours((prev) => ({
      ...prev,
      [selectedStaffId]: {
        inherit,
        grid: prev[selectedStaffId]?.grid ?? defaultWeeklyGrid(),
      },
    }));
  };

  const handleSaveHours = async () => {
    setSavingHours(true);
    try {
      const result = selectedStaffId
        ? await saveStaffAvailability({
            staffId: selectedStaffId,
            inherit: selectedEntry.inherit,
            grid: selectedEntry.grid,
          })
        : await saveBusinessHours(grid);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSavedHours({ grid, staffHours });
      toast.success("Availability updated");
    } catch {
      toast.error("Could not save. Please try again.");
    } finally {
      setSavingHours(false);
    }
  };

  const discardHours = () => {
    setGrid(savedHours.grid);
    setStaffHours(savedHours.staffHours);
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      const result = await saveBookingRules(rules);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSavedRules(rules);
      toast.success("Availability updated");
    } catch {
      toast.error("Could not save. Please try again.");
    } finally {
      setSavingRules(false);
    }
  };

  const toYmd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const handleAddOverride = async () => {
    if (!ovDate) {
      toast.error("Pick a date for the override.");
      return;
    }
    setOvBusy(true);
    try {
      const result = await addOverride({
        date: toYmd(ovDate),
        isClosed: ovClosed,
        openTime: ovOpen,
        closeTime: ovClose,
        reason: ovReason,
        staffId: ovStaff === "everyone" ? null : ovStaff,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOvDate(null);
      setOvReason("");
      toast.success("Override saved");
    } catch {
      toast.error("Could not save the override.");
    } finally {
      setOvBusy(false);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    setDeletingId(id);
    try {
      const result = await deleteOverride(id);
      if (!result.ok) toast.error(result.error);
      else toast.success("Override removed");
    } catch {
      toast.error("Could not delete the override.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddBlackout = async () => {
    if (!blDate) {
      toast.error("Pick a date to block off.");
      return;
    }
    setBlBusy(true);
    try {
      const result = await addBlackout({ date: toYmd(blDate), reason: blReason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBlDate(null);
      setBlReason("");
      toast.success("Blackout date added");
    } catch {
      toast.error("Could not add the blackout date.");
    } finally {
      setBlBusy(false);
    }
  };

  const handleDeleteBlackout = async (id: string) => {
    setDeletingId(id);
    try {
      const result = await deleteBlackout(id);
      if (!result.ok) toast.error(result.error);
      else toast.success("Blackout date removed");
    } catch {
      toast.error("Could not delete the blackout date.");
    } finally {
      setDeletingId(null);
    }
  };

  const upcoming = overrides.filter((o) => o.date >= toYmd(new Date()));
  const upcomingBlackouts = blackouts.filter((b) => b.date >= toYmd(new Date()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
        <p className="text-sm text-muted-foreground">
          When customers can book — hours, exceptions, and booking rules.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <Tabs defaultValue="weekly">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="weekly">Weekly hours</TabsTrigger>
              <TabsTrigger value="overrides">Overrides</TabsTrigger>
              <TabsTrigger value="blackouts">Blackouts</TabsTrigger>
              <TabsTrigger value="rules">Booking rules</TabsTrigger>
            </TabsList>

            <TabsContent value="weekly" className="space-y-4 pt-4">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Whose hours">
                <Button
                  type="button"
                  variant={hoursTab === "business" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setHoursTab("business")}
                  role="tab"
                  aria-selected={hoursTab === "business"}
                >
                  Business
                </Button>
                {staffList.map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    variant={hoursTab === s.id ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setHoursTab(s.id)}
                    role="tab"
                    aria-selected={hoursTab === s.id}
                  >
                    {s.name}
                  </Button>
                ))}
              </div>

              {selectedStaffId && (
                <div className="flex items-center justify-between rounded-[0.5rem] border border-border px-3 py-2.5">
                  <div>
                    <Label htmlFor="av-inherit">Use business hours</Label>
                    <p className="text-xs text-muted-foreground">
                      Turn off to set custom hours for{" "}
                      {staffList.find((s) => s.id === selectedStaffId)?.name}.
                    </p>
                  </div>
                  <Switch
                    id="av-inherit"
                    checked={selectedEntry.inherit}
                    onCheckedChange={setSelectedInherit}
                  />
                </div>
              )}

              {(!selectedStaffId || !selectedEntry.inherit) && (
                <HoursGrid
                  value={selectedEntry.grid}
                  onChange={setSelectedGrid}
                  idPrefix={`av-${hoursTab}`}
                />
              )}
              {selectedStaffId && selectedEntry.inherit && (
                <p className="text-sm text-muted-foreground">
                  Following the business hours above. Turn off “Use business
                  hours” to customize.
                </p>
              )}

              {hoursDirty && (
                <div className="space-y-3">
                  {upcomingBookings > 0 && (
                    <Alert>
                      <AlertDescription>
                        <span className="tnum font-medium">{upcomingBookings}</span>{" "}
                        upcoming {upcomingBookings === 1 ? "booking is" : "bookings are"}{" "}
                        unaffected — changes apply to new bookings only.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-[0.75rem] border border-border bg-card p-3 shadow-md">
                    <p className="text-sm text-muted-foreground">
                      You have unsaved changes.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={discardHours}
                        disabled={savingHours}
                      >
                        Discard
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveHours}
                        disabled={savingHours}
                      >
                        {savingHours ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="overrides" className="space-y-4 pt-4">
              <Card className="space-y-4 p-4">
                <h3 className="text-sm font-semibold">Add an override</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5 block">Date</Label>
                    <Calendar
                      value={ovDate}
                      onSelect={setOvDate}
                      disabledDate={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                      disabledReason={() => "Overrides can't be set in the past"}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ov-staff">Applies to</Label>
                      <Select value={ovStaff} onValueChange={setOvStaff}>
                        <SelectTrigger id="ov-staff">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="everyone">Everyone</SelectItem>
                          {staffList.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} only
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ov-closed">Closed that day</Label>
                      <Switch
                        id="ov-closed"
                        checked={ovClosed}
                        onCheckedChange={setOvClosed}
                      />
                    </div>
                    {!ovClosed && (
                      <div className="flex items-center gap-2">
                        <Select value={ovOpen} onValueChange={setOvOpen} aria-label="Override opens at">
                          <SelectTrigger className="tnum flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map((t) => (
                              <SelectItem key={t} value={t} className="tnum">
                                {formatTimeLabel(t)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground" aria-hidden>–</span>
                        <Select value={ovClose} onValueChange={setOvClose} aria-label="Override closes at">
                          <SelectTrigger className="tnum flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map((t) => (
                              <SelectItem key={t} value={t} className="tnum">
                                {formatTimeLabel(t)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="ov-reason">Reason (optional)</Label>
                      <Input
                        id="ov-reason"
                        value={ovReason}
                        onChange={(e) => setOvReason(e.target.value)}
                        placeholder="Holiday hours, event…"
                        maxLength={120}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddOverride}
                      disabled={ovBusy}
                      className="gap-1.5"
                    >
                      <Plus className="size-4" aria-hidden />
                      {ovBusy ? "Saving…" : "Add override"}
                    </Button>
                  </div>
                </div>
              </Card>

              <div className="space-y-2">
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No upcoming overrides — one-off changes to your hours go here.
                  </p>
                ) : (
                  upcoming.map((o) => (
                    <Card key={o.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="tnum text-sm font-medium">
                            {formatDateLong(o.date)}
                          </p>
                          <p className="tnum text-xs text-muted-foreground">
                            {o.is_closed
                              ? "Closed"
                              : `${formatTimeLabel(o.open_time?.slice(0, 5) ?? "")} – ${formatTimeLabel(o.close_time?.slice(0, 5) ?? "")}`}
                            {" · "}
                            {o.staff_name ?? "Everyone"}
                            {o.reason ? ` · ${o.reason}` : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deletingId === o.id}
                          onClick={() => handleDeleteOverride(o.id)}
                          aria-label={`Delete override on ${o.date}`}
                        >
                          <Trash2 className="size-4 text-destructive" aria-hidden />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="blackouts" className="space-y-4 pt-4">
              <Card className="space-y-4 p-4">
                <h3 className="text-sm font-semibold">Add a blackout date</h3>
                <p className="text-sm text-muted-foreground">
                  Full days nobody can book — holidays, vacations, closures.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5 block">Date</Label>
                    <Calendar
                      value={blDate}
                      onSelect={setBlDate}
                      disabledDate={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                      disabledReason={() => "Blackouts can't be set in the past"}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="bl-reason">Name (optional)</Label>
                      <Input
                        id="bl-reason"
                        value={blReason}
                        onChange={(e) => setBlReason(e.target.value)}
                        placeholder="Thanksgiving"
                        maxLength={120}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddBlackout}
                      disabled={blBusy}
                      className="gap-1.5"
                    >
                      <Plus className="size-4" aria-hidden />
                      {blBusy ? "Saving…" : "Add blackout date"}
                    </Button>
                  </div>
                </div>
              </Card>

              <div className="space-y-2">
                {upcomingBlackouts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No blackout dates coming up.
                  </p>
                ) : (
                  upcomingBlackouts.map((b) => (
                    <Card key={b.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="tnum text-sm font-medium">
                            {formatDateLong(b.date)}
                          </p>
                          {b.reason && (
                            <p className="text-xs text-muted-foreground">{b.reason}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deletingId === b.id}
                          onClick={() => handleDeleteBlackout(b.id)}
                          aria-label={`Delete blackout on ${b.date}`}
                        >
                          <Trash2 className="size-4 text-destructive" aria-hidden />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="rules" className="space-y-4 pt-4">
              <Card className="space-y-4 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-lead">Minimum lead time (minutes)</Label>
                    <Input
                      id="rule-lead"
                      type="number"
                      min={0}
                      step={5}
                      value={rules.minLeadTimeMinutes}
                      onChange={(e) =>
                        setRules({ ...rules, minLeadTimeMinutes: Number(e.target.value) })
                      }
                      className="tnum"
                    />
                    <p className="text-xs text-muted-foreground">
                      How far ahead customers must book.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-advance">Max advance booking (days)</Label>
                    <Input
                      id="rule-advance"
                      type="number"
                      min={1}
                      max={365}
                      value={rules.maxAdvanceDays}
                      onChange={(e) =>
                        setRules({ ...rules, maxAdvanceDays: Number(e.target.value) })
                      }
                      className="tnum"
                    />
                    <p className="text-xs text-muted-foreground">
                      How far into the future the calendar opens.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-step">Slot step</Label>
                    <Select
                      value={String(rules.slotStepMinutes)}
                      onValueChange={(v) =>
                        setRules({ ...rules, slotStepMinutes: Number(v) })
                      }
                    >
                      <SelectTrigger id="rule-step" className="tnum">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SLOT_STEP_OPTIONS.map((s) => (
                          <SelectItem key={s} value={String(s)} className="tnum">
                            Every {s} minutes
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Granularity of bookable start times.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-cancel">Free cancellation (hours)</Label>
                    <Input
                      id="rule-cancel"
                      type="number"
                      min={0}
                      value={rules.freeCancelHours}
                      onChange={(e) =>
                        setRules({ ...rules, freeCancelHours: Number(e.target.value) })
                      }
                      className="tnum"
                    />
                    <p className="text-xs text-muted-foreground">
                      Customers can cancel free of charge until this many hours
                      before the appointment.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-buf-before">Default buffer before (min)</Label>
                    <Input
                      id="rule-buf-before"
                      type="number"
                      min={0}
                      value={rules.bufferBeforeDefaultMinutes}
                      onChange={(e) =>
                        setRules({ ...rules, bufferBeforeDefaultMinutes: Number(e.target.value) })
                      }
                      className="tnum"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-buf-after">Default buffer after (min)</Label>
                    <Input
                      id="rule-buf-after"
                      type="number"
                      min={0}
                      value={rules.bufferAfterDefaultMinutes}
                      onChange={(e) =>
                        setRules({ ...rules, bufferAfterDefaultMinutes: Number(e.target.value) })
                      }
                      className="tnum"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Buffer defaults pre-fill new services; each service can
                  override them.
                </p>
              </Card>

              {rulesDirty && (
                <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-[0.75rem] border border-border bg-card p-3 shadow-md">
                  <p className="text-sm text-muted-foreground">
                    You have unsaved changes.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRules(savedRules)}
                      disabled={savingRules}
                    >
                      Discard
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveRules}
                      disabled={savingRules}
                    >
                      {savingRules ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <SlotPreview
            businessId={businessId}
            businessTimezone={businessTimezone}
            serviceId={previewServiceId}
            staffId={selectedStaffId}
          />
        </aside>
      </div>
    </div>
  );
}
