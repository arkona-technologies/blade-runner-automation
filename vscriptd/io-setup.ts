const NUM_SDI_OUT = parseInt(process.env["NUM_SDI_OUT"] ?? "8");
const URL_BLADE = new URL(process.env["URL_BLADE"] ?? "ws://127.0.0.1");
//  SCRIPT STARTS HERE

import * as VAPI from "vapi";
import { asyncIter, Duration, enforce } from "vscript";
import { setup_sdi_io } from "vutil/sdi_connections";

const vm = await VAPI.VM.open({ towel: "", ip: URL_BLADE.host });
try {
  enforce(!!vm.i_o_module && !!vm.genlock);
  const directions = new Array<VAPI.IOModule.ConfigDirection>(16).fill("Input");
  if (NUM_SDI_OUT >= 1) directions.fill("Output", 0, NUM_SDI_OUT);
  const [_ins, sdi_outs] = await setup_sdi_io(vm, { directions: directions });
  await asyncIter(
    sdi_outs.map((o) => o),
    async (o) => {
      await o.sdi.embedded_audio.command.write([
        "Embed",
        "Embed",
        "Embed",
        "Embed",
        "Embed",
        "Embed",
        "Embed",
        "Embed",
      ]);
    },
  );
  await vm.audio_shuffler?.global_cross_fade.write(new Duration(50, "ms"));
} finally {
  await vm.close();
}
