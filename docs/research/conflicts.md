# Conflicts

> Every disagreement found in the knowledge base, merged from the `## Conflicts` sections of all files under `docs/research` and deduplicated: one `## <id>` entry per conflict.
> Each entry lists the sides (A, B, C… as fact lines with their own sources), a `proposed resolution` that follows the precedence rules in `README.md`, and the files (with their original conflict ids) that mention it.
> Precedence: 1 client-visible defs after the balance revert; 2 survev server logic unless marked as an estimate; 3 wikis for names and what existed; 4 dates need two sources; 5 undecidable → survev value as a config knob, logged in `open-questions.md`.
> `status: closed` marks conflicts settled by verified primary sources. Lines starting `note:` flag KB files whose own proposal this page overrides.

> **Known high-impact conflicts** (checked against primary sources for this page)

## boost-heal-tiers

- status: open; the code and wiki numbers differ by 2–3x and neither is in the original client [src:derived/kb-crossref] [L]
- A: survev `boostHealAmounts` 0.5 / 1.25 / 1.5 / 1.75 HP/s for the boost bands 0–25 / 25–50 / 50–87.5 / 87.5–100, plus one +1.85 speed step at 50 [src:survev/shared/gameConfig.ts:193-196] [src:survev/server/src/game/objects/player.ts:1524-1532] [H]
- A: wiki.gg (documents the fork) gives the same 0.5 / 1.25 / 1.5 / 1.75 HP/s and decay 0.375/s [src:wikigg/Adrenaline] [M]
- B: fandom Adrenaline table: 1 / 3.75 / 4.75 / 5 HP/s for the same bands, decay 0.375/s [src:fandom/Adrenaline] [M]
- B: survev itself used 1 / 3.75 / 4.75 / 5 until commit 97029e58 (2024-06-29, "full merge + fixed healing/boost drop"), which switched to 0.5 / 1.25 / 1.5 / 1.75 without citing a source [src:derived/survev-git-97029e58] [H]
- neither table ships in a client: the original and relaunch clients only carry `boostBreakpoints` [1, 1, 1.5, 0.5] [src:derived/survev@9f64948d:src/gameConfig.ts:123] [src:kong/relaunch-client-bundle] [H]
- proposed resolution: rule 2/5: keep survev's 0.5 / 1.25 / 1.5 / 1.75 as the `boostHealAmounts` knob default (fandom's table makes one Soda heal about 66 HP, which looks implausible); measure the real rates on the 2026 relaunch (see open question `boost-heal-measurement`) [src:survev/shared/gameConfig.ts:195] [src:derived/readme-precedence] [L]
- files: `items/gear.md` (`adrenaline-regen`), `mechanics/boost.md` (`boost-heal-tiers`) [src:derived/kb-crossref] [H]

## bandage-max-heal

- status: closed: 100 [src:changelog/0.7.1] [H]
- A: bandage `maxHeal` 100 (heal 15, use time 3 s) in survev and in the relaunch client [src:survev/shared/defs/gameObjects/gearDefs.ts:390-393] [src:kong/relaunch-client-defs] [H]
- A: original changelog 0.7.1 (Feb. 22, 2019): "Bandages now heal to 100 (previously capped at 75)" and use time 2.6 → 3.0 s [src:changelog/0.7.1] [H]
- A: fandom Bandage: the 75 HP cap was removed in the "Danger Close" update [src:fandom/Bandage] [M]
- B: the tooltip string "Cannot heal past 75 health." is still shipped in en and ko l10n and in the relaunch bundle [src:survev/client/src/en.json:375] [src:l10n/ko:game-healing-tooltip] [src:kong/relaunch-client-bundle] [H]
- proposed resolution: rule 1: `maxHeal` 100; the 75 tooltip is a stale pre-0.7.1 string, so do not show it (or reword it to 100) [src:changelog/0.7.1] [src:survev/shared/defs/gameObjects/gearDefs.ts:393] [H]
- files: `l10n-ko.md` (`l10n-healing-tooltip-75`) [src:derived/kb-crossref] [H]

## frag-fuse-time

- status: closed: 4 s [src:derived/kb-crossref] [H]
- A: frag `fuseTime` 4 in survev, in the original client defs and in the relaunch client [src:survev/shared/defs/gameObjects/throwableDefs.ts:82] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:11] [src:kong/relaunch-client-defs] [H]
- A: wiki.gg "fuse time of 4 seconds" and the fandom Frag Grenade infobox `fuseTime = 4` [src:wikigg/Frag_Grenade] [src:fandom/Frag_Grenade] [M]
- A: namu.wiki: the frag explodes 4 s after the pin is pulled and can be cooked by holding the button [src:namu/Surviv.io/무기] [M]
- B: fandom Throwables table: "When the cooking time (5 seconds) is over, it explodes" [src:fandom/Throwables] [M]
- B: fandom Frag Grenade prose: hold left click to "cook" the grenade "for 3 seconds" [src:fandom/Frag_Grenade] [M]
- proposed resolution: rule 1: 4 s fuse (client-visible def, two wikis agree); the 5 s and 3 s figures are prose slips [src:survev/shared/defs/gameObjects/throwableDefs.ts:82] [H]
- files: `items/throwables.md` (`frag-cook-text`) [src:derived/kb-crossref] [H]

## bleed-escalation-scope

- A: survev escalates bleed only when the map's `bleedDamageMult` ≠ 1: damage = `bleedDamage` × `downedCount` × `bleedDamageMult`, otherwise × 1 [src:survev/server/src/game/objects/player.ts:1616-1618] [H]
- A: only Faction sets `bleedDamageMult` 1.25; the base map value is 1 [src:survev/shared/defs/maps/factionDefs.ts:246] [src:survev/shared/defs/maps/baseDefs.ts:88] [H]
- A: the fandom 50v50 page and the wiki.gg 50v50 page describe the escalation as a 50v50 rule (wiki.gg: "25 % faster than the previous time") [src:fandom/50v50_Map] [src:wikigg/50v50_mode] [M]
- B: the fandom Knocked Out page (Squad, Duo and 50v50): "The rate at which a person bleeds out will increase with the number of times they are knocked out." [src:fandom/Knocked_Out] [M]
- the multiplier is server-side; the relaunch client carries no `bleedDamageMult` [src:kong/relaunch-client-bundle] [M]
- proposed resolution: rule 2: Faction-only escalation by default (survev server logic, backed by the 50v50 pages), with an `bleedEscalationAllModes` knob for the fandom reading [src:survev/server/src/game/objects/player.ts:1618] [src:derived/readme-precedence] [M]
- files: `mechanics/downed-revive.md` (`bleed-escalation-scope`) [src:derived/kb-crossref] [H]

## 308sub-capacity

- status: closed: 10/20/40/80 [src:derived/kb-crossref] [H]
- A: original `bagSizes["308sub"]` [10, 20, 40, 80] in the original client GameConfig and in the relaunch bundle [src:derived/survev@9f64948d:src/gameConfig.ts:266] [src:kong/relaunch-client-defs] [H]
- A: balance.txt 0.2.22 (2026-03-16): "Increased .308 Subsonic capcity from 10/20/40/80 to 20/40/60/80" [src:balance/252] [H]
- A: fandom .308 Subsonic history: Level 2 pack 30 → 40, Level 3 pack 40 → 80 [src:fandom/.308_Subsonic] [M]
- B: survev HEAD [20, 40, 55, 70, 85] (five levels; the fifth entry exists for every ammo in the fork config), which also differs from balance.txt's 20/40/60/80 [src:survev/shared/gameConfig.ts:421] [H]
- C: the fandom Backpacks template lists 10/20/30/40, the pre-buff values per the .308 page history [src:fandom/Backpacks] [M]
- proposed resolution: rule 1: 10/20/40/80; both 20/40/60/80 and 20/40/55/70/85 are fork values [src:derived/survev@9f64948d:src/gameConfig.ts:266] [src:kong/relaunch-client-defs] [H]
- files: `items/gear.md` (`308sub-capacity-fandom`), `items/gear.md` (`308sub-capacity-fork`), `items/guns.md` (`308sub-capacity`), `provenance/balance-revert.md` (`subsonic-capacity`) [src:derived/kb-crossref] [H]

## launch-date

- A: changelog 0.0.2 "First early access release" dated Oct. 11, 2017 (0.0.1, Oct. 6, 2017, only "Added changelog file") [src:changelog/0.0.2] [src:changelog/0.0.1] [H]
- A: Wikipedia and the fandom infobox give October 11, 2017 for the browser release [src:wp-en/Surviv.io] [src:fandom/Surviv.io] [M]
- B: the devs' 0.6.4 first-anniversary post: "surviv.io debuted late on Oct. 31, 2017" [src:fandom/Changelog] [M]
- proposed resolution: rule 4: Oct 11, 2017 = first early-access release (three sources); Oct 31, 2017 = the public debut the developers celebrated as the anniversary [src:changelog/0.0.2] [src:fandom/Changelog] [M]
- files: `history.md` (`launch-date`) [src:derived/kb-crossref] [H]

## relaunch-date

- A: fandom Surviv.io: "The game returned on march 19 2026 by kongregate only on kongregate" [src:fandom/Surviv.io] [M]
- B: Wikipedia: "relaunched on Kongregate's website on March 20, 2026" (infobox: March 20, 2026 re-release) [src:wp-en/Surviv.io] [M]
- C: namu.wiki: the game was restored as of 2026-03-21 (old account data lost) and Kongregate restarted the service on the surviv.io domain on 2026-03-26 [src:namu/Surviv.io] [M]
- D: the relaunch changelog lists 0.9.0 on March 26, 2026, directly after 0.8.82 (December 30, 2019) [src:kong/relaunch-changelog] [H]
- fandom Changelog only says "In March 2026, Kongregate relaunched the game from the v0.8.82 update" (namu.md cited it for March 20, which the dump does not contain) [src:fandom/Changelog] [M]
- proposed resolution: rule 4: surviv.io-domain relaunch build 0.9.0 on March 26, 2026 (relaunch changelog + namu); the Kongregate-site return on March 19–20, 2026 stays low-confidence until the original announcement is found [src:kong/relaunch-changelog] [src:namu/Surviv.io] [L]
- files: `history.md` (`relaunch-date`), `namu.md` (`namu-relaunch-date`) [src:derived/kb-crossref] [H]

## steelskin-naming

- status: closed: naming only [src:derived/kb-crossref] [H]
- A: internal id `steelskin` in the original client perk defs and in the Lone Survivr role perks; def `name` "Steelskin" in both the original defs and survev [src:derived/survev@9f64948d:src/defs/perkDefs.js:100-101] [src:derived/survev@9f64948d:src/defs/roleDefs.js:67] [src:survev/shared/defs/gameObjects/perkDefs.ts:303-304] [H]
- B: display name "Cast Ironskin" in en l10n, in the relaunch bundle and in the original changelog 0.8.3 [src:survev/client/src/en.json:774] [src:kong/relaunch-client-bundle] [src:changelog/0.8.3] [H]
- B: fandom page "Cast Ironskin" (infobox `internalID = steelskin`; the title "Steelskin" redirects to it) [src:fandom/Cast_Ironskin] [M]
- C: balance.txt shortens the perk to "Ironskin" [src:balance/138] [H]
- D: ko l10n: survev's current "강철 피부" ("steel skin") vs the original-era "주조된 아이언 스킨" [src:l10n/ko:game-steelskin] [src:derived/survev@a14ab228:client/l10n/ko.json:622] [H]
- proposed resolution: rule 3: code id `steelskin`, English display "Cast Ironskin"; treat "Ironskin" and "Steelskin" as aliases; Korean display per `l10n-ko.md` [src:survev/client/src/en.json:774] [src:changelog/0.8.3] [H]
- files: `items/perks.md`, `mechanics/damage-armor.md`, `l10n-ko.md` (name rows only, no CONFLICT line) [src:derived/kb-crossref] [H]

## helmet-body-reduction

- status: closed: × 0.3 confirmed [src:derived/kb-crossref] [H]
- A: survev applies helmet `damageReduction` × 1 on headshots and × 0.3 on body hits; the vest only on body hits [src:survev/server/src/game/objects/player.ts:2482-2490] [H]
- A: helmet reductions 0.25 / 0.4 / 0.55 in survev and in the relaunch client [src:survev/shared/defs/gameObjects/gearDefs.ts:128] [src:survev/shared/defs/gameObjects/gearDefs.ts:150] [src:survev/shared/defs/gameObjects/gearDefs.ts:172] [src:kong/relaunch-client-defs] [H]
- B: fandom Helmets: body-damage reduction 7.5 % / 12 % / 16.5 %, "30% of that against normal body shots" [src:fandom/Helmets] [M]
- C: namu.wiki: helmet levels 1–4 add 7.5 / 12 / 16.5 / 21 % general reduction and 25 / 40 / 55 / 70 % headshot reduction [src:namu/Surviv.io/장비] [M]
- proposed resolution: × 0.3 on body hits (0.3 × 25/40/55/70 = 7.5/12/16.5/21, matching both wikis) [src:survev/server/src/game/objects/player.ts:2489] [src:fandom/Helmets] [H]
- files: `mechanics/damage-armor.md` (armour rule line, no CONFLICT line) [src:derived/kb-crossref] [H]

## grenadier-weapon

