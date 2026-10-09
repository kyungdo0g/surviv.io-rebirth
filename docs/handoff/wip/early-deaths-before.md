# Early deaths, before (bots at 40a5c24)

## 80 players (3 seeds: 1, 2, 3)

### Alive over time

| t (s) | mean | min | max | mean % |
|---|---|---|---|---|
| 0 | 80.0 | 80 | 80 | 100% |
| 15 | 75.7 | 75 | 77 | 95% |
| 30 | 62.7 | 61 | 66 | 78% |
| 45 | 50.3 | 47 | 54 | 63% |
| 60 | 37.3 | 34 | 40 | 47% |
| 75 | 29.7 | 27 | 32 | 37% |
| 90 | 24.0 | 22 | 27 | 30% |
| 105 | 18.3 | 16 | 20 | 23% |
| 120 | 14.7 | 13 | 16 | 18% |
| 135 | 13.0 | 12 | 14 | 16% |
| 150 | 9.3 | 7 | 12 | 12% |
| 165 | 9.3 | 7 | 12 | 12% |
| 180 | 8.0 | 6 | 11 | 10% |
| 195 | 5.7 | 5 | 6 | 7% |
| 210 | 4.7 | 4 | 5 | 6% |
| 225 | 4.0 | 4 | 4 | 5% |
| 240 | 2.7 | 1 | 4 | 3% |
| 255 | 2.3 | 1 | 4 | 3% |
| 270 | 2.0 | 1 | 3 | 3% |
| 285 | 2.0 | 1 | 3 | 3% |
| 300 | 1.7 | 1 | 3 | 2% |
| 315 | 1.7 | 1 | 3 | 2% |
| 330 | 1.3 | 1 | 2 | 2% |
| 345 | 1.3 | 1 | 2 | 2% |
| 360 | 1.3 | 1 | 2 | 2% |

| gas stage | starts at (s) | mean alive | % |
|---|---|---|---|
| gas 1 waits | 10 | 79.7 | 100% |
| gas 1 moves | 90 | 24.0 | 30% |
| gas 2 waits | 120 | 14.7 | 18% |
| gas 2 moves | 185 | 7.0 | 9% |
| gas 3 waits | 210 | 4.7 | 6% |
| gas 3 moves | 260 | 2.5 | 3% |
| gas 4 waits | 280 | 2.5 | 3% |
| gas 4 moves | 320 | 3.0 | 4% |
| gas 5 waits | 335 | 2.0 | 3% |
| gas 5 moves | 365 | 2.0 | 3% |
| gas 6 waits | 375 | 2.0 | 3% |

Match length 293 / 389 / 234 s; alive at 80 s (first gas moves) 37%, at 200 s (second gas closed) 7%.

### Clustered deaths (3+ deaths linked within 5 s and 40 u)

First 120 s: 3 of 196 deaths in bursts (2%), 193 singly; whole match: 6 of 237 (3%). Bursts per match 0.7, largest 3 deaths.

| burst kind | bursts | deaths | of them in the first 120 s | mean size | mean span (s) |
|---|---|---|---|---|---|
| explosion: grenade | 1 | 3 | 0 | 3.0 | 2.2 |
| gun: one shooter kills several | 1 | 3 | 3 | 3.0 | 6.2 |

Kill feed (map-wide, first 120 s): most deaths in any 5 s window 9 / 9 / 9 per match; 80% of the deaths came with 2+ others within 5 s anywhere on the map; mean rate 32.7 deaths per minute.

Explosion deaths: 11 (barrel_01 4, frag 7), 1 of them in bursts. Gas deaths 0, air drop 0.

Bursts starting in the first 120 s:

| seed | t (s) | deaths | span (s) | kind | causes | killers | victims armed | victim behaviour |
|---|---|---|---|---|---|---|---|---|
| 1 | 42 | 3 | 6.2 | gun: one shooter kills several | gun:assault x3 | 1 | 1/3 | flee, rush, fight |

### Deaths by cause and time (all seeds)

| window | all | fists | gun:pistol | gun:smg | gun:shotgun | gun:assault | gun:dmr | gun:lmg | explosion |
|---|---|---|---|---|---|---|---|---|---|
| 0-60 s | 128 | 8 | 27 | 40 | 25 | 22 | 1 | 1 | 4 |
| 60-120 s | 68 | 1 | 5 | 24 | 11 | 22 | 1 | 0 | 4 |
| 120-200 s | 29 | 0 | 0 | 9 | 9 | 9 | 0 | 0 | 2 |
| 200-360 s | 11 | 0 | 0 | 0 | 5 | 5 | 0 | 0 | 1 |
| 360 s+ | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| total | 237 | 9 | 32 | 73 | 51 | 58 | 2 | 1 | 11 |

