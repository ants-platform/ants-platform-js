/**
 * A real desktop/OS tool. On macOS it posts a Notification Center banner via
 * `osascript`; elsewhere it falls back to stdout. Either way the OS action is
 * traced as a `tool` observation.
 */
import { execFile } from "node:child_process";
import { platform } from "node:process";
import { promisify } from "node:util";
import { startActiveObservation } from "ants-platform";

const run = promisify(execFile);

/** Post a desktop notification, traced as a tool call. */
export function notifyDesktop(title: string, message: string): Promise<void> {
  return startActiveObservation(
    "tool:desktop-notify",
    async (tool) => {
      tool.update({
        input: { title, message },
        metadata: { os: platform, channel: "notification-center" },
      });

      if (platform === "darwin") {
        const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`;
        await run("osascript", ["-e", script]);
        tool.update({ output: { delivered: true, via: "osascript" } });
      } else {
        // eslint-disable-next-line no-console
        console.log(`[desktop-notify] ${title}: ${message}`);
        tool.update({ output: { delivered: true, via: "stdout-fallback" } });
      }
    },
    { asType: "tool" },
  );
}
