import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Group } from "@/components/ui/Group";
import { Strip } from "@/components/ui/Strip";
import { ARMED_LABEL, CONSEQUENCE, REMOVE_COLLECTION_REASON } from "@/lib/collections-copy";
import { ARM_TIMEOUT_MS, nextTwoStep } from "@/lib/collections-two-step";
import type { TwoStepPhase } from "@/lib/collections-two-step";

/* The inline two-step (`06` section 2, rule 9). The first press arms this same control and names the consequence.
 * The armed control stays focusable (aria-disabled, not disabled), so focus leaving it and Escape both reach it: each
 * one disarms it, and Escape is stopped there so the window stays open. Its confirming press is disabled in phase 1
 * with its reason, so it can never remove anything. */
export function CollectionRemove() {
  const [phase, setPhase] = useState<TwoStepPhase>("idle");
  const armed = phase === "armed";

  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setPhase(nextTwoStep("timeout")), ARM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!armed || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    setPhase(nextTwoStep("escape"));
  };

  return (
    <Group
      id="collections.remove"
      title="Remove collection"
      icon={Trash2}
      tip="Removing a collection never touches the original files."
      last
    >
      <Strip>
        {armed && (
          <span role="status" className="text-xs text-muted">
            {CONSEQUENCE}
          </span>
        )}
        <Button
          variant="danger"
          aria-disabled={armed || undefined}
          title={armed ? REMOVE_COLLECTION_REASON : undefined}
          onClick={() => {
            if (!armed) setPhase(nextTwoStep("press"));
          }}
          onBlur={() => setPhase(nextTwoStep("blur"))}
          onKeyDown={onKeyDown}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:shadow-none"
        >
          {armed ? ARMED_LABEL : "Remove collection"}
        </Button>
      </Strip>
    </Group>
  );
}