- status: closed: MP220 [src:fandom/Game_Modes] [src:fandom/MP220] [src:balance/180] [M]
- A: survev's pre-fork Grenadier loadout: MP220 (2 rounds, fillInv), katana, 12 frags + 8 MIRVs, `helmet03_grenadier`, `chest03`, `backpack03`, 4x scope (written in survev commit 0af9a9f2, 2024-08-10) [src:derived/survev@172a4348:shared/defs/gameObjects/roleDefs.ts:306-328] [src:derived/survev-git-0af9a9f2] [H]
- A: balance.txt (Factions Changes 2025-07-23): "Grenadier recieves a MP220 -> Saiga-12 on-promotion", listed under Balance in fork 0.1.2 [src:balance/180] [src:survev/client/public/changelogRec.html:443] [H]
- A: fandom Game Modes and MP220 pages: the Grenadier is given an MP220 [src:fandom/Game_Modes] [src:fandom/MP220] [M]
- B: survev HEAD gives a Saiga-12 (5 rounds) [src:survev/shared/defs/gameObjects/roleDefs.ts:314-323] [H]
- B: fandom Grenadier page (Saiga-12 + 90 × 12 gauge) and Marksman page (Grenadier "shotgun" = Saiga-12); the Grenadier page links survev.io audio files, so it was edited from survev data [src:fandom/Grenadier] [src:fandom/Marksman] [M]
- B: namu.wiki: the Grenadier gets a Saiga-12, katana, frags and MIRVs [src:namu/Surviv.io/이벤트] [M]
- the original client role def has no loadout (only `perks: ["flak_jacket"]`), so the weapon was server-side [src:derived/survev@9f64948d:src/defs/roleDefs.js:48-54] [H]
- proposed resolution: MP220 for v0.8.82 (two fandom pages, survev's pre-fork loadout and balance.txt agree; the Saiga-12 pages match the fork's 2025 change), Saiga-12 as a fork flag [src:fandom/Game_Modes] [src:fandom/MP220] [src:balance/180] [M]
- in the game since the survev content wave's stage 5 (survev balance, design option B): survev's Saiga-12 (the role def's survev `defaultItems`) [src:derived/readme-precedence] [H]
- note: `items/roles.md` proposed Saiga-12 and should be updated to MP220; `provenance/balance-revert.md` cites namu for MP220, but the namu snippet found for this page says Saiga-12 [src:derived/kb-crossref] [M]
- files: `items/roles.md` (`role-grenadier-gun`), `provenance/balance-revert.md` (`grenadier-weapon`) [src:derived/kb-crossref] [H]

> **Korean community**

## shutdown-announce-date

- A (community-ko.md): 나무위키 종료 선언 2023-02-14 [src:namu/Surviv.io] [M]
- B (community-ko.md): Wikipedia 2023-02-13 발표 [src:wp-en/Surviv.io] [M]
- C (history.md): Feb 13, 2023 [src:fandom/Changelog] [src:wp-en/Surviv.io] [M]
- D (history.md): Feb 14, 2023 [src:fandom/Surviv.io] [src:namu/Surviv.io] [M]
- E (namu.md): namu 서비스 종료 선언 2023-02-14 [src:namu/Surviv.io] [M]
- F (namu.md): 발표 2023-02-13, 종료 2023-03-02 [src:wp-en/Surviv.io, fandom/Changelog] [M]
- proposed resolution: rule 4: announced Feb 13, 2023 (US time; fandom Changelog news post + Wikipedia), which is Feb 14 in Korea [src:fandom/Changelog] [src:wp-en/Surviv.io] [M]
- files: `community-ko.md` (`ko-shutdown-announcement-date`), `history.md` (`shutdown-announce-date`), `namu.md` (`namu-shutdown-date`) [src:derived/kb-crossref] [H]

## ko-site-unreachable-date

- A: 디시위키 "2022년 10월 말부터 접속 불가, 도메인이 Bit Heroes Arena로 교체" [src:web/https://wiki.dcinside.com/wiki/surviv.io] [M]
- B: Wikipedia "2023-03-02 종료 후 Bit Heroes Arena를 후속작으로 지정" [src:wp-en/Surviv.io] [M]
- proposed resolution: 2022년 말 장애와 2023-03 공식 종료를 별개 사건으로 기록 [src:derived/readme-precedence] [L]
- files: `community-ko.md` (`ko-site-unreachable-date`) [src:derived/kb-crossref] [H]

## ios-release-year

- A (community-ko.md): Wikipedia 인포박스 iOS 2019-10-04 [src:wp-en/Surviv.io] [M]
- B (community-ko.md): 같은 문서 본문 "2018년 10월 iOS" [src:wp-en/Surviv.io] [M]
- C (history.md): iOS app Oct 4, 2018 [src:fandom/Changelog] [src:fandom/Surviv.io] [M]
- D (history.md): Wikipedia infobox "October 4, 2019" [src:wp-en/Surviv.io] [M]
- proposed resolution: 2018 (fandom infobox + the 0.6.2 news post, and Wikipedia's own body text says October 2018) [src:fandom/Surviv.io] [src:fandom/Changelog] [src:wp-en/Surviv.io] [M]
- files: `community-ko.md` (`ko-ios-release`), `history.md` (`ios-release-year`) [src:derived/kb-crossref] [H]

## server-region-count

- A (community-ko.md): 나무위키 판에 따라 서버 5개 또는 러시아 포함 6개 [src:namu/Surviv.io] [M]
- B (community-ko.md): fandom 5개 지역 [src:fandom/Servers] [M]
- C (namu.md): namu 한 판본은 서버 5개(북미·남미·유럽·아시아·대한민국), 다른 판본은 러시아 포함 6개 [src:namu/Surviv.io] [M]
- D (namu.md): 원작 클라이언트 문자열과 fandom은 5개 지역(러시아는 survev가 2025-12에 추가) [src:fandom/Servers, derived/git-cc2b58c9] [M]
- proposed resolution: 5 regions for v0.8.82 (NA, SA, EU, AS, KR); Russia was added by survev in 2025-12 and is fork/optional [src:fandom/Servers] [src:derived/git-cc2b58c9] [L]
- files: `community-ko.md` (`ko-region-count`), `namu.md` (`namu-server-regions`) [src:derived/kb-crossref] [H]

> **Engine and netcode**

## process-per-game

- A: survev runs one OS process and one port per game [src:survev/server/src/game/gameProcessManager.ts:60-79] [H]
- B: the 0.8.82 client addresses games by `gameId` on a shared host [src:derived/survev@8715a605:client/js/app.js:107620-107632] [H]
- proposed resolution: either works; prefer one process hosting several games behind one port if hosting cost matters [src:derived/readme-precedence] [L]
- files: `engine/architecture.md` (`process-per-game`) [src:derived/kb-crossref] [H]

## tick-rate

- A (engine/architecture.md): survev's 100 Hz simulation / 33 Hz sync [src:survev/config.ts:40-41] [H]
- B (engine/architecture.md): no published original value [src:derived/survev@9f64948d:src/config.ts:30-31] [H]
- C (engine/netcode.md): survev sends 33 updates/s from a 100 Hz simulation [src:survev/config.ts:40-41] [H]
- D (engine/netcode.md): no original figure exists; survev's own first prototype used 30 tps [src:derived/survev@9f64948d:src/config.ts:30-31] [H]
- proposed resolution: rule 5: keep survev's 100 Hz simulation and 33 Hz snapshot rate as config knobs [src:survev/config.ts:40-41] [src:derived/readme-precedence] [L]
- files: `engine/architecture.md` (`tick-rate-origin`), `engine/netcode.md` (`net-tick-rate`) [src:derived/kb-crossref] [H]

## partial-type-byte

- A: 0.8.82 partial object records have no type byte [src:derived/survev@8715a605:client/js/app.js:43947-43956] [H]
- B: survev writes `type u8` before the id [src:survev/server/src/game/objects/gameObject.ts:218-221] [H]
- proposed resolution: follow 0.8.82 only if wire compatibility with the original/relaunch client matters, otherwise keep survev's safer form [src:derived/readme-precedence] [L]
- files: `engine/netcode.md` (`partial-type-byte`) [src:derived/kb-crossref] [H]

## join-auth

- A (engine/netcode.md): 0.8.82 Join carries API-signed `matchPriv`/`loadoutPriv`/`questPriv` strings [src:derived/survev@8715a605:client/js/app.js:43583-43615] [H]
- B (engine/netcode.md): survev carries one `joinToken` plus raw loadout ids [src:survev/shared/net/joinMsg.ts:18-37] [H]
- C (ui/menus.md): original sends `loadoutPriv`/`questPriv` tokens issued by the API in the JoinMsg [src:derived/survev@8715a605:client/js/app.js:43585-43614] [H]
- D (ui/menus.md): survev sends the loadout item ids directly and the server checks unlocks [src:survev/shared/net/joinMsg.ts:29-36] [H]
- proposed resolution: survev scheme (one join token plus raw loadout ids checked server-side); the signed `*Priv` tokens only matter for wire compatibility with the original/relaunch client [src:survev/shared/net/joinMsg.ts:18-37] [L]
- files: `engine/netcode.md` (`join-auth`), `ui/menus.md` (`loadout-transport`) [src:derived/kb-crossref] [H]

## client-interpolation

- A: 0.8.82 has no entity interpolation [src:derived/survev@8715a605:client/js/app.js:78929-78933] [H]
- B: survev interpolates by default [src:survev/client/src/config.ts:100] [H]
- proposed resolution: interpolation on as an optional setting (it does not change gameplay) [src:derived/readme-precedence] [L]
- files: `engine/netcode.md` (`client-interpolation`) [src:derived/kb-crossref] [H]

## bullet-fx-bits

- A: 0.8.82 bullet special-fx has 5 flags and no modifier block [src:derived/survev@8715a605:client/js/app.js:44058-44072] [H]
- B: survev 8 flags + speed/distance multipliers [src:survev/shared/net/updateMsg.ts:393-409] [H]
- proposed resolution: 0.8.82 layout for the target, survev fields only with fork perks [src:derived/readme-precedence] [L]
- files: `engine/netcode.md` (`bullet-fx-bits`) [src:derived/kb-crossref] [H]

> **History**

## changelog-vs-news-dates

- A (history.md): changelog file dates 0.8.5 Oct 8, 2019, 0.6.8 Dec 13, 2018, 0.6.5 Nov 8, 2018, 0.6.4 Oct 29, 2018 [src:changelog/0.8.5] [src:changelog/0.6.8] [src:changelog/0.6.5] [src:changelog/0.6.4] [H]
- B (history.md): news-post dates Oct 7, Dec 12, Nov 9, Oct 30 [src:fandom/Changelog] [src:wikigg/Changelog] [M]
- C (modes/halloween.md): Oct 29, 2018 [src:changelog/0.6.4] [H]
- D (modes/halloween.md): Oct 30, 2018 [src:fandom/Changelog, wikigg/Halloween_mode] [M]
- proposed resolution: use the bundled changelog file date as the version date (e.g. 0.6.4 Oct 29, 2018) and treat the wiki news-post date as the event start [src:changelog/0.6.4] [src:derived/readme-precedence] [L]
- files: `history.md` (`changelog-vs-news-dates`), `modes/halloween.md` (`halloween-date-2018`) [src:derived/kb-crossref] [H]

## acquisition-announce-date

- A: December 5, 2019 [src:wp-en/Surviv.io] [src:fandom/Changelog] [M]
- B: December 6, 2019 [src:fandom/Kongregate_Acquisition] [M]
- proposed resolution: December 5, 2019 (press releases dated Dec 5) [src:derived/readme-precedence] [L]
- files: `history.md` (`acquisition-announce-date`) [src:derived/kb-crossref] [H]

## kong-full-ownership

- A: Kongregate full ownership March 19, 2020 [src:fandom/Changelog] [M]
- B: "around March 20, 2020" when Justin announced stepping away [src:fandom/Kongregate] [src:fandom/Developers] [M]
- proposed resolution: March 20, 2020 (dated Discord announcement) [src:derived/readme-precedence] [L]
- files: `history.md` (`kong-full-ownership`) [src:derived/kb-crossref] [H]

## server-close-date

- A: around March 2, 2023 [src:fandom/Changelog] [src:wp-en/Surviv.io] [M]
- B: around March 3, 2023 [src:fandom/Surviv.io] [M]
- proposed resolution: March 2, 2023 [src:derived/readme-precedence] [L]
- files: `history.md` (`server-close-date`) [src:derived/kb-crossref] [H]

## survev-launch-date

- A: survev's own changelog: 0.0.1 "First early access release" on August 17, 2024; wiki.gg agrees [src:survev/client/public/changelogRec.html:588-589] [src:wikigg/Changelog] [H]
- B: namu.wiki revisions say September or October 2024 [src:namu/Surviv.io] [M]
- C: fandom Surviv.io: survev.io "came into play on October 30, 2024" (namu.md attributed this to fandom Changelog; it is on the Surviv.io page) [src:fandom/Surviv.io] [M]
- proposed resolution: Aug 17, 2024 = first survev early-access build (two sources); Sep–Oct 2024 = when it became widely known [src:survev/client/public/changelogRec.html:588] [src:wikigg/Changelog] [M]
- files: `history.md` (`survev-launch-date`), `namu.md` (`namu-survev-launch-month`) [src:derived/kb-crossref] [H]

## relaunch-version-numbers

- A: the relaunch numbers its 2026 patches 0.9.0–0.9.3 [src:kong/relaunch-changelog], reusing numbers Kongregate already used in 2020 (0.9.0 Jan 13, 2020 to 0.9.3b Apr 27, 2020) [src:fandom/Changelog] [H]
- proposed resolution: always qualify as "relaunch 0.9.x" vs "2020 0.9.x" [src:derived/readme-precedence] [M]
- files: `history.md` (`relaunch-version-numbers`) [src:derived/kb-crossref] [H]

## survivr-pass-9-start

- A: Pass 9 started Nov 30, 2021 (1.9.0c) [src:fandom/Changelog] [M]
- B: December 1, 2021 [src:fandom/Survivr_Pass_9] [M]
- proposed resolution: Nov 30, 2021 US time [src:derived/readme-precedence] [L]
- files: `history.md` (`survivr-pass-9-start`) [src:derived/kb-crossref] [H]

## pass-4-version

- A: Survivr Pass 4 arrived in 0.9.8 (Sep 8, 2020) [src:fandom/Changelog] [M]
- B: "v0.9.6" on the pass page [src:fandom/Survivr_Pass_4] [M]
- proposed resolution: 0.9.8 [src:derived/readme-precedence] [L]
- files: `history.md` (`pass-4-version`) [src:derived/kb-crossref] [H]

## changelog-version-count

- A: the bundled changelog has 99 released versions, 0.0.1 (Oct. 6, 2017) to 0.8.82 (December 30, 2019) [src:survev/client/public/changelog.html:31-731] [H]
- B: an earlier, non-citable summary counted 98 versions [src:derived/prior-summary-not-citable] [L]
- proposed resolution: 99 (counted in the primary file) [src:survev/client/public/changelog.html:31-731] [H]
- files: `history.md` (`changelog-version-count`) [src:derived/kb-crossref] [H]

> **Items**

## vss-damage

- A (items/bullets.md): survev bullet_vss damage 24, speed 110, falloff 0.85 [src:survev/shared/defs/gameObjects/bulletDefs.ts:546-559] [H]
- B (items/bullets.md): balance.txt damage "24.5 [0.2.12]" [src:balance/39-43] [H]
- C (items/guns.md): survev bullet_vss damage 24 (wiki.gg infobox also 24) [src:survev/shared/defs/gameObjects/bulletDefs.ts:546-559] [src:wikigg/VSS] [H]
- D (items/guns.md): balance.txt and the wiki.gg history list 24.5 [src:balance/39-41] [src:wikigg/VSS] [H]
- E (provenance/balance-revert.md): balance.txt says VSS damage ends at 24.5 [src:balance/41] [H]
- F (provenance/balance-revert.md): `bullet_vss.damage` is 24 [src:survev/shared/defs/gameObjects/bulletDefs.ts:548] [H]
- proposed resolution: rule 1: original `bullet_vss` damage 22, speed 95, falloff 0.8; survev's 24 and balance.txt's 24.5 are both fork values [src:derived/survev@9f64948d:src/defs/bulletDefs.js:482-495] [H]
- files: `items/bullets.md` (`vss-bullet`), `items/guns.md` (`vss-damage`), `provenance/balance-revert.md` (`vss-damage-final`) [src:derived/kb-crossref] [H]

## fandom-range-speed-swap

- A (items/bullets.md): fandom infoboxes swap distance and speed for bullet_m1911 (80/88), bullet_ot38 (112/125), bullet_ots38 (115/135), bullet_colt45 (106/110) [src:fandom/M1911] [src:fandom/OT-38] [src:fandom/OTs-38] [src:fandom/Peacemaker] [M]
- B (items/bullets.md): defs that list `speed` before `distance` [src:derived/survev@9f64948d:src/defs/bulletDefs.js:324-376] [H]
- C (items/guns.md): fandom infoboxes for M1911, OT-38, OTs-38 and Peacemaker swap bullet range and speed (e.g. M1911 range 80 / speed 88) [src:fandom/M1911] [src:fandom/OT-38] [src:fandom/OTs-38] [src:fandom/Peacemaker] [M]
- D (items/guns.md): original defs distance 88 / speed 80 etc. [src:derived/survev@9f64948d:src/defs/bulletDefs.js:324-376] [H]
- proposed resolution: rule 1: trust the original defs (`speed` is listed before `distance`) [src:derived/survev@9f64948d:src/defs/bulletDefs.js:324-376] [M]
- files: `items/bullets.md` (`fandom-bullet-range-speed`), `items/guns.md` (`fandom-range-speed-swap`) [src:derived/kb-crossref] [H]

## fandom-stat-typos

- A (items/bullets.md): fandom VSS bullet speed 94 [src:fandom/VSS] [M]
- B (items/bullets.md): original 95 [src:derived/survev@9f64948d:src/defs/bulletDefs.js:482-495] [H]
- C (items/bullets.md): fandom Mk 20 SSR obstacle multiplier 1 [src:fandom/Mk_20_SSR] [M]
- D (items/bullets.md): def 1.5 [src:derived/survev@9f64948d:src/defs/bulletDefs.js:153-166] [H]
- E (items/guns.md): fandom L86A2 moveSpread 3, OT-38 shotSpread 1.5, OTs-38 moveSpread 3, VSS speed 94, Mk 20 SSR obstacleDamage 1 and quality 0, Dual Flare Gun quality 1, M9 Cursed ammoSpawnCount 45, UMP9 bulletCount 3 [src:fandom/L86A2] [src:fandom/OT-38] [src:fandom/OTs-38] [src:fandom/VSS] [src:fandom/Mk_20_SSR] [src:fandom/Flare_Gun] [src:fandom/M9_Cursed] [src:fandom/UMP9] [M]
- F (items/guns.md): original defs 3.5, 1.25, 2.4, 95, 1.5 and 1, 0, 0, 1 [src:derived/survev@9f64948d:src/defs/gunDefs.js:1-3250] [src:kong/relaunch-client-defs] [H]
- G (items/guns.md): more fandom infobox values that differ from the original client: AWM-S reloadTime 3.5 (orig 3.6), Bugle reloadTime 0.1 (orig 0.01) and obstacle multiplier 0, BAR barrelLength 3.75 (orig 3.7), FAMAS barrelLength 2.95 (orig 3.1), Dual DEagle barrelLength 1.855 (orig 2.4), Mk 20 SSR barrelLength 3.35 (orig 3.9), OT-38 tracerWidth 0.1 (orig 0.09), M9 Cursed tracerWidth 1 / tracerLength 7 (orig 0.1 / 0.7) [src:fandom/AWM-S] [src:fandom/Bugle] [src:fandom/BAR_M1918] [src:fandom/FAMAS] [src:fandom/DEagle_50] [src:fandom/Mk_20_SSR] [src:fandom/OT-38] [src:fandom/M9_Cursed] [M]
- H (items/guns.md): [src:derived/survev@9f64948d:src/defs/gunDefs.js:1-3250] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:1-836] [src:kong/relaunch-client-defs] [H]
- proposed resolution: rule 1: trust the original client defs for every listed stat [src:derived/survev@9f64948d:src/defs/gunDefs.js:1-3250] [src:kong/relaunch-client-defs] [M]
- files: `items/bullets.md` (`vss-speed-fandom`), `items/bullets.md` (`scarssr-obstacle-fandom`), `items/guns.md` (`fandom-stat-typos`), `items/guns.md` (`fandom-stat-typos-2`) [src:derived/kb-crossref] [H]

## shotgun-distadj

- A: survev gives shotgun pellets and USAS frag rounds no distance jitter (`noDistAdj`, a field added in survev 4ec08611; the code comment says pellets already get positional jitter) [src:survev/server/src/game/objects/bullet.ts:220-229] [src:derived/survev-git-4ec08611] [H]
- B: original defs, which have no such flag, while the original client applies whatever `distAdjIdx` the server sends [src:derived/survev@9f64948d:src/defs/bulletDefs.js:206-271] [src:derived/survev@8715a605:client/js/app.js:106465] [H]
- proposed resolution: keep the survev behaviour as a knob. The original server's choice is not visible in client data [src:derived/readme-precedence] [L]
- files: `items/bullets.md` (`shotgun-distadj`) [src:derived/kb-crossref] [H]

## m870-range-namu

- A (items/bullets.md): namu M870 range 29 [src:namu/Surviv.io/무기] [M]
- B (items/bullets.md): bullet_buckshot distance 27 [src:derived/survev@9f64948d:src/defs/bulletDefs.js:206-218] [H]
- C (items/guns.md): namu lists M870 range 29 [src:namu/Surviv.io/무기] [M]
- proposed resolution: rule 1: 27 (namu probably shows the value from before the 0.4.3 range cut) [src:derived/survev@9f64948d:src/defs/bulletDefs.js:206-218] [L]
- files: `items/bullets.md` (`m870-range-namu`), `items/guns.md` (`m870-range-namu`) [src:derived/kb-crossref] [H]

## cosmetic-flag-israel

- A: `emote_flagisrael` is an original emote in the default unlock list [src:derived/survev@9f64948d:src/defs/unlockDefs.js:5] [src:kong/relaunch-client-defs] [H]
- B: survev having removed it [src:derived/survev-git-663bdd6e] [H]
- proposed resolution: keep it for the v0.8.82 target [src:derived/readme-precedence] [H]
- files: `items/cosmetics.md` (`cosmetic-flag-israel`) [src:derived/kb-crossref] [H]

## cosmetic-outfit-tree-id

- A: original id `outfitTree` [src:derived/survev@9f64948d:src/defs/outfitDefs.js:914] [H]
- B: survev `outfitHalloweenTree` with the same def [src:survev/shared/defs/gameObjects/outfitDefs.ts:1357] [H]
- proposed resolution: use `outfitTree` [src:derived/readme-precedence] [H]
- files: `items/cosmetics.md` (`cosmetic-outfit-tree-id`) [src:derived/kb-crossref] [H]

## cosmetic-faction-outfit-teamid

- A: original outfits have no faction restriction [src:derived/survev@9f64948d:src/defs/outfitDefs.js:1-1060] [H]
- B: fork `teamId` pickup restriction [src:derived/survev-git-4648cc17] [H]
- proposed resolution: no restriction [src:derived/readme-precedence] [H]
- files: `items/cosmetics.md` (`cosmetic-faction-outfit-teamid`) [src:derived/kb-crossref] [H]

## cosmetic-default-unlocks

- A: 15 default crosshairs and 134 emotes [src:derived/survev@9f64948d:src/defs/unlockDefs.js:5] [H]
- B: survev 30 and 152 [src:survev/shared/defs/gameObjects/unlockDefs.ts:10-201] [H]
- proposed resolution: original list (accounts are out of scope anyway) [src:derived/readme-precedence] [M]
- files: `items/cosmetics.md` (`cosmetic-default-unlocks`) [src:derived/kb-crossref] [H]

## cosmetic-quest-targets

- A: original ammo-damage 250, grenade 100, melee 150 [src:derived/survev@9f64948d:src/defs/questDefs.js:1-151] [H]
- B: fork 350 / 200 / 250 [src:survev/shared/defs/gameObjects/questDefs.ts:254-550] [H]
- proposed resolution: original values [src:derived/readme-precedence] [H]
- files: `items/cosmetics.md` (`cosmetic-quest-targets`) [src:derived/kb-crossref] [H]

## halloween-ghillie

- A (items/cosmetics.md): Halloween Ghillie colour 0x212404 in the relaunch client [src:kong/relaunch-client-defs] [H]
- B (items/cosmetics.md): survev inheriting main's 0x83af50 [src:survev/shared/defs/maps/halloweenDefs.ts:84-94] [H]
- C (modes/halloween.md): playerGhillie 0x212404 [src:kong/relaunch-client-defs] [H]
- D (modes/halloween.md): survev inherits 0x83af50 [src:survev/shared/defs/maps/halloweenDefs.ts:85-94] [H]
- proposed resolution: rule 1: `playerGhillie` 0x212404 [src:kong/relaunch-client-defs] [H]
- files: `items/cosmetics.md` (`cosmetic-ghillie-halloween`), `modes/halloween.md` (`halloween-ghillie`) [src:derived/kb-crossref] [H]

## cosmetic-ghillie-woods

- A: fandom says the Woods-map Ghillie keeps the normal-map colour [src:fandom/Ghillie_Suit] [M]
- B: 0x91852c in both survev and the relaunch client [src:survev/shared/defs/maps/woodsDefs.ts:33] [src:kong/relaunch-client-defs] [H]
- proposed resolution: 0x91852c (client defs win) [src:derived/readme-precedence] [M]
- files: `items/cosmetics.md` (`cosmetic-ghillie-woods`) [src:derived/kb-crossref] [H]

## cosmetic-fragtastic-drop

- A: Fragtastic was a Pass 3 loadout skin that did not drop on death [src:fandom/Fragtastic] [M]
- B: survev world loot `tier_fragtastic` without `noDropOnDeath` [src:survev/shared/defs/maps/baseDefs.ts:198-201] [H]
- proposed resolution: post-0.8.82, leave out of the v0.8.82 target [src:derived/readme-precedence] [M]
- files: `items/cosmetics.md` (`cosmetic-fragtastic-drop`) [src:derived/kb-crossref] [H]

## cosmetic-pass1-quest-count

- A: fandom says Pass 1 had 26 quests [src:fandom/Survivr_Pass_1] [M]
- B: 24 in the client defs (25 with Top 8 in Duos) [src:derived/survev@9f64948d:src/defs/questDefs.js:1-151] [src:fandom/Quests] [H]
- proposed resolution: 25 [src:derived/readme-precedence] [L]
- files: `items/cosmetics.md` (`cosmetic-pass1-quest-count`) [src:derived/kb-crossref] [H]

## 50ae-capacity

- A: original 49/98/147/196 [src:derived/survev@9f64948d:src/gameConfig.ts:265] [src:fandom/.50_AE] [H]
- B: survev 50/100/150/200/250 [src:survev/shared/gameConfig.ts:420] [H]
- proposed resolution: 49/98/147/196 [src:derived/readme-precedence] [H]
- files: `items/gear.md` (`50ae-capacity`) [src:derived/kb-crossref] [H]

## bandage-heal-wording

- A: fandom says bandages heal "15% of a player's health" [src:fandom/Bandage] [M]
- B: flat +15 HP [src:derived/survev@9f64948d:src/defs/gearDefs.js:139-161] [H]
- proposed resolution: flat 15 HP (max health is 100, so equal) [src:derived/readme-precedence] [H]
- files: `items/gear.md` (`bandage-heal-wording`) [src:derived/kb-crossref] [H]

## 15x-scope-level-fandom

- A: fandom infobox gives the 15x scope `level` 8 [src:fandom/Scopes] [M]
- B: def level 15 [src:derived/survev@9f64948d:src/defs/gearDefs.js:526-541] [H]
- proposed resolution: 15 [src:derived/readme-precedence] [H]
- files: `items/gear.md` (`15x-scope-level-fandom`) [src:derived/kb-crossref] [H]

## leader-helmet-name

- A: def `name` "Leader Helmet" [src:survev/shared/defs/gameObjects/gearDefs.ts:674-682] [H]
- B: displayed "Commander Helmet" [src:survev/client/src/en.json:406] [H]
- proposed resolution: display l10n [src:derived/readme-precedence] [H]
- files: `items/gear.md` (`leader-helmet-name`) [src:derived/kb-crossref] [H]

## lone-survivr-helmet-id

- A: fandom gives the Lone Survivr helmets the internal ids `helmet04_last_man_01` / `_02` [src:fandom/Helmets] [M]
- B: defs `helmet04_last_man_red` / `helmet04_last_man_blue` [src:derived/survev@9f64948d:src/defs/gearDefs.js:707-738] [src:kong/relaunch-client-defs] [H]
- proposed resolution: def ids (fandom used the sprite names) [src:derived/readme-precedence] [H]
- files: `items/gear.md` (`lone-survivr-helmet-id`) [src:derived/kb-crossref] [H]

## leader-helmet-aged

- A: fandom calls `helmet03_leader` "Commander Helmet (Aged)" with Leadership and the Commander role [src:fandom/Helmets] [M]
- B: a def with no perk, role or spawner [src:derived/survev@9f64948d:src/defs/gearDefs.js:544-552] [src:kong/relaunch-client-defs] [H]
- proposed resolution: keep it as an unused plain level-3 skin [src:derived/readme-precedence] [M]
- files: `items/gear.md` (`leader-helmet-aged`) [src:derived/kb-crossref] [H]

## lone-survivr-helmet-level

- A: fandom infobox lists the Lone Survivr helmets as level 3 with 0.7 reduction [src:fandom/Helmets] [M]
- B: defs level 4, 0.7 [src:derived/survev@9f64948d:src/defs/gearDefs.js:707-738] [H]
- proposed resolution: level 4 [src:derived/readme-precedence] [H]
- files: `items/gear.md` (`lone-survivr-helmet-level`) [src:derived/kb-crossref] [H]

## mkg45-headshot

- A (items/guns.md): survev headshotMult 1.75 [src:survev/shared/defs/gameObjects/gunDefs.ts:1364-1410] [H]
- B (items/guns.md): balance.txt 1.5 after 0.4.3 [src:balance/74-78] [H]
- C (items/guns.md): fandom Mk45G infobox and damage table 1.5 [src:fandom/Mk45G] [M]
- D (items/guns.md): original client 2, which fandom's own Headshot page also implies ("every other weapon … 2x") [src:derived/survev@9f64948d:src/defs/gunDefs.js:1224-1270] [src:kong/relaunch-client-defs] [src:fandom/Headshot] [H]
- E (provenance/balance-revert.md): balance.txt says the Mk45G headshotMult went to 1.5 in 0.4.3 [src:balance/78] [H]
- F (provenance/balance-revert.md): `mkg45.headshotMult` is 1.75 [src:survev/shared/defs/gameObjects/gunDefs.ts:1386] [H]
- proposed resolution: rule 1: original `headshotMult` 2 (original client and relaunch); 1.5 and 1.75 are fork values [src:derived/survev@9f64948d:src/defs/gunDefs.js:1224-1270] [src:kong/relaunch-client-defs] [H]
- files: `items/guns.md` (`mkg45-headshot`), `provenance/balance-revert.md` (`mkg45-headshot-final`) [src:derived/kb-crossref] [H]

## m9-movespread

- A (items/guns.md): survev m9_dual moveSpread 3.5 [src:survev/shared/defs/gameObjects/gunDefs.ts:2206-2255] [H]
- B (items/guns.md): balance.txt and wiki.gg 5.5 [src:balance/22-24] [src:wikigg/M9] [H]
- C (items/guns.md): survev m9_cursed moveSpread 3 [src:survev/shared/defs/gameObjects/gunDefs.ts:2256-2306] [H]
- D (items/guns.md): balance.txt "M9 + Cursed … -> 5" [src:balance/9-15] [H]
- E (provenance/balance-revert.md): balance.txt says Dual M9 moveSpread ends at 5.5 and the cursed M9 follows the M9 to 5 [src:balance/13, balance/22] [H]
- F (provenance/balance-revert.md): the code still has 3.5 (`m9_dual`) and 3 (`m9_cursed`) [src:survev/shared/defs/gameObjects/gunDefs.ts:2227, survev/shared/defs/gameObjects/gunDefs.ts:2278] [H]
- proposed resolution: rule 1: original `moveSpread` 9 for `m9_dual` and 8 for `m9_cursed`; balance.txt's 5.5 / 5 and the code's 3.5 / 3 are fork values [src:derived/survev@9f64948d:src/defs/gunDefs.js:2017-2118] [H]
- files: `items/guns.md` (`m9-dual-movespread`), `items/guns.md` (`m9-cursed-movespread`), `provenance/balance-revert.md` (`m9-dual-and-cursed-spread`) [src:derived/kb-crossref] [H]

## headshot-mult-1-rule

- A (items/guns.md): survev rolls headshots for every gun def that has `headshotMult`, so a 1× AWM-S headshot still skips vest reduction [src:survev/server/src/game/objects/player.ts:2459-2485] [H]
- B (items/guns.md): wikis saying 1× guns (AWM-S, Potato Cannon) never headshot, and balance.txt logging AWM-S headshotMult as "N/A -> 1" although the original client def already has 1 [src:fandom/Headshot] [src:wikigg/Guns] [src:balance/95-96] [src:derived/survev@9f64948d:src/defs/gunDefs.js:1451] [src:kong/relaunch-client-defs] [M]
- C (mechanics/damage-armor.md): survev rolls headshots for any gun with `headshotMult` [src:survev/server/src/game/objects/player.ts:2462] [H]
- D (mechanics/damage-armor.md): original/early-survev rule of `headshotMult > 1` only, with fandom listing AWM-S, Potato Cannon and melee as never headshotting [src:balance/95-96] [src:fandom/Headshot] [H]
- proposed resolution: roll headshots only when `headshotMult` > 1 (original/early-survev rule, matching the wikis), as a config knob [src:fandom/Headshot] [src:balance/95-96] [M]
- files: `items/guns.md` (`awc-headshot-roll`), `mechanics/damage-armor.md` (`headshot-mult-1-rule`) [src:derived/kb-crossref] [H]

## scarssr-name

- A: def `name` "SCAR-SSR" [src:survev/shared/defs/gameObjects/gunDefs.ts:918-964] [H]
- B: displayed "Mk 20 SSR" [src:survev/client/src/en.json:672] [src:changelog/0.8.3] [H]
- proposed resolution: display "Mk 20 SSR" (UI reads l10n `game-<id>`) [src:survev/client/src/ui/ui2.ts:1194] [H]
- files: `items/guns.md` (`scarssr-name`) [src:derived/kb-crossref] [H]

## m1014-name

- A: def `name` "M1014" [src:survev/shared/defs/gameObjects/gunDefs.ts:2059-2106] [H]
- B: displayed "Super 90" [src:survev/client/src/en.json:629] [src:changelog/0.7.0] [H]
- proposed resolution: display "Super 90" [src:derived/readme-precedence] [H]
- files: `items/guns.md` (`m1014-name`) [src:derived/kb-crossref] [H]

## mk20-damage-fandom

- A: the fandom Mk 20 SSR infobox gives damage 81 (survev's fork value) [src:fandom/Mk_20_SSR] [src:balance/80-81] [M]
- B: 60 in the same page's strategy text and damage table and in the original client [src:fandom/Mk_20_SSR] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:153-166] [src:kong/relaunch-client-defs] [M]
- proposed resolution: 60 (the infobox was probably edited from survev data) [src:derived/readme-precedence] [M]
- files: `items/guns.md` (`mk20-damage-fandom`) [src:derived/kb-crossref] [H]

## fandom-spudgun-dmg

- A: fandom Spud Gun dmg 13 [src:fandom/Spud_Gun] [M]
- B: bullet_potato damage 0, because the damage comes from the `potato_smgshot` projectile [src:derived/survev@9f64948d:src/defs/bulletDefs.js:670-683] [H]
- proposed resolution: model the damage on the projectile (throwables docs) [src:derived/readme-precedence] [L]
- files: `items/guns.md` (`fandom-spudgun-dmg`) [src:derived/kb-crossref] [H]

## ump9-intro-date

- A: wiki.gg says the UMP9 came in 0.2.2 on "January 23th, 2019" [src:wikigg/UMP9] [M]
- B: changelog 0.2.2 dated Jan. 23, 2018 [src:changelog/0.2.2] [H]
- proposed resolution: 2018 [src:derived/readme-precedence] [M]
- files: `items/guns.md` (`ump9-intro-date`) [src:derived/kb-crossref] [H]

## garand-reload-namu

- A: namu lists M1 Garand reload 2 s [src:namu/Surviv.io/무기] [M]
- B: def 2.1 s [src:derived/survev@9f64948d:src/defs/gunDefs.js:1573-1620] [H]
- proposed resolution: 2.1 [src:derived/readme-precedence] [L]
- files: `items/guns.md` (`garand-reload-namu`) [src:derived/kb-crossref] [H]

## 50ae-name

- A: survev en name ".50 Caliber" [src:survev/client/src/en.json:391] [H]
- B: ".50 AE" in ko l10n and the original changelog [src:l10n/ko:game-50AE] [src:changelog/0.3.5] [H]
- proposed resolution: ".50 AE" for 0.8.82 [src:derived/readme-precedence] [M]
- files: `items/guns.md` (`50ae-name`) [src:derived/kb-crossref] [H]

## qbb97-quality

- A: original def has no `quality` [src:derived/survev@9f64948d:src/defs/gunDefs.js:630-679] [src:kong/relaunch-client-defs] and fandom lists quality 0 [src:fandom/QBB-97] [H]
- B: survev and wiki.gg quality 1 [src:survev/shared/defs/gameObjects/gunDefs.ts:720-772] [src:wikigg/QBB-97] [H]
- proposed resolution: omit (never chosen by Rare Potato) for 0.8.82 [src:derived/readme-precedence] [H]
- files: `items/guns.md` (`qbb97-quality`) [src:derived/kb-crossref] [H]

## reload-fire-cancel

- A: survev lets a shot cancel any reload when the clip still has rounds (`fireWeapon` → `cancelAction()`), and wiki.gg documents that [src:survev/server/src/game/weaponManager.ts:743] [src:wikigg/Guns] [H]
- B: the original 0.1.0 rule "Players can no longer shoot while reloading a magazine-fed gun", which the relaunch only lifted in 0.9.2 [src:changelog/0.1.0] [src:kong/relaunch-changelog] [H]
- proposed resolution: for 0.8.82 ignore fire input during a magazine reload (shell-by-shell reloads can still be interrupted), as a config knob [src:derived/readme-precedence] [M]
- files: `items/guns.md` (`reload-fire-cancel`) [src:derived/kb-crossref] [H]

## splinter-fsa-spread

- A: wikis say first-shot-accurate Splinter shots do not spread at all [src:fandom/First-Shot_Accuracy] [src:wikigg/Guns] [M]
- B: survev side-bullet deviation of at least 0.2° (`random(0.2, 0.25) × max(spread, 1)`) [src:survev/server/src/game/weaponManager.ts:971-1003] [H]
- proposed resolution: keep survev's formula (the gap is about 0.35 units at 100 units, so the bullets still hit together at normal ranges) [src:derived/readme-precedence] [L]
- files: `items/guns.md` (`splinter-fsa-spread`) [src:derived/kb-crossref] [H]

## wikigg-intro-dates

- A: wiki.gg intro dates: G18C (0.2.3) January 27, 2018; Vector 45, M1911 and M1A1 (0.6.5) November 9, 2018; M93R (0.6.0) September 7, 2019 [src:wikigg/G18C] [src:wikigg/Vector_45] [src:wikigg/M1911] [src:wikigg/M1A1] [src:wikigg/M93R] [M]
- B: original changelog: 0.2.3 Jan. 30, 2018; 0.6.5 Nov. 8, 2018; 0.6.0 Sep. 7, 2018 [src:changelog/0.2.3] [src:changelog/0.6.5] [src:changelog/0.6.0] [H]
- proposed resolution: use the changelog dates [src:changelog/0.2.3] [src:changelog/0.6.5] [src:changelog/0.6.0] [M]
- files: `items/guns.md` (`wikigg-intro-dates`) [src:derived/kb-crossref] [H]

## melee-headshot-roll

- A: original defs give every melee `headshotMult: 1`, which under survev's current damage code would roll 15 % headshots that skip vest reduction [src:derived/survev@9f64948d:src/defs/meleeDefs.js:18] [src:survev/server/src/game/objects/player.ts:2459-2490] [H]
- B: survev (and earlier survev code) never rolling headshots for melee, and wikis saying melee has no headshots [src:derived/survev-git-513c60d2] [src:fandom/Melee_weapons] [src:namu/Surviv.io/무기] [H]
- proposed resolution: melee never headshots (chest + 0.3 × helmet always), keep as config knob [src:derived/readme-precedence] [M]
- files: `items/melee.md` (`melee-headshot-roll`) [src:derived/kb-crossref] [H]

## fireaxe-cooldown

- A: fandom infobox 0.4 s [src:fandom/Fire_Axe] [M]
- B: def 0.42 s [src:derived/survev@9f64948d:src/defs/meleeDefs.js:493-548] [H]
- proposed resolution: 0.42 [src:derived/readme-precedence] [H]
- files: `items/melee.md` (`fireaxe-cooldown`) [src:derived/kb-crossref] [H]

## stonehammer-rad

- A: fandom infobox rad 1 [src:fandom/Stone_Hammer] [M]
- B: def 1.25 [src:derived/survev@9f64948d:src/defs/meleeDefs.js:663-719] [src:wikigg/Hammers] [H]
- proposed resolution: 1.25 [src:derived/readme-precedence] [H]
- files: `items/melee.md` (`stonehammer-rad`) [src:derived/kb-crossref] [H]

## crowbar-hitbox

- A: fandom infobox offset 1.5, rad 1.75, cleave true [src:fandom/Crowbar] [M]
- B: def offset 1.25, rad 1.25, cleave false [src:derived/survev@9f64948d:src/defs/meleeDefs.js:918-974] [src:wikigg/Crowbar] [H]
- proposed resolution: trust the def [src:derived/readme-precedence] [H]
- files: `items/melee.md` (`crowbar-hitbox`) [src:derived/kb-crossref] [H]

## woodaxe-attack-speed

- A: fandom infobox attackSpeed 1 [src:fandom/Wood_Axe] [M]
- B: def with no `speed.attack` [src:derived/survev@9f64948d:src/defs/meleeDefs.js:437-492] [H]
- proposed resolution: no attack speed modifier [src:derived/readme-precedence] [H]
- files: `items/melee.md` (`woodaxe-attack-speed`) [src:derived/kb-crossref] [H]

## fandom-melee-rarity

- A: fandom rarity knuckles_rusted 1, knuckles_heroic 4, bayonet_woodland 5 [src:fandom/Knuckles] [src:fandom/Bayonet] [M]
- B: defs 2, 3, 4 [src:derived/survev@9f64948d:src/defs/meleeDefs.js:981-1063] [H]
- proposed resolution: trust the defs [src:derived/readme-precedence] [M]
- files: `items/melee.md` (`fandom-melee-rarity`) [src:derived/kb-crossref] [H]

## knife-nerf-version

- A: fandom says knives returned to 24 damage in 0.7.5 [src:fandom/Fists] [M]
- B: the 0.7.5 changelog, which lists no melee change [src:changelog/0.7.5] [H]
- proposed resolution: date unknown, 24 is the 0.8.82 value either way [src:derived/readme-precedence] [L]
- files: `items/melee.md` (`knife-nerf-version`) [src:derived/kb-crossref] [H]

## machete-name

- A: def `name` "UVSR Taiga" (fandom transcribes "USVR Taiga") [src:survev/shared/defs/gameObjects/meleeDefs.ts:1299-1306] [src:fandom/Machete] [H]
- B: displayed "Machete Taiga" [src:survev/client/src/en.json:566] [H]
- proposed resolution: display l10n "Machete Taiga" [src:derived/readme-precedence] [H]
- files: `items/melee.md` (`machete-name`) [src:derived/kb-crossref] [H]

## woodaxe-bloody-name

- A: def `name` "Axe Bloodstained" [src:survev/shared/defs/gameObjects/meleeDefs.ts:1326-1334] [H]
- B: displayed "Wood Axe Bloodstained" [src:survev/client/src/en.json:554] [H]
- proposed resolution: display l10n [src:derived/readme-precedence] [H]
- files: `items/melee.md` (`woodaxe-bloody-name`) [src:derived/kb-crossref] [H]

## crowbar-sprite

- A: decompiled first commit gives `crowbar` and `crowbar_scout` the sprite `loot-melee-crowbar-recon.img` [src:derived/survev@9f64948d:src/defs/meleeDefs.js:918-974] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:1165-1168] [H]
- B: the relaunch bundle's `loot-melee-crowbar-scout.img`, matching fandom's note that 0.8.81 renamed the Scouting Crowbar sprite to `-scout` [src:kong/relaunch-client-defs] [src:fandom/Crowbar] [H]
- proposed resolution: `loot-melee-crowbar-scout.img` for both [src:derived/readme-precedence] [M]
- files: `items/melee.md` (`crowbar-sprite`) [src:derived/kb-crossref] [H]

## bowie-frontier-ko

- A: ko l10n gives Bowie Frontier the same string as Bowie Vintage ("빈티지 보이 나이프") [src:l10n/ko:game-bowie_frontier] [src:l10n/ko:game-bowie_vintage] [H]
- proposed resolution: keep the official string, flag as translation bug [src:derived/readme-precedence] [M]
- files: `items/melee.md` (`bowie-frontier-ko`) [src:derived/kb-crossref] [H]

## perk-splinter-side-damage

- A: side bullets 0.6 × 0.45 = 27 % each in v0.8.82 [src:fandom/Splinter_Rounds] [M]
- B: survev `splitsDamageMult` 0.5 (30 %) since fork commit e55e094e [src:survev/shared/defs/gameObjects/perkDefs.ts:37-40] [H]
- proposed resolution: 0.45 for the target era, 0.5 behind a fork flag [src:derived/readme-precedence] [L]
- in the game since the survev content wave's stage 5 (survev balance, design option B): survev's 0.5 (`rules.perks.splinterSideDamageMult`) [src:derived/readme-precedence] [H]
- files: `items/perks.md` (`perk-splinter-side-damage`) [src:derived/kb-crossref] [H]

## steelskin-reduction

- A (items/perks.md): 50 % [src:fandom/Cast_Ironskin] [M]
- B (items/perks.md): survev 45 % (fork 0.1.2 → 40 %, 0.1.21 → 45 %) [src:balance/138-141] [H]
- C (mechanics/damage-armor.md): 0.45 [src:survev/shared/defs/gameObjects/perkDefs.ts:15] [H]
- D (mechanics/damage-armor.md): 0.5 in 0.8.8 [src:fandom/Cast_Ironskin] [src:wikigg/Cast_Ironskin] [src:balance/138-141] [M]
- proposed resolution: 0.5 (fandom, wiki.gg and survev's first value); 0.4 / 0.45 are fork values [src:fandom/Cast_Ironskin] [src:balance/138-141] [H]
- in the game since the survev content wave's stage 5 (survev balance, design option B): survev's 0.45 (`rules.steelskinReduction`) [src:derived/readme-precedence] [H]
- files: `items/perks.md` (`perk-steelskin-reduction`), `mechanics/damage-armor.md` (`steelskin-reduction`) [src:derived/kb-crossref] [H]

## gotw-values

- A (items/perks.md): +25 % size, 1 HP/s [src:fandom/Gift_of_the_Woods] [M]
- B (items/perks.md): survev scale 0.2, 1 HP/s (survev first had 0.25 and 0.5 HP/s) [src:survev/shared/defs/gameObjects/perkDefs.ts:81-84] [src:derived/survev-git-fddf75b8] [H]
- C (mechanics/heal-actions.md): Gift of the Woods regenerates 1 HP/s, a fork value; it was 0.5 HP/s (survev's tier-1 boost rate) until fork v0.2.2 [src:survev/shared/defs/gameObjects/perkDefs.ts:81-84] [src:derived/survev-git-fddf75b8] [src:wikigg/Gift_of_the_Woods] [H]
- D (mechanics/heal-actions.md): 1 HP/s, "the exact same as 25 % Adrenaline" [src:fandom/Gift_of_the_Woods] [M]
- proposed resolution: size scale +0.25 (fandom, survev's first value); regen tied to the tier-1 boost heal rate (1 HP/s with fandom's boost table, 0.5 with survev's) behind a knob [src:fandom/Gift_of_the_Woods] [src:derived/survev-git-fddf75b8] [L]
- in the game since the survev content wave's stage 5 (survev balance, design option B): survev's scale +0.2 and 1 HP/s regeneration (`rules.perks.gotwRegenRate`) [src:derived/readme-precedence] [H]
- files: `items/perks.md` (`perk-gotw-values`), `mechanics/heal-actions.md` (`gotw-regen`) [src:derived/kb-crossref] [H]

## flak-size

- A (items/perks.md): balance.txt calls 0.2 → 0.1 a fork change [src:balance/135-136] [H]
- B (items/perks.md): fandom saying v0.8.8 gave Flak Jacket +10 % size [src:fandom/Flak_Jacket] [M]
- C (mechanics/damage-armor.md): scale +0.1 [src:survev/shared/defs/gameObjects/perkDefs.ts:18] [H]
- D (mechanics/damage-armor.md): +20 % in 0.8.8 [src:wikigg/Flak_Jacket] [src:balance/135-136] [M]
- E (mechanics/damage-armor.md): +10 %, which fandom's history table also gives for 0.8.8 [src:fandom/Player] [src:fandom/Flak_Jacket] [M]
- proposed resolution: rule 2 after the balance revert: scale +0.2 (survev's pre-fork value, wiki.gg's 0.8.8 note and namu's "about 20 %"), as a knob; fandom's +10 % is logged [src:balance/135-136] [src:wikigg/Flak_Jacket] [L]
- in the game since the survev content wave's stage 5 (survev balance, design option B): survev's scale +0.1 plus +3 frags and +2 MIRVs of bag room (`rules.perks`) [src:derived/readme-precedence] [H]
- note: `items/perks.md` proposed 0.1 and `mechanics/damage-armor.md` 0.2; this entry picks 0.2 [src:derived/kb-crossref] [L]
- files: `items/perks.md` (`perk-flak-scale`), `mechanics/damage-armor.md` (`flak-size`) [src:derived/kb-crossref] [H]

## flak-explosion-reduction

- A: fandom: Flak Jacket gives a 10 % general reduction plus an additional 90 % against explosions, 91 % total [src:fandom/Flak_Jacket] [M]
- B: survev applies only the 0.9 explosion reduction to explosions (the 0.1 general reduction only to other hits) [src:survev/server/src/game/objects/player.ts:2470-2476] [src:survev/shared/defs/gameObjects/perkDefs.ts:17] [H]
- C: namu.wiki: explosion damage −80 % (other revisions 80–90 %) [src:namu/Surviv.io/이벤트] [M]
- proposed resolution: explosion reduction 0.9 stacked with the general 0.1 (91 % total, as fandom states) behind a knob; namu's 80 % is not supported by any def [src:fandom/Flak_Jacket] [src:survev/shared/defs/gameObjects/perkDefs.ts:17] [L]
- files: `items/perks.md` (`perk-flak-explosion-reduction`), `namu.md` (`namu-flak-jacket-reduction`) [src:derived/kb-crossref] [H]

## perk-flak-capacity

- A: no extra grenade capacity in v0.8.82 [src:derived/survev@a14ab228:client/l10n/en.json:654] [H]
- B: fork +3 frag / +2 MIRV [src:balance/299] [H]
- proposed resolution: no bonus (fork flag) [src:derived/readme-precedence] [M]
- files: `items/perks.md` (`perk-flak-capacity`) [src:derived/kb-crossref] [H]

## ammo-perk-mult

- A (items/perks.md): 8 % [src:fandom/Candy_Corn] [src:fandom/.45_In_The_Chamber] [M]
- B (items/perks.md): survev 1.12 since fork 0.4.2 [src:balance/336] [H]
- C (mechanics/damage-armor.md): ammo perks ×1.12 [src:survev/shared/defs/gameObjects/perkDefs.ts:165] [H]
- D (mechanics/damage-armor.md): 8 % [src:fandom/Last_Breath] [src:balance/336] [M]
- proposed resolution: 1.08 (fandom + balance.txt's original value); 1.12 is fork 0.4.2 [src:fandom/Candy_Corn] [src:balance/336] [H]
- in the game since the survev content wave's stage 5 (survev balance, design option B): survev's x1.12 per ammo perk, x1.08 Hollow-points / OKAMI Bar (`rules.perks`) [src:derived/readme-precedence] [H]
- files: `items/perks.md` (`perk-ammo-bonus-mult`), `mechanics/damage-armor.md` (`ammo-perk-mult`) [src:derived/kb-crossref] [H]

## ammo-bonus-stacking

- A (items/perks.md): ammo-specific bonuses do not stack with each other or with Hollow-points/OKAMI Bar, and Last Breath's 8 % does not stack with them either [src:fandom/Perks] [src:fandom/Last_Breath] [M]
- B (items/perks.md): survev multiplying Last Breath, every matching ammo perk and the 1.08 all-ammo bonus [src:survev/server/src/game/weaponManager.ts:692-716] [H]
- C (mechanics/damage-armor.md): survev multiplies Last Breath's ×1.08 with the ammo-perk bonus and with Hollow-points' ×1.08 [src:survev/server/src/game/weaponManager.ts:692-715] [H]
- D (mechanics/damage-armor.md): "does not stack with other ammo-specific damage bonuses like Hollow-points or 9mm Overpressure" [src:fandom/Last_Breath] [src:wikigg/Last_Breath] [M]
- proposed resolution: apply at most one 8 % bonus per bullet (take the larger), survev's multiplication behind a knob [src:fandom/Last_Breath] [src:fandom/Perks] [M]
- in the game since the survev content wave's stage 5 (survev balance, design option B): survev's multiplication (`rules.perks.ammoBonusStacking` true) [src:derived/readme-precedence] [H]
- files: `items/perks.md` (`perk-ammo-bonus-stacking`), `mechanics/damage-armor.md` (`last-breath-ammo-stack`) [src:derived/kb-crossref] [H]

## perk-9mm-overpressure-speed

- A: speed and range +25 % [src:fandom/9mm_Overpressure] [M]
- B: survev × 1.2 since fork 0.4.2 [src:balance/335] [H]
- proposed resolution: 1.25 [src:derived/readme-precedence] [M]
- in the game since the survev content wave's stage 5 (survev balance, design option B): survev's 1.2 (`rules.perks.bonus9mm*`) [src:derived/readme-precedence] [H]
- files: `items/perks.md` (`perk-9mm-overpressure-speed`) [src:derived/kb-crossref] [H]

## perk-bonus45-empowered

- A: plain +8 % in v0.8.82 [src:fandom/.45_In_The_Chamber] [src:derived/survev@a14ab228:client/l10n/en.json:644] [M]
- B: fork 1/6 empowered bullets [src:balance/334] [H]
- proposed resolution: no empowered bullets [src:derived/readme-precedence] [H]
- files: `items/perks.md` (`perk-bonus45-empowered`) [src:derived/kb-crossref] [H]

## perk-hollow-points-speed

- A: damage only [src:derived/survev@a14ab228:client/l10n/en.json:658] [src:fandom/Hollow-points] [H]
- B: fork × 1.1 bullet speed [src:balance/325] [H]
- proposed resolution: damage only [src:derived/readme-precedence] [H]
- files: `items/perks.md` (`perk-hollow-points-speed`) [src:derived/kb-crossref] [H]

## perk-fabricate-rule

- A: max frag grenades every 12 s [src:fandom/Fabricate] [M]
- B: fork 8 random explosives (frag 60 / MIRV 35 / strobe 5) every 10 s [src:balance/316] [H]
- proposed resolution: refill frags to capacity every 12 s [src:derived/readme-precedence] [M]
- in the game since the survev content wave's stage 5 (survev balance, design option B): survev's 8 weighted explosives every 10 s (`rules.perks.fabricate`) [src:derived/readme-precedence] [H]
- files: `items/perks.md` (`perk-fabricate-rule`) [src:derived/kb-crossref] [H]

## field-medic-speed

- A (items/perks.md): no slowdown while healing (no bonus mentioned) [src:fandom/Perks] [src:fandom/Combat_Medic] [M]
- B (items/perks.md): survev also adding +1 speed (first +1.5) [src:survev/shared/defs/gameObjects/perkDefs.ts:94-96] [H]
- C (mechanics/movement.md): survev +1 while using items (fork-tuned, was 1.5) [src:survev/shared/defs/gameObjects/perkDefs.ts:95] [H]
- D (mechanics/movement.md): fandom "you can move faster than you could with adrenaline" [src:fandom/Combat_Medic] [M]
- proposed resolution: remove the healing slowdown; the extra +1 speed is a knob (original value unknown) [src:fandom/Combat_Medic] [src:survev/shared/defs/gameObjects/perkDefs.ts:94-96] [L]
- files: `items/perks.md` (`perk-field-medic-speed`), `mechanics/movement.md` (`field-medic-speed`) [src:derived/kb-crossref] [H]

## perk-windwalk-duration

- A: 3 s [src:fandom/Windwalk] [M]
- B: 4 s on the fandom Perks list [src:fandom/Perks] [M]
- proposed resolution: 3 s, as survev uses [src:survev/shared/defs/gameObjects/perkDefs.ts:77-80] [L]
- files: `items/perks.md` (`perk-windwalk-duration`) [src:derived/kb-crossref] [H]

## last-breath-duration

- A (items/perks.md): 6 s speed boost [src:fandom/Last_Breath] [M]
- B (items/perks.md): survev 5 s haste and 5 s damage/size buff [src:survev/shared/defs/gameObjects/perkDefs.ts:48-53] [H]
- C (mechanics/movement.md): Inspire haste 5 s, hard-coded since survev commit `b18ac3dc` (2024) [src:survev/shared/defs/gameObjects/perkDefs.ts:52] [H]
- D (mechanics/movement.md): 6 s [src:fandom/Last_Breath] [src:wikigg/Last_Breath]; wiki.gg's text looks copied from fandom (it contradicts survev's own code), and balance.txt notes an unspecified fork "Last Breath adjusted (overall buff)" on 2025-07-23 [src:balance/178] [M]
- E (provenance/balance-revert.md): fandom and wiki.gg say Last Breath boosts nearby teammates for 6 seconds (+20% size, +4.8 speed, +8% damage) [src:fandom/Last_Breath, wikigg/Last_Breath] [M]
- F (provenance/balance-revert.md): survev, before and after the fork change, applies the haste and the size/damage ticker for 5 seconds [src:derived/git-ae55c9a8:server/src/game/objects/player.ts:4341, survev/shared/defs/gameObjects/perkDefs.ts:48] [H]
- proposed resolution: rule 2: keep survev's 5 s (not marked as an estimate) as a knob and log the wikis' 6 s (wiki.gg's text looks copied from fandom) [src:survev/shared/defs/gameObjects/perkDefs.ts:48-53] [src:derived/readme-precedence] [L]
- note: `provenance/balance-revert.md` proposed 6 s; `items/perks.md` and `mechanics/movement.md` proposed 5 s [src:derived/kb-crossref] [L]
- files: `items/perks.md` (`perk-last-breath-haste`), `mechanics/movement.md` (`last-breath-haste-duration`), `provenance/balance-revert.md` (`last-breath-duration`) [src:derived/kb-crossref] [H]

## perk-gabby-interval

- A: random emote every 5–15 s [src:fandom/Gabby_Ghost] [M]
- B: every 3 s on the fandom Perks list [src:fandom/Perks] [M]
- proposed resolution: 5–15 s, as survev uses [src:survev/shared/defs/gameObjects/perkDefs.ts:145-148] [L]
- files: `items/perks.md` (`perk-gabby-interval`) [src:derived/kb-crossref] [H]

## perk-perky-shoot-emote

- A: picking up Perky Shoot emotes a turkey [src:fandom/Perky_Shoot] and the def has `emoteOnPickup: "emote_turkeyanimal"` [src:survev/shared/defs/gameObjects/perkDefs.ts:860] [M]
- B: survev's server only emoting `emote_<perk id>`, which does not exist for `turkey_shoot` [src:survev/server/src/game/objects/player.ts:3942-3945] [H]
- proposed resolution: use `emoteOnPickup` [src:derived/readme-precedence] [M]
- files: `items/perks.md` (`perk-perky-shoot-emote`) [src:derived/kb-crossref] [H]

## perk-slot-count

- A (items/perks.md): 3 HUD perk slots in v0.8.82 [src:derived/survev-git-1cf4b8fd] [H]
- B (items/perks.md): survev 4 [src:survev/client/src/ui/ui2.ts:35] [H]
- C (ui/hud.md): 3 perk slots in the original 0.8.82 client and the 2026 relaunch [src:derived/survev@8715a605:client/js/app.js:110559] [src:kong/relaunch-client-bundle] [H]
- D (ui/hud.md): 4 in survev [src:survev/client/src/ui/ui2.ts:35] [H]
- proposed resolution: 3 HUD perk slots for v0.8.82, 4 as a fork setting [src:derived/survev@8715a605:client/js/app.js:110559] [src:kong/relaunch-client-bundle] [H]
- files: `items/perks.md` (`perk-ui-slots`), `ui/hud.md` (`perk-slot-count`) [src:derived/kb-crossref] [H]

## perk-max-perks-rule

- A: no pickup cap besides the 8-perk net limit in the original [src:derived/survev@9f64948d:src/net/net.ts:146] [H]
- B: fork "MaxPerks" refusal at 4 perks and drop-all for 4-perk roles [src:derived/survev-git-f001d961] [H]
- proposed resolution: cap at the 3 HUD slots, fork rule behind a flag [src:derived/readme-precedence] [L]
- files: `items/perks.md` (`perk-max-perks-rule`) [src:derived/kb-crossref] [H]

## medic-use-time

- A (items/perks.md): Mass Medicate use time × 0.8 ("20 % less use time") [src:fandom/Mass_Medicate] [M]
- B (items/perks.md): survev × 0.75 [src:survev/server/src/game/objects/player.ts:3275] [H]
- C (mechanics/heal-actions.md): Mass Medicate use time × 0.75 [src:survev/server/src/game/objects/player.ts:3275] [H]
- D (mechanics/heal-actions.md): "increases the using speed by 25 %, equating to 20 % less use time" (× 0.8) [src:fandom/Mass_Medicate] [src:wikigg/Mass_Medicate] [M]
- proposed resolution: × 0.8 use time (two wikis: "20 % less use time"), survev's × 0.75 as a knob [src:fandom/Mass_Medicate] [src:wikigg/Mass_Medicate] [M]
- files: `items/perks.md` (`perk-aoe-heal-use-time`), `mechanics/heal-actions.md` (`medic-use-time`) [src:derived/kb-crossref] [H]

## perk-windwalk-explosions

- A: enemy bullets or explosions trigger Windwalk [src:fandom/Windwalk] [src:fandom/Perks] [M]
- B: survev bullets only [src:survev/server/src/game/objects/bullet.ts:458-465] [H]
- proposed resolution: also trigger on enemy explosions within 5 units [src:derived/readme-precedence] [L]
- files: `items/perks.md` (`perk-windwalk-explosions`) [src:derived/kb-crossref] [H]

## perk-firepower-drop-ammo

- A: excess loaded rounds are deleted when Firepower is dropped [src:fandom/Firepower] [M]
- B: survev returning them to the inventory [src:survev/server/src/game/weaponManager.ts:673-689] [H]
- proposed resolution: delete (original behaviour per fandom) [src:derived/readme-precedence] [L]
- files: `items/perks.md` (`perk-firepower-drop-ammo`) [src:derived/kb-crossref] [H]

## perk-splinter-nosplinter-main

- A: fandom lists the `noSplinter` guns as unaffected [src:fandom/Splinter_Rounds] [M]
- B: survev still applying the × 0.6 main-bullet multiplier to them [src:survev/server/src/game/weaponManager.ts:820-823] [H]
- proposed resolution: skip the whole perk (no × 0.6) for `noSplinter` guns [src:derived/readme-precedence] [L]
- files: `items/perks.md` (`perk-splinter-nosplinter-main`) [src:derived/kb-crossref] [H]

## faction-promotion-order

- A (items/roles.md): v0.8.82 promotes the Commander, one of Lieutenant/Marksman/Recon/Grenadier, then Medic and Bugler [src:fandom/Lieutenant] [src:fandom/Grenadier] [M]
- B (items/roles.md): survev giving all seven roles in sequence since fork v0.0.18 [src:survev/client/public/changelogRec.html:509] [H]
- C (modes/faction.md): v0.8.82 promotes one random of Lieutenant/Marksman/Grenadier/Recon at 54 s, Medic at 58 s and Bugler at 62 s [src:fandom/50v50_Map] [src:derived/survev-git-42f052d8] [M]
- D (modes/faction.md): fork promoting all four (54–66 s) and moving Medic/Bugler to 70/74 s [src:survev/shared/defs/maps/factionDefs.ts:194-242] [H]
- proposed resolution: Commander, then one random of Lieutenant / Marksman / Recon / Grenadier, then Medic and Bugler at 50 / 54 / 58 / 62 s (survev pre-fork), fork all-roles schedule behind a flag [src:fandom/50v50_Map] [src:derived/survev-git-42f052d8] [M]
- files: `items/roles.md` (`role-faction-promotion-order`), `modes/faction.md` (`faction-second-role`) [src:derived/kb-crossref] [H]

## role-promotion-timing

- A: no source gives the original promotion times; survev uses 50/54/58/62 s after circle 0 (first 5/10/15/20 s) [src:derived/survev-git-42f052d8] [src:derived/survev-git-a7a91a25] [H]
- B: fandom only saying the Commander is chosen "in the early game" [src:fandom/Red_Leader] [M]
- proposed resolution: keep survev's 50/54/58/62 s as config knobs [src:derived/readme-precedence] [L]
- files: `items/roles.md` (`role-promotion-timing`) [src:derived/kb-crossref] [H]

## role-lone-survivr-trigger

- A: last 2 non-downed, connected players of a team [src:fandom/Lone_Survivr] [src:survev/server/src/game/group.ts:144-158] [M]
- B: "less than 10 people in the losing team" on the fandom Roles list [src:fandom/Roles] [M]
- proposed resolution: last 2 [src:derived/readme-precedence] [M]
- files: `items/roles.md` (`role-lone-survivr-trigger`) [src:derived/kb-crossref] [H]

## role-lone-survivr-perks

- A: v0.8.82 Cast Ironskin + Splinter Rounds + one of Takedown/Windwalk/Combat Medic at 1/3 each [src:derived/survev@9f64948d:src/defs/roleDefs.js:62-68] [src:fandom/Combat_Medic] [H]
- B: fork Cast Ironskin + AP or Splinter + Takedown + Windwalk or Combat Medic [src:survev/shared/defs/gameObjects/roleDefs.ts:368-381] [H]
- proposed resolution: v0.8.82 set [src:derived/readme-precedence] [H]
- in the game since the survev content wave's stage 5 (survev balance, design option B): survev's four perks, two of them weighted picks (`$weighted` role perks) [src:derived/readme-precedence] [H]
- files: `items/roles.md` (`role-lone-survivr-perks`) [src:derived/kb-crossref] [H]

## grenadier-grenades

- A (items/roles.md): 12 frags + 8 MIRVs [src:fandom/Grenadier] [src:derived/survev@172a4348:shared/defs/gameObjects/roleDefs.ts:306-328] [M]
- B (items/roles.md): fork 15 + 10 in code [src:survev/shared/defs/gameObjects/roleDefs.ts:314-337] (balance.txt says 15 + 12 "to match the Flak Jacket change" [src:balance/300]) [src:survev/shared/defs/gameObjects/roleDefs.ts:314-337] [src:balance/300] [H]
- C (provenance/balance-revert.md): balance.txt says the Grenadier gets 12 MIRVs since fork 0.3.01 [src:balance/300] [H]
- D (provenance/balance-revert.md): `roleDefs.ts` gives 10 MIRVs (8 + Flak Jacket bonus) [src:survev/shared/defs/gameObjects/roleDefs.ts:331] [H]
- proposed resolution: rule 1 after the balance revert: 12 frags + 8 MIRVs (fandom and survev pre-fork agree); fork 15 + 10 (code) or 15 + 12 (balance.txt) only behind a flag [src:fandom/Grenadier] [src:derived/survev@172a4348:shared/defs/gameObjects/roleDefs.ts:306-328] [H]
- in the game since the survev content wave's stage 5 (survev balance, design option B): survev's 15 frags + 10 MIRVs, held thanks to Flak Jacket's bag room [src:derived/readme-precedence] [H]
- files: `items/roles.md` (`role-grenadier-grenades`), `provenance/balance-revert.md` (`grenadier-mirv-count`) [src:derived/kb-crossref] [H]

## role-promotion-heals

- A (items/roles.md): fandom loadouts for Commander, Lieutenant, Marksman, Recon, Grenadier, Bugler and Lone Survivr list no healing items [src:fandom/Commander] [src:fandom/Lone_Survivr] [M]
- B (items/roles.md): fork bandages/med kits/sodas on promotion [src:survev/client/public/changelogRec.html:442] [H]
- C (provenance/balance-revert.md): balance.txt gives Commander 5 bandages + 1 medkit, Lieutenant 10 bandages + 3 sodas, Bugler 5 bandages + 2 sodas [src:balance/172, balance/173, balance/174] [H]
- D (provenance/balance-revert.md): the code gives Commander 10 bandages + 1 medkit, Lieutenant 10 bandages + 1 medkit + 2 sodas, Bugler 5 bandages [src:survev/shared/defs/gameObjects/roleDefs.ts:157, survev/shared/defs/gameObjects/roleDefs.ts:220, survev/shared/defs/gameObjects/roleDefs.ts:356] [H]
- proposed resolution: no healing items on promotion (fork 0.1.2 addition; balance.txt and code also disagree on the amounts) [src:survev/client/public/changelogRec.html:442] [src:fandom/Commander] [H]
- in the game since the survev content wave's stage 5 (survev balance, design option B): survev's healing items (the role defs' survev `defaultItems`) [src:derived/readme-precedence] [H]
- files: `items/roles.md` (`role-promotion-heals`), `provenance/balance-revert.md` (`role-healing-amounts`) [src:derived/kb-crossref] [H]

## role-bugler-pan

- A: no melee in v0.8.82 [src:fandom/Bugler] [M]
- B: fork pan [src:balance/179] [H]
- proposed resolution: no pan [src:derived/readme-precedence] [M]
- in the game since the survev content wave's stage 5 (survev balance, design option B): survev's pan (the role def's survev `defaultItems`) [src:derived/readme-precedence] [H]
- files: `items/roles.md` (`role-bugler-pan`) [src:derived/kb-crossref] [H]

## role-healer-perks

- A: Combat Medic + Windwalk [src:derived/survev@9f64948d:src/defs/roleDefs.js:101-112] [H]
- B: fork Combat Medic + Combat Stimulants [src:survev/shared/defs/gameObjects/roleDefs.ts:463] [H]
- proposed resolution: v0.8.82 [src:derived/readme-precedence] [H]
- files: `items/roles.md` (`role-healer-perks`) [src:derived/kb-crossref] [H]

## role-demo-perks

- A: Fabricate + Flak Jacket [src:derived/survev@9f64948d:src/defs/roleDefs.js:149-160] [H]
- B: fork Hyperfragmentation + Flak Jacket [src:survev/shared/defs/gameObjects/roleDefs.ts:531] [H]
- proposed resolution: v0.8.82 [src:derived/readme-precedence] [H]
- files: `items/roles.md` (`role-demo-perks`) [src:derived/kb-crossref] [H]

## role-leader-auto-flare

- A: no automatic flare in v0.8.82 (fandom only lists a fully loaded Flare Gun; the auto-fire is announced as new in fork 0.1.2) [src:fandom/Commander] [M]
- B: fork auto-fire after 15 s [src:survev/client/public/changelogRec.html:436] [src:survev/server/src/game/objects/player.ts:885-888] [H]
- proposed resolution: manual only (fork flag) [src:derived/readme-precedence] [M]
- files: `items/roles.md` (`role-leader-auto-flare`) [src:derived/kb-crossref] [H]

## role-desert-lt-helmet

- A: the desert Lieutenant Helmet only adds Firepower [src:changelog/0.7.51] [src:derived/survev@9f64948d:src/defs/gearDefs.js:597-600] [H]
- B: fandom saying wearers "become Lieutenants" [src:fandom/Lieutenant] [M]
- proposed resolution: perk only, no role (the client def has no `role`) [src:derived/readme-precedence] [M]
- files: `items/roles.md` (`role-desert-lt-helmet`) [src:derived/kb-crossref] [H]

## role-commander-outfit-block

- A: the Commander cannot pick up a Ghillie Suit even after becoming Lone Survivr [src:fandom/Commander] [M]
- B: survev blocking outfit pickups only while the role has `noDropOutfit` [src:survev/server/src/game/objects/player.ts:3904-3911] [H]
- proposed resolution: survev rule (block while Commander) and log the Lone Survivr edge case [src:derived/readme-precedence] [L]
- files: `items/roles.md` (`role-commander-outfit-block`) [src:derived/kb-crossref] [H]

## role-last-man-map-icon

- A: no map icon in v0.8.82 [src:derived/survev@9f64948d:src/defs/roleDefs.js:62-68] [src:fandom/Lone_Survivr] [H]
- B: fork `player-last-man.img` [src:derived/survev-git-4c60674c] [H]
- proposed resolution: none [src:derived/readme-precedence] [H]
- files: `items/roles.md` (`role-last-man-map-icon`) [src:derived/kb-crossref] [H]

## spud-gun-explosion-damage

- A: `explosion_potato_smgshot` damage 13 in survev, in its first commit and in the decompiled 0.8.82 client (protocol 78) [src:survev/shared/defs/gameObjects/explosionsDefs.ts:206-218] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:163-173] [src:derived/survev@8715a605:client/js/app.js:114912-114914] [H]
- A: fandom Spud Gun damage 13 [src:fandom/Spud_Gun] [M]
- B: damage 12 in the 2026 relaunch bundle (also protocol 78) [src:kong/relaunch-client-defs] [H]
- proposed resolution: 13 (two copies of the original 0.8.82 client plus fandom); 12 is probably an unlogged relaunch 0.9.x change, keep it as a knob [src:derived/survev@8715a605:client/js/app.js:114914] [src:fandom/Spud_Gun] [L]
- note: `items/throwables.md` proposed 13 and `mechanics/explosions.md` proposed 12; this entry settles on 13 [src:derived/kb-crossref] [L]
- files: `items/throwables.md` (`spud-gun-explosion-damage`), `mechanics/explosions.md` (`spud-gun-explosion-damage`) [src:derived/kb-crossref] [H]

## strobe-strike-delay

- A (items/throwables.md): original/fandom strikeDelay 2.5 s [src:derived/survev@9f64948d:src/defs/throwableDefs.js:286-352] [src:fandom/Strobe] [H]
- B (items/throwables.md): survev and wiki.gg 3 s [src:survev/shared/defs/gameObjects/throwableDefs.ts:357-423] [src:wikigg/Strobe] [H]
- C (mechanics/airdrop-airstrike.md): strobe `strikeDelay` 2.5 s [src:kong/relaunch-client-defs] [src:fandom/Strobe] [H]
- D (mechanics/airdrop-airstrike.md): 3 s [src:survev/shared/defs/gameObjects/throwableDefs.ts:367] [src:wikigg/Strobe] [H]
- status: closed (2026-10-07): 3 s. survev master is the gameplay baseline (ADR 0003), and survev.wiki.gg agrees ("three seconds after it is thrown"); the rebirth layer sets `strobe.strikeDelay` 3 over the generated 2.5 (`packages/defs/src/rebirth/strobes.ts`, listed in `rebirth-deviations.md`) [src:survev/shared/defs/gameObjects/throwableDefs.ts:367] [src:wikigg/Strobe] [src:user/2026-10-07-strobes] [H]
- superseded resolution: rule 1: `strikeDelay` 2.5 s (original client, relaunch and fandom); 3 s is a fork value [src:kong/relaunch-client-defs] [src:derived/survev@9f64948d:src/defs/throwableDefs.js:286-352] [H]
- the survev content wave's stage 5 (survev balance, design option B) ports survev's 3 s into the generated def too, so the rebirth layer's 3 then matches it [src:derived/readme-precedence] [H]
- files: `items/throwables.md` (`strobe-delay`), `mechanics/airdrop-airstrike.md` (`strobe-strike-delay`) [src:derived/kb-crossref] [H]

## strobe-arming

- A: wiki.gg's overview: the strobe calls its air strike once it has "fully stop[ped] on the ground for 3 seconds" [src:wikigg/Strobe] [M]
- B: wiki.gg's lead and survev: the ping comes `strikeDelay` (3) s after the throw, wherever the strobe is then; the strikes start from where it lies at each strike [src:wikigg/Strobe] [src:survev/server/src/game/objects/projectile.ts:173-211] [H]
- A full-strength throw (speed 25, velZ 5) lands about 1.04 s after the throw at gravity 10.5 and slides to under 0.5 u/s by about 2.8 s at ground drag 2.3, so at 3 s it has all but stopped; a timer from the stop would delay the strike by another ~3 s [src:derived/strobe-throw-stop-time] [M]
- status: closed (2026-10-07): survev's timer from the throw (the baseline, ADR 0003); the overview's wording describes a full throw that has come to rest [src:survev/server/src/game/objects/projectile.ts:173-211] [src:user/2026-10-07-strobes] [M]
- files: `items/throwables.md` (`strobe-arming`) [src:derived/kb-crossref] [H]

## snow-potato-explosion-damage

- A (items/throwables.md): wiki.gg lists snowball speed 52, damage 6, heavy 28 [src:wikigg/Snowball] [M]
- B (items/throwables.md): original 40 / 2 / 5 [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:110-129] [src:fandom/Snowball] [H]
- C (mechanics/explosions.md): snowball / heavy snowball / potato / heavy potato explosion damage 6 / 28 / 8 / 15 [src:survev/shared/defs/gameObjects/explosionsDefs.ts:141-194] [H]
- D (mechanics/explosions.md): 2 / 5 / 2 / 5 in the 0.8.82 client [src:kong/relaunch-client-defs] [src:balance/119-133] [H]
- E (modes/potato.md): potato 2 / heavy 5 damage [src:balance/128-133] [H]
- F (modes/potato.md): fork 8 / 15 [src:survev/client/public/changelogRec.html:329] [H]
- proposed resolution: rule 1: original snowball / heavy snowball / potato / heavy potato explosion damage 2 / 5 / 2 / 5 and snowball speed 40; wiki.gg's 6 / 28 and survev's 8 / 15 are fork values [src:kong/relaunch-client-defs] [src:balance/119-133] [H]
- files: `items/throwables.md` (`snowball-stats-wikigg`), `mechanics/explosions.md` (`snow-potato-explosion-damage`), `modes/potato.md` (`potato-throwable-damage`) [src:derived/kb-crossref] [H]

## smoke-duration

- A: fandom "around 18 seconds" [src:fandom/Smoke_Grenade] [M]
- B: survev emitter active 16 s plus puff fade [src:survev/server/src/game/objects/smoke.ts:33-36] [H]
- proposed resolution: keep survev timing, expose as knob [src:derived/readme-precedence] [L]
- files: `items/throwables.md` (`smoke-duration`) [src:derived/kb-crossref] [H]

## throwables-table-smoke-velmult

- A: fandom smoke infobox playerVelMult 6 [src:fandom/Smoke_Grenade] [M]
- B: def 0.6 [src:derived/survev@9f64948d:src/defs/throwableDefs.js:220-285] [H]
- proposed resolution: 0.6 [src:derived/readme-precedence] [H]
- files: `items/throwables.md` (`throwables-table-smoke-velmult`) [src:derived/kb-crossref] [H]

## heavy-snowball-speed

- A (items/throwables.md): balance.txt logs the heavy snowball speed as 40 → 52 [src:balance/126] [H]
- B (items/throwables.md): `snowball_heavy` throw speed 45 in both the original and survev defs [src:derived/survev@9f64948d:src/defs/throwableDefs.js:418-461] [src:survev/shared/defs/gameObjects/throwableDefs.ts:491-533] [H]
- C (provenance/balance-revert.md): balance.txt says the heavy snowball speed went 40 -> 52 [src:balance/126] [H]
- D (provenance/balance-revert.md): both the original client def and survev HEAD have `snowball_heavy.throwPhysics.speed` 45 [src:survev/shared/defs/gameObjects/throwableDefs.ts:508, derived/git-9f64948d:src/defs/throwableDefs.js:435] [H]
- proposed resolution: 45 (original and survev defs agree; the balance.txt line is wrong, nothing to revert) [src:survev/shared/defs/gameObjects/throwableDefs.ts:508] [H]
- files: `items/throwables.md` (`heavy-snowball-speed-balance`), `provenance/balance-revert.md` (`heavy-snowball-speed`) [src:derived/kb-crossref] [H]

## strobe-airstrike-offset

- A: fandom says strobe planes "go directly on top of each other" and that Broken Arrow inserts its two extra runs between the three normal ones without lengthening the strike [src:fandom/Iron_Bomb] [src:fandom/Broken_Arrow] [M]
- B: survev offsetting strikes 0 / 5 / 5 / 10 / 10 units sideways [src:survev/server/src/game/weaponManager.ts:1337-1362] [src:survev/server/src/game/objects/projectile.ts:173-211] [H]
- B: wiki.gg: a strobe's first wave drops in front of it, then one wave on its left and one on its right [src:wikigg/Airstrike_Bomb] [M]
- status: closed (2026-10-07): survev's pattern, the gameplay baseline (ADR 0003): the first line starts at the strobe along the throw, line k flies `ceil(k / 2)` × 5 u beside it on alternating sides, the first side at random (survev's "was not in surviv"); `rules.strobeAirstrikeOffset` 5 (0 restores fandom's stacked lines), `rules.strobeRandomSide` on. The rebirth carpet strobe spaces its lines 7 u apart [src:survev/server/src/game/weaponManager.ts:1337-1362] [src:survev/server/src/game/objects/projectile.ts:194-206] [src:user/2026-10-07-strobes] [H]
- superseded resolution: all strikes on the strobe line for 0.8.82, keep the offset as a config knob [src:derived/readme-precedence] [L]
- files: `items/throwables.md` (`strobe-airstrike-offset`) [src:derived/kb-crossref] [H]

## broken-arrow-check-time

- A (items/throwables.md): fandom says the extra planes depend on holding Broken Arrow when the airstrike warning appears [src:fandom/Broken_Arrow] [M]
- B (items/throwables.md): survev counting planes when the strobe is thrown [src:survev/server/src/game/weaponManager.ts:1337-1362] [H]
- C (mechanics/airdrop-airstrike.md): survev applies Broken Arrow at throw time [src:survev/server/src/game/weaponManager.ts:1349-1351] [H]
- D (mechanics/airdrop-airstrike.md): fandom saying it is applied when the strike warning appears [src:fandom/Broken_Arrow] [M]
- status: closed (2026-10-07): survev's throw-time count, the gameplay baseline (ADR 0003); `rules.brokenArrowAtPing` (off) keeps fandom's ping-time check as the knob [src:survev/server/src/game/weaponManager.ts:1349-1351] [src:user/2026-10-07-strobes] [M]
- superseded resolution: check Broken Arrow when the airstrike warning (ping) appears, as fandom describes the original; survev's throw-time check as a knob [src:fandom/Broken_Arrow] [L]
- files: `items/throwables.md` (`broken-arrow-check-time`), `mechanics/airdrop-airstrike.md` (`broken-arrow-check-time`) [src:derived/kb-crossref] [H]

## heavy-throwable-fandom-infobox

- A: fandom's heavy snowball infobox lists fuseTime 9999 and rad 1 [src:fandom/Snowball] [M]
- B: the original def fuseTime 5 and rad 1.25 [src:derived/survev@9f64948d:src/defs/throwableDefs.js:418-461] [src:kong/relaunch-client-defs] [H]
- proposed resolution: def values [src:derived/readme-precedence] [H]
- files: `items/throwables.md` (`heavy-throwable-fandom-infobox`) [src:derived/kb-crossref] [H]

## heavy-snowball-damage-history

- A: fandom says hardened snowballs dealt 12 before 0.6.95 [src:fandom/Snowball] [M]
- B: no such entry in the changelog [src:changelog/0.6.95] [H]
- proposed resolution: irrelevant for 0.8.82 (5) [src:derived/readme-precedence] [L]
- files: `items/throwables.md` (`heavy-snowball-damage-history`) [src:derived/kb-crossref] [H]

> **Korean localisation**

## l10n-medic-term

- A: 50v50 Medic(`medic`) 현재 ko "의사" [src:l10n/ko:game-medic] [H]
- B: 원본 번역 "위생병" [src:derived/git-a14ab228] [H]
- C: 나무위키 "의무병" [src:namu/Surviv.io/이벤트] [M]
- proposed resolution: "위생병" (원본 복원, 퍽 "전투 의무병"·코발트 "메딕"과 구분) [src:derived/readme-precedence] [L]
- files: `l10n-ko.md` (`l10n-medic-term`) [src:derived/kb-crossref] [H]

## l10n-scout-recon

- A: `recon`과 `scout`가 모두 "정찰병" [src:l10n/ko:game-recon, l10n/ko:game-scout] [H]
- B: 나무위키도 둘 다 "정찰병" [src:namu/Surviv.io/이벤트, namu/Surviv.io/직업] [M]
- proposed resolution: recon=정찰병, scout=스카우트 [src:derived/readme-precedence] [L]
- files: `l10n-ko.md` (`l10n-scout-recon`) [src:derived/kb-crossref] [H]

## l10n-marksman-term

- A: ko "명사수" [src:l10n/ko:game-marksman] [H]
- B: 나무위키 "마크스맨" [src:namu/Surviv.io/이벤트] [M]
- proposed resolution: UI는 "명사수", 문서·검색 별칭으로 "마크스맨" [src:derived/readme-precedence] [L]
- files: `l10n-ko.md` (`l10n-marksman-term`) [src:derived/kb-crossref] [H]

## l10n-bugler-term

- A: ko "나팔수" [src:l10n/ko:game-bugler] [H]
- B: 나무위키 "나팔병" [src:namu/Surviv.io/이벤트] [M]
- proposed resolution: "나팔수" 유지 [src:derived/readme-precedence] [L]
- files: `l10n-ko.md` (`l10n-bugler-term`) [src:derived/kb-crossref] [H]

## l10n-epic-rarity

- A: ko epic "전설" [src:l10n/ko:loadout-epic] [H]
- B: 나무위키 "영웅" [src:namu/Surviv.io/의류] [M]
- proposed resolution: "영웅" (전설은 legendary로 오해) [src:derived/readme-precedence] [L]
- files: `l10n-ko.md` (`l10n-epic-rarity`) [src:derived/kb-crossref] [H]

## l10n-backpack-names

- A: ko "큰 가방/밀리터리 가방" [src:l10n/ko:game-backpack02, l10n/ko:game-backpack03] [H]
- B: 나무위키 "보통 가방/군용 가방" [src:namu/Surviv.io/장비] [M]
- proposed resolution: "보통 가방/군용 가방" [src:derived/readme-precedence] [L]
- files: `l10n-ko.md` (`l10n-backpack-names`) [src:derived/kb-crossref] [H]

## l10n-mode-names

- A: 로비 "개인전/2인 팀전/분대(4명)" [src:l10n/ko:index-solo, l10n/ko:index-squad] [H]
- B: 퀘스트·원본 번역·나무위키 "솔로/듀오/스쿼드" [src:l10n/ko:quest_top_solo, namu/Surviv.io, derived/git-4d5acbc8] [H]
- proposed resolution: 솔로/듀오/스쿼드 [src:derived/readme-precedence] [L]
- files: `l10n-ko.md` (`l10n-mode-names`) [src:derived/kb-crossref] [H]

## l10n-revive-term

- A: "소생" [src:l10n/ko:game-reviving] [H]
- B: "부활" [src:l10n/ko:index-revive, l10n/ko:bind-revive] [H]
- proposed resolution: "소생" 통일 [src:derived/readme-precedence] [L]
- files: `l10n-ko.md` (`l10n-revive-term`) [src:derived/kb-crossref] [H]

## l10n-flak-jacket-name

- A: ko·나무위키 모두 "방탄 조끼" [src:l10n/ko:game-flak_jacket, namu/Surviv.io/이벤트] [H]
- B: 효과는 폭발·파편 감쇠이고 조끼 장비와 이름이 겹침 [src:l10n/en:game-flak_jacket-desc, l10n/ko:game-chest01] [H]
- proposed resolution: "방폭 재킷" (검색 별칭 "방탄 조끼") [src:derived/readme-precedence] [L]
- files: `l10n-ko.md` (`l10n-flak-jacket-name`) [src:derived/kb-crossref] [H]

> **Maps**

## red-house-count

- A: fandom says there are always 3 houses per map [src:fandom/Red_House] [M]
- B: survev 3/4 `house_red_01` plus 3/4 `house_red_02` on the normal map [src:survev/shared/defs/maps/baseDefs.ts:917-918] [H]
- proposed resolution: keep survev counts as config, fandom text likely predates the second house [src:derived/readme-precedence] [L]
- files: `maps/buildings.md` (`red-house-count`) [src:derived/kb-crossref] [H]

## main-warehouses

- A (maps/buildings.md): fandom says 2 warehouses per map [src:fandom/Warehouse] [M]
- B (maps/buildings.md): survev 1/2 `warehouse_01` + 1 fork `warehouse_03` [src:survev/shared/defs/maps/baseDefs.ts:915-916] [src:balance/212] [H]
- C (maps/generation.md): orig warehouse_01 2 [src:derived/survev@33832ffe:src/defs/maps/baseDefs.ts:396] [H]
- D (maps/generation.md): survev warehouse_01 1/2 + warehouse_03 1 [src:survev/shared/defs/maps/baseDefs.ts:915-916] [src:balance/212-214] [H]
- E (modes/main.md): `warehouse_01` 1/2 + fork `warehouse_03` 1 [src:survev/shared/defs/maps/baseDefs.ts:915-916] [H]
- F (modes/main.md): `warehouse_01` 2 [src:derived/git-ae55c9a8, balance/212] [H]
- proposed resolution: 2 × `warehouse_01`, no `warehouse_03` (fork, balance.txt) [src:derived/survev@33832ffe:src/defs/maps/baseDefs.ts:396] [src:balance/212] [H]
- files: `maps/buildings.md` (`warehouse-count`), `maps/generation.md` (`main-warehouses`), `modes/main.md` (`main-warehouses`) [src:derived/kb-crossref] [H]

## shack-entrance-spawner

- A: fandom 2/3 chance for the entrance-side tier_world spawner [src:fandom/Shack] [M]
- B: original def weight 1:1 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/buildings/baseBuildingDefs.ts:7866] [H]
- proposed resolution: 1:1 [src:derived/readme-precedence] [H]
- files: `maps/buildings.md` (`shack-entrance-spawner`) [src:derived/kb-crossref] [H]

## gold-container-odds

- A: fandom 1/26 per docks container [src:fandom/Container] [M]
- B: def weights 0.08 of 3.08 (2.6 %) or of 5.83 (1.4 %) per slot [src:survev/shared/defs/mapObjects/buildings/baseBuildingDefs.ts:9764] [H]
- proposed resolution: def weights (identical in the original client) [src:derived/readme-precedence] [H]
- files: `maps/buildings.md` (`gold-container-odds`) [src:derived/kb-crossref] [H]

## kopje-brush-count

- A: fandom 4 kopje brushes per patch [src:fandom/Kopje_Patch] [M]
- B: 6 in the def [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:8540] [H]
- proposed resolution: def value [src:derived/readme-precedence] [M]
- files: `maps/buildings.md` (`kopje-brush-count`) [src:derived/kb-crossref] [H]

## logging-tree-loot

- A: fandom says the complex-02 tree drops 2 BAR and 2 MP220 [src:fandom/Logging_Complex] [M]
- B: `tree_08c` shotgun 2-3 + LMG 2-3 + Woodland outfit [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1] [src:kong/relaunch-client-defs] [H]
- proposed resolution: def loot (tier contents are survev estimates) [src:derived/readme-precedence] [M]
- files: `maps/buildings.md` (`logging-tree-loot`) [src:derived/kb-crossref] [H]

## club-music-gas

- A: fandom says the red zone covering the club turns its music off [src:fandom/Crimson_Ring_Club] [M]
- B: survev never clears `interiorSoundEnabled` [src:survev/server/src/game/objects/structure.ts:32-33] [H]
- proposed resolution: implement the gas cut-off as fandom describes, behind a flag [src:derived/readme-precedence] [L]
- files: `maps/buildings.md` (`club-music-gas`) [src:derived/kb-crossref] [H]

## desert-small-town

- A (maps/buildings.md): original small town = bank, 2 houses, shack, outhouse [src:kong/relaunch-client-defs] [src:fandom/Desert_Town] [H]
- B (maps/buildings.md): survev Reserve, barn, houses/cabin [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:5601] [H]
- C (maps/places.md): survev `desert_town_02` contains The Reserve (fork) [src:balance/317] [H]
- D (maps/places.md): the original small town (red houses, bank, shack, outhouse) [src:kong/relaunch-client-defs] [src:fandom/Desert_Town] [H]
- proposed resolution: rule 1: original small town (bank, 2 red houses, shack, outhouse); The Reserve is fork [src:kong/relaunch-client-defs] [src:balance/317] [H]
- files: `maps/buildings.md` (`desert-small-town-content`), `maps/places.md` (`desert-small-town`) [src:derived/kb-crossref] [H]

## faction-teamid

- A: survev assigns `teamId` sides to bank, mansion, police, docks, silo shack [src:survev/shared/defs/mapObjects/buildings/baseBuildingDefs.ts:7] [H]
- B: no `teamId` in the original client [src:kong/relaunch-client-defs] [H]
- proposed resolution: survev's `teamId` (the port copies it with `survevMapGen`, survev content wave 50v50 stage); fandom already puts the team crates on their own side in the original [src:derived/readme-precedence] [src:fandom/50v50_Map] [M]
- files: `maps/buildings.md` (`faction-teamid`) [src:derived/kb-crossref] [H]

## preload-on-ground-crates

- A (maps/buildings.md): original `case_02` drops two DEagles [src:kong/relaunch-client-defs] [H]
- B (maps/buildings.md): survev `deagle_dual` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1] [H]
- C (mechanics/loot.md): `case_01`, `case_02`, `crate_02f`, `crate_22` preload their guns, and `case_02` drops `deagle_dual` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:194-195] [H]
- D (mechanics/loot.md): no preload and `case_02` dropping two single DEagles [src:kong/relaunch-client-defs] [H]
- proposed resolution: rule 1: no gun preloading, and `case_02` drops two single DEagles (the player auto-duals them) [src:kong/relaunch-client-defs] [H]
- files: `maps/buildings.md` (`case02-dual-deagle`), `mechanics/loot.md` (`preload-on-ground-crates`) [src:derived/kb-crossref] [H]

## twins-unlock-time

- A (maps/bunkers.md): original fandom "0:45 during the third red zone cooldown" (= circle index 2 + 5 s, survev pre-fork) [src:fandom/Twins_Bunker] [src:derived/git-ae55c9a8] [M]
- B (maps/bunkers.md): fandom Bunkers page "after 0:44 on the second red zone shrink cooldown" [src:fandom/Bunkers] [M]
- C (maps/bunkers.md): survev now circle index 1 + 30 s [src:survev/shared/defs/maps/cobaltDefs.ts:45-54] [src:balance/301] [H]
- D (maps/puzzles.md): fandom 0:45 in the third waiting phase = circle 2 + 5 s [src:fandom/Twins_Bunker] [src:derived/git-ae55c9a8] [M]
- E (maps/puzzles.md): survev circle 1 + 30 s [src:survev/shared/defs/maps/cobaltDefs.ts:45-54] [H]
- F (mechanics/doors-layers-ceilings.md): survev unlocks the twins bunker at circleIdx 1 + 30 s [src:survev/shared/defs/maps/cobaltDefs.ts:45-54] [src:balance/301] [H]
- G (mechanics/doors-layers-ceilings.md): the original at ~0:45 of the third cooldown (circleIdx 2 + ~5 s) [src:fandom/Twins_Bunker] [src:fandom/Cobalt_Map] (fandom's Bunkers page says "0:44 … on the second red zone shrink cooldown" [src:fandom/Bunkers]) [src:fandom/Twins_Bunker] [src:fandom/Cobalt_Map] [src:fandom/Bunkers] [M]
- H (modes/cobalt.md): v0.8.82 doors open at about 0:45 left in the circle-2 wait (wait ≈ 5–6 s) [src:fandom/Twins_Bunker] [src:fandom/Cobalt_Map] [src:namu/Surviv.io/이벤트] [M]
- I (modes/cobalt.md): fork circle 1 + 30 s [src:survev/shared/defs/maps/cobaltDefs.ts:45-54] [H]
- proposed resolution: circleIdx 2 with a 5 s wait (survev pre-fork; fandom "0:45 in the third cooldown"), as a knob; survev's circle 1 + 30 s behind a fork flag [src:fandom/Twins_Bunker] [src:derived/git-ae55c9a8] [M]
- in the game since the survev content wave's stage 5 (survev balance): survev's circle 1 + 30 s (`rules.unlockOverrides` empty; the original timing is one override away) [src:derived/readme-precedence] [H]
- files: `maps/bunkers.md` (`twins-unlock-time`), `maps/puzzles.md` (`twins-unlock-timing`), `mechanics/doors-layers-ceilings.md` (`twins-bunker-unlock-time`), `modes/cobalt.md` (`cobalt-twins-unlock`) [src:derived/kb-crossref] [H]

## egg-cobalt-odds

- A: fandom says the egg bunker always spawns on Cobalt [src:fandom/Egg_Bunker] [M]
- B: survev odds 0.05 on Cobalt [src:survev/shared/defs/maps/cobaltDefs.ts:157] [H]
- proposed resolution: knob, default 0.05 [src:derived/readme-precedence] [L]
- files: `maps/bunkers.md` (`egg-cobalt-odds`) [src:derived/kb-crossref] [H]

## crossing-water-slow

- A: fandom says movement is slowed in the flooded room [src:fandom/Crossing_Bunker] [M]
- B: namu.wiki says the water is shallow and does not slow [src:namu/Surviv.io/건물]; survev slows on `water` floors [src:survev/server/src/game/objects/player.ts:4726-4731] [M]
- proposed resolution: slow (two sources) [src:derived/readme-precedence] [M]
- files: `maps/bunkers.md` (`crossing-water-slow`) [src:derived/kb-crossref] [H]

## chrys-vault-door-use

- A (maps/bunkers.md): provenance file classifies the `bunker_chrys_02` code as original [src:derived/fork-vs-original-json] [M]
- B (maps/bunkers.md): git shows the code added by fork commit 7d063420 and the original room holding crates and an openable vault door [src:derived/git-7d063420] [src:kong/relaunch-client-defs] [H]
- C (maps/puzzles.md): original `vault_door_chrys_01` usable by hand [src:kong/relaunch-client-defs] [H]
- D (maps/puzzles.md): survev locked behind the fork planter code [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:402] [src:survev/shared/defs/puzzles.ts:16] [H]
- E (mechanics/doors-layers-ceilings.md): `vault_door_chrys_01` opens by hand (`canUse true`, 4.1 s delay) [src:kong/relaunch-client-defs] [src:fandom/Chrysanthemum_Bunker] [H]
- F (mechanics/doors-layers-ceilings.md): `canUse false`, opened only by survev's added planter code [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:402-422] [src:derived/survev-git-7d063420] [H]
- proposed resolution: rule 1: `vault_door_chrys_01` opens by hand (`canUse` true, 4.1 s delay); the planter-code puzzle is fork (commit 7d063420) [src:kong/relaunch-client-defs] [src:derived/survev-git-7d063420] [H]
- files: `maps/bunkers.md` (`chrys-02-puzzle-provenance`), `maps/puzzles.md` (`chrys-vault-door-use`), `mechanics/doors-layers-ceilings.md` (`chrys-vault-door-use`) [src:derived/kb-crossref] [H]

## hatchet-tier-woods

- A: pre-fork Woods tier_hatchet USAS 2 / M249 1 / PKP 0.08 [src:derived/git-ae55c9a8] [H]
- B: survev M249 0.75 / PKP 0.25 [src:balance/244] [src:survev/shared/defs/maps/woodsDefs.ts:151-155] [H]
- proposed resolution: pre-fork values [src:derived/readme-precedence] [M]
- files: `maps/bunkers.md` (`hatchet-tier-woods`) [src:derived/kb-crossref] [H]

## cobalt-mythic-perks

- A (maps/bunkers.md): original three perks (Master Scavenger, Explosive, Splinter) [src:derived/git-ae55c9a8] [src:fandom/Twins_Bunker] [H]
- B (maps/bunkers.md): survev adds Lifeline [src:survev/shared/defs/maps/baseDefs.ts:529]; wiki.gg lists Indomitable Spirit [src:wikigg/Twins_Bunker] [H]
- C (modes/cobalt.md): Master Scavenger / Explosive Rounds / Splinter Rounds [src:fandom/Loot_tables/Class_Pod] [src:derived/survev-git-121958d2] [M]
- D (modes/cobalt.md): namu adding Broken Arrow [src:namu/Surviv.io/이벤트] [M]
- E (modes/cobalt.md): fork adding Indomitable Spirit [src:balance/294] [H]
- proposed resolution: the three original perks: Master Scavenger, Explosive Rounds, Splinter Rounds (Lifeline/Indomitable Spirit are fork) [src:fandom/Loot_tables/Class_Pod] [src:derived/git-ae55c9a8] [M]
- files: `maps/bunkers.md` (`mythic-pod-perks`), `modes/cobalt.md` (`cobalt-mythic-perks`) [src:derived/kb-crossref] [H]

## cloud-panel-cooldown

- A: survev cooldown 40 s [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:362] [H]
- B: wiki.gg 30 s [src:wikigg/Cloud_Bunker] [M]
- proposed resolution: irrelevant for v0.8.82 (fork bunker) [src:derived/readme-precedence] [L]
- files: `maps/bunkers.md` (`cloud-panel-cooldown`) [src:derived/kb-crossref] [H]

## main-hut-mix

- A (maps/generation.md): orig Main import has hut_01 4 and no scout hut [src:derived/survev@9f64948d:src/defs/modes/main.ts:173-174] [H]
- B (maps/generation.md): survev hut_01 3 + hut_03 1 [src:survev/shared/defs/maps/baseDefs.ts:921-923], the orig Main Summer import [src:derived/survev@33832ffe:src/defs/maps/mainSummerDefs.ts:54-87] and fandom's "3 Normal Huts, One Gold Hut, One Scout Hut" [src:fandom/Normal_Map] [H]
- C (modes/main.md): 3 `hut_01` + `hut_02` + `hut_03` [src:survev/shared/defs/maps/baseDefs.ts:921-923, fandom/Normal_Map] [H]
- D (modes/main.md): 4 `hut_01` + `hut_02`, no scout hut [src:derived/survev@9f64948d:src/defs/modes/main.ts:173-174] [H]
- proposed resolution: `hut_01` × 3 + `hut_02` × 1 + `hut_03` × 1 (scout hut added in 0.7.9; fandom and current survev agree) [src:fandom/Normal_Map] [src:survev/shared/defs/maps/baseDefs.ts:921-923] [M]
- files: `maps/generation.md` (`main-hut-count`), `modes/main.md` (`main-hut-mix`) [src:derived/kb-crossref] [H]

## main-palm-trees

- A: survev density tree_13 30 [src:survev/shared/defs/maps/baseDefs.ts:900] [H]
- B: orig Main without tree_13 [src:derived/survev@33832ffe:src/defs/maps/baseDefs.ts:372-393] [src:balance/209] [H]
- proposed resolution: no tree_13 on Main for 0.8.82 (fork) [src:derived/readme-precedence] [H]
- files: `maps/generation.md` (`main-palm-trees`) [src:derived/kb-crossref] [H]

## desert-lake

- A: survev Desert has an oasis lake [src:survev/shared/defs/maps/desertDefs.ts:237-250] [H]
- B: orig Desert with no lake [src:derived/survev@9f64948d:src/defs/modes/desert.ts:200-216] [H]
- proposed resolution: no lake for 0.8.82, keep as option (fork) [src:derived/readme-precedence] [H]
- files: `maps/generation.md` (`desert-lake`) [src:derived/kb-crossref] [H]

## desert-river-weights

- A: survev [8,6] at weight 0.21 [src:survev/shared/defs/maps/desertDefs.ts:255] [H]
- B: orig [8] [src:derived/survev@9f64948d:src/defs/modes/desert.ts:205] [H]
- proposed resolution: orig [8] (survev changed it to remove a "repeated" entry) [src:derived/readme-precedence] [M]
- files: `maps/generation.md` (`desert-river-weights`) [src:derived/kb-crossref] [H]

## woods-tree-counts

- A: orig import tree_07 1400 / tree_08 1300 / tree_08b 200 [src:derived/survev@33832ffe:src/defs/maps/woodsDefs.ts:205-227] [H]
- B: survev 1100 / 1100 / 150 from an original map msg [src:derived/survev-git-c94e4c39] and the 0.8.1 tree reduction [src:changelog/0.8.1] [H]
- proposed resolution: 1100 / 1100 / 150 (the import predates 0.8.1) [src:derived/readme-precedence] [M]
- files: `maps/generation.md` (`woods-tree-counts`) [src:derived/kb-crossref] [H]

## woods-pavilion

- A: orig Woods import has a lake without a centre object [src:derived/survev@33832ffe:src/defs/maps/woodsDefs.ts:150-160] [H]
- B: fandom (Woods Map has the pavilion on the lake island) [src:fandom/Woods_Map] [src:fandom/Lake] and the original `teapavilion_01w` with `lakeCenter: true` [src:kong/relaunch-client-defs] [M]
- proposed resolution: spawn `teapavilion_01w` at the lake centre as survev does [src:derived/readme-precedence] [M]
- files: `maps/generation.md` (`woods-pavilion`) [src:derived/kb-crossref] [H]

## halloween-red-houses

- A (maps/generation.md): orig house_red_01h 7 with house_red_01/02→house_red_01b replacements [src:derived/survev@33832ffe:src/defs/maps/halloweenDefs.ts:138-175] [H]
- B (maps/generation.md): survev house_red_01h 2/3 + house_red_02h 2/3 [src:survev/shared/defs/maps/halloweenDefs.ts:239-267] [H]
- C (modes/halloween.md): 2/3 × `house_red_01h` + 2/3 × `house_red_02h` [src:survev/shared/defs/maps/halloweenDefs.ts:243-244] [H]
- D (modes/halloween.md): 7 × `house_red_01h` [src:derived/git-ae55c9a8] [H]
- proposed resolution: default to the original import: 7 × `house_red_01h` with `house_red_01/02` → `house_red_01b` replacements; survev's 2/3 + 2/3 split as a knob [src:derived/survev@33832ffe:src/defs/maps/halloweenDefs.ts:138-175] [src:derived/git-ae55c9a8] [L]
- note: `maps/generation.md` proposed the original counts and `modes/halloween.md` survev's split; this entry picks the original counts as default [src:derived/kb-crossref] [L]
- files: `maps/generation.md` (`halloween-houses`), `modes/halloween.md` (`halloween-red-houses`) [src:derived/kb-crossref] [H]

## savannah-lakes

- A (maps/generation.md): survev's Savannah has a central cloud-bunker lake, an oasis and 2 crate lakes, rivers [4]/[4,4] [src:survev/shared/defs/maps/savannahDefs.ts:196-244] [H]
- B (maps/generation.md): fandom's original 3 lakes (one fixed central, two random) each with a crate on the island [src:fandom/Lake] [M]
- C (modes/savannah.md): three crate lakes, the large one fixed at the centre [src:fandom/Savannah_Map] [src:fandom/Lake] [M]
- D (modes/savannah.md): survev's Cloud Bunker lake + Oasis lake + two crate lakes, all at random positions near the centre [src:survev/shared/defs/maps/savannahDefs.ts:195-240] [H]
- proposed resolution: rule 3: three crate lakes, the large one at the centre, `crate_02sv_lake` centres; cloud bunker and oasis lakes behind fork flags [src:fandom/Lake] [src:fandom/Savannah_Map] [M]
- files: `maps/generation.md` (`savannah-generation`), `modes/savannah.md` (`savannah-lakes`) [src:derived/kb-crossref] [H]

## river-count

- A: fandom "as much as 3 rivers per game" [src:fandom/River] [M]
- B: width sets of up to 5 rivers at weight 0.0001 [src:survev/shared/defs/maps/baseDefs.ts:828-831] [H]
- proposed resolution: keep the 5-river set (practically never seen) [src:derived/readme-precedence] [L]
- files: `maps/generation.md` (`river-count`) [src:derived/kb-crossref] [H]

## cobalt-pod-count

- A (maps/generation.md): survev class_shell_01 45/55 [src:survev/shared/defs/maps/cobaltDefs.ts:141-178] [H]
- B (maps/generation.md): survev's own earlier 30 [src:balance/296]; both are fork reconstructions, the original count is unknown [src:balance/296] [H]
- C (modes/cobalt.md): original count unknown; survev 45/55 [src:survev/shared/defs/maps/cobaltDefs.ts:172-175] [H]
- D (modes/cobalt.md): balance.txt "30 → 35–45" [src:balance/296] [H]
- E (modes/cobalt.md): survev git 40 before v0.3.0 [src:derived/survev-git-a8a082cd] [H]
- F (provenance/balance-revert.md): balance.txt says class pods went 30 -> 35-45 [src:balance/296] [H]
- G (provenance/balance-revert.md): survev had `class_shell_01: 40` and now has small 45 / large 55 [src:survev/shared/defs/maps/cobaltDefs.ts:172, derived/git-ae55c9a8] [H]
- proposed resolution: rule 5: `class_shell_01` 40 (survev's pre-fork value) as a config knob; 30 (balance.txt's "old" value) and 45/55 (fork) are alternatives [src:derived/survev-git-a8a082cd] [src:balance/296] [L]
- files: `maps/generation.md` (`cobalt-class-pods`), `modes/cobalt.md` (`cobalt-pod-count`), `provenance/balance-revert.md` (`cobalt-class-pod-count`) [src:derived/kb-crossref] [H]

## barrel-smoke-threshold

- A: fandom "At around 30 health, barrels begin smoking" [src:fandom/Barrel] [M]
- B: client smoke below healthT 0.5 (75 HP of 150) [src:survev/client/src/objects/obstacle.ts:258-269] [H]
- proposed resolution: 50 % (client code) [src:derived/readme-precedence] [M]
- files: `maps/obstacles.md` (`barrel-smoke-threshold`) [src:derived/kb-crossref] [H]

## soviet-crate-hp

- A (maps/obstacles.md): fandom 120 HP for `crate_02`/`crate_02f` [src:fandom/Soviet_Crate] [M]
- B (maps/obstacles.md): 140 in the original defs [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:383] [H]
- C (namu.md): namu 소련 상자 내구도 120 [src:namu/Surviv.io/오브젝트] [M]
- D (namu.md): survev `crate_02` health 140 [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:383] [H]
- proposed resolution: rule 1: 140 HP [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:383] [H]
- files: `maps/obstacles.md` (`soviet-crate-hp`), `namu.md` (`namu-soviet-crate-health`) [src:derived/kb-crossref] [H]

## river-chest-hp

- A: fandom 120 HP [src:fandom/River_Chest] [M]
- B: 140 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:330] [H]
- proposed resolution: 140 [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`river-chest-hp`) [src:derived/kb-crossref] [H]

## hatchet-crate-hp

- A: fandom 120 HP for `crate_19` [src:fandom/Hatchet_Crate] [M]
- B: 140 [src:kong/relaunch-client-defs] [H]
- proposed resolution: 140 [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`hatchet-crate-hp`) [src:derived/kb-crossref] [H]

## chrys-case-hp

- A: fandom 120 HP for `case_06` [src:fandom/Chrysanthemum_Chest] [M]
- B: 140 [src:kong/relaunch-client-defs] [H]
- proposed resolution: 140 [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`chrys-case-hp`) [src:derived/kb-crossref] [H]

## deagle-case-hp

- A: fandom 140 / 120 HP for `case_01` / `case_02` [src:fandom/DEagle_Case] [M]
- B: 75 for both [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:194-195] [H]
- proposed resolution: 75 [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`deagle-case-hp`) [src:derived/kb-crossref] [H]

## round-stove-hp

- A: fandom 500 HP for `stove_02` [src:fandom/Stove] [M]
- B: 400 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:1162] [H]
- proposed resolution: 400 [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`round-stove-hp`) [src:derived/kb-crossref] [H]

## military-airdrop-hp

- A (maps/obstacles.md): fandom 500 HP for `airdrop_crate_03/04` and `crate_13` [src:fandom/Military_Air_Drop] [src:fandom/Meteor_Crate] [M]
- B (maps/obstacles.md): 200 [src:kong/relaunch-client-defs] [H]
- C (mechanics/airdrop-airstrike.md): fandom infobox gives the military shell 500 HP [src:fandom/Military_Air_Drop] [M]
- D (mechanics/airdrop-airstrike.md): shell health 200 and indestructible, with 500 HP on the inner `crate_12` [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:741] [H]
- E (mechanics/airdrop-airstrike.md): gold military loot crate `crate_13` has 200 HP [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:813] [H]
- F (mechanics/airdrop-airstrike.md): 500 HP in the fandom infobox [src:fandom/Meteor_Crate] [M]
- G (modes/faction.md): military air drop listed with 500 HP [src:fandom/Military_Air_Drop] [M]
- H (modes/faction.md): 200 HP in the original obstacle def (the 500 HP is the inner `crate_12`) [src:kong/relaunch-client-defs] [H]
- proposed resolution: rule 1: military shells `airdrop_crate_03/04` 200 HP and indestructible, inner `crate_12` 500 HP, gold `crate_13` 200 HP; fandom's 500 HP belongs to `crate_12` [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:741] [H]
- files: `maps/obstacles.md` (`military-airdrop-hp`), `mechanics/airdrop-airstrike.md` (`military-shell-hp`), `mechanics/airdrop-airstrike.md` (`gold-military-crate-hp`), `modes/faction.md` (`faction-airdrop-crate-hp`) [src:derived/kb-crossref] [H]

## log-pile-hp

- A: fandom 150 HP for `woodpile_02` [src:fandom/Log_Pile] [M]
- B: 400 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1615] [H]
- proposed resolution: 400 [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`log-pile-hp`) [src:derived/kb-crossref] [H]

## planter-hp

- A: fandom 75 HP [src:fandom/Planter] [M]
- B: 100 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:988] [H]
- proposed resolution: 100 [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`planter-hp`) [src:derived/kb-crossref] [H]

## bottle-hp

- A: fandom and wiki.gg 20 HP for `bottle_01` [src:fandom/Bottle] [src:wikigg/Bottles] [M]
- B: 12 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:751] [H]
- proposed resolution: 12 [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`bottle-hp`) [src:derived/kb-crossref] [H]

## bookshelf-hp

- A: wiki.gg 80 HP [src:wikigg/Bookshelf] [M]
- B: 75 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:698] [H]
- proposed resolution: 75 [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`bookshelf-hp`) [src:derived/kb-crossref] [H]

