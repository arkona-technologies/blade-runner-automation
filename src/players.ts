import * as VAPI from "vapi";
import { run } from "./run.js";
import { z } from "zod";
import { enforce } from "vscript";
import fs from "fs";
import path from "path";
import { parse_header } from "vutil/bid-utils.js";
import { sh } from "vutil";

export async function setup_video_players(vm: VAPI.VM.Any) {
  const dir = z.string().parse(process.env["DATA_DIR"]);
  enforce(!!vm.re_play && !!vm.genlock);
  const data = fs
    .readdirSync(dir)
    .filter((p) => p.endsWith(".bid"))
    .map((p) => path.join(dir, p));
  await vm.re_play?.video.players.delete_all();
  for (const bid of data) {
    const hdr = await parse_header(bid);
    enforce(!!vm.re_play && !!vm.genlock && !!vm.color_correction);
    const free = await vm.re_play.video.info.free.read();
    if (free.as_bytes <= (20 * hdr.VActive * hdr.HActive * hdr.Frames) / 8)
      continue;
    const n = `player-${path.basename(bid).split(".")[0]}`.substring(0, 31);
    const player = await vm.re_play.video.players.create_row({
      name: n,
    });
    await player.capabilities.command.write({
      capacity: { variant: "Frames", value: { frames: hdr.Frames } },
      input_caliber: {
        constraints: { variant: "Standard", value: { standard: hdr.Standard } },
        add_blanking: hdr.Blanking,
      },
    });
    if (vm instanceof VAPI.AT1130.Root)
      await player.output.time.t_src.command.write(
        vm.genlock?.instances.row(0).backend.output,
      );
    console.log("Created Player: ", await player.row_name());
    await sh(
      `curl --progress-bar -T ${bid} "http://${vm.raw.ip}/replay/video?action=write&handler=${player.index}&store=clip_single_file"`,
      { fail_on_error: true, forward_io: true },
    );
  }
}

run(setup_video_players);
