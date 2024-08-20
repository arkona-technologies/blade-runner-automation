const DOMAIN = 127;
const SYNC_INTERVAL = -3; // every 2^-3 seconds (i.e 0.125s)
const ANNOUNCE_INTERVAL = -2; // every 2^-2 seconds (i.e. 0.25s)
const HOLDOVER = true;

const VID_STD: VAPI.IOModule.SyncOutputStandard = "HD1080i50";

const URL_BLADE = new URL(process.env["URL_BLADE"] ?? "ws://127.0.0.1");

//  SCRIPT STARTS HERE

import * as VAPI from "vapi";
import { enforce } from "vscript";
import { ensureAgent } from "vutil/ptp.js";

const vm = await VAPI.VM.open({ towel: "", ip: URL_BLADE.host });
try {
  enforce(!!vm.p_t_p_clock && !!vm.genlock && !!vm.i_o_module);
  const gps = vm.master_clock.gps_receivers.row(0);
  await vm.p_t_p_clock.mode.write("LockToInput");
  await vm.p_t_p_clock.t_src.command.write(gps.output);
  await vm.p_t_p_clock.parameters.locking_policy.write(
    HOLDOVER ? "Locking" : "Dynamic",
  );
  const t_src = vm.p_t_p_clock.output;
  for (const port of await vm.p_t_p_flows.ports.rows()) {
    const agent = await ensureAgent(vm, {
      mode: "MasterOnly",
      domain: DOMAIN,
      time_source: t_src,
      port: port,
    });
    await agent.master_settings.log2_sync_interval.command.write(SYNC_INTERVAL);
    await agent.master_settings.log2_announce_interval.command.write(
      ANNOUNCE_INTERVAL,
    );

    // SET GENLOCK to PTP too if on AT300
    if (vm instanceof VAPI.AT1130.Root) {
      for (const genlock of [...vm.genlock.instances])
        await genlock.t_src.command.write(t_src);

      const genlock = vm.genlock?.instances.row(0);
      for (const ref of await vm.i_o_module.sync_output.rows()) {
        await ref.t_src.command.write(genlock?.backend.output);
        await ref.standard.write(VID_STD);
      }
    }
  }
} finally {
  await vm.close();
}
