import * as VAPI from "vapi";
import { run } from "./run.js";
import { z } from "zod";
import { enforce } from "vscript";
import { stream_audio, stream_video } from "vutil/rtp_transmitter.js";
import { range } from "vutil";

export async function sdi_to_ip(vm: VAPI.VM.Any) {
  enforce(
    !!vm.i_o_module && !!vm.r_t_p_transmitter && !!vm.audio_shuffler,
    "Misssing required Software Modules",
  );
  const SDI_INDEX = z.coerce
    .number()
    .gte(0)
    .lte(15)
    .parse(process.env["SDI_INDEX"]);

  const NUM_AUDIO = z.coerce
    .number()
    .gt(0)
    .lte(4)
    .int()
    .default(4)
    .parse(process.env["NUM_AUDIO"]);

  const AUDIO_CHANNELS_PER_TX = 32 / NUM_AUDIO; // SDI Inputs will never have more than 32 Channels
  const sdi_in = vm.i_o_module.input.row(SDI_INDEX).sdi.output;

  const tx = await stream_video(sdi_in.video, { constrain: false });
  console.log(
    `${(await tx.v_src.status.read()).source?.raw.kwl.padEnd(42)} -> ${await tx.row_name()} `,
  );

  // Create Shufflers for Number of Audio Streams
  for (let idx of range(0, NUM_AUDIO)) {
    const shuffler = await vm.audio_shuffler?.instances.create_row();
    if (shuffler instanceof VAPI.AT1130.AudioShuffler.ShufflerAsNamedTableRow) {
      await shuffler.genlock.command.write(
        (vm as VAPI.AT1130.Root).genlock?.instances.row(0)!,
      );
    }
    const asrc_shuffler = await shuffler.a_src.status.read();
    // Set Shuffler AUDIO_CHANNELS_PER_TX Shuffler Inputs (offset the channel from sdi-in by the channels per tx * shuffler_index)
    for (let i = 0; i < AUDIO_CHANNELS_PER_TX; i++) {
      asrc_shuffler[i] = sdi_in.audio.channels.reference_to_index(
        idx * AUDIO_CHANNELS_PER_TX + i,
      );
    }
    await shuffler.a_src.command.write(asrc_shuffler as any);
    const tx = await stream_audio(shuffler.output, {
      format: {
        format: "L24",
        packet_time: "p0_125",
        num_channels: AUDIO_CHANNELS_PER_TX,
      },
    });
    await shuffler.rename(
      `Shuffler - Audio - TX - ${tx.index} `.substring(0, 31),
    );
    console.log(
      `${(await tx.a_src.status.read()).source?.raw.kwl?.padEnd(
        42,
      )} -> ${await tx.row_name()} `,
    );
  }
}

run(sdi_to_ip);
