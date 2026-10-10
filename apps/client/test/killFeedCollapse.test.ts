// Kill feed of a collapsing building (DamageType.Collapse; sim world/collapse.ts, ui/killFeed.ts): "<target> was
// buried in the <building>", "<player> buried <target> in the <building>" when a player broke the last wall, in
// English and Korean.
import { DamageType } from "@rebirth/defs";
import type { KillEvent } from "@rebirth/sim";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setLang } from "../src/l10n/index.ts";
import { collapsePlace, downedMessage, killFeedText, killMessage, type PlayerNames } from "../src/ui/killFeed.ts";

const names: PlayerNames = {
    name: (id) => ({ 1: "Alice", 2: "Bob" })[id] ?? "",
    teamId: (id) => (id === 1 || id === 2 ? id : 0),
};

function kill(killCreditId: number): KillEvent {
    return {
        targetId: 2,
        killerId: killCreditId,
        killCreditId,
        damageType: DamageType.Collapse,
        itemSourceType: "",
        mapSourceType: "test_collapse_hut_01",
        downed: false,
        killed: true,
        killerKills: 1,
        source: "collapse",
    };
}

const doc = (globalThis as { document?: unknown }).document;
beforeAll(() => {
    // truncateName measures with a canvas; without one the name is kept whole
    (globalThis as { document?: unknown }).document = {
        documentElement: {},
        createElement: () => ({ getContext: () => null }),
    };
});
afterAll(() => {
    (globalThis as { document?: unknown }).document = doc;
    setLang("en");
});

describe("collapse kill texts", () => {
    it("bury the target in the building, naming the player who broke the last wall", () => {
        setLang("en");
        expect(collapsePlace("test_collapse_hut_01")).toBe("rubble");
        expect(killFeedText(kill(0), names)).toBe("Bob was buried in the rubble");
        expect(killFeedText(kill(1), names)).toBe("Alice buried Bob in the rubble");
        expect(killMessage(kill(1), names, false).text).toBe("YOU killed Bob with a collapse");
        expect(downedMessage({ ...kill(0), downed: true, killed: false }, names, false)).toBe(
            "The collapse knocked YOU out",
        );
    });

    it("have Korean texts", () => {
        setLang("ko");
        expect(killFeedText(kill(0), names)).toBe("Bob 이(가) 매몰되었습니다. 장소: 잔해");
        expect(killFeedText(kill(1), names)).toBe("Alice 이(가) 매몰시켰습니다 Bob - 장소: 잔해");
    });
});
