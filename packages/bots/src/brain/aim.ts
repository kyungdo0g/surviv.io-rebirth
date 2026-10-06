// Moved: the legacy aim lives in motor/legacy.ts and the gaussian sampler in motor/noise.ts (the human cursor motor
// model is in motor/human.ts). This shim keeps old import paths working.
export { AimController } from "../motor/legacy.ts";
export { gaussian } from "../motor/noise.ts";