## summer-tree-hp

- A: fandom 175 HP for `tree_08su` [src:fandom/Tree] [M]
- B: 225 [src:kong/relaunch-client-defs] [H]
- proposed resolution: 225 [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`summer-tree-hp`) [src:derived/kb-crossref] [H]

## oven-height

- A: fandom height 5 [src:fandom/Oven] [M]
- B: 0.5 [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:954] [H]
- proposed resolution: 0.5 [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`oven-height`) [src:derived/kb-crossref] [H]

## reflect-flags

- A: fandom says pumpkins and the faction statue base reflect bullets and switches do not [src:fandom/Pumpkin] [src:fandom/Faction_Statue] [src:fandom/Switch] [M]
- B: the opposite in the original defs [src:kong/relaunch-client-defs] [H]
- proposed resolution: trust the defs [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`reflect-flags`) [src:derived/kb-crossref] [H]

## stone-cache-collide

- A: fandom marks `stone_02` and bottle switches non-collidable [src:fandom/Stone] [src:fandom/Bottle] [M]
- B: collidable in the defs [src:kong/relaunch-client-defs] [H]
- proposed resolution: trust the defs [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`stone-cache-collide`) [src:derived/kb-crossref] [H]

## switch-01-fork

- A (maps/obstacles.md): original `switch_01` 250 HP and explodes [src:kong/relaunch-client-defs] [H]
- B (maps/obstacles.md): survev 100 HP, no explosion [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:385] [H]
- C (mechanics/explosions.md): `switch_01` explodes (`explosion_barrel`, 250 HP) [src:kong/relaunch-client-defs] [H]
- D (mechanics/explosions.md): no explosion and 100 HP after the fork's twins-bunker rework [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:180-189] [src:derived/survev-git-f0107b35] [H]
- proposed resolution: rule 1: original `switch_01` 250 HP and explodes with `explosion_barrel` (cosmetic, the switch is indestructible either way) [src:kong/relaunch-client-defs] [H]
- files: `maps/obstacles.md` (`switch-01-fork`), `mechanics/explosions.md` (`switch-01-explosion`) [src:derived/kb-crossref] [H]

