# Bullets

> Every bullet def in survev `shared/defs/gameObjects/bulletDefs.ts` (63 ids), the original-only bullet defs survev removed (12 ids), and how the survev server simulates bullets (`server/src/game/objects/bullet.ts`).
> Original values come from survev's first commit `9f64948d` (decompiled original client defs) and are cited as `derived/survev@9f64948d:<path>:<lines>`. The survev header notes that the bullet code was "copied from surviv client and bit heroes arena client" to match collision behaviour.

## Provenance summary

- survev header: "most of this code was copied from surviv client and bit heroes arena client to get bullet collision the most accurate possible" [src:survev/server/src/game/objects/bullet.ts:16-17] [H]
- Original client bullet defs: 69 ids — 49 gun bullets, `bullet_flare`, 2 invisible bullets (`bullet_potato`, `bullet_bugle`), 7 shrapnel bullets and 10 `*_bonus` skins for 9mm Overpressure [src:derived/survev@9f64948d:src/defs/bulletDefs.js:1-836] [H]
- The 2026 relaunch client bundle (the original game) has the same 69 bullet ids with identical values for every field, so the "orig" columns below are confirmed by an independent copy of the original client [src:kong/relaunch-client-defs] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:1-836] [H]
- Fork-only bullet defs: `bullet_barrett`, `bullet_sw500`, `bullet_ash12` (survev 3f313672, 2026-06-29), `bullet_imbel` (51bd6ceb, 2026-02-23), `bullet_invis` (ffcd8993, 2025-03-21; replaces bullet_potato and bullet_bugle) and `shrapnel_cobalt` (f0107b35, 2026-04-17; Twins bunker cobalt wall explosion) (fork) [src:derived/survev-git-3f313672] [src:derived/survev-git-51bd6ceb] [src:derived/survev-git-ffcd8993] [src:derived/survev-git-f0107b35] [H]
- Removed by the fork: the 10 `*_bonus` defs, bullet_potato and bullet_bugle ("chore: remove unused bullets", efd77aef, 2025-03-22; "Remove 9mm Overpressure Artifact", 7d27e9f9, 2026-03-08) (fork) [src:derived/survev-git-efd77aef] [src:derived/survev-git-7d27e9f9] [H]
- Global bullet constants: `maxReflect` 3, `reflectDistDecay` 1.5, `height` 0.25. All three exist in the original client config. survev adds a server flag `falloff: true` [src:survev/shared/gameConfig.ts:308-313] [src:derived/survev@9f64948d:src/gameConfig.ts:168-172] [src:kong/relaunch-client-defs] [H]

## Bullet def table (survev, original value in parentheses where the fork changed it)