### Fist and melee deaths by armed state (killer / victim)

| window | melee deaths | unarmed kills unarmed | fist rusher kills armed | unarmed kills armed | armed (melee) kills unarmed | armed (melee) kills armed |
|---|---|---|---|---|---|---|
| 0-60 s | 8 | 6 | 0 | 0 | 2 | 0 |
| 60-120 s | 1 | 1 | 0 | 0 | 0 | 0 |
| 120-200 s | 0 | 0 | 0 | 0 | 0 | 0 |
| 200-360 s | 0 | 0 | 0 | 0 | 0 | 0 |
| 360 s+ | 0 | 0 | 0 | 0 | 0 | 0 |
| total | 9 | 7 | 0 | 0 | 2 | 0 |

Gun deaths: 162 armed victims (gun out 90%), 55 unarmed victims, of which 6 were fist-rushing the last 3 s (an armed player killing a rusher).

First 120 s, deaths to a player: the killer hit first 78%; exchange length median 2.1 s; distance at the first hit median 11.8 u; victim behaviour at the killer's first hit fight 33%, (started it) 22%, flee 20%, break 6%, explore 5%, loot 4%.

Exchanges of hits started in the first 120 s (per match):

| exchange | per match | first hitter killed the other | first hitter died | nobody died |
|---|---|---|---|---|
| all | 101.0 | 50% | 14% | 35% |
| armed hits unarmed | 41.3 | 46% | 1% | 53% |
| armed hits armed | 50.0 | 60% | 25% | 15% |
| unarmed hits armed | 1.3 | 50% | 25% | 25% |
| unarmed hits unarmed | 8.3 | 16% | 12% | 72% |

Target behaviour at the first hit: fight 41%, flee 30%, break 7%, explore 5%, loot 4%, disengage 3%, evade 3%.

Encounters in the first 120 s (two standing players first within 15 u; a hit or a kill between them within 10 s), per match:

| armed of the two | encounters | led to a hit | led to a kill |
|---|---|---|---|
| 0 | 32.7 | 30% | 9% |
| 1 | 44.3 | 59% | 29% |
| 2 | 43.0 | 84% | 66% |

Bullets that hit a player in the first 120 s: 30% of 7703.

Fight starts of armed bots in the first 120 s (a new target in the fight behaviour, per match):

| why | per match | median dist | median fight score | median best loot score |
|---|---|---|---|---|
| hit or shot at | 30.0 | 20.7 | 0.78 | 0.23 |
| mutual (target already on it) | 122.7 | 16.7 | 0.78 | 0.16 |
| unprovoked, >= 12 u, target armed | 102.3 | 22.5 | 0.74 | 0.19 |
| unprovoked, >= 12 u, target unarmed | 79.3 | 23.9 | 0.77 | 0.23 |
| unprovoked, close (< 12 u), target armed | 6.0 | 11.0 | 0.78 | 0.25 |
| unprovoked, close (< 12 u), target unarmed | 18.3 | 9.8 | 0.84 | 0.36 |

Fight starts by persona: rifleman 28%, rusher 22%, looter 16%, marksman 14%, camper 10%, rat 9%; left behaviour: loot 34%, fight 15%, explore 14%, search 9%, evade 6%, disengage 6%.

First 120 s: 196 deaths; victims unarmed 33%; victim behaviour fight 63%, flee 19%, break 5%, evade 4%; killer behaviour fight 95%, - 2%, loot 2%, flee 1%; victim persona rifleman 33%, rusher 21%, looter 14%, marksman 12%; killer persona rifleman 30%, rusher 24%, marksman 14%, looter 11%.

### Fist rushes and fist duels

| episodes | n | reached 3 u | target killed by it | it killed by target | someone else died/killed | armed up | broke off | mean s |
|---|---|---|---|---|---|---|---|---|
| fist rush | 14 | 57% | 7% | 29% | 14% | 0% | 50% | 5.5 |
| fist duel | 112 | 86% | 6% | 6% | 3% | 3% | 82% | 1.9 |

Rushes per persona: rifleman 50%, rusher 36%, marksman 7%, rat 7%.

### Density

Nearest other player at spawn: median 46.9 u, mean 50.4 u; players within 20 u at 10 s 0.39, within 40 u 0.84; at 30 s 0.23 / 1.23.

Bots that had held a gun by 15 s 50%, by 30 s 62%, by 60 s 70%; median first gun 8.4 s.

