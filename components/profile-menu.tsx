"use client";

import { useState } from "react";
import { LogOut, Shield, User } from "lucide-react";
import { signOutAction } from "@/app/actions";

/** Header avatar dropdown: My Profile · Admin Portal · Sign Out. */
export default function ProfileMenu({
  name,
  image,
}: {
  name?: string | null;
  image?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex size-9 items-center justify-center overflow-hidden rounded-full border hover:bg-accent"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="size-9 rounded-full" />
        ) : (
          <User className="size-4" />
        )}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-52 rounded-lg border bg-background p-1 shadow-lg"
          >
            {name ? (
              <div className="truncate px-3 py-2 text-xs text-muted-foreground">
                {name}
              </div>
            ) : null}
            <a
              href="/profile"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <User className="size-4" /> My Profile
            </a>
            <a
              href="/admin"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <Shield className="size-4" /> Admin Portal
            </a>
            <form action={signOutAction}>
              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent">
                <LogOut className="size-4" /> Sign Out
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