| id | damage | obstacleDamage | falloff | distance | speed | variance | shrapnel | tracer color / width / length | suppressed | onHit | other flags | used by (survev) | prov | sources |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bullet_mp5 | 11 | 1 | 0.8 | 100 | 85 | 0 | false | 9mm / 0.1 / 0.7 | — | — | — | mp5 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:26-38] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:8-20] [H] |
| bullet_ak47 | 13.5 | 1 | 0.9 | 200 | 100 | 0 | false | 762mm / 0.1 / 0.9 | — | — | — | ak47 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:39-51] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:21-33] [H] |
| bullet_scar | 15 | 1 | 0.85 | 175 | 108 | 0 | false | 762mm / 0.1 / 0.9 | — | — | — | scar | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:52-64] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:34-46] [H] |
| bullet_an94 | 20 (orig 17.5) | 1 | 0.94 | 300 | 120 (orig 110) | 0 | false | 762mm / 0.1 / 0.9 | — | — | — | an94 | orig, fork-changed | [src:survev/shared/defs/gameObjects/bulletDefs.ts:65-77] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:47-59] [H] |
| bullet_groza | 12.5 | 1 | 0.85 | 175 | 104 | 0 | false | 762mm / 0.1 / 0.9 | — | — | — | groza | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:78-90] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:60-72] [H] |
| bullet_grozas | 13 | 1 | 0.87 | 185 | 106 | 0 | false | 762mm / 0.1 / 0.9 | yes | — | — | grozas | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:91-104] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:73-86] [H] |
| bullet_model94 | 44 | 1 | 0.75 | 175 | 156 | 0 | false | 45acp / 0.12 / 1 | — | — | — | model94 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:105-117] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:87-99] [H] |
| bullet_blr | 56 | 1 | 0.9 | 400 | 160 | 0 | false | 762mm / 0.14 / 1 | — | — | — | blr | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:118-130] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:100-112] [H] |
| bullet_mosin | 72 | 1.5 | 0.95 | 500 | 178 | 0 | false | 762mm / 0.16 / 1 | — | — | — | mosin | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:131-143] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:113-125] [H] |
| bullet_sv98 | 80 | 1.5 | 0.96 | 520 | 182 | 0 | false | 762mm / 0.2 / 1 | — | — | — | sv98 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:144-156] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:126-138] [H] |
| bullet_awc | 180 | 1.5 | 0.94 | 300 | 136 | 0 | false | 308sub / 0.2 / 1 | yes | — | — | awc | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:157-170] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:139-152] [H] |
| bullet_scarssr | 81 (orig 60) | 1.5 | 0.85 | 200 | 108 | 0 | false | 308sub / 0.14 / 1 | yes | — | — | scarssr | orig, fork-changed | [src:survev/shared/defs/gameObjects/bulletDefs.ts:171-184] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:153-166] [H] |
| bullet_m39 | 28 (orig 27) | 1 | 0.9 | 400 | 125 | 0 | false | 762mm / 0.1 / 0.9 | — | — | — | m39 | orig, fork-changed | [src:survev/shared/defs/gameObjects/bulletDefs.ts:185-197] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:167-179] [H] |
| bullet_svd | 37 (orig 36) | 1 | 0.9 | 425 | 127 | 0 | false | 762mm / 0.1 / 0.9 | — | — | — | svd | orig, fork-changed | [src:survev/shared/defs/gameObjects/bulletDefs.ts:198-210] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:180-192] [H] |
| bullet_garand | 44 (orig 35) | 1 | 0.94 (orig 0.9) | 444 (orig 400) | 144 (orig 130) | 0 | false | 762mm / 0.12 / 0.9 | — | — | — | garand | orig, fork-changed | [src:survev/shared/defs/gameObjects/bulletDefs.ts:211-223] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:193-205] [H] |
| bullet_buckshot | 12.5 | 1 | 0.3 | 27 | 66 | 0 | false | 12gauge / 0.1 / 0.8 | — | — | noDistAdj (fork-added), useExplosiveRoundsAlt (fork-added) | m870, mp220, saiga | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:224-238] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:206-218] [H] |
| bullet_flechette | 8.75 | 1 | 0.85 | 45 | 88 | 0 | false | 12gauge / 0.075 / 0.5 | — | — | noDistAdj (fork-added), useExplosiveRoundsAlt (fork-added) | spas12, spas16 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:239-253] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:219-231] [H] |
| bullet_frag | 12 | 1 | 0.3 | 24 | 72 | 0 | false | frag / 0.1 / 0.5 | — | explosion_usas | noDistAdj (fork-added) | usas | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:254-268] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:232-245] [H] |
| bullet_slug | 77 | 1 | 0.85 | 60 | 118 | 0 | false | 12gauge / 0.2 / 0.4 | — | — | — | m1014 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:269-281] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:246-258] [H] |
| bullet_birdshot | 4 | 1 | 0.25 | 25 | 66 | 0 | false | 12gauge / 0.1 / 0.1 | — | — | noDistAdj (fork-added), useExplosiveRoundsAlt (fork-added) | m1100 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:282-296] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:259-271] [H] |
| bullet_m9 | 13 (orig 12) | 1 | 0.7 | 100 | 85 | 0 | false | 9mm / 0.1 / 0.7 | — | — | — | m9, m9_dual | orig, fork-changed | [src:survev/shared/defs/gameObjects/bulletDefs.ts:297-309] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:272-284] [H] |
| bullet_m9_cursed | 13 (orig 12) | 1 | 0.7 | 100 | 85 | 0 | false | 9mm_cursed / 0.1 / 0.7 | — | — | — | m9_cursed | orig, fork-changed | [src:survev/shared/defs/gameObjects/bulletDefs.ts:310-322] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:285-297] [H] |
| bullet_m93r | 12 | 1 | 0.7 | 100 | 85 | 0 | false | 9mm / 0.1 / 0.7 | — | — | — | m93r, m93r_dual | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:323-335] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:298-310] [H] |
| bullet_p30l | 21 | 1 | 0.75 | 100 | 94 | 0 | false | 9mm / 0.12 / 0.8 | — | — | — | p30l, p30l_dual | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:336-348] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:311-323] [H] |
| bullet_ot38 | 26 | 1 | 0.75 | 125 | 112 | 0 | false | 762mm / 0.09 / 0.8 | — | — | — | ot38, ot38_dual | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:349-361] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:324-336] [H] |
| bullet_ots38 | 32 | 1 | 0.77 | 135 | 115 | 0 | false | 762mm / 0.1 / 0.8 | yes | — | — | ots38, ots38_dual | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:362-375] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:337-350] [H] |
| bullet_colt45 | 29 | 1 | 0.7 | 110 | 106 | 0 | false | 45acp / 0.09 / 0.8 | — | — | — | colt45, colt45_dual | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:376-388] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:351-363] [H] |
| bullet_m1911 | 16 (orig 14) | 1 | 0.7 | 88 | 80 | 0 | false | 45acp / 0.1 / 0.7 | — | — | — | m1911, m1911_dual | orig, fork-changed | [src:survev/shared/defs/gameObjects/bulletDefs.ts:389-401] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:364-376] [H] |
| bullet_m1a1 | 13 | 1 | 0.8 | 88 | 80 | 0 | false | 45acp / 0.1 / 0.7 | — | — | — | m1a1 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:402-414] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:377-389] [H] |
| bullet_mkg45 | 29 (orig 28) | 1 | 0.75 | 145 | 126 | 0 | false | 45acp / 0.1 / 0.9 | — | — | — | mkg45 | orig, fork-changed | [src:survev/shared/defs/gameObjects/bulletDefs.ts:415-427] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:390-402] [H] |
| bullet_deagle | 35 | 1 | 0.75 | 120 | 115 | 0 | false | 50AE / 0.12 / 0.8 | — | — | — | deagle, deagle_dual | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:428-440] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:403-415] [H] |
| bullet_barrett | 99 | 3 | 0.975 | 400 | 214 | 0 | false | 50AE / 0.225 / 1.2 | — | — | — | barrett | fork | [src:survev/shared/defs/gameObjects/bulletDefs.ts:441-453] [H] |
| bullet_sw500 | 64 | 1 | 0.92 | 160 | 150 | 0 | false | 50AE / 0.16 / 0.95 | — | — | — | sw500 | fork | [src:survev/shared/defs/gameObjects/bulletDefs.ts:454-466] [H] |
| bullet_ash12 | 31 | 1 | 0.875 | 70 | 85 | 0 | false | 50AE / 0.12 / 0.7 | — | — | — | ash12 | fork | [src:survev/shared/defs/gameObjects/bulletDefs.ts:467-479] [H] |
| bullet_mac10 | 9.25 | 1 | 0.6 | 50 | 75 | 0 | false | 9mm / 0.1 / 0.7 | — | — | — | mac10 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:480-492] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:416-428] [H] |
| bullet_ump9 | 14.5 (orig 15) | 1 | 0.75 | 100 | 100 | 0 | false | 9mm / 0.1 / 0.7 | — | — | — | ump9 | orig, fork-changed | [src:survev/shared/defs/gameObjects/bulletDefs.ts:493-505] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:429-441] [H] |
| bullet_vector | 7.5 | 1 | 0.6 | 46 | 88 | 0 | false | 9mm / 0.1 / 0.7 | — | — | — | vector | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:506-518] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:442-454] [H] |
| bullet_vector45 | 9.5 | 1 | 0.6 | 45 | 82 | 0 | false | 45acp / 0.1 / 0.7 | — | — | — | vector45 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:519-531] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:455-467] [H] |
| bullet_scorpion | 10.75 | 1 | 0.77 | 120 | 90 | 0 | false | 9mm / 0.1 / 0.7 | yes | — | — | scorpion | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:532-545] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:468-481] [H] |
| bullet_vss | 24 (orig 22) | 1 | 0.85 (orig 0.8) | 125 | 110 (orig 95) | 0 | false | 9mm / 0.1 / 0.8 | yes | — | — | vss | orig, fork-changed | [src:survev/shared/defs/gameObjects/bulletDefs.ts:546-559] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:482-495] [H] |
| bullet_dp28 | 14 | 1.5 | 0.9 | 225 | 110 | 0 | false | 762mm / 0.1 / 0.9 | — | — | — | dp28 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:560-572] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:496-508] [H] |
| bullet_bar | 17.5 | 1.75 | 0.9 | 275 | 114 | 0 | false | 762mm / 0.1 / 0.9 | — | — | — | bar | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:573-585] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:509-521] [H] |
| bullet_imbel | 12 | 1.3 | 0.9 | 200 | 92 | 0 | false | 556mm / 0.1 / 0.9 | — | — | — | imbel | fork | [src:survev/shared/defs/gameObjects/bulletDefs.ts:586-598] [H] |
| bullet_pkp | 18 | 2 | 0.9 | 200 | 120 | 0 | false | 762mm / 0.1 / 0.9 | — | — | — | pkp | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:599-611] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:522-534] [H] |
| bullet_glock | 9 | 1 | 0.5 | 44 | 70 | 0 | false | 9mm / 0.1 / 0.7 | — | — | — | glock, glock_dual | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:612-624] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:535-547] [H] |
| bullet_famas | 17 | 1 | 0.8 | 150 | 110 | 0 | false | 556mm / 0.1 / 0.9 | — | — | — | famas | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:625-637] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:548-560] [H] |
| bullet_hk416 | 11 | 1 | 0.85 | 175 | 105 | 0 | false | 556mm / 0.1 / 0.9 | — | — | — | hk416 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:638-650] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:561-573] [H] |
| bullet_m4a1 | 14 | 1 | 0.82 | 165 | 98 | 0 | false | 556mm / 0.1 / 0.9 | yes | — | — | m4a1 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:651-664] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:574-587] [H] |
| bullet_mk12 | 23 (orig 22.5) | 1 | 0.9 | 400 | 132 | 0 | false | 556mm / 0.1 / 0.9 | — | — | — | mk12 | orig, fork-changed | [src:survev/shared/defs/gameObjects/bulletDefs.ts:665-677] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:588-600] [H] |
| bullet_l86 | 25 (orig 26.5) | 1 | 0.9 | 425 | 134 | 0 | false | 556mm / 0.1 / 0.9 | — | — | — | l86 | orig, fork-changed | [src:survev/shared/defs/gameObjects/bulletDefs.ts:678-690] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:601-613] [H] |
| bullet_m249 | 14 | 1.75 | 0.9 | 220 | 125 | 0 | false | 556mm / 0.1 / 0.9 | — | — | — | m249 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:691-703] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:614-626] [H] |
| bullet_qbb97 | 14 | 1.5 | 0.9 | 200 | 118 | 0 | false | 556mm / 0.1 / 0.9 | — | — | — | qbb97 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:704-716] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:627-639] [H] |
| bullet_scout | 56 | 1 | 0.92 | 450 | 164 | 0 | false | 556mm / 0.14 / 0.95 | — | — | — | scout_elite | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:717-729] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:640-652] [H] |
| bullet_flare | 0 | 1 | 10 | 16 | 4 | 0 | false | flare / 0.3 / 1.2 | — | — | skipCollision, addFlare, flareColor=0xff5400, maxFlareScale=2 | flare_gun, flare_gun_dual | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:730-747] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:653-669] [H] |
| bullet_invis | 0 | 1 | 1 | 1 | 100 | 0 | false | invis / 0 / 1.2 | — | — | skipCollision | potato_cannon, potato_smg, potato_lmg, bugle | fork | [src:survev/shared/defs/gameObjects/bulletDefs.ts:748-761] [H] |
| shrapnel_barrel | 2 | 1 | 1 | 8 | 20 | 1.5 | true | shrapnel / 0.125 / 0.6 | — | — | — | explosion_barrel×12 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:762-774] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:698-710] [H] |
| shrapnel_stove | 5 | 2.5 | 1 | 24 | 30 | 1.5 | true | shrapnel / 0.125 / 0.6 | — | — | — | explosion_stove×16 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:775-787] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:711-723] [H] |
| shrapnel_frag | 20 | 1 | 1 | 8 | 20 | 1.5 | true | shrapnel / 0.125 / 0.6 | — | — | — | explosion_frag×12, explosion_mirv×12 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:788-800] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:724-736] [H] |
| shrapnel_strobe | 3 | 1 | 1 | 3 | 20 | 1.5 | true | shrapnel / 0.1 / 0.3 | — | — | — | explosion_strobe×3 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:801-813] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:737-749] [H] |
| shrapnel_usas | 5 | 1 | 1 | 5 | 20 | 1.2 | true | shrapnel / 0.1 / 0.5 | — | — | — | explosion_usas×9 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:814-826] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:750-762] [H] |
| shrapnel_mirv_mini | 6 | 1 | 1 | 5 | 20 | 1.3 | true | shrapnel / 0.1 / 0.5 | — | — | — | explosion_mirv_mini×7, explosion_martyr_nade×8 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:827-839] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:763-775] [H] |
| shrapnel_bomb_iron | 10 | 1 | 1 | 12 | 24 | 1.5 | true | shrapnel / 0.125 / 0.6 | — | — | — | explosion_bomb_iron×2 | orig | [src:survev/shared/defs/gameObjects/bulletDefs.ts:840-852] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:776-788] [H] |
| shrapnel_cobalt | 5 | 0.1 | 1 | 8 | 20 | 1.5 | true | shrapnel / 0.15 / 0.4 | — | — | — | explosion_cobalt×20 | fork | [src:survev/shared/defs/gameObjects/bulletDefs.ts:853-866] [H] |

