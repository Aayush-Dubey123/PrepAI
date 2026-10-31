import { redirect } from "next/navigation";
import { AppSidebar } from "@/src/components/app-sidebar";
import { isTechnicalPracticeEnabled } from "@/src/lib/config";

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  if (!isTechnicalPracticeEnabled()) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] md:h-screen w-full md:w-screen overflow-y-auto md:overflow-hidden flex flex-col md:flex-row bg-[#f8fafc] text-[#0f172a]">
      <AppSidebar />
      <div className="flex-1 min-w-0 min-h-[calc(100dvh-3.5rem)] md:h-screen overflow-y-auto flex flex-col">
        {children}
      </div>
    </div>
  );
}
