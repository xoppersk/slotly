import type { ReactNode } from "react";
import "@/styles/booking.css";
import { BookingProvider } from "./_flow/BookingFlow";

export default function BookingLayout({ children }: { children: ReactNode }) {
  return <BookingProvider>{children}</BookingProvider>;
}