## Original-only bullet defs (removed in the fork)

> `*_bonus` defs are skins of their base bullet (`defineSkin`) that override speed and distance (and the suppressed tracer key). Every override is exactly × 1.25 of the base speed and distance.

| id | base | damage | falloff | distance | speed | tracer | used by (original) | prov | sources |
|---|---|---|---|---|---|---|---|---|---|
| bullet_potato | — | 0 | 1 | 1 | 100 | invis / 0 / 1.2 | potato_cannon, potato_smg | orig, removed in fork | [src:derived/survev@9f64948d:src/defs/bulletDefs.js:670-683] [H] |
| bullet_bugle | — | 0 | 1 | 1 | 100 | invis / 0 / 1.2 | bugle | orig, removed in fork | [src:derived/survev@9f64948d:src/defs/bulletDefs.js:684-697] [H] |
| bullet_mp5_bonus | bullet_mp5 | 11 | 0.8 | 125 | 106.25 | 9mm / 0.1 / 0.7 | mp5 (bonus) | orig, removed in fork | [src:derived/survev@9f64948d:src/defs/bulletDefs.js:792-795] [H] |
| bullet_m9_bonus | bullet_m9 | 12 | 0.7 | 125 | 106.25 | 9mm / 0.1 / 0.7 | m9 (bonus), m9_dual (bonus) | orig, removed in fork | [src:derived/survev@9f64948d:src/defs/bulletDefs.js:796-799] [H] |
| bullet_mac10_bonus | bullet_mac10 | 9.25 | 0.6 | 62.5 | 93.75 | 9mm / 0.1 / 0.7 | mac10 (bonus) | orig, removed in fork | [src:derived/survev@9f64948d:src/defs/bulletDefs.js:800-803] [H] |
| bullet_ump9_bonus | bullet_ump9 | 15 | 0.75 | 125 | 125 | 9mm / 0.1 / 0.7 | ump9 (bonus) | orig, removed in fork | [src:derived/survev@9f64948d:src/defs/bulletDefs.js:804-807] [H] |
| bullet_vector_bonus | bullet_vector | 7.5 | 0.6 | 57.5 | 110 | 9mm / 0.1 / 0.7 | vector (bonus) | orig, removed in fork | [src:derived/survev@9f64948d:src/defs/bulletDefs.js:808-811] [H] |
| bullet_glock_bonus | bullet_glock | 9 | 0.5 | 55 | 87.5 | 9mm / 0.1 / 0.7 | glock (bonus), glock_dual (bonus) | orig, removed in fork | [src:derived/survev@9f64948d:src/defs/bulletDefs.js:812-815] [H] |
| bullet_m93r_bonus | bullet_m93r | 12 | 0.7 | 125 | 106.25 | 9mm / 0.1 / 0.7 | m93r (bonus), m93r_dual (bonus) | orig, removed in fork | [src:derived/survev@9f64948d:src/defs/bulletDefs.js:816-819] [H] |
| bullet_scorpion_bonus | bullet_scorpion | 10.75 | 0.77 | 150 | 112.5 | 9mm_suppressed_bonus / 0.1 / 0.7 | scorpion (bonus) | orig, removed in fork | [src:derived/survev@9f64948d:src/defs/bulletDefs.js:820-824] [H] |
| bullet_vss_bonus | bullet_vss | 22 | 0.8 | 156.25 | 118.75 | 9mm_suppressed_bonus / 0.1 / 0.8 | vss (bonus) | orig, removed in fork | [src:derived/survev@9f64948d:src/defs/bulletDefs.js:825-829] [H] |
| bullet_p30l_bonus | bullet_p30l | 21 | 0.75 | 125 | 117.5 | 9mm / 0.12 / 0.8 | p30l (bonus), p30l_dual (bonus) | orig, removed in fork | [src:derived/survev@9f64948d:src/defs/bulletDefs.js:830-833] [H] |

