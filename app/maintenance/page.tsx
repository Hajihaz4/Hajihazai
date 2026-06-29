import { Wrench } from "lucide-react";
import { getMaintenanceMessage } from "@/lib/system-settings";

export default async function MaintenancePage() {
  const message = await getMaintenanceMessage().catch(
    () => "HajiHaz AI is currently undergoing maintenance. We'll be back shortly.",
  );

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-5">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Wrench className="size-7 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Under Maintenance</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          If you believe this is an error, please try again in a few minutes.
        </p>
      </div>
    </main>
  );
}
