import * as VAPI from "vapi";
import { run } from "./run.js";
import { asyncFilter, Duration, poll_until, unreachable } from "vscript";
import { z } from "zod";
import { ensure_nmos_settings } from "vutil";
import { setup_ptp } from "vutil/ptp.js";
import { setup_sdi_io } from "vutil/sdi_connections.js";
import { isIPv4 } from "net";

// Base Setup for C100/AT300. These scripts will set up 'basic' PTP and Genlock,
// configure NMOS-Registries and ensure specified FPGA Applications are loaded

// Since some functions NEED interfaces with valid ipv4 addresses
// we need to potentially wait for e.g. dhcp interfaces to get an address
async function has_ipv4(port: VAPI.AT1130.NetworkInterfaces.Port) {
  const interfaces = await port.virtual_interfaces.rows();
  let found = false;
  for (const ifc of interfaces) {
    const ips = await ifc.ip_addresses.rows();
    for (const ip of ips) {
      const addr = await ip.ip_address.read();
      found = found || (!!addr && isIPv4(addr));
    }
  }
  return found;
}

export async function ensure_100g_addresses(vm: VAPI.AT1130.Root) {
  for (
    const p of await asyncFilter(
      await vm.network_interfaces.ports.rows(),
      async (p) => {
        return await p.supports_ptp.read();
      },
    )
  ) {
    await poll_until(
      async () => {
        return { satisfied: await has_ipv4(p) };
      },
      {
        pollInterval: new Duration(500, "ms"),
        timeout: new Duration(2, "min"),
      },
    );
  }
  for (const p of await vm.p_t_p_flows.ports.rows()) {
    await p.active.wait_until((active) => active, {
      timeout: new Duration(1, "min"),
    });
  }
}

async function base_setup_at1130(vm: VAPI.AT1130.Root) {
  console.log(process.env);
  const PTP_DOMAIN = z
    .preprocess(
      (x) => (x ? x : undefined),
      z.coerce.number().int().min(0).max(127).optional(),
    )
    .default(127)
    .parse(process.env["PTP_DOMAIN"]);
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
    .enum(["AVP_100GbE", ...VAPI.AT1130.System.Enums.FPGASelection])
    .optional()
    .default("AVP_100GbE")
    .parse(process.env["FPGA"]);
  const NMOS_REGISTRY = z
    .string()
    .url()
    .optional()
    .parse(process.env["NMOS_REGISTRY"]);

  const NUM_SDI_OUT = z
    .preprocess(
      (x) => (x ? x : undefined),
      z.coerce.number().int().min(0).max(16).optional(),
    )
    .default(8)
    .parse(process.env["NUM_SDI_OUT"]);

  const NMOS_URL = new URL(NMOS_REGISTRY ?? "http://127.0.0.1");

  console.log(`Setting FPGA to ${FPGA}`);
  await vm.system.select_fpga.command.write(FPGA);

  console.log(`Resetting...`);
  await vm.raw.reset();

  await ensure_nmos_settings(vm, {
    enable: NMOS_REGISTRY != undefined,
    registry: NMOS_URL,
  });

  // Poll all 100G interfaces for up to 2 minutes  until all have valid IPv4 Addresses in case of DHCP
  await ensure_100g_addresses(vm);

  await setup_ptp(vm, {
    mode: PTP_MODE,
    locking_policy: "Dynamic",
    delay_resp_mode: PTP_RESPONSE_TYPE,
    ptp_domain: PTP_DOMAIN,
    await_calibration: true,
  });

  console.log(`Setting up SDI IO`);
  const directions = new Array<VAPI.IOModule.ConfigDirection>(16).fill("Input");
  if (NUM_SDI_OUT >= 1) directions.fill("Output", 0, NUM_SDI_OUT);
  console.log(directions);
  const [_ins, sdi_outs] = await setup_sdi_io(vm, { directions: directions });
  for (const o of sdi_outs) {
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
  }
  await vm.audio_shuffler?.global_cross_fade.write(new Duration(50, "ms"));
}
async function base_setup_at1101(vm: VAPI.AT1101.Root) {
  const PTP_DOMAIN = z.coerce
    .number()
    .int()
    .gte(0)
    .lte(127)
    .default(127)
    .parse(process.env["PTP_DOMAIN"]);
  const PTP_RESPONSE_TYPE = z
    .enum(["Unicast", "Multicast"])
    .default("Multicast")
    .parse(process.env["PTP_RESPONSE_TYPE"]);
  const FPGA = z
    .enum(["AVP_40GbE", ...VAPI.AT1101.System.Enums.FPGASelection])
    .default("AVP_40GbE")
    .parse(process.env["FPGA"]);
  const NMOS_REGISTRY = z
    .string()
    .url()
    .optional()
    .parse(process.env["NMOS_REGISTRY"]);
  const NMOS_URL = new URL(NMOS_REGISTRY ?? "http://127.0.0.1");
  console.log(`Setting FPGA to ${FPGA}`);
  await vm.system.select_fpga.command.write(FPGA);

  console.log(`Resetting...`);
  await vm.raw.reset();

  await ensure_nmos_settings(vm, {
    enable: true,
    registry: NMOS_URL,
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
