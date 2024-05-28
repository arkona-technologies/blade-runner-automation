import * as VAPI from "vapi";
import { run } from "./run.js";
import { z } from "zod";
import { enforce } from "vscript";
import { create_audio_receiver } from "vutil/rtp_receiver.js";
import { stream_audio } from "vutil/rtp_transmitter.js";
import { random_string } from "vutil/random.js";

export async function audio_mixer(vm: VAPI.VM.Any) {
  enforce(
    !!vm.i_o_module &&
    !!vm.r_t_p_receiver &&
    !!vm.audio_shuffler &&
    vm instanceof VAPI.AT1130.Root,
    "Misssing required Software Modules",
  );
  const NUM_INPUTS = z.coerce
    .number()
    .gt(0)
    .int()
    .default(8)
    .parse(process.env["NUM_INPUTS"]);

  const MIXER_NAME = z
    .string()
    .min(1)
    .max(32)
    .optional()
    .default(`Mixer-${random_string(4, 8)}`)
    .parse(process.env["MIXER_NAME"]);
  const mixer = await vm.audio_engine?.create_stereo_mixer({
    name: MIXER_NAME,
    channel_strips: [
      {
        capabilities: {
          eq: "4-Band",
          hpf: false,
          compressor: true,
          format: "Mono",
          gate: true,
        },
        count: NUM_INPUTS,
      },
    ],
  });
  enforce(!!mixer);

  for (let i = 0; i < NUM_INPUTS; ++i) {
    const rx = await create_audio_receiver(vm);
    await rx.rename(`${await mixer.row_name()}-input-${i}`.substring(0, 31));
    const input = rx.media_specific.output.audio.channels.reference_to_index(0);
    await mixer.set_input(i, [input as any]);
    await mixer.faders.row(i).gain.write(0);
  }
  const tx = await stream_audio(mixer.output);
  await tx.rename(`${await mixer.row_name()}-output`);
}

run(audio_mixer);
