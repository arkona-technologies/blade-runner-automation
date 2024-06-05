import * as VAPI from "vapi";
import { run } from "./run.js";
import z from "zod";
import fs from "fs";
import { enforce, enforce_nonnull } from "vscript";

const zEmptyStringToNull = z.preprocess((arg) => {
  if (typeof arg === "string" && arg === "") {
    return null;
  } else {
    return arg;
  }
}, z.string().ip().nullish());

export const CSVAddrSchema = z.object({
  type: z.enum(["Audio", "Video", "Meta"]),
  index: z.coerce.number().gte(0).int(),
  primary_dst_address: z
    .string()
    .transform((s) => (s === "" ? null : s))
    .nullable(),
  secondary_dst_address: z
    .string()
    .transform((s) => (s === "" ? null : s))
    .nullable(),
  primary_dst_port: z.coerce.number(),
  secondary_dst_port: z.coerce.number(),
  primary_payload_type: z.coerce.number(),
  secondary_payload_type: z.coerce.number(),
});
export type CSVAddrSchema_t = z.infer<typeof CSVAddrSchema>;

function parse_csv<T extends z.ZodRawShape>(
  csv: string,
  schema: z.ZodObject<T>,
  seperator?: string,
): z.infer<typeof schema>[] {
  seperator ??= "\n";
  const rows = csv
    .split(seperator)
    .filter((line) => line.length > 0)
    .slice(1)
    .map((line) => line.split(",").flatMap((entry) => entry.trim()))
    .map((r) => r.map((c) => (c == "" ? null : c)));
  const parsed = rows.map((row) => {
    let obj: any = {};
    Object.keys(schema.shape).forEach((k, idx) => {
      obj[k] = row[idx];
    });
    console.log(obj);
    return schema.parse(obj);
  });
  console.log(parsed);
  return parsed;
}

async function set_transmitter_addresses(
  vm: VAPI.VM.Any,
  config: CSVAddrSchema_t,
) {
  let ip_config;
  const tx = config.type == "Audio"
    ? vm.r_t_p_transmitter?.audio_transmitters.row(config.index)
    : vm.r_t_p_transmitter?.video_transmitters.row(config.index);
  enforce(
    enforce_nonnull(
      config.type == "Audio"
        ? await vm.r_t_p_transmitter?.audio_transmitters.is_allocated(
          config.index,
        )
        : await vm.r_t_p_transmitter?.video_transmitters.is_allocated(
          config.index,
        ),
    ),
    `${config.type}-Transmitter ${config.index} does not exist; skipping`,
  );
  if (config.type == "Audio") {
    ip_config = enforce_nonnull(
      vm.r_t_p_transmitter?.audio_transmitters.row(config.index).generic
        .ip_configuration.media,
    );
  }
  if (config.type == "Video") {
    ip_config = enforce_nonnull(
      vm.r_t_p_transmitter?.video_transmitters.row(config.index).generic
        .ip_configuration.video,
    );
  }
  if (config.type == "Meta") {
    ip_config = enforce_nonnull(
      vm.r_t_p_transmitter?.video_transmitters.row(config.index).generic
        .ip_configuration.meta,
    );
  }
  const maybe_session = await tx?.generic.hosting_session.status.read();
  if (!!maybe_session) await maybe_session.active.command.write(false);

  const full_addr = (addr: string | null, port: number) => {
    if (addr == null) return null;
    return `${addr}:${port}`;
  };
  await ip_config?.primary.dst_address.command.write(
    full_addr(config.primary_dst_address, config.primary_dst_port),
  );
  if (config.secondary_dst_address && config.secondary_dst_port) {
    await ip_config?.secondary.dst_address.command.write(
      full_addr(config.secondary_dst_address, config.secondary_dst_port),
    );
  }

  await ip_config?.primary.header_settings.command.write({
    ...(await ip_config.primary.header_settings.status.read()),
    payload_type: config.primary_payload_type,
  });
  await ip_config?.secondary.header_settings.command.write({
    ...(await ip_config.secondary.header_settings.status.read()),
    payload_type: config.secondary_payload_type,
  });
  await maybe_session?.active.command.write(true);
}

export async function set_addresses_from_csv(vm: VAPI.VM.Any) {
  const csv_path = z
    .string()
    .regex(/.+\..+/)
    .parse(process.env["CSV_PATH"]);
  const csv = fs.readFileSync(csv_path, "utf8");
  const parsed = parse_csv(csv, CSVAddrSchema);
  for (const entry of parsed) {
    await set_transmitter_addresses(vm, entry).catch((_) =>
      console.log(
        `Could not set Addresses on Transmitter ${entry.type} ${entry.index}`,
      )
    ); // Explicitly  allow Exceptions since stuff might not be  allocated
  }
}

run(set_addresses_from_csv);
