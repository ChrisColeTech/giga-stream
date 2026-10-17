import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Actions, Group } from "@/components/ui/Form";
import { useArmedAction } from "@/hooks/useArmedAction";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { ARM_TIMEOUT_MS, ARMED_LABEL, CONSEQUENCE } from "@/lib/collections-copy";

/* The inline two-step (`06` section 2, rule 9). The first press arms this same control and names the consequence; the
 * second press removes the collection. A timeout, focus leaving the control, or closing the window disarms it: Escape is
 * the window's, and closing it unmounts the armed state. */
export function CollectionRemove({
  collectionId,
  onRemoved,
}: {
  readonly collectionId: string;
  readonly onRemoved: () => void;
}) {
  const verbs = useCollectionVerbs();
  const { armed, arm, disarm } = useArmedAction(ARM_TIMEOUT_MS);

  const onPress = () => {
    if (!armed) {
      arm();
      return;
    }
    disarm();
    if (verbs.remove(collectionId)) onRemoved();
  };

  return (
    <Group id="collections.remove" title="Remove collection" icon={Trash2} last>
      <Actions
        left={
          armed && (
            <span role="status" className="text-sm text-muted">
              {CONSEQUENCE}
            </span>
          )
        }
      >
        <Button
          variant="danger"
          title="Removing a collection never touches the original files."
          onClick={onPress}
          onBlur={disarm}
        >
          {armed ? ARMED_LABEL : "Remove collection"}
        </Button>
      </Actions>
    </Group>
  );
}