Unarmed bots' time by behaviour, first 120 s: break 23%, explore 22%, flee 20%, loot 12%, zone 7%, heal 5%, fight 4%, puzzle 4%, evade 2% (1910 bot-seconds per match).

## 200 players (3 seeds: 1, 2, 3)

### Alive over time

| t (s) | mean | min | max | mean % |
|---|---|---|---|---|
| 0 | 200.0 | 200 | 200 | 100% |
| 15 | 182.7 | 182 | 183 | 91% |
| 30 | 137.3 | 133 | 140 | 69% |
| 45 | 98.7 | 90 | 104 | 49% |
| 60 | 74.0 | 71 | 77 | 37% |
| 75 | 54.0 | 48 | 59 | 27% |
| 90 | 41.3 | 36 | 48 | 21% |
| 105 | 31.3 | 29 | 35 | 16% |
| 120 | 24.7 | 21 | 28 | 12% |
| 135 | 19.7 | 16 | 22 | 10% |
| 150 | 15.3 | 14 | 17 | 8% |
| 165 | 12.3 | 10 | 15 | 6% |
| 180 | 10.7 | 8 | 14 | 5% |
| 195 | 7.7 | 5 | 10 | 4% |
| 210 | 6.7 | 5 | 9 | 3% |
| 225 | 5.7 | 4 | 8 | 3% |
| 240 | 4.7 | 3 | 6 | 2% |
| 255 | 4.0 | 3 | 5 | 2% |
| 270 | 3.7 | 2 | 5 | 2% |
| 285 | 2.7 | 1 | 4 | 1% |
| 300 | 2.0 | 1 | 3 | 1% |
| 315 | 2.0 | 1 | 3 | 1% |
| 330 | 2.0 | 1 | 3 | 1% |
| 345 | 2.0 | 1 | 3 | 1% |
| 360 | 1.7 | 1 | 3 | 1% |

| gas stage | starts at (s) | mean alive | % |
|---|---|---|---|
| gas 1 waits | 10 | 192.3 | 96% |
| gas 1 moves | 90 | 41.3 | 21% |
| gas 2 waits | 120 | 24.7 | 12% |
| gas 2 moves | 185 | 10.0 | 5% |
| gas 3 waits | 210 | 6.7 | 3% |
| gas 3 moves | 260 | 3.7 | 2% |
| gas 4 waits | 280 | 4.0 | 2% |
| gas 4 moves | 320 | 2.5 | 1% |
| gas 5 waits | 335 | 2.5 | 1% |
| gas 5 moves | 365 | 3.0 | 2% |
| gas 6 waits | 375 | 3.0 | 2% |

Match length 278 / 392 / 355 s; alive at 80 s (first gas moves) 27%, at 200 s (second gas closed) 4%.

### Clustered deaths (3+ deaths linked within 5 s and 40 u)

First 120 s: 87 of 526 deaths in bursts (17%), 439 singly; whole match: 90 of 597 (15%). Bursts per match 8.7, largest 6 deaths.

| burst kind | bursts | deaths | of them in the first 120 s | mean size | mean span (s) |
|---|---|---|---|---|---|
| explosion: grenade | 1 | 3 | 0 | 3.0 | 4.4 |
| explosion: map object | 1 | 6 | 6 | 6.0 | 9.6 |
| fist brawl | 4 | 14 | 14 | 3.5 | 4.2 |
| gun: one shooter kills several | 4 | 12 | 12 | 3.0 | 6.6 |
| gunfight with fists | 10 | 36 | 36 | 3.6 | 6.9 |
| gunfight: several shooters | 6 | 19 | 19 | 3.2 | 5.6 |

Kill feed (map-wide, first 120 s): most deaths in any 5 s window 22 / 19 / 19 per match; 97% of the deaths came with 2+ others within 5 s anywhere on the map; mean rate 87.7 deaths per minute.

Explosion deaths: 8 (frag 6, barrel_01 2), 3 of them in bursts. Gas deaths 0, air drop 0.

Bursts starting in the first 120 s:

