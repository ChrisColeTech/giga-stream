import { Button } from "@giga/ui/controls/Button";
import { RETRY_LABEL } from "@/constants/preview-copy";

export interface PreviewStatusProps {
  readonly line: string;
  /** `Retry` is offered (a failed or stopped channel, a missing one, a player error). */
  readonly retry: boolean;
  readonly onRetry: () => void;
}

/** The Preview's one mono status line under the stage and, beside it when there is something to try again, a ghost
 *  `Retry` that reads the channels once more. */
export function PreviewStatus({ line, retry, onRetry }: PreviewStatusProps) {
  return (
    <div className="flex h-8 flex-none items-center gap-2">
      <p role="status" className="m-0 min-w-0 flex-1 truncate font-mono text-xs text-muted" title={line}>
        {line}
      </p>
      {retry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          {RETRY_LABEL}
        </Button>
      )}
    </div>
  );
}
