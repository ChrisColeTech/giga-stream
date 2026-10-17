import type { ShellMinSize } from "@giga/ui/shell/AppShell";

/** The smallest the shell goes (`26` section 4.2): in a smaller browser window it keeps this size and scrolls inside it.
 *  The Electron window cannot go below it. The design size is 1600 x 1000. */
export const SHELL_MIN_SIZE: ShellMinSize = { width: 900, height: 640 };
