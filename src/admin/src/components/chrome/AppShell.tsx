import { AppShell as ShellFrame } from "@giga/ui/shell/AppShell";
import { OverlayHost } from "@/components/overlays/OverlayHost";
import { SHELL_MIN_SIZE } from "@/constants/window";
import { AccountsPage } from "@/pages/AccountsPage";
import { ChannelsPage } from "@/pages/ChannelsPage";
import { JobsPage } from "@/pages/JobsPage";
import { PlaylistsPage } from "@/pages/PlaylistsPage";
import { ProvidersPage } from "@/pages/ProvidersPage";
import { SignInPage } from "@/pages/SignInPage";
import { TitlesPage } from "@/pages/TitlesPage";
import { useAppStore } from "@/store/app-store";
import { useTab } from "@/store/selectors";
import { AdminEventsDrawer } from "./AdminEventsDrawer";
import { AdminStatusbar } from "./AdminStatusbar";
import { AdminTitlebar } from "./AdminTitlebar";

/** The admin shell, composed from the library's frame (`28` section 6.1): the titlebar, the six tab pages or the sign-in
 *  page, the Events drawer, the statusbar and the overlay host. The shell renders once; every tab page stays mounted
 *  (the inactive ones hidden), so a tab switch keeps scroll and form state. Signed out, the pages are not mounted at
 *  all: nothing of one account is left on screen for the next. The shell holds 900 x 640 and scrolls inside less. */
export function AppShell() {
  const tab = useTab();
  const signedIn = useAppStore((state) => state.signedIn);

  return (
    <ShellFrame
      minSize={SHELL_MIN_SIZE}
      titlebar={<AdminTitlebar />}
      drawer={<AdminEventsDrawer />}
      statusbar={<AdminStatusbar />}
      overlay={<OverlayHost />}
    >
      {signedIn ? (
        <>
          <ChannelsPage active={tab === "channels"} />
          <ProvidersPage active={tab === "providers"} />
          <TitlesPage active={tab === "titles"} />
          <PlaylistsPage active={tab === "playlists"} />
          <JobsPage active={tab === "jobs"} />
          <AccountsPage active={tab === "accounts"} />
        </>
      ) : (
        <SignInPage />
      )}
    </ShellFrame>
  );
}
