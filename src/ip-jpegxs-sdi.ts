import * as VAPI from "vapi";
import { run } from "./run.js";
import { z } from "zod";
import { enforce } from "vscript";
import { audio_ref, range, video_ref } from "vutil";
import {
  create_audio_receiver,
  create_video_receiver,
} from "vutil/rtp_receiver.js";

export async function ip_to_sdi(vm: VAPI.VM.Any) {
  enforce(
    !!vm.i_o_module && !!vm.r_t_p_receiver && !!vm.audio_shuffler,
    "Misssing required Software Modules"
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

  const ANC_DATA = z.coerce
    .boolean()
    .default(false)
    .parse(process.env["ANC_DATA"]);

  const UHD = process.env["UHD"] == "true";

  const AUDIO_CHANNELS_PER_TX = 32 / NUM_AUDIO;
  const sdi_out = vm.i_o_module.output.row(SDI_INDEX);

  const rx = await create_video_receiver(vm, {
    jpeg_xs_caliber: UHD ? "JPEG_XS_singlelink_uhd" : "JPEG_XS_upto_3G",
    supports_2110_40: ANC_DATA,
    supports_clean_switching: true,
  });

  const shuffler = await vm.audio_shuffler?.instances.create_row();
  if (shuffler instanceof VAPI.AT1130.AudioShuffler.ShufflerAsNamedTableRow) {
    await shuffler.genlock.command.write(
      (vm as VAPI.AT1130.Root).genlock?.instances.row(0)!
    );
  }
  const asrc_shuffler = await shuffler.a_src.status.read();

  for (let idx of range(0, NUM_AUDIO)) {
    const arx = await create_audio_receiver(vm);
    for (let i = 0; i < AUDIO_CHANNELS_PER_TX; i++) {
      asrc_shuffler[idx * AUDIO_CHANNELS_PER_TX + i] =
        arx.media_specific.output.audio.channels.reference_to_index(i);
    }
  }
  await shuffler.a_src.command.write(asrc_shuffler as any);
  await sdi_out.sdi.v_src.command.write(
    video_ref(rx.media_specific.output.video)
  );
  await shuffler.rename(`Shuffler-${sdi_out.raw.kwl}`.substring(0, 31));
  await sdi_out.a_src.command.write(audio_ref(shuffler.output));
}

run(ip_to_sdi);
