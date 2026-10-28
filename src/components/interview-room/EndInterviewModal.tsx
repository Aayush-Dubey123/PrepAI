"use client";

import React from "react";
import { PhoneOff, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/src/components/ui/Dialog";
import { Button } from "@/src/components/ui/Button";

export interface EndInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function EndInterviewModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}: EndInterviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent onClose={onClose} className="max-w-md">
        <DialogHeader>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-2">
            <PhoneOff className="w-5 h-5" />
          </div>
          <DialogTitle>End Interview Session?</DialogTitle>
          <DialogDescription>
            Are you sure you want to conclude the interview now? All of your answers up to this turn will be evaluated, and your comprehensive technical feedback report will be generated.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/5 text-xs text-neutral-400">
          <AlertCircle className="w-4 h-4 text-purple-400 shrink-0" />
          <span>You cannot re-open the interview session once finalized.</span>
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Continue Interview
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onConfirm}
            isLoading={isSubmitting}
            className="font-semibold"
          >
            Conclude & Generate Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
