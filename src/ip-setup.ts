import * as VAPI from "vapi";
import { run } from "./run.js";
import { reconfigure_ip_addresses } from "vutil/network.js";
import { z } from "zod";
import fs from "fs";
import { Duration, enforce, pause } from "vscript";

export const zRoute = z.object({
  via: z.string().ip(),
  dst: z.string().ip().optional(),
  weight: z.number().optional(),
  dst_prefix: z.number().optional(),
});

export const IpConfig = z.object({
  dhcp: z.boolean().optional().default(false),
  ntpd: z.boolean().optional().default(false),
  reverse_path_filter: z
    .enum(["Loose", "Strict", "Disabled"])
    .optional()
    .default("Loose"),
  routes: z.array(zRoute),
  ip_addresses: z.array(
    z.tuple([z.string().ip(), z.number().gte(1).int().lte(32)]),
  ),
});
export type IpConfig = z.infer<typeof IpConfig>;

export const InterfaceConfig = z.object({
  base: IpConfig.optional(),
  vlans: z.record(z.number(), IpConfig).optional(),
});

export const NetConfig = z.object({
  rear: InterfaceConfig.default({}),
  p0: InterfaceConfig.default({}),
  p1: InterfaceConfig.default({}),
});

export async function configure_ip_setup(vm: VAPI.VM.Any) {
  enforce(vm instanceof VAPI.AT1130.Root, "This Script expects AT300");
  const config_path = z
    .string()
    .regex(/.+\..+/)
    .parse(process.env["NETWORK_CONFIG"]);
  const network_config = NetConfig.parse(
    JSON.parse(fs.readFileSync(config_path, "utf8")),
  );
  const p0 = await reconfigure_ip_addresses(
    vm.network_interfaces.ports.row(0),
    network_config.p0,
  );
  const p1 = await reconfigure_ip_addresses(
    vm.network_interfaces.ports.row(1),
    network_config.p1,
  );
  const rear = await reconfigure_ip_addresses(
    vm.network_interfaces.ports.row(2),
    network_config.rear,
  );
  if (rear || p0 || p1) {
    console.log(
      `[${vm.raw.identify()}]: rebooting in 5 seconds for new configuration: ${JSON.stringify(network_config, null, 3)}`,
    );
    console.log("...");
    await pause(new Duration(5, "s"));
    await vm.raw
      .reboot({
        timeout: new Duration(15, "s"),
      })
      .catch((_e) => process.exit(0));
  }
}
run(configure_ip_setup);