- Bonus skin multipliers: for example bullet_mp5 speed 85→106.25 and distance 100→125; bullet_glock speed 70→87.5 and distance 44→55; bullet_vss speed 95→118.75 and distance 125→156.25 (all × 1.25) [src:derived/survev@9f64948d:src/defs/bulletDefs.js:791-834] [H]
- bullet_potato and bullet_bugle are identical invisible no-collision bullets (damage 0, distance 1, speed 100, tracer `invis`, `skipCollision`); survev merged them into `bullet_invis` [src:derived/survev@9f64948d:src/defs/bulletDefs.js:670-697] [src:survev/shared/defs/gameObjects/bulletDefs.ts:748-761] [H]

## Derived values (original v0.8.82 defs)

> One map grid cell is 16 units [src:wikigg/Guns] [M]. "At max range" = damage × falloff, the minimum damage before any modifiers. Flight time = distance ÷ speed.

| bullet (orig values) | guns | damage | × pellets | at max range | distance (map cells of 16) | flight time to max range (s) | sources |
|---|---|---|---|---|---|---|---|
| bullet_mp5 | mp5 | 11 | 1 | 8.8 | 100 (6.25) | 1.176 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_ak47 | ak47 | 13.5 | 1 | 12.15 | 200 (12.5) | 2 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_scar | scar | 15 | 1 | 12.75 | 175 (10.938) | 1.62 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_an94 | an94 | 17.5 | 1 | 16.45 | 300 (18.75) | 2.727 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_groza | groza | 12.5 | 1 | 10.625 | 175 (10.938) | 1.683 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_grozas | grozas | 13 | 1 | 11.31 | 185 (11.563) | 1.745 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_model94 | model94 | 44 | 1 | 33 | 175 (10.938) | 1.122 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_blr | blr | 56 | 1 | 50.4 | 400 (25) | 2.5 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_mosin | mosin | 72 | 1 | 68.4 | 500 (31.25) | 2.809 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_sv98 | sv98 | 80 | 1 | 76.8 | 520 (32.5) | 2.857 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_awc | awc | 180 | 1 | 169.2 | 300 (18.75) | 2.206 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_scarssr | scarssr | 60 | 1 | 51 | 200 (12.5) | 1.852 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_m39 | m39 | 27 | 1 | 24.3 | 400 (25) | 3.2 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_svd | svd | 36 | 1 | 32.4 | 425 (26.563) | 3.346 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_garand | garand | 35 | 1 | 31.5 | 400 (25) | 3.077 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_buckshot | m870, mp220, saiga | 12.5 | 9 | 3.75 | 27 (1.688) | 0.409 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_flechette | spas12 | 8.75 | 9 | 7.438 | 45 (2.813) | 0.511 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_frag | usas | 12 | 1 | 3.6 | 24 (1.5) | 0.333 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_slug | m1014 | 77 | 1 | 65.45 | 60 (3.75) | 0.508 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_birdshot | m1100 | 4 | 18 | 1 | 25 (1.563) | 0.379 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_m9 | m9, m9_dual | 12 | 1 | 8.4 | 100 (6.25) | 1.176 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_m9_cursed | m9_cursed | 12 | 1 | 8.4 | 100 (6.25) | 1.176 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_m93r | m93r, m93r_dual | 12 | 1 | 8.4 | 100 (6.25) | 1.176 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_p30l | p30l, p30l_dual | 21 | 1 | 15.75 | 100 (6.25) | 1.064 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_ot38 | ot38, ot38_dual | 26 | 1 | 19.5 | 125 (7.813) | 1.116 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_ots38 | ots38, ots38_dual | 32 | 1 | 24.64 | 135 (8.438) | 1.174 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_colt45 | colt45, colt45_dual | 29 | 1 | 20.3 | 110 (6.875) | 1.038 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_m1911 | m1911, m1911_dual | 14 | 1 | 9.8 | 88 (5.5) | 1.1 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_m1a1 | m1a1 | 13 | 1 | 10.4 | 88 (5.5) | 1.1 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_mkg45 | mkg45 | 28 | 1 | 21 | 145 (9.063) | 1.151 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_deagle | deagle, deagle_dual | 35 | 1 | 26.25 | 120 (7.5) | 1.043 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_mac10 | mac10 | 9.25 | 1 | 5.55 | 50 (3.125) | 0.667 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_ump9 | ump9 | 15 | 1 | 11.25 | 100 (6.25) | 1 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_vector | vector | 7.5 | 1 | 4.5 | 46 (2.875) | 0.523 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_vector45 | vector45 | 9.5 | 1 | 5.7 | 45 (2.813) | 0.549 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_scorpion | scorpion | 10.75 | 1 | 8.278 | 120 (7.5) | 1.333 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_vss | vss | 22 | 1 | 17.6 | 125 (7.813) | 1.316 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_dp28 | dp28 | 14 | 1 | 12.6 | 225 (14.063) | 2.045 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_bar | bar | 17.5 | 1 | 15.75 | 275 (17.188) | 2.412 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_pkp | pkp | 18 | 1 | 16.2 | 200 (12.5) | 1.667 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_glock | glock, glock_dual | 9 | 1 | 4.5 | 44 (2.75) | 0.629 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_famas | famas | 17 | 1 | 13.6 | 150 (9.375) | 1.364 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_hk416 | hk416 | 11 | 1 | 9.35 | 175 (10.938) | 1.667 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_m4a1 | m4a1 | 14 | 1 | 11.48 | 165 (10.313) | 1.684 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_mk12 | mk12 | 22.5 | 1 | 20.25 | 400 (25) | 3.03 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_l86 | l86 | 26.5 | 1 | 23.85 | 425 (26.563) | 3.172 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_m249 | m249 | 14 | 1 | 12.6 | 220 (13.75) | 1.76 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_qbb97 | qbb97 | 14 | 1 | 12.6 | 200 (12.5) | 1.695 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |
| bullet_scout | scout_elite | 56 | 1 | 51.52 | 450 (28.125) | 2.744 | [src:derived/damage×falloff;distance÷speed;survev@9f64948d:src/defs/bulletDefs.js] [H] |

- Full-spread point-blank damage per shot (original values): buckshot 9 × 12.5 = 112.5, flechette 9 × 8.75 = 78.75, birdshot 18 × 4 = 72 [src:derived/bulletCount×damage;survev@9f64948d:src/defs/gunDefs.js] [src:fandom/Weapons/Damage] [H]
- The USAS-12 frag round does 12 bullet damage, then `explosion_usas` (which throws 9 × `shrapnel_usas`) on impact or at the end of its range [src:survev/shared/defs/gameObjects/bulletDefs.ts:254-268] [src:survev/shared/defs/gameObjects/explosionsDefs.ts:81-90] [H]

## What each BulletDef field means (survev code)

