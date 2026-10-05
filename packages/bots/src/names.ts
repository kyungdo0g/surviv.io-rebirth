// Bot nicknames: a mix of Korean and English names in the style of the original lobbies (Korean community servers,
// docs/research/community-ko.md). Every name fits the 16-byte UTF-8 limit of the Join message (Hangul syllables take
// 3 bytes, so Korean names stay at 5 syllables or fewer).
import type { Rng } from "@rebirth/core";

export const BOT_NAMES_KO: readonly string[] = [
    "고수",
    "뉴비",
    "치킨각",
    "배그장인",
    "총잡이",
    "사냥꾼",
    "호랑이",
    "번개",
    "바람돌이",
    "감자",
    "도토리",
    "까치",
    "무적",
    "용사",
    "저격수",
    "탱커",
    "꿀잼",
    "개굴",
    "냥이",
    "멍멍이",
    "초보",
    "달인",
    "백발백중",
    "솔로킹",
    "생존왕",
    "한방",
    "자기장",
    "붕대맨",
    "소다",
    "산탄총",
    "알약",
    "망치",
    "곰돌이",
    "토끼",
    "여우",
    "독수리",
    "늑대",
    "하늘",
    "별빛",
    "새벽",
];

export const BOT_NAMES_EN: readonly string[] = [
    "NoScope",
    "Bambi",
    "Ace",
    "Shadow",
    "Ghost",
    "Raven",
    "Blaze",
    "Viper",
    "Nova",
    "Hunter",
    "Rookie",
    "Tank",
    "Medic",
    "Ninja",
    "Chicken",
    "Potato",
    "Storm",
    "Wolf",
    "Fox",
    "Hawk",
    "Panda",
    "Sniper",
    "Pickle",
    "Toast",
    "Mango",
    "Pixel",
    "Zero",
    "Echo",
    "Frost",
    "Blitz",
    "Lucky",
    "Camper",
    "Rusher",
    "Looter",
    "Bandit",
    "Maverick",
    "Duck",
    "Salty",
    "Tilted",
    "GG",
];

const encoder = new TextEncoder();
const MAX_NAME_BYTES = 16;

/** A name not in `used` (adds a number suffix on collision); remembers it in `used`. */
export function pickBotName(rng: Rng, used: Set<string>): string {
    const pool = rng.bool(0.5) ? BOT_NAMES_KO : BOT_NAMES_EN;
    let base = rng.pick(pool);
    // some players add digits to their name
    if (rng.bool(0.25)) base = `${base}${rng.int(1, 99)}`;
    let name = base;
    for (let n = 2; used.has(name) || encoder.encode(name).length > MAX_NAME_BYTES; n++) {
        name = `${rng.pick(BOT_NAMES_EN)}${n}`;
    }
    used.add(name);
    return name;
}