## tree-13-palm

- A: original palm tree is a grass tree like `tree_01` [src:kong/relaunch-client-defs] [H]
- B: survev beach palm with smaller collision [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1537] [H]
- proposed resolution: original values [src:derived/readme-precedence] [H]
- files: `maps/obstacles.md` (`tree-13-palm`) [src:derived/kb-crossref] [H]

## cache-minimap

- A: original shows stone and tree caches on the minimap [src:kong/relaunch-client-defs] [H]
- B: survev hides them [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:911]; fandom says caches are easy to spot because they look the same on every map [src:fandom/Cache] [H]
- proposed resolution: original (shown) [src:derived/readme-precedence] [M]
- files: `maps/obstacles.md` (`cache-minimap`) [src:derived/kb-crossref] [H]

## halloween-place-names

- A: survev Halloween uses Main's names [src:survev/shared/defs/maps/halloweenDefs.ts:201-276] [H]
- B: fandom's 2019 Halloween names (Tarscary, Bloodbath, Ranchito Muerto, Strashny Prizrak, Haunted Hollow, Pumpkin, Fields of Death, The Killpit) [src:fandom/Maps] [src:fandom/Halloween_Map] [M]
- proposed resolution: use the 2019 names for Halloween 0.8.82 at Main's coordinates (pairing by original name) [src:derived/readme-precedence] [M]
- files: `maps/places.md` (`halloween-place-names`) [src:derived/kb-crossref] [H]

