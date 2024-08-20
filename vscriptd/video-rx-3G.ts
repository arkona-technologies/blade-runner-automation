import * as VAPI from "vapi";
import { enforce } from "vscript";
import { create_video_receiver } from "vutil/rtp_receiver";

const vm = await VAPI.VM.open({ towel: "" });
try {
  enforce(!!vm.r_t_p_receiver);
  await create_video_receiver(vm, {
    jpeg_xs_caliber: null,
    supports_2022_6: true,
    supports_2110_40: true,
    st2110_20_caliber: "ST2110_upto_3G",
    st2042_2_caliber: null,
  });
} finally {
  await vm.close();
}
