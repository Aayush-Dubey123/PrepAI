import { redirect } from "next/navigation";
import { AppSidebar } from "@/src/components/app-sidebar";
import { isTechnicalPracticeEnabled } from "@/src/lib/config";

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  if (!isTechnicalPracticeEnabled()) {
    redirect("/dashboard");
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#f8fafc] text-[#0f172a]">
      <AppSidebar />
      <div className="flex-1 min-w-0 h-screen overflow-y-auto flex flex-col">
        {children}
      </div>
    </div>
  );
}
