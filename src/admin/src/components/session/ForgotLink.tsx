import { InlineLink } from "@giga/ui/controls/InlineLink";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { FORGOT_LINK } from "@/constants/reset-copy";

export interface ForgotLinkProps {
  readonly onPress: () => void;
  /** Why the link cannot be used now (a sign-in is waiting); undefined when it can. */
  readonly reason: string | undefined;
}

/** `Forgot password?`: the ghost link under the Password row, right-aligned. It opens the reset view in the same wall.
 *  Waiting on a sign-in it is natively disabled, with the reason as its focusable tooltip. */
export function ForgotLink({ onPress, reason }: ForgotLinkProps) {
  const link = (
    <InlineLink onClick={onPress} disabled={reason !== undefined} className="disabled:cursor-not-allowed disabled:opacity-45">
      {FORGOT_LINK}
    </InlineLink>
  );
  return (
    <div className="flex justify-end">
      {reason === undefined ? (
        link
      ) : (
        <Tooltip text={reason} focusable label={`${FORGOT_LINK}. ${reason}`}>
          {link}
        </Tooltip>
      )}
    </div>
  );
}
