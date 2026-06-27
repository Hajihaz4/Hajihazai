import AdminPortal from "@/components/admin-portal";

// Admin access is fully DB-driven and isolated from user auth — anyone can open
// this page, but only valid admin credentials mint an admin session.
export default function AdminPage() {
  return <AdminPortal />;
}