## classic-place-count

- A: wiki.gg Classic lists 7 places without Todesfelde [src:wikigg/Classic_mode] [M]
- B: 8 places in the def [src:survev/shared/defs/maps/baseDefs.ts:839-872] and fandom [src:fandom/Maps] [H]
- proposed resolution: 8 [src:derived/readme-precedence] [H]
- files: `maps/places.md` (`classic-place-count`) [src:derived/kb-crossref] [H]

## southhaven-spelling

- A: "Southaven" [src:fandom/Maps] [M]
- B: "Southhaven" [src:survev/shared/defs/maps/desertDefs.ts:273] [src:fandom/Desert_Map] [H]
- proposed resolution: "Southhaven" (def) [src:derived/readme-precedence] [M]
- files: `maps/places.md` (`southhaven-spelling`) [src:derived/kb-crossref] [H]

## strashny-spelling

- A: "Strashny Prizrak" [src:fandom/Maps] [M]
- B: "Strashnyy Prizrak" [src:fandom/Halloween_Map] [M]
- proposed resolution: "Strashny Prizrak" [src:derived/readme-precedence] [L]
- files: `maps/places.md` (`strashny-spelling`) [src:derived/kb-crossref] [H]

## woods-eye-code-era

- A: fandom says Woods later used the Halloween code (v0.9.0a) [src:fandom/Eye_Bunker] [M]
- B: survev Woods code with 10 panels [src:survev/shared/defs/puzzles.ts:3-14] [H]
- proposed resolution: 10-panel Woods code for v0.8.82 [src:derived/readme-precedence] [M]
- files: `maps/puzzles.md` (`woods-eye-code-era`) [src:derived/kb-crossref] [H]

