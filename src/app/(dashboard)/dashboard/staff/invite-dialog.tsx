"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { inviteStaff } from "./actions";

import type { MemberRole } from "@/lib/supabase/types";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<MemberRole>("staff");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset the form each time the dialog opens (render-phase reset keyed on
  // the open transition — no effect needed).
  const sessionKey = open ? "open" : "closed";
  const [lastSession, setLastSession] = React.useState(sessionKey);
  if (sessionKey !== lastSession) {
    setLastSession(sessionKey);
    if (open) {
      setEmail("");
      setRole("staff");
      setError(null);
      setSending(false);
    }
  }

  const handleSend = async () => {
    setError(null);
    setSending(true);
    try {
      const result = await inviteStaff({ email, role });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Invite sent to ${email.trim()}`);
      onOpenChange(false);
    } catch {
      setError("Could not send the invite. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite staff</DialogTitle>
          <DialogDescription>
            They will get an email with a link to join your team (valid for 7
            days).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as MemberRole)}
            >
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">
                  Staff — their own agenda, profile, and time off
                </SelectItem>
                <SelectItem value="owner">
                  Owner — full access to everything
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSend} disabled={sending || !email.trim()}>
            {sending ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
