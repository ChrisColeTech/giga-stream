import { Eye } from "lucide-react";
import { Group } from "@/components/ui/Group";
import { PillChoice } from "@/components/ui/PillChoice";
import { Row } from "@/components/ui/Row";
import { Swatches } from "@/components/ui/Swatches";
import { useAppStore } from "@/store/app-store";
import type { MotionPreference, ThemeMode } from "@/types/shell";

const THEMES = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
] as const satisfies ReadonlyArray<{ value: ThemeMode; label: string }>;

const MOTIONS = [
  { value: "system", label: "Follow system" },
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
] as const satisfies ReadonlyArray<{ value: MotionPreference; label: string }>;

/** Appearance: the Theme and Reduce motion pills and the Accent swatches. Each changes the shell at once. */
export function AppearanceSection() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const accent = useAppStore((state) => state.accent);
  const setAccent = useAppStore((state) => state.setAccent);
  const motion = useAppStore((state) => state.motion);
  const setMotion = useAppStore((state) => state.setMotion);

  return (
    <Group id="settings.appearance" title="Appearance" icon={Eye} tip="Theme, motion and the accent colour." last>
      <Row
        label="Theme"
        tip="Dark or light colours for the whole app, or System to follow the desktop's own light or dark mode, switching when it does."
      >
        <PillChoice label="Theme" options={THEMES} value={theme} onChange={setTheme} />
      </Row>
      <Row
        label="Reduce motion"
        tip="Off keeps panels and sections sliding; On skips every animation; Follow system honours the desktop's setting."
      >
        <PillChoice label="Reduce motion" options={MOTIONS} value={motion} onChange={setMotion} />
      </Row>
      <Row
        label="Accent"
        tip="The highlight colour for selection, focus, progress and the one main button on each screen."
      >
        <Swatches value={accent} onChange={setAccent} />
      </Row>
    </Group>
  );
}
