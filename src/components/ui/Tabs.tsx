"use client";

import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { cn } from "@/src/lib/utils";

interface TabsContextType {
  value: string;
  onValueChange: (val: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("useTabs must be used within a Tabs component");
  }
  return context;
}

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className,
  ...props
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || "");

  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = (val: string) => {
    if (!isControlled) {
      setUncontrolledValue(val);
    }
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-xl bg-[#f1f5f9] p-1 text-[#64748b] border border-[#e2e8f0]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  value: string;
  disabled?: boolean;
}

export function TabsTrigger({
  value,
  className,
  children,
  disabled,
  ...props
}: TabsTriggerProps) {
  const { value: activeValue, onValueChange } = useTabs();
  const isSelected = activeValue === value;

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isSelected}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:pointer-events-none disabled:opacity-50",
        isSelected
          ? "bg-white text-[#0f172a] font-semibold shadow-xs"
          : "text-[#64748b] hover:text-[#0f172a] hover:bg-slate-200/50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: TabsContentProps) {
  const { value: activeValue } = useTabs();
  if (activeValue !== value) return null;

  return (
    <div
      role="tabpanel"
      className={cn("mt-4 focus-visible:outline-none animate-in fade-in duration-150", className)}
      {...props}
    >
      {children}
    </div>
  );
}
