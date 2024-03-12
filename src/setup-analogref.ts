import * as VAPI from "vapi";
import { run } from "./run.js";
import { enforce } from "vscript";
import { z } from "zod";

export async function setup_ref(vm: VAPI.VM.Any) {
  enforce(vm instanceof VAPI.AT1130.Root && !!vm.i_o_module && !!vm.genlock);
  const io_board = await vm.system.io_board.info.type.read();
  enforce(
    !!io_board && (io_board == "IO_MSC_v2" || io_board == "IO_MSC_v2_GD32"),
    "MSC2 Board is required",
  );
  const VID_STD = z
    .enum(["HD1080i59_94", ...VAPI.IOModule.Enums.SyncOutputStandard])
    .default("HD1080i59_94")
    .parse(process.env["VID_STD"]);

  const genlock = vm.genlock?.instances.row(0);
  for (const ref of await vm.i_o_module.sync_output.rows()) {
    await ref.t_src.command.write(genlock?.backend.output);
    await ref.standard.write(VID_STD);
    console.log(`Sync-Output: ${ref.raw.kwl} => ${VID_STD}`);
  }
}
run(setup_ref);