| field | meaning | sources |
|---|---|---|
| `damage` | base damage. The bullet's damage = `damage × damageMult`, where `damageMult` comes from perks at fire time | [src:survev/server/src/game/objects/bullet.ts:267] [H] |
| `obstacleDamage` | multiplier applied when the bullet hits an obstacle: obstacle damage = final damage × `obstacleDamage` (× 1.5 with AP Rounds, fork perk) | [src:survev/server/src/game/objects/bullet.ts:590-608] [H] |
| `falloff` | damage fraction left at maximum distance. It scales linearly with the fraction of distance travelled (formula below) | [src:survev/server/src/game/objects/bullet.ts:575-579] [src:wikigg/Guns] [H] |
| `distance` | maximum travel distance in units, before jitter, variance and modifiers | [src:survev/server/src/game/objects/bullet.ts:231-263] [H] |
| `speed` | units per second. The live speed is `speed × speedMult × variance` | [src:survev/server/src/game/objects/bullet.ts:204-205] [H] |
| `variance` | random stretch: `variance factor = 1 + varianceT × variance`, applied to both speed and distance. Guns fire with `varianceT` 1 by default and all gun bullets have variance 0. Explosions fire shrapnel with `varianceT = random()` and shrapnel variance 1.2–1.5, so shrapnel speed and range vary up to 2.5× | [src:survev/server/src/game/objects/bullet.ts:192] [src:survev/server/src/game/objects/explosion.ts:162-177] [H] |
| `shrapnel` | marks explosion fragments. They can hit their own source player (`damageSelf`), count as explosion damage (no headshot, Flak Jacket explosion reduction) and carry `trailSaturated` with Amped Explosives (fork) | [src:survev/server/src/game/objects/bullet.ts:269-273] [src:survev/server/src/game/objects/bullet.ts:634] [src:survev/server/src/game/objects/player.ts:2462-2476] [H] |
| `tracerColor` | key into `GameConfig.tracerColors`, merged with the map biome's `tracerColors` override | [src:survev/client/src/objects/bullet.ts:82-89] [src:survev/client/src/objects/bullet.ts:162-174] [H] |
| `tracerWidth` | trail sprite y-scale (x-scale fixed at 0.8). ×0.5 for Splinter side bullets (`trailSmall`), ×2 for One In The Chamber and empowered .45 bullets (`trailThick`) | [src:survev/client/src/objects/bullet.ts:150-158] [src:survev/server/src/game/weaponManager.ts:936-938] [H] |
| `tracerLength` | visible trail length = min(`tracerLength` × 15, distance travelled / 2) | [src:survev/client/src/objects/bullet.ts:532] [H] |
| `suppressed` | the trail alpha decays each frame by the colour's `alphaRate` down to `alphaMin` (bullet fade). Set on grozas, awc, scarssr, ots38, scorpion, vss, m4a1 | [src:survev/client/src/objects/bullet.ts:236-242] [src:fandom/Suppressed_Weapons] [H] |
| `skipCollision` | no collision checks at all (flare, invisible bullets) | [src:survev/server/src/game/objects/bullet.ts:411-412] [H] |
| `addFlare`, `flareColor`, `maxFlareScale` | firing an `addFlare` bullet calls `planeBarn.addAirdrop(pos)` on the server. The client draws a flare sprite tinted `flareColor`, growing by easeOutExpo up to `maxFlareScale` | [src:survev/server/src/game/objects/bullet.ts:116-119] [src:survev/client/src/objects/flare.ts:92-141] [H] |
| `onHit` | explosion id spawned where the bullet dies (bullet_frag → `explosion_usas`). It overrides the per-shot `onHitFx` (Explosive Rounds perk) | [src:survev/server/src/game/objects/bullet.ts:207] [src:survev/server/src/game/objects/bullet.ts:380-400] [H] |
| `noDistAdj` | skips the random distance jitter (the index is fixed at 8, so the adjustment is 0). Set on shotgun pellets because pellets already get positional jitter. Fork-added field | [src:survev/server/src/game/objects/bullet.ts:220-229] [H] |
| `useExplosiveRoundsAlt` | with Explosive Rounds, swaps `explosion_rounds` for the quieter `explosion_rounds_sg` (many pellets explode at once). Fork-added field, but `explosion_rounds_sg` itself exists in the original explosion defs | [src:survev/server/src/game/objects/bullet.ts:382-386] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:71-79] [H] |

## Server simulation (survev `bullet.ts`)

### Spawn

- The fire position is clamped to the map bounds. Bullets come from a pool; a slot is reused only after it has been sent to clients [src:survev/server/src/game/objects/bullet.ts:102-114] [H]
- Pool trimming: when the pool exceeds 512 and fewer than half the bullets are active, inactive bullets are freed [src:survev/server/src/game/objects/bullet.ts:87-90] [H]
- Distance jitter: `distAdjIdx = randomInt(0, 16)` (fixed 8 with `noDistAdj`), `distAdj = remap(idx, 0..16 → −1..+1)`. So each bullet's range shifts by up to ±1 unit, which makes spray patterns of low-spread, high-RoF guns (e.g. Vector) look better [src:survev/server/src/game/objects/bullet.ts:220-229] [H]
- The original client computes the same per-bullet values from the network message: speed = `def.speed × (1 + varianceT × variance)`, distance = `def.distance / 1.5^reflectCount` (or the sent clip distance) × variance + `remap(distAdjIdx, 0..16 → −1..+1)`. This is in the decompiled original `app.js` that survev committed in `8715a605` [src:derived/survev@8715a605:client/js/app.js:106463-106484] [H]
- Both the original protocol and survev send `distAdjIdx` in 4 bits (values 0–15). survev's `util.randomInt(0, 16)` is inclusive, so it can roll 16, which does not fit; so the largest jitter the original could send was +0.875, not +1 [src:derived/survev@8715a605:client/js/app.js:44034] [src:survev/shared/net/updateMsg.ts:377] [src:survev/shared/utils/util.ts:72-75] [M]
- Range formula: `distance = clamp((def.distance / 1.5^reflectCount) × distanceMult × variance + distAdj, 0, 1024)`, where 1024 = `Constants.MaxPosition` [src:survev/server/src/game/objects/bullet.ts:231-263] [src:survev/shared/net/net.ts:11] [H]
- Clipped range (`clipDistance`, from USAS-12 `toMouseHit`): `distance = min(def.distance × distanceMult, requested distance)`, and `distanceMult` is then reset to 1 so it is not applied twice [src:survev/server/src/game/objects/bullet.ts:233-240] [src:survev/server/src/game/weaponManager.ts:916-930] [H]
- Bullets with an onHit effect have their end point clipped to the map bounds, so the explosion happens inside the map [src:survev/server/src/game/objects/bullet.ts:322-339] [H]
- `clientEndPos` is shortened to the first indestructible obstacle on the path, so clients can stop the tracer there [src:survev/server/src/game/objects/bullet.ts:341-352] [H]

### Movement and collision