## reserve-lock-cooldown

- A: survev `control_panel_07de` cooldown 27 s [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:338] [H]
- B: wiki.gg 15 s [src:wikigg/The_Reserve] [M]
- proposed resolution: fork content, drop for v0.8.82 [src:derived/readme-precedence] [L]
- files: `maps/puzzles.md` (`reserve-lock-cooldown`) [src:derived/kb-crossref] [H]

> **Mechanics**

## airstrike-plane-count

- A: natural strikes use 3–5 planes (weights per circle) [src:survev/shared/defs/maps/factionDefs.ts:107-187] [src:wikigg/50v50_mode] [H]
- B: "can range from 2 to 5" [src:fandom/Air_Strike] [M]
- proposed resolution: keep 3–5 [src:derived/readme-precedence] [L]
- files: `mechanics/airdrop-airstrike.md` (`airstrike-plane-count`) [src:derived/kb-crossref] [H]

## faction-airstrike-timing

- A (mechanics/airdrop-airstrike.md): 50v50 air strike #2 at circleIdx 2 wait 30 s (timer 0:20) [src:survev/shared/defs/maps/factionDefs.ts:127-128] [H]
- B (mechanics/airdrop-airstrike.md): timer 0:26 (wait 24 s) [src:fandom/50v50_Map] [src:fandom/50v50_Last_Sacrifice_Map] [M]
- C (mechanics/airdrop-airstrike.md): air strike #4 at circleIdx 4 wait 21 s (timer 0:09) [src:survev/shared/defs/maps/factionDefs.ts:162-163] [H]
- D (mechanics/airdrop-airstrike.md): timer 0:12 (wait 18 s) [src:fandom/50v50_Map] [src:fandom/50v50_Last_Sacrifice_Map] [M]
- E (modes/faction.md): strikes #2 and #4 at wait 24 and 18 s [src:fandom/50v50_Map] [src:derived/survev-git-42f052d8] [M]
- F (modes/faction.md): fork 30 and 21 s [src:survev/shared/defs/maps/factionDefs.ts:127-163] [H]
- proposed resolution: rule 2 (pre-fork survev + fandom timers): air strike #2 at circleIdx 2 wait 24 s, #4 at circleIdx 4 wait 18 s; fork 30 / 21 s behind a flag [src:fandom/50v50_Map] [src:derived/survev-git-42f052d8] [M]
- files: `mechanics/airdrop-airstrike.md` (`faction-airstrike-2-time`), `mechanics/airdrop-airstrike.md` (`faction-airstrike-4-time`), `modes/faction.md` (`faction-airstrike-timing`) [src:derived/kb-crossref] [H]

## faction-gold-drop

- A (mechanics/airdrop-airstrike.md): golden military drop triggered by team-imbalance on kill, with a bonus strike [src:survev/server/src/game/objects/plane.ts:212-296] [H]
- B (mechanics/airdrop-airstrike.md): a fixed, predetermined per-match schedule [src:fandom/50v50_Map] [src:fandom/50v50_Last_Sacrifice_Map] [M]
- C (modes/faction.md): v0.8.82 gold military drop "on its own schedule, same time each match" (time unknown) [src:fandom/50v50_Map] [M]
- D (modes/faction.md): fork comeback drop triggered by alive-count imbalance [src:survev/server/src/game/objects/plane.ts:212-231] [H]
- proposed resolution: one scheduled gold military drop per match (fandom: same time each match); time unknown, so a config knob defaulting to mid-game (circleIdx 2–3); survev's imbalance trigger behind a fork flag [src:fandom/50v50_Map] [L]
- files: `mechanics/airdrop-airstrike.md` (`faction-golden-drop-trigger`), `modes/faction.md` (`faction-gold-drop-timing`) [src:derived/kb-crossref] [H]

## desert-airdrop-weights

- A: desert crates `01` w12 / `02de` w1 / `05` w1 [src:survev/shared/defs/maps/desertDefs.ts:48-66] [H]
- B: original `01` w10 / `02de` w1 [src:balance/319] [H]
- proposed resolution: original weights, no `airdrop_crate_05` [src:derived/readme-precedence] [H]
- superseded by the survev baseline (docs/adr/0003-survev-baseline.md): the port takes survev's 01 w12 / 02de w1 / 05 w1 [src:survev/shared/defs/maps/desertDefs.ts:48-66] [H]
- files: `mechanics/airdrop-airstrike.md` (`desert-airdrop-weights`) [src:derived/kb-crossref] [H]

## airdrop-crush-damage

- A (mechanics/airdrop-airstrike.md): `GameConfig.airdrop.crushDamage = 100` [src:survev/shared/gameConfig.ts:285] [src:kong/relaunch-client-bundle] and fandom trivia that Flak Jacket and Cast Ironskin holders survive standing under a landing drop [src:fandom/Flak_Jacket] [src:fandom/Cast_Ironskin] [H]
- B (mechanics/airdrop-airstrike.md): the server applying 1e10 [src:survev/server/src/game/objects/airdrop.ts:86-91] [H]
- C (mechanics/damage-armor.md): 1e10 [src:survev/server/src/game/objects/airdrop.ts:89] [H]
- D (mechanics/damage-armor.md): original config `crushDamage: 100` and wiki notes that damage perks let players survive a landing crate [src:derived/survev@9f64948d:src/gameConfig.ts:145] [src:fandom/Cast_Ironskin] [src:fandom/Flak_Jacket] [H]
- proposed resolution: rule 1: deal the client-visible `crushDamage` 100 through Cast Ironskin / Flak Jacket reduction (fits the fandom trivia and the Lone Survivr "half health" note); survev's 1e10 instant kill as a knob; whether armour applies stays open [src:derived/survev@9f64948d:src/gameConfig.ts:145] [src:fandom/Lone_Survivr] [L]
- note: `mechanics/airdrop-airstrike.md` proposed survev's instant kill by default; this entry prefers the finite value per rule 1 [src:derived/kb-crossref] [L]
- files: `mechanics/airdrop-airstrike.md` (`crush-damage`), `mechanics/damage-armor.md` (`airdrop-crush-damage`) [src:derived/kb-crossref] [H]

## flare-gun-hut

- A: flare gun refused inside any intact roofed building, huts included [src:survev/server/src/game/objects/player.ts:2166-2186] [src:survev/server/src/game/weaponManager.ts:731-736] [H]
- B: fandom saying it can be fired inside a hut [src:fandom/Flare_Gun] [M]
- proposed resolution: keep survev's rule, expose "destructible roofs count as outside" as a knob (it would match air drops being allowed to land on such roofs) [src:derived/readme-precedence] [L]
- files: `mechanics/airdrop-airstrike.md` (`flare-gun-hut`) [src:derived/kb-crossref] [H]

## boost-speed-threshold

- A: one +1.85 step at ≥ 50 [src:survev/server/src/game/objects/player.ts:4735] [src:fandom/Adrenaline] [src:namu/Surviv.io] [H]
- B: a second step at 90 % [src:fandom/Consumables] [M]
- C: from 3/4 [src:namu/Surviv.io/팁] [M]
- proposed resolution: single step at 50 [src:derived/readme-precedence] [M]
- files: `mechanics/boost.md` (`boost-speed-threshold`) [src:derived/kb-crossref] [H]

## lifeline-decay

- A: decay × 0.75 = 0.28125/s [src:survev/shared/defs/gameObjects/perkDefs.ts:91] [H]
- B: "20 % slower (0.3/s)" [src:wikigg/Indomitable_Spirit] [M]
- proposed resolution: fork-only perk, out of scope for 0.8.82 [src:derived/readme-precedence] [L]
- files: `mechanics/boost.md` (`lifeline-decay`) [src:derived/kb-crossref] [H]

## steelskin-zone-bug

- A: survev never reduces gas with perks [src:survev/server/src/game/objects/player.ts:2454-2458] [H]
- B: 0.8.8 shipped with Cast Ironskin and Flak Jacket reducing red zone and airdrop damage, fixed on 2019-12-04 [src:wikigg/Cast_Ironskin] [src:fandom/Cast_Ironskin] [src:fandom/Flak_Jacket]. Fandom's fix entry names only the Red Zone, so airdrop damage stayed reduced (matching its "survives a landing crate" trivia), while wiki.gg's current Cast Ironskin text excludes airdrops too and its Flak Jacket page dates the fix "November 4th, 2019", which is before 0.8.8 [src:wikigg/Flak_Jacket] [M]
- proposed resolution: no perk reduction against gas (the fix predates 0.8.82); keep the perk reduction against airdrop crush [src:derived/readme-precedence] [M]
- files: `mechanics/damage-armor.md` (`steelskin-zone-bug`) [src:derived/kb-crossref] [H]

## vault-open-time

- A: bank vault `openDelay 4.1` s [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:382-401] [H]
- B: "takes about 3 seconds to open" [src:fandom/Vault_Door] [M]
- proposed resolution: 4.1 s (client-visible def; the fandom estimate likely excludes the swing animation) [src:derived/readme-precedence] [M]
- files: `mechanics/doors-layers-ceilings.md` (`vault-open-time`) [src:derived/kb-crossref] [H]

## door-height

- A: door obstacle height 10 [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:32] [src:kong/relaunch-client-defs] [H]
- B: fandom infobox height 0 [src:fandom/Door] [M]
- proposed resolution: 10 [src:derived/readme-precedence] [H]
- files: `mechanics/doors-layers-ceilings.md` (`door-height`) [src:derived/kb-crossref] [H]

## teahouse-door-destructible

- A: manual sliding door `teahouse_door_01` is concrete and indestructible [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:502-526] [H]
- B: fandom infobox "hp 150, destroy: Yes" [src:fandom/Sliding_Door] [M]
- proposed resolution: client def (indestructible) [src:derived/readme-precedence] [H]
- files: `mechanics/doors-layers-ceilings.md` (`teahouse-door-destructible`) [src:derived/kb-crossref] [H]

## bleed-escalation-shape

- A (mechanics/downed-revive.md): survev uses `downedCount × 1.25` (2.5, 5, 7.5 per tick) [src:survev/server/src/game/objects/player.ts:1618] [H]
- B (mechanics/downed-revive.md): survev's first implementation compounding ×1.25 per down (2.5, 3.125, 3.9) [src:derived/survev-git-e16781bd] [H]
- C (modes/faction.md): 2 × downedCount × 1.25 HP per tick [src:survev/server/src/game/objects/player.ts:1614-1621] [H]
- D (modes/faction.md): "25 % faster than the previous time" [src:wikigg/50v50_mode] [M]
- proposed resolution: survev's linear `downedCount × 1.25` as the default knob; the compounding × 1.25 per down (survev's first version, closer to wiki.gg's "25 % faster than the previous time") as the alternative [src:survev/server/src/game/objects/player.ts:1614-1621] [src:derived/survev-git-e16781bd] [L]
- files: `mechanics/downed-revive.md` (`bleed-escalation-shape`), `modes/faction.md` (`faction-bleed-escalation`) [src:derived/kb-crossref] [H]

## down-health-50

- A (mechanics/downed-revive.md): down at 50 HP once the gas radius is ≤ 0.1 [src:survev/server/src/game/objects/player.ts:2590-2592] [H]
- B (mechanics/downed-revive.md): fandom: after multiple self-revives "some other feature kicks in" and gas-downs give less health [src:fandom/Revivify] [M]
- C (mechanics/gas.md): survev downs players at 50 HP once `currentRad ≤ 0.1` u, i.e. after the zone has fully closed (fork fix) [src:survev/server/src/game/objects/player.ts:2590-2592] [H]
- D (mechanics/gas.md): the original having some health penalty after multiple revives [src:fandom/Revivify] [M]
- E (mechanics/gas.md): namu saying gas damage never exceeds 100 while reviving, allowing endless survival [src:namu/Surviv.io] [M]
- proposed resolution: keep survev's 50 HP final-circle rule on by default (`rules.downHealthFinalCircle`; survev is the gameplay baseline since ADR 0003, and fandom also reports an anti-Revivify penalty in the original), with the knob off for namu's endless-survival reading [src:survev/server/src/game/objects/player.ts:2590-2592] [src:derived/survev-git-042e29c7] [src:user/2026-10-07-survev-baseline] [src:fandom/Revivify] [M]
- note: with the rule off, a lone Revivify holder knocked in the closed zone (100 HP) survives its 8 s self revive (4 gas ticks of 22 = 88), stands up at 24 HP and is knocked again two ticks later, forever: a 50v50 match whose last player on each side holds Revivify (the Medic) never ends (bots `faction.test.ts` seed 11 ran to its time limit) [src:derived/faction-seed11-stall] [H]
- note: this entry used to follow `mechanics/gas.md` (ship without the rule); `mechanics/downed-revive.md` proposed keeping survev's rule, which this entry now follows [src:derived/kb-crossref] [L]
- files: `mechanics/downed-revive.md` (`down-health-50`), `mechanics/gas.md` (`gas-revivify-final-circle`) [src:derived/kb-crossref] [H]

## revive-drop-cancel

- A: dropping an item cancels the action, revives included [src:survev/server/src/game/objects/player.ts:4242-4243] [H]
- B: "A reviver can drop items without interrupting reviving" [src:fandom/Knocked_Out] [M]
- proposed resolution: exempt Revive actions from the drop cancel [src:derived/readme-precedence] [M]
- files: `mechanics/downed-revive.md` (`revive-drop-cancel`) [src:derived/kb-crossref] [H]

## medic-revived-aoe

- A: survev revives the AoE group only when the medic completes a revive themselves [src:survev/server/src/game/objects/player.ts:1716-1735] [src:survev/server/src/game/objects/player.ts:3279-3300] [H]
- B: "triggered when the Medic is healing or reviving themselves or if a Player is reviving the Medic" [src:fandom/Mass_Medicate] [src:wikigg/Mass_Medicate], consistent with the original client drawing the revive aura on a medic being revived [src:survev/client/src/objects/player.ts:1757-1763] [M]
- proposed resolution: also run the medic's AoE revive when a teammate's revive of the medic completes [src:derived/readme-precedence] [M]
- files: `mechanics/downed-revive.md` (`medic-revived-aoe`) [src:derived/kb-crossref] [H]

## takedown-credit-trigger

- A: Takedown runs for the credited player, so finishing a teammate's knock triggers the downer's Takedown, not the finisher's [src:survev/server/src/game/objects/player.ts:2693-2725] [src:wikigg/Takedown] [H]
- B: "Killing a player who was knocked by a player other than yourself will still activate the perk, but the kill will go to whoever knocked the player" [src:fandom/Takedown] [M]
- proposed resolution: follow fandom for 0.8.82 (wiki.gg documents the fork) and keep survev's rule as a knob [src:derived/readme-precedence] [L]
- files: `mechanics/downed-revive.md` (`takedown-credit-trigger`) [src:derived/kb-crossref] [H]

## revivify-version

- A: Revivify added in 0.8.65 [src:changelog/0.8.65] [src:wikigg/Revivify] [H]
- B: v0.8.5 "Proxy party" [src:fandom/Revivify], although fandom's own date (October 22, 2019) is the 0.8.65 release date [src:changelog/0.8.65] [M]
- proposed resolution: 0.8.65 (changelog) [src:derived/readme-precedence] [H]
- files: `mechanics/downed-revive.md` (`revivify-version`) [src:derived/kb-crossref] [H]

## mirv-radius

- A: MIRV main charge radius 5–12 [src:survev/shared/defs/gameObjects/explosionsDefs.ts:111-120] [src:kong/relaunch-client-defs] [H]
- B: 4–8 in the fandom infobox [src:fandom/MIRV_Grenade] [M]
- proposed resolution: 5–12 (fandom copied the mini values) [src:derived/readme-precedence] [H]
- files: `mechanics/explosions.md` (`mirv-radius`) [src:derived/kb-crossref] [H]

## explosion-falloff-curve

- A: step falloff (`remap(dist, 0, rad.max)`, a ~42 % drop at `rad.min`) [src:survev/server/src/game/objects/explosion.ts:195-200] [H]
- B: survev's own earlier smooth remap from `rad.min` [src:derived/survev-git-7a59be97] [H]
- proposed resolution: keep survev's current curve (based on captured data per its authors) but expose both as a knob [src:derived/readme-precedence] [L]
- files: `mechanics/explosions.md` (`explosion-falloff-curve`) [src:derived/kb-crossref] [H]

## gas-first-wait

- A: first wait is 80 s (survev stage 1, fandom step 0) [src:survev/server/src/game/objects/gas.ts:21-26] [src:fandom/Red_Zone] [H]
- B: "after 1 minute and 15 seconds the safe zone will start shrinking" [src:wikigg/Red_Zone] [M]
- proposed resolution: keep 80 s; wiki.gg is loose prose [src:derived/readme-precedence] [L]
- files: `mechanics/gas.md` (`gas-first-wait`) [src:derived/kb-crossref] [H]

## gas-final-damage

- A: final-circle damage 22 per 2 s [src:survev/server/src/game/objects/gas.ts:93-116] [src:fandom/Red_Zone] [H]
- B: "24 damage every 2 seconds" in the late stages [src:fandom/Med_Kit] [M]
- proposed resolution: 22 (two sources agree), configurable [src:derived/readme-precedence] [L]
- files: `mechanics/gas.md` (`gas-final-damage`) [src:derived/kb-crossref] [H]

## gas-vestigial-damage

- A: early-circle damage 1.4 / 2.2 per tick [src:survev/server/src/game/objects/gas.ts:21-44] [src:fandom/Red_Zone] [H]
- B: `damagePerTick` 0.012 / 0.02 (×100 = 1.2 / 2.0) in survev's first import [src:derived/survev@9f64948d:src/gameConfig.ts:87-101] [H]
- proposed resolution: use the stage table; treat the old block as an earlier balance [src:derived/readme-precedence] [L]
- files: `mechanics/gas.md` (`gas-vestigial-damage`) [src:derived/kb-crossref] [H]

## gas-escalation

- A: time-in-gas escalation and flat 22 for disconnected players exist in survev [src:survev/server/src/game/objects/player.ts:1648-1669] [src:wikigg/Red_Zone] [H]
- B: both added in 2026 fork commits, with no trace in original sources [src:derived/survev-git-4e195a72] [src:derived/survev-git-a39e9ea8] [H]
- proposed resolution: disable both for 0.8.82, keep as fork options [src:derived/readme-precedence] [M]
- files: `mechanics/gas.md` (`gas-escalation`) [src:derived/kb-crossref] [H]

## takedown-hp

- A: +25 HP [src:survev/shared/defs/gameObjects/perkDefs.ts:86] [H]
- B: +15 HP / "similar to using a bandage" [src:wikigg/Takedown] [src:wikigg/Health] [src:fandom/Takedown] [M]
- proposed resolution: 15 for 0.8.82 with a knob (wikis agree, survev has no source) [src:derived/readme-precedence] [L]
- files: `mechanics/heal-actions.md` (`takedown-hp`) [src:derived/kb-crossref] [H]

## loot-pickup-cancel

- A: survev refuses non-gun pickups during a heal without cancelling it, and gun pickups go through [src:survev/server/src/game/objects/player.ts:3718-3723] [H]
- B: "You cannot switch weapons, drop or pick up equipment, or attack while consuming or it will stop" [src:fandom/Consumables] [M]
- proposed resolution: keep survev's refusal (the use is not lost) and log it [src:derived/readme-precedence] [L]
- files: `mechanics/heal-actions.md` (`loot-pickup-cancel`) [src:derived/kb-crossref] [H]

## gotw-while-downed

- A: survev keeps Gift of the Woods regen while downed [src:survev/server/src/game/objects/player.ts:1555-1557] [H]
- B: "You cannot gain health by any means while knocked out" [src:fandom/Health] [M]
- proposed resolution: no regen while downed [src:derived/readme-precedence] [M]
- files: `mechanics/heal-actions.md` (`gotw-while-downed`) [src:derived/kb-crossref] [H]

## military-crate-contents

- A (mechanics/loot.md): `crate_12` rolls uncommon 7–8, armor 5–6, scopes 7–8, melee 6–7, no katana [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:741] [src:balance/263-268] [H]
- B (mechanics/loot.md): uncommon 4–6, armor 4–5, scopes 6–8, melee 5–7 + `tier_katanas` 1 [src:kong/relaunch-client-defs] [src:fandom/Meteor_Crate] [H]
- C (mechanics/loot.md): `crate_13` rare 5, scopes 7–8, `tier_airdrop_melee` 2–3, faction melee 3, no katana [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:813] [src:balance/270-274] [H]
- D (mechanics/loot.md): rare 3–4, scopes 6–8, faction melee 3–4, `tier_katanas` 1, no airdrop melee [src:kong/relaunch-client-defs] [src:fandom/Meteor_Crate] [H]
- E (modes/faction.md): v0.8.82 `crate_12` uncommon 4–6 / armor 4–5 / scopes 6–8 / melee 5–7 + katana and `crate_13` rare 3–4 / faction melee 3–4 + katana [src:kong/relaunch-client-defs] [H]
- F (modes/faction.md): fork 7–8 / 5–6 / 7–8 / 6–7 and rare 5 / melee 3 + 2–3 airdrop melee [src:balance/263-274] [H]
- proposed resolution: rule 1: relaunch client values: `crate_12` uncommon 4–6, armor 4–5, scopes 6–8, melee 5–7 + `tier_katanas` 1; `crate_13` rare 3–4, scopes 6–8, faction melee 3–4 + `tier_katanas` 1 [src:kong/relaunch-client-defs] [H]
- files: `mechanics/loot.md` (`military-crate-contents`), `mechanics/loot.md` (`gold-military-crate-contents`), `modes/faction.md` (`faction-military-crate-counts`) [src:derived/kb-crossref] [H]

## cobalt-pod-loot

- A (mechanics/loot.md): survev Cobalt pods (scout 2 sodas; healer `tier_health_healer`; demo `tier_throwables_demo` 3–4 + chest01 + 2x scope; assault +5 bandages + chest01; rare demo `tier_throwables_demo` 4–5) [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1259-1417] [src:balance/293-307] [H]
- B (mechanics/loot.md): original (scout 3 sodas; healer healthkit; demo 6 MIRVs; assault no bandages/chest; rare demo 1 `tier_airdrop_throwables`) [src:kong/relaunch-client-defs] [src:fandom/Loot_tables/Class_Pod] [src:namu/Surviv.io/이벤트] [H]
- C (modes/cobalt.md): v0.8.82 pods (3 sodas scout, 6 MIRVs demo, no vest/bandages assault, med kit healer) [src:kong/relaunch-client-defs] [src:fandom/Class_Pod] [H]
- D (modes/cobalt.md): fork pod changes [src:balance/293-307] [H]
- proposed resolution: rule 1: relaunch client pod contents (scout 3 sodas, healer med kit, demo 6 MIRVs, assault no bandages or vest, rare demo 1 `tier_airdrop_throwables`) [src:kong/relaunch-client-defs] [H]
- files: `mechanics/loot.md` (`class-pod-contents`), `modes/cobalt.md` (`cobalt-pod-loot`) [src:derived/kb-crossref] [H]

## airdrop-uncommon-weights

- A: survev `tier_airdrop_uncommon` has mosin 1.5, scout_elite 2.5 and adds bar 1, vss 2.5 [src:survev/shared/defs/maps/baseDefs.ts:596-611] [H]
- B: mosin 2.5, scout_elite 1.5, no bar/vss [src:fandom/Loot_tables/Airdrops] [M]
- proposed resolution: fandom v0.7.9 weights, plus later 0.8.x additions only if evidenced [src:derived/readme-precedence] [L]
- files: `mechanics/loot.md` (`airdrop-uncommon-weights`) [src:derived/kb-crossref] [H]

## airdrop-ammo-stack

- A: `tier_airdrop_ammo` stacks of 30/30/30/5 [src:survev/shared/defs/maps/baseDefs.ts:637-642] [H]
- B: 60/60/60/10 [src:fandom/Loot_tables/Airdrops] [M]
- proposed resolution: keep survev's (fandom appears to duplicate Tier Ammo) but expose a knob [src:derived/readme-precedence] [L]
- files: `mechanics/loot.md` (`airdrop-ammo-stack`) [src:derived/kb-crossref] [H]

## airdrop-scopes-none-weight

- A: `tier_airdrop_scopes` "" weight 24 [src:survev/shared/defs/maps/baseDefs.ts:662-667] [H]
- B: 18 [src:fandom/Loot_tables/Airdrops] [M]
- proposed resolution: 18 (fandom data) [src:derived/readme-precedence] [L]
- files: `mechanics/loot.md` (`airdrop-scopes-none-weight`) [src:derived/kb-crossref] [H]

## tier-guns-flare-weight

- A: `flare_gun` 0.145 and `flare_gun_dual` 0.0025 in `tier_guns` [src:survev/shared/defs/maps/baseDefs.ts:253-286] [H]
- B: 0.1 (fandom main page) / 0.01 (fandom basic subpage) [src:fandom/Loot_tables] [src:fandom/Loot_tables/Basic] [M]
- proposed resolution: 0.1 [src:derived/readme-precedence] [L]
- files: `mechanics/loot.md` (`tier-guns-flare-weight`) [src:derived/kb-crossref] [H]

## main-tier-guns-snipers

- A (mechanics/loot.md): `mosin` 0.05 and `scout_elite` 0.1 [src:survev/shared/defs/maps/baseDefs.ts:253-286] [H]
- B (mechanics/loot.md): 0.1 and 0.05 [src:fandom/Loot_tables] [M]
- C (modes/main.md): mosin 0.05 / scout_elite 0.1 / vss 0.1 [src:survev/shared/defs/maps/baseDefs.ts:263] [H]
- D (modes/main.md): mosin 0.1 / scout_elite 0.05 / vss ~0.1 [src:derived/git-ae55c9a8, fandom/Loot_tables/Basic] [H]
- proposed resolution: original `mosin` 0.1, `scout_elite` 0.05, `vss` 0.1 (pre-fork survev + fandom) [src:derived/git-ae55c9a8] [src:fandom/Loot_tables/Basic] [M]
- files: `mechanics/loot.md` (`tier-guns-mosin-scout`), `modes/main.md` (`main-tier-guns-snipers`) [src:derived/kb-crossref] [H]

