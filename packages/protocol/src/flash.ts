// Update message section of the rebirth flashbang (the owner, 2026-10-10; schema 25), announced by the extended flag
// UpdateExtFlag.Flash after the Hits section: the active player was flashed since the previous update
// (Snapshot.flash). Not in the original protocol (v0.8.82 had no flashbang).
//
//   Flash: blind float 0..1 8 bits, deaf float 0..1 8 bits
import type { BitReader, BitWriter } from "@rebirth/core";
import type { FlashEvent } from "@rebirth/sim";
import { dequantize, quantize } from "./quant.ts";

export const FLASH_STRENGTH_BITS = 8;

/** Writes the Flash section (two bytes). */
export function writeFlash(w: BitWriter, flash: FlashEvent): void {
    w.writeBits(quantize(flash.blind, 0, 1, FLASH_STRENGTH_BITS), FLASH_STRENGTH_BITS);
    w.writeBits(quantize(flash.deaf, 0, 1, FLASH_STRENGTH_BITS), FLASH_STRENGTH_BITS);
}

/** Reads the Flash section. */
export function readFlash(r: BitReader): FlashEvent {
    const blind = dequantize(r.readBits(FLASH_STRENGTH_BITS), 0, 1, FLASH_STRENGTH_BITS);
    const deaf = dequantize(r.readBits(FLASH_STRENGTH_BITS), 0, 1, FLASH_STRENGTH_BITS);
    return { blind, deaf };
}
