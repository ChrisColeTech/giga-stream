import { readLicences } from "@/services/settings";
import { useAppStore } from "@/store/app-store";

/** Connects About's licence verb to its service refusal and notice. */
export function useLicenceAction(): () => void {
  const say = useAppStore((state) => state.say);
  return () => {
    const result = readLicences();
    if (!result.ok) say(result.message, "warn");
  };
}
