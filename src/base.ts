import * as VAPI from "vapi";
import { numberString, run } from "./run.js";
import { Duration, unreachable } from "vscript";
import { z } from "zod";
import { ensure_nmos_settings } from "vutil";
import { setup_ptp } from "vutil/ptp.js";
import { setup_sdi_io } from "vutil/sdi_connections.js";

// Base Setup for C100/AT300. These scripts will set up 'basic' PTP and Genlock,
// configure NMOS-Registries and ensure specified FPGA Applications are loaded

async function base_setup_at1130(vm: VAPI.AT1130.Root) {
  const PTP_DOMAIN = z
    .number()
    .int()
    .gte(0)
    .lte(127)
    .optional()
    .default(127)
    .parse(numberString.parse(process.env["PTP_DOMAIN"]));
  const PTP_MODE = z
    .enum(["SlaveOnly", "FreerunMaster", "GPSMaster"])
    .default("SlaveOnly")
    .parse(process.env["PTP_MODE"]);
  const PTP_RESPONSE_TYPE = z
    .enum(["Unicast", "Multicast"])
    .optional()
    .default("Multicast")
    .parse(process.env["PTP_RESPONSE_TYPE"]);
  const FPGA = z
    .enum(["AVP_100GbE", "JPEGXS_TX_100GbE", "JPEGXS_RX_100GbE", "PCAP_100GbE"])
    .optional()
    .default("AVP_100GbE")
    .parse(process.env["FPGA"]);
  const NMOS_REGISTRY = z
    .string()
    .url()
    .optional()
    .parse(process.env["NMOS_REGISTRY"]);
  const NUM_SDI_OUT = z
    .number()
    .int()
    .gte(0)
    .lte(16)
    .optional()
    .default(8)
    .parse(numberString.parse(process.env["NUM_SDI_OUT"]));

  const NMOS_URL = new URL(NMOS_REGISTRY ?? "http://127.0.0.1");

  console.log(`Setting FPGA to ${FPGA}`);
  await vm.system.select_fpga.command.write(FPGA);

  console.log(`Resetting...`);
  await vm.raw.reset();

  await ensure_nmos_settings(vm, {
    enable: NMOS_REGISTRY != undefined,
    registry: [NMOS_URL, NMOS_URL, NMOS_URL, NMOS_URL],
  });

  await setup_ptp(vm, {
    mode: PTP_MODE,
    locking_policy: "Dynamic",
    delay_resp_mode: PTP_RESPONSE_TYPE,
    ptp_domain: PTP_DOMAIN,
  });

  console.log(`Setting up SDI IO`);
  const directions = new Array<VAPI.IOModule.ConfigDirection>(16).fill("Input");
  if (NUM_SDI_OUT >= 1) directions.fill("Output", 0, NUM_SDI_OUT - 1); // indexing is 0 based!
  console.log(directions);
  await setup_sdi_io(vm, { directions: directions });

  await vm.audio_shuffler?.global_cross_fade.write(new Duration(50, "ms"));
}
async function base_setup_at1101(vm: VAPI.AT1101.Root) {
  const PTP_DOMAIN = z
    .number()
    .int()
    .gte(0)
    .lte(127)
    .default(127)
    .parse(numberString.parse(process.env["PTP_DOMAIN"]));
  const PTP_RESPONSE_TYPE = z
    .enum(["Unicast", "Multicast"])
    .default("Multicast")
    .parse(process.env["PTP_RESPONSE_TYPE"]);
  const FPGA = z
    .enum([
      "AVP_40GbE",
      "UDX_40GbE",
      "JPEGXS_40GbE",
      "CC3D_40GbE",
      "PCAP_40GbE",
    ])
    .default("AVP_40GbE")
    .parse(process.env["FPGA"]);
  const NMOS_REGISTRIES = z
    .array(z.string().url().optional())
    .length(4)
    .parse(process.env["NMOS_REGISTRIES"]?.split(",").map((str) => str.trim()));
  console.log(`Setting FPGA to ${FPGA}`);
  await vm.system.select_fpga.command.write(FPGA);

  console.log(`Resetting...`);
  await vm.raw.reset();

  await ensure_nmos_settings(vm, {
    enable: NMOS_REGISTRIES.some((n) => n !== undefined),
    registry: NMOS_REGISTRIES.map((r) => new URL(r ?? "")),
  });

  await setup_ptp(vm, {
    mode: "SlaveOnly",
    locking_policy: "Dynamic",
    delay_resp_mode: PTP_RESPONSE_TYPE,
    ptp_domain: PTP_DOMAIN,
  });

  console.log(`Setting up SDI IO`);
  const directions = new Array<VAPI.IOModule.ConfigDirection>(16).fill("Input");
  console.log(directions);
  await setup_sdi_io(vm, { directions: directions });
  await vm.audio_shuffler?.global_cross_fade.write(new Duration(50, "ms"));
}

export async function base_setup(vm: VAPI.VM.Any) {
  if (vm instanceof VAPI.AT1130.Root) return await base_setup_at1130(vm);
  if (vm instanceof VAPI.AT1101.Root) return await base_setup_at1101(vm);
  unreachable("Encountered unknown Device Type");
}

run(base_setup);
