"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            {error.message || "An unexpected error interrupted this page."}
          </AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-center">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
