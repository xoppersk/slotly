"use client";
/* Invite panel (owner): invite by email creates a staff_invites row
   (sha256 token hash, 7-day expiry — migration 00015 scheme). There is
   NO email provider in production, so the server action returns the
   raw invite link ONCE and it is shown here as a copyable
   /invite/<token> link — the link is the delivery; the owner sends it
   themselves. Pending invites list with revoke. */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { inviteStaffMember, revokeInvite } from "../actions";
import { initialsOf } from "../_lib/model";

export interface PendingInviteView {
  id: string;
  email: string;
  role: "owner" | "staff";
  sentLabel: string;
  expiresLabel: string;
}

export function InvitePanel({ invites }: { invites: PendingInviteView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "owner">("staff");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const send = () => {
    setError(null);
    setInviteUrl(null);
    setCopied(false);
    startTransition(async () => {
      const res = await inviteStaffMember({ email, role });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setInviteUrl(res.inviteUrl ?? null);
      setEmail("");
      router.refresh();
    });
  };

  const revoke = (id: string) =>
    startTransition(async () => {
      await revokeInvite(id);
      router.refresh();
    });

  return (
    <section className="sl-d-card" style={{ padding: 22, marginTop: 16 }} aria-labelledby="inv">
      <h2 id="inv" style={{ margin: "0 0 6px", font: "600 24px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Invite someone</h2>
      <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--ink-2)" }}>
        Invites are links, not emails — copy the link and send it yourself. It works for 7 days.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="sl-d-field" style={{ flex: "1 1 240px" }}>
          <label htmlFor="inv-email">Email</label>
          <input id="inv-email" className="sl-d-inp" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="sl-d-field">
          <label htmlFor="inv-role">Role</label>
          <select id="inv-role" className="sl-d-sel sl-d-sel--f" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </select>
        </div>
        <Button variant="primary" size="dashPrimary" disabled={pending || email.trim() === ""} onClick={send}>
          Create invite link
        </Button>
      </div>
      {error ? <p style={{ fontSize: 14, color: "var(--danger, #b3261e)", margin: "12px 0 0" }}>{error}</p> : null}
      {inviteUrl ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
          <input className="sl-d-inp" readOnly value={inviteUrl} aria-label="Invite link" style={{ flex: "1 1 320px" }} onFocus={(e) => e.target.select()} />
          <Button
            size="dashboard"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Shown once — the raw link is never stored.</span>
        </div>
      ) : null}

      {invites.length > 0 ? (
        <ul className="sl-d-list" style={{ marginTop: 18 }}>
          {invites.map((inv) => (
            <li key={inv.id} style={{ justifyContent: "flex-start", gap: 14 }}>
              <span className="sl-d-invite-avatar" aria-hidden="true">{initialsOf(inv.email).charAt(0)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{inv.email}</span>
                <span className="sl-d-sub">{inv.role === "owner" ? "Owner" : "Staff"} · invited {inv.sentLabel} · expires {inv.expiresLabel}</span>
              </span>
              <StatusPill status="Invite sent" />
              <button
                type="button"
                onClick={() => revoke(inv.id)}
                style={{ fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", color: "var(--ink)" }}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
