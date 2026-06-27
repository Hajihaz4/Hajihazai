import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { getProfile } from "@/lib/db/profile-queries";
import ProfileForm from "@/components/profile-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const p = await getProfile(session.user.id);
  if (!p) redirect("/onboarding");

  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-4 py-8">
      <a
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to chat
      </a>
      <h1 className="mb-6 text-2xl font-semibold">My Profile</h1>
      <ProfileForm
        initial={{
          username: p.username,
          email: p.email,
          name: p.googleName,
          createdAt: p.createdAt.toISOString(),
          hasPassword: !!p.passwordHash,
        }}
      />
    </main>
  );
}