| seed | t (s) | deaths | span (s) | kind | causes | killers | victims armed | victim behaviour |
|---|---|---|---|---|---|---|---|---|
| 1 | 9 | 3 | 4.8 | gunfight with fists | gun:pistol x2, fists | 2 | 0/3 | rush, fight |
| 1 | 15 | 3 | 5.5 | gun: one shooter kills several | gun:smg x2, fists | 1 | 1/3 | fight, break |
| 1 | 18 | 4 | 6.7 | fist brawl | fists x4 | 2 | 1/4 | fight |
| 1 | 19 | 4 | 6.8 | gunfight with fists | gun:smg x3, fists | 2 | 2/4 | flee, fight, evade |
| 1 | 19 | 3 | 0.6 | fist brawl | fists x3 | 2 | 0/3 | fight, rush |
| 1 | 25 | 3 | 4.2 | gun: one shooter kills several | gun:assault x3 | 1 | 0/3 | flee |
| 1 | 27 | 3 | 4.6 | gunfight with fists | gun:pistol, gun:smg, fists | 2 | 0/3 | rush, flee |
| 1 | 34 | 3 | 7.9 | gunfight with fists | fists, gun:smg, gun:assault | 3 | 1/3 | fight, flee |
| 1 | 42 | 3 | 1.7 | gunfight: several shooters | gun:pistol x3 | 2 | 0/3 | rush, flee |
| 1 | 78 | 4 | 4.2 | gunfight: several shooters | gun:shotgun x2, gun:pistol, gun:smg | 3 | 3/4 | flee, fight |
| 1 | 103 | 3 | 7.9 | gunfight: several shooters | gun:smg x2, gun:assault | 3 | 2/3 | flee, fight, disengage |
| 2 | 8 | 3 | 2.8 | fist brawl | fists x3 | 3 | 0/3 | fight |
| 2 | 16 | 6 | 9.6 | explosion: map object | gun:shotgun x3, fists, explosion(barrel_01) x2 | 2 | 3/6 | fight, flee, rush, disengage |
| 2 | 20 | 4 | 10.5 | gunfight with fists | fists, gun:smg, gun:pistol x2 | 3 | 2/4 | fight, flee |
| 2 | 25 | 3 | 4.0 | gunfight with fists | gun:pistol, fists x2 | 2 | 1/3 | flee, fight |
| 2 | 35 | 3 | 4.6 | gunfight: several shooters | gun:shotgun x2, gun:assault | 2 | 2/3 | flee, fight |
| 2 | 44 | 3 | 6.9 | gunfight: several shooters | gun:smg x2, gun:shotgun | 2 | 3/3 | fight |
| 2 | 60 | 3 | 7.4 | gunfight with fists | fists, gun:assault x2 | 2 | 0/3 | evade, flee |
| 3 | 10 | 4 | 5.8 | gunfight with fists | gun:shotgun x3, fists | 2 | 0/4 | break, flee, fight |
| 3 | 12 | 3 | 8.5 | gun: one shooter kills several | gun:pistol x3 | 1 | 0/3 | rush |
| 3 | 16 | 4 | 6.8 | fist brawl | fists x2, melee x2 | 3 | 0/4 | fight |
| 3 | 22 | 4 | 7.8 | gunfight with fists | gun:shotgun, gun:dmr, fists, gun:pistol | 4 | 2/4 | fight, break, flee |
| 3 | 28 | 3 | 8.0 | gunfight: several shooters | gun:smg, gun:pistol x2 | 3 | 2/3 | fight, flee |
| 3 | 31 | 5 | 9.7 | gunfight with fists | gun:shotgun, gun:assault x2, fists, gun:pistol | 3 | 1/5 | rush, fight, flee |
| 3 | 60 | 3 | 8.1 | gun: one shooter kills several | gun:smg x3 | 1 | 3/3 | fight |

### Deaths by cause and time (all seeds)

| window | all | fists | melee | gun:pistol | gun:smg | gun:shotgun | gun:assault | gun:dmr | gun:sniper | gun:lmg | explosion |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0-60 s | 378 | 82 | 3 | 77 | 92 | 66 | 46 | 5 | 1 | 1 | 5 |
| 60-120 s | 148 | 2 | 0 | 14 | 45 | 39 | 44 | 1 | 1 | 2 | 0 |
| 120-200 s | 53 | 0 | 0 | 2 | 12 | 13 | 18 | 4 | 1 | 0 | 3 |
| 200-360 s | 16 | 0 | 0 | 0 | 2 | 2 | 7 | 5 | 0 | 0 | 0 |
| 360 s+ | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| total | 597 | 84 | 3 | 93 | 151 | 122 | 115 | 15 | 3 | 3 | 8 |

### Fist and melee deaths by armed state (killer / victim)

| window | melee deaths | unarmed kills unarmed | fist rusher kills armed | unarmed kills armed | armed (melee) kills unarmed | armed (melee) kills armed |
|---|---|---|---|---|---|---|
| 0-60 s | 85 | 58 | 9 | 2 | 16 | 0 |
| 60-120 s | 2 | 2 | 0 | 0 | 0 | 0 |
| 120-200 s | 0 | 0 | 0 | 0 | 0 | 0 |
| 200-360 s | 0 | 0 | 0 | 0 | 0 | 0 |
| 360 s+ | 0 | 0 | 0 | 0 | 0 | 0 |
| total | 87 | 60 | 9 | 2 | 16 | 0 |

