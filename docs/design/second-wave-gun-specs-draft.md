# Second wave gun specifications — review draft

Status: specs approved and applied, 2026-10-10. Second-wave guns are available through GUN_BETA; normal loot rarity remains undecided.
Scope: weapons first; suits, nano infector, throwable equipment and illustration work are deferred.

## Conventions

- Damage, spread, reload duration and game-unit range below are proposed game values, not measured real-world specifications.
- Automatic fire interval is 60 / selected rounds per minute. Rates marked provisional require better primary-source confirmation before being described as historically accurate.
- Spread is the configured standing/moving spread in degrees, not real-world MOA or a measured accuracy cone.
- Range is projectile travel in game units, not metres or effective military range.
- Launcher damage lists direct impact plus maximum explosion damage; explosion damage falls with distance.
- Non-reloadable charges mean total available shots, not a claim that the original firearm had a magazine of that size.
- User ammunition choices override historical ammunition. Rarity and final balance are deferred.

## Proposed configuration

| Weapon | Damage | Interval (s) | Capacity / total charges | Reload (s) | Spread standing / moving | Range (u) |
| --- | --- | --- | --- | --- | --- | --- |
| NLAW | 60 + 150 blast | single use | 1 | unavailable | 1 / 3 | 160 |
| PAW20 | 25 + 65 blast | 0.35 | 6 | 3.5 | 1.5 / 3 | 120 |
| Bazooka | 50 + 125 blast | single use | 1 | unavailable | 2 / 4 | 100 |
| Pvg m/42 (Carl Gustav) | 160 | 2.0 | 10 total charges | unavailable | 1 / 5 | 350 |
| RPD | 20 | 0.0923 (650 rpm, provisional) | 100 | 5.0 | 2.5 / 7 | 225 |
| Bren | 26 | 0.12 (500 rpm) | 30 | 3.0 | 1.5 / 6 | 275 |
| Pancor Jackhammer | 10 x 9 pellets | 0.25 (240 rpm, provisional) | 10 | 4.0 | 9 / 12 | 45 |
| MG3 | 17 | 0.05 (1200 rpm, provisional) | 100 | 5.5 | 3.5 / 9 | 250 |
| Maadi GMR-30A1 | 220 | 3.0 | 8 total charges | unavailable | 1 / 7 | 400 |
| Negev NG5 | 17 | 0.0632 (950 rpm) | 150 (provisional belt choice) | 5.0 | 3 / 8 | 225 |
| KPV | 48 | 0.10 (600 rpm, provisional) | 40 | 7.5 | 6 / 14 | 350 |
| M202 (existing weapon) | retain 25 + 125 blast per rocket | four-shot burst, 0.035 between rockets | 4 total charges | unavailable | 2 / 4 | retain 75 |

The M202 burst interval is a user-requested game behavior, not a real cyclic-rate claim. Four shots span 0.105 seconds; cooldown and simulation quantization must be verified during implementation.

## Owner decisions carried forward

- NLAW and Bazooka: one use, then discard as a decorative spent model.
- Panzerfaust and M202: discard as a decorative spent model after exhausting charges.
- PAW20: use the game's 40mm ammunition despite its historical 20mm cartridge.
- Pvg m/42: ten total shots, no replenishment. Interpret the owner's "Gustav" as the previously named Pvg m/42, not the later 84mm Carl-Gustaf; this naming assumption remains explicit.
- Maadi GMR-30A1: eight total shots, then discard. No verified real eight-round feed is claimed.
- RPD and MG3: blue ammunition. Jackhammer: red. Negev: green.
- Bren and KPV ammunition: owner has not selected these; temporarily use blue 762mm to make beta guns playable. This is not a historical ammunition claim.
- Negev and KPV: carrying either in either weapon slot reduces movement, matching the DShK mechanism. Negev carry -1.5 u/s, equip -0.5, attack -2; KPV carry -2.5, equip -1, attack -5. Carry penalties add across both gun slots. KPV additionally receives deliberately wide spread.
- Winchester: retain art/model work only under the earlier request; no functional weapon specification added here.
- Lynx/Boys/Hecate: projectile visual enlargement is retained as a later presentation task, not a damage increase.

## Primary sources and confidence

- Saab NLAW product and disposable-weapon statement: single-use, combat range 20–800 m. This real range is not equated with the proposed game range.
  - https://www.saab.com/products/nlaw
  - https://www.saab.com/newsroom/stories/2021/july/why-ground-combat-troops-need-a-disposable-weapon
- Denel describes the upgraded PAW as semi-automatic with a six-round rotary magazine. Its real 20mm cartridge is overridden only for in-game ammo selection.
  - https://www.denel.co.za/press-article/The-%E2%80%9CBull%E2%80%9D-In-Denel%E2%80%99s-Kraal-Gets-Even-Better/149
- National Army Museum: Bren 480–540 rpm depending on model; select 500 rpm within that range.
  - https://collection.nam.ac.uk/detail.php?acc=1992-08-62-108
- IWI: Negev NG5 normal rate 850–1050 rpm; select 950 rpm. Exact selected belt container capacity remains to be verified.
  - https://iwi.net/iwi-negev-machine-gun/negev/
- US Army ODIN KPV entry: 40-round belt. Do not conflate KPV and KPVT when verifying feed specifications.
  - https://odin.t2com.army.mil/WEG/Asset/c5e014534c8fe3def0ef6d81f491bfb7
- RPD operator manual search excerpt confirms 100-round belt capacity; full PDF retrieval failed, so selected cyclic rate remains provisional.
  - https://thekalashconnection.com/pdf/TM-8370-50037-RPD-Oper-Man.pdf
- Direct inspection of the Pancor prototype and Pvg m/42 helps verify operating characteristics, but does not establish the proposed game reload timings or ranges.
  - https://www.forgottenweapons.com/pancor-jackhammer-mk3/
  - https://www.forgottenweapons.com/carl-gustav-m42-a-20mm-recoilless-antitank-rifle/
- MG3 manufacturer catalogue was found but retrieval timed out. Rate/capacity selection remains provisional.
  - https://depo.gov.pk/download/catalogue/public/POF.pdf
- Maadi Griffin 30mm: reliable primary performance data has not been retrieved. All game values and the GMR-30A1 designation must be treated as a game adaptation, not an authenticated factory specification.

Runtime definitions and the machine-readable stat sheet now contain these values. Existing weapon damage and normal loot weights are retained. M202 uses four sequential charges and 0.5 units recoil per rocket, preserving two units total recoil. Art and audio use existing fallbacks pending the later art task. Protocol schema 24 covers the added registry IDs; restart both client and server together.
