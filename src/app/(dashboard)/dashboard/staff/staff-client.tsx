"use client";

import * as React from "react";
import { MailPlus, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage, getInitials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/badge";

import { resendInvite, revokeInvite, reviewTimeOff } from "./actions";
import { InviteDialog } from "./invite-dialog";
import { StaffEditor, type StaffEditorModel } from "./staff-editor";

export interface StaffCardModel extends StaffEditorModel {
  todayLoad: number;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
}

export interface PendingTimeOff {
  id: string;
  staff_id: string;
  staff_name: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

interface StaffClientProps {
  staff: StaffCardModel[];
  invites: PendingInvite[];
  pendingTimeOff: PendingTimeOff[];
}

export function StaffClient({ staff, invites, pendingTimeOff }: StaffClientProps) {
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StaffEditorModel | null>(null);
  const [busyInvite, setBusyInvite] = React.useState<string | null>(null);
  const [busyTimeOff, setBusyTimeOff] = React.useState<string | null>(null);

  const handleResend = async (id: string) => {
    setBusyInvite(id);
    try {
      const result = await resendInvite(id);
      if (!result.ok) toast.error(result.error);
      else toast.success("Invite resent");
    } catch {
      toast.error("Could not resend the invite.");
    } finally {
      setBusyInvite(null);
    }
  };

  const handleTimeOff = async (id: string, decision: "approved" | "declined") => {
    setBusyTimeOff(id);
    try {
      const result = await reviewTimeOff(id, decision);
      if (!result.ok) toast.error(result.error);
      else toast.success(decision === "approved" ? "Time off approved" : "Request declined");
    } catch {
      toast.error("Could not update the request.");
    } finally {
      setBusyTimeOff(null);
    }
  };

  const handleRevoke = async (invite: PendingInvite) => {
    if (!window.confirm(`Revoke the invite to ${invite.email}?`)) return;
    setBusyInvite(invite.id);
    try {
      const result = await revokeInvite(invite.id);
      if (!result.ok) toast.error(result.error);
      else toast.success("Invite revoked");
    } catch {
      toast.error("Could not revoke the invite.");
    } finally {
      setBusyInvite(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
          <p className="text-sm text-muted-foreground">
            The people customers can book with.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-1.5">
          <MailPlus className="size-4" aria-hidden />
          Invite staff
        </Button>
      </div>

      {staff.length === 0 ? (
        <EmptyState
          title="Just you so far"
          description="Invite your team so customers can pick who they book with."
          actionLabel="Invite your first team member"
          onAction={() => setInviteOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="size-12">
                  {s.photo_url && (
                    <AvatarImage src={s.photo_url} alt={`${s.name} photo`} />
                  )}
                  <AvatarFallback initials={getInitials(s.name)} />
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{s.name}</p>
                    {!s.is_active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  {s.title && (
                    <p className="truncate text-sm text-muted-foreground">
                      {s.title}
                    </p>
                  )}
                  <p className="tnum mt-1 text-sm text-muted-foreground">
                    {s.todayLoad} {s.todayLoad === 1 ? "booking" : "bookings"} today
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditing(s)}
                  aria-label={`Edit ${s.name}`}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {pendingTimeOff.length > 0 && (
        <section aria-label="Time-off requests" className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Time-off requests
          </h2>
          <div className="space-y-2">
            {pendingTimeOff.map((req) => (
              <Card key={req.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {req.staff_name}
                    </p>
                    <p className="tnum truncate text-xs text-muted-foreground">
                      {new Date(req.starts_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      →{" "}
                      {new Date(req.ends_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      {req.reason ? ` · ${req.reason}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyTimeOff === req.id}
                    onClick={() => handleTimeOff(req.id, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={busyTimeOff === req.id}
                    onClick={() => handleTimeOff(req.id, "declined")}
                  >
                    Decline
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {invites.length > 0 && (
        <section aria-label="Pending invites" className="space-y-3">          <h2 className="text-lg font-semibold tracking-tight">
            Pending invites
          </h2>
          <div className="space-y-2">
            {invites.map((invite) => (
              <Card key={invite.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{invite.email}</p>
                    <p className="tnum text-xs text-muted-foreground">
                      {invite.role} · expires{" "}
                      {new Date(invite.expires_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyInvite === invite.id}
                    onClick={() => handleResend(invite.id)}
                  >
                    Resend
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={busyInvite === invite.id}
                    onClick={() => handleRevoke(invite)}
                  >
                    Revoke
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <StaffEditor
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        staff={editing}
      />
    </div>
  );
}
