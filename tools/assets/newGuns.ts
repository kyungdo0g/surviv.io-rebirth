// Installs the beta new guns' loot icons (cut from the owner's line-art sheets) and sounds (the owner's clips, else
// the donor guns' originals) into the client's asset folder; newGunInstall.ts has the details. pnpm assets runs it
// last; run it alone after the owner adds or changes files in assets-user/ (needs ffmpeg for the WebP sheets):
//   node tools/assets/newGuns.ts [--dest apps/client/public/assets] [--sheets <dir>] [--audio <dir>]
import { parseArgs } from "node:util";
import { installNewGunAssets, SHEET_DIR, summarize, USER_AUDIO } from "./newGunInstall.ts";
import { ASSET_DEST } from "./sources.ts";

const { values } = parseArgs({
    options: {
        dest: { type: "string", default: ASSET_DEST },
        sheets: { type: "string", default: SHEET_DIR },
        audio: { type: "string", default: USER_AUDIO },
    },
});
const report = installNewGunAssets({ dest: values.dest!, sheetDir: values.sheets!, userAudio: values.audio! });
for (const line of summarize(report)) console.log(line);
