import { useState } from "react";
import { Clapperboard } from "lucide-react";

export function EpisodePicture({ src }: { readonly src: string | undefined }) {
  const [failed, setFailed] = useState(false);
  if (src === undefined || failed) return <Clapperboard className="size-4 text-dim" aria-hidden />;
  return (
    <img src={src} alt="" loading="lazy" onError={() => setFailed(true)}
      className="absolute inset-0 block size-full object-cover" />
  );
}
