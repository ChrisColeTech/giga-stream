import { AppShell as ShellFrame } from "@giga/ui/shell/AppShell";
import { OverlayHost } from "@/components/overlays/OverlayHost";
import { SHELL_MIN_SIZE } from "@/constants/window";
import { AccountsPage } from "@/pages/AccountsPage";
import { ChannelsPage } from "@/pages/ChannelsPage";
import { JobsPage } from "@/pages/JobsPage";
import { PlaylistsPage } from "@/pages/PlaylistsPage";
import { ProvidersPage } from "@/pages/ProvidersPage";
import { SessionState } from "@/components/session/SessionState";
import { SignInPage } from "@/pages/SignInPage";
import { TitlesPage } from "@/pages/TitlesPage";
import { useAppStore } from "@/store/app-store";
import { useTab } from "@/store/selectors";
import { AdminEventsDrawer } from "./AdminEventsDrawer";
import { AdminStatusbar } from "./AdminStatusbar";
import { AdminTitlebar } from "./AdminTitlebar";

/** The admin shell, composed from the library's frame (`28` section 6.1): the titlebar, the six tab pages, the Events
 *  drawer, the statusbar and the overlay host. Every tab page stays mounted (the inactive ones hidden), so a tab switch
 *  keeps scroll and form state. Signed out, the gate owns the whole window (`34` section 4): the shell is inert and
 *  hidden from assistive tech, and holds no titlebar, drawer, statusbar, overlay or page, so nothing of one account is
 *  left for the next and nothing is reachable by Tab. The shell holds 900 x 640 and scrolls inside less. */
export function AppShell() {
  const tab = useTab();
  const signedIn = useAppStore((state) => state.signedIn);
  const serial = useAppStore((state) => state.serial);

  return (
    <>
      <div className="h-full w-full" inert={!signedIn} aria-hidden={signedIn ? undefined : true}>
        <ShellFrame
          minSize={SHELL_MIN_SIZE}
          titlebar={signedIn ? <AdminTitlebar /> : null}
          drawer={signedIn ? <AdminEventsDrawer /> : null}
          statusbar={signedIn ? <AdminStatusbar /> : null}
          overlay={signedIn ? <OverlayHost /> : null}
        >
          {signedIn && (
            <>
              <SessionState key={serial} />
              <ChannelsPage active={tab === "channels"} />
              <ProvidersPage active={tab === "providers"} />
              <TitlesPage active={tab === "titles"} />
              <PlaylistsPage active={tab === "playlists"} />
              <JobsPage active={tab === "jobs"} />
              <AccountsPage active={tab === "accounts"} />
            </>
          )}
        </ShellFrame>
      </div>
      {!signedIn && <SignInPage />}
    </>
  );
}
