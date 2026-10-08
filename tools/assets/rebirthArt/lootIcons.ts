// Loot icons of the six launchers, our own art (no original or survev icon shows a rocket or grenade launcher; the
// owner's sheets of 2026-10-07 draw five of them and not the M79). Each is a side view in the original loot icons'
// style (vectorIcon.ts), muzzle towards +x in a local frame of about 200 units, so the six read apart at a glance:
// - RPG-7: thin tube, venturi bell at the rear, wooden heat shield, two grips, optic, the bulbous PG-7 warhead;
// - Panzerfaust: a bare thin tube with a flip-up sight and an oversized teardrop warhead, no grips;
// - M202 FLASH: a long box of stacked tubes with end covers, a pistol grip and a folding sight;
// - M79: wooden rifle stock and forend, a short fat break-open barrel, leaf sight;
// - Milkor MGL: skeleton stock, a big six-round cylinder, a short barrel with a front grip, reflex sight;
// - GL-06: telescopic rod stock, a long top rail with a large sight, a fat barrel.
// They are the fallback of the launchers' loot icons (packages/defs rebirth/newGunAssets.ts DRAWN_LOOT_ICONS): the SVGs
// are committed under apps/client/public/rebirth/loot/ (rerun `node tools/assets/rebirthLootIcons.ts` after a change;
// rebirthLootIcons.test.ts checks they are current) and the asset installer rasterizes the same shapes into the
// installed PNG when the owner's icon is missing.
import { box, detail, ICON_GREY, part, type Shape } from "../vectorIcon.ts";

function rpg7(): Shape[] {
    return [
        part([
            [0, -11],
            [20, -5.5],
            [20, 5.5],
            [0, 11],
        ]),
        part(box(18, -5, 150, 5)),
        part([
            [80, 8],
            [89, 8],
            [84, 28],
            [75, 28],
        ]),
        detail([
            [91, 7],
            [94, 7],
            [94, 15],
            [91, 14],
        ]),
        part([
            [104, 8],
            [112, 8],
            [109, 26],
            [101, 26],
        ]),
        part(box(62, -8.5, 104, 8.5)),
        detail(box(70, -7, 73, 7)),
        detail(box(93, -7, 96, 7)),
        detail(box(83, -11, 88, -7)),
        part(box(76, -20, 94, -10)),
        detail(box(78, -17, 81, -13)),
        part(box(148, -3.5, 160, 3.5)),
        part([
            [159, -6],
            [167, -11.5],
            [182, -11.5],
            [194, -6.5],
            [202, -2],
            [204, 0],
            [202, 2],
            [194, 6.5],
            [182, 11.5],
            [167, 11.5],
            [159, 6],
        ]),
        detail(box(169, -9.5, 172, 9.5)),
    ];
}

function panzerfaust(): Shape[] {
    return [
        part(box(0, -4.5, 142, 4.5)),
        detail(box(1.5, -3, 4.5, 3)),
        detail(box(36, -1.5, 92, 1.5), ICON_GREY),
        detail(box(98, -8, 106, -4)),
        part([
            [108, -4.5],
            [116, -4.5],
            [118, -16],
            [111, -16],
        ]),
        part(box(140, -3, 150, 3)),
        part([
            [148, -4],
            [155, -10],
            [164, -15],
            [176, -16.5],
            [188, -15],
            [198, -9],
            [205, -3],
            [207, 0],
            [205, 3],
            [198, 9],
            [188, 15],
            [176, 16.5],
            [164, 15],
            [155, 10],
            [148, 4],
        ]),
        detail(box(161, -12, 164, 12)),
    ];
}

function m202(): Shape[] {
    return [
        part([
            [84, 16],
            [97, 16],
            [92, 40],
            [79, 40],
        ]),
        part(box(97, 15, 113, 24)),
        part([
            [68, -15],
            [82, -15],
            [82, -29],
            [73, -29],
        ]),
        detail(box(72, -26, 75, -19)),
        part(box(0, -16, 186, 16)),
        detail(box(5, -1.2, 181, 1.2)),
        detail(box(40, -14.5, 44, 14.5)),
        detail(box(140, -14.5, 144, 14.5)),
        part(box(-8, -18.5, 3, 18.5)),
        part(box(183, -18.5, 195, 18.5)),
    ];
}

