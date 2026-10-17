import { Workspace } from "@giga/ui/form/Workspace";
import { SignInForm } from "@/components/session/SignInForm";
import { SIGN_IN_LABELS } from "@/constants/sign-in-copy";

/** The sign-in page: a page in the centre of the shell, not a modal. The titlebar and the statusbar stay; the tabs sleep
 *  with `Sign in first`. One column, 480px wide, centred; the page scrolls inside the shell if the window is short. */
export function SignInPage() {
  return (
    <Workspace labels={SIGN_IN_LABELS}>
      <div className="mx-auto w-full max-w-120">
        <SignInForm />
      </div>
    </Workspace>
  );
}
