import { redirect } from "next/navigation";

import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage, getInitials } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

import { OwnProfileForm, type OwnProfileModel } from "./profile-form";

/** Staff self-service: own profile (design §2.20 staff portal). */
export default async function StaffProfilePage() {
  const ctx = await getCurrentBusiness();
  if (!ctx) redirect("/auth/sign-in");
  if (ctx.membership.role !== "staff") redirect("/dashboard/staff");
  const staffId = ctx.membership.staffId;
  if (!staffId) redirect("/dashboard");

  const supabase = await createClient();
  const { data: staffRow } = await supabase
    .from("staff")
    .select("id, name, title, bio, photo_url, specialties, phone")
    .eq("id", staffId)
    .eq("business_id", ctx.business.id)
    .maybeSingle();
  if (!staffRow) redirect("/dashboard");

  const staff: OwnProfileModel = {
    name: staffRow.name,
    title: staffRow.title,
    bio: staffRow.bio,
    specialties: staffRow.specialties ?? [],
    phone: staffRow.phone,
    photo_url: staffRow.photo_url,
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex items-center gap-4">
        <Avatar className="size-14">
          <AvatarImage src={staff.photo_url ?? undefined} alt={staff.name} />
          <AvatarFallback>{getInitials(staff.name)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground">
            What customers see on the booking page
            {user?.email ? ` · signed in as ${user.email}` : ""}
          </p>
        </div>
      </header>

      <OwnProfileForm staff={staff} />

      <Card>
        <CardContent className="p-5">
          <h2 className="text-base font-semibold tracking-tight">
            Profile photo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Photos are managed by the business owner — ask them to update it
            on the Staff page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
