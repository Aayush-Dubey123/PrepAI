"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart3, Users, History, Settings, Brain } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
    {
      label: "Analytics",
      href: "/admin",
      icon: BarChart3,
      active: pathname === "/admin",
    },
    {
      label: "Candidates",
      href: "/dashboard",
      icon: Users,
      active: false,
    },
    {
      label: "Evaluation History",
      href: "/admin",
      icon: History,
      active: false,
    },
    {
      label: "Settings",
      href: "/dashboard",
      icon: Settings,
      active: false,
    },
  ];

  return (
    <aside className="w-56 shrink-0 h-screen border-r border-[#e2e8f0] bg-white flex flex-col justify-between p-4 select-none">
      <div className="space-y-6">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 px-2 group">
          <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5] transition-transform group-hover:scale-105 shadow-sm">
            <Brain className="w-4 h-4" />
          </div>
          <span className="font-bold text-base text-[#0f172a] tracking-tight">
            PrepAI
          </span>
        </Link>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  item.active
                    ? "bg-[#e0e7ff] text-[#3730a3] font-semibold shadow-xs"
                    : "text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]"
                }`}
              >
                <Icon className={`w-4 h-4 ${item.active ? "text-[#4f46e5]" : "text-[#64748b]"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Profile Footer */}
      <div className="border-t border-[#e2e8f0] pt-3 px-2 flex items-center gap-2.5">
        <UserButton />
        <div className="flex flex-col truncate">
          <span className="text-xs font-semibold text-[#0f172a] truncate">
            {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "User profile"}
          </span>
          <span className="text-[10px] text-[#94a3b8] truncate">
            {user?.primaryEmailAddress?.emailAddress || "Candidate Account"}
          </span>
        </div>
      </div>
    </aside>
  );
}