- Each tick the bullet moves `min(distance left, dt × speed)`. Leaving the map bounds kills it (position clamped) [src:survev/server/src/game/objects/bullet.ts:355-367] [H]
- Collision test: a segment from the old to the new position against grid objects. Hits are sorted by distance from the start position and processed in order [src:survev/server/src/game/objects/bullet.ts:411-563] [H]
- Obstacles are skipped if dead, on another layer, lower than the bullet height 0.25, or the object the bullet just reflected off [src:survev/server/src/game/objects/bullet.ts:424-432] [src:survev/shared/gameConfig.ts:311] [H]
- Players are skipped if dead, on another layer (unless the player is on a stair layer, `layer & 2`), the shooter itself (unless `damageSelf`), or the reflect source [src:survev/server/src/game/objects/bullet.ts:446-456] [H]
- `damageSelf` is true for reflected bullets (`reflectCount > 0`) and for shrapnel, so ricochets and fragments can hit their source [src:survev/server/src/game/objects/bullet.ts:273] [src:survev/client/src/objects/bullet.ts:134] [H]
- An active frying pan (`hasActivePan`) is a segment collider tested at both the old and new player transform. A pan hit nearer than the body hit reflects the bullet without damage [src:survev/server/src/game/objects/bullet.ts:467-555] [H]
- Cast Ironskin (`steelskin`): a body hit also adds a non-blocking "pan" collision just outside the body, so the bullet does damage and is reflected [src:survev/server/src/game/objects/bullet.ts:531-545] [H]
- Windwalk (orig perk): a bullet passing within 5 units of a Windwalk player who is not on the shooter's team gives 3 s of haste. It does not stack with an active Windwalk haste [src:survev/server/src/game/objects/bullet.ts:458-465] [src:survev/shared/defs/gameObjects/perkDefs.ts:77-80] [H]
- Each object is damaged at most once per bullet (`damagedObjIds`) [src:survev/server/src/game/objects/bullet.ts:584-588] [H]
- Non-collidable obstacles (`collidable: false`) take damage but let the bullet pass. A collidable obstacle or a player stops the bullet at the hit point [src:survev/server/src/game/objects/bullet.ts:614-649] [H]
- If the shooter is dead or downed when the bullet lands, it does no player damage, but it still damages obstacles and is still stopped [src:survev/server/src/game/objects/bullet.ts:565-569] [src:survev/server/src/game/objects/bullet.ts:616-640] [H]
- Damage is queued and applied after all bullets have updated in that tick [src:survev/server/src/game/objects/bullet.ts:71-85] [H]

### Damage formula

- `final = damage × damageMult × 1/(reflectCount + 1) × falloffFactor` [src:survev/server/src/game/objects/bullet.ts:572-579] [H]
- `falloffFactor = remap(clamp(distanceTraveled / distance, 0, 1), 0..1 → 1..falloff)`, a linear drop from 100% at the muzzle to `falloff` at maximum range [src:survev/server/src/game/objects/bullet.ts:575-579] [src:wikigg/Guns] [H]
- Worked example: MP5 (11 damage, falloff 0.8, distance 100) does 11 at point blank, 9.9 at 50 units and 8.8 at 100 units [src:wikigg/Guns] [src:derived/11×(1−0.2×t)] [H]
- Because `distance` is per bullet (after variance and jitter), falloff is measured against that bullet's own maximum range, not the def's distance [src:survev/server/src/game/objects/bullet.ts:259-263] [src:survev/server/src/game/objects/bullet.ts:576] [H]
- Player hit: `amount = final × 1.25` if the shooter has High-Value Targets (`targeting`, orig perk, 0.8.4) and the target has at least one perk; AP Rounds (fork) sets `armorPenetration` 0.8 [src:survev/server/src/game/objects/bullet.ts:617-638] [src:survev/shared/defs/gameObjects/perkDefs.ts:61-63] [src:changelog/0.8.4] [H]
- Obstacle hit: `amount = final × obstacleDamage` (× AP Rounds `obstacleMult` 1.5, fork) [src:survev/server/src/game/objects/bullet.ts:593-608] [src:survev/shared/defs/gameObjects/perkDefs.ts:41-44] [H]
- Then the player damage pipeline applies headshot (15% chance, × gun `headshotMult`, not for shrapnel or explosions) and armour (see guns.md) [src:survev/server/src/game/objects/player.ts:2459-2490] [H]

### End of life and onHit

- The bullet dies when `distanceTraveled` reaches `distance` (±0.001) [src:survev/server/src/game/objects/bullet.ts:371-378] [H]
- Explosive Rounds (`explosion_rounds`) "peter out": if the bullet reaches max range without hitting anything, no explosion is spawned [src:survev/server/src/game/objects/bullet.ts:374-377] [H]
- A dead, non-reflected bullet with an onHit effect spawns that explosion 0.1 units back along its direction, so it does not spawn inside the obstacle. Source and weapon attribution are passed on [src:survev/server/src/game/objects/bullet.ts:380-400] [H]
- A bullet that reflected spawns no onHit explosion itself; its child reflection carries the effect on [src:survev/server/src/game/objects/bullet.ts:380] [src:survev/server/src/game/objects/bullet.ts:692] [H]

### Reflection (ricochet)

- Triggers: hitting an obstacle whose def has `reflectBullets` (metal: barrels, silos, hedgehogs, bunker and warehouse walls), an active pan, or a Cast Ironskin player [src:survev/server/src/game/objects/bullet.ts:610-612] [src:survev/server/src/game/objects/bullet.ts:641-644] [src:wikigg/Guns] [H]
- Not reflected: bullets carrying `explosion_rounds` (`canReflect` false); bullets already at `maxReflect` = 3 reflections; and a second reflection in the same update (`reflected` flag) [src:survev/server/src/game/objects/bullet.ts:208] [src:survev/server/src/game/objects/bullet.ts:653-657] [src:survev/shared/gameConfig.ts:309] [H]
- New direction: `d' = d − 2(d·n)n` (mirror about the surface normal) [src:survev/server/src/game/objects/bullet.ts:659-660] [H]
- The reflection is a new bullet: same type, `damageMult`, `speedMult`, `distanceMult`, perk flags, `onHitFx` and `varianceT`, with `reflectCount + 1`, `reflectObjId` = the surface hit (so it cannot hit that surface again) and `shotFx` false [src:survev/server/src/game/objects/bullet.ts:668-696] [H]
- Range of a reflection: `def.distance / 1.5^reflectCount` (1.5, 2.25, 3.375 for reflections 1–3). For clipped-range bullets it is `max(1, remaining distance) / 1.5^reflectCount` [src:survev/server/src/game/objects/bullet.ts:231-232] [src:survev/server/src/game/objects/bullet.ts:662-666] [src:survev/shared/gameConfig.ts:310] [H]
- Damage of a reflection is divided by `reflectCount + 1` (½, ⅓, ¼) [src:survev/server/src/game/objects/bullet.ts:573] [src:wikigg/Guns] [H]
- A bullet can ricochet at most 3 times and is removed on the 4th impact [src:wikigg/Guns] [src:survev/shared/gameConfig.ts:309] [H]
- The original client had the same `maxReflect` 3 and `reflectDistDecay` 1.5 [src:derived/survev@9f64948d:src/gameConfig.ts:168-172] [H]
- Fork bug fixes: survev v0.0.20 fixed reflected USAS-12 bullets; v0.0.21 stopped flare bullets reflecting and spawning extra airdrops [src:wikigg/USAS-12] [src:wikigg/Flare_Gun] [M]

## Fire-time modifiers that change bullets

> Set by `weaponManager.fireWeapon`. The perks are documented in perks.md; here only their effect on the bullet.

