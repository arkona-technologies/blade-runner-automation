import * as VAPI from "vapi";

import { enforce } from "vscript";
import fs from "fs";
import path from "path";
import {
  encode_biw,
  load_wave,
  upload,
  wave_file_to_biw,
} from "vutil/biw-utils.js";
import { z } from "zod";
import { run } from "./run.js";

export async function setup_audio_players(vm: VAPI.VM.Any) {
  enforce(!!vm.re_play && !!vm.genlock);
  const dir = z.string().parse(process.env["DATA_DIR"]);
  const data = fs
    .readdirSync(dir)
    .filter((p) => p.endsWith(".wav"))
    .map((p) => path.join(dir, p));

  await vm.re_play?.audio.players.delete_all();
  for (const d of data) {
    const wav = load_wave(d);
    const biw = wave_file_to_biw(wav);
    const as_buffer = encode_biw(biw);
    const n = `player-${path.basename(d).split(".")[0]}`.substring(0, 31);
    const player = await vm.re_play.audio.players.create_row({ name: n });
    await player.capabilities.num_channels.command.write(
      16 * Math.ceil(biw.header.Channels / 16),
    );
    await player.capabilities.frequency.command.write("F48000");
    await player.capabilities.capacity.command.write({
      variant: "Samples",
      value: { samples: biw.header.SamplesPerChannel },
    });
    const url = `http://${vm.raw.ip}/replay/audio?action=write&handler=${player.index}&store=clip_single_file`;
    await upload(url, as_buffer);
    await player.output.control.stop.write("Click");
    await player.output.control.play_mode.command.write("Loop");
    await player.output.control.play.write("Click");
  }
}

run(setup_audio_players);
