import { Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { Select } from "@giga/ui/controls/Select";
import { cn } from "@giga/ui/lib/cn";
import { Actions } from "@giga/ui/form/Actions";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { APPLY_TIP, FAULT_MAX_MS, FAULTS } from "@/constants/channel-copy";
import { CHANNEL_TIPS } from "@/constants/channel-tips";
import { wholeNumber } from "@/lib/field-checks";
import type { FaultRequest } from "@/services/channel-flows";
import type { FaultName } from "@/types/admin-channel";

export interface FaultGroupProps {
  /** `Apply`'s reason (`Apply a fault only while the channel is live.`), or undefined. */
  readonly applyReason: string | undefined;
  /** `Clear`'s reason (`No fault is applied.`), or undefined. */
  readonly clearReason: string | undefined;
  /** Answers the refusal sentence, or null once the fault is set. */
  readonly onApply: (request: FaultRequest) => Promise<string | null>;
  readonly onClear: () => void;
}

const isFault = (value: string): value is FaultName => FAULTS.some((fault) => fault === value);

/** A whole number of milliseconds, 1 to 24 hours, or empty (the backend's default). */
const millis = (label: string, value: string): string | null => wholeNumber(label, value, 1, FAULT_MAX_MS);

/** A live channel's `Fault` (`36` section 6), a test tool: one of the seven faults, a duration and a delay in
 *  milliseconds, `Apply` (only while the channel is live) and `Clear` (only while one is set). These are their own verbs,
 *  not part of Save. A refusal (`fault.invalid`, a bad number) goes under its row. */
export function FaultGroup({ applyReason, clearReason, onApply, onClear }: FaultGroupProps) {
  const [fault, setFault] = useState<FaultName>("stall");
  const [duration, setDuration] = useState("");
  const [delay, setDelay] = useState("");
  const [errors, setErrors] = useState<Readonly<Record<string, string | null>>>({});

  const apply = async (): Promise<void> => {
    const checks = { duration: millis("Duration", duration), delay: millis("Delay", delay) };
    setErrors(checks);
    if (checks.duration !== null || checks.delay !== null) return;
    const request: FaultRequest = {
      fault,
      ...(duration.trim() !== "" && { durationMs: Number(duration) }),
      ...(delay.trim() !== "" && { delayMs: Number(delay) }),
    };
    const refused = await onApply(request);
    setErrors({ fault: refused });
  };

  const number = (label: string, value: string, set: (value: string) => void, error: string | null | undefined) => (
    <Input
      value={value}
      className={cn(FIELD_CONTROL, "font-mono")}
      aria-label={label}
      aria-invalid={error !== null && error !== undefined}
      inputMode="numeric"
      autoComplete="off"
      onChange={(event) => set(event.target.value)}
    />
  );

  return (
    <Group id="lv-fault" icon={Zap} title="Fault">
      <Row label="Fault" tip={CHANNEL_TIPS.fault} error={errors["fault"]}>
        <Select
          value={fault}
          className={FIELD_CONTROL}
          aria-label="Fault"
          onChange={(event) => {
            if (isFault(event.target.value)) setFault(event.target.value);
          }}
        >
          {FAULTS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Row>
      <Row label="Duration" tip={CHANNEL_TIPS.duration} error={errors["duration"]}>
        {number("Duration", duration, setDuration, errors["duration"])}
      </Row>
      <Row label="Delay" tip={CHANNEL_TIPS.delay} error={errors["delay"]}>
        {number("Delay", delay, setDelay, errors["delay"])}
      </Row>
      <Actions>
        <Button variant="ghost" reason={clearReason} onClick={onClear}>
          Clear
        </Button>
        <Button variant="ghost" reason={applyReason} title={APPLY_TIP} onClick={() => void apply()}>
          Apply
        </Button>
      </Actions>
    </Group>
  );
}
