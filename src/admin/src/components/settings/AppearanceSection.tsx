import { Palette, RotateCcw } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { ACCENT_SWATCHES } from "@giga/ui/controls/accent-swatches";
import { Segmented } from "@giga/ui/controls/Segmented";
import { Swatches } from "@giga/ui/controls/Swatches";
import { Actions } from "@giga/ui/form/Actions";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Workspace } from "@giga/ui/form/Workspace";
import type { MotionPreference } from "@giga/ui/hooks/useReduceMotion";
import type { ThemeChoice } from "@giga/ui/store/chrome-types";
import {
  APPEARANCE_DEFAULTS,
  RESTORE_AT_DEFAULTS,
  RESTORE_TITLE,
  SETTINGS_LABELS,
} from "@/constants/settings-sections";
import { useAppStore } from "@/store/app-store";
import { ZoomStepper } from "./ZoomStepper";

const THEMES = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
] as const satisfies ReadonlyArray<{ value: ThemeChoice; label: string }>;

const MOTIONS = [
  { value: "system", label: "Follow system" },
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
] as const satisfies ReadonlyArray<{ value: MotionPreference; label: string }>;

/** Appearance: the Theme and Reduce motion choices, the Accent swatches, the UI zoom stepper and `Restore defaults`. Each
 *  changes the shell at once; nothing is saved until Wave 7. */
export function AppearanceSection() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const accent = useAppStore((state) => state.accent);
  const setAccent = useAppStore((state) => state.setAccent);
  const motion = useAppStore((state) => state.motion);
  const setMotion = useAppStore((state) => state.setMotion);
  const uiZoom = useAppStore((state) => state.uiZoom);
  const setZoom = useAppStore((state) => state.setZoom);
  const atDefaults =
    theme === APPEARANCE_DEFAULTS.theme &&
    motion === APPEARANCE_DEFAULTS.motion &&
    accent === APPEARANCE_DEFAULTS.accent &&
    uiZoom === APPEARANCE_DEFAULTS.uiZoom;

  return (
    <Workspace labels={SETTINGS_LABELS}>
      <Group id="settings.appearance" title="Appearance" icon={Palette} last>
        <Row
          label="Theme"
          tip="Dark or light colors for the whole app, or System to follow the desktop's own light or dark mode, switching when it does."
        >
          <Segmented aria-label="Theme" options={THEMES} value={theme} onChange={setTheme} />
        </Row>
        <Row
          label="Reduce motion"
          tip="Off keeps panels and sections sliding; On skips every animation; Follow system honors the desktop's setting."
        >
          <Segmented aria-label="Reduce motion" options={MOTIONS} value={motion} onChange={setMotion} />
        </Row>
        <Row label="Accent" tip="The highlight color for selection, focus, progress and the one main button on each screen.">
          <Swatches value={accent} onChange={setAccent} options={ACCENT_SWATCHES} label="Accent" />
        </Row>
        <Row label="UI zoom" tip="Scales the whole app, from 0.5 to 3. Ctrl+0 resets it to 1.">
          <ZoomStepper value={uiZoom} onChange={setZoom} />
        </Row>
        <Actions>
          <Button
            variant="ghost"
            title={RESTORE_TITLE}
            reason={atDefaults ? RESTORE_AT_DEFAULTS : undefined}
            onClick={() => {
              setTheme(APPEARANCE_DEFAULTS.theme);
              setMotion(APPEARANCE_DEFAULTS.motion);
              setAccent(APPEARANCE_DEFAULTS.accent);
              setZoom(APPEARANCE_DEFAULTS.uiZoom);
            }}
          >
            <RotateCcw aria-hidden /> Restore defaults
          </Button>
        </Actions>
      </Group>
    </Workspace>
  );
}
