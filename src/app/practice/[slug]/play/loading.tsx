import React from "react";
import LatticeLoader from "@/src/components/ui/loaders/LatticeLoader";

export default function PlayLoading() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 space-y-4">
      <LatticeLoader label="Preparing adaptive drill question..." status="working" />
    </div>
  );
}