function m79(): Shape[] {
    return [
        part([
            [88, 5],
            [140, 5],
            [136, 14],
            [92, 14],
        ]),
        part(box(80, -10, 176, 6)),
        detail(box(171, -9, 175, 5)),
        detail(box(165, -14, 169, -9)),
        part([
            [90, -9],
            [96, -9],
            [98, -20],
            [92, -20],
        ]),
        detail([
            [61, 8],
            [64, 8],
            [66, 17],
            [75, 17],
            [77, 8],
            [80, 8],
            [78, 20],
            [63, 20],
        ]),
        detail([
            [69, 8],
            [72, 8],
            [71, 15],
            [69, 14],
        ]),
        part([
            [0, -7],
            [56, -5],
            [60, -5],
            [60, 9],
            [52, 9],
            [7, 27],
            [0, 27],
        ]),
        part(box(56, -8, 82, 9)),
        detail(box(-4, -7, 1, 27)),
    ];
}

function mgl(): Shape[] {
    return [
        part([
            [0, -8],
            [44, -6],
            [44, 4],
            [10, 23],
            [0, 23],
        ]),
        detail([
            [11, -1],
            [36, -1],
            [15, 13],
        ]),
        part([
            [47, 8],
            [58, 8],
            [53, 31],
            [42, 31],
        ]),
        part(box(42, -8, 66, 8)),
        part(box(112, -7, 186, 7)),
        detail(box(182, -6, 185, 6)),
        part([
            [132, 7],
            [142, 7],
            [139, 27],
            [129, 27],
        ]),
        part(box(64, -17, 112, 17)),
        detail(box(70, -11.5, 106, -8.5)),
        detail(box(70, -1.5, 106, 1.5)),
        detail(box(70, 8.5, 106, 11.5)),
        part(box(68, -26, 98, -17)),
        detail(box(70, -24, 73, -19)),
    ];
}

function gl06(): Shape[] {
    return [
        part(box(6, -3, 48, 3)),
        part(box(6, 10, 48, 15)),
        part(box(0, -7, 9, 21)),
        part([
            [58, 10],
            [69, 10],
            [64, 33],
            [53, 33],
        ]),
        detail([
            [70, 9],
            [73, 9],
            [74, 17],
            [84, 17],
            [85, 9],
            [88, 9],
            [87, 20],
            [71, 20],
        ]),
        part(box(88, -9, 170, 7)),
        detail(box(166, -8, 169, 6)),
        part(box(44, -10, 90, 10)),
        part(box(52, -16, 150, -9)),
        part([
            [96, -16],
            [120, -16],
            [120, -28],
            [100, -28],
        ]),
        detail(box(116, -25, 119, -19)),
    ];
}

/** The local-frame shapes of each drawn launcher icon, by gun id. */
export const LAUNCHER_LOOT_ICONS: Readonly<Record<string, () => Shape[]>> = {
    m79,
    mgl,
    gl06,
    rpg7,
    panzerfaust,
    m202,
};

/** One line describing each icon (the SVG's comment). */
export const LAUNCHER_LOOT_ICON_NOTES: Readonly<Record<string, string>> = {
    m79: "M79 loot icon, own art: wooden stock and forend, short fat break-open 40 mm barrel, leaf sight.",
    mgl: "Milkor MGL loot icon, own art: skeleton stock, six-round cylinder, short barrel, front grip, reflex sight.",
    gl06: "GL-06 loot icon, own art: telescopic rod stock, long top rail with a large sight, fat 40 mm barrel.",
    rpg7: "RPG-7 loot icon, own art: tube with venturi bell, wooden heat shield, two grips, optic, PG-7 warhead.",
    panzerfaust: "Panzerfaust loot icon, own art: bare tube, flip-up sight and trigger, oversized teardrop warhead.",
    m202: "M202 FLASH loot icon, own art: box of stacked rocket tubes with end covers, pistol grip, folding sight.",
};
