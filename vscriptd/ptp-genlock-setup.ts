const DOMAIN = 127;
const HOLDOVER = false;
const UNICAST_DELAY_RESP = true;
const URL_BLADE = new URL(process.env["URL_BLADE"] ?? "ws://127.0.0.1");


 //  SCRIPT STARTS HERE

import * as VAPI from "vapi";
import { asyncMap, asyncZip, enforce } from "vscript";
import { ensureAgent } from "vutil/ptp.js";

const vm = await VAPI.VM.open({ towel: "", ip: URL_BLADE.host });
try {
  enforce(!!vm.p_t_p_clock && !!vm.genlock);

  const agents = await asyncMap(
    await vm.p_t_p_flows.ports.rows(),
    async (port) => {
      const agent = await ensureAgent(vm, {
        mode: "SlaveOnly",
        domain: DOMAIN,
        port: port,
      });
      await agent.slave_settings.delay_req_routing.command.write(
        UNICAST_DELAY_RESP ? "Unicast" : "Multicast",
      );
      return agent;
    },
  );
  const combinator = await vm.time_flows.combinators.create_row();
  await combinator.quorum.command.write(1);
  let t_srcs = new Array(8).fill(null);
  await asyncZip(t_srcs, agents, async (_t, a, i) => {
    t_srcs[i] = a.output;
  });
  await combinator.t_src.command.write(t_srcs);
  await vm.p_t_p_clock.t_src.command.write(combinator.output);
  await vm.p_t_p_clock.mode.write("LockToInput");
  await vm.p_t_p_clock.parameters.locking_policy.write(
    HOLDOVER ? "Locking" : "Dynamic",
  );

  // SET GENLOCK to PTP too if on AT300
  if (vm instanceof VAPI.AT1130.Root) {
    for (const genlock of [...vm.genlock.instances])
      await genlock.t_src.command.write(vm.p_t_p_clock.output);
  }
} finally {
  await vm.close();
}
