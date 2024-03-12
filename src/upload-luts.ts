import * as VAPI from "vapi";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { run } from "./run.js";

export async function upload_luts(vm: VAPI.VM.Any) {
  const luts_dir = z.string().parse(process.env["LUT_DIR"]);
  const luts = fs
    .readdirSync(luts_dir)
    .filter((p) => p.endsWith(".cube"))
    .map((p) => path.join(luts_dir, p));

  let idx = 0;
  for (const lut of luts) {
    const name = lut.split("/")[lut.length - 1] ?? `LUT-${idx++}`;
    console.log(name);
    const input_cs = "BT2020";
    const output_cs = "BT709";
    const input_range = "Normal";
    const output_range = "Normal";
    const output_tc = "SDR";
    const input_tc = "HLG";
    const query = `/cube/${name}?input_cs=${input_cs}&output_cs=${output_cs}&lut_input_range=${input_range}&lut_output_range=${output_range}&output_transfer=${output_tc}&input_transfer=${input_tc}`;
    await fetch(`http://${vm.raw.ip}${query}`, {
      method: "PUT",
      body: fs.readFileSync(lut),
    });
  }
}

run(upload_luts);
