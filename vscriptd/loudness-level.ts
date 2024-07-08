/*
  SET YOUR TARGET LUFS AND LOUDNESS + INPUTTRIM HERE
*/
const LOUDNESS_INDEX = 0; // USED LOUDNESS INSTANCE
const TRIM_INDEX = 0; // USED INPUTTRIM INSTANCE
const TARGET_LUFS = -24.0;

const MAX_DB_PER_UPDATE = 5.5; // updates every 100ms

const K_P = 0.5;    //  SCALING_FACTOR for proportional control part
const K_I = 0.002;  //  SCALING_FACTOR for Integral control part
const K_D = 0.06;   //  SCALING_FACTOR for Derivate control part

// SCRIPT STARTS HERE

import * as VAPI from "vapi";
import { Duration, enforce, pause } from "vscript";

const vm = await VAPI.VM.open({ towel: "" });
enforce(!!vm.audio_engine && vm instanceof VAPI.AT1130.Root);

const loudness = await vm.audio_engine.loudness.create_row({
  index: LOUDNESS_INDEX,
  allow_reuse_row: true,
});
const trim = await vm.audio_engine.inputtrim.create_row({
  index: TRIM_INDEX,
  allow_reuse_row: true,
});
await trim.rename(`LOUDNESS-${loudness.index}-TRIM`);
await loudness.capabilities.status.watch(async (caps) => {
  if (!caps) return;
  await trim.capabilities.command.write({
    channels: caps.front_channels + caps.surround_channels,
  });
});

await loudness.set_input(trim.output);

let error_integral = 0;
let prev_error = 0;
let last_udate_time: Date = new Date();
const fader = trim.a.master;
loudness.measurement.watch(async (m) => {
  try {
    const time = new Date();
    const delta_t = (time.getTime() - last_udate_time.getTime()) / 1000;
    last_udate_time = time;
    const measurement = m.momentary;
    if (!measurement) return;
    const diff = TARGET_LUFS - measurement;

    const p = K_P * diff;

    error_integral += diff * delta_t;
    const i = K_I * error_integral;

    const deriv = (diff - prev_error) / delta_t;
    const d = K_D * deriv;
    prev_error = diff;

    const out = (p + i + d) * 0.055;

    //console.log(`${p} ${i} ${d}` + "set-value: ", out);

    const sign = out < 0 ? -1 : 1; // todo: implement PID logic maybe
    const current = await fader.read();
    const set_val = current + sign * Math.min(MAX_DB_PER_UPDATE, Math.abs(out)); // todo: see above
    await fader.write(Math.max(Math.min(12.0, set_val), -128));
  } catch (e) {
    console.log("Caught Error: ", e);
  }
});

while (true) {
  await pause(new Duration(2, "s"));
}
await vm.close();