Gun deaths: 279 armed victims (gun out 84%), 223 unarmed victims, of which 41 were fist-rushing the last 3 s (an armed player killing a rusher).

First 120 s, deaths to a player: the killer hit first 83%; exchange length median 1.7 s; distance at the first hit median 10.3 u; victim behaviour at the killer's first hit fight 35%, flee 27%, (started it) 17%, rush 8%, break 6%, explore 2%.

Exchanges of hits started in the first 120 s (per match):

| exchange | per match | first hitter killed the other | first hitter died | nobody died |
|---|---|---|---|---|
| all | 304.3 | 49% | 10% | 42% |
| armed hits unarmed | 142.7 | 50% | 1% | 48% |
| armed hits armed | 96.7 | 59% | 20% | 21% |
| unarmed hits armed | 10.3 | 26% | 35% | 39% |
| unarmed hits unarmed | 54.7 | 30% | 9% | 61% |

Target behaviour at the first hit: fight 44%, flee 33%, rush 6%, break 6%, explore 3%, loot 3%, disengage 2%.

Encounters in the first 120 s (two standing players first within 15 u; a hit or a kill between them within 10 s), per match:

| armed of the two | encounters | led to a hit | led to a kill |
|---|---|---|---|
| 0 | 221.3 | 28% | 9% |
| 1 | 176.7 | 55% | 31% |
| 2 | 83.3 | 82% | 59% |

Bullets that hit a player in the first 120 s: 32% of 15306.

Fight starts of armed bots in the first 120 s (a new target in the fight behaviour, per match):

| why | per match | median dist | median fight score | median best loot score |
|---|---|---|---|---|
| hit or shot at | 110.3 | 19.2 | 0.78 | 0.22 |
| mutual (target already on it) | 263.0 | 16.0 | 0.78 | 0.19 |
| unprovoked, >= 12 u, target armed | 212.7 | 22.1 | 0.74 | 0.18 |
| unprovoked, >= 12 u, target unarmed | 329.3 | 22.4 | 0.78 | 0.22 |
| unprovoked, close (< 12 u), target armed | 18.0 | 11.0 | 0.78 | 0.18 |
| unprovoked, close (< 12 u), target unarmed | 70.3 | 9.2 | 0.84 | 0.35 |

Fight starts by persona: rifleman 35%, rusher 23%, looter 14%, rat 11%, marksman 9%, camper 9%; left behaviour: loot 34%, fight 29%, explore 11%, evade 6%, search 5%, disengage 4%.

First 120 s: 526 deaths; victims unarmed 55%; victim behaviour fight 51%, flee 30%, rush 10%, break 3%; killer behaviour fight 92%, rush 2%, loot 2%, evade 1%; victim persona rifleman 30%, rusher 23%, marksman 15%, looter 14%; killer persona rifleman 29%, rusher 25%, looter 15%, rat 11%.

### Fist rushes and fist duels

| episodes | n | reached 3 u | target killed by it | it killed by target | someone else died/killed | armed up | broke off | mean s |
|---|---|---|---|---|---|---|---|---|
| fist rush | 107 | 66% | 9% | 46% | 10% | 0% | 35% | 4.2 |
| rush vs pistol | 43 | 67% | 5% | 56% | 12% | 0% | 28% | 3.8 |
| rush vs shotgun | 13 | 46% | 8% | 69% | 0% | 0% | 23% | 2.7 |
| rush vs assault | 14 | 43% | 14% | 43% | 7% | 0% | 36% | 2.4 |
| fist duel | 683 | 88% | 7% | 7% | 4% | 2% | 80% | 1.9 |

Rushes per persona: rusher 40%, rifleman 32%, marksman 18%, looter 9%, rat 1%.

### Density

Nearest other player at spawn: median 32.6 u, mean 34.6 u; players within 20 u at 10 s 0.79, within 40 u 2.10; at 30 s 0.64 / 2.32.

Bots that had held a gun by 15 s 37%, by 30 s 44%, by 60 s 49%; median first gun 7.0 s.

Unarmed bots' time by behaviour, first 120 s: flee 26%, explore 24%, break 17%, loot 9%, fight 7%, zone 5%, heal 3%, rush 3%, evade 2% (5782 bot-seconds per match).

