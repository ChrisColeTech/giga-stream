/** A pane with nothing in it yet, named so the layout can be checked before the panes are built from the references. */
export function PanePlaceholder({ name }: { name: string }) {
  return (
    <div className="flex h-full min-h-0 flex-1 items-start p-3">
      <span className="font-mono text-xs text-dim">{name}</span>
    </div>
  );
}
