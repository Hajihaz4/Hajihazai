import { auth } from "@/auth";
import { Sparkles } from "lucide-react";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm">
        <Sparkles className="size-4" />
        <span>MVP — Phase 1</span>
      </div>

      <h1 className="mt-8 text-5xl font-semibold">
        HajiHaz AI
      </h1>

      {session ? (
        <>
          <img
            src={session.user?.image ?? ""}
            alt="Profile"
            className="mt-6 h-20 w-20 rounded-full"
          />

          <h2 className="mt-4 text-xl font-medium">
            {session.user?.name}
          </h2>

          <p className="text-gray-500">
            {session.user?.email}
          </p>

          <div className="mt-8 rounded-lg bg-green-600 px-5 py-2 text-white">
            Logged in successfully
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-lg bg-red-600 px-5 py-2 text-white">
          Not logged in
        </div>
      )}
    </main>
  );
}
