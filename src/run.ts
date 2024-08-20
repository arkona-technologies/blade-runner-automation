import * as VAPI from "vapi";
import z from "zod";
import dotenv from "dotenv";

export const booleanString = z
  .string()
  .refine((value) => value === "true" || value === "false", {
    message: "Value must be a boolean",
  })
  .transform((value) => value === "true");

export const numberString = z
  .string()
  .refine((value) => {
    return !!value && !isNaN(parseInt(value));
  })
  .transform((value) => parseInt(value!));

// Automatically open a secure, potentially basic-auth protected Connection based the supplied URL
export async function open_connection(url: string): Promise<VAPI.VM.Any> {
  const as_url = new URL(url);
  const vm = await VAPI.VM.open({
    ip: as_url.host,
    towel: "",
    protocol:
      as_url.protocol.startsWith("https") || as_url.protocol.startsWith("wss")
        ? "wss"
        : "ws",
    reject_unauthorized: false,
    login: as_url.username.length
      ? { user: as_url.username, password: as_url.password }
      : undefined,
  });
  return vm;
}

export async function run(func: (vm: VAPI.VM.Any) => Promise<void>) {
  const env = dotenv.config(); // Reads a .env file and parses its content into the enviornment variables of this process
  const URL_BLADE = z.string().url().parse(process.env["URL_BLADE"]);
  const vm = await open_connection(URL_BLADE);
  try {
    await func(vm);
  } catch (e) {
    console.log(`[${vm.raw.identify()}]: ` + e);
    console.log(e);
  } finally {
    console.log("Exiting...");
    await vm.close();
  }
}

export async function job(func: (vm: VAPI.VM.Any) => Promise<void>) {
  const vm = await VAPI.VM.open({ ip: "127.0.0.1" });
  try {
    await func(vm);
  } catch (e) {
    console.log(`[${vm.raw.identify()}]: ` + e);
    console.log(e);
  } finally {
    console.log("Exiting...");
    await vm.close();
  }
}
