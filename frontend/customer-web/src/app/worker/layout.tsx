import { WorkerAuthProvider } from "@/lib/worker-auth-context";

export default function WorkerRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkerAuthProvider>
      <div className="min-h-screen bg-muted/30">{children}</div>
    </WorkerAuthProvider>
  );
}
