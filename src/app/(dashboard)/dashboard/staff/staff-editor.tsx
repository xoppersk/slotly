"use client";

import * as React from "react";
import { toast } from "sonner";

import { defaultWeeklyGrid, type WeeklyDayInput } from "@/lib/management";
import { Avatar, AvatarFallback, AvatarImage, getInitials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input, Label, Switch, Textarea } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoursGrid } from "@/components/dashboard/hours-grid";

import {
  saveStaffHours,
  updateStaffNotifications,
  updateStaffProfile,
  uploadStaffPhoto,
} from "./actions";

export interface StaffEditorModel {
  id: string;
  name: string;
  title: string | null;
  bio: string;
  photo_url: string | null;
  specialties: string[];
  phone: string | null;
  is_active: boolean;
  notify_new_booking: boolean;
  notify_cancellation: boolean;
  /** Existing per-staff availability_rules (staff_id set). Empty = inherit. */
  hours: { weekday: number; open_time: string; close_time: string }[];
}

interface StaffEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffEditorModel | null;
}

function rulesToGrid(
  hours: StaffEditorModel["hours"],
): { inherit: boolean; grid: WeeklyDayInput[] } {
  if (hours.length === 0) return { inherit: true, grid: defaultWeeklyGrid() };
  const grid = defaultWeeklyGrid().map((d) => {
    const rule = hours.find((h) => h.weekday === d.weekday);
    if (!rule) return { ...d, isClosed: true };
    return {
      weekday: d.weekday,
      isClosed: false,
      openTime: rule.open_time.slice(0, 5),
      closeTime: rule.close_time.slice(0, 5),
    };
  });
  return { inherit: false, grid };
}

export function StaffEditor({ open, onOpenChange, staff }: StaffEditorProps) {
  const [name, setName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [specialties, setSpecialties] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [inherit, setInherit] = React.useState(true);
  const [grid, setGrid] = React.useState<WeeklyDayInput[]>(defaultWeeklyGrid());
  const [notifyNew, setNotifyNew] = React.useState(true);
  const [notifyCancel, setNotifyCancel] = React.useState(true);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Reset the form whenever the dialog opens or a different staff member is
  // edited (render-phase reset keyed on the open/entity session).
  const sessionKey = `${open ? "open" : "closed"}:${staff?.id ?? "none"}`;
  const [lastSession, setLastSession] = React.useState(sessionKey);
  if (sessionKey !== lastSession) {
    setLastSession(sessionKey);
    if (open && staff) {
      setError(null);
      setSaving(false);
      setUploading(false);
      setName(staff.name);
      setTitle(staff.title ?? "");
      setBio(staff.bio);
      setSpecialties(staff.specialties.join(", "));
      setPhone(staff.phone ?? "");
      setIsActive(staff.is_active);
      const { inherit: inh, grid: g } = rulesToGrid(staff.hours);
      setInherit(inh);
      setGrid(g);
      setNotifyNew(staff.notify_new_booking);
      setNotifyCancel(staff.notify_cancellation);
      setPhotoPreview(staff.photo_url);
    }
  }

  if (!staff) return null;

  const handlePhoto = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("photo", file);
      const result = await uploadStaffPhoto(staff.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Photo updated");
      // Bust the cache so the new photo shows immediately.
      setPhotoPreview(URL.createObjectURL(file));
    } catch {
      setError("Could not upload the photo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const [profileRes, hoursRes, notifRes] = await Promise.all([
        updateStaffProfile({
          staffId: staff.id,
          name,
          title,
          bio,
          specialties: specialties.split(","),
          phone,
          isActive,
        }),
        saveStaffHours({ staffId: staff.id, inherit, grid }),
        updateStaffNotifications({
          staffId: staff.id,
          notifyNewBooking: notifyNew,
          notifyCancellation: notifyCancel,
        }),
      ]);
      const failed = [profileRes, hoursRes, notifRes].find((r) => !r.ok);
      if (failed && !failed.ok) {
        setError(failed.error);
        return;
      }
      toast.success("Staff member updated");
      onOpenChange(false);
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {staff.name}</DialogTitle>
          <DialogDescription>
            Profile, working hours, and notification preferences.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="hours">Hours</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 pt-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                {photoPreview && (
                  <AvatarImage src={photoPreview} alt={`${name} photo`} />
                )}
                <AvatarFallback
                  initials={getInitials(name || staff.name)}
                  className="text-lg"
                />
              </Avatar>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Upload staff photo"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handlePhoto(f);
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? "Uploading…" : "Upload photo"}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">
                  Square photos work best. Max 5 MB.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="st-name">Name</Label>
                <Input
                  id="st-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-title">Title</Label>
                <Input
                  id="st-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Senior barber"
                  maxLength={80}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="st-bio">Bio</Label>
              <Textarea
                id="st-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="A line or two customers see on the booking page."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="st-specialties">Specialties</Label>
                <Input
                  id="st-specialties"
                  value={specialties}
                  onChange={(e) => setSpecialties(e.target.value)}
                  placeholder="Fades, Beard trims"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-phone">Phone</Label>
                <Input
                  id="st-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[0.5rem] border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="st-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive staff are hidden from customers.
                </p>
              </div>
              <Switch
                id="st-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </TabsContent>

          <TabsContent value="hours" className="space-y-4 pt-4">
            <div className="flex items-center justify-between rounded-[0.5rem] border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="st-inherit">Use business hours</Label>
                <p className="text-xs text-muted-foreground">
                  Turn off to set custom hours for this person.
                </p>
              </div>
              <Switch
                id="st-inherit"
                checked={inherit}
                onCheckedChange={setInherit}
              />
            </div>
            {!inherit && (
              <HoursGrid
                value={grid}
                onChange={setGrid}
                idPrefix={`staff-${staff.id}`}
              />
            )}
          </TabsContent>

          <TabsContent value="notifications" className="space-y-3 pt-4">
            <div className="flex items-center justify-between rounded-[0.5rem] border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="st-notif-new">New booking alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Email them when a customer books with them.
                </p>
              </div>
              <Switch
                id="st-notif-new"
                checked={notifyNew}
                onCheckedChange={setNotifyNew}
              />
            </div>
            <div className="flex items-center justify-between rounded-[0.5rem] border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="st-notif-cancel">Cancellation alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Email them when one of their bookings is cancelled.
                </p>
              </div>
              <Switch
                id="st-notif-cancel"
                checked={notifyCancel}
                onCheckedChange={setNotifyCancel}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
