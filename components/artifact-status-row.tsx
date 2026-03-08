"use client";

import { LoaderCircle } from "lucide-react";
import type { ArtifactLoopStatus } from "@/lib/artifact-orchestrator";

interface ArtifactStatusRowProps {
  status: ArtifactLoopStatus | null;
}

export function ArtifactStatusRow({ status }: ArtifactStatusRowProps) {
  if (!status) return null;

  return (
    <div className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        <span>{status.message}</span>
      </div>
    </div>
  );
}
