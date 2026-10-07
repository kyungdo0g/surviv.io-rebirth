// Compares the sprites cut from the original atlases (atlas.ts) with ours: survev's client/public/img files plus the
// fandom PNG gap fills (assets/fandom-gapfill.json), and the sprites the definitions reference.
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { collectSpriteRefs, nominalSize, SURVEV_PUBLIC, survevFiles, survevSprites } from "./sources.ts";

export interface SpriteIndexEntry {
    /** file under the sprites directory */
    file: string;
    /** the atlas page it was cut from */
    atlas: string;
    /** atlas scale (1 for "-100" pages, 0.5 for "-50") */
    scale: number;
    /** untrimmed size in the atlas, which is also the cut file's pixel size */
    sourceSize: [number, number];
    /** size at scale 1: the size the definitions' sprite scales are relative to */
    logicalSize: [number, number];
    trimmed: boolean;
    rotated: boolean;
    /**
     * Other chosen pages holding the same frame id. `diff` (atlasSheets imageDiff) is measured against the cut above
     * for same-scale copies; `file` is set when the copy is different art (a mode-specific picture under the same id).
     */
    alsoIn?: { atlas: string; scale: number; diff?: { mean: number; max: number }; file?: string }[];
}

export interface SpriteIndex {
    bundle: string;
    pages: {
        image: string;
        family: string;
        scale: number;
        size: [number, number];
        frames: number;
        downloaded: boolean;
    }[];
    sprites: Record<string, SpriteIndexEntry>;
}

const DEFS = "packages/defs/src/generated";
const DEF_FILES = ["gameObjects.json", "mapObjects.json", "maps.json"];
const FANDOM_GAPFILL = "assets/fandom-gapfill.json";
/** sizes within this many pixels count as equal (half-pixel SVG sizes, odd sizes rounded by TexturePacker) */
const SIZE_TOLERANCE = 1;
/** proportions within 3% count as the same picture stored at another size (as sources.ts scaleSize) */
const ASPECT_TOLERANCE = 0.03;

/** Name forms that survev and the original spell differently: case, "_" vs "-", numbered variants. */
function normalForms(id: string): string[] {
    const base = id
        .replace(/\.img$/, "")
        .toLowerCase()
        .replace(/_/g, "-");
    const forms = [base, base.replace(/-?0*\d+$/, ""), base.replace(/-0*1$/, "")];
    return [...new Set(forms.filter(Boolean))];
}

type Size = [number, number];

/**
 * "few-px": both sides within 3% (re-exported art, a pixel or few of padding); "scaled": one factor on both axes (the
 * original stored the image shrunk, as large ceilings at 0.75 or 0.5); "shape": different proportions.
 */
function compareSizes(ours: Size, original: Size): { mismatch?: "few-px" | "scaled" | "shape"; ratio?: number } {
    if (Math.abs(ours[0] - original[0]) <= SIZE_TOLERANCE && Math.abs(ours[1] - original[1]) <= SIZE_TOLERANCE)
        return {};
    const fx = original[0] / ours[0];
    const fy = original[1] / ours[1];
    const ratio = Math.round(((fx + fy) / 2) * 1000) / 1000;
    if (Math.abs(fx - 1) <= ASPECT_TOLERANCE && Math.abs(fy - 1) <= ASPECT_TOLERANCE)
        return { mismatch: "few-px", ratio };
    return { mismatch: Math.abs(fx - fy) <= ASPECT_TOLERANCE * Math.max(fx, fy) ? "scaled" : "shape", ratio };
}

/**
 * `originalText` is the original client's code and page (bundle + index.html): an id of ours that it mentions without
 * an atlas frame was known to the original (defs or DOM images); one it never mentions is survev-only content.
 */
