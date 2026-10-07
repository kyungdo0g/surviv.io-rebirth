// The ammo column's colours and the rebirth's extra ammo rows. The eight original calibres have fixed rows with the
// overlay colours of the original index.html (column order: uiLayout.ts ammoOrder). The beta new guns' ammo (40mm
// teal, rocket brown, 5.7x28 pink: survev-content-and-new-guns.md section 8, new-gun-stats.md 4.5; the loot tints of
// their defs) is `special` like the flare and shows a row, below the others, only while the player carries some, so
// the original eight-row column and its phone grids stay as they were.
import { NEW_AMMO_IDS } from "@rebirth/defs";

/** ammo overlay colours (the original eight from index.html, then the rebirth's new ammo at the same alpha) */
export const AMMO_COLORS: Readonly<Record<string, string>> = {
    "50AE": "rgba(30, 30, 30, 0.75)",
    "9mm": "rgba(255, 153, 0, 0.75)",
    "308sub": "rgba(49, 56, 0, 0.75)",
    "12gauge": "rgba(255, 0, 0, 0.75)",
    flare: "rgba(255, 85, 0, 0.75)",
    "762mm": "rgba(0, 102, 255, 0.75)",
    "45acp": "rgba(121, 0, 255, 0.75)",
    "556mm": "rgba(3, 123, 0, 0.75)",
    // rebirth new ammo: 0x0CDDAB, 0x8B4513, 0xFF5FB4 (the ammo defs' lootImg.tint)
    "40mm": "rgba(12, 221, 171, 0.75)",
    rocket: "rgba(139, 69, 19, 0.75)",
    "57mm": "rgba(255, 95, 180, 0.75)",
};

/** Ammo rows that exist only while carried (the rebirth's new ammo). */
export const EXTRA_AMMO_ROWS: readonly string[] = NEW_AMMO_IDS;

/**
 * Shows the extra row of `item` at the end of `column` while `count` > 0 and takes it out at 0; `force` re-appends a
 * shown row (after the column was reordered).
 */
export function syncExtraAmmoRow(column: HTMLElement, row: HTMLElement, count: number, force = false): void {
    if (count > 0 && (force || row.parentElement !== column)) column.append(row);
    else if (count <= 0 && row.parentElement) row.remove();
}
