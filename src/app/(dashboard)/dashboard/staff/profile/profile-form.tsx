"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { updateOwnProfile } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_name: "Please enter your name.",
  field_too_long: "One of the fields is too long.",
  save_failed: "Could not save — please try again.",
  not_authorized: "You don't have access to this.",
  not_signed_in: "Please sign in and try again.",
};

export interface OwnProfileModel {
  name: string;
  title: string | null;
  bio: string;
  specialties: string[];
  phone: string | null;
  photo_url: string | null;
}

/** Staff self-service profile editor (photo is owner-managed). */
export function OwnProfileForm({ staff }: { staff: OwnProfileModel }) {
  const [name, setName] = React.useState(staff.name);
  const [title, setTitle] = React.useState(staff.title ?? "");
  const [bio, setBio] = React.useState(staff.bio);
  const [specialties, setSpecialties] = React.useState(
    staff.specialties.join(", ")
  );
  const [phone, setPhone] = React.useState(staff.phone ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dirty =
    name.trim() !== staff.name ||
    title.trim() !== (staff.title ?? "") ||
    bio.trim() !== staff.bio ||
    specialties.trim() !== staff.specialties.join(", ") ||
    phone.trim() !== (staff.phone ?? "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await updateOwnProfile({
        name,
        title,
        bio,
        specialties,
        phone,
      });
      if (!result.ok) {
        setError(ERROR_MESSAGES[result.error] ?? "Could not save.");
      } else {
        toast.success("Profile updated");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="op-name">Name</Label>
              <Input
                id="op-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="op-title">Title</Label>
              <Input
                id="op-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior stylist"
                maxLength={120}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="op-bio">Bio</Label>
            <Textarea
              id="op-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="A short intro customers see on the booking page"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="op-specialties">Specialties</Label>
              <Input
                id="op-specialties"
                value={specialties}
                onChange={(e) => setSpecialties(e.target.value)}
                placeholder="e.g. Color, Balayage"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="op-phone">Phone</Label>
              <Input
                id="op-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={40}
              />
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            variant="primary"
            type="submit"
            disabled={saving || !dirty || name.trim().length === 0}
            className="self-start"
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