export function buildInventory(index: SpriteIndex, originalText: string) {
    // ours: survev's files and the fandom gap fills (whatever the manifest now draws from the original atlases)
    const oursFiles: Record<string, string> = existsSync(SURVEV_PUBLIC)
        ? Object.fromEntries(survevSprites(survevFiles()).sprites)
        : {};
    const refs = new Set<string>();
    for (const f of DEF_FILES) {
        const p = join(DEFS, f);
        if (existsSync(p)) collectSpriteRefs(JSON.parse(readFileSync(p, "utf8")), refs);
    }
    for (const empty of ["none.img", ".img"]) refs.delete(empty);
    const gapFill = existsSync(FANDOM_GAPFILL)
        ? (JSON.parse(readFileSync(FANDOM_GAPFILL, "utf8")) as { sprite: string; file: string; url: string }[])
        : [];
    const fandom = new Map(gapFill.map((g) => [g.sprite, g.url]));
    for (const g of gapFill) oursFiles[g.sprite] ??= g.file;

    const original = index.sprites;
    const originalIds = Object.keys(original).sort();
    const ourIds = Object.keys(oursFiles).sort();
    const originalOnlyIds = originalIds.filter((id) => !oursFiles[id]);
    const oursOnlyIds = ourIds.filter((id) => !original[id]);

    // naming differences: an id of ours that only exists under another spelling in the original atlases
    const byForm = new Map<string, string[]>();
    for (const id of originalOnlyIds) {
        for (const form of normalForms(id)) byForm.set(form, [...(byForm.get(form) ?? []), id]);
    }
    const matchOf = (id: string) => {
        const forms = normalForms(id);
        for (const [i, form] of forms.entries()) {
            const hits = byForm.get(form);
            if (hits?.length) return { ids: hits, rule: i === 0 ? "case/underscore" : "numbered variant" };
        }
        return undefined;
    };

    const both = originalIds
        .filter((id) => oursFiles[id])
        .map((id) => {
            const file = oursFiles[id]!;
            const ours = nominalSize(file);
            const o = original[id]!;
            return {
                id,
                file,
                ours: ours ?? null,
                original: o.logicalSize,
                atlas: o.atlas,
                ...(fandom.has(id) ? { fandom: true } : {}),
                ...(ours ? compareSizes(ours, o.logicalSize) : { mismatch: "unreadable" as const, ratio: undefined }),
            };
        });
    const oursOnly = oursOnlyIds.map((id) => {
        const match = matchOf(id);
        return {
            id,
            file: oursFiles[id]!,
            ours: nominalSize(oursFiles[id]!) ?? null,
            referencedByDefs: refs.has(id),
            mentionedByOriginal:
                originalText.includes(`"${id}"`) || originalText.includes(`/${basename(oursFiles[id]!)}`),
            ...(match ? { match } : {}),
        };
    });
    const originalOnly = originalOnlyIds.map((id) => ({
        id,
        atlas: original[id]!.atlas,
        original: original[id]!.logicalSize,
        file: original[id]!.file,
        referencedByDefs: refs.has(id),
        oursByName: oursOnly.filter((o) => o.match?.ids.includes(id)).map((o) => o.id),
    }));
    const sizeMismatches = both.filter((b) => b.mismatch);
    const fandomGapFills = [...fandom].sort().map(([id, url]) => {
        const b = both.find((x) => x.id === id);
        return {
            id,
            file: oursFiles[id] ?? null,
            url: url || null,
            inOriginal: !!original[id],
            ours: b?.ours ?? (oursFiles[id] ? (nominalSize(oursFiles[id]) ?? null) : null),
            original: original[id]?.logicalSize ?? null,
            originalFile: original[id]?.file ?? null,
            ...(b?.mismatch ? { mismatch: b.mismatch, ratio: b.ratio } : {}),
        };
    });
    const defsMissing = [...refs]
        .filter((id) => !oursFiles[id])
        .sort()
        .map((id) => ({ id, inOriginal: !!original[id], originalFile: original[id]?.file ?? null }));
    const duplicates = Object.values(original).filter((e) => e.alsoIn).length;
    const variants = Object.entries(original)
        .filter(([, e]) => e.alsoIn?.some((c) => c.file))
        .map(([id, e]) => ({ id, atlas: e.atlas, variants: e.alsoIn!.filter((c) => c.file) }));

    return {
        bundle: index.bundle,
        ours: `${SURVEV_PUBLIC}/img + ${FANDOM_GAPFILL}`,
        sizeTolerancePx: SIZE_TOLERANCE,
        counts: {
            original: originalIds.length,
            ours: ourIds.length,
            both: both.length,
            sizeMismatch: sizeMismatches.length,
            sizeMismatchFewPx: sizeMismatches.filter((b) => b.mismatch === "few-px").length,
            sizeMismatchScaled: sizeMismatches.filter((b) => b.mismatch === "scaled").length,
            sizeMismatchShape: sizeMismatches.filter((b) => b.mismatch === "shape").length,
            originalOnly: originalOnly.length,
            originalOnlyReferencedByDefs: originalOnly.filter((o) => o.referencedByDefs).length,
            oursOnly: oursOnly.length,
            oursOnlyMatched: oursOnly.filter((o) => o.match).length,
            oursOnlyReferencedByDefs: oursOnly.filter((o) => o.referencedByDefs).length,
            oursOnlyMentionedByOriginal: oursOnly.filter((o) => o.mentionedByOriginal).length,
            fandomGapFills: fandomGapFills.length,
            fandomGapFillsInOriginal: fandomGapFills.filter((f) => f.inOriginal).length,
            defsReferenced: refs.size,
            defsMissing: defsMissing.length,
            defsMissingInOriginal: defsMissing.filter((d) => d.inOriginal).length,
            onSeveralPages: duplicates,
            variants: variants.length,
        },
        originalOnly,
        oursOnly,
        sizeMismatches,
        fandomGapFills,
        defsMissing,
        variants,
        both,
    };
}