## soviet-crate-medical

- A (mechanics/loot.md): `crate_02sv` / `crate_02sv_lake` add `tier_medical` 1 [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:391-409] [H]
- B (mechanics/loot.md): no medical roll [src:kong/relaunch-client-defs] [H]
- C (modes/savannah.md): `crate_02sv` and `crate_02sv_lake` without tier_medical [src:kong/relaunch-client-defs] [H]
- D (modes/savannah.md): survev adding 1 × tier_medical [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:391-409] [H]
- proposed resolution: rule 1: no `tier_medical` roll in `crate_02sv` / `crate_02sv_lake` [src:kong/relaunch-client-defs] [H]
- files: `mechanics/loot.md` (`soviet-crate-medical`), `modes/savannah.md` (`savannah-crate-medical`) [src:derived/kb-crossref] [H]

## extra-outfit-rolls

- A: survev adds `tier_fragtastic` to `crate_03`, `tier_khaki_outfit` to `locker_03`, `outfitSpetsnaz` to `mil_crate_03`, and replaces `outfitRoyalFortune` with `tier_pirate_outfits` in `chest_01` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:448] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1445] [H]
- B: none of these in the client [src:kong/relaunch-client-defs] [H]
- proposed resolution: client values [src:derived/readme-precedence] [H]
- files: `mechanics/loot.md` (`extra-outfit-rolls`) [src:derived/kb-crossref] [H]

## squash-01-def

- A (mechanics/loot.md): `squash_01` rolls `tier_world` 0–1 [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:763] [H]
- B (mechanics/loot.md): `tier_fruit_xp` 1 [src:kong/relaunch-client-defs] [H]
- C (modes/turkey.md): r1.25, hidden on the minimap, sprite `map-squash-01`, loot Perky Shoot + `tier_fruit_xp` [src:kong/relaunch-client-defs, fandom/Green_Squash] [H]
- D (modes/turkey.md): r1, minimap dot, sprite `map-squash-03`, loot Perky Shoot + 0–1 `tier_world` [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:763-777] [H]
- proposed resolution: rule 1: original `squash_01` (r 1.25, hidden on the minimap, sprite `map-squash-01`, loot Perky Shoot + `tier_fruit_xp`) [src:kong/relaunch-client-defs] [H]
- files: `mechanics/loot.md` (`squash-loot`), `modes/turkey.md` (`squash-01-def`) [src:derived/kb-crossref] [H]

## container-outfit-weight

- A: `tier_container` outfits 0.035 and `tier_toilet` outfits 0.025 [src:survev/shared/defs/maps/baseDefs.ts:110-139] [H]
- B: fandom's alternative 0.11 / 0.20 [src:fandom/Loot_tables/General] [M]
- proposed resolution: survev values (fandom itself favours them if "50v50 is normal") [src:derived/readme-precedence] [L]
- files: `mechanics/loot.md` (`container-outfit-weight`) [src:derived/kb-crossref] [H]

## water-penalty-depth

- A: flat −3 anywhere in water [src:survev/server/src/game/objects/player.ts:4726-4732] [src:fandom/Player] [H]
- B: "the further into a body of water a Player wades, the greater the slowing effect becomes, to a maximum of −2" [src:fandom/Water] [M]
- proposed resolution: keep the flat −3 (two sources, fandom Player and One With Nature pages agree) and expose `waterSpeedPenalty` as a knob [src:derived/readme-precedence] [L]
- files: `mechanics/movement.md` (`water-penalty-depth`) [src:derived/kb-crossref] [H]

## downed-melee-equip-bonus

- A: survev adds the forced melee's +1 equip bonus while downed (5 u/s, 3 u/s being revived) [src:survev/server/src/game/objects/player.ts:4702-4720] [H]
- B: 4 u/s downed and 2 u/s being revived [src:fandom/Player] [M]
- proposed resolution: skip the equip bonus while downed so the wiki numbers hold [src:derived/readme-precedence] [L]
- files: `mechanics/movement.md` (`downed-melee-equip-bonus`) [src:derived/kb-crossref] [H]

## reviver-speed

