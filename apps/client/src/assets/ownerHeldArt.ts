// The owner's held sprites (packages/defs rebirth/heldGunArt.ts OWNER_HELD_GUN_ART) are the owner's art, installed by
// `pnpm assets` from the gitignored assets-user/ (tools/assets/ownerHeldArt.ts) only where its sheet is there. They have
// no fallback texture: a gun without one keeps its bar or drawn sprite, which needs its own scale and hands, so the
// client checks once at startup which files are installed (probeOwnerHeldArt, main.ts) and objects/heldGun.ts draws an
// owner sprite only for those.
import { OWNER_HELD_GUN_ART, ownerHeldGunArtPath } from "@rebirth/defs";
import { assetUrl } from "./spriteManifest.ts";

const installed = new Set<string>();

/** Whether gun `id`'s owner held sprite is installed (known after probeOwnerHeldArt). */
export function ownerHeldArtInstalled(id: string): boolean {
    return installed.has(id);
}

/** Records gun `id`'s owner held sprite as installed or not (the probe; tests). */
export function setOwnerHeldArtInstalled(id: string, on: boolean): void {
    if (on) installed.add(id);
    else installed.delete(id);
}

/** Loads `url` into an image; resolves whether it loaded. */
function loads(url: string): Promise<boolean> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

/** Checks which owner held sprites are installed, giving up after `timeoutMs` (a slow file counts as missing). */
export async function probeOwnerHeldArt(timeoutMs = 3000): Promise<void> {
    if (typeof Image === "undefined") return;
    const ids = Object.keys(OWNER_HELD_GUN_ART);
    const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs));
    await Promise.all(
        ids.map(async (id) => {
            const ok = await Promise.race([loads(assetUrl(ownerHeldGunArtPath(id))), timeout]);
            setOwnerHeldArtInstalled(id, ok);
        }),
    );
}
