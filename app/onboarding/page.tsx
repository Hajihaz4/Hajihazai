import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfile, isProfileComplete } from "@/lib/db/profile-queries";
import Onboarding from "@/components/onboarding";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const profile = await getProfile(session.user.id);
  // Already onboarded → straight to chat.
  if (isProfileComplete(profile)) redirect("/");

  return (
    <Onboarding
      google={{
        name: profile?.googleName ?? session.user.name ?? "",
        email: profile?.email ?? session.user.email ?? "",
        picture: profile?.profilePicture ?? session.user.image ?? "",
      }}
    />
  );
}