- A: reviver base 6 + equip and boost (estimate in code) [src:survev/server/src/game/objects/player.ts:4697] [H]
- B: "a 0.5x speed multiplier is applied to both" [src:fandom/Knocked_Out] [M]
- proposed resolution: reviver = normal speed formula × 0.5 (12 → 6 with a gun, matching survev's base), downed target stays at 2 [src:derived/readme-precedence] [L]
- files: `mechanics/movement.md` (`reviver-speed`) [src:derived/kb-crossref] [H]

## takedown-haste-low-hp

- A: survev always grants the 3 s Takedown haste on a credited kill [src:survev/server/src/game/objects/player.ts:2721-2725] [H]
- B: "if your Health is below 50, you will not get the speed boost" [src:fandom/Takedown] [M]
- proposed resolution: always grant it (wiki.gg lists no such condition [src:wikigg/Takedown]) and log the fandom claim [src:wikigg/Takedown] [L]
- files: `mechanics/movement.md` (`takedown-haste-low-hp`) [src:derived/kb-crossref] [H]

> **Modes and events**

## beach-identity

- A (modes/beach.md): the 2020 Beach Party map (palm-reskinned normal map with Water Gun, Water Balloon, Popsicle, Ice Box, Speedo) [src:fandom/Beach_Map] [src:fandom/Changelog] [M]
- B (modes/beach.md): survev's 2025 "Beach" map with coconuts, pirate hut and beach mansion [src:survev/shared/defs/maps/beachDefs.ts:7-268] [H]
- C (provenance/fork-vs-original.md): the original Beach Map (v0.9.5b, 2020-06-15) had the Water Gun, Popsicle, Speedo and Ice Box [src:fandom/Beach_Map] [M]
- D (provenance/fork-vs-original.md): survev's Beach with palms, Pirate Hut, Cutlass and Coconut [src:wikigg/Beach_mode, survev/client/public/changelogRec.html:343] [M]
- proposed resolution: survev `beach` is fork content; the 2020 Beach Party map is post-0.8.82 optional content that survev does not contain [src:fandom/Beach_Map] [src:survev/client/public/changelogRec.html:343] [H]
- files: `modes/beach.md` (`beach-identity`), `provenance/fork-vs-original.md` (`beach-original-vs-survev`) [src:derived/kb-crossref] [H]

## beach-biome-colours

- A: 2020 water 0x3576c8, beach 0xcfab88, riverbank 0xb4895f, grass 0xa5b85d, ghillie 0x83af50 [src:fandom/Beach_Map] [M]
- B: survev water 0x42b0ba, beach 0xffe7ba, riverbank 0xa37119, grass 0x7ba865, ghillie 0x7dac66 [src:survev/shared/defs/maps/beachDefs.ts:21-33] [H]
- proposed resolution: fandom values for any 2020 recreation [src:derived/readme-precedence] [M]
- files: `modes/beach.md` (`beach-biome-colours`) [src:derived/kb-crossref] [H]

## beach-event-start

- A (modes/beach.md): Jun 15, 2020 (v0.9.5b post date) [src:fandom/Changelog] [M]
- B (modes/beach.md): Jun 16, 2020 [src:namu/Surviv.io/이벤트] [M]
- C (modes/events.md): Jun 15, 2020 [src:fandom/Changelog] [M]
- proposed resolution: Jun 15, 2020 US time (= Jun 16 KST) [src:fandom/Changelog] [src:namu/Surviv.io/이벤트] [M]
- files: `modes/beach.md` (`beach-event-start`), `modes/events.md` (`beach-party-start`) [src:derived/kb-crossref] [H]

## birthday-crates

- A: early-access crates were decorative until 0.0.9 [src:changelog/0.0.9] [src:wikigg/Birthday_mode] [H]
- B: survev Birthday `crate_01` dropping normal loot [src:survev/shared/defs/maps/birthdayDefs.ts:160-169] [H]
- proposed resolution: keep loot (playable) but note it as a fork choice [src:derived/readme-precedence] [M]
- files: `modes/birthday.md` (`birthday-crates`) [src:derived/kb-crossref] [H]

## birthday-key-lime

- A: Key Lime only arrived in 0.2.0 (Jan 17, 2018) [src:changelog/0.2.0] [H]
- B: Birthday's tier_outfits including it [src:survev/shared/defs/maps/birthdayDefs.ts:96-103] [H]
- proposed resolution: drop Key Lime if a faithful early-access table is wanted [src:derived/readme-precedence] [M]
- files: `modes/birthday.md` (`birthday-key-lime`) [src:derived/kb-crossref] [H]

## birthday-silo-barrel-era

- A: silos and metal barrels arrived in 0.0.8 (Nov 5, 2017), after the first release [src:changelog/0.0.8] [H]
- B: Birthday spawning both [src:survev/shared/defs/maps/birthdayDefs.ts:160-169] [H]
- proposed resolution: keep (it imitates early-to-mid November 2017) [src:derived/readme-precedence] [L]
- files: `modes/birthday.md` (`birthday-silo-barrel-era`) [src:derived/kb-crossref] [H]

## cobalt-tank-common-pack

- A: Small Pack (`backpack01`) [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1314-1323] [H]
- B: Regular Pack [src:fandom/Class_Pod] [M]
- proposed resolution: Small Pack (client def) [src:derived/readme-precedence] [H]
- files: `modes/cobalt.md` (`cobalt-tank-common-pack`) [src:derived/kb-crossref] [H]

## cobalt-class-guns

- A: pre-fork class gun tables [src:derived/survev-git-121958d2] [H]
- B: fork-extended tables with IMBEL, BAR, Scout Elite, VSS, Mk 20 SSR, SPAS-16, M1014 etc. [src:balance/182-193] [src:balance/285-292] [H]
- proposed resolution: pre-fork tables (fork-only guns removed) [src:derived/readme-precedence] [H]
- files: `modes/cobalt.md` (`cobalt-class-guns`) [src:derived/kb-crossref] [H]

## cobalt-role-timeout

- A: 20 s on the client menu [src:survev/shared/gameConfig.ts:228] [src:fandom/Cobalt_Map] [H]
- B: survev server fallback after 25 s [src:survev/server/src/game/objects/player.ts:231] [H]
- proposed resolution: 20 s, assign the highlighted or a random class [src:derived/readme-precedence] [M]
- rebirth (survev parity wave): the client confirms the highlighted class at 20 s, the server's random fallback waits 25 s like survev so that choice arrives first [src:survev/server/src/game/objects/player.ts:225-231] [src:survev/server/src/game/objects/player.ts:1497-1503] [H]
- files: `modes/cobalt.md` (`cobalt-role-timeout`) [src:derived/kb-crossref] [H]

## desert-pkp-airdrop-rare

- A: PKP 0.08 [src:survev/shared/defs/maps/desertDefs.ts:121] [H]
- B: PKP 3 [src:derived/git-ae55c9a8, fandom/Desert_Map, changelog/0.7.51] [H]
- proposed resolution: 3 (original) [src:derived/readme-precedence] [H]
- files: `modes/desert.md` (`desert-pkp-airdrop-rare`) [src:derived/kb-crossref] [H]

## desert-alt-barn

- A: `barn_02d` spawns once [src:survev/shared/defs/maps/desertDefs.ts:325, derived/git-ae55c9a8] [H]
- B: "Removed Alternate Barn from Desert Map" in 0.8.5 [src:fandom/Changelog, fandom/Desert_Map] [M]
- proposed resolution: keep `barn_02d` as a config knob defaulting to off for 0.8.82, log in open-questions [src:derived/readme-precedence] [L]
- files: `modes/desert.md` (`desert-alt-barn`) [src:derived/kb-crossref] [H]

## desert-explosive-rounds

- A: Explosive Rounds absent from the original desert `tier_perks` (fork added it in 0.3.1) [src:balance/320, derived/git-ae55c9a8] [H]
- B: "very rarely from Air Drops in Desert Mode" [src:fandom/Explosive_Rounds, fandom/Changelog] [M]
- proposed resolution: include `explosive` with a low weight, keep `amped_explosives` out [src:derived/readme-precedence] [L]
- files: `modes/desert.md` (`desert-explosive-rounds`) [src:derived/kb-crossref] [H]

## desert-model94-airdrop

- A: Model 94 weight 2 in `tier_airdrop_uncommon` [src:survev/shared/defs/maps/desertDefs.ts:114, derived/survev@9f64948d:src/defs/modes/desert.ts:105] [H]
- B: 0.01 [src:fandom/Desert_Map] [M]
- proposed resolution: 2 (two survev snapshots) [src:derived/readme-precedence] [L]
- files: `modes/desert.md` (`desert-model94-airdrop`) [src:derived/kb-crossref] [H]

## desert-warehouses

- A: 2 × `warehouse_01` + 1 × `warehouse_03`, 2 × `house_red_01` [src:survev/shared/defs/maps/desertDefs.ts:320-322] [H]
- B: 4 × `warehouse_01`, 3 × `house_red_01` [src:derived/git-ae55c9a8, balance/317] [H]
- proposed resolution: original 4 / 3, no `warehouse_03` [src:derived/readme-precedence] [H]
- files: `modes/desert.md` (`desert-warehouses`) [src:derived/kb-crossref] [H]

## desert-town-date

- A: Desert towns added in 0.6.1 (Sep 22, 2018) [src:fandom/Desert_Town] [M]
- B: added with the saloon in 0.6.5 [src:fandom/Changelog, fandom/Desert_Map] [M]
- proposed resolution: 0.6.5 [src:derived/readme-precedence] [M]
- files: `modes/desert.md` (`desert-town-date`) [src:derived/kb-crossref] [H]

## desert-boulder-m9

- A: hardstone boulders can give an M9 and one 9mm round [src:fandom/Desert_Map] [M]
- B: `tier_eye_stone` has no M9 or 9mm [src:survev/shared/defs/maps/baseDefs.ts:233-245] [H]
- proposed resolution: keep survev table, open question [src:derived/readme-precedence] [L]
- files: `modes/desert.md` (`desert-boulder-m9`) [src:derived/kb-crossref] [H]

## egg-event-eras

- A (modes/events.md): namu says Egg-pocalypse eggs drop weapons and limited outfits and give a stacking speed boost [src:namu/Surviv.io/이벤트] [src:fandom/Events] [M]
- B (modes/events.md): the 2018 eggs only dropping a disguise outfit, with Sugar Rush first appearing in the 2020 Eggsplosion [src:fandom/Egg/Before_Eggsplosion] [src:fandom/Egg] [src:changelog/0.3.2] [M]
- C (provenance/fork-vs-original.md): wiki.gg says eggs first appeared in Surviv v0.3.2 (April 2018) and were removed the next update [src:wikigg/Eggs] [M]
- D (provenance/fork-vs-original.md): fandom's Egg page, which dates egg crates to v0.9.3 (2020-04-06) [src:fandom/Egg] [M]
- proposed resolution: two separate events: the 2018 Egg-pocalypse (0.3.2, eggs drop a disguise outfit only, removed next update) and the 2020 Eggsplosion (0.9.3, Sugar Rush); `egg_01`–`egg_04` stay out of the v0.8.82 core [src:changelog/0.3.2] [src:fandom/Egg] [src:wikigg/Eggs] [L]
- files: `modes/events.md` (`egg-pocalypse-speed-boost`), `provenance/fork-vs-original.md` (`eggs-version`) [src:derived/kb-crossref] [H]

## egg-2018-outfit-pool

- A: 2018 eggs dropped 8 disguises incl. All Naded Up [src:fandom/Removed_Features] [M]
- B: survev's fork pool of 14 disguises without All Naded Up [src:survev/shared/defs/maps/baseDefs.ts:403-418] [H]
- proposed resolution: for a 2018 egg event use the fandom 8-outfit list; survev's list is fork [src:derived/readme-precedence] [L]
- files: `modes/events.md` (`egg-2018-outfit-pool`) [src:derived/kb-crossref] [H]

## rotation-schedule

- A: fandom 0.9.2/0.9.6/0.9.8 tables [src:fandom/Event_Rotation] [M]
- B: namu's 7-day example (Mon Cobalt duo, Tue Potato duo, Wed Savannah solo, Thu Woods squad, Fri 50v50 squad, Sat Meteor duo, Sun Potato solo) [src:namu/Surviv.io/이벤트] [M]
- proposed resolution: schedules changed several times; keep the fandom tables per version and treat namu's as an undated snapshot [src:derived/readme-precedence] [L]
- files: `modes/events.md` (`rotation-schedule`) [src:derived/kb-crossref] [H]

## inferno-dates

- A: Nov 3–17, 2020 [src:fandom/Inferno_Mode] [M]
- B: Nov 4–17, 2020 [src:namu/Surviv.io/이벤트] [M]
- proposed resolution: Nov 3, 1 pm PST = Nov 4 in Korea [src:derived/readme-precedence] [L]
- files: `modes/events.md` (`inferno-dates`) [src:derived/kb-crossref] [H]

## contact-start

- A: Jul 13, 2020 [src:fandom/Changelog] [src:namu/Surviv.io/이벤트] [M]
- B: Jul 14, 2020 for the Mothrship in another namu snippet [src:namu/Surviv.io/이벤트] [M]
- proposed resolution: Jul 13 US time [src:derived/readme-precedence] [L]
- files: `modes/events.md` (`contact-start`) [src:derived/kb-crossref] [H]

## summer-teahouse-count

- A: Main Summer map has 2 teahouse complexes (3 in squads) [src:fandom/Main_Summer_Map] [M]
- B: 1 in solo/duo and 2 in squad [src:fandom/Changelog] [src:survev/shared/defs/maps/mainSummerDefs.ts:87-90] [M]
- proposed resolution: 1/2 (survev, changelog secret update) [src:derived/readme-precedence] [L]
- files: `modes/events.md` (`summer-teahouse-count`) [src:derived/kb-crossref] [H]

## desert-rain-count

- A: fandom Events numbers Firepower-up as the 5th and All you can shoot as the 6th Desert Rain [src:fandom/Events] [M]
- B: 9 desert runs from 0.6.1 to 0.8.72 in the changelog [src:changelog/0.6.1] [src:changelog/0.8.72] [H]
- proposed resolution: use the 9-run list above [src:derived/readme-precedence] [L]
- files: `modes/events.md` (`desert-rain-count`) [src:derived/kb-crossref] [H]

## poppy-version

- A: Poppy page says added in "v0.9.4 update on April 6, 2020" [src:fandom/Poppy] [M]
- B: 0.9.4 on May 4, 2020 (Apr 6 was 0.9.3) [src:fandom/Changelog] [M]
- proposed resolution: May 4, 2020 [src:derived/readme-precedence] [L]
- files: `modes/events.md` (`poppy-version`) [src:derived/kb-crossref] [H]

## flamethrower-id

- A: fandom infobox gives internal id `m9A17` [src:fandom/Flamethrower]; no other source (not in survev or the relaunch client) [src:kong/relaunch-client-defs] [M]
- proposed resolution: treat the id as unverified [src:derived/readme-precedence] [L]
- files: `modes/events.md` (`flamethrower-id`) [src:derived/kb-crossref] [H]

## faction-unique-outfits

- A: Feb 2019 secret update put Cobalt Shell in the Chrysanthemum Bunker and The Professional in the Mansion [src:fandom/Changelog] [M]
- B: survev Carbon Fiber (`tier_chrys_01`) and Forest Camo (`tier_mansion_floor`) [src:survev/shared/defs/maps/factionDefs.ts:390-398] [H]
- proposed resolution: keep survev (later state unknown), log for verification [src:derived/readme-precedence] [L]
- files: `modes/faction.md` (`faction-unique-outfits`) [src:derived/kb-crossref] [H]

## faction-team-crate-count

- A: about 12 per side from density 5 on the 880 map [src:survev/shared/defs/maps/factionDefs.ts:440-441] [src:derived/faction-density-880] [H]
- B: 11 per side [src:fandom/50v50_Map] [src:wikigg/Faction_Crates] [M]
- proposed resolution: keep density 5 (rounding gives 11–12) [src:derived/readme-precedence] [M]
- files: `modes/faction.md` (`faction-team-crate-count`) [src:derived/kb-crossref] [H]

## faction-spawn-band

- A: players spawn in the outermost tenth of their half [src:survev/server/src/game/map.ts:2160-2172] [H]
- B: "the sixth farthest from the center" [src:fandom/50v50_Map] [M]
- proposed resolution: survev tenth [src:derived/readme-precedence] [M]
- files: `modes/faction.md` (`faction-spawn-band`) [src:derived/kb-crossref] [H]

## halloween-night

- A: wikis say the event happens "at night" [src:fandom/Halloween_Map, fandom/Maps] [M]
- B: survev and the original client implement only dark colours plus `valueAdjust` 0.3, no lighting system [src:survev/shared/defs/maps/halloweenDefs.ts:101, kong/relaunch-client-defs] [H]
- proposed resolution: reproduce the valueAdjust tint; any extra night overlay is new design, mark optional [src:derived/readme-precedence] [M]
- files: `modes/halloween.md` (`halloween-night`) [src:derived/kb-crossref] [H]

## halloween-jack-o-lantern-spawns

- A: jack-o'-lanterns only on cabin porches [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:7551-7558] [H]
- B: "usually found scattered around the island" [src:fandom/Jack-o'-Lantern] [M]
- proposed resolution: open question; optionally add `cache_pumpkin_02` to density spawns [src:derived/readme-precedence] [L]
- files: `modes/halloween.md` (`halloween-jack-o-lantern-spawns`) [src:derived/kb-crossref] [H]

## main-summer-colours

- A: survev main_summer beach 0xdc9e28 / riverbank 0xa37119 / grass 0x629522 (same as woods_summer and the fandom Woods Summer infobox) [src:survev/shared/defs/maps/mainSummerDefs.ts:27-29, fandom/Woods_Map] [H]
- B: fandom Main Summer infobox beach 0xf4ae48 / riverbank 0x905e24 / grass 0x5c910a (spring values) [src:fandom/Main_Summer_Map] [M]
- proposed resolution: keep survev (the wiki row looks copied from Main Spring), expose as config [src:derived/readme-precedence] [L]
- files: `modes/main.md` (`main-summer-colours`) [src:derived/kb-crossref] [H]

## spring-release-date

- A: Mar 21, 2019 [src:changelog/0.7.3] [H]
- B: Mar 20, 2019 [src:fandom/Teahouse, fandom/Maps] [M]
- proposed resolution: Mar 21 (changelog; likely a time-zone difference) [src:derived/readme-precedence] [L]
- files: `modes/main.md` (`spring-release-date`) [src:derived/kb-crossref] [H]

## potato-airdrop-rare

- A: original airdrop rare = Potato Cannon (Spud Gun weight unknown) [src:fandom/Potato_Map] [src:derived/survev-git-70a5d40f] [M]
- B: fork Potato Cannon / Spud Gun / PMG-134 at 1 each [src:survev/shared/defs/maps/potatoDefs.ts:157-161] [H]
- proposed resolution: cannon 1 + spud gun 0.1 (pre-fork), PMG-134 off [src:derived/readme-precedence] [M]
- files: `modes/potato.md` (`potato-airdrop-rare`) [src:derived/kb-crossref] [H]

## potato-ring-case

- A: Potato Cannon common, Spud Gun uncommon [src:fandom/Loot_tables] [M]
- B: fork adding PMG-134 0.2 [src:survev/shared/defs/maps/potatoDefs.ts:152-156] [H]
- proposed resolution: cannon 1, spud gun 0.1, no PMG-134 [src:derived/readme-precedence] [M]
- files: `modes/potato.md` (`potato-ring-case`) [src:derived/kb-crossref] [H]

## potato-hatchet

- A: no potato guns in the Hydra Bunker hatchet case in v0.8.82 sources [src:wikigg/Potato_mode] [M]
- B: fork tier_hatchet with all three potato guns at 0.1 [src:survev/shared/defs/maps/potatoDefs.ts:147-151] [src:derived/survev-git-c3ab6232] [H]
- proposed resolution: Main's tier_hatchet [src:derived/readme-precedence] [M]
- files: `modes/potato.md` (`potato-hatchet`) [src:derived/kb-crossref] [H]

## potato-swap-pool

- A: v0.8.82 pool has no fork guns [src:changelog/0.8.82] [H]
- B: survev pool containing imbel, barrett, sw500, ash12 [src:derived/survev-nopotatoswap-scan] [H]
- proposed resolution: build the pool from v0.8.82 item ids only [src:derived/readme-precedence] [H]
- superseded by the survev baseline (docs/adr/0003-survev-baseline.md): the pool is every weapon def without `noPotatoSwap`, survev guns included, but the rebirth's gold-only guns [src:survev/server/src/game/objects/player.ts:4057-4066] [H]
- files: `modes/potato.md` (`potato-swap-pool`) [src:derived/kb-crossref] [H]

## potato-tier-perks

- A: weighted list (Windwalk 0.25 … Martyrdom 0.1) [src:fandom/Loot_tables] [M]
- B: survev flat weights 1 plus fork perks [src:survev/shared/defs/maps/baseDefs.ts:746-763] [H]
- proposed resolution: fandom weights without Explosive Rounds (added later), as a config table [src:derived/readme-precedence] [L]
- files: `modes/potato.md` (`potato-tier-perks`) [src:derived/kb-crossref] [H]

## savannah-rivers

- A: one width-4 river [src:derived/survev-git-bbe1a377] [H]
- B: fork 1 or 2 rivers [src:survev/client/public/changelogRec.html:48] [H]
- proposed resolution: one river [src:derived/readme-precedence] [H]
- files: `modes/savannah.md` (`savannah-rivers`) [src:derived/kb-crossref] [H]

## savannah-crate-counts

- A: crate_01 50, crate_02sv 4, crate_03 8, crate_21b 2, loot_tier_1 24 [src:balance/342] [H]
- B: fork 70 / 6 / 10 / 3 / 30 [src:survev/shared/defs/maps/savannahDefs.ts:254-277] [H]
- proposed resolution: pre-fork counts (themselves estimates) [src:derived/readme-precedence] [M]
- files: `modes/savannah.md` (`savannah-crate-counts`) [src:derived/kb-crossref] [H]

## savannah-free-scope

- A: no 2x scopes on Savannah [src:fandom/Savannah_Map] [M]
- B: fork free 2x scope at spawn [src:survev/server/src/game/objects/player.ts:1449-1451] [H]
- proposed resolution: no free scope [src:derived/readme-precedence] [H]
- files: `modes/savannah.md` (`savannah-free-scope`) [src:derived/kb-crossref] [H]

## savannah-perk-pool

- A: original pool (fandom weights, no Firepower in the map's perk list) [src:fandom/Loot_tables] [src:fandom/Savannah_Map] [M]
- B: survev 17 perks at equal weight incl. fork perks [src:survev/shared/defs/maps/savannahDefs.ts:171-189] [H]
- proposed resolution: fandom-weighted pool restricted to perks existing at 0.8.82 [src:derived/readme-precedence] [L]
- files: `modes/savannah.md` (`savannah-perk-pool`) [src:derived/kb-crossref] [H]

## savannah-gold-drop-armor

- A: `crate_11sv` with tier_airdrop_armor [src:kong/relaunch-client-defs] [H]
- B: fork Experimental Pack [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:678-698] [H]
- proposed resolution: relaunch loot [src:derived/readme-precedence] [H]
- files: `modes/savannah.md` (`savannah-gold-drop-armor`) [src:derived/kb-crossref] [H]

## savannah-fork-guns

- A (modes/savannah.md): no Barrett or S&W 500 in v0.8.82 [src:changelog/0.8.3] [H]
- B (modes/savannah.md): survev Savannah tables with both [src:balance/338] [src:balance/346] [H]
- C (provenance/balance-revert.md): balance.txt gives the Barrett weight 1.5 in Savannah tier_airdrop_uncommon [src:balance/338] [H]
- D (provenance/balance-revert.md): the code has 0.075 [src:survev/shared/defs/maps/savannahDefs.ts:100] [H]
- proposed resolution: remove Barrett and S&W 500 from every Savannah table (fork-only guns) [src:changelog/0.8.3] [src:balance/338] [H]
- files: `modes/savannah.md` (`savannah-fork-guns`), `provenance/balance-revert.md` (`savannah-barrett-uncommon`) [src:derived/kb-crossref] [H]

## savannah-sv98-vs-awm

- A: the SV-98 is rarer than the AWM-S on Savannah [src:fandom/Savannah_Map] [src:namu/Surviv.io/이벤트] [M]
- A: survev's first (pre-fork) Savannah table: `tier_guns` sv98 0.1 vs awc 0.15 [src:derived/survev-git-367a7b3d] [H]
- B: fork tables: `tier_guns` sv98 0.09 vs awc 0.06, airdrop rare sv98 3 vs awc 1.5 [src:survev/shared/defs/maps/savannahDefs.ts:77-78] [src:survev/shared/defs/maps/savannahDefs.ts:105-111] [H]
- proposed resolution: pre-fork weights (SV-98 rarer than AWM-S) [src:derived/survev-git-367a7b3d] [src:fandom/Savannah_Map] [M]
- files: `modes/savannah.md` (`savannah-sv98-vs-awm`) [src:derived/kb-crossref] [H]

## snow-random-buildings

- A: 2 of snow mansion/police/bank [src:survev/shared/defs/maps/snowDefs.ts:269-274] [H]
- B: none [src:derived/git-ae55c9a8] [H]
- C: all three on the 2018 map [src:fandom/Snow_Map, changelog/0.7.7] [M]
- proposed resolution: 2-of-3 rotation as on the 0.8.82 main map, config knob for all three [src:derived/readme-precedence] [L]
- files: `modes/snow.md` (`snow-random-buildings`) [src:derived/kb-crossref] [H]

## snow-tracer-762

- A: no tracer override [src:survev/shared/defs/maps/snowDefs.ts:22-40] [H]
- B: 7.62mm tracers 0x96a1e6 / 0xabc4ff [src:fandom/Snow_Map] [M]
- proposed resolution: add the woods_snow tracer override to snow [src:derived/readme-precedence] [M]
- files: `modes/snow.md` (`snow-tracer-762`) [src:derived/kb-crossref] [H]

## snowball-crate-count

- A: `crate_03x` density 1 (≈2 per map) [src:survev/shared/defs/maps/snowDefs.ts:213, derived/git-ae55c9a8] [H]
- B: quantity 35, "as common as a grenade box" [src:fandom/Snowball_Crate] [M]
- proposed resolution: raise to grenade-crate density 8 as a config knob [src:derived/readme-precedence] [L]
- files: `modes/snow.md` (`snowball-crate-count`) [src:derived/kb-crossref] [H]

## snow-hardstone-count

- A: 3 iced `stone_04x` [src:survev/shared/defs/maps/snowDefs.ts:262] [H]
- B: 1 `stone_04` [src:balance/201, derived/git-ae55c9a8] [H]
- proposed resolution: 1 [src:derived/readme-precedence] [H]
- files: `modes/snow.md` (`snow-hardstone-count`) [src:derived/kb-crossref] [H]

## snow-tree-id

- A: `tree_10` replaces normal trees [src:survev/shared/defs/maps/snowDefs.ts:290] [H]
- B: a `tree_01x` snowy tree also present in the original client [src:kong/relaunch-client-defs] [H]
- proposed resolution: keep `tree_10`, open question [src:derived/readme-precedence] [L]
- files: `modes/snow.md` (`snow-tree-id`) [src:derived/kb-crossref] [H]

## turkey-map-look

- A (modes/turkey.md): survev gives turkey its own grey/autumn biome, autumn trees and leaf piles (fork reconstruction) [src:survev/shared/defs/maps/turkeyDefs.ts:34-44, survev/shared/defs/maps/turkeyDefs.ts:50-77] [H]
- B (modes/turkey.md): the original events ran on the normal island, the 2018 one with no map changes at all [src:namu/Surviv.io/이벤트, fandom/Perky_Shoot, fandom/Changelog] [M]
- C (ui/audiovisual-style.md): survev gives the Turkey map its own grey/brown palette [src:survev/shared/defs/maps/turkeyDefs.ts:35-45] [H]
- D (ui/audiovisual-style.md): the 0.8.82 turkey def only adds audio and `turkeyMode` on top of main [src:derived/survev@8715a605:client/js/app.js:105528-105552] [H]
- proposed resolution: main palette + `turkeyMode` (the 0.8.82 turkey def only adds audio and the mode flag); survev's autumn look as an optional theme [src:derived/survev@8715a605:client/js/app.js:105528-105552] [M]
- files: `modes/turkey.md` (`turkey-map-look`), `ui/audiovisual-style.md` (`turkey-palette`) [src:derived/kb-crossref] [H]

## turkey-gold-airdrop

- A: turkey uses the plain gold crate [src:survev/shared/defs/maps/baseDefs.ts:81-84] [H]
- B: the original client ships a dedicated turkey gold crate `airdrop_crate_02tr` (XP artifacts inside) [src:kong/relaunch-client-defs] [H]
- proposed resolution: use `airdrop_crate_02tr` as the 1-in-11 gold crate on the 2019 turkey map [src:derived/readme-precedence] [M]
- files: `modes/turkey.md` (`turkey-gold-airdrop`) [src:derived/kb-crossref] [H]

## woods-audio

- A: 0.8.82 woods preloads `log_01`, `log_02`, `ability_stim_01`, `leader_dead_01` [src:kong/relaunch-client-defs] [H]
- B: survev woods `footstep_08`, `footstep_09` and no Woods King sounds (only `woods_spring` has them) [src:survev/shared/defs/maps/woodsDefs.ts:15-20] [H]
- proposed resolution: use the original list for the autumn woods def [src:derived/readme-precedence] [H]
- files: `modes/woods.md` (`woods-audio`) [src:derived/kb-crossref] [H]

## woods-building-counts

- A: warehouse/red house/barn 3 (all modes), hardstone blocks and wood-axe stumps 6 [src:derived/git-ae55c9a8] [H]
- B: 3/4 and 6/8 by team size [src:survev/shared/defs/maps/woodsDefs.ts:230-250] [H]
- proposed resolution: keep survev scaling as a config knob, default to the pre-fork flat counts [src:derived/readme-precedence] [L]
- files: `modes/woods.md` (`woods-building-counts`) [src:derived/kb-crossref] [H]

## woods-airdrop-stonehammer

- A (modes/woods.md): stone hammer weight 3 [src:survev/shared/defs/maps/woodsDefs.ts:158] [H]
- B (modes/woods.md): 6 [src:balance/257] [H]
- C (modes/woods.md): original 1 [src:derived/git-ae55c9a8] [H]
- D (provenance/balance-revert.md): balance.txt says the airdrop Stone Hammer weight went 1 -> 6 [src:balance/257] [H]
- E (provenance/balance-revert.md): the code went 1 -> 3 [src:derived/git-69f48949, survev/shared/defs/maps/woodsDefs.ts:158] [H]
- proposed resolution: original weight 1 (balance.txt's 6 and the code's 3 are both fork values) [src:derived/git-ae55c9a8] [src:derived/git-69f48949] [H]
- files: `modes/woods.md` (`woods-airdrop-melee-stonehammer`), `provenance/balance-revert.md` (`woods-airdrop-stonehammer`) [src:derived/kb-crossref] [H]

## woods-snow-ghillie

- A: playerGhillie 0xbbbbbb [src:survev/shared/defs/maps/woodsSnowDefs.ts:29] [H]
- B: 0x83af50 inherited in the pre-fork def [src:derived/git-ae55c9a8] [H]
- proposed resolution: no original evidence, keep 0xbbbbbb [src:derived/readme-precedence] [L]
- files: `modes/woods.md` (`woods-snow-ghillie`) [src:derived/kb-crossref] [H]

## woods-summer-teahouse

- A: bare `teahouse_01` 2/3 [src:survev/shared/defs/maps/woodsSummerDefs.ts:50] [H]
- B: teahouse complexes 2/3 [src:fandom/Woods_Map] [M]
- proposed resolution: keep survev, open question [src:derived/readme-precedence] [L]
- files: `modes/woods.md` (`woods-summer-teahouse`) [src:derived/kb-crossref] [H]

## woods-island-size

- A: map 720 / 736 units [src:survev/shared/defs/maps/woodsDefs.ts:164] [H]
- B: "the Island is notably larger" [src:fandom/Woods_Map] [M]
- proposed resolution: both true — the map square is no bigger than main, but the 8-unit shore inset makes the grass island larger [src:derived/readme-precedence] [M]
- files: `modes/woods.md` (`woods-island-size`) [src:derived/kb-crossref] [H]

> **namu.wiki**

## namu-faction-medic-perk

- A: namu는 50v50 의무병 퍽을 "전투 의무병"(Combat Medic)으로 적음 [src:namu/Surviv.io/이벤트] [M]
- B: survev 50v50 `medic` 퍽은 aoe_heal(Mass Medicate)·self_revive(Revivify)이고 field_medic은 코발트 `healer` 퍽 [src:survev/shared/defs/gameObjects/roleDefs.ts:226, survev/shared/defs/gameObjects/roleDefs.ts:453] [H]
- proposed resolution: survev 유지, namu 스니펫은 코발트 의무병과 섞인 것으로 본다 [src:derived/readme-precedence] [L]
- files: `namu.md` (`namu-faction-medic-perk`) [src:derived/kb-crossref] [H]

## namu-m134-existence

- A: namu는 금색 에어드랍과 무기 목록에 M134 미니건(장탄 200, 피해 10)을 적음 [src:namu/Surviv.io/무기] [M]
- B: survev 정의에는 M134가 없고 미니건은 fork 감자 무기 PMG-134뿐 [src:survev/shared/defs/gameObjects/gunDefs.ts:3531] [H]
- proposed resolution: M134는 0.8.82 이후 원작 콘텐츠이거나 namu 오기로 보고 리버스 범위에서 제외 [src:derived/readme-precedence] [L]
- files: `namu.md` (`namu-m134-existence`) [src:derived/kb-crossref] [H]

## namu-candy-corn

- A: namu "Candy Corn 퍽은 9mm 과충전과 차이가 없다" [src:namu/Surviv.io/이벤트] [M]
- B: 공식 설명 "9mm 탄환이 더 어둡고 치명적" (별도 퍽 id `treat_9mm`) [src:l10n/en:game-treat_9mm-desc] [H]
- proposed resolution: 별도 퍽으로 구현하되 수치는 survev 정의를 따른다 [src:derived/readme-precedence] [L]
- files: `namu.md` (`namu-candy-corn`) [src:derived/kb-crossref] [H]

> **Provenance (fork vs original)**

## woods-rock-cache-dp28

- A: balance.txt says the Woods rock cache drops a DP-28 [src:balance/153] [H]
- B: `stone_02w` drops an AK-47 again since commit 4d2e139b (fork 0.3.13) [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:937, survev/client/public/changelogRec.html:135] [H]
- proposed resolution: AK-47 (matches the original `stone_02`) [src:derived/readme-precedence] [H]
- files: `provenance/balance-revert.md` (`woods-rock-cache-dp28`) [src:derived/kb-crossref] [H]

## faction-airdrop-rare-m4a1

- A: balance.txt line 280 names six guns but gives five value pairs [src:balance/280] [H]
- B: the code change was garand 6->2, awc 3->2.25, pkp 0.08->0.1, m4a1 4->3, scorpion 5->3, ots38_dual 4.5->2 [src:derived/git-764f9638, survev/shared/defs/maps/factionDefs.ts:345] [H]
- proposed resolution: use the code values (m4a1 original 4) [src:derived/readme-precedence] [H]
- files: `provenance/balance-revert.md` (`faction-airdrop-rare-m4a1`) [src:derived/kb-crossref] [H]

## cobalt-scout-rare-mk20

- A: balance.txt says "Scout Rare: Adjusted Mk 20 SSR weight" [src:balance/311] [H]
- B: the Mk 20 SSR (`scarssr`) is only in `tier_guns_rare_healer` [src:survev/shared/defs/maps/baseDefs.ts:502] [H]
- proposed resolution: treat line 311 as the Medic rare tier; original: absent [src:derived/readme-precedence] [H]
- files: `provenance/balance-revert.md` (`cobalt-scout-rare-mk20`) [src:derived/kb-crossref] [H]

## savannah-sv98-balance-log

- A (provenance/balance-revert.md): balance.txt line 353 says Savannah tier_guns SV-98 went 0.1 -> 0.2 [src:balance/353] [H]
- B (provenance/balance-revert.md): the 0.4.3 code change was in tier_airdrop_uncommon only; tier_guns is 0.09 since 0.2.12 [src:balance/349, derived/git-9ae131c9] [H]
- C (provenance/balance-revert.md): balance.txt gives the Savannah `tier_airdrop_uncommon` SV-98 change as 0.1 -> 0.2 [src:balance/349] [H]
- D (provenance/balance-revert.md): survev's first Savannah table, which also carried a second SV-98 entry at 0.5 in the same tier until 0a582469 removed it (2026-01-16) [src:derived/git-367a7b3d, derived/git-0a582469] [H]
- proposed resolution: `tier_guns` sv98 0.1; `tier_airdrop_uncommon` sv98: survev's first effective weight 0.6 (0.1 + a duplicate 0.5 entry) as a knob, original unknown [src:derived/git-367a7b3d] [src:balance/349] [L]
- note: the two balance-revert entries disagree on the airdrop value (0.1 vs 0.6); this entry keeps 0.6 as the knob default [src:derived/kb-crossref] [L]
- files: `provenance/balance-revert.md` (`savannah-sv98-tier-guns`), `provenance/balance-revert.md` (`savannah-sv98-airdrop-duplicate`) [src:derived/kb-crossref] [H]

## tier-armor-duplicate

- A: balance.txt line 302 (0.3.01) repeats line 220 (0.2.12) word for word [src:balance/302, balance/220] [H]
- B: only the Savannah tier_armor override exists in the code [src:survev/shared/defs/maps/savannahDefs.ts:81] [H]
- proposed resolution: one change (Savannah, 0.2.12) [src:derived/readme-precedence] [M]
- files: `provenance/balance-revert.md` (`tier-armor-duplicate`) [src:derived/kb-crossref] [H]

## cobalt-unlogged-retunes

- A: balance.txt's latest Cobalt weights (e.g. Demo rare Saiga 0.7, SPAS-16 0.2, Sniper rare SV-98 0.15) [src:balance/290, balance/289, balance/292] [H]
- B: the code has Saiga 0.5, SPAS-16 0.4, SV-98 0.2 after later unlogged commits such as 8562702c [src:derived/git-8562702c] [H]
- proposed resolution: revert to the pre-fork baseline values listed in the table [src:derived/readme-precedence] [H]
- files: `provenance/balance-revert.md` (`cobalt-unlogged-retunes`) [src:derived/kb-crossref] [H]

## loot-baseline-not-original

- A: this list treats survev's 2025-07-01 loot tables as the original [src:derived/git-ae55c9a8] [H]
- B: survev says its base loot table is not the original and marks guesses with `?` [src:survev/shared/defs/maps/baseDefs.ts:90] [H]
- proposed resolution: use the baseline as the best available original, keep weights as config knobs [src:derived/readme-precedence] [M]
- files: `provenance/balance-revert.md` (`loot-baseline-not-original`) [src:derived/kb-crossref] [H]

## quest-top-duo-absent-from-client

- A: the v0.8.82 client `questDefs` has only `quest_top_solo` and `quest_top_squad`, in both survev's import and the 2026 relaunch client [src:derived/git-9f64948d, kong/relaunch-client-defs] [H]
- B: fandom recording that the "Top 8 in Duos" quest was removed in a March 2020 update and survev saying it "Added back" the quest [src:fandom/Changelog, survev/client/public/changelogRec.html:170] [M]
- proposed resolution: treat `quest_top_duo` as original but optional, since it may have been server-side only [src:derived/readme-precedence] [L]
- files: `provenance/fork-vs-original.md` (`quest-top-duo-absent-from-client`) [src:derived/kb-crossref] [H]

## fandom-role-pages-mixed

- A: fandom role pages contain survev data (survev.io audio links, "AP rounds in survev.io", a Captain row marked "is assumed") [src:fandom/Grenadier] [src:fandom/Lone_Survivr] [src:fandom/Roles] [M]
- B: the same pages are otherwise used as original-game sources for role loadouts (e.g. the Grenadier's Saiga-12, see `grenadier-weapon`) [src:fandom/Grenadier] [src:fandom/Game_Modes] [M]
- proposed resolution: do not use fandom role tables alone for v0.8.82 role loadouts; require a second, era-safe source [src:derived/kb-crossref] [M]
- files: `provenance/fork-vs-original.md` (`fandom-role-pages-mixed`) [src:derived/kb-crossref] [H]

## twins-bunker-puzzle

- A: the Twins bunker is original (0.8.8) [src:changelog/0.8.8] [H]
- B: its current class-switch puzzle, which only arrived with the fork's 0.3.0 "twins bunker expansion" [src:derived/git-f0107b35, survev/shared/defs/puzzles.ts:20] [H]
- proposed resolution: keep the bunker, drop the `bunker_twins` puzzle and its buttons for v0.8.82 and take the sublevel and compartment layouts from the relaunch client [src:kong/relaunch-client-defs] [M]
- files: `provenance/fork-vs-original.md` (`twins-bunker-puzzle`) [src:derived/kb-crossref] [H]

## live-vs-survev-tables

- every row of the difference tables in `provenance/live-vs-survev.md` is a survev change against the original client [src:derived/live-vs-survev] [H]
- proposed resolution: rule 1: the original (relaunch) value wins for the v0.8.82 target [src:derived/live-vs-survev] [H]
- files: `provenance/live-vs-survev.md` (`live-vs-survev-tables`) [src:derived/kb-crossref] [H]

## wiki-vs-survev-tables

- every row of the gameplay difference tables in `provenance/wiki-vs-survev.md` is a conflict candidate between a wiki infobox and survev [src:derived/infobox-diff] [L]
- proposed resolution: rule 1 for client-visible numbers, rule 3 for names and existence; rows not covered by an entry here stay candidates [src:derived/infobox-diff] [L]
- files: `provenance/wiki-vs-survev.md` (`wiki-vs-survev-tables`) [src:derived/kb-crossref] [H]

> **UI**

## reverb-files-unused

- A: fandom calls `cave_mono_01` and `cathedral_01` unused sound files [src:fandom/Sound] [M]
- B: both are registered reverbs and the underground reverb was added in 0.3.6 [src:survev/client/src/soundDefs.ts:2161-2176] [src:changelog/0.3.6] [H]
- proposed resolution: they are impulse responses, used [src:derived/readme-precedence] [L]
- files: `ui/audiovisual-style.md` (`reverb-files-unused`) [src:derived/kb-crossref] [H]

## pixi-version

- A: original Pixi 4.8.2 [src:derived/survev@8715a605:client/js/vendor.bd0cb293.js] [H]
- B: survev Pixi 7.4.3 legacy [src:survev/client/package.json:18] [H]
- proposed resolution: irrelevant to gameplay; use a modern renderer [src:derived/readme-precedence] [L]
- files: `ui/audiovisual-style.md` (`pixi-version`) [src:derived/kb-crossref] [H]

## melee-key-3-or-e

- A: fandom Controls lists "3, E" as Equip melee/fists [src:fandom/Controls] [M]
- B: the bind table names E "Stow Weapons" [src:survev/client/src/inputBinds.ts:45] [H]
- proposed resolution: both, because the server treats StowWeapons as EquipMelee [src:survev/server/src/game/objects/player.ts:3387-3391] [L]
- files: `ui/controls.md` (`melee-key-3-or-e`) [src:derived/kb-crossref] [H]

## mobile-matchmaking-split

- A: fandom/namu describe separate mobile and PC matchmaking [src:fandom/Surviv.io_Mobile] [src:namu/Surviv.io] [M]
- B: survev's find_game has no device field and puts everyone in the same games [src:survev/shared/types/api.ts:5-13] [H]
- proposed resolution: keep survev behaviour, expose a config knob for separate queues [src:derived/readme-precedence] [L]
- files: `ui/controls.md` (`mobile-matchmaking-split`) [src:derived/kb-crossref] [H]

## mobile-auto-loot-location

- A: survev implements mobile auto-loot on the server keyed on `isMobile` [src:survev/server/src/game/objects/player.ts:2024-2099] [H]
- B: the original server code is unknown (the protocol-78 JoinMsg carries `isMobile`, so the original server could do the same) [src:derived/survev@8715a605:client/js/app.js:43585-43614] [H]
- proposed resolution: keep server-side auto-loot [src:derived/readme-precedence] [L]
- files: `ui/controls.md` (`mobile-auto-loot-location`) [src:derived/kb-crossref] [H]

## victory-music

- A: original plays `menu_music` (menu_music_01) on every win [src:derived/survev@8715a605:client/js/app.js:79226-79233] [H]
- B: survev plays the map's `biome.ambience.music` (Halloween: `menu_music_02`) [src:survev/client/src/game.ts:1550-1557] [H]
- proposed resolution: original behaviour [src:derived/readme-precedence] [L]
- files: `ui/hud.md` (`victory-music`) [src:derived/kb-crossref] [H]

## kill-leader-location

- A: fandom says the kill leader shows top right on PC and top left on mobile [src:fandom/Kill_Leader] [M]
- B: survev hides `#ui-kill-leader-wrapper` on mobile (`hide-on-mobile`) [src:survev/client/index.html:471] [H]
- proposed resolution: follow the code (fandom notes that many mobile devices did not show it) [src:derived/readme-precedence] [L]
- files: `ui/hud.md` (`kill-leader-location`) [src:derived/kb-crossref] [H]

## minimap-toggle-keys

- A: fandom Controls lists "M, G" for the map and the l10n how-to-play says "M or G" [src:fandom/Controls] [src:l10n/en:index-view-map-ctrl] [M]
- B: the bind table only binds M; G works only while unbound [src:survev/client/src/game.ts:451-457] [H]
- proposed resolution: both are true, keep G as an unbound fallback [src:derived/readme-precedence] [L]
- files: `ui/hud.md` (`minimap-toggle-keys`) [src:derived/kb-crossref] [H]

## login-providers

- A: original 0.8.82 offered Facebook, Google, Twitch, Discord [src:derived/survev@8715a605:client/js/app.js:47589-47612] [H]
- B: survev offers Google, Discord (+ mock) [src:survev/server/src/api/routes/user/AuthRouter.ts:24-28] [H]
- proposed resolution: accounts are optional for the rebirth; if added, use providers available today [src:derived/readme-precedence] [L]
- files: `ui/menus.md` (`login-providers`) [src:derived/kb-crossref] [H]

## mode-buttons

- A: original buttons are fixed Solo/Duo/Squad with event maps chosen server-side [src:derived/survev@8715a605:client/index.html:864-867] [H]
- B: survev restyles each button from the configured map def (icon, css, "50v50" text) [src:survev/client/src/siteInfo.ts:42-96] [H]
- proposed resolution: survev approach (the original site_info also carried per-mode map info) [src:derived/readme-precedence] [L]
- files: `ui/menus.md` (`mode-buttons`) [src:derived/kb-crossref] [H]

## snow-gold-airdrop-sprite

- status: closed: `map-airdrop-02x.img` [src:kong/relaunch-client-defs] [H]
- A (mechanics/airdrop-airstrike.md): the original client draws snow's gold shell `airdrop_crate_02x` with `map-airdrop-02x.img`, unlike the normal `airdrop_crate_01x` (`map-airdrop-01x.img`) [src:kong/relaunch-client-defs] [H]
- B (mechanics/airdrop-airstrike.md): survev draws both snow shells with `map-airdrop-01x.img` [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1183-1208] [H]
- proposed resolution: rule 1, the original client is authoritative for client-visible values: `map-airdrop-02x.img` (the generated defs carry it), so a snow gold drop shows before it is opened [src:derived/readme-precedence] [H]
- files: `mechanics/airdrop-airstrike.md` (`snow-gold-shell-sprite`), `rebirth-deviations.md` (air drop tiers, client presentation) [src:derived/kb-crossref] [H]

## survev-throwable-cookable

- A (survev.wiki.gg): the Coconut is cookable, the Tomato is not [src:wikigg/Coconut] [src:wikigg/Tomato_(Throwable)] [M]
- B (survev source): `coconut` has `cookable: false`, `tomato` `cookable: true` [src:survev/shared/defs/gameObjects/throwableDefs.ts:846] [src:survev/shared/defs/gameObjects/throwableDefs.ts:913] [H]
- resolution: the owner says both cook: the Coconut takes the wiki's true, the Tomato keeps survev's true; applied in `packages/defs/src/survev/wikiSpecs.ts`, generated JSON keeps survev's value [src:user/2026-10-07-cookable] [H]
- files: `items/throwables.md` [src:derived/kb-crossref] [H]

## Conflicts

- none beyond the entries above; where KB files proposed different resolutions, the entry's `note:` line says which proposal this page follows [src:derived/kb-crossref] [L]

## Open questions

- unresolved items behind these conflicts are tracked in `open-questions.md` [src:derived/kb-crossref] [L]
