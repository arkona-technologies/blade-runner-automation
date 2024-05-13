import * as VAPI from "vapi";
import z from "zod";
import fs, { watch } from "fs";
import { asyncMap, Duration, enforce, pause } from "vscript";
import { run } from "./run.js";

// Monitors a given set of receivers and switches SDP to backup if egress != target a specified amount of time

const ReceiverBackup = z.object({
  index: z.number(),
  backup_sdp: z.string(),
  timeout_seconds: z.number().optional().default(2),
});
const ConfigRoot = z.object({
  url: z.string().url(),
  receivers: z.array(ReceiverBackup),
});

const should_log = false;

export async function monitor_rx(vm: VAPI.VM.Any) {
  const path = z
    .string()
    .regex(/^(.+)\/([^\/]+)$/)
    .parse(process.env["BACKUP_CONFIG"]);
  const config = ConfigRoot.parse(JSON.parse(fs.readFileSync(path, "utf8")));
  const dirty: boolean[] = new Array(128);
  dirty.fill(false);

  const watchers = await asyncMap(config.receivers, async (rx) => {
    const vrx = vm.r_t_p_receiver?.video_receivers.row(rx.index);
    const session = await vrx?.generic.hosting_session.status.read();
    enforce(!!session && !!vrx);

    return vrx.generic.tracks.watch(async (tr) => {
      if (!tr.current_target) return;
      if (tr.egress.toString() === tr.current_target?.toString()) {
        dirty[vrx.index] = false;
      }
      if (
        tr.egress.toString() !== tr.current_target?.toString() &&
        !dirty[vrx.index]
      ) {
        console.log(
          `[${vm.raw.identify()}]: Found mismatch between target and egress on ${await vrx
            .row_name()}`,
        );
        dirty[vrx.index] = true;
        setTimeout(async () => {
          if (!dirty[vrx.index]) return;
          try {
            console.log(
              `[${vm.raw.identify()}]: ${await vrx
                .row_name()} remains dirty; switching to backup sdp`,
            );
            await session.set_sdp(
              tr.current_target == "A" ? "B" : "A",
              rx.backup_sdp,
            );
          } catch (e) {
            console.log(e);
          } finally {
            dirty[vrx.index] = false;
          }
        }, new Duration(rx.timeout_seconds, "s").ms());
        return;
      }
    });
  });
  while (true) {
    await pause(new Duration(1, "s"));
    if (should_log) console.log(`Monitoring ${watchers.length} receivers...`);
  }
}
run(monitor_rx);
