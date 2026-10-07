"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { getInviteDetails, acceptInvite } from "./actions";

/**
 * /auth/invite/[token] — staff invite accept (UI-DESIGN.md §2.11).
 *
 * Shows the business name + role, then "Accept & continue" creates the
 * membership via the accept_staff_invite Server Action. Signed-out users
 * are sent to sign-in first (with the invite URL preserved in ?next=);
 * signed-in users hitting the link go straight to accept.
 */
export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const router = useRouter();
  const [token, setToken] = React.useState<string | null>(null);
  const [state, setState] = React.useState<
    | { status: "loading" }
    | { status: "ready"; businessName: string; role: string }
    | { status: "expired" }
    | { status: "error"; code: string }
  >({ status: "loading" });
  const [accepting, setAccepting] = React.useState(false);
  const [acceptError, setAcceptError] = React.useState<string | null>(null);

  React.useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  React.useEffect(() => {
    if (!token) return;
    getInviteDetails(token).then((result) => {
      if (!result.ok) {
        setState(
          result.code === "not_found" || result.code === "invalid"
            ? { status: "expired" }
            : { status: "error", code: result.code }
        );
        return;
      }
      if (result.invite.expired) {
        setState({ status: "expired" });
        return;
      }
      setState({
        status: "ready",
        businessName: result.invite.businessName,
        role: result.invite.role,
      });
    });
  }, [token]);

  const accept = async () => {
    if (!token) return;
    setAccepting(true);
    setAcceptError(null);
    const result = await acceptInvite(token);
    if (result.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setAccepting(false);
    if (result.code === "not_signed_in") {
      router.push(`/auth/sign-in?next=${encodeURIComponent(`/auth/invite/${token}`)}`);
      return;
    }
    setAcceptError(
      result.code === "unavailable"
        ? "The invite system isn't available yet — please ask the owner to resend your invite."
        : "This invite is no longer valid — please ask the owner to resend it."
    );
  };

  return (
    <Card>
      <CardContent className="p-6">
        {state.status === "loading" && (
          <div aria-label="Loading invite">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/2" />
            <Skeleton className="mt-5 h-12 w-full rounded-[0.5rem]" />
          </div>
        )}

        {state.status === "ready" && (
          <>
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <UserPlus className="size-6" />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">
              You&apos;ve been invited
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Join <strong className="text-foreground">{state.businessName}</strong>{" "}
              on Slotly as{" "}
              <Badge variant="default" className="ml-1">
                {state.role}
              </Badge>
            </p>
            {acceptError && (
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>Couldn&apos;t accept</AlertTitle>
                <AlertDescription>{acceptError}</AlertDescription>
              </Alert>
            )}
            <Button
              variant="primary"
              size="lg"
              className="mt-5 w-full"
              disabled={accepting}
              onClick={accept}
            >
              {accepting ? "Joining…" : "Accept & continue"}
            </Button>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Not the right person?{" "}
              <Link href="/auth/sign-in" className="font-medium text-primary hover:underline">
                Sign in with a different account
              </Link>
            </p>
          </>
        )}

        {state.status === "expired" && (
          <>
            <h1 className="text-xl font-semibold tracking-tight">
              Invite expired
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This invite link is no longer valid — ask the business owner to
              send you a new one.
            </p>
            <Button variant="outline" asChild className="mt-5 w-full">
              <Link href="/auth/sign-in">Back to sign in</Link>
            </Button>
          </>
        )}

        {state.status === "error" && (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t load this invite</AlertTitle>
            <AlertDescription>
              Something went wrong ({state.code}). Please ask the business owner
              to resend your invite.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
