import * as VAPI from "vapi";
import { enforce } from "vscript";
import { create_audio_receiver } from "vutil/rtp_receiver";

const vm = await VAPI.VM.open({ towel: "" });
try {
  enforce(!!vm.r_t_p_receiver);
  await create_audio_receiver(vm); // TODO: Parameterize Capabilites
} finally {
  await vm.close();
}