- Splinter Rounds (orig): main bullet `damageMult × 0.6` plus 2 side bullets at × 0.5 with `trailSmall`. Not used for `noSplinter` guns [src:survev/server/src/game/weaponManager.ts:820-823] [src:survev/server/src/game/weaponManager.ts:971-1003] [src:survev/shared/defs/gameObjects/perkDefs.ts:37-40] [H]
- Ammo perks (orig): `treat_9mm` and `bonus_9mm` for 9mm, `treat_762` for 7.62mm, `treat_556` for 5.56mm, `treat_12g` for 12 gauge, `bonus_45` for .45 ACP. Each matching perk multiplies damage by `ammoBonusDamageMult` (1.12 in survev; 1.08 before the fork's 0.4.2 change) [src:survev/server/src/game/weaponManager.ts:692-715] [src:survev/shared/defs/gameObjects/perkDefs.ts:158-165] [src:balance/336] [H]
- `bonus_assault` (Hollow-points) and `treat_super` apply to every ammo type with a fixed × 1.08, applied once even if the player has both. Any damage multiplier above 1 from these perks or Last Breath also sets the saturated tracer (`trailSaturated`) [src:survev/server/src/game/weaponManager.ts:700-703] [src:survev/server/src/game/weaponManager.ts:936] [H]
- Last Breath (orig `final_bugle`): `damageMult × 1.08` while active [src:survev/server/src/game/weaponManager.ts:694-696] [src:survev/shared/defs/gameObjects/perkDefs.ts:48-53] [H]
- One In The Chamber (orig): × 1.25 on the first and last round, thick saturated tracer, no 12 gauge [src:survev/server/src/game/weaponManager.ts:815-836] [H]
- 9mm Overpressure (orig `bonus_9mm`): spread × 1.1, speed × 1.2, distance × 1.2 in survev (fork lowered it from 1.25). The original bonus bullet defs show × 1.25 speed and distance [src:survev/shared/defs/gameObjects/perkDefs.ts:128-132] [src:balance/335] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:791-834] [H]
- Hollow-points (orig `bonus_assault`, 0.8.8): speed × 1.1 in survev (fork added this in 0.3.13). Originally it was damage only [src:survev/shared/defs/gameObjects/perkDefs.ts:152-156] [src:balance/325] [src:changelog/0.8.8] [H]
- .45 In The Chamber (orig `bonus_45`, 0.8.5): survev adds a 1/6 chance of an "empowered" bullet (× 1.25 damage, × 1.2 speed, no spread, thick trail) (fork, 0.4.2) [src:survev/server/src/game/weaponManager.ts:875-887] [src:balance/334] [src:changelog/0.8.5] [H]
- High-Velocity Rounds (`high_velocity`): speed × 1.4, distance × 1.3 (fork perk) [src:survev/shared/defs/gameObjects/perkDefs.ts:141-144] [src:survev/server/src/game/weaponManager.ts:863-866] [H]
- Combat Stimulants (`combat_stims`): damage × 1.15 while active (fork perk; 1.12 before the fork's 0.4.2 change) [src:survev/shared/defs/gameObjects/perkDefs.ts:97-101] [src:balance/337] [H]
- AP Rounds (`ap_rounds`): armour penetration 0.8, obstacle damage × 1.5, `apSaturated` tracer colour (fork perk) [src:survev/shared/defs/gameObjects/perkDefs.ts:41-44] [src:survev/client/src/objects/bullet.ts:165-166] [H]
- Explosive Rounds (orig `explosive`, 0.8.72): `onHitFx = explosion_rounds` on every bullet that has no def-level `onHit` [src:survev/server/src/game/weaponManager.ts:946] [src:survev/server/src/game/objects/bullet.ts:207] [src:changelog/0.8.72] [H]
- Amped Explosives (fork): shrapnel count × 2, damage × 1.5, speed × 1.4, saturated shrapnel tracer [src:survev/shared/defs/gameObjects/perkDefs.ts:26-32] [src:survev/server/src/game/objects/explosion.ts:148-173] [H]
- Perks added by the fork (not in the original perk defs): ap_rounds, high_velocity, combat_stims, amped_explosives [src:derived/survev@9f64948d:src/defs/perkDefs.js:1-583] [src:survev/shared/defs/gameObjects/perkDefs.ts:26-165] [H]
- Last Breath trigger: when a player with the perk dies, the server fires a `bullet_invis` with `gameSourceType: "bugle"` and `shotAlt` so the client plays the alternate bugle sound (`bugle_03`) [src:survev/server/src/game/objects/player.ts:4528-4540] [src:survev/shared/defs/gameObjects/gunDefs.ts:3582-3639] [H]

## Shrapnel sources

| shrapnel bullet | explosion | count | prov | sources |
|---|---|---|---|---|
| shrapnel_frag | explosion_frag (frag grenade), explosion_mirv | 12, 12 | orig | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:31-40] [src:survev/shared/defs/gameObjects/explosionsDefs.ts:111-120] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:2-11] [H] |
| shrapnel_strobe | explosion_strobe | 3 | orig | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:51-60] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:22-31] [H] |
| shrapnel_barrel | explosion_barrel (barrels, since 0.1.7) | 12 | orig | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:61-70] [src:changelog/0.1.7] [H] |
| shrapnel_stove | explosion_stove | 16 | orig | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:71-80] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:42-51] [H] |
| shrapnel_usas | explosion_usas (USAS-12 frag round) | 9 | orig | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:81-90] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:52-61] [H] |
| shrapnel_mirv_mini | explosion_mirv_mini, explosion_martyr_nade | 7, 8 | orig | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:121-140] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:90-109] [H] |
| shrapnel_bomb_iron | explosion_bomb_iron (airstrike bomb) | 2 | orig | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:232-241] [src:derived/survev@9f64948d:src/defs/explosionsDefs.js:174-183] [H] |
| shrapnel_cobalt | explosion_cobalt (`cobalt_wall_int_4`, Twins bunker) | 20 | fork | [src:survev/shared/defs/gameObjects/explosionsDefs.ts:272-281] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:782-787] [H] |

- Shrapnel is fired from the explosion centre in a random direction (`v2.randomUnit()`) with `varianceT = Math.random()` and the explosion's damage source and attribution [src:survev/server/src/game/objects/explosion.ts:158-177] [H]
- `explosion_smoke`, `explosion_rounds` and `explosion_rounds_sg` name `shrapnel_frag` / `shrapnel_usas` but have count 0 [src:survev/shared/defs/gameObjects/explosionsDefs.ts:41-50] [src:survev/shared/defs/gameObjects/explosionsDefs.ts:91-110] [H]

## Tracer colours (`GameConfig.tracerColors`)

| key | regular | saturated | chambered | apSaturated | alphaRate / alphaMin | prov | sources |
|---|---|---|---|---|---|---|---|
| `9mm` | 0xfee2c6 | 0xffd9b3 | 0xff7f00 | 0xa54b0b (fork) | 0.92 / 0.14 | orig | [src:survev/shared/gameConfig.ts:319-326] [src:derived/survev@9f64948d:src/gameConfig.ts:178-184] [H] |
| `9mm_suppressed_bonus` | 0xfee2c6 | 0xffd9b3 | 0xff7f00 | 0xa54b0b (fork) | 0.96 / 0.28 | orig (used only by the removed bonus bullets) | [src:survev/shared/gameConfig.ts:327-334] [src:derived/survev@9f64948d:src/gameConfig.ts:185-191] [H] |
| `9mm_cursed` | 0x130900 | 0x130900 | 0x130900 | 0x130900 (fork) | 0.92 / 0.14 | orig | [src:survev/shared/gameConfig.ts:335-342] [H] |
| `762mm` | 0xc5d6fe | 0xabc4ff | 0x4cff | 0x0000c8 (fork) | 0.94 / 0.2 | orig | [src:survev/shared/gameConfig.ts:343-350] [H] |
| `12gauge` | 0xfedcdc | 0xfedcdc | 0xff0000 | 0x9f0000 (fork) | — | orig | [src:survev/shared/gameConfig.ts:351-356] [H] |
| `556mm` | 0xa9ff92 | 0xa9ff92 | 0x36ff00 | 0x308000 (fork) | 0.92 / 0.14 | orig | [src:survev/shared/gameConfig.ts:357-364] [H] |
| `50AE` | 0xfff088 | 0xfff088 | 0xffdf00 | 0xff8000 (fork) | — | orig | [src:survev/shared/gameConfig.ts:365-370] [H] |
| `308sub` | 0x252b00 | 0x465000 | 0x131600 | 0x000a02 (fork) | 0.92 / 0.07 | orig | [src:survev/shared/gameConfig.ts:371-378] [H] |
| `flare` | 0xe2e2e2 | 0xe2e2e2 | 0xc4c4c4 | 0xc4c4c4 (fork) | — | orig | [src:survev/shared/gameConfig.ts:379-384] [H] |
| `45acp` | 0xecbeff | 0xe7acff | 0xb500ff | 0x470349 (fork) | — | orig | [src:survev/shared/gameConfig.ts:385-390] [H] |
| `shrapnel` | 0x333333 | 0x333333 | 0x660900 (fork) | — | — | orig | [src:survev/shared/gameConfig.ts:391-395] [src:derived/survev@9f64948d:src/gameConfig.ts:240] [H] |
| `frag` | 0xcb0000 | 0xcb0000 | — | 0xcb0000 (fork) | — | orig | [src:survev/shared/gameConfig.ts:396] [H] |
| `invis` | 0 | 0 | 0 | 0 (fork) | — | orig | [src:survev/shared/gameConfig.ts:397] [H] |

- The original client colour table has `regular`, `saturated`, `chambered` and optional `alphaRate`/`alphaMin` for each key, with no `apSaturated` entries [src:derived/survev@9f64948d:src/gameConfig.ts:177-243] [H]
- Tint choice on the client: AP Rounds → `apSaturated`; saturated trail (ammo perk or chambered round) → `chambered` (else `saturated`); shooter standing on a bright surface → `saturated`; otherwise `regular` [src:survev/client/src/objects/bullet.ts:162-172] [H]
- Map override: survev's Woods Snow map sets 762mm to regular 0x96a1e6, saturated 0xabc4ff, alphaRate 0.96, alphaMin 0.4. The base map has an empty override [src:survev/shared/defs/maps/woodsSnowDefs.ts:32-39] [src:survev/shared/defs/maps/baseDefs.ts:55] [H]
- The 0.8.82 relaunch bundle holds 8 map defs (Normal, Desert, Woods, 50v50, Potato, Savannah, Halloween, Cobalt) and all have an empty `tracerColors` override; it has no Woods Snow def, so that override is not part of the 0.8.82 client [src:kong/relaunch-client-defs] [H]
- Bullet whiz sound: a bullet from another player that comes within 7.5 units of the local camera, on the same audio layer, plays the `bullet_whiz` group once (fallOff 4) [src:survev/client/src/objects/bullet.ts:221-233] [H]

## Conflicts

- CONFLICT vss-bullet: survev bullet_vss damage 24, speed 110, falloff 0.85 [src:survev/shared/defs/gameObjects/bulletDefs.ts:546-559] vs balance.txt damage "24.5 [0.2.12]" [src:balance/39-43]; proposed: use original 22 / 95 / 0.8 [src:derived/survev@9f64948d:src/defs/bulletDefs.js:482-495] [L]
- CONFLICT fandom-bullet-range-speed: fandom infoboxes swap distance and speed for bullet_m1911 (80/88), bullet_ot38 (112/125), bullet_ots38 (115/135), bullet_colt45 (106/110) [src:fandom/M1911] [src:fandom/OT-38] [src:fandom/OTs-38] [src:fandom/Peacemaker] vs defs that list `speed` before `distance` [src:derived/survev@9f64948d:src/defs/bulletDefs.js:324-376]; proposed: trust the defs [M]
- CONFLICT vss-speed-fandom: fandom VSS bullet speed 94 [src:fandom/VSS] vs original 95 [src:derived/survev@9f64948d:src/defs/bulletDefs.js:482-495]; proposed: 95 [M]
- CONFLICT scarssr-obstacle-fandom: fandom Mk 20 SSR obstacle multiplier 1 [src:fandom/Mk_20_SSR] vs def 1.5 [src:derived/survev@9f64948d:src/defs/bulletDefs.js:153-166]; proposed: 1.5 [M]
- CONFLICT shotgun-distadj: survev gives shotgun pellets and USAS frag rounds no distance jitter (`noDistAdj`, a field added in survev 4ec08611; the code comment says pellets already get positional jitter) [src:survev/server/src/game/objects/bullet.ts:220-229] [src:derived/survev-git-4ec08611] vs original defs, which have no such flag, while the original client applies whatever `distAdjIdx` the server sends [src:derived/survev@9f64948d:src/defs/bulletDefs.js:206-271] [src:derived/survev@8715a605:client/js/app.js:106465]; proposed: keep the survev behaviour as a knob. The original server's choice is not visible in client data [L]
- CONFLICT m870-range-namu: namu M870 range 29 [src:namu/Surviv.io/무기] vs bullet_buckshot distance 27 [src:derived/survev@9f64948d:src/defs/bulletDefs.js:206-218]; proposed: 27 [L]

## Open questions

- The server-side bullet code (falloff linearity, the reflection rules) is survev's reconstruction from the original client and from Bit Heroes Arena. The distance-jitter and range formulas are confirmed by the original client's own bullet code, but falloff and reflection are confirmed only indirectly, by wiki descriptions of linear falloff and the 3-reflection limit [src:survev/server/src/game/objects/bullet.ts:16-17] [src:derived/survev@8715a605:client/js/app.js:106463-106484] [src:wikigg/Guns] [L]
- Did the original server roll `distAdjIdx` over 0–15 (the 4-bit range) or 0–16 as survev does? [src:derived/survev@8715a605:client/js/app.js:44034] [src:survev/server/src/game/objects/bullet.ts:225-229] [L]
- Which original perks changed bullet speed or damage server-side (9mm Overpressure damage, Hollow-points damage) is not in client data; only the bonus-bullet speed and distance (× 1.25) are known [src:derived/survev@9f64948d:src/defs/bulletDefs.js:791-834] [src:l10n/ko:game-bonus_9mm-desc] [L]
- Fandom puts Spud Gun damage at 13, but bullet_potato does 0 damage, so the damage must come from the `potato_smgshot` projectile; its explosion values need checking in the throwables and explosions docs [src:fandom/Spud_Gun] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:670-683] [L]
