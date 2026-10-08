# 한국어 용어집 (Korean glossary)

> 공식 한국어 파일 `client/public/l10n/ko.json`과 영어 원문 `client/src/en.json`(survev 클론 c6185e31)을 키 단위로 맞춘 용어집이다. 표의 모든 행은 `l10n/en:<키>`와 `l10n/ko:<키>`를 인용한다.
> 표 읽는 법: "한국어" 열의 `(원본: …)`은 survev가 2024-02에 가져온 최초 번역(아래 "파일 이력")과 현재 값이 다를 때의 최초 값, `†`는 survev가 나중에 추가한 번역, `— (누락)`은 ko.json에 키가 없음을 뜻한다. "English" 열의 `(원본: …)`도 같은 방식으로 최초 영어 값을 보인다.
> "리버스 표기" 열: `=`는 현재 ko.json 값을 그대로 쓴다는 뜻이고, 그 밖의 값은 이 문서 "수정 제안" 절의 근거에 따른 제안이다. `(fork)`/`(post-0.8.82)` 표시는 `provenance/fork-vs-original.json`의 분류를 따른다.
> 0.8.82가 목표이므로, 영어 문구가 fork 밸런스 변경 때문에 바뀐 항목은 원본 문구(와 그에 맞는 원본 한국어)를 기준으로 삼는다.

## 파일 구조와 범위

- en.json에는 1055개 키, ko.json에는 773개 키가 있다 [src:survev/client/src/en.json, survev/client/public/l10n/ko.json] [H]
- en.json 키 중 331개가 ko.json에 없다 (이모트 148개, 퀘스트 46개, 조준선 30개, 설명문(lore) 20개, 치유·부스트 효과 15개, 나머지는 fork 아이템과 UI 문자열) [src:survev/client/src/en.json, survev/client/public/l10n/ko.json, derived/key-diff] [H]
- ko.json에만 있는 키는 49개다: 키 바인딩 이름 `bind-*` 34개, 마우스 버튼 이름 4개, SNS 보상 문구 8개, `index-facebook`, `index-proxy-sites`, 오타 키 `game-outifitBeachCamo` [src:survev/client/public/l10n/ko.json, derived/key-diff] [H]
- 영어 키 바인딩 이름은 en.json이 아니라 `inputBinds.ts`에 하드코딩되어 있다 (예: "Move Left") [src:survev/client/src/inputBinds.ts:27] [H]
- 어순 키 `word-order`는 en "svo", ko "SOV"이며 킬피드 문장 조립에 쓰인다 [src:l10n/en:word-order, l10n/ko:word-order] [H]
- 클라이언트는 `./l10n/<locale>.json`을 불러오고 언어 목록에서 ko를 "한국어"로 표시한다 [src:survev/client/src/ui/localization.ts:53, survev/client/src/ui/localization.ts:32] [H]
- l10n 폴더에는 da, de, es, fr, it, jp, ko, nl, pl, pt, ru, sv, th, tr, vn, zh-cn, zh-tw 17개 파일이 있고(영어는 `client/src/en.json`), 통계 페이지용 `l10n/stats/`에는 es·jp만 있어 한국어 통계 번역은 없다 [src:survev/client/public/l10n/ko.json, survev/client/public/l10n/stats/jp.json] [H]
- 한국어 현지화는 원작 0.2.3(2018-01-30)에 처음 추가되었다 [src:changelog/0.2.3] [H]

## 파일 이력 (원본 번역 vs survev 수정)

- survev는 2024-02-24 커밋 a14ab228에서 번역 파일을 "survivreloaded-client에서 가져왔다"고 적었고, 이때 ko.json은 705개 키였다 [src:derived/git-a14ab228] [H]
- 같은 커밋의 en.json도 705개 키로, 원작 클라이언트 문자열("Survivr Pass 1", "Discord Moderatr", "Set your battletag")을 담고 있다 [src:derived/git-a14ab228] [H]
- 그 뒤 survev는 ko.json 값 162개를 고치고 키 69개를 추가했다 (주요 커밋: 97804acf 2026-03-14, 4d5acbc8 2026-03-24 "better korean translations", b57acc92 2026-04-09 "surviv pass -> survev pass", 041a869f 2026-05-04 "improve ko.json", 18d34661 2026-08-28) [src:derived/git-97804acf, derived/git-4d5acbc8, derived/git-b57acc92, derived/git-041a869f, derived/git-18d34661] [H]
- 따라서 a14ab228의 ko.json이 원작 0.8.x 한국어에 가장 가깝고, 현재 ko.json은 survev가 다듬은 번역이다 (원작 그대로라는 직접 증거는 없음) [src:derived/git-a14ab228] [M]
- 현재 en.json은 a14ab228 대비 34개 값이 바뀌었고, 그중 퍽 설명 4개(Fabricate, Flak Jacket, Hollow-Points, .45 in the Chamber)는 fork 밸런스 변경을 반영한 것이다 [src:balance/299, balance/316, balance/325, balance/334, derived/git-a14ab228] [H]
- 그 4개 퍽의 ko.json 설명은 영어 원본 문구(예: Fabricate "파편 수류탄을 채워줍니다")를 그대로 번역한 상태라, 0.8.82 기준으로는 오히려 정확하다 [src:l10n/ko:game-fabricate-desc, l10n/ko:game-flak_jacket-desc, l10n/ko:game-bonus_assault-desc, l10n/ko:game-bonus_45-desc] [H]
- 마찬가지로 ko.json의 "층"(`loadout-rarity`), "획득함"(`loadout-newest`), "링크 서비스"(`index-link-account`), "새로운 임무를 얻을?"(`quest-refresh-prompt`)은 영어 원본 "Tier", "Acquired", "Link Services", "Get a new mission?"을 옮긴 것이다 [src:l10n/ko:loadout-rarity, l10n/ko:loadout-newest, l10n/ko:index-link-account, l10n/ko:quest-refresh-prompt, derived/git-a14ab228] [H]

## 핵심 용어 요약

| 개념 | survev id | 원본 ko (2024 import) | 현재 ko.json | 나무위키·커뮤니티 | 리버스 표기 | 출처 |
|---|---|---|---|---|---|---|
| 레드존 | (gas) | 레드존 | 레드존 / 세이프 존 | 레드존, 자기장 | 레드존 | [src:l10n/ko:game-the-red-zone, l10n/ko:game-red-zone-advancing, namu/Surviv.io] [H] |
| 공중 보급 | airdrop_crate_01 | 공중 투하 | 공중 보급 | 에어드랍, 보급 | 공중 보급 | [src:l10n/ko:game-airdrop_crate_01, namu/Surviv.io/오브젝트] [H] |
| 공습 | (air strike) | 공중 강습 | 공습 | 공습 | 공습 | [src:l10n/ko:game-the-air-strike, namu/Surviv.io/오브젝트] [H] |
| 솔로/듀오/스쿼드 | solo/duo/squad | 솔로/듀오/스쿼드 | 개인전/2인 팀전/분대(4명) | 솔로/듀오/스쿼드 | 솔로/듀오/스쿼드 | [src:l10n/ko:index-solo, l10n/ko:index-duo, l10n/ko:index-squad, l10n/ko:quest_top_solo, namu/Surviv.io] [H] |
| 소생 (기절 팀원 살리기) | revive | 부활 | 소생 (`index-revive`만 부활) | 부활/소생 | 소생 | [src:l10n/ko:game-reviving, l10n/ko:index-revive] [H] |
| 퍽 | perk | 특전 | 특전 (설명문 안에서만) | 퍽 | 특전 (별칭 퍽) | [src:l10n/ko:game-trick_nothing-desc, l10n/ko:game-targeting-desc, namu/Surviv.io/이벤트] [H] |
| 부스트 상태 | boost | 부스트 | 아드레날린/부스트 | 도핑 | 아드레날린 | [src:l10n/ko:game-adrenaline-tooltip, l10n/ko:game-soda-tooltip, namu/Surviv.io/팁] [H] |
| 2레벨 가방 | backpack02 | 레귤러 팩 | 큰 가방 | 보통 가방 | 보통 가방 | [src:l10n/ko:game-backpack02, namu/Surviv.io/장비] [H] |
| 3레벨 가방 | backpack03 | 밀리터리 팩 | 밀리터리 가방 | 군용 가방 | 군용 가방 | [src:l10n/ko:game-backpack03, namu/Surviv.io/장비] [H] |
| 희귀도 epic | (rarity 4) | 전설 | 전설 | 영웅 | 영웅 | [src:l10n/ko:loadout-epic, namu/Surviv.io/의류] [H] |
| 50v50 의무병 | medic | 위생병 | 의사 | 의무병 | 위생병 | [src:l10n/ko:game-medic, namu/Surviv.io/이벤트, derived/git-a14ab228] [H] |
| 코발트 의무병 | healer | 메딕 | 메딕 | 의무병 | 메딕 | [src:l10n/ko:game-healer, namu/Surviv.io/직업] [H] |
| 50v50 정찰병 | recon | 정찰병 | 정찰병 | 정찰병 | 정찰병 | [src:l10n/ko:game-recon, namu/Surviv.io/이벤트] [H] |
| 코발트 정찰병 | scout | 정찰병 | 정찰병 | 정찰병 | 스카우트 | [src:l10n/ko:game-scout, namu/Surviv.io/직업] [H] |
| 마크스맨 | marksman | 명사수 | 명사수 | 마크스맨 | 명사수 (별칭 마크스맨) | [src:l10n/ko:game-marksman, namu/Surviv.io/이벤트] [H] |
| 나팔수 | bugler | 나팔수 | 나팔수 | 나팔병 | 나팔수 | [src:l10n/ko:game-bugler, namu/Surviv.io/이벤트] [H] |
| 지휘관 | leader | 지휘관 | 지휘관 | 지휘관, 리더 | 지휘관 | [src:l10n/ko:game-leader, namu/Surviv.io/이벤트] [H] |
| 방폭 재킷 (퍽) | flak_jacket | 방탄 조끼 | 방탄 조끼 | 방탄 조끼 | 방폭 재킷 | [src:l10n/ko:game-flak_jacket, l10n/ko:game-chest01, namu/Surviv.io/이벤트] [H] |
| 신호탄 (총) | flare / flare_gun | 섬광탄 (총) | 섬광탄 (총) | 플레어건, 신호탄 총 | 신호탄 (총) | [src:l10n/ko:game-flare, l10n/ko:game-flare_gun, namu/Surviv.io/장비] [H] |
| 상자 나무 | (id 미확인) | — | — | 상자 나무 | 상자 나무 | [src:namu/Surviv.io/오브젝트] [M] |
| 소련 상자 | crate_02 | — | (퀘스트 키 누락) | 소련 상자, 군용 상자 | 소련 상자 | [src:l10n/en:quest_soviet_crate, namu/Surviv.io/오브젝트] [H] |
| 게임 통칭 | — | — | — | 서밥 (디시) | (해당 없음) | [src:web/https://gall.dcinside.com/mgallery/board/view/?id=surviv&no=6506] [M] |

## 수정 제안 (fixes)

> 각 항목: 문제 → 근거 → 리버스 제안. 제안은 리버스 한국어 파일의 기본값이며, 충돌 판정은 아래 Conflicts에도 기록했다.

### 같은 말이 두 대상을 가리키는 충돌

- FIX scout-recon: 50v50 Recon(`recon`)과 코발트 Scout(`scout`)가 둘 다 "정찰병"이다; 리버스는 recon=정찰병, scout=스카우트로 나눈다 (Scout Elite "스카우트 엘리트", Scouting Crowbar "스카우팅 크로우바"와도 맞음) [src:l10n/ko:game-recon, l10n/ko:game-scout, l10n/ko:game-scout_elite, l10n/ko:game-crowbar_scout] [H]
- FIX medic-healer: 영어는 50v50 `medic`과 코발트 `healer`를 둘 다 "Medic"으로 쓰고, ko는 "의사"와 "메딕"으로 갈랐다; 나무위키는 둘 다 "의무병"이라 퍽 "전투 의무병"(Combat Medic)과 겹친다; 리버스는 medic=위생병(원본 번역 복원), healer=메딕을 쓴다 [src:l10n/en:game-medic, l10n/en:game-healer, l10n/ko:game-medic, l10n/ko:game-healer, l10n/ko:game-field_medic, namu/Surviv.io/이벤트, derived/git-a14ab228] [H]
- FIX flak-vs-vest: 퍽 Flak Jacket이 "방탄 조끼"라 조끼 장비("1레벨 조끼")와 헷갈리고, 실제 효과는 총탄이 아니라 폭발·파편 감쇠다; 리버스는 "방폭 재킷" [src:l10n/ko:game-flak_jacket, l10n/en:game-flak_jacket-desc, l10n/ko:game-chest01, survev/shared/defs/gameObjects/perkDefs.ts:17] [H]
- FIX bowie-duplicate: Bowie Vintage와 Bowie Frontier가 둘 다 "빈티지 보이 나이프"다; 리버스는 "빈티지 보위 나이프"/"프론티어 보위 나이프" (Bowie knife의 표준 표기는 "보위 나이프") [src:l10n/ko:game-bowie_vintage, l10n/ko:game-bowie_frontier] [H]
- FIX leader-killleader: `game-waiting-for-new-leader`(새 지휘관을 기다림)가 survev 수정에서 "새로운 킬 리더 대기 중"이 되어 별개 역할 Kill Leader("킬 리더")와 섞였다; 원본은 "새로운 리더 대기 중"; 리버스는 "새 지휘관 대기 중" [src:l10n/ko:game-waiting-for-new-leader, l10n/ko:game-kill_leader, l10n/ko:game-leader, derived/git-041a869f] [H]
- FIX hunted-two-terms: 같은 The Hunted가 역할 이름에서는 "수배자", 퍽 이름에서는 "수배중"이다 (원본은 둘 다 "사냥 대상"); 의미 차이가 작아 리버스는 그대로 두되 퀘스트 `quest_promote_hunted`는 "수배자가 되어라"로 맞춘다 [src:l10n/ko:game-the_hunted, l10n/ko:game-hunted, l10n/en:quest_promote_hunted] [H]
- FIX captain-helmet: 역할 Captain(fork)은 "대장", 그 헬멧은 "대장모"라 어색하다; 리버스는 "대장 헬멧" (fork 콘텐츠라 선택 사항) [src:l10n/ko:game-captain, l10n/ko:game-helmet04_captain] [H]

### 오역·부자연스러운 번역

- FIX flare-flashbang: Flare/Flare Gun을 "섬광탄/섬광탄 총"으로 옮겼는데 섬광탄은 플래시뱅을 뜻한다; 리버스는 "신호탄/신호탄 총" [src:l10n/ko:game-flare, l10n/ko:game-flare_gun, l10n/en:game-flare] [H]
- FIX rarity-epic: Epic을 "전설", Uncommon을 "드문"(원본 "덜 흔한")으로 옮겼다; 나무위키는 일반·희귀·영웅을 쓴다; 리버스는 일반·고급·희귀·영웅·신화 [src:l10n/ko:loadout-epic, l10n/ko:loadout-uncommon, l10n/ko:loadout-mythic, namu/Surviv.io/의류] [H]
- FIX backpack-sizes: Regular Pack을 "큰 가방"으로 옮겨 실제 크기 순서(작은→보통→군용)와 어긋난다; 나무위키는 "보통 가방", "군용 가방"; 리버스는 주머니·작은 가방·보통 가방·군용 가방 [src:l10n/ko:game-backpack01, l10n/ko:game-backpack02, l10n/ko:game-backpack03, namu/Surviv.io/장비] [H]
- FIX loadout-sort-labels: 정렬 라벨 Rarity(원본 Tier)가 "층", Newest(원본 Acquired)가 "획득함", Alpha가 "알파", 테두리 옵션 Stroked가 "타격됨"이다; 리버스는 "희귀도", "최신순", "이름순", "테두리" [src:l10n/ko:loadout-rarity, l10n/ko:loadout-newest, l10n/ko:loadout-alpha, l10n/ko:loadout-stroked] [H]
- FIX attributions: Attributions(저작권 표시 페이지)가 "속성"으로 번역되었다; 리버스는 "저작권 표시" [src:l10n/ko:index-attributions] [H]
- FIX link-account: "링크 서비스"/"링크 서비스를"은 원본 영어 "Link Services"를 직역한 것이다; 리버스는 "계정 연동" [src:l10n/ko:index-link-account, l10n/ko:index-link-account-to] [H]
- FIX quest-refresh: "새로운 임무를 얻을?"은 문장이 끊겨 있다; 리버스는 "새 퀘스트를 받을까요?" [src:l10n/ko:quest-refresh-prompt] [H]
- FIX overpressure-typo: 9mm Overpressure가 "9mm 탄 과부화"로, "과부하"의 오타이며 의미(과압탄)와도 다르다 (원본 "과충전 9mm"); 리버스는 "9mm 과압탄" [src:l10n/ko:game-bonus_9mm, derived/git-a14ab228] [H]
- FIX revivify: Revivify가 "환원"(되돌림)으로 번역되었다; 리버스는 "자가 소생" [src:l10n/ko:game-self_revive, l10n/en:game-self_revive-desc] [H]
- FIX mass-medicate: Mass Medicate가 "집단 의료원"(원본 "매스 매디케이트")이고 설명문 어순도 깨져 있다; 리버스는 "집단 치료" [src:l10n/ko:game-aoe_heal, l10n/ko:game-aoe_heal-desc] [H]
- FIX targeting: High-Value Targets가 "고부가치의 목표물"(경제 용어)이다; 리버스는 "고가치 표적" [src:l10n/ko:game-targeting] [H]
- FIX chambered-pair: One in the Chamber는 "아직 한발 남았다"인데 .45 in the Chamber는 "챔버 내 .45 한 방"이라 짝이 안 맞는다; 리버스는 ".45 한발 남았다" [src:l10n/ko:game-chambered, l10n/ko:game-bonus_45] [H]
- FIX turkey-sound: Perky Shoot 설명 "Gobble, gobble!"(칠면조 소리)이 survev 수정에서 "꼬끼오오오!"(수탉)로 바뀌었다; 원본 "고르륵, 고르륵!"을 복원한다 [src:l10n/ko:game-turkey_shoot-desc, l10n/en:game-turkey_shoot-desc, derived/git-a14ab228] [H]
- FIX huntsman: Huntsman 칼이 "사냥꾼"(사람)으로 번역되었다; 리버스는 "헌츠맨" [src:l10n/ko:game-huntsman_rugged, l10n/ko:game-hud-huntsman_rugged] [H]
- FIX loanword-spelling: "길리 수트"는 외래어 표기법상 "길리 슈트", "슬렛지해머"는 "슬레지해머"가 맞다; 나무위키도 "길리 슈트"를 쓴다 [src:l10n/ko:game-outfitGhillie, l10n/ko:game-sledgehammer, namu/Surviv.io/의류] [H]
- FIX imperial-seal: Imperial Seal(문장·인장)이 "황실 봉인"(봉해 막음)으로 번역되었다; 나무위키는 "황실의 인장"; 리버스는 "황실의 인장" [src:l10n/ko:game-outfitImperial, namu/Surviv.io/의류] [H]
- FIX target-practice: Target Practice(`outfitRed`)는 ko "타깃 연습", 나무위키 "사격 표적"; 커뮤니티가 아는 이름인 "사격 표적"을 쓴다 [src:l10n/ko:game-outfitRed, namu/Surviv.io/의류] [M]
- FIX loadout-word: 메인 메뉴 Loadout이 "장비"인데 "장비"는 가방·방어구(나무위키 `/장비` 문서)와 겹친다; 리버스는 "로드아웃", 근접 스킨 탭은 "밀리 스킨" 대신 "근접 무기 스킨" [src:l10n/ko:index-loadout, l10n/ko:loadout-title-melee, namu/Surviv.io/장비] [H]
- FIX stats-word: Stats가 "스텟"(원본 "능력치")·"내 상태창"으로 번역되어 RPG 능력치처럼 읽힌다; 리버스는 "전적" ("전적 초기화", "내 전적") [src:l10n/ko:index-reset-stats, l10n/ko:index-my-stats, derived/git-4d5acbc8] [H]

### 내부 불일치

- FIX mode-names: 로비는 "개인전/2인 팀전/분대(4명)", 결과 화면은 "분대(4인) 등수", 퀘스트는 "솔로/듀오/스쿼드에서 Top N"으로 세 가지 표기가 섞여 있다 (원본은 전부 솔로/듀오/스쿼드); 리버스는 솔로/듀오/스쿼드로 통일 [src:l10n/ko:index-squad, l10n/ko:game-squad-rank, l10n/ko:quest_top_squad, derived/git-4d5acbc8] [H]
- FIX revive-term: 인게임은 "소생 중/팀원 소생"인데 조작 도움말 `index-revive`와 바인딩 `bind-revive`, Revivify 설명은 "부활"이다; 리스폰이 없는 게임이라 "부활"은 오해 소지가 있어 "소생"으로 통일 [src:l10n/ko:game-reviving, l10n/ko:index-revive, l10n/ko:bind-revive, l10n/ko:game-self_revive-desc, l10n/en:index-tips-1-desc] [H]
- FIX scope-word: 아이템 이름은 "N배율 스코프"인데 survev가 추가한 바인딩 이름은 "이전/다음 조준경 장착"이고 `game-aim-line`(Aim Line)과 `loadout-title-crosshair`(Crosshair)는 둘 다 "조준선"이다; 리버스는 바인딩을 "스코프"로 맞추고 Aim Line은 "조준 보조선"으로 구분한다 [src:l10n/ko:game-2xscope, l10n/ko:bind-equip-next-scope, l10n/ko:game-aim-line, l10n/ko:loadout-title-crosshair] [H]
- FIX lockers: 퀘스트는 "락커 파괴"(원본 "로커 파괴"), 나무위키는 "사물함"; 리버스는 "사물함 파괴" [src:l10n/ko:quest_lockers, namu/Surviv.io/오브젝트] [H]
- FIX stale-75: `game-healing-tooltip`은 "체력이 75를 넘어 치료할 수 없습니다"지만 붕대 상한은 0.7.1(2019-02-22)부터 100이다; 리버스는 이 문자열을 쓰지 않는다 [src:l10n/en:game-healing-tooltip, l10n/ko:game-healing-tooltip, changelog/0.7.1, survev/shared/defs/gameObjects/gearDefs.ts:393] [H]
- FIX beach-typo-key: ko.json의 Beach Shored 번역이 오타 키 `game-outifitBeachCamo`("해변가")에 들어 있어 화면에 나오지 않는다 (fork 의상) [src:l10n/ko:game-outifitBeachCamo, l10n/en:game-outfitBeachCamo] [H]
- FIX domain-strings: 모바일 안내(`index-mobile-tooltip`)는 survev.io를, 도움말(`index-tips-1-desc`·`index-tips-2-desc`) 한국어는 원작 이름 "Surviv.io"를 쓴다; 리버스는 자기 도메인·이름으로 바꾼다 [src:l10n/ko:index-mobile-tooltip, l10n/ko:index-tips-1-desc, l10n/en:index-tips-1-desc] [H]
- FIX pass-name: 패스 이름이 2026-04 survev 수정으로 "Survev 패스 1"이 되었다 (원본 "Surviv 패스 1", 영어 원본 "Survivr Pass 1"); 0.8.82 기준 이름은 "Survivr 패스 1" [src:l10n/ko:pass_survivr1, l10n/en:pass_survivr1, derived/git-b57acc92, changelog/0.8.6] [H]
- FIX moderator-outfit: 영어는 fork에서 "Game Moderatr"로 바뀌었지만 ko는 원본 "Discord Moderatr"를 따른 "Discord 관리자"다; 0.8.82 기준이 맞으므로 "디스코드 관리자"로 유지 [src:l10n/en:game-outfitMod, l10n/ko:game-outfitMod, derived/git-a14ab228] [H]
- FIX 50ae-label: 영어는 fork에서 ".50 Caliber"(fork 총 3종 포함)로 바뀌었지만 ko는 원본 ".50 AE"와 "데저트이글 50의 탄약"을 유지하고 있다; 0.8.82 기준으로는 ko 유지였으나, survev를 기준으로 삼은 뒤(ADR 0003, 2026-10-07) 리버스는 survev 영어 이름을 따라 ".50 구경"을 쓴다 [src:l10n/en:game-50AE, l10n/ko:game-50AE, l10n/ko:game-50AE-tooltip, derived/git-a14ab228, user/2026-10-07-survev-baseline] [H]
- FIX fork-perk-desc: Fabricate·Flak Jacket·Hollow-Points·.45 in the Chamber의 영어 설명은 fork 밸런스 변경 문구다; 리버스는 ko.json(원본 영어 기준) 설명을 쓴다 [src:balance/299, balance/316, balance/325, balance/334, l10n/ko:game-fabricate-desc] [H]

### 누락 키 처리

- 0.8.82 콘텐츠 중 ko에 없는 것: 이모트 이름 148개 전부, 조준선 이름, 치유·부스트 효과 이름, 기본 근접 무기 이름(`game-knuckles` 등 9개), `game-max-perks`, 퀘스트 다수 — 표의 "리버스 표기" 열에 제안 번역을 넣었다 [src:l10n/en:game-emote_happyface, l10n/en:game-heal_basic, l10n/en:game-knuckles, l10n/en:game-max-perks] [H]
- fork 전용 키(예: S&W 500, Barrett M107, ASh-12, IMD-2, 보호구역 퀘스트, Survevr 패스 2, Tactical Pack)는 제안 번역 앞에 `(fork)`를 붙였다; survev 기준(ADR 0003) 이후 포트가 가져온 항목(survev 전용 총 6종, 겨울 스킨 3종, PMG-134 탄, 근접 무기 5종, 코코넛·토마토, 해적의 현상금, 4레벨 가방 2종, 역할 헬멧 2종, 퍽 6종, 대장·무소속 역할)은 `(fork)` 없이 리버스 표기를 쓴다 (`apps/client/src/l10n/ko.ts`) [src:l10n/en:game-sw500, l10n/en:game-barrett, l10n/en:game-ash12, l10n/en:quest_reserve_kills, l10n/en:pass_survivr2, derived/fork-vs-original-json, user/2026-10-07-survev-guns] [H]

## 전체 용어표

### 모드·로비·지역·계정

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `index-create-account` | Create Account | 계정 생성하기 | = | [src:l10n/en:index-create-account, l10n/ko:index-create-account] [H] |
| `index-create-account-prompt-1` | Log in to access this feature! | 이 기능에 접근하려면 로그인 하세요! | = | [src:l10n/en:index-create-account-prompt-1, l10n/ko:index-create-account-prompt-1] [H] |
| `index-set-account-name` | Set your account name (원본: Set your battletag) | 계정명을 설정하세요 | = | [src:l10n/en:index-set-account-name, l10n/ko:index-set-account-name] [H] |
| `index-enter-name` | Enter name | 이름을 입력하세요 | = | [src:l10n/en:index-enter-name, l10n/ko:index-enter-name] [H] |
| `index-enter-name-here` | Enter your name here | — (누락) | 여기에 이름을 입력하세요 | [src:l10n/en:index-enter-name-here] [H] |
| `index-finish` | Finish | 완료 | = | [src:l10n/en:index-finish, l10n/ko:index-finish] [H] |
| `index-reset-stats` | Reset Stats | 스텟 초기화 (원본: 능력치 초기화) | 전적 초기화 | [src:l10n/en:index-reset-stats, l10n/ko:index-reset-stats] [H] |
| `index-reset-stats-desc` | Enter "RESET STATS" to reset your stats: | "RESET STATS"를 입력해 스텟을 초기화 하세요: (원본: "RESET STATS"를 입력해 능력치를 초기화 하세요:) | = | [src:l10n/en:index-reset-stats-desc, l10n/ko:index-reset-stats-desc] [H] |
| `index-reset-stats-desc-2` | (This does not reset pass progress.) |  (이는 패스 진행 상황을 리셋하진 않습니다.) | = | [src:l10n/en:index-reset-stats-desc-2, l10n/ko:index-reset-stats-desc-2] [H] |
| `index-delete-account` | Delete Account | 계정 삭제하기 | = | [src:l10n/en:index-delete-account, l10n/ko:index-delete-account] [H] |
| `index-delete-account-desc` | Enter "DELETE" to delete your account: | "DELETE"를 입력해 계정을 삭제하세요: | = | [src:l10n/en:index-delete-account-desc, l10n/ko:index-delete-account-desc] [H] |
| `index-confirm` | Confirm | 확인 | = | [src:l10n/en:index-confirm, l10n/ko:index-confirm] [H] |
| `index-confirm-all` | Confirm All | — (누락) | 모두 확인 | [src:l10n/en:index-confirm-all] [H] |
| `index-customize-avatar` | Customize Avatar | 아바타 커스터마이징 | = | [src:l10n/en:index-customize-avatar, l10n/ko:index-customize-avatar] [H] |
| `index-done` | Done | 완료 | = | [src:l10n/en:index-done, l10n/ko:index-done] [H] |
| `index-account` | Account | 계정 | = | [src:l10n/en:index-account, l10n/ko:index-account] [H] |
| `index-log-in-with` | Log in with | 다음으로 로그인 | = | [src:l10n/en:index-log-in-with, l10n/ko:index-log-in-with] [H] |
| `index-google` | Google | Google | = | [src:l10n/en:index-google, l10n/ko:index-google] [H] |
| `index-twitch` | Twitch | Twitch | = | [src:l10n/en:index-twitch, l10n/ko:index-twitch] [H] |
| `index-github` | Github | — (누락) | GitHub | [src:l10n/en:index-github] [H] |
| `index-mock` | Fake Auth | — (누락) | 테스트 인증 | [src:l10n/en:index-mock] [H] |
| `index-discord` | Discord | Discord | = | [src:l10n/en:index-discord, l10n/ko:index-discord] [H] |
| `index-my-stats` | My Stats | 내 상태창 (원본: 내 능력치) | 내 전적 | [src:l10n/en:index-my-stats, l10n/ko:index-my-stats] [H] |
| `index-link-account` | Link Account (원본: Link Services) | 링크 서비스 | 계정 연동 | [src:l10n/en:index-link-account, l10n/ko:index-link-account] [H] |
| `index-log-out` | Log Out | 로그아웃 | = | [src:l10n/en:index-log-out, l10n/ko:index-log-out] [H] |
| `index-change-avatar` | Change Avatar | 아바타 변경 | = | [src:l10n/en:index-change-avatar, l10n/ko:index-change-avatar] [H] |
| `index-change-account-name` | Change Account Name (원본: Change Battletag) | 계정 이름 변경 (원본: 계정명 변경) | = | [src:l10n/en:index-change-account-name, l10n/ko:index-change-account-name] [H] |
| `index-back` | Back | 돌아가기 | = | [src:l10n/en:index-back, l10n/ko:index-back] [H] |
| `index-link-account-to` | Link account to (원본: Link service to) | 링크 서비스를 | 계정 연동: | [src:l10n/en:index-link-account-to, l10n/ko:index-link-account-to] [H] |
| `index-log-in-desc` | Log In / Create Account (원본: LOG IN HERE) | 이곳에서 로그인 | = | [src:l10n/en:index-log-in-desc, l10n/ko:index-log-in-desc] [H] |
| `index-logging-in` | Logging in | 로그인 중 (원본: 로그인) | = | [src:l10n/en:index-logging-in, l10n/ko:index-logging-in] [H] |
| `index-leaderboards` | Leaderboards | 순위표 | = | [src:l10n/en:index-leaderboards, l10n/ko:index-leaderboards] [H] |
| `index-slogan` | 2d Battle Royale | 2D 배틀 로얄 | = | [src:l10n/en:index-slogan, l10n/ko:index-slogan] [H] |
| `index-region` | Region | 지역 | = | [src:l10n/en:index-region, l10n/ko:index-region] [H] |
| `index-local` | Local | — (누락) | 로컬 | [src:l10n/en:index-local] [H] |
| `index-north-america` | North America | 북미 | = | [src:l10n/en:index-north-america, l10n/ko:index-north-america] [H] |
| `index-europe` | Europe | 유럽 | = | [src:l10n/en:index-europe, l10n/ko:index-europe] [H] |
| `index-asia` | Asia | 아시아 | = | [src:l10n/en:index-asia, l10n/ko:index-asia] [H] |
| `index-russia` | Russia | 러시아 † | = | [src:l10n/en:index-russia, l10n/ko:index-russia] [H] |
| `index-south-america` | South America | 남미 | = | [src:l10n/en:index-south-america, l10n/ko:index-south-america] [H] |
| `index-korea` | South Korea | 한국 | = | [src:l10n/en:index-korea, l10n/ko:index-korea] [H] |
| `index-players` | players | 플레이어 | = | [src:l10n/en:index-players, l10n/ko:index-players] [H] |
| `index-play-solo` | Play Solo | 개인전 플레이 (원본: 솔로로 플레이) | 솔로 플레이 | [src:l10n/en:index-play-solo, l10n/ko:index-play-solo] [H] |
| `index-play-duo` | Play Duo | 2인 팀전 플레이 (원본: 듀오로 플레이) | 듀오 플레이 | [src:l10n/en:index-play-duo, l10n/ko:index-play-duo] [H] |
| `index-play-squad` | Play Squad | 분대(4명) 플레이 (원본: 스쿼드로 플레이) | 스쿼드 플레이 | [src:l10n/en:index-play-squad, l10n/ko:index-play-squad] [H] |
| `index-join-team` | Join Team | 팀에 합류 | = | [src:l10n/en:index-join-team, l10n/ko:index-join-team] [H] |
| `index-create-team` | Create Team | 팀 만들기 | = | [src:l10n/en:index-create-team, l10n/ko:index-create-team] [H] |
| `index-leave-team` | Leave Team | 팀 떠나기 | = | [src:l10n/en:index-leave-team, l10n/ko:index-leave-team] [H] |
| `index-joining-team` | Joining Team | 팀에 합류 중 | = | [src:l10n/en:index-joining-team, l10n/ko:index-joining-team] [H] |
| `index-creating-team` | Creating Team | 팀 생성 중 | = | [src:l10n/en:index-creating-team, l10n/ko:index-creating-team] [H] |
| `index-invite-link` | Invite link (원본: INVITE LINK) | 초대 링크 | = | [src:l10n/en:index-invite-link, l10n/ko:index-invite-link] [H] |
| `index-invite-code` | Invite code (원본: INVITE CODE) | 초대 코드 | = | [src:l10n/en:index-invite-code, l10n/ko:index-invite-code] [H] |
| `index-join-team-help` | Got a team link or code? Paste it here: | 팀 링크나 코드를 받으셨나요? 여기에 붙여 넣으십시오: | = | [src:l10n/en:index-join-team-help, l10n/ko:index-join-team-help] [H] |
| `index-solo` | Solo | 개인전 (원본: 솔로) | 솔로 | [src:l10n/en:index-solo, l10n/ko:index-solo] [H] |
| `index-duo` | Duo | 2인 팀전 (원본: 듀오) | 듀오 | [src:l10n/en:index-duo, l10n/ko:index-duo] [H] |
| `index-squad` | Squad | 분대(4명) (원본: 스쿼드) | 스쿼드 | [src:l10n/en:index-squad, l10n/ko:index-squad] [H] |
| `index-auto-fill` | Auto Fill | 자동 채우기 | = | [src:l10n/en:index-auto-fill, l10n/ko:index-auto-fill] [H] |
| `index-no-fill` | No Fill | 채우지 않기 | = | [src:l10n/en:index-no-fill, l10n/ko:index-no-fill] [H] |
| `index-waiting-for-leader` | Waiting for leader to start game | 방장이 게임을 시작하길 기다리는 중 (원본: 리더가 게임을 시작하길 기다리는 중) | = | [src:l10n/en:index-waiting-for-leader, l10n/ko:index-waiting-for-leader] [H] |
| `index-joining-game` | Joining game | 게임 합류 중 | = | [src:l10n/en:index-joining-game, l10n/ko:index-joining-game] [H] |
| `index-game-in-progress` | Game in progress | 게임 진행 중 | = | [src:l10n/en:index-game-in-progress, l10n/ko:index-game-in-progress] [H] |
| `index-play` | Play | 플레이 | = | [src:l10n/en:index-play, l10n/ko:index-play] [H] |
| `index-customize-loadout` | Customize Emotes | 커스터마이징 (원본: 이모티콘 커스터마이징) | = | [src:l10n/en:index-customize-loadout, l10n/ko:index-customize-loadout] [H] |
| `index-twitter-follow` | Twitter Follow | Twitter 팔로우 | = | [src:l10n/en:index-twitter-follow, l10n/ko:index-twitter-follow] [H] |
| `index-youtube-subscribe` | YouTube Subscribe | YouTube 구독 | = | [src:l10n/en:index-youtube-subscribe, l10n/ko:index-youtube-subscribe] [H] |
| `index-facebook-like` | Facebook Like | Facebook 좋아요 | = | [src:l10n/en:index-facebook-like, l10n/ko:index-facebook-like] [H] |
| `index-featured-youtuber` | Featured YouTuber | 등장하는 유튜버 | 추천 유튜버 | [src:l10n/en:index-featured-youtuber, l10n/ko:index-featured-youtuber] [H] |
| `index-streaming-live` | Streaming Live! | 라이브 스트리밍! | = | [src:l10n/en:index-streaming-live, l10n/ko:index-streaming-live] [H] |
| `index-viewer` | viewer | 뷰어 | 시청자 | [src:l10n/en:index-viewer, l10n/ko:index-viewer] [H] |
| `index-viewers` | viewers | 뷰어 | 시청자 | [src:l10n/en:index-viewers, l10n/ko:index-viewers] [H] |
| `index-settings` | Settings | 설정 | = | [src:l10n/en:index-settings, l10n/ko:index-settings] [H] |
| `index-high-resolution` | High resolution (check to increase visual quality) | 높은 해상도 (시각적 품질을 높이려면 선택하세요) (원본: 높은 해상도 (시각적 품질을 높이려면 확인하세요)) | = | [src:l10n/en:index-high-resolution, l10n/ko:index-high-resolution] [H] |
| `index-client-side-interp` | Client side interpolation | — (누락) | 클라이언트 보간 | [src:l10n/en:index-client-side-interp] [H] |
| `index-client-side-rotation` | Client side player rotation | — (누락) | 클라이언트 측 플레이어 회전 | [src:l10n/en:index-client-side-rotation] [H] |
| `index-screen-shake` | Screen shake | 화면 흔들기 | = | [src:l10n/en:index-screen-shake, l10n/ko:index-screen-shake] [H] |
| `index-anon-player-names` | Anonymize player names | 플레이어 이름 익명화 | = | [src:l10n/en:index-anon-player-names, l10n/ko:index-anon-player-names] [H] |
| `index-master-volume` | Master Volume | 마스터 볼륨 | = | [src:l10n/en:index-master-volume, l10n/ko:index-master-volume] [H] |
| `index-sfx-volume` | SFX Volume | SFX 볼륨 | = | [src:l10n/en:index-sfx-volume, l10n/ko:index-sfx-volume] [H] |
| `index-music-volume` | Music Volume | 음악 볼륨 | = | [src:l10n/en:index-music-volume, l10n/ko:index-music-volume] [H] |
| `index-mobile-announce` | Now available on mobile! | 이제 모바일로 즐길 수 있습니다! | = | [src:l10n/en:index-mobile-announce, l10n/ko:index-mobile-announce] [H] |
| `index-mobile-tooltip` | Visit <span>survev.io</span> on your mobile device to play on the go! (원본: Visit <span>surviv.io</span> on your mobile device to play …) | 계속해서 플레이 하려면 모바일 장치로 <span>survev.io</span>를 방문하세요! (원본: 계속해서 플레이 하려면 모바일 장치로 <span>surviv.io</span>를 방문하세요!) | 모바일 기기에서 <span>(리버스 도메인)</span>에 접속해 어디서나 플레이하세요! | [src:l10n/en:index-mobile-tooltip, l10n/ko:index-mobile-tooltip] [H] |
| `index-version` | ver | 버전 | = | [src:l10n/en:index-version, l10n/ko:index-version] [H] |
| `index-original-changelog` | Original changelog | — (누락) | 원본 변경 내역 | [src:l10n/en:index-original-changelog] [H] |
| `index-privacy` | privacy (원본: Privacy) | 프라이버시 | = | [src:l10n/en:index-privacy, l10n/ko:index-privacy] [H] |
| `index-rotate-reminder` | Rotate to landscape for a better experience. | — (누락) | 가로 모드로 돌리면 더 쾌적합니다. | [src:l10n/en:index-rotate-reminder] [H] |
| `index-attributions` | attributions (원본: Attributions) | 속성 | 저작권 표시 | [src:l10n/en:index-attributions, l10n/ko:index-attributions] [H] |
| `index-team-is-full` | Team is full! | 팀이 꽉 찼습니다! | = | [src:l10n/en:index-team-is-full, l10n/ko:index-team-is-full] [H] |
| `index-team-kicked` | You were kicked from the team! | 팀으로부터 쫓겨났습니다! | = | [src:l10n/en:index-team-kicked, l10n/ko:index-team-kicked] [H] |
| `index-behind-proxy` | Proxies and VPNs are not allowed, please disable them. | — (누락) | 프록시와 VPN은 허용되지 않습니다. 해제해 주세요. | [src:l10n/en:index-behind-proxy] [H] |
| `index-failed-creating-team` | Failed creating team. | 팀 생성에 실패했습니다. | = | [src:l10n/en:index-failed-creating-team, l10n/ko:index-failed-creating-team] [H] |
| `index-failed-finding-game` | Failed finding game. | 게임을 찾는데 실패했습니다. | = | [src:l10n/en:index-failed-finding-game, l10n/ko:index-failed-finding-game] [H] |
| `index-failed-joining-game` | Failed joining game. | 게임에 입장하는데 실패했습니다. | = | [src:l10n/en:index-failed-joining-game, l10n/ko:index-failed-joining-game] [H] |
| `index-failed-joining-team` | Failed joining team. | 팀 합류에 실패했습니다. | = | [src:l10n/en:index-failed-joining-team, l10n/ko:index-failed-joining-team] [H] |
| `index-host-closed` | Host closed the connection. | 방장이 연결을 끊었습니다. (원본: 호스트가 연결을 끊었습니다.) | = | [src:l10n/en:index-host-closed, l10n/ko:index-host-closed] [H] |
| `index-invalid-captcha` | Failed verifying captcha. | — (누락) | 캡차 인증에 실패했습니다. | [src:l10n/en:index-invalid-captcha] [H] |
| `index-invalid-packet` | Received an invalid packet. | — (누락) | 잘못된 패킷을 받았습니다. | [src:l10n/en:index-invalid-packet] [H] |
| `index-invalid-protocol` | Old client version. | 오래된 클라이언트 버전입니다. | = | [src:l10n/en:index-invalid-protocol, l10n/ko:index-invalid-protocol] [H] |
| `index-invalid-token` | Invalid token. | — (누락) | 유효하지 않은 토큰입니다. | [src:l10n/en:index-invalid-token] [H] |
| `index-ip-banned` | Your IP has been banned. | — (누락) | IP가 차단되었습니다. | [src:l10n/en:index-ip-banned] [H] |
| `index-lost-connection` | Lost connection to team. | 팀과의 연결이 끊겼습니다. | = | [src:l10n/en:index-lost-connection, l10n/ko:index-lost-connection] [H] |
| `index-player-not-found` | Player not found. | — (누락) | 플레이어를 찾을 수 없습니다. | [src:l10n/en:index-player-not-found] [H] |
| `index-rate-limited` | Rate limited. | — (누락) | 요청이 너무 많습니다. | [src:l10n/en:index-rate-limited] [H] |
| `index-server-crashed` | Server crashed. | — (누락) | 서버 오류가 발생했습니다. | [src:l10n/en:index-server-crashed] [H] |
| `index-server-restart` | Server restarting. | — (누락) | 서버를 재시작하는 중입니다. | [src:l10n/en:index-server-restart] [H] |
| `index-view-more` | View More | 더 보기 | = | [src:l10n/en:index-view-more, l10n/ko:index-view-more] [H] |
| `index-back-to-main` | Back to Main Menu | 메인 메뉴로 돌아가기 | = | [src:l10n/en:index-back-to-main, l10n/ko:index-back-to-main] [H] |
| `index-most-kills` | Most kills | 최대 킬수 (원본: 최대 사살수) | = | [src:l10n/en:index-most-kills, l10n/ko:index-most-kills] [H] |
| `index-total-kills` | Total kills | 총 킬수 (원본: 총 사살수) | = | [src:l10n/en:index-total-kills, l10n/ko:index-total-kills] [H] |
| `index-total-wins` | Total wins | 총 승리수 | = | [src:l10n/en:index-total-wins, l10n/ko:index-total-wins] [H] |
| `index-top-5-percent` | Top 5 percent | 상위 5% | = | [src:l10n/en:index-top-5-percent, l10n/ko:index-top-5-percent] [H] |
| `index-kill-death-ratio` | Kill-death ratio | 킬-데스 비율 | = | [src:l10n/en:index-kill-death-ratio, l10n/ko:index-kill-death-ratio] [H] |
| `index-mode` | Mode | 모드 | = | [src:l10n/en:index-mode, l10n/ko:index-mode] [H] |
| `index-for` | For | 기간 | = | [src:l10n/en:index-for, l10n/ko:index-for] [H] |
| `index-today` | Today | 오늘 | = | [src:l10n/en:index-today, l10n/ko:index-today] [H] |
| `index-this-week` | This week | 이번 주 | = | [src:l10n/en:index-this-week, l10n/ko:index-this-week] [H] |
| `index-all-time` | All time | 전체 | = | [src:l10n/en:index-all-time, l10n/ko:index-all-time] [H] |
| `index-top-100` | TOP 100 | TOP 100 | = | [src:l10n/en:index-top-100, l10n/ko:index-top-100] [H] |
| `index-rank` | Rank | 랭크 | = | [src:l10n/en:index-rank, l10n/ko:index-rank] [H] |
| `index-player` | Player | 플레이어 | = | [src:l10n/en:index-player, l10n/ko:index-player] [H] |
| `index-total-games` | Total Games | 총 게임수 | = | [src:l10n/en:index-total-games, l10n/ko:index-total-games] [H] |
| `index-loadout` | Loadout | 장비 | 로드아웃 | [src:l10n/en:index-loadout, l10n/ko:index-loadout] [H] |
| `index-play-50v50` | Play 50v50 | 50v50 플레이 | = | [src:l10n/en:index-play-50v50, l10n/ko:index-play-50v50] [H] |
| `index-50v50` | 50v50 | 50v50 | = | [src:l10n/en:index-50v50, l10n/ko:index-50v50] [H] |
| `word-order` | svo | SOV | = | [src:l10n/en:word-order, l10n/ko:word-order] [H] |

### 조작법·도움말 (index-*)

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `index-controls` | Controls | 조작 | = | [src:l10n/en:index-controls, l10n/ko:index-controls] [H] |
| `index-movement` | Movement | 이동 | = | [src:l10n/en:index-movement, l10n/ko:index-movement] [H] |
| `index-movement-ctrl` | W, A, S, D | W, A, S, D | = | [src:l10n/en:index-movement-ctrl, l10n/ko:index-movement-ctrl] [H] |
| `index-aim` | Aim | 조준 | = | [src:l10n/en:index-aim, l10n/ko:index-aim] [H] |
| `index-aim-ctrl` | Mouse | 마우스 | = | [src:l10n/en:index-aim-ctrl, l10n/ko:index-aim-ctrl] [H] |
| `index-punch` | Melee | 근접 공격 | = | [src:l10n/en:index-punch, l10n/ko:index-punch] [H] |
| `index-shoot` | Shoot | 발사 | = | [src:l10n/en:index-shoot, l10n/ko:index-shoot] [H] |
| `index-shoot-ctrl` | Left-Click | 왼쪽 클릭 | = | [src:l10n/en:index-shoot-ctrl, l10n/ko:index-shoot-ctrl] [H] |
| `index-change-weapons` | Change Weapons | 무기 변경 | = | [src:l10n/en:index-change-weapons, l10n/ko:index-change-weapons] [H] |
| `index-change-weapons-ctrl` | 1 through 4 or Scroll Wheel | 1부터 4까지, 또는 스크롤 휠 | = | [src:l10n/en:index-change-weapons-ctrl, l10n/ko:index-change-weapons-ctrl] [H] |
| `index-stow-weapons` | Stow Weapons (Melee Mode) | 무기 집어넣기 (근접 공격) (원본: 무기 집어넣기 (근접 전투 모드)) | = | [src:l10n/en:index-stow-weapons, l10n/ko:index-stow-weapons] [H] |
| `index-stow-weapons-ctrl` | 3 or E | 3 또는 E | = | [src:l10n/en:index-stow-weapons-ctrl, l10n/ko:index-stow-weapons-ctrl] [H] |
| `index-swap-weapons` | Swap to Previous Weapon | 이전 무기로 변경 | = | [src:l10n/en:index-swap-weapons, l10n/ko:index-swap-weapons] [H] |
| `index-swap-weapons-ctrl` | Q | Q | = | [src:l10n/en:index-swap-weapons-ctrl, l10n/ko:index-swap-weapons-ctrl] [H] |
| `index-swap-weapon-slots` | Switch Gun Slots | 총기 슬롯 교환 | = | [src:l10n/en:index-swap-weapon-slots, l10n/ko:index-swap-weapon-slots] [H] |
| `index-swap-weapon-slots-ctrl` | T or drag gun to other slot | T 또는 다른 슬롯으로 총기 드래그하기 | = | [src:l10n/en:index-swap-weapon-slots-ctrl, l10n/ko:index-swap-weapon-slots-ctrl] [H] |
| `index-reload` | Reload | 재장전 | = | [src:l10n/en:index-reload, l10n/ko:index-reload] [H] |
| `index-reload-ctrl` | R | R | = | [src:l10n/en:index-reload-ctrl, l10n/ko:index-reload-ctrl] [H] |
| `index-scope-zoom` | Scope Zoom | 스코프 줌 | = | [src:l10n/en:index-scope-zoom, l10n/ko:index-scope-zoom] [H] |
| `index-scope-zoom-ctrl` | Left-Click on Zoom | 확대 시 왼쪽 클릭 | = | [src:l10n/en:index-scope-zoom-ctrl, l10n/ko:index-scope-zoom-ctrl] [H] |
| `index-pickup` | Pickup | 줍기 | = | [src:l10n/en:index-pickup, l10n/ko:index-pickup] [H] |
| `index-loot` | Loot | 아이템 줍기 (원본: 루팅하기) | = | [src:l10n/en:index-loot, l10n/ko:index-loot] [H] |
| `index-revive` | Revive | 부활 | 소생 | [src:l10n/en:index-revive, l10n/ko:index-revive] [H] |
| `index-pickup-ctrl` | F | F | = | [src:l10n/en:index-pickup-ctrl, l10n/ko:index-pickup-ctrl] [H] |
| `index-use-medical` | Use Medical Item | 의료 아이템 사용 | = | [src:l10n/en:index-use-medical, l10n/ko:index-use-medical] [H] |
| `index-use-medical-ctrl` | Left-Click on Item or 7 through 0 | 아이템에 왼쪽 클릭 또는 7에서 0까지 누르기 | = | [src:l10n/en:index-use-medical-ctrl, l10n/ko:index-use-medical-ctrl] [H] |
| `index-drop-item` | Drop Item | 아이템 떨구기 | = | [src:l10n/en:index-drop-item, l10n/ko:index-drop-item] [H] |
| `index-drop-item-ctrl` | Right-Click on Item | 아이템에 오른쪽 클릭 | = | [src:l10n/en:index-drop-item-ctrl, l10n/ko:index-drop-item-ctrl] [H] |
| `index-cancel-action` | Cancel Action | 행동 취소 | = | [src:l10n/en:index-cancel-action, l10n/ko:index-cancel-action] [H] |
| `index-cancel-action-ctrl` | X | X | = | [src:l10n/en:index-cancel-action-ctrl, l10n/ko:index-cancel-action-ctrl] [H] |
| `index-view-map` | View Map | 지도 보기 | = | [src:l10n/en:index-view-map, l10n/ko:index-view-map] [H] |
| `index-view-map-ctrl` | M or G | M 또는 G | = | [src:l10n/en:index-view-map-ctrl, l10n/ko:index-view-map-ctrl] [H] |
| `index-toggle-minimap` | Toggle Minimap | 미니맵 토글 | = | [src:l10n/en:index-toggle-minimap, l10n/ko:index-toggle-minimap] [H] |
| `index-toggle-minimap-ctrl` | V | V | = | [src:l10n/en:index-toggle-minimap-ctrl, l10n/ko:index-toggle-minimap-ctrl] [H] |
| `index-use-ping` | Use Team Ping Wheel | 팀 핑 사용하기 (원본: 팀 핑 휠 사용하기) | = | [src:l10n/en:index-use-ping, l10n/ko:index-use-ping] [H] |
| `index-use-ping-ctrl` | Hold C, then hold Right-Click and drag mouse, then release Right-Click | C키와 마우스 오른쪽 버튼을 누른 채 마우스를 드래그한 후 오른쪽 버튼을 누르세요 | = | [src:l10n/en:index-use-ping-ctrl, l10n/ko:index-use-ping-ctrl] [H] |
| `index-use-emote` | Use Emote Wheel | 이모티콘 사용하기 (원본: 이모티콘 휠 사용하기) | = | [src:l10n/en:index-use-emote, l10n/ko:index-use-emote] [H] |
| `index-use-emote-ctrl` | Hold Right-Click and drag mouse, then release Right-Click | 마우스 오른쪽 버튼을 누른 채 마우스를 드래그한 후 오른쪽 버튼을 놓으세요 | = | [src:l10n/en:index-use-emote-ctrl, l10n/ko:index-use-emote-ctrl] [H] |
| `index-how-to-play` | How to Play | 플레이 방법 | = | [src:l10n/en:index-how-to-play, l10n/ko:index-how-to-play] [H] |
| `index-tips-1-desc` | The goal of survev.io is to be the last player standing. You only live once per game - th… (원본: The goal of surviv.io is to be the last player standing. Yo…) | Surviv.io에서의 목표는 최후까지 살아남는 플레이어가 되는 겁니다. 게임 당 목숨은 하나 뿐입니다 - 다시 살아나는 건 없어요! (원본: Surviv.io에서의 목표는 최후까지 살아남는 플레이어가 되는 겁니다. 게임 당 목숨은 하나 뿐이니다 -…) | = | [src:l10n/en:index-tips-1-desc, l10n/ko:index-tips-1-desc] [H] |
| `index-tips-2` | 2D PUBG | 2D PUBG | = | [src:l10n/en:index-tips-2, l10n/ko:index-tips-2] [H] |
| `index-tips-2-desc` | If you've played other battle royale games like PUBG, Fortnite or Apex Legends, then you'… (원본: If you've played other battle royale games like PUBG, Fortn…) | PUBG, Fortnite, Apex Legends 같은 배틀 로얄 게임을 해 보셨다면 이미 반은 온 겁니다! Surviv.io를 2D PUGB(약간의 차이점과… (원본: PUBG, Fortnite, Apex Legends 같은 배틀 로얄 게임을 해 보셨다면 이미 반은 온 겁니…) | = | [src:l10n/en:index-tips-2-desc, l10n/ko:index-tips-2-desc] [H] |
| `index-tips-3` | Loot and Kill | 약탈과 살인 | 파밍하고 처치하라 | [src:l10n/en:index-tips-3, l10n/ko:index-tips-3] [H] |
| `index-tips-3-desc` | You'll begin the game with no items other than a simple backpack. Move around the map to … | 게임을 시작할 땐 간단한 백팩만 주어집니다. 약탈할 것이 있는지 지도를 돌아 다녀보세요: 무기, 탄약, 스코프 및 의료 아이템 / 다른 플레이어를 제거하면 그들… (원본: 게임을 시작할 땐 간단한 백팩만 주어집니다. 약탈할 것이 있는지 지도를 돌아 다녀보세요: 무기, 탄약, 스…) | = | [src:l10n/en:index-tips-3-desc, l10n/ko:index-tips-3-desc] [H] |
| `index-tips-4` | Red = Bad! | 붉은 색 = 나쁜 것입니다! | = | [src:l10n/en:index-tips-4, l10n/ko:index-tips-4] [H] |
| `index-tips-4-desc` | Players aren't the only thing that can hurt you. The deadly red zone will move in from th… | 플레이어만이 여러분을 죽일 수 있는 건 아닙니다. 치명적인 레드존이 지도의 바깥부터 들어오며, 레드 안에 있는 경우 더 큰 피해를 입게 됩니다. 지도에 눈을 떼… (원본: 플레이어만이 여러분을 상처입힐 수 있는 건 아닙니다. 치명적인 레드존이 지도의 측면으로부터 전개되며 그 안…) | = | [src:l10n/en:index-tips-4-desc, l10n/ko:index-tips-4-desc] [H] |
| `index-movement-ctrl-touch` | Left stick | 왼쪽 조이스틱 (원본: 왼쪽 스틱) | = | [src:l10n/en:index-movement-ctrl-touch, l10n/ko:index-movement-ctrl-touch] [H] |
| `index-aim-ctrl-touch` | Right stick | 오른쪽 조이스틱 (원본: 오른쪽 스틱) | = | [src:l10n/en:index-aim-ctrl-touch, l10n/ko:index-aim-ctrl-touch] [H] |
| `index-shoot-ctrl-touch` | Drag right stick outside stick border | 오른쪽 조이스틱을 스틱 경계 밖으로 드래그합니다 (원본: 오른쪽 스틱을 스틱 경계 밖으로 드래그합니다) | = | [src:l10n/en:index-shoot-ctrl-touch, l10n/ko:index-shoot-ctrl-touch] [H] |
| `index-change-weapons-ctrl-touch` | Tap weapon slot | 무기 슬롯을 탭 합니다 | = | [src:l10n/en:index-change-weapons-ctrl-touch, l10n/ko:index-change-weapons-ctrl-touch] [H] |
| `index-reload-ctrl-touch` | Tap equipped ammo counter | 장비한 탄환의 카운터를 탭 합니다 | = | [src:l10n/en:index-reload-ctrl-touch, l10n/ko:index-reload-ctrl-touch] [H] |
| `index-scope-zoom-ctrl-touch` | Tap zoom item | 줌 아이템을 탭 합니다 | = | [src:l10n/en:index-scope-zoom-ctrl-touch, l10n/ko:index-scope-zoom-ctrl-touch] [H] |
| `index-pickup-ctrl-touch` | Tap interaction button or loot name | 상호 작용 버튼 또는 전리품 이름을 탭 합니다 | = | [src:l10n/en:index-pickup-ctrl-touch, l10n/ko:index-pickup-ctrl-touch] [H] |
| `index-use-medical-ctrl-touch` | Tap medical item | 의료 아이템을 탭 합니다 | = | [src:l10n/en:index-use-medical-ctrl-touch, l10n/ko:index-use-medical-ctrl-touch] [H] |
| `index-drop-item-ctrl-touch` | Touch and hold item | 아이템을 터치 한 후 꾹 누르십시오 (원본: 아이템을 터치 한 후 누르십시오) | = | [src:l10n/en:index-drop-item-ctrl-touch, l10n/ko:index-drop-item-ctrl-touch] [H] |
| `index-cancel-action-ctrl-touch` | Tap interaction button | 상호 작용 버튼을 탭 합니다 | = | [src:l10n/en:index-cancel-action-ctrl-touch, l10n/ko:index-cancel-action-ctrl-touch] [H] |
| `index-view-map-ctrl-touch` | Tap minimap | 미니맵을 탭 합니다 | = | [src:l10n/en:index-view-map-ctrl-touch, l10n/ko:index-view-map-ctrl-touch] [H] |
| `index-use-ping-ctrl-touch` | View map and tap anywhere on map | 지도를 보고 아무데나 탭 합니다 | = | [src:l10n/en:index-use-ping-ctrl-touch, l10n/ko:index-use-ping-ctrl-touch] [H] |
| `index-use-emote-ctrl-touch` | Tap surviv icon | Surviv 아이콘을 탭 합니다 | = | [src:l10n/en:index-use-emote-ctrl-touch, l10n/ko:index-use-emote-ctrl-touch] [H] |

### 게임 HUD·킬피드·결과 화면

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `alive` | Alive | 생존자 (원본: 생존) | = | [src:l10n/en:game-alive, l10n/ko:game-alive] [H] |
| `reloading` | Reloading | 재장전 | = | [src:l10n/en:game-reloading, l10n/ko:game-reloading] [H] |
| `use` | Use | 사용 | = | [src:l10n/en:game-use, l10n/ko:game-use] [H] |
| `using` | Using | 사용 중 | = | [src:l10n/en:game-using, l10n/ko:game-using] [H] |
| `reviving` | Reviving | 소생 중 (원본: 부활 중) | = | [src:l10n/en:game-reviving, l10n/ko:game-reviving] [H] |
| `revive-teammate` | Revive Teammate | 팀원 소생 (원본: 팀 메이트 부활) | = | [src:l10n/en:game-revive-teammate, l10n/ko:game-revive-teammate] [H] |
| `revive-self` | Revive Self | 본인 소생 (원본: 본인 부활) | = | [src:l10n/en:game-revive-self, l10n/ko:game-revive-self] [H] |
| `equip` | Equip | 장착 (원본: 장비) | = | [src:l10n/en:game-equip, l10n/ko:game-equip] [H] |
| `cancel` | Cancel | 취소 | = | [src:l10n/en:game-cancel, l10n/ko:game-cancel] [H] |
| `open-door` | Open Door | 문 열기 | = | [src:l10n/en:game-open-door, l10n/ko:game-open-door] [H] |
| `close-door` | Close Door | 문 닫기 | = | [src:l10n/en:game-close-door, l10n/ko:game-close-door] [H] |
| `unlock` | Unlock | 잠금 해제 | = | [src:l10n/en:game-unlock, l10n/ko:game-unlock] [H] |
| `You` | You | 당신 | = | [src:l10n/en:game-You, l10n/ko:game-You] [H] |
| `you` | you | 당신 | = | [src:l10n/en:game-you, l10n/ko:game-you] [H] |
| `themselves` | themselves | 자신 (원본: 그들) | = | [src:l10n/en:game-themselves, l10n/ko:game-themselves] [H] |
| `yourself` | yourself | 자신 | = | [src:l10n/en:game-yourself, l10n/ko:game-yourself] [H] |
| `you-died` | died | 사망했습니다 (원본: 죽음) | = | [src:l10n/en:game-you-died, l10n/ko:game-you-died] [H] |
| `player-died` | died | 사망 (원본: 죽음) | = | [src:l10n/en:game-player-died, l10n/ko:game-player-died] [H] |
| `with` | with | 을(를). 사용무기:  (원본: 과(와) 함께) | = | [src:l10n/en:game-with, l10n/ko:game-with] [H] |
| `knocked-out` | knocked out | 이(가) 기절시켰습니다 (원본: 넉아웃) | = | [src:l10n/en:game-knocked-out, l10n/ko:game-knocked-out] [H] |
| `killed` | killed | 이(가) 사살했습니다 (원본: 사살) | = | [src:l10n/en:game-killed, l10n/ko:game-killed] [H] |
| `finally-killed` | finally killed | 이(가) 마침내 사살했습니다 (원본: 마침내 사살) | = | [src:l10n/en:game-finally-killed, l10n/ko:game-finally-killed] [H] |
| `finally-bled-out` | finally bled out | 이(가) 마침내 출혈로 사망했습니다 (원본: 마침내 출혈) | = | [src:l10n/en:game-finally-bled-out, l10n/ko:game-finally-bled-out] [H] |
| `died-outside` | died outside the safe zone | 이(가) 세이프 존 밖에서 사망했습니다 (원본: 세이프 존 밖에서 사망) | = | [src:l10n/en:game-died-outside, l10n/ko:game-died-outside] [H] |
| `the-red-zone` | The red zone | 레드존이 (원본: 레드존) | = | [src:l10n/en:game-the-red-zone, l10n/ko:game-the-red-zone] [H] |
| `crushed` | crushed | 깔렸습니다. (원본: 으스러진) | = | [src:l10n/en:game-crushed, l10n/ko:game-crushed] [H] |
| `the-air-drop` | The air drop | 공중 보급 (원본: 공중 투하) | = | [src:l10n/en:game-the-air-drop, l10n/ko:game-the-air-drop] [H] |
| `the-air-strike` | The air strike | 공습 (원본: 공중 강습) | = | [src:l10n/en:game-the-air-strike, l10n/ko:game-the-air-strike] [H] |
| `an-air-strike` | an air strike | 공습 (원본: 공중 강습) | = | [src:l10n/en:game-an-air-strike, l10n/ko:game-an-air-strike] [H] |
| `waiting-for-players` | Waiting for players | 플레이어 대기 중 | = | [src:l10n/en:game-waiting-for-players, l10n/ko:game-waiting-for-players] [H] |
| `spectating` | Spectating | 관전 중 | = | [src:l10n/en:game-spectating, l10n/ko:game-spectating] [H] |
| `red-zone-advances` | Red zone advances in | 레드존 전진 | = | [src:l10n/en:game-red-zone-advances, l10n/ko:game-red-zone-advances] [H] |
| `red-zone-advancing` | Red zone advancing! Move to the safe zone | 레드존 접근 중! 세이프 존으로 이동하세요! (원본: 레드존 접근 중! 세이프 존으로 이동) | = | [src:l10n/en:game-red-zone-advancing, l10n/ko:game-red-zone-advancing] [H] |
| `seconds` | seconds | 초 | = | [src:l10n/en:game-seconds, l10n/ko:game-seconds] [H] |
| `minutes` | minutes | 분 | = | [src:l10n/en:game-minutes, l10n/ko:game-minutes] [H] |
| `minute` | minute | 분 | = | [src:l10n/en:game-minute, l10n/ko:game-minute] [H] |
| `m` | m | 분 | = | [src:l10n/en:game-m, l10n/ko:game-m] [H] |
| `s` | s | 초 | = | [src:l10n/en:game-s, l10n/ko:game-s] [H] |
| `not-enough-space` | Not enough space! | 충분한 공간이 없습니다! | = | [src:l10n/en:game-not-enough-space, l10n/ko:game-not-enough-space] [H] |
| `item-already-owned` | Item already owned! | 아이템을 이미 보유하고 있습니다! | = | [src:l10n/en:game-item-already-owned, l10n/ko:game-item-already-owned] [H] |
| `item-already-equipped` | Item already equipped! | 아이템을 이미 장착하고 있습니다! (원본: 아이템을 이미 장비하고 있습니다!) | = | [src:l10n/en:game-item-already-equipped, l10n/ko:game-item-already-equipped] [H] |
| `better-item-equipped` | Better item equipped! | 더 나은 아이템을 장착하고 있습니다! (원본: 더 나은 아이템을 장비하고 있습니다!) | = | [src:l10n/en:game-better-item-equipped, l10n/ko:game-better-item-equipped] [H] |
| `gun-cannot-fire` | Gun cannot be fired here! | 이곳에서 발사할 수 없습니다! (원본: 여기서 총을 발사할 수 없습니다!) | = | [src:l10n/en:game-gun-cannot-fire, l10n/ko:game-gun-cannot-fire] [H] |
| `max-perks` | Maximum perks equipped! | — (누락) | 더 이상 특전을 장착할 수 없습니다! | [src:l10n/en:game-max-perks] [H] |
| `waiting-for-new-leader` | Waiting for new leader | 새로운 킬 리더 대기 중 (원본: 새로운 리더 대기 중) | 새 지휘관 대기 중 | [src:l10n/en:game-waiting-for-new-leader, l10n/ko:game-waiting-for-new-leader] [H] |
| `waiting-for-hunted` | Searching for the Hunted | 새로운 수배자 대기 중 (원본: 사냥 대상을 찾는 중) | = | [src:l10n/en:game-waiting-for-hunted, l10n/ko:game-waiting-for-hunted] [H] |
| `play-new-game` | Play New Game | 새 게임 플레이 | = | [src:l10n/en:game-play-new-game, l10n/ko:game-play-new-game] [H] |
| `spectate` | Spectate | 관전 | = | [src:l10n/en:game-spectate, l10n/ko:game-spectate] [H] |
| `full-screen` | Full Screen | 전체화면 (원본: 풀스크린) | = | [src:l10n/en:game-full-screen, l10n/ko:game-full-screen] [H] |
| `aim-line` | Aim Line | 조준선 | 조준 보조선 | [src:l10n/en:game-aim-line, l10n/ko:game-aim-line] [H] |
| `sound` | Sound | 소리 (원본: 사운드) | = | [src:l10n/en:game-sound, l10n/ko:game-sound] [H] |
| `quit-game` | Quit Game | 게임에서 나가기 | = | [src:l10n/en:game-quit-game, l10n/ko:game-quit-game] [H] |
| `return-to-game` | Return to Game | 게임으로 돌아가기 | = | [src:l10n/en:game-return-to-game, l10n/ko:game-return-to-game] [H] |
| `hide-match-stats` | Hide Match Stats | 매치 현황 숨기기 | = | [src:l10n/en:game-hide-match-stats, l10n/ko:game-hide-match-stats] [H] |
| `view-match-stats` | View Match Stats | 매치 현황 보기 | = | [src:l10n/en:game-view-match-stats, l10n/ko:game-view-match-stats] [H] |
| `previous-teammate` | Previous Teammate | 이전 팀원 (원본: 이전 팀 메이트) | = | [src:l10n/en:game-previous-teammate, l10n/ko:game-previous-teammate] [H] |
| `next-teammate` | Next Teammate | 다음 팀원 (원본: 다음 팀 메이트) | = | [src:l10n/en:game-next-teammate, l10n/ko:game-next-teammate] [H] |
| `spectate-previous` | Previous Player | 이전 플레이어 | = | [src:l10n/en:game-spectate-previous, l10n/ko:game-spectate-previous] [H] |
| `spectate-next` | Next Player | 다음 플레이어 | = | [src:l10n/en:game-spectate-next, l10n/ko:game-spectate-next] [H] |
| `leave-game` | Leave Game | 게임 떠나기 | = | [src:l10n/en:game-leave-game, l10n/ko:game-leave-game] [H] |
| `your-results` | Your Results | 결과 | = | [src:l10n/en:game-your-results, l10n/ko:game-your-results] [H] |
| `chicken` | Winner winner chicken dinner! | 위너위너 치킨 디너! | = | [src:l10n/en:game-chicken, l10n/ko:game-chicken] [H] |
| `turkey` | Winner winner turkey dinner! | 위너위너 터키 디너! | = | [src:l10n/en:game-turkey, l10n/ko:game-turkey] [H] |
| `won-the-game` | won the game. | 이(가) 게임에서 승리했습니다. (원본: 게임에서 승리했습니다.) | = | [src:l10n/en:game-won-the-game, l10n/ko:game-won-the-game] [H] |
| `team-eliminated` | Your team was eliminated. | 당신 팀이 전멸했습니다. (원본: 팀이 전멸했습니다.) | = | [src:l10n/en:game-team-eliminated, l10n/ko:game-team-eliminated] [H] |
| `solo-rank` | Solo Rank | 개인전 등수 (원본: 솔로 랭크) | = | [src:l10n/en:game-solo-rank, l10n/ko:game-solo-rank] [H] |
| `duo-rank` | Duo Rank | 2인 팀전 등수 (원본: 듀오 랭크) | = | [src:l10n/en:game-duo-rank, l10n/ko:game-duo-rank] [H] |
| `squad-rank` | Squad Rank | 분대(4인) 등수 (원본: 스쿼드 랭크) | = | [src:l10n/en:game-squad-rank, l10n/ko:game-squad-rank] [H] |
| `rank` | Rank | 등수 (원본: 랭크) | = | [src:l10n/en:game-rank, l10n/ko:game-rank] [H] |
| `team-rank` | Team Rank | 팀 등수 (원본: 팀 랭크) | = | [src:l10n/en:game-team-rank, l10n/ko:game-team-rank] [H] |
| `team-kills` | Team Kills | 팀 킬수 | = | [src:l10n/en:game-team-kills, l10n/ko:game-team-kills] [H] |
| `kill` | Kill | 킬 | = | [src:l10n/en:game-kill, l10n/ko:game-kill] [H] |
| `kills` | Kills | 킬 | = | [src:l10n/en:game-kills, l10n/ko:game-kills] [H] |
| `damage-dealt` | Damage Dealt | 입힌 대미지 | = | [src:l10n/en:game-damage-dealt, l10n/ko:game-damage-dealt] [H] |
| `damage-taken` | Damage Taken | 받은 대미지 | = | [src:l10n/en:game-damage-taken, l10n/ko:game-damage-taken] [H] |
| `survived` | Survived | 생존 시간 (원본: 생존함) | = | [src:l10n/en:game-survived, l10n/ko:game-survived] [H] |

### 의료품·탄약

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `bandage` | Bandage / 툴팁: Left-click to restore 15 health. | 붕대 (원본: 반창고) / 왼쪽 클릭해서 체력을 15 회복하십시오. (원본: 왼쪽 클릭으로 체력을 15 회복하십시오.) | = | [src:l10n/en:game-bandage, l10n/ko:game-bandage, l10n/en:game-bandage-tooltip, l10n/ko:game-bandage-tooltip] [H] |
| `healing-tooltip` | Cannot heal past 75 health. | 체력이 75를 넘어 치료할 수 없습니다. (원본: 체력치 75를 넘어 치료할 수 없습니다.) | (미사용: 0.7.1부터 붕대는 100까지 회복) | [src:l10n/en:game-healing-tooltip, l10n/ko:game-healing-tooltip] [H] |
| `healthkit` | Med Kit / 툴팁: Left-click to restore 100 health. | 구급상자 (원본: 메디킷) / 왼쪽 클릭해서 체력을 100 회복하십시오. (원본: 왼쪽 클릭으로 체력을 100 회복하십시오.) | = | [src:l10n/en:game-healthkit, l10n/ko:game-healthkit, l10n/en:game-healthkit-tooltip, l10n/ko:game-healthkit-tooltip] [H] |
| `soda` | Soda / 툴팁: Left-click to boost adrenaline by 25. | 소다 / 왼쪽 클릭해서 25만큼 아드레날린을 부스트하세요. (원본: 왼쪽 클릭으로 25만큼 아드레날린을 부스트하세요.) | = | [src:l10n/en:game-soda, l10n/ko:game-soda, l10n/en:game-soda-tooltip, l10n/ko:game-soda-tooltip] [H] |
| `adrenaline-tooltip` | Adrenaline restores health over time. | 시간이 지나면서 아드레날린이 체력을 회복시킵니다. | = | [src:l10n/en:game-adrenaline-tooltip, l10n/ko:game-adrenaline-tooltip] [H] |
| `painkiller` | Pills / 툴팁: Left-click to boost adrenaline by 50. | 알약 / 왼쪽 클릭해서 50만큼 아드레날린을 부스트하세요. (원본: 왼쪽 클릭으로 50만큼 아드레날린을 부스트하세요.) | = | [src:l10n/en:game-painkiller, l10n/ko:game-painkiller, l10n/en:game-painkiller-tooltip, l10n/ko:game-painkiller-tooltip] [H] |
| `9mm` | 9mm / 툴팁: Ammo for M9, MP5, G18C, MAC-10, M93R, UMP9, Vector, P30L, VSS and CZ-… (원본: Ammo for M9, G18C, M93R, P30L, MP5, MAC-10, UMP9, CZ-3A1 and Vector.) | 9mm / M9, MP5, G18C, MAC-10, M93R, UMP9, Vector, P30L, VSS, CZ-3A1의 탄약입니다. (원본: M9, G18C, M93R, P30L, MP5, MAC-10, UMP9, CZ-3A1, Vector의 탄약…) | = | [src:l10n/en:game-9mm, l10n/ko:game-9mm, l10n/en:game-9mm-tooltip, l10n/ko:game-9mm-tooltip] [H] |
| `12gauge` | 12 gauge / 툴팁: Ammo for M870, M1100, MP220, SPAS-12, SPAS-16, Saiga-12, Super 90 and… (원본: Ammo for M870, M1100, SPAS-12, Saiga-12, USAS-12, Super 90 and MP220.) | 12게이지 / M870, M1100, MP220, SPAS-12, SPAS-16, Saiga-12, Super 90, USAS-12의 탄약… (원본: M870, M1100, SPAS-12, Saiga-12, USAS-12, Super90, MP220의 탄약…) | = | [src:l10n/en:game-12gauge, l10n/ko:game-12gauge, l10n/en:game-12gauge-tooltip, l10n/ko:game-12gauge-tooltip] [H] |
| `762mm` | 7.62mm / 툴팁: Ammo for OT-38, AK-47, Groza, DP-28, BAR, SCAR-H, M39, BLR, Mosin, M1… (원본: Ammo for AK-47, SCAR-H, M39, Mosin, SV-98, M1, BAR, AN-94, PKP, Groza…) | 7.62mm / OT-38, AK-47, Groza, DP-28, BAR, SCAR-H, M39, BLR, Mosin, M1 Garand, … (원본: AK-47, SCAR-H, M39, Mosin, SV-98, M1, BAR, AN-94, PKP, Groz…) | = | [src:l10n/en:game-762mm, l10n/ko:game-762mm, l10n/en:game-762mm-tooltip, l10n/ko:game-762mm-tooltip] [H] |
| `556mm` | 5.56mm / 툴팁: Ammo for M416, FAMAS, Mk 12 SPR, L86A2, Scout Elite, IMD-2, QBB-97, M… (원본: Ammo for FAMAS, M416, M4A1-S, QBB-97, Mk 12, Scout Elite, and M249.) | 5.56mm / M416, FAMAS, Mk 12 SPR, L86A2, Scout Elite, IMD-2, QBB-97, M4A1-S, M2… (원본: FAMAS, M416, M4A1-S, QBB-97, Mk 12, Scout Elite, M249의 탄약입니…) | = | [src:l10n/en:game-556mm, l10n/ko:game-556mm, l10n/en:game-556mm-tooltip, l10n/ko:game-556mm-tooltip] [H] |
| `50AE` | .50 Caliber (원본: .50 AE) / 툴팁: Ammo for DEagle 50, S&W 500, Barrett M107 and ASh-12. (원본: Ammo for DEagle 50.) | .50 AE / 데저트이글 50 의 탄약입니다. (원본: 데저트이글 50 탄약입니다.) | .50 구경 | [src:l10n/en:game-50AE, l10n/ko:game-50AE, l10n/en:game-50AE-tooltip, l10n/ko:game-50AE-tooltip] [H] |
| `308sub` | .308 Subsonic / 툴팁: Ammo for AWM-S and Mk 20 SSR. (원본: Ammo for AWM-S.) | .308 아음속탄 / AWM-S, Mk 20 SSR의 탄약입니다. (원본: AWM-S 탄약입니다.) | = | [src:l10n/en:game-308sub, l10n/ko:game-308sub, l10n/en:game-308sub-tooltip, l10n/ko:game-308sub-tooltip] [H] |
| `flare` | Flare / 툴팁: Ammo for Flare Gun. | 섬광탄 / 섬광탄 총의 탄약입니다. | 신호탄 | [src:l10n/en:game-flare, l10n/ko:game-flare, l10n/en:game-flare-tooltip, l10n/ko:game-flare-tooltip] [H] |
| `45acp` | .45 ACP / 툴팁: Ammo for M1911, M1A1, Peacemaker, Model 94, Vector and Mk45G. (원본: Ammo for M1911, M1A1, Model 94, Vector and Peacemaker.) | .45 ACP / M1911, M1A1, Peacemaker, Model 94, Vector, Mk45G의 탄약입니다. (원본: M1911, M1A1, Model 94, Vector, Peacemaker의 탄약입니다.) | = | [src:l10n/en:game-45acp, l10n/ko:game-45acp, l10n/en:game-45acp-tooltip, l10n/ko:game-45acp-tooltip] [H] |

### 가방·방어구·스코프

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `backpack00` | Pouch | 주머니 | = | [src:l10n/en:game-backpack00, l10n/ko:game-backpack00] [H] |
| `backpack01` | Small Pack | 작은 가방 (원본: 스몰 팩) | = | [src:l10n/en:game-backpack01, l10n/ko:game-backpack01] [H] |
| `backpack02` | Regular Pack | 큰 가방 (원본: 레귤러 팩) | 보통 가방 | [src:l10n/en:game-backpack02, l10n/ko:game-backpack02] [H] |
| `backpack03` | Military Pack | 밀리터리 가방 (원본: 밀리터리 팩) | 군용 가방 | [src:l10n/en:game-backpack03, l10n/ko:game-backpack03] [H] |
| `backpack04` | Tactical Pack (fork) | — (누락) | 전술 가방 | [src:l10n/en:game-backpack04] [H] |
| `backpack04_cloud` | Experimental Pack (fork) / 설명: You can equip an extra perk. | — (누락) / — | 실험용 가방 | [src:l10n/en:game-backpack04_cloud, l10n/en:game-backpack04_cloud-desc] [H] |
| `chest01` | Level 1 Vest | 1레벨 조끼 (원본: 1등급 조끼) | = | [src:l10n/en:game-chest01, l10n/ko:game-chest01] [H] |
| `chest02` | Level 2 Vest | 2레벨 조끼 (원본: 2등급 조끼) | = | [src:l10n/en:game-chest02, l10n/ko:game-chest02] [H] |
| `chest03` | Level 3 Vest | 3레벨 조끼 (원본: 3등급 조끼) | = | [src:l10n/en:game-chest03, l10n/ko:game-chest03] [H] |
| `chest04` | Level 4 Vest | 4레벨 조끼 (원본: 4등급 조끼) | = | [src:l10n/en:game-chest04, l10n/ko:game-chest04] [H] |
| `helmet01` | Level 1 Helmet | 1레벨 헬멧 (원본: 1등급 헬멧) | = | [src:l10n/en:game-helmet01, l10n/ko:game-helmet01] [H] |
| `helmet02` | Level 2 Helmet | 2레벨 헬멧 (원본: 2등급 헬멧) | = | [src:l10n/en:game-helmet02, l10n/ko:game-helmet02] [H] |
| `helmet03` | Level 3 Helmet | 3레벨 헬멧 (원본: 3등급 헬멧) | = | [src:l10n/en:game-helmet03, l10n/ko:game-helmet03] [H] |
| `helmet03_leader` | Commander Helmet | 지휘관 헬멧 | = | [src:l10n/en:game-helmet03_leader, l10n/ko:game-helmet03_leader] [H] |
| `helmet03_forest` | Shishigami no Kabuto | 시시가미의 투구 | = | [src:l10n/en:game-helmet03_forest, l10n/ko:game-helmet03_forest] [H] |
| `helmet03_moon` | Tsukuyomi no Kabuto | 츠쿠요미의 투구 | = | [src:l10n/en:game-helmet03_moon, l10n/ko:game-helmet03_moon] [H] |
| `helmet03_lt` | Lieutenant Helmet | 부관 헬멧 | = | [src:l10n/en:game-helmet03_lt, l10n/ko:game-helmet03_lt] [H] |
| `helmet03_lt_aged` | Lieutenant Helmet | 부관 헬멧 | = | [src:l10n/en:game-helmet03_lt_aged, l10n/ko:game-helmet03_lt_aged] [H] |
| `helmet03_potato` | K-pot-ato | K-포-테토 | = | [src:l10n/en:game-helmet03_potato, l10n/ko:game-helmet03_potato] [H] |
| `helmet03_marksman` | Marksman Helmet | 명사수 헬멧 | = | [src:l10n/en:game-helmet03_marksman, l10n/ko:game-helmet03_marksman] [H] |
| `helmet04_lone_survivr` | Lone Survivr Helmet | 론 서바이버 헬멧 | = | [src:l10n/en:game-helmet04_lone_survivr, l10n/ko:game-helmet04_lone_survivr] [H] |
| `helmet04_leader` | Commander Helmet | 지휘관 헬멧 | = | [src:l10n/en:game-helmet04_leader, l10n/ko:game-helmet04_leader] [H] |
| `helmet04_captain` | Captain Helmet (fork) | 대장모 † | 대장 헬멧 | [src:l10n/en:game-helmet04_captain, l10n/ko:game-helmet04_captain] [H] |
| `helmet04_classless` | Classless Helmet (fork) | — (누락) | 무소속 헬멧 | [src:l10n/en:game-helmet04_classless] [H] |
| `1xscope` | 1x Scope | 1배율 스코프 | = | [src:l10n/en:game-1xscope, l10n/ko:game-1xscope] [H] |
| `2xscope` | 2x Scope | 2배율 스코프 | = | [src:l10n/en:game-2xscope, l10n/ko:game-2xscope] [H] |
| `4xscope` | 4x Scope | 4배율 스코프 | = | [src:l10n/en:game-4xscope, l10n/ko:game-4xscope] [H] |
| `8xscope` | 8x Scope | 8배율 스코프 | = | [src:l10n/en:game-8xscope, l10n/ko:game-8xscope] [H] |
| `15xscope` | 15x Scope | 15배율 스코프 | = | [src:l10n/en:game-15xscope, l10n/ko:game-15xscope] [H] |
| `level-1` | Lvl. 1 | 레벨 1 (원본: 레벨. 1) | = | [src:l10n/en:game-level-1, l10n/ko:game-level-1] [H] |
| `level-2` | Lvl. 2 | 레벨 2 (원본: 레벨. 2) | = | [src:l10n/en:game-level-2, l10n/ko:game-level-2] [H] |
| `level-3` | Lvl. 3 | 레벨 3 (원본: 레벨. 3) | = | [src:l10n/en:game-level-3, l10n/ko:game-level-3] [H] |
| `level-4` | Lvl. 4 | 레벨 4 (원본: 레벨. 4) | = | [src:l10n/en:game-level-4, l10n/ko:game-level-4] [H] |

### 총기 (gun)

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `ak47` | AK-47 | AK-47 | = | [src:l10n/en:game-ak47, l10n/ko:game-ak47] [H] |
| `scar` | SCAR-H | SCAR-H | = | [src:l10n/en:game-scar, l10n/ko:game-scar] [H] |
| `an94` | AN-94 | AN-94 | = | [src:l10n/en:game-an94, l10n/ko:game-an94] [H] |
| `groza` | Groza | Groza | = | [src:l10n/en:game-groza, l10n/ko:game-groza] [H] |
| `grozas` | Groza-S | Groza-S | = | [src:l10n/en:game-grozas, l10n/ko:game-grozas] [H] |
| `dp28` | DP-28 | DP-28 | = | [src:l10n/en:game-dp28, l10n/ko:game-dp28] [H] |
| `mosin` | Mosin-Nagant | 모신나강 | = | [src:l10n/en:game-mosin, l10n/ko:game-mosin] [H] |
| `sv98` | SV-98 | SV-98 | = | [src:l10n/en:game-sv98, l10n/ko:game-sv98] [H] |
| `sv98_winter` | SV-98 (fork) | SV-98 † | = | [src:l10n/en:game-sv98_winter, l10n/ko:game-sv98_winter] [H] |
| `m39` | M39 EMR | M39 EMR | = | [src:l10n/en:game-m39, l10n/ko:game-m39] [H] |
| `garand` | M1 Garand | M1 개런드 | = | [src:l10n/en:game-garand, l10n/ko:game-garand] [H] |
| `svd` | SVD-63 | SVD-63 | = | [src:l10n/en:game-svd, l10n/ko:game-svd] [H] |
| `svd_winter` | SVD-63 (fork) | SVD-63 † | = | [src:l10n/en:game-svd_winter, l10n/ko:game-svd_winter] [H] |
| `blr` | BLR 81 | BLR 81 | = | [src:l10n/en:game-blr, l10n/ko:game-blr] [H] |
| `mp5` | MP5 | MP5 | = | [src:l10n/en:game-mp5, l10n/ko:game-mp5] [H] |
| `mac10` | MAC-10 | MAC-10 | = | [src:l10n/en:game-mac10, l10n/ko:game-mac10] [H] |
| `ump9` | UMP9 | UMP9 | = | [src:l10n/en:game-ump9, l10n/ko:game-ump9] [H] |
| `vector` | Vector | Vector | = | [src:l10n/en:game-vector, l10n/ko:game-vector] [H] |
| `vector45` | Vector | Vector | = | [src:l10n/en:game-vector45, l10n/ko:game-vector45] [H] |
| `scorpion` | CZ-3A1 | CZ-3A1 | = | [src:l10n/en:game-scorpion, l10n/ko:game-scorpion] [H] |
| `vss` | VSS | VSS | = | [src:l10n/en:game-vss, l10n/ko:game-vss] [H] |
| `m870` | M870 | M870 | = | [src:l10n/en:game-m870, l10n/ko:game-m870] [H] |
| `m1100` | M1100 | M1100 | = | [src:l10n/en:game-m1100, l10n/ko:game-m1100] [H] |
| `m1014` | Super 90 | Super 90 | = | [src:l10n/en:game-m1014, l10n/ko:game-m1014] [H] |
| `mp220` | MP220 | MP220 | = | [src:l10n/en:game-mp220, l10n/ko:game-mp220] [H] |
| `usas` | USAS-12 | USAS-12 | = | [src:l10n/en:game-usas, l10n/ko:game-usas] [H] |
| `saiga` | Saiga-12 | Saiga-12 | = | [src:l10n/en:game-saiga, l10n/ko:game-saiga] [H] |
| `spas12` | SPAS-12 | SPAS-12 | = | [src:l10n/en:game-spas12, l10n/ko:game-spas12] [H] |
| `spas16` | SPAS-16 (fork) | SPAS-16 † | = | [src:l10n/en:game-spas16, l10n/ko:game-spas16] [H] |
| `m9` | M9 | M9 | = | [src:l10n/en:game-m9, l10n/ko:game-m9] [H] |
| `m9_dual` | Dual M9 / HUD: M9 | 듀얼 M9 / M9 | = | [src:l10n/en:game-m9_dual, l10n/ko:game-m9_dual, l10n/en:game-hud-m9_dual, l10n/ko:game-hud-m9_dual] [H] |
| `m9_cursed` | M9 Cursed | 저주받은 M9 | = | [src:l10n/en:game-m9_cursed, l10n/ko:game-m9_cursed] [H] |
| `m93r` | M93R | M93R | = | [src:l10n/en:game-m93r, l10n/ko:game-m93r] [H] |
| `m93r_dual` | Dual M93R / HUD: M93R | 듀얼 M93R / M93R | = | [src:l10n/en:game-m93r_dual, l10n/ko:game-m93r_dual, l10n/en:game-hud-m93r_dual, l10n/ko:game-hud-m93r_dual] [H] |
| `glock` | G18C | G18C | = | [src:l10n/en:game-glock, l10n/ko:game-glock] [H] |
| `glock_dual` | Dual G18C / HUD: G18C | 듀얼 G18C / G18C | = | [src:l10n/en:game-glock_dual, l10n/ko:game-glock_dual, l10n/en:game-hud-glock_dual, l10n/ko:game-hud-glock_dual] [H] |
| `p30l` | P30L | P30L | = | [src:l10n/en:game-p30l, l10n/ko:game-p30l] [H] |
| `p30l_dual` | Dual P30L | 듀얼 P30L | = | [src:l10n/en:game-p30l_dual, l10n/ko:game-p30l_dual] [H] |
| `ot38` | OT-38 | OT-38 | = | [src:l10n/en:game-ot38, l10n/ko:game-ot38] [H] |
| `ot38_dual` | Dual OT-38 / HUD: OT-38 | 듀얼 OT-38 / OT-38 | = | [src:l10n/en:game-ot38_dual, l10n/ko:game-ot38_dual, l10n/en:game-hud-ot38_dual, l10n/ko:game-hud-ot38_dual] [H] |
| `ots38` | OTs-38 | OTs-38 | = | [src:l10n/en:game-ots38, l10n/ko:game-ots38] [H] |
| `ots38_dual` | Dual OTs-38 / HUD: OTs-38 | 듀얼 OTs-38 / OTs-38 | = | [src:l10n/en:game-ots38_dual, l10n/ko:game-ots38_dual, l10n/en:game-hud-ots38_dual, l10n/ko:game-hud-ots38_dual] [H] |
| `deagle` | DEagle 50 | 데저트이글 50 | = | [src:l10n/en:game-deagle, l10n/ko:game-deagle] [H] |
| `deagle_dual` | Dual DEagle 50 / HUD: DEagle 50 | 듀얼 데저트이글 50 / 데저트이글 50 | = | [src:l10n/en:game-deagle_dual, l10n/ko:game-deagle_dual, l10n/en:game-hud-deagle_dual, l10n/ko:game-hud-deagle_dual] [H] |
| `sw500` | S&W 500 (fork) | — (누락) | S&W 500 | [src:l10n/en:game-sw500] [H] |
| `barrett` | Barrett M107 (fork) | — (누락) | 바렛 M107 | [src:l10n/en:game-barrett] [H] |
| `ash12` | ASh-12 (fork) | — (누락) | ASh-12 | [src:l10n/en:game-ash12] [H] |
| `flare_gun` | Flare Gun | 섬광탄 총 | 신호탄 총 | [src:l10n/en:game-flare_gun, l10n/ko:game-flare_gun] [H] |
| `flare_gun_dual` | Dual Flare Gun / HUD: Flare Gun | 듀얼 섬광탄 총 / 섬광탄 총 | 듀얼 신호탄 총 | [src:l10n/en:game-flare_gun_dual, l10n/ko:game-flare_gun_dual, l10n/en:game-hud-flare_gun_dual, l10n/ko:game-hud-flare_gun_dual] [H] |
| `famas` | FAMAS | FAMAS | = | [src:l10n/en:game-famas, l10n/ko:game-famas] [H] |
| `hk416` | M416 | M416 | = | [src:l10n/en:game-hk416, l10n/ko:game-hk416] [H] |
| `m4a1` | M4A1-S | M4A1-S | = | [src:l10n/en:game-m4a1, l10n/ko:game-m4a1] [H] |
| `mk12` | Mk 12 SPR | Mk 12 SPR | = | [src:l10n/en:game-mk12, l10n/ko:game-mk12] [H] |
| `m249` | M249 | M249 | = | [src:l10n/en:game-m249, l10n/ko:game-m249] [H] |
| `qbb97` | QBB-97 | QBB-97 | = | [src:l10n/en:game-qbb97, l10n/ko:game-qbb97] [H] |
| `scout_elite` | Scout Elite | 스카우트 엘리트 | = | [src:l10n/en:game-scout_elite, l10n/ko:game-scout_elite] [H] |
| `l86` | L86A2 | L86A2 | = | [src:l10n/en:game-l86, l10n/ko:game-l86] [H] |
| `awc` | AWM-S | AWM-S | = | [src:l10n/en:game-awc, l10n/ko:game-awc] [H] |
| `awc_winter` | AWM-S (fork) | AWM-S † | = | [src:l10n/en:game-awc_winter, l10n/ko:game-awc_winter] [H] |
| `scarssr` | Mk 20 SSR | Mk 20 SSR | = | [src:l10n/en:game-scarssr, l10n/ko:game-scarssr] [H] |
| `model94` | Model 94 | Model 94 | = | [src:l10n/en:game-model94, l10n/ko:game-model94] [H] |
| `colt45` | Peacemaker | 피스메이커 | = | [src:l10n/en:game-colt45, l10n/ko:game-colt45] [H] |
| `colt45_dual` | Dual Peacemaker / HUD: Peacemaker | 듀얼 피스메이커 / 피스메이커 | = | [src:l10n/en:game-colt45_dual, l10n/ko:game-colt45_dual, l10n/en:game-hud-colt45_dual, l10n/ko:game-hud-colt45_dual] [H] |
| `mkg45` | Mk45G | Mk45G | = | [src:l10n/en:game-mkg45, l10n/ko:game-mkg45] [H] |
| `m1911` | M1911 | M1911 | = | [src:l10n/en:game-m1911, l10n/ko:game-m1911] [H] |
| `m1911_dual` | Dual M1911 / HUD: M1911 | 듀얼 M1911 / M1911 | = | [src:l10n/en:game-m1911_dual, l10n/ko:game-m1911_dual, l10n/en:game-hud-m1911_dual, l10n/ko:game-hud-m1911_dual] [H] |
| `m1a1` | M1A1 | M1A1 | = | [src:l10n/en:game-m1a1, l10n/ko:game-m1a1] [H] |
| `bar` | BAR M1918 | BAR M1918 | = | [src:l10n/en:game-bar, l10n/ko:game-bar] [H] |
| `imbel` | IMD-2 (fork) | IMD-2 † | = | [src:l10n/en:game-imbel, l10n/ko:game-imbel] [H] |
| `pkp` | PKP Pecheneg | PKP 페체네그 | = | [src:l10n/en:game-pkp, l10n/ko:game-pkp] [H] |
| `potato_cannon` | Potato Cannon | 포테이토 캐논 | = | [src:l10n/en:game-potato_cannon, l10n/ko:game-potato_cannon] [H] |
| `potato_lmg` | PMG-134 (fork) | — (누락) | PMG-134 | [src:l10n/en:game-potato_lmg] [H] |
| `potato_smg` | Spud Gun | 감자총 | = | [src:l10n/en:game-potato_smg, l10n/ko:game-potato_smg] [H] |
| `bugle` | Bugle | 나팔 | = | [src:l10n/en:game-bugle, l10n/ko:game-bugle] [H] |

### 근접 무기 (melee)

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `fists` | Fists | 주먹 | = | [src:l10n/en:game-fists, l10n/ko:game-fists] [H] |
| `knuckles_rusted` | Knuckles Rusted / HUD: Knuckles | 녹슨 너클즈 (원본: 녹슨 주먹) / 너클즈 (원본: 주먹) | = | [src:l10n/en:game-knuckles_rusted, l10n/ko:game-knuckles_rusted, l10n/en:game-hud-knuckles_rusted, l10n/ko:game-hud-knuckles_rusted] [H] |
| `knuckles_heroic` | Knuckles Heroic / HUD: Knuckles | 영웅의 너클즈 (원본: 영웅의 주먹) / 너클즈 (원본: 주먹) | = | [src:l10n/en:game-knuckles_heroic, l10n/ko:game-knuckles_heroic, l10n/en:game-hud-knuckles_heroic, l10n/ko:game-hud-knuckles_heroic] [H] |
| `karambit_rugged` | Karambit Rugged / HUD: Karambit | 단단한 카람빗 / 카람빗 | = | [src:l10n/en:game-karambit_rugged, l10n/ko:game-karambit_rugged, l10n/en:game-hud-karambit_rugged, l10n/ko:game-hud-karambit_rugged] [H] |
| `karambit_prismatic` | Karambit Prismatic / HUD: Karambit | 프리즘 카람빗 / 카람빗 | = | [src:l10n/en:game-karambit_prismatic, l10n/ko:game-karambit_prismatic, l10n/en:game-hud-karambit_prismatic, l10n/ko:game-hud-karambit_prismatic] [H] |
| `karambit_borealis` | Karambit Borealis (fork) / HUD: Karambit | — (누락) / — | 보레알리스 카람빗 | [src:l10n/en:game-karambit_borealis, l10n/en:game-hud-karambit_borealis] [H] |
| `karambit_drowned` | Karambit Drowned / HUD: Karambit | 젖은 카람빗 / 카람빗 | = | [src:l10n/en:game-karambit_drowned, l10n/ko:game-karambit_drowned, l10n/en:game-hud-karambit_drowned, l10n/ko:game-hud-karambit_drowned] [H] |
| `bayonet_rugged` | Bayonet Rugged / HUD: Bayonet | 튼튼한 총검 / 총검 | = | [src:l10n/en:game-bayonet_rugged, l10n/ko:game-bayonet_rugged, l10n/en:game-hud-bayonet_rugged, l10n/ko:game-hud-bayonet_rugged] [H] |
| `bayonet_woodland` | Bayonet Woodland / HUD: Bayonet | 우드랜드 총검 / 총검 | = | [src:l10n/en:game-bayonet_woodland, l10n/ko:game-bayonet_woodland, l10n/en:game-hud-bayonet_woodland, l10n/ko:game-hud-bayonet_woodland] [H] |
| `huntsman_rugged` | Huntsman Rugged / HUD: Huntsman | 튼튼한 사냥꾼 / 사냥꾼 | 튼튼한 헌츠맨 | [src:l10n/en:game-huntsman_rugged, l10n/ko:game-huntsman_rugged, l10n/en:game-hud-huntsman_rugged, l10n/ko:game-hud-huntsman_rugged] [H] |
| `huntsman_burnished` | Huntsman Burnished / HUD: Huntsman | 빛나는 사냥꾼 / 사냥꾼 | 빛나는 헌츠맨 | [src:l10n/en:game-huntsman_burnished, l10n/ko:game-huntsman_burnished, l10n/en:game-hud-huntsman_burnished, l10n/ko:game-hud-huntsman_burnished] [H] |
| `bowie_vintage` | Bowie Vintage / HUD: Bowie | 빈티지 보이 나이프 / 보이 나이프 | 빈티지 보위 나이프 | [src:l10n/en:game-bowie_vintage, l10n/ko:game-bowie_vintage, l10n/en:game-hud-bowie_vintage, l10n/ko:game-hud-bowie_vintage] [H] |
| `bowie_frontier` | Bowie Frontier / HUD: Bowie | 빈티지 보이 나이프 / 보이 나이프 | 프론티어 보위 나이프 | [src:l10n/en:game-bowie_frontier, l10n/ko:game-bowie_frontier, l10n/en:game-hud-bowie_frontier, l10n/ko:game-hud-bowie_frontier] [H] |
| `woodaxe` | Wood Axe | 나무 도끼 | = | [src:l10n/en:game-woodaxe, l10n/ko:game-woodaxe] [H] |
| `woodaxe_bloody` | Wood Axe Bloodstained / HUD: Wood Axe | 피 묻은 나무 도끼 / 나무 도끼 | = | [src:l10n/en:game-woodaxe_bloody, l10n/ko:game-woodaxe_bloody, l10n/en:game-hud-woodaxe_bloody, l10n/ko:game-hud-woodaxe_bloody] [H] |
| `fireaxe` | Fire Axe | 소방 도끼 | = | [src:l10n/en:game-fireaxe, l10n/ko:game-fireaxe] [H] |
| `katana` | Katana | 카타나 | = | [src:l10n/en:game-katana, l10n/ko:game-katana] [H] |
| `katana_rusted` | Katana Rusted / HUD: Katana | 녹슨 카타나 / 카타나 | = | [src:l10n/en:game-katana_rusted, l10n/ko:game-katana_rusted, l10n/en:game-hud-katana_rusted, l10n/ko:game-hud-katana_rusted] [H] |
| `katana_orchid` | Katana Orchid / HUD: Katana | 오키드 카타나 / 카타나 | = | [src:l10n/en:game-katana_orchid, l10n/ko:game-katana_orchid, l10n/en:game-hud-katana_orchid, l10n/ko:game-hud-katana_orchid] [H] |
| `naginata` | Naginata / HUD: Naginata | 나기나타 / 나기나타 | = | [src:l10n/en:game-naginata, l10n/ko:game-naginata, l10n/en:game-hud-naginata, l10n/ko:game-hud-naginata] [H] |
| `naginata_daemon` | Naginata Daemon (fork) / HUD: Naginata | — (누락) / — | 데몬 나기나타 | [src:l10n/en:game-naginata_daemon, l10n/en:game-hud-naginata_daemon] [H] |
| `machete_taiga` | Machete Taiga / HUD: Machete | 타이가 마체테 / 마체테 | = | [src:l10n/en:game-machete_taiga, l10n/ko:game-machete_taiga, l10n/en:game-hud-machete_taiga, l10n/ko:game-hud-machete_taiga] [H] |
| `kukri_trad` | Tallow's Kukri / HUD: Kukri | 탈로우의 쿠크리 / 쿠크리 | = | [src:l10n/en:game-kukri_trad, l10n/ko:game-kukri_trad, l10n/en:game-hud-kukri_trad, l10n/ko:game-hud-kukri_trad] [H] |
| `bonesaw_rusted` | Bonesaw Rusted / HUD: Bonesaw | 녹슨 톱 / 톱 | = | [src:l10n/en:game-bonesaw_rusted, l10n/ko:game-bonesaw_rusted, l10n/en:game-hud-bonesaw_rusted, l10n/ko:game-hud-bonesaw_rusted] [H] |
| `crowbar_recon` | Crowbar Carbon / HUD: Crowbar | 탄소 크로우바 / 크로우바 | = | [src:l10n/en:game-crowbar_recon, l10n/ko:game-crowbar_recon, l10n/en:game-hud-crowbar_recon, l10n/ko:game-hud-crowbar_recon] [H] |
| `stonehammer` | Stone Hammer | 스톤 해머 | = | [src:l10n/en:game-stonehammer, l10n/ko:game-stonehammer] [H] |
| `sledgehammer` | Sledgehammer | 슬렛지해머 | 슬레지해머 | [src:l10n/en:game-sledgehammer, l10n/ko:game-sledgehammer] [H] |
| `iceaxe` | Ice Axe (fork) | 얼음 도끼 † | = | [src:l10n/en:game-iceaxe, l10n/ko:game-iceaxe] [H] |
| `hook` | Hook | 후크 | = | [src:l10n/en:game-hook, l10n/ko:game-hook] [H] |
| `pan` | Pan | 후라이팬 (원본: 팬) | = | [src:l10n/en:game-pan, l10n/ko:game-pan] [H] |
| `crowbar_scout` | Scouting Crowbar / HUD: Crowbar | 스카우팅 크로우바 / 크로우바 | = | [src:l10n/en:game-crowbar_scout, l10n/ko:game-crowbar_scout, l10n/en:game-hud-crowbar_scout, l10n/ko:game-hud-crowbar_scout] [H] |
| `bonesaw_healer` | The Separator / HUD: Bonesaw | 세퍼레이터 / 톱 | = | [src:l10n/en:game-bonesaw_healer, l10n/ko:game-bonesaw_healer, l10n/en:game-hud-bonesaw_healer, l10n/ko:game-hud-bonesaw_healer] [H] |
| `kukri_sniper` | Marksman's Recurve / HUD: Kukri | 명사수의 리커브 / 쿠크리 | = | [src:l10n/en:game-kukri_sniper, l10n/ko:game-kukri_sniper, l10n/en:game-hud-kukri_sniper, l10n/ko:game-hud-kukri_sniper] [H] |
| `katana_demo` | Hakai no Katana / HUD: Katana | 하카이의 카타나 / 카타나 | = | [src:l10n/en:game-katana_demo, l10n/ko:game-katana_demo, l10n/en:game-hud-katana_demo, l10n/ko:game-hud-katana_demo] [H] |
| `spade_assault` | Trench Spade / HUD: Spade | 참호용 야전삽 / 야전삽 | = | [src:l10n/en:game-spade_assault, l10n/ko:game-spade_assault, l10n/en:game-hud-spade_assault, l10n/ko:game-hud-spade_assault] [H] |
| `warhammer_tank` | Panzerhammer / HUD: War Hammer | 팬저해머 / 워 해머 | = | [src:l10n/en:game-warhammer_tank, l10n/ko:game-warhammer_tank, l10n/en:game-hud-warhammer_tank, l10n/ko:game-hud-warhammer_tank] [H] |
| `cutlass` | Cutlass (fork) | 커틀러스 † | = | [src:l10n/en:game-cutlass, l10n/ko:game-cutlass] [H] |
| `cutlass_gold` | Cutlass Gold (fork) / HUD: Cutlass | 황금 커틀러스 † / 커틀러스 | = | [src:l10n/en:game-cutlass_gold, l10n/ko:game-cutlass_gold, l10n/en:game-hud-cutlass_gold, l10n/ko:game-hud-cutlass_gold] [H] |
| `knuckles` | Knuckles | — (누락) | 너클즈 | [src:l10n/en:game-knuckles] [H] |
| `karambit` | Karambit | — (누락) | 카람빗 | [src:l10n/en:game-karambit] [H] |
| `bayonet` | Bayonet | — (누락) | 총검 | [src:l10n/en:game-bayonet] [H] |
| `huntsman` | Huntsman | — (누락) | 헌츠맨 | [src:l10n/en:game-huntsman] [H] |
| `bowie` | Bowie | — (누락) | 보위 나이프 | [src:l10n/en:game-bowie] [H] |
| `machete` | Machete | — (누락) | 마체테 | [src:l10n/en:game-machete] [H] |
| `saw` | Saw | — (누락) | 톱 | [src:l10n/en:game-saw] [H] |
| `spade` | Spade | — (누락) | 야전삽 | [src:l10n/en:game-spade] [H] |
| `crowbar` | Crowbar | — (누락) | 크로우바 | [src:l10n/en:game-crowbar] [H] |

### 투척 무기 (throwable)

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `frag` | Frag Grenade / HUD: Frag | 파편 수류탄 / 수류탄 (원본: 파편) | = | [src:l10n/en:game-frag, l10n/ko:game-frag, l10n/en:game-hud-frag, l10n/ko:game-hud-frag] [H] |
| `smoke` | Smoke Grenade / HUD: Smoke | 연막탄 (원본: 연막 수류탄) / 연막 | = | [src:l10n/en:game-smoke, l10n/ko:game-smoke, l10n/en:game-hud-smoke, l10n/ko:game-hud-smoke] [H] |
| `mirv` | MIRV Grenade / HUD: MIRV | MIRV 수류탄 / MIRV | = | [src:l10n/en:game-mirv, l10n/ko:game-mirv, l10n/en:game-hud-mirv, l10n/ko:game-hud-mirv] [H] |
| `mirv_mini` | MIRV Grenade | MIRV 수류탄 | = | [src:l10n/en:game-mirv_mini, l10n/ko:game-mirv_mini] [H] |
| `martyr_nade` | Martyrdom | 순교자의 고통 | = | [src:l10n/en:game-martyr_nade, l10n/ko:game-martyr_nade] [H] |
| `strobe` | Strobe / HUD: Strobe | 스트로브 (원본: 스트로보) / 스트로브 (원본: 스트로보) | = | [src:l10n/en:game-strobe, l10n/ko:game-strobe, l10n/en:game-hud-strobe, l10n/ko:game-hud-strobe] [H] |
| `snowball` | Snowball / HUD: Snowball | 스노우볼 / 스노우볼 | = | [src:l10n/en:game-snowball, l10n/ko:game-snowball, l10n/en:game-hud-snowball, l10n/ko:game-hud-snowball] [H] |
| `snowball_heavy` | Snowball | 스노우볼 | = | [src:l10n/en:game-snowball_heavy, l10n/ko:game-snowball_heavy] [H] |
| `coconut` | Coconut (fork) / HUD: Coconut | 코코넛 † / 코코넛 | = | [src:l10n/en:game-coconut, l10n/ko:game-coconut, l10n/en:game-hud-coconut, l10n/ko:game-hud-coconut] [H] |
| `tomato` | Tomato (fork) / HUD: Tomato | — (누락) / — | 토마토 | [src:l10n/en:game-tomato, l10n/en:game-hud-tomato] [H] |
| `potato` | Potato / HUD: Potato | 감자 (원본: 포테이토) / 감자 (원본: 포테이토) | = | [src:l10n/en:game-potato, l10n/ko:game-potato, l10n/en:game-hud-potato, l10n/ko:game-hud-potato] [H] |
| `potato_heavy` | Potato | 감자 (원본: 포테이토) | = | [src:l10n/en:game-potato_heavy, l10n/ko:game-potato_heavy] [H] |
| `potato_cannonball` | Potato Cannon | 포테이토 캐논 | = | [src:l10n/en:game-potato_cannonball, l10n/ko:game-potato_cannonball] [H] |
| `potato_lmgshot` | PMG-134 (fork) | — (누락) | PMG-134 (킬 피드에 무기 이름으로 나온다) | [src:l10n/en:game-potato_lmgshot] [H] |
| `potato_smgshot` | Spud Gun | 감자총 | = | [src:l10n/en:game-potato_smgshot, l10n/ko:game-potato_smgshot] [H] |

### 특전 (perk)

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `leadership` | Leadership / 설명: Max adrenaline. / Increased size. | 리더십 / 최대 아드레날린. / 크기 증가. (원본: 최대 아드레날린입니다. / 크기가 증가되었습니다.) | = | [src:l10n/en:game-leadership, l10n/ko:game-leadership, l10n/en:game-leadership-desc, l10n/ko:game-leadership-desc] [H] |
| `assume_leadership` | Assume Leadership (fork) / 설명: Half-full adrenaline. / Slightly increased size. | 권한대행 † / 아드레날린 항상 50%. / 약간 커진 크기. | = | [src:l10n/en:game-assume_leadership, l10n/ko:game-assume_leadership, l10n/en:game-assume_leadership-desc, l10n/ko:game-assume_leadership-desc] [H] |
| `firepower` | Firepower / 설명: High-capacity magazines. | 화력 / 고용량 탄창. (원본: 고용량의 탄창입니다.) | = | [src:l10n/en:game-firepower, l10n/ko:game-firepower, l10n/en:game-firepower-desc, l10n/ko:game-firepower-desc] [H] |
| `gotw` | Gift of the Woods / 설명: Restore health over time. / Increased size. | 숲의 선물 / 시간이 지나면서 체력을 회복. / 크기 증가. (원본: 시간이 지나면서 체력을 회복합니다. / 크기가 증가되었습니다.) | = | [src:l10n/en:game-gotw, l10n/ko:game-gotw, l10n/en:game-gotw-desc, l10n/ko:game-gotw-desc] [H] |
| `windwalk` | Windwalk / 설명: When taking fire, gain a short burst of speed. | 윈드워크 / 총알을 맞았을 때 짧은 스피드 부스트를 얻는다. (원본: 총알을 맞았을 때 짧은 스피드 부스트를 얻습니다.) | = | [src:l10n/en:game-windwalk, l10n/ko:game-windwalk, l10n/en:game-windwalk-desc, l10n/ko:game-windwalk-desc] [H] |
| `rare_potato` | Rare Potato / 설명: Always rotate to a high quality weapon. | 희귀한 감자 (원본: 레어 포테이토) / 항상 고품질의 무기가 생성. (원본: 항상 고품질의 무기로 로테이션 됩니다.) | = | [src:l10n/en:game-rare_potato, l10n/ko:game-rare_potato, l10n/en:game-rare_potato-desc, l10n/ko:game-rare_potato-desc] [H] |
| `aoe_heal` | Mass Medicate / 설명: Reviving and using medical items affects all nearby players. | 집단 의료원 (원본: 매스 매디케이트) / 부활 및 인근의 모든 플레이어에게 효과가 미치는 치료 아이템을 사용. (원본: 부활 및 인근의 모든 플레이어에게 효과가 미치는 치료 아이템을 사용합니다.) | 집단 치료 | [src:l10n/en:game-aoe_heal, l10n/ko:game-aoe_heal, l10n/en:game-aoe_heal-desc, l10n/ko:game-aoe_heal-desc] [H] |
| `endless_ammo` | Endless Ammo / 설명: Guns always reload to full. | 무제한 탄환 (원본: 무한 탄창) / 총기가 항상 꽉 찬 상태로 재장전. (원본: 총기가 항상 꽉 찬 상태로 재장전 됩니다.) | = | [src:l10n/en:game-endless_ammo, l10n/ko:game-endless_ammo, l10n/en:game-endless_ammo-desc, l10n/ko:game-endless_ammo-desc] [H] |
| `steelskin` | Cast Ironskin / 설명: Take reduced damage and reflect enemy bullets. / Increased size. | 강철 피부 (원본: 주조된 아이언 스킨) / 대미지 감소와 적 탄환을 반사. / 크기 증가. (원본: 감소한 대미지와 적 탄환을 반사합니다. / 크기가 증가되었습니다.) | = | [src:l10n/en:game-steelskin, l10n/ko:game-steelskin, l10n/en:game-steelskin-desc, l10n/ko:game-steelskin-desc] [H] |
| `ap_rounds` | AP Rounds (fork) / 설명: Bullets are more effective against armored enemies and obstacles. | 관통탄 † / 갑옷을 입은 적과 장애물에게 총알이 더 효과적. | = | [src:l10n/en:game-ap_rounds, l10n/ko:game-ap_rounds, l10n/en:game-ap_rounds-desc, l10n/ko:game-ap_rounds-desc] [H] |
| `splinter` | Splinter Rounds / 설명: Rounds fragment into three less powerful bullets. | 갈라지는 탄환 / 세 개의 덜 강력한 탄환으로 쪼개지는 총알. (원본: 세 개의 덜 강력한 탄환으로 바뀌는 탄환입니다.) | = | [src:l10n/en:game-splinter, l10n/ko:game-splinter, l10n/en:game-splinter-desc, l10n/ko:game-splinter-desc] [H] |
| `small_arms` | Small Arms / 설명: Move faster with weapons deployed. / Decreased size. | 소형 화기 / 무기를 들면 빠르게 이동. / 크기가 줄어듬. (원본: 무기를 든 채로 빠르게 이동합니다. / 크기가 줄었습니다.) | = | [src:l10n/en:game-small_arms, l10n/ko:game-small_arms, l10n/en:game-small_arms-desc, l10n/ko:game-small_arms-desc] [H] |
| `takedown` | Takedown / 설명: Kills grant health, boost and a short burst of speed. | 급습 / 사살 시 체력, 아드레날린 및 짧은 스피드 부스트를 얻는다. (원본: 사살 시 체력, 부스트 및 짧은 스피드 부스트를 얻습니다.) | = | [src:l10n/en:game-takedown, l10n/ko:game-takedown, l10n/en:game-takedown-desc, l10n/ko:game-takedown-desc] [H] |
| `field_medic` | Combat Medic / 설명: Move quickly while healing. | 전투 의무병 / 치유 아이템 사용 중에 더 빨리 이동. (원본: 치유 중에 더 빨리 이동합니다.) | = | [src:l10n/en:game-field_medic, l10n/ko:game-field_medic, l10n/en:game-field_medic-desc, l10n/ko:game-field_medic-desc] [H] |
| `combat_stims` | Combat Stimulants (fork) / 설명: Consumables grant a temporary boost to bullet damage and allow them t… | — (누락) / — | 전투 각성제 | [src:l10n/en:game-combat_stims, l10n/en:game-combat_stims-desc] [H] |
| `lifeline` | Indomitable Spirit (fork) / 설명: Adrenaline loss slowed. Taking fatal damage consumes adrenaline to mi… | — (누락) / — | 불굴의 의지 | [src:l10n/en:game-lifeline, l10n/en:game-lifeline-desc] [H] |
| `tree_climbing` | One With Nature / 설명: Move through trees. Move faster in water. | 자연과 함께 하는 자 / 나무 사이를 이동. 물에서 더 빠르게 움직임. (원본: 나무 사이를 이동합니다. 물에서 더 빠르게 움직입니다.) | = | [src:l10n/en:game-tree_climbing, l10n/ko:game-tree_climbing, l10n/en:game-tree_climbing-desc, l10n/ko:game-tree_climbing-desc] [H] |
| `scavenger` | Scavenger / 설명: Obstacles drop additional items when destroyed. | 수집가 (원본: 스케빈저) / 장애물을 파괴했을 때 추가 아이템을 얻는다. (원본: 장애물을 파괴했을 때 추가 아이템을 떨굽니다.) | = | [src:l10n/en:game-scavenger, l10n/ko:game-scavenger, l10n/en:game-scavenger-desc, l10n/ko:game-scavenger-desc] [H] |
| `scavenger_adv` | Master Scavenger / 설명: Obstacles drop additional high-quality items when destroyed. | 숙련된 수집가 (원본: 마스터 스케빈저) / 장애물을 파괴했을 때 고품질의 추가 아이템을 얻는다. (원본: 장애물을 파괴했을 때 고품질의 추가 아이템을 떨굽니다.) | = | [src:l10n/en:game-scavenger_adv, l10n/ko:game-scavenger_adv, l10n/en:game-scavenger_adv-desc, l10n/ko:game-scavenger_adv-desc] [H] |
| `pirate` | Pirate's Bounty (fork) / 설명: Melee kills drop additional loot with a small chance for high-quality… | 해적의 현상금 † / 칼로 상대를 제압할 시 추가 아이템이 나옵니다. 적은 확률로 상급 아이템이 나올 수 있습니다. | = | [src:l10n/en:game-pirate, l10n/ko:game-pirate, l10n/en:game-pirate-desc, l10n/ko:game-pirate-desc] [H] |
| `hunted` | The Hunted / 설명: Your location is revealed to all enemies. | 수배중 (원본: 사냥 대상) / 모든 적에게 당신의 위치가 드러납니다. | = | [src:l10n/en:game-hunted, l10n/ko:game-hunted, l10n/en:game-hunted-desc, l10n/ko:game-hunted-desc] [H] |
| `chambered` | One in the Chamber (원본: One In The Chamber) / 설명: First and last round in each magazine deal bonus damage. / Does not a… | 아직 한발 남았다 (원본: 챔버 내 한 방) / 탄창의 첫 번째 및 마지막 탄환이 추가 대미지를 입힙니다. / 샷건엔 적용되지 않습니다. (원본: 탄창의 첫 번째 및 마지막 탄환이 보너스 대미지를 입힙니다. / 샷건엔 적용되지 않습니다.) | = | [src:l10n/en:game-chambered, l10n/ko:game-chambered, l10n/en:game-chambered-desc, l10n/ko:game-chambered-desc] [H] |
| `martyrdom` | Martyrdom / 설명: Release several live grenades upon death. | 순교자의 고통 / 사망 시 활성화 된 수류탄을 뿌립니다. | = | [src:l10n/en:game-martyrdom, l10n/ko:game-martyrdom, l10n/en:game-martyrdom-desc, l10n/ko:game-martyrdom-desc] [H] |
| `targeting` | High-Value Targets / 설명: Bullets deal bonus damage to players with perks. | 고부가치의 목표물 / 탄환으로 특전을 갖고 있는 플레이어에게 보너스 대미지를 줍니다. | 고가치 표적 | [src:l10n/en:game-targeting, l10n/ko:game-targeting, l10n/en:game-targeting-desc, l10n/ko:game-targeting-desc] [H] |
| `bonus_45` | .45 in the Chamber (원본: .45 In The Chamber) / 설명: .45 ACP bullets deal bonus damage, with a chance of being further emp… (원본: .45 ACP bullets deal bonus damage.) | 챔버 내 .45 한 방 / .45 ACP 탄환이 보너스 대미지를 줍니다. | .45 한발 남았다 | [src:l10n/en:game-bonus_45, l10n/ko:game-bonus_45, l10n/en:game-bonus_45-desc, l10n/ko:game-bonus_45-desc] [H] |
| `broken_arrow` | Broken Arrow / 설명: Air strikes call in two additional fighters. | 브로큰 애로우 / 공습 시 두 개의 추가 전투기를 호출합니다. | = | [src:l10n/en:game-broken_arrow, l10n/ko:game-broken_arrow, l10n/en:game-broken_arrow-desc, l10n/ko:game-broken_arrow-desc] [H] |
| `fabricate` | Fabricate / 설명: Periodically fill your pack with various explosives. (원본: Periodically fill your pack with frag grenades.) | 수류탄 공장 (원본: 조립) / 주기적으로 팩에 파편 수류탄을 채워줍니다. (원본: 주기적으로 여러분의 팩에 파편 수류탄을 채워줍니다.) | = | [src:l10n/en:game-fabricate, l10n/ko:game-fabricate, l10n/en:game-fabricate-desc, l10n/ko:game-fabricate-desc] [H] |
| `self_revive` | Revivify / 설명: You can revive yourself when downed. | 환원 / 쓰러졌을 때 스스로를 부활시킬 수 있습니다. | 자가 소생 | [src:l10n/en:game-self_revive, l10n/ko:game-self_revive, l10n/en:game-self_revive-desc, l10n/ko:game-self_revive-desc] [H] |
| `bonus_9mm` | 9mm Overpressure / 설명: 9mm bullets have increased speed, range, damage and spread. | 9mm 탄 과부화 (원본: 과충전 9mm) / 9mm 탄환이 증가된 속도, 사거리, 대미지 및 확산 능력을 갖습니다. | 9mm 과압탄 | [src:l10n/en:game-bonus_9mm, l10n/ko:game-bonus_9mm, l10n/en:game-bonus_9mm-desc, l10n/ko:game-bonus_9mm-desc] [H] |
| `flak_jacket` | Flak Jacket / 설명: Greatly reduces damage from explosions & shrapnel. / Increased grenad… (원본: Greatly reduces damage from explosions and shrapnel.) | 방탄 조끼 / 폭발물 및 파편탄으로부터의 대미지를 크게 줄여줍니다. | 방폭 재킷 | [src:l10n/en:game-flak_jacket, l10n/ko:game-flak_jacket, l10n/en:game-flak_jacket-desc, l10n/ko:game-flak_jacket-desc] [H] |
| `amped_explosives` | Hyperfragmentation (fork) / 설명: Throwables travel farther and faster. Fragmenting explosives release … | — (누락) / — | 초파편화 | [src:l10n/en:game-amped_explosives, l10n/en:game-amped_explosives-desc] [H] |
| `explosive` | Explosive Rounds / 설명: Bullets explode on impact. | 폭발 탄환 / 적을 타격하면 탄환이 폭발합니다. (원본: 타격이 탄환이 폭발합니다.) | = | [src:l10n/en:game-explosive, l10n/ko:game-explosive, l10n/en:game-explosive-desc, l10n/ko:game-explosive-desc] [H] |
| `bonus_assault` | Hollow-Points (원본: Hollow-points) / 설명: Bullets have increased damage & speed. (원본: All your bullets deal bonus damage.) | 할로우 포인트 / 모든 탄환이 보너스 대미지를 줍니다. | = | [src:l10n/en:game-bonus_assault, l10n/ko:game-bonus_assault, l10n/en:game-bonus_assault-desc, l10n/ko:game-bonus_assault-desc] [H] |
| `inspiration` | Inspiration / 설명: Your bugle call grants nearby allies a short burst of speed. | 영감 / 나팔소리가 근처의 아군이 짧은 스피드 부스트를 얻습니다. | = | [src:l10n/en:game-inspiration, l10n/ko:game-inspiration, l10n/en:game-inspiration-desc, l10n/ko:game-inspiration-desc] [H] |
| `final_bugle` | Last Breath / 설명: When you die, nearby allies are bloodlusted for a short period of tim… | 마지막 숨 / 사망 시 근처의 아군이 짧은 시간 동안 피에 굶주린 상태가 됩니다. | = | [src:l10n/en:game-final_bugle, l10n/ko:game-final_bugle, l10n/en:game-final_bugle-desc, l10n/ko:game-final_bugle-desc] [H] |
| `high_velocity` | High-Velocity Rounds (fork) / 설명: All your bullets travel significantly faster & further. | 고속탄 † / 모든 총알이 매우 빨라지고 멀리 나갑니다. | = | [src:l10n/en:game-high_velocity, l10n/ko:game-high_velocity, l10n/en:game-high_velocity-desc, l10n/ko:game-high_velocity-desc] [H] |
| `halloween_mystery` | Trick or Treat? / 설명: Could be either. | 트릭 오어 트리트? / 둘 중 하나입니다. | = | [src:l10n/en:game-halloween_mystery, l10n/ko:game-halloween_mystery, l10n/en:game-halloween_mystery-desc, l10n/ko:game-halloween_mystery-desc] [H] |
| `trick_nothing` | One With Nothing / 설명: Tricked! This perk does absolutely nothing! | 아무것도 아닌 것 / 속았군요! 이 특전은 아무 쓸모가 없습니다! (원본: 속았군요! 이 특전은 완전히 아무것도 아닙니다!) | = | [src:l10n/en:game-trick_nothing, l10n/ko:game-trick_nothing, l10n/en:game-trick_nothing-desc, l10n/ko:game-trick_nothing-desc] [H] |
| `trick_size` | Feedership / 설명: Tricked! You ate too much chicken and grew in size! | 피더십 / 속았군요! 치킨을 너무 많이 먹어 크기가 커졌습니다! | = | [src:l10n/en:game-trick_size, l10n/ko:game-trick_size, l10n/en:game-trick_size-desc, l10n/ko:game-trick_size-desc] [H] |
| `trick_m9` | Dev Troll Special / 설명: Tricked! You've been cursed with a developer 'treat'! | 개발자의 스페셜 트롤링 / 속았군요! 개발자의 '한턱'으로 저주받았습니다! | = | [src:l10n/en:game-trick_m9, l10n/ko:game-trick_m9, l10n/en:game-trick_m9-desc, l10n/ko:game-trick_m9-desc] [H] |
| `trick_chatty` | Gabby Ghost / 설명: Tricked! You're emoting randomly! | 수다스러운 유령 / 속았군요! 무작위로 이모티콘을 쓰고 있습니다! | = | [src:l10n/en:game-trick_chatty, l10n/ko:game-trick_chatty, l10n/en:game-trick_chatty-desc, l10n/ko:game-trick_chatty-desc] [H] |
| `trick_drain` | That Sucks / 설명: Tricked! You're bleeding very, very, VERY slowly! | 그거 형편없군 / 속았군요! 아주, 아주, 아주 천천히 체력이 깎이고 있습니다! (원본: 속았군요! 아주, 아주, 아주 천천히 피 흘리고 있습니다!) | = | [src:l10n/en:game-trick_drain, l10n/ko:game-trick_drain, l10n/en:game-trick_drain-desc, l10n/ko:game-trick_drain-desc] [H] |
| `treat_9mm` | Candy Corn / 설명: Treat! 9mm bullets are darker and deadlier. | 캔디 콘 / 보상입니다! 9mm 탄환이 더 어둡고 치명적으로 변합니다. | = | [src:l10n/en:game-treat_9mm, l10n/ko:game-treat_9mm, l10n/en:game-treat_9mm-desc, l10n/ko:game-treat_9mm-desc] [H] |
| `treat_12g` | Red Jelly Beans / 설명: Treat! 12 gauge pellets are darker and deadlier. | 레드 젤리빈 / 보상입니다! 12게이지 파편이 더 어둡고 치명적으로 변합니다. | = | [src:l10n/en:game-treat_12g, l10n/ko:game-treat_12g, l10n/en:game-treat_12g-desc, l10n/ko:game-treat_12g-desc] [H] |
| `treat_556` | Sour Apple Belt / 설명: Treat! 5.56mm bullets are darker and deadlier. | 사우어 애플 벨트 / 보상입니다! 5.56mm 탄환이 더 어둡고 치명적으로 변합니다. | = | [src:l10n/en:game-treat_556, l10n/ko:game-treat_556, l10n/en:game-treat_556-desc, l10n/ko:game-treat_556-desc] [H] |
| `treat_762` | Blueberry Taffy / 설명: Treat! 7.62mm bullets are darker and deadlier. | 블루베리 태피 / 보상입니다! 7.62mm 탄환이 더 어둡고 치명적으로 변합니다. | = | [src:l10n/en:game-treat_762, l10n/ko:game-treat_762, l10n/en:game-treat_762-desc, l10n/ko:game-treat_762-desc] [H] |
| `treat_super` | Full Size OKAMI Bar / 설명: Super Treat! ALL your bullets are darker and deadlier. | 풀사이즈 오카미 바 / 슈퍼 보상입니다! 모든 탄환이 더 어둡고 치명적으로 변합니다. | = | [src:l10n/en:game-treat_super, l10n/ko:game-treat_super, l10n/en:game-treat_super-desc, l10n/ko:game-treat_super-desc] [H] |
| `turkey_shoot` | Perky Shoot / 설명: Gobble, gobble! | 퍼키 슛 / 꼬끼오오오! (원본: 고르륵, 고르륵!) | = | [src:l10n/en:game-turkey_shoot, l10n/ko:game-turkey_shoot, l10n/en:game-turkey_shoot-desc, l10n/ko:game-turkey_shoot-desc] [H] |

### 역할·클래스 (role)·50v50 메시지

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `red-team` | Red Team | 홍 팀 (원본: 레드 팀) | = | [src:l10n/en:game-red-team, l10n/ko:game-red-team] [H] |
| `blue-team` | Blue Team | 청 팀 (원본: 블루 팀) | = | [src:l10n/en:game-blue-team, l10n/ko:game-blue-team] [H] |
| `red-leader` | Red Commander | 홍팀 지휘관 (원본: 레드팀 지휘관) | = | [src:l10n/en:game-red-leader, l10n/ko:game-red-leader] [H] |
| `blue-leader` | Blue Commander | 청팀 지휘관 (원본: 블루팀 지휘관) | = | [src:l10n/en:game-blue-leader, l10n/ko:game-blue-leader] [H] |
| `is-down` | is down | 이(가) 쓰러졌습니다 | = | [src:l10n/en:game-is-down, l10n/ko:game-is-down] [H] |
| `is-dead` | is dead | 이(가) 사망했습니다 | = | [src:l10n/en:game-is-dead, l10n/ko:game-is-dead] [H] |
| `promoted-to` | promoted to | 으(로) 승진했습니다 | = | [src:l10n/en:game-promoted-to, l10n/ko:game-promoted-to] [H] |
| `youve-been-promoted-to` | You've been promoted to | 으(로) 승진했습니다 | = | [src:l10n/en:game-youve-been-promoted-to, l10n/ko:game-youve-been-promoted-to] [H] |
| `leader` | Commander | 지휘관 | = | [src:l10n/en:game-leader, l10n/ko:game-leader] [H] |
| `captain` | Captain (fork) | 대장 † | = | [src:l10n/en:game-captain, l10n/ko:game-captain] [H] |
| `lieutenant` | Lieutenant | 부관 | = | [src:l10n/en:game-lieutenant, l10n/ko:game-lieutenant] [H] |
| `medic` | Medic | 의사 (원본: 위생병) | 위생병 | [src:l10n/en:game-medic, l10n/ko:game-medic] [H] |
| `marksman` | Marksman | 명사수 | = | [src:l10n/en:game-marksman, l10n/ko:game-marksman] [H] |
| `recon` | Recon | 정찰병 | = | [src:l10n/en:game-recon, l10n/ko:game-recon] [H] |
| `grenadier` | Grenadier | 척탄병 | = | [src:l10n/en:game-grenadier, l10n/ko:game-grenadier] [H] |
| `bugler` | Bugler | 나팔수 | = | [src:l10n/en:game-bugler, l10n/ko:game-bugler] [H] |
| `kill_leader` | Kill Leader | 킬 리더 | = | [src:l10n/en:game-kill_leader, l10n/ko:game-kill_leader] [H] |
| `the_hunted` | The Hunted | 수배자 (원본: 사냥 대상) | = | [src:l10n/en:game-the_hunted, l10n/ko:game-the_hunted] [H] |
| `last_man` | Lone Survivr | 론 서바이버 | = | [src:l10n/en:game-last_man, l10n/ko:game-last_man] [H] |
| `woods_king` | The Woods King | 숲의 왕 | = | [src:l10n/en:game-woods_king, l10n/ko:game-woods_king] [H] |
| `healer` | Medic | 메딕 | = | [src:l10n/en:game-healer, l10n/ko:game-healer] [H] |
| `demo` | Demo | 폭파병 | = | [src:l10n/en:game-demo, l10n/ko:game-demo] [H] |
| `tank` | Tank | 장갑병 | = | [src:l10n/en:game-tank, l10n/ko:game-tank] [H] |
| `scout` | Scout | 정찰병 | 스카우트 | [src:l10n/en:game-scout, l10n/ko:game-scout] [H] |
| `sniper` | Sniper | 저격수 | = | [src:l10n/en:game-sniper, l10n/ko:game-sniper] [H] |
| `assault` | Assault | 돌격병 | = | [src:l10n/en:game-assault, l10n/ko:game-assault] [H] |
| `select-class` | SELECT A CLASS | 클래스를 선택하세요 | = | [src:l10n/en:game-select-class, l10n/ko:game-select-class] [H] |
| `enter-game` | ENTER GAME | 게임에 입장 | = | [src:l10n/en:game-enter-game, l10n/ko:game-enter-game] [H] |

### 킬 원인·상호작용 오브젝트

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `barrel_01` | a barrel | 드럼통 (원본: 통) | = | [src:l10n/en:game-barrel_01, l10n/ko:game-barrel_01] [H] |
| `barrel_01b` | a barrel | 드럼통 (원본: 통) | = | [src:l10n/en:game-barrel_01b, l10n/ko:game-barrel_01b] [H] |
| `silo_01` | a silo | 사일로 | = | [src:l10n/en:game-silo_01, l10n/ko:game-silo_01] [H] |
| `oven_01` | an oven | 오븐 (원본: 오브) | = | [src:l10n/en:game-oven_01, l10n/ko:game-oven_01] [H] |
| `control_panel_01` | Control Panel | 조작 패널 | = | [src:l10n/en:game-control_panel_01, l10n/ko:game-control_panel_01] [H] |
| `control_panel_02` | Control Panel | 조작 패널 | = | [src:l10n/en:game-control_panel_02, l10n/ko:game-control_panel_02] [H] |
| `control_panel_03` | a computer terminal | 컴퓨터 터미널 | = | [src:l10n/en:game-control_panel_03, l10n/ko:game-control_panel_03] [H] |
| `control_panel_04` | a computer terminal | 컴퓨터 터미널 | = | [src:l10n/en:game-control_panel_04, l10n/ko:game-control_panel_04] [H] |
| `control_panel_06` | a computer terminal | 컴퓨터 터미널 | = | [src:l10n/en:game-control_panel_06, l10n/ko:game-control_panel_06] [H] |
| `power_box_01` | a power box | 파워 박스 | 배전함 | [src:l10n/en:game-power_box_01, l10n/ko:game-power_box_01] [H] |
| `airdrop_crate_01` | Air Drop | 공중 보급 (원본: 공중 투하) | = | [src:l10n/en:game-airdrop_crate_01, l10n/ko:game-airdrop_crate_01] [H] |
| `airdrop_crate_02` | Air Drop | 공중 보급 (원본: 공중 투하) | = | [src:l10n/en:game-airdrop_crate_02, l10n/ko:game-airdrop_crate_02] [H] |
| `stove_01` | a stove | 가스레인지 (원본: 스토브) | = | [src:l10n/en:game-stove_01, l10n/ko:game-stove_01] [H] |
| `grill_01` | a grill | 그릴 | = | [src:l10n/en:game-grill_01, l10n/ko:game-grill_01] [H] |
| `propane_01` | a propane tank | 프로판 탱크 | = | [src:l10n/en:game-propane_01, l10n/ko:game-propane_01] [H] |
| `cobalt_wall_int_4` | cobalt | — (누락) | 코발트 벽 | [src:l10n/en:game-cobalt_wall_int_4] [H] |

### XP 아티팩트 (xp)

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `xp-drop-desc` | Pass XP | Pass XP | = | [src:l10n/en:game-xp-drop-desc, l10n/ko:game-xp-drop-desc] [H] |
| `xp_book_tallow` | Tallow's Journal | 탈로우의 일기 | = | [src:l10n/en:game-xp_book_tallow, l10n/ko:game-xp_book_tallow] [H] |
| `xp_book_greene` | Greene's Infinite Wisdom | 그린의 무한한 지혜 | = | [src:l10n/en:game-xp_book_greene, l10n/ko:game-xp_book_greene] [H] |
| `xp_book_parma` | The PARMA Papers | 파르마 문서 | = | [src:l10n/en:game-xp_book_parma, l10n/ko:game-xp_book_parma] [H] |
| `xp_book_nevelskoy` | The Nevelskoy Report | 네벨스코이 리포트 | = | [src:l10n/en:game-xp_book_nevelskoy, l10n/ko:game-xp_book_nevelskoy] [H] |
| `xp_book_rinzo` | Rinzō's Log | 린조의 기록 | = | [src:l10n/en:game-xp_book_rinzo, l10n/ko:game-xp_book_rinzo] [H] |
| `xp_book_kuga` | Memoirs of Kuga Kairyū | 쿠가 카이류의 기억 | = | [src:l10n/en:game-xp_book_kuga, l10n/ko:game-xp_book_kuga] [H] |
| `xp_glasses` | Lenz's Spectacles | 렌즈의 안경 | = | [src:l10n/en:game-xp_glasses, l10n/ko:game-xp_glasses] [H] |
| `xp_compass` | Amélie's True Compass | 아멜리에의 진짜 나침반 | = | [src:l10n/en:game-xp_compass, l10n/ko:game-xp_compass] [H] |
| `xp_stump` | Ravenstone's Bloody Stump | 레이븐스톤의 피묻은 그루터기 | = | [src:l10n/en:game-xp_stump, l10n/ko:game-xp_stump] [H] |
| `xp_bone` | Bone of Gordon | 고든의 뼈 | = | [src:l10n/en:game-xp_bone, l10n/ko:game-xp_bone] [H] |
| `xp_donut` | Cake Donut | 케이크 도넛 | = | [src:l10n/en:game-xp_donut, l10n/ko:game-xp_donut] [H] |

### 의상 (outfit)

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `outfitAurora` | Auroric Ascension (fork) | — (누락) | (fork) 오로라의 승천 | [src:l10n/en:game-outfitAurora] [H] |
| `outfitChameleon` | The Chameleon (fork) | — (누락) | (fork) 카멜레온 | [src:l10n/en:game-outfitChameleon] [H] |
| `outfitChrys` | Chrysanthemum Garb (fork) | — (누락) | (fork) 국화 의복 | [src:l10n/en:game-outfitChrys] [H] |
| `outfitCowz` | Cowz Cloak (fork) | — (누락) | (fork) 카우즈 망토 | [src:l10n/en:game-outfitCowz] [H] |
| `outfitFahrenheit` | Fahrenheit 5182 (fork) | — (누락) | (fork) 화씨 5182 | [src:l10n/en:game-outfitFahrenheit] [H] |
| `outfitPastel` | Pastel Sky (fork) | — (누락) | (fork) 파스텔 스카이 | [src:l10n/en:game-outfitPastel] [H] |
| `outfitPotatoskin` | Potatoskin (fork) | — (누락) | (fork) 감자 껍질 | [src:l10n/en:game-outfitPotatoskin] [H] |
| `outfitRain` | Rainy Day (fork) | — (누락) | (fork) 비 오는 날 | [src:l10n/en:game-outfitRain] [H] |
| `outfitBase` | Basic Outfit | 기본 복장 | = | [src:l10n/en:game-outfitBase, l10n/ko:game-outfitBase] [H] |
| `outfitRoyalFortune` | Royal Fortune | 로얄 포춘 | = | [src:l10n/en:game-outfitRoyalFortune, l10n/ko:game-outfitRoyalFortune] [H] |
| `outfitKeyLime` | Key Lime | 키 라임 | = | [src:l10n/en:game-outfitKeyLime, l10n/ko:game-outfitKeyLime] [H] |
| `outfitCobaltShell` | Cobalt Shell | 코발트 포탄 | = | [src:l10n/en:game-outfitCobaltShell, l10n/ko:game-outfitCobaltShell] [H] |
| `outfitCarbonFiber` | Carbon Fiber | 탄소 섬유 | = | [src:l10n/en:game-outfitCarbonFiber, l10n/ko:game-outfitCarbonFiber] [H] |
| `outfitDarkGloves` | The Professional | 프로페셔널 | = | [src:l10n/en:game-outfitDarkGloves, l10n/ko:game-outfitDarkGloves] [H] |
| `outfitDarkShirt` | The Semi-Pro | 세미 프로 | = | [src:l10n/en:game-outfitDarkShirt, l10n/ko:game-outfitDarkShirt] [H] |
| `outfitGhillie` | Ghillie Suit | 길리 수트 | 길리 슈트 | [src:l10n/en:game-outfitGhillie, l10n/ko:game-outfitGhillie] [H] |
| `outfitCamo` | Forest Camo | 숲 위장 | = | [src:l10n/en:game-outfitCamo, l10n/ko:game-outfitCamo] [H] |
| `outfitRed` | Target Practice | 타깃 연습 | 사격 표적 | [src:l10n/en:game-outfitRed, l10n/ko:game-outfitRed] [H] |
| `outfitWhite` | Arctic Avenger | 아틱 어벤저 | = | [src:l10n/en:game-outfitWhite, l10n/ko:game-outfitWhite] [H] |
| `outfitWoodland` | Woodland Combat | 삼림지대 전투 | = | [src:l10n/en:game-outfitWoodland, l10n/ko:game-outfitWoodland] [H] |
| `outfitJester` | Jester's Folly | 어릿광대의 장식 | = | [src:l10n/en:game-outfitJester, l10n/ko:game-outfitJester] [H] |
| `outfitPrisoner` | The New Black | 새 유행 | = | [src:l10n/en:game-outfitPrisoner, l10n/ko:game-outfitPrisoner] [H] |
| `outfitCasanova` | Casanova Silks | 카사노바 실크 | = | [src:l10n/en:game-outfitCasanova, l10n/ko:game-outfitCasanova] [H] |
| `outfitFragtastic` | Fragtastic (post-0.8.82) | 수류탄러버 † | = | [src:l10n/en:game-outfitFragtastic, l10n/ko:game-outfitFragtastic] [H] |
| `outfitKhaki` | The Initiative | 이니셔티브 | = | [src:l10n/en:game-outfitKhaki, l10n/ko:game-outfitKhaki] [H] |
| `outfitCoral` | Coral Guise | 산호빛 외피 | = | [src:l10n/en:game-outfitCoral, l10n/ko:game-outfitCoral] [H] |
| `outfitAqua` | Aquatic Avenger | 아쿠아틱 어벤저 | = | [src:l10n/en:game-outfitAqua, l10n/ko:game-outfitAqua] [H] |
| `outfitIslander` | Island Time | 아일랜드 타임 | = | [src:l10n/en:game-outfitIslander, l10n/ko:game-outfitIslander] [H] |
| `outfitMeteor` | Falling Star | 폴링 스타 | = | [src:l10n/en:game-outfitMeteor, l10n/ko:game-outfitMeteor] [H] |
| `outfitHeaven` | Celestial Garb | 천상의 의복 | = | [src:l10n/en:game-outfitHeaven, l10n/ko:game-outfitHeaven] [H] |
| `outfitWaterElem` | Water Elemental | 워터 엘리멘탈 | = | [src:l10n/en:game-outfitWaterElem, l10n/ko:game-outfitWaterElem] [H] |
| `outfitVerde` | Poncho Verde | 판초 베르데 | = | [src:l10n/en:game-outfitVerde, l10n/ko:game-outfitVerde] [H] |
| `outfitLumber` | Woodcutter's Wrap | 나무꾼 복장 | = | [src:l10n/en:game-outfitLumber, l10n/ko:game-outfitLumber] [H] |
| `outfitImperial` | Imperial Seal | 황실 봉인 | 황실의 인장 | [src:l10n/en:game-outfitImperial, l10n/ko:game-outfitImperial] [H] |
| `outfitPineapple` | Valiant Pineapple | 용맹한 파인애플 | = | [src:l10n/en:game-outfitPineapple, l10n/ko:game-outfitPineapple] [H] |
| `outfitTarkhany` | Tarkhany Regal | 타르카니 리걸 | = | [src:l10n/en:game-outfitTarkhany, l10n/ko:game-outfitTarkhany] [H] |
| `outfitDesertCamo` | Desert Camo | 사막 위장 | = | [src:l10n/en:game-outfitDesertCamo, l10n/ko:game-outfitDesertCamo] [H] |
| `outfitDesertGhillie` | Desert Ghillie | 사막용 길리 수트 | 사막 길리 슈트 | [src:l10n/en:game-outfitDesertGhillie, l10n/ko:game-outfitDesertGhillie] [H] |
| `outfitElf` | Tallow's Little Helper | 탈로우의 작은 조력자 | = | [src:l10n/en:game-outfitElf, l10n/ko:game-outfitElf] [H] |
| `outfitSpetsnaz` | Siberian Assault | 시베리안 어설트 | = | [src:l10n/en:game-outfitSpetsnaz, l10n/ko:game-outfitSpetsnaz] [H] |
| `outfitSnow` | Snowed Over (fork) | 눈 마니아 † | = | [src:l10n/en:game-outfitSnow, l10n/ko:game-outfitSnow] [H] |
| `outfitBlackIce` | Black Ice (fork) | 흑빙 † | = | [src:l10n/en:game-outfitBlackIce, l10n/ko:game-outfitBlackIce] [H] |
| `outfitDarkGhillie` | Incursion Ghillie | 급습용 길리 수트 | 급습용 길리 슈트 | [src:l10n/en:game-outfitDarkGhillie, l10n/ko:game-outfitDarkGhillie] [H] |
| `outfitRedLeaderAged` | Red Victorious | 영광스러운 레드 | = | [src:l10n/en:game-outfitRedLeaderAged, l10n/ko:game-outfitRedLeaderAged] [H] |
| `outfitBlueLeaderAged` | Stifled Blue | 억누른 블루 | = | [src:l10n/en:game-outfitBlueLeaderAged, l10n/ko:game-outfitBlueLeaderAged] [H] |
| `outfitWoodsCloak` | Greencloak | 초록색망토 | = | [src:l10n/en:game-outfitWoodsCloak, l10n/ko:game-outfitWoodsCloak] [H] |
| `outfitSpringGhillie` | Vernal Ghillie | 봄의 길리 수트 | 봄의 길리 슈트 | [src:l10n/en:game-outfitSpringGhillie, l10n/ko:game-outfitSpringGhillie] [H] |
| `outfitNoir` | Neo Noir | 네오 누아르 | = | [src:l10n/en:game-outfitNoir, l10n/ko:game-outfitNoir] [H] |
| `outfitSummerGhillie` | Verdant Ghillie | 파릇파릇한 길리 수트 | 파릇파릇한 길리 슈트 | [src:l10n/en:game-outfitSummerGhillie, l10n/ko:game-outfitSummerGhillie] [H] |
| `outfitWheat` | Splintered Wheat | 갈라지는 밀 | = | [src:l10n/en:game-outfitWheat, l10n/ko:game-outfitWheat] [H] |
| `outfitDev` | Developer Swag | 개발자의 스웩 | = | [src:l10n/en:game-outfitDev, l10n/ko:game-outfitDev] [H] |
| `outfitMaintainer` | Maintainer Swag (fork) | — (누락) | (fork) 메인테이너 스웩 | [src:l10n/en:game-outfitMaintainer] [H] |
| `outfitMod` | Game Moderatr (원본: Discord Moderatr) | Discord 관리자 | 디스코드 관리자 | [src:l10n/en:game-outfitMod, l10n/ko:game-outfitMod] [H] |
| `outfitGD` | Game Designr (fork) | — (누락) | (fork) 게임 디자이너 | [src:l10n/en:game-outfitGD] [H] |
| `outfitEvent` | Event Winnr (fork) | — (누락) | (fork) 이벤트 위너 | [src:l10n/en:game-outfitEvent] [H] |
| `outfitParma` | PARMA Jumpsuit | 파르마 점프수트 | = | [src:l10n/en:game-outfitParma, l10n/ko:game-outfitParma] [H] |
| `outfitParmaPrestige` | The Core Jumpsuit | 코어 점프수트 | = | [src:l10n/en:game-outfitParmaPrestige, l10n/ko:game-outfitParmaPrestige] [H] |
| `outfitTurkey` | Fowl Facade | 파울 파사드 | = | [src:l10n/en:game-outfitTurkey, l10n/ko:game-outfitTurkey] [H] |
| `outfitBarrel` | Fish in a Barrel | 통 속의 물고기 | = | [src:l10n/en:game-outfitBarrel, l10n/ko:game-outfitBarrel] [H] |
| `outfitWoodBarrel` | Fish in a Wood Barrel | 나무 통 속의 물고기 | = | [src:l10n/en:game-outfitWoodBarrel, l10n/ko:game-outfitWoodBarrel] [H] |
| `outfitStone` | Stoneskin | 스톤스킨 | = | [src:l10n/en:game-outfitStone, l10n/ko:game-outfitStone] [H] |
| `outfitSpringTree` | Barkskin (fork) | — (누락) | (fork) 나무껍질 | [src:l10n/en:game-outfitSpringTree] [H] |
| `outfitHalloweenTree` | Barkskin | 나무껍질 † | = | [src:l10n/en:game-outfitHalloweenTree, l10n/ko:game-outfitHalloweenTree] [H] |
| `outfitTreeSpooky` | Spoopy Barkskin | 웃기면서 무서운 나무껍질 | = | [src:l10n/en:game-outfitTreeSpooky, l10n/ko:game-outfitTreeSpooky] [H] |
| `outfitStump` | Dead Wood | 데드 우드 | = | [src:l10n/en:game-outfitStump, l10n/ko:game-outfitStump] [H] |
| `outfitBush` | Bush Wookie | 부시 우키 | = | [src:l10n/en:game-outfitBush, l10n/ko:game-outfitBush] [H] |
| `outfitLeafPile` | Sneaky Leaf | 엉큼한 나뭇잎 | = | [src:l10n/en:game-outfitLeafPile, l10n/ko:game-outfitLeafPile] [H] |
| `outfitCrate` | Guy in a Box | 상자 속의 사내 | = | [src:l10n/en:game-outfitCrate, l10n/ko:game-outfitCrate] [H] |
| `outfitTable` | Yard Sale | 마당 세일 | = | [src:l10n/en:game-outfitTable, l10n/ko:game-outfitTable] [H] |
| `outfitSoviet` | Comrade in a Box | 상자 속의 동지 | = | [src:l10n/en:game-outfitSoviet, l10n/ko:game-outfitSoviet] [H] |
| `outfitAirdrop` | Hot Drop | 핫 드롭 | = | [src:l10n/en:game-outfitAirdrop, l10n/ko:game-outfitAirdrop] [H] |
| `outfitOven` | Half-baked | 반쯤 익힌 | = | [src:l10n/en:game-outfitOven, l10n/ko:game-outfitOven] [H] |
| `outfitRefrigerator` | Cold Fusion | 콜드 퓨전 | = | [src:l10n/en:game-outfitRefrigerator, l10n/ko:game-outfitRefrigerator] [H] |
| `outfitVending` | OKAMI Cola Machine | 오카미 콜라 머신 | = | [src:l10n/en:game-outfitVending, l10n/ko:game-outfitVending] [H] |
| `outfitPumpkin` | Pumpkin Head | 펌킨 헤드 | = | [src:l10n/en:game-outfitPumpkin, l10n/ko:game-outfitPumpkin] [H] |
| `outfitWoodpile` | Deader Wood | 사자들의 숲 | = | [src:l10n/en:game-outfitWoodpile, l10n/ko:game-outfitWoodpile] [H] |
| `outfitToilet` | Size Two | 사이즈 투 | = | [src:l10n/en:game-outfitToilet, l10n/ko:game-outfitToilet] [H] |
| `outfitBushRiver` | Lilyveil | 릴리베일 | = | [src:l10n/en:game-outfitBushRiver, l10n/ko:game-outfitBushRiver] [H] |
| `outfitCrab` | Crabby Camo | 괴팍한 위장 | = | [src:l10n/en:game-outfitCrab, l10n/ko:game-outfitCrab] [H] |
| `outfitStumpAxe` | Axe-querade | 엑스쿼레이드 | = | [src:l10n/en:game-outfitStumpAxe, l10n/ko:game-outfitStumpAxe] [H] |
| `outfitBeachCamo` | Beach Shored (fork) | — (ko 키 오타 `game-outifitBeachCamo` = "해변가") | (fork) 해변가 (키 오타 수정) | [src:l10n/en:game-outfitBeachCamo, l10n/ko:game-outifitBeachCamo] [H] |
| `outfitCoconut` | Coconut Frenzy (fork) | 코코넛 투성이 † | = | [src:l10n/en:game-outfitCoconut, l10n/ko:game-outfitCoconut] [H] |
| `outfitWave` | Tidal Wave (fork) | 타이덜 웨이브 † | = | [src:l10n/en:game-outfitWave, l10n/ko:game-outfitWave] [H] |
| `outfitParrotfish` | Parrotfish (fork) | 앵무물고기 † | = | [src:l10n/en:game-outfitParrotfish, l10n/ko:game-outfitParrotfish] [H] |
| `outfitGold` | Capital Gains (fork) | — (누락) | (fork) 자본 이득 | [src:l10n/en:game-outfitGold] [H] |

### 로드아웃·희귀도·이모트 분류

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `loadout-title-outfit` | Outfit Skin | 스킨 (원본: 복장 스킨) | 의상 | [src:l10n/en:loadout-title-outfit, l10n/ko:loadout-title-outfit] [H] |
| `loadout-title-melee` | Melee Skin | 밀리 스킨 (원본: 근접 스킨) | 근접 무기 스킨 | [src:l10n/en:loadout-title-melee, l10n/ko:loadout-title-melee] [H] |
| `loadout-title-emote` | Emotes | 이모티콘 | = | [src:l10n/en:loadout-title-emote, l10n/ko:loadout-title-emote] [H] |
| `loadout-title-heal` | Heal Particles | 치유 효과 (원본: 치유 입자) | = | [src:l10n/en:loadout-title-heal, l10n/ko:loadout-title-heal] [H] |
| `loadout-title-boost` | Boost Particles | 부스트 효과 (원본: 부스트 입자) | = | [src:l10n/en:loadout-title-boost, l10n/ko:loadout-title-boost] [H] |
| `loadout-title-crosshair` | Crosshair | 조준선 | = | [src:l10n/en:loadout-title-crosshair, l10n/ko:loadout-title-crosshair] [H] |
| `loadout-title-player_icon` | Player Icon | 플레이어 아이콘 | = | [src:l10n/en:loadout-title-player_icon, l10n/ko:loadout-title-player_icon] [H] |
| `loadout-newest` | Newest (원본: Acquired) | 획득함 | 최신순 | [src:l10n/en:loadout-newest, l10n/ko:loadout-newest] [H] |
| `loadout-alpha` | Alpha | 알파 | 이름순 | [src:l10n/en:loadout-alpha, l10n/ko:loadout-alpha] [H] |
| `loadout-rarity` | Rarity (원본: Tier) | 층 | 희귀도 | [src:l10n/en:loadout-rarity, l10n/ko:loadout-rarity] [H] |
| `loadout-size` | Size | 크기 | = | [src:l10n/en:loadout-size, l10n/ko:loadout-size] [H] |
| `loadout-stroked` | Stroked | 타격됨 | 테두리 | [src:l10n/en:loadout-stroked, l10n/ko:loadout-stroked] [H] |
| `loadout-stock` | Stock | 스톡 | = | [src:l10n/en:loadout-stock, l10n/ko:loadout-stock] [H] |
| `loadout-common` | Common | 일반 | = | [src:l10n/en:loadout-common, l10n/ko:loadout-common] [H] |
| `loadout-uncommon` | Uncommon | 드문 (원본: 덜 흔한) | 고급 | [src:l10n/en:loadout-uncommon, l10n/ko:loadout-uncommon] [H] |
| `loadout-rare` | Rare | 희귀 | = | [src:l10n/en:loadout-rare, l10n/ko:loadout-rare] [H] |
| `loadout-epic` | Epic | 전설 | 영웅 | [src:l10n/en:loadout-epic, l10n/ko:loadout-epic] [H] |
| `loadout-mythic` | Mythic | 신화 | = | [src:l10n/en:loadout-mythic, l10n/ko:loadout-mythic] [H] |
| `loadout-acquired` | Acquired | 획득 | = | [src:l10n/en:loadout-acquired, l10n/ko:loadout-acquired] [H] |
| `loadout-category` | Category | 카테고리 | = | [src:l10n/en:loadout-category, l10n/ko:loadout-category] [H] |
| `loadout-standard-issue` | Standard Issue | 기본 지급 | = | [src:l10n/en:loadout-standard-issue, l10n/ko:loadout-standard-issue] [H] |
| `emote-subcat-locked` | Locked | — (누락) | 잠김 | [src:l10n/en:emote-subcat-locked] [H] |
| `emote-subcat-faces` | Faces | — (누락) | 얼굴 | [src:l10n/en:emote-subcat-faces] [H] |
| `emote-subcat-food` | Food | — (누락) | 음식 | [src:l10n/en:emote-subcat-food] [H] |
| `emote-subcat-animals` | Animals | — (누락) | 동물 | [src:l10n/en:emote-subcat-animals] [H] |
| `emote-subcat-logos` | Logos | — (누락) | 로고 | [src:l10n/en:emote-subcat-logos] [H] |
| `emote-subcat-other` | Other | — (누락) | 기타 | [src:l10n/en:emote-subcat-other] [H] |
| `emote-subcat-flags` | Flags | — (누락) | 국기 | [src:l10n/en:emote-subcat-flags] [H] |
| `emote-subcat-default` | Default | — (누락) | 기본 | [src:l10n/en:emote-subcat-default] [H] |
| `loadout-new-account` | Account Created | 계정 생성됨 | = | [src:l10n/en:loadout-new-account, l10n/ko:loadout-new-account] [H] |

### 퀘스트·패스

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `quest-login-prompt` | Log in to get quests! | 퀘스트를 받으려면 로그인 하세요! | = | [src:l10n/en:quest-login-prompt, l10n/ko:quest-login-prompt] [H] |
| `quest-refresh-prompt` | Get a new quest? (원본: Get a new mission?) | 새로운 임무를 얻을? | 새 퀘스트를 받을까요? | [src:l10n/en:quest-refresh-prompt, l10n/ko:quest-refresh-prompt] [H] |
| `pass_survivr1` | Survevr Pass 1 (원본: Survivr Pass 1) | Survev 패스 1 (원본: Surviv 패스 1) | Survivr 패스 1 | [src:l10n/en:pass_survivr1, l10n/ko:pass_survivr1] [H] |
| `pass_survivr2` | Survevr Pass 2 (fork) | Survev 패스 2 † | (fork) Survevr 패스 2 | [src:l10n/en:pass_survivr2, l10n/ko:pass_survivr2] [H] |
| `quest_top_solo` | Top 10 in solos | 솔로에서 Top 10 | 솔로 Top 10 | [src:l10n/en:quest_top_solo, l10n/ko:quest_top_solo] [H] |
| `quest_top_duo` | Top 8 in duos | 듀오에서 Top 8 | 듀오 Top 8 | [src:l10n/en:quest_top_duo, l10n/ko:quest_top_duo] [H] |
| `quest_top_squad` | Top 5 in squads | 스쿼드에서 Top 5 | 스쿼드 Top 5 | [src:l10n/en:quest_top_squad, l10n/ko:quest_top_squad] [H] |
| `quest_win_any` | Win a game (fork) | — (누락) | 게임에서 승리하라 | [src:l10n/en:quest_win_any] [H] |
| `quest_kills` | Kill enemies | 적군을 사살하라 | = | [src:l10n/en:quest_kills, l10n/ko:quest_kills] [H] |
| `quest_kills_hard` | Kill enemies | 적군을 사살하라 | = | [src:l10n/en:quest_kills_hard, l10n/ko:quest_kills_hard] [H] |
| `quest_kills_harder` | Kill enemies (fork) | — (누락) | 적군을 사살하라 | [src:l10n/en:quest_kills_harder] [H] |
| `quest_damage` | Damage enemies | 적군에게 피해를 입혀라 | = | [src:l10n/en:quest_damage, l10n/ko:quest_damage] [H] |
| `quest_damage_hard` | Damage enemies | 적군에게 피해를 입혀라 | = | [src:l10n/en:quest_damage_hard, l10n/ko:quest_damage_hard] [H] |
| `quest_damage_harder` | Damage enemies (fork) | — (누락) | 적군에게 피해를 입혀라 | [src:l10n/en:quest_damage_harder] [H] |
| `quest_survived` | Survived time | 생존 시간 (원본: 생존한 시간) | = | [src:l10n/en:quest_survived, l10n/ko:quest_survived] [H] |
| `quest_damage_9mm` | 9mm damage | 9mm 대미지 | = | [src:l10n/en:quest_damage_9mm, l10n/ko:quest_damage_9mm] [H] |
| `quest_damage_9mm_ltm` | 9mm damage (fork) | — (누락) | 9mm 대미지 | [src:l10n/en:quest_damage_9mm_ltm] [H] |
| `quest_damage_762mm` | 7.62mm damage | 7.62mm 대미지 | = | [src:l10n/en:quest_damage_762mm, l10n/ko:quest_damage_762mm] [H] |
| `quest_damage_762mm_ltm` | 7.62mm damage (fork) | — (누락) | 7.62mm 대미지 | [src:l10n/en:quest_damage_762mm_ltm] [H] |
| `quest_damage_556mm` | 5.56mm damage | 5.56mm 대미지 | = | [src:l10n/en:quest_damage_556mm, l10n/ko:quest_damage_556mm] [H] |
| `quest_damage_556mm_ltm` | 5.56mm damage (fork) | — (누락) | 5.56mm 대미지 | [src:l10n/en:quest_damage_556mm_ltm] [H] |
| `quest_damage_12gauge` | 12 gauge damage | 12게이지 대미지 | = | [src:l10n/en:quest_damage_12gauge, l10n/ko:quest_damage_12gauge] [H] |
| `quest_damage_12gauge_ltm` | 12 gauge damage (fork) | — (누락) | 12게이지 대미지 | [src:l10n/en:quest_damage_12gauge_ltm] [H] |
| `quest_damage_45acp` | .45 ACP damage (fork) | — (누락) | .45 ACP 대미지 | [src:l10n/en:quest_damage_45acp] [H] |
| `quest_damage_potato_ammo` | Potato weapon damage (fork) | — (누락) | 감자 무기 대미지 | [src:l10n/en:quest_damage_potato_ammo] [H] |
| `quest_damage_rare_ammo` | .50 Cal/.308 damage (fork) | — (누락) | .50/.308 대미지 | [src:l10n/en:quest_damage_rare_ammo] [H] |
| `quest_damage_rare_ammo_ltm` | .50 Cal/.308 damage (fork) | — (누락) | .50/.308 대미지 | [src:l10n/en:quest_damage_rare_ammo_ltm] [H] |
| `quest_damage_woods_king` | Damage as Woods King (fork) | — (누락) | 숲의 왕으로 대미지 | [src:l10n/en:quest_damage_woods_king] [H] |
| `quest_damage_grenade` | Grenade damage | 수류탄 대미지 | = | [src:l10n/en:quest_damage_grenade, l10n/ko:quest_damage_grenade] [H] |
| `quest_damage_grenade_ltm` | Grenade damage (fork) | — (누락) | 수류탄 대미지 | [src:l10n/en:quest_damage_grenade_ltm] [H] |
| `quest_damage_melee` | Melee damage | 근접 공격 대미지 (원본: 근접전 대미지) | = | [src:l10n/en:quest_damage_melee, l10n/ko:quest_damage_melee] [H] |
| `quest_damage_melee_ltm` | Melee damage (fork) | — (누락) | 근접 공격 대미지 | [src:l10n/en:quest_damage_melee_ltm] [H] |
| `quest_heal` | Use healing items | 치료 아이템 사용 | = | [src:l10n/en:quest_heal, l10n/ko:quest_heal] [H] |
| `quest_boost` | Use adrenaline items | 아드레날린 아이템 사용 | = | [src:l10n/en:quest_boost, l10n/ko:quest_boost] [H] |
| `quest_airdrop` | Unlock air drops | 보급 기능 잠금 해제 (원본: 공수 기능 잠금 해제) | 공중 보급 열기 | [src:l10n/en:quest_airdrop, l10n/ko:quest_airdrop] [H] |
| `quest_airdrop_ltm` | Unlock air drops (fork) | — (누락) | 공중 보급 열기 | [src:l10n/en:quest_airdrop_ltm] [H] |
| `quest_airdrop_ltm_hard` | Unlock air drops (fork) | — (누락) | 공중 보급 열기 | [src:l10n/en:quest_airdrop_ltm_hard] [H] |
| `quest_airdrop_rare` | Unlock rare air drops (fork) | — (누락) | 희귀 공중 보급 열기 | [src:l10n/en:quest_airdrop_rare] [H] |
| `quest_crates` | Destroy crates | 상자 파괴 | = | [src:l10n/en:quest_crates, l10n/ko:quest_crates] [H] |
| `quest_toilets` | Destroy toilets | 화장실 파괴 | = | [src:l10n/en:quest_toilets, l10n/ko:quest_toilets] [H] |
| `quest_furniture` | Destroy furniture | 가구 파괴 | = | [src:l10n/en:quest_furniture, l10n/ko:quest_furniture] [H] |
| `quest_barrels` | Destroy barrels | 드럼통 파괴 (원본: 통 파괴) | = | [src:l10n/en:quest_barrels, l10n/ko:quest_barrels] [H] |
| `quest_lockers` | Destroy lockers | 락커 파괴 (원본: 로커 파괴) | 사물함 파괴 | [src:l10n/en:quest_lockers, l10n/ko:quest_lockers] [H] |
| `quest_pots` | Destroy pots | 항아리 파괴 | = | [src:l10n/en:quest_pots, l10n/ko:quest_pots] [H] |
| `quest_vending` | Destroy soda machines | 자판기 파괴 (원본: 소다 기계 파괴) | = | [src:l10n/en:quest_vending, l10n/ko:quest_vending] [H] |
| `quest_hardstone` | Destroy hardstones (fork) | — (누락) | 하드스톤 파괴 | [src:l10n/en:quest_hardstone] [H] |
| `quest_soviet_crate` | Destroy Soviet crates (fork) | — (누락) | 소련 상자 파괴 | [src:l10n/en:quest_soviet_crate] [H] |
| `quest_initiative_crate` | Destroy Initiative crates (fork) | — (누락) | 이니셔티브 상자 파괴 | [src:l10n/en:quest_initiative_crate] [H] |
| `quest_pvt_swappers` | Destroy potatoes/tomatoes (fork) | — (누락) | 감자/토마토 파괴 | [src:l10n/en:quest_pvt_swappers] [H] |
| `quest_potatoes` | Destroy potatoes (fork) | — (누락) | 감자 파괴 | [src:l10n/en:quest_potatoes] [H] |
| `quest_club_kills` | Kill enemies at: Club (원본: Kill enemies at: club) | 다음 장소에서 사살하라: 클럽 | = | [src:l10n/en:quest_club_kills, l10n/ko:quest_club_kills] [H] |
| `quest_docks_kills` | Kill enemies at: Docks (fork) | — (누락) | 다음 장소에서 사살하라: 부두 | [src:l10n/en:quest_docks_kills] [H] |
| `quest_river_town_kills` | Kill enemies at: River Town (fork) | — (누락) | 다음 장소에서 사살하라: 강 마을 | [src:l10n/en:quest_river_town_kills] [H] |
| `quest_desert_town_kills` | Kill enemies at: Desert Town (fork) | — (누락) | 다음 장소에서 사살하라: 사막 마을 | [src:l10n/en:quest_desert_town_kills] [H] |
| `quest_reserve_kills` | Kill enemies at: Reserve (fork) | — (누락) | 다음 장소에서 사살하라: 보호구역 | [src:l10n/en:quest_reserve_kills] [H] |
| `quest_logging_complex_kills` | Kill at: Logging Complex (fork) | — (누락) | 다음 장소에서 사살하라: 벌목장 | [src:l10n/en:quest_logging_complex_kills] [H] |
| `quest_be_mvp` | Be the MVP (fork) | — (누락) | MVP가 되어라 | [src:l10n/en:quest_be_mvp] [H] |
| `quest_promote_hunted` | Become The Hunted (fork) | — (누락) | 수배자가 되어라 | [src:l10n/en:quest_promote_hunted] [H] |
| `quest_factions_damage` | Damage as any role (fork) | — (누락) | 역할을 맡은 채 대미지 | [src:l10n/en:quest_factions_damage] [H] |
| `quest_last_man_damage` | Damage as Lone Survivr | — (누락) | 론 서바이버로 대미지 | [src:l10n/en:quest_last_man_damage] [H] |
| `quest_last_man_damage_hard` | Damage as Lone Survivr (fork) | — (누락) | 론 서바이버로 대미지 | [src:l10n/en:quest_last_man_damage_hard] [H] |
| `quest_factions_kills` | Kills as any role (fork) | — (누락) | 역할을 맡은 채 사살 | [src:l10n/en:quest_factions_kills] [H] |
| `quest_healer_kills` | Kills as Medic (fork) | — (누락) | 메딕으로 사살 | [src:l10n/en:quest_healer_kills] [H] |
| `quest_tank_kills` | Kills as Tank (fork) | — (누락) | 장갑병으로 사살 | [src:l10n/en:quest_tank_kills] [H] |
| `quest_sniper_kills` | Kills as Sniper (fork) | — (누락) | 저격수로 사살 | [src:l10n/en:quest_sniper_kills] [H] |
| `quest_scout_kills` | Kills as Scout (fork) | — (누락) | 스카우트로 사살 | [src:l10n/en:quest_scout_kills] [H] |
| `quest_demo_kills` | Kills as Demo (fork) | — (누락) | 폭파병으로 사살 | [src:l10n/en:quest_demo_kills] [H] |
| `quest_assault_kills` | Kills as Assault (fork) | — (누락) | 돌격병으로 사살 | [src:l10n/en:quest_assault_kills] [H] |
| `quest_healer_damage` | Damage as Medic (fork) | — (누락) | 메딕으로 대미지 | [src:l10n/en:quest_healer_damage] [H] |
| `quest_tank_damage` | Damage as Tank (fork) | — (누락) | 장갑병으로 대미지 | [src:l10n/en:quest_tank_damage] [H] |
| `quest_sniper_damage` | Damage as Sniper (fork) | — (누락) | 저격수로 대미지 | [src:l10n/en:quest_sniper_damage] [H] |
| `quest_scout_damage` | Damage as Scout (fork) | — (누락) | 스카우트로 대미지 | [src:l10n/en:quest_scout_damage] [H] |
| `quest_demo_damage` | Damage as Demo (fork) | — (누락) | 폭파병으로 대미지 | [src:l10n/en:quest_demo_damage] [H] |
| `quest_assault_damage` | Damage as Assault (fork) | — (누락) | 돌격병으로 대미지 | [src:l10n/en:quest_assault_damage] [H] |
| `quest_classless_damage` | Damage as Classless (fork) | — (누락) | 클래스 없이 대미지 | [src:l10n/en:quest_classless_damage] [H] |

### 치유·부스트 효과 (heal_effect / boost_effect)

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `heal_basic` | Basic Healing | — (누락) | 기본 치유 | [src:l10n/en:game-heal_basic] [H] |
| `heal_heart` | Healing Hearts | — (누락) | 힐링 하트 | [src:l10n/en:game-heal_heart] [H] |
| `heal_moon` | Blood Moon | — (누락) | 블러드 문 | [src:l10n/en:game-heal_moon] [H] |
| `heal_tomoe` | Tomoe | — (누락) | 토모에 | [src:l10n/en:game-heal_tomoe] [H] |
| `heal_diamond` | Crazy Diamond (fork) | — (누락) | (fork) 크레이지 다이아몬드 | [src:l10n/en:game-heal_diamond] [H] |
| `heal_ankh` | Ankh Charm (fork) | — (누락) | (fork) 앙크 부적 | [src:l10n/en:game-heal_ankh] [H] |
| `heal_menacing` | Phantom Blood (fork) | — (누락) | (fork) 팬텀 블러드 | [src:l10n/en:game-heal_menacing] [H] |
| `boost_basic` | Basic Boost | — (누락) | 기본 부스트 | [src:l10n/en:game-boost_basic] [H] |
| `boost_star` | Starboost | — (누락) | 스타부스트 | [src:l10n/en:game-boost_star] [H] |
| `boost_naturalize` | Naturalize | — (누락) | 내추럴라이즈 | [src:l10n/en:game-boost_naturalize] [H] |
| `boost_shuriken` | Shuriken | — (누락) | 수리검 | [src:l10n/en:game-boost_shuriken] [H] |
| `boost_club` | Club Cola (fork) | — (누락) | (fork) 클럽 콜라 | [src:l10n/en:game-boost_club] [H] |
| `boost_hermes` | Winged Grace (fork) | — (누락) | (fork) 날개 달린 은총 | [src:l10n/en:game-boost_hermes] [H] |
| `boost_lightning` | Surged (fork) | — (누락) | (fork) 서지 | [src:l10n/en:game-boost_lightning] [H] |
| `boost_gearshift` | Gearshift (fork) | — (누락) | (fork) 기어시프트 | [src:l10n/en:game-boost_gearshift] [H] |

### 조준선 (crosshair)

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `crosshair_default` | Default | — (누락) | 기본 | [src:l10n/en:game-crosshair_default] [H] |
| `crosshair_001` … `crosshair_184` (29종: 001, 005, 007, 010, 022, 027, 038, 040, 045, 051, 064, 080, 086, 094, 098, 101, 102, 109, 118, 124, 125, 136, 158, 160, 173, 176, 177, 181, 184) | "Style NNN" | — (누락) | 스타일 NNN | [src:l10n/en:game-crosshair_001, l10n/en:game-crosshair_184] [H] |

### 이모트 (emote)

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `emote_antisocial` | Antisocial (fork) | — (누락) | 비사교적 | [src:l10n/en:game-emote_antisocial] [H] |
| `emote_thumbsup` | Thumbs Up | — (누락) | 엄지 척 | [src:l10n/en:game-emote_thumbsup] [H] |
| `emote_timeout` | Timeout! (fork) | — (누락) | 타임아웃! | [src:l10n/en:game-emote_timeout] [H] |
| `emote_sadface` | Sad Face | — (누락) | 슬픈 얼굴 | [src:l10n/en:game-emote_sadface] [H] |
| `emote_happyface` | Happy Face | — (누락) | 행복한 얼굴 | [src:l10n/en:game-emote_happyface] [H] |
| `emote_surviv` | Surviv Logo | — (누락) | Surviv 로고 | [src:l10n/en:game-emote_surviv] [H] |
| `emote_gg` | GG | — (누락) | GG | [src:l10n/en:game-emote_gg] [H] |
| `emote_bruh` | b r u h (fork) | — (누락) | b r u h | [src:l10n/en:game-emote_bruh] [H] |
| `emote_question` | Question Mark | — (누락) | 물음표 | [src:l10n/en:game-emote_question] [H] |
| `emote_tombstone` | Tombstone | — (누락) | 묘비 | [src:l10n/en:game-emote_tombstone] [H] |
| `emote_joyface` | Joyful Face | — (누락) | 기쁜 얼굴 | [src:l10n/en:game-emote_joyface] [H] |
| `emote_sobface` | Sobbing Face | — (누락) | 흐느끼는 얼굴 | [src:l10n/en:game-emote_sobface] [H] |
| `emote_thinkingface` | Thonk | — (누락) | 고민 중 | [src:l10n/en:game-emote_thinkingface] [H] |
| `emote_flagus` | Flag United States | — (누락) | 미국 국기 | [src:l10n/en:game-emote_flagus] [H] |
| `emote_flagthailand` | Flag Thailand | — (누락) | 태국 국기 | [src:l10n/en:game-emote_flagthailand] [H] |
| `emote_flaggermany` | Flag Germany | — (누락) | 독일 국기 | [src:l10n/en:game-emote_flaggermany] [H] |
| `emote_flagfrance` | Flag France | — (누락) | 프랑스 국기 | [src:l10n/en:game-emote_flagfrance] [H] |
| `emote_flagsouthkorea` | Flag South Korea | — (누락) | 대한민국 국기 | [src:l10n/en:game-emote_flagsouthkorea] [H] |
| `emote_flagbrazil` | Flag Brazil | — (누락) | 브라질 국기 | [src:l10n/en:game-emote_flagbrazil] [H] |
| `emote_flagcanada` | Flag Canada | — (누락) | 캐나다 국기 | [src:l10n/en:game-emote_flagcanada] [H] |
| `emote_flagspain` | Flag Spain | — (누락) | 스페인 국기 | [src:l10n/en:game-emote_flagspain] [H] |
| `emote_flagrussia` | Flag Russia | — (누락) | 러시아 국기 | [src:l10n/en:game-emote_flagrussia] [H] |
| `emote_flagmexico` | Flag Mexico | — (누락) | 멕시코 국기 | [src:l10n/en:game-emote_flagmexico] [H] |
| `emote_flagpoland` | Flag Poland | — (누락) | 폴란드 국기 | [src:l10n/en:game-emote_flagpoland] [H] |
| `emote_flaguk` | Flag United Kingdom | — (누락) | 영국 국기 | [src:l10n/en:game-emote_flaguk] [H] |
| `emote_flagcolombia` | Flag Colombia | — (누락) | 콜롬비아 국기 | [src:l10n/en:game-emote_flagcolombia] [H] |
| `emote_flagukraine` | Flag Ukraine | — (누락) | 우크라이나 국기 | [src:l10n/en:game-emote_flagukraine] [H] |
| `emote_flagturkey` | Flag Turkey | — (누락) | 튀르키예 국기 | [src:l10n/en:game-emote_flagturkey] [H] |
| `emote_flagphilippines` | Flag Philippines | — (누락) | 필리핀 국기 | [src:l10n/en:game-emote_flagphilippines] [H] |
| `emote_flagczechia` | Flag Czechia | — (누락) | 체코 국기 | [src:l10n/en:game-emote_flagczechia] [H] |
| `emote_flagperu` | Flag Peru | — (누락) | 페루 국기 | [src:l10n/en:game-emote_flagperu] [H] |
| `emote_flagaustria` | Flag Austria | — (누락) | 오스트리아 국기 | [src:l10n/en:game-emote_flagaustria] [H] |
| `emote_flagargentina` | Flag Argentina | — (누락) | 아르헨티나 국기 | [src:l10n/en:game-emote_flagargentina] [H] |
| `emote_flagjapan` | Flag Japan | — (누락) | 일본 국기 | [src:l10n/en:game-emote_flagjapan] [H] |
| `emote_flagvenezuela` | Flag Venezuela | — (누락) | 베네수엘라 국기 | [src:l10n/en:game-emote_flagvenezuela] [H] |
| `emote_flagvietnam` | Flag Vietnam | — (누락) | 베트남 국기 | [src:l10n/en:game-emote_flagvietnam] [H] |
| `emote_flagswitzerland` | Flag Switzerland | — (누락) | 스위스 국기 | [src:l10n/en:game-emote_flagswitzerland] [H] |
| `emote_flagnetherlands` | Flag Netherlands | — (누락) | 네덜란드 국기 | [src:l10n/en:game-emote_flagnetherlands] [H] |
| `emote_flagchina` | Flag China | — (누락) | 중국 국기 | [src:l10n/en:game-emote_flagchina] [H] |
| `emote_flagtaiwan` | Flag Taiwan | — (누락) | 대만 국기 | [src:l10n/en:game-emote_flagtaiwan] [H] |
| `emote_flagchile` | Flag Chile | — (누락) | 칠레 국기 | [src:l10n/en:game-emote_flagchile] [H] |
| `emote_flagaustralia` | Flag Australia | — (누락) | 호주 국기 | [src:l10n/en:game-emote_flagaustralia] [H] |
| `emote_flagdenmark` | Flag Denmark | — (누락) | 덴마크 국기 | [src:l10n/en:game-emote_flagdenmark] [H] |
| `emote_flagitaly` | Flag Italy | — (누락) | 이탈리아 국기 | [src:l10n/en:game-emote_flagitaly] [H] |
| `emote_flagsweden` | Flag Sweden | — (누락) | 스웨덴 국기 | [src:l10n/en:game-emote_flagsweden] [H] |
| `emote_flagecuador` | Flag Ecuador | — (누락) | 에콰도르 국기 | [src:l10n/en:game-emote_flagecuador] [H] |
| `emote_flagslovakia` | Flag Slovakia | — (누락) | 슬로바키아 국기 | [src:l10n/en:game-emote_flagslovakia] [H] |
| `emote_flaghungary` | Flag Hungary | — (누락) | 헝가리 국기 | [src:l10n/en:game-emote_flaghungary] [H] |
| `emote_flagromania` | Flag Romania | — (누락) | 루마니아 국기 | [src:l10n/en:game-emote_flagromania] [H] |
| `emote_flaghongkong` | Flag Hong Kong | — (누락) | 홍콩 국기 | [src:l10n/en:game-emote_flaghongkong] [H] |
| `emote_flagindonesia` | Flag Indonesia | — (누락) | 인도네시아 국기 | [src:l10n/en:game-emote_flagindonesia] [H] |
| `emote_flagfinland` | Flag Finland | — (누락) | 핀란드 국기 | [src:l10n/en:game-emote_flagfinland] [H] |
| `emote_flagnorway` | Flag Norway | — (누락) | 노르웨이 국기 | [src:l10n/en:game-emote_flagnorway] [H] |
| `emote_heart` | Heart | — (누락) | 하트 | [src:l10n/en:game-emote_heart] [H] |
| `emote_sleepy` | Zzz | — (누락) | Zzz | [src:l10n/en:game-emote_sleepy] [H] |
| `emote_flex` | Flex | — (누락) | 알통 | [src:l10n/en:game-emote_flex] [H] |
| `emote_angryface` | Angry Face | — (누락) | 화난 얼굴 | [src:l10n/en:game-emote_angryface] [H] |
| `emote_upsidedownface` | Upside Down Face | — (누락) | 뒤집힌 얼굴 | [src:l10n/en:game-emote_upsidedownface] [H] |
| `emote_teabag` | Teabag | — (누락) | 티배그 | [src:l10n/en:game-emote_teabag] [H] |
| `emote_alienface` | Alien Face | — (누락) | 외계인 얼굴 | [src:l10n/en:game-emote_alienface] [H] |
| `emote_flagbelarus` | Flag Belarus | — (누락) | 벨라루스 국기 | [src:l10n/en:game-emote_flagbelarus] [H] |
| `emote_flagbelgium` | Flag Belgium | — (누락) | 벨기에 국기 | [src:l10n/en:game-emote_flagbelgium] [H] |
| `emote_flagkazakhstan` | Flag Kazakhstan | — (누락) | 카자흐스탄 국기 | [src:l10n/en:game-emote_flagkazakhstan] [H] |
| `emote_egg` | Egg | — (누락) | 달걀 | [src:l10n/en:game-emote_egg] [H] |
| `emote_police` | Police Insignia | — (누락) | 경찰 휘장 | [src:l10n/en:game-emote_police] [H] |
| `emote_dabface` | Dab Face | — (누락) | 댑 얼굴 | [src:l10n/en:game-emote_dabface] [H] |
| `emote_flagmalaysia` | Flag Malaysia | — (누락) | 말레이시아 국기 | [src:l10n/en:game-emote_flagmalaysia] [H] |
| `emote_flagnewzealand` | Flag New Zealand | — (누락) | 뉴질랜드 국기 | [src:l10n/en:game-emote_flagnewzealand] [H] |
| `emote_logosurviv` | PARMA | — (누락) | PARMA | [src:l10n/en:game-emote_logosurviv] [H] |
| `emote_logoegg` | The Egg | — (누락) | 달걀 (벙커 로고) | [src:l10n/en:game-emote_logoegg] [H] |
| `emote_logoswine` | The Swine | — (누락) | 돼지 (벙커 로고) | [src:l10n/en:game-emote_logoswine] [H] |
| `emote_logohydra` | The Hydra | — (누락) | 히드라 (벙커 로고) | [src:l10n/en:game-emote_logohydra] [H] |
| `emote_logostorm` | The Storm | — (누락) | 폭풍 (벙커 로고) | [src:l10n/en:game-emote_logostorm] [H] |
| `emote_flaghonduras` | Flag Honduras | — (누락) | 온두라스 국기 | [src:l10n/en:game-emote_flaghonduras] [H] |
| `emote_logocaduceus` | The Caduceus | — (누락) | 카두케우스 (로고) | [src:l10n/en:game-emote_logocaduceus] [H] |
| `emote_impface` | Imp Face | — (누락) | 임프 얼굴 | [src:l10n/en:game-emote_impface] [H] |
| `emote_monocleface` | Monocole Face | — (누락) | 외알 안경 얼굴 | [src:l10n/en:game-emote_monocleface] [H] |
| `emote_sunglassface` | Sunglasses Face | — (누락) | 선글라스 얼굴 | [src:l10n/en:game-emote_sunglassface] [H] |
| `emote_headshotface` | Headshot! | — (누락) | 헤드샷! | [src:l10n/en:game-emote_headshotface] [H] |
| `emote_potato` | Potato | — (누락) | 감자 | [src:l10n/en:game-emote_potato] [H] |
| `emote_tomato` | Tomato (fork) | — (누락) | 토마토 | [src:l10n/en:game-emote_tomato] [H] |
| `emote_leek` | Leek | — (누락) | 대파 | [src:l10n/en:game-emote_leek] [H] |
| `emote_eggplant` | Eggplant | — (누락) | 가지 | [src:l10n/en:game-emote_eggplant] [H] |
| `emote_baguette` | Baguette | — (누락) | 바게트 | [src:l10n/en:game-emote_baguette] [H] |
| `emote_chick` | Chick | — (누락) | 병아리 | [src:l10n/en:game-emote_chick] [H] |
| `emote_flagbolivia` | Flag Bolivia | — (누락) | 볼리비아 국기 | [src:l10n/en:game-emote_flagbolivia] [H] |
| `emote_flagcroatia` | Flag Croatia | — (누락) | 크로아티아 국기 | [src:l10n/en:game-emote_flagcroatia] [H] |
| `emote_flagindia` | Flag India | — (누락) | 인도 국기 | [src:l10n/en:game-emote_flagindia] [H] |
| `emote_flaggeorgia` | Flag Georgia | — (누락) | 조지아 국기 | [src:l10n/en:game-emote_flaggeorgia] [H] |
| `emote_flaggreece` | Flag Greece | — (누락) | 그리스 국기 | [src:l10n/en:game-emote_flaggreece] [H] |
| `emote_flagguatemala` | Flag Guatemala | — (누락) | 과테말라 국기 | [src:l10n/en:game-emote_flagguatemala] [H] |
| `emote_flagportugal` | Flag Portugal | — (누락) | 포르투갈 국기 | [src:l10n/en:game-emote_flagportugal] [H] |
| `emote_flagserbia` | Flag Serbia | — (누락) | 세르비아 국기 | [src:l10n/en:game-emote_flagserbia] [H] |
| `emote_flagsingapore` | Flag Singapore | — (누락) | 싱가포르 국기 | [src:l10n/en:game-emote_flagsingapore] [H] |
| `emote_flagtrinidad` | Flag Trinidad and Tobago | — (누락) | 트리니다드 토바고 국기 | [src:l10n/en:game-emote_flagtrinidad] [H] |
| `emote_flaguruguay` | Flag Uruguay | — (누락) | 우루과이 국기 | [src:l10n/en:game-emote_flaguruguay] [H] |
| `emote_logoconch` | The Conch | — (누락) | 소라 (벙커 로고) | [src:l10n/en:game-emote_logoconch] [H] |
| `emote_pineapple` | Pineapple | — (누락) | 파인애플 | [src:l10n/en:game-emote_pineapple] [H] |
| `emote_coconut` | Coconut | — (누락) | 코코넛 | [src:l10n/en:game-emote_coconut] [H] |
| `emote_crab` | Crab | — (누락) | 게 | [src:l10n/en:game-emote_crab] [H] |
| `emote_whale` | Whale | — (누락) | 고래 | [src:l10n/en:game-emote_whale] [H] |
| `emote_logometeor` | The Meteor | — (누락) | 유성 (벙커 로고) | [src:l10n/en:game-emote_logometeor] [H] |
| `emote_salt` | Salt Shaker | — (누락) | 소금통 | [src:l10n/en:game-emote_salt] [H] |
| `emote_disappointface` | Disappointed Face | — (누락) | 실망한 얼굴 | [src:l10n/en:game-emote_disappointface] [H] |
| `emote_logocrossing` | The Crossing | — (누락) | 건널목 (벙커 로고) | [src:l10n/en:game-emote_logocrossing] [H] |
| `emote_fish` | Fish | — (누락) | 물고기 | [src:l10n/en:game-emote_fish] [H] |
| `emote_campfire` | Campfire | — (누락) | 모닥불 | [src:l10n/en:game-emote_campfire] [H] |
| `emote_chickendinner` | Chicken Dinner | — (누락) | 치킨 디너 | [src:l10n/en:game-emote_chickendinner] [H] |
| `emote_cattle` | Cattle Skull | — (누락) | 소 두개골 | [src:l10n/en:game-emote_cattle] [H] |
| `emote_icecream` | Ice Cream | — (누락) | 아이스크림 | [src:l10n/en:game-emote_icecream] [H] |
| `emote_cupcake` | Cupcake | — (누락) | 컵케이크 | [src:l10n/en:game-emote_cupcake] [H] |
| `emote_donut` | Donut | — (누락) | 도넛 | [src:l10n/en:game-emote_donut] [H] |
| `emote_logohatchet` | The Hatchet | — (누락) | 손도끼 (벙커 로고) | [src:l10n/en:game-emote_logohatchet] [H] |
| `emote_acorn` | Acorn | — (누락) | 도토리 | [src:l10n/en:game-emote_acorn] [H] |
| `emote_trunk` | Tree Trunk | — (누락) | 나무 밑동 | [src:l10n/en:game-emote_trunk] [H] |
| `emote_forest` | Forest | — (누락) | 숲 | [src:l10n/en:game-emote_forest] [H] |
| `emote_pumpkin` | Pumpkin | — (누락) | 호박 | [src:l10n/en:game-emote_pumpkin] [H] |
| `emote_candycorn` | Candy Corn | — (누락) | 캔디 콘 | [src:l10n/en:game-emote_candycorn] [H] |
| `emote_pilgrimhat` | Pilgrim | — (누락) | 청교도 모자 | [src:l10n/en:game-emote_pilgrimhat] [H] |
| `emote_turkeyanimal` | Turkey | — (누락) | 칠면조 | [src:l10n/en:game-emote_turkeyanimal] [H] |
| `emote_heartface` | Heart Face | — (누락) | 하트 얼굴 | [src:l10n/en:game-emote_heartface] [H] |
| `emote_logochrysanthemum` | The Chrysanthemum | — (누락) | 국화 (벙커 로고) | [src:l10n/en:game-emote_logochrysanthemum] [H] |
| `emote_santahat` | Santa Hat | — (누락) | 산타 모자 | [src:l10n/en:game-emote_santahat] [H] |
| `emote_snowman` | Snowman | — (누락) | 눈사람 | [src:l10n/en:game-emote_snowman] [H] |
| `emote_snowflake` | Snowflake | — (누락) | 눈송이 | [src:l10n/en:game-emote_snowflake] [H] |
| `emote_flagmorocco` | Flag Morocco | — (누락) | 모로코 국기 | [src:l10n/en:game-emote_flagmorocco] [H] |
| `emote_flagestonia` | Flag Estonia | — (누락) | 에스토니아 국기 | [src:l10n/en:game-emote_flagestonia] [H] |
| `emote_flagalgeria` | Flag Algeria | — (누락) | 알제리 국기 | [src:l10n/en:game-emote_flagalgeria] [H] |
| `emote_flagegypt` | Flag Egypt | — (누락) | 이집트 국기 | [src:l10n/en:game-emote_flagegypt] [H] |
| `emote_flagazerbaijan` | Flag Azerbaijan | — (누락) | 아제르바이잔 국기 | [src:l10n/en:game-emote_flagazerbaijan] [H] |
| `emote_flagalbania` | Flag Albania | — (누락) | 알바니아 국기 | [src:l10n/en:game-emote_flagalbania] [H] |
| `emote_flaglithuania` | Flag Lithuania | — (누락) | 리투아니아 국기 | [src:l10n/en:game-emote_flaglithuania] [H] |
| `emote_flaglatvia` | Flag Latvia | — (누락) | 라트비아 국기 | [src:l10n/en:game-emote_flaglatvia] [H] |
| `emote_flaguae` | Flag United Arab Emirates | — (누락) | 아랍에미리트 국기 | [src:l10n/en:game-emote_flaguae] [H] |
| `emote_flagdominicanrepublic` | Flag Dominican Republic | — (누락) | 도미니카 공화국 국기 | [src:l10n/en:game-emote_flagdominicanrepublic] [H] |
| `emote_flagpalestine` | Flag Palestine (fork) | — (누락) | 팔레스타인 국기 | [src:l10n/en:game-emote_flagpalestine] [H] |
| `emote_logocloud` | The Cloud | — (누락) | 구름 (벙커 로고) | [src:l10n/en:game-emote_logocloud] [H] |
| `emote_ghost_base` | Ghost | — (누락) | 유령 | [src:l10n/en:game-emote_ghost_base] [H] |
| `emote_bandagedface` | Bandaged Face | — (누락) | 붕대 감은 얼굴 | [src:l10n/en:game-emote_bandagedface] [H] |
| `emote_picassoface` | Picasso Face | — (누락) | 피카소 얼굴 | [src:l10n/en:game-emote_picassoface] [H] |
| `emote_pooface` | Poo Face | — (누락) | 똥 얼굴 | [src:l10n/en:game-emote_pooface] [H] |
| `emote_ok` | Ok | — (누락) | OK | [src:l10n/en:game-emote_ok] [H] |
| `emote_rainbow` | Rainbow | — (누락) | 무지개 | [src:l10n/en:game-emote_rainbow] [H] |
| `emote_logotwins` | The Twins | — (누락) | 쌍둥이 (벙커 로고) | [src:l10n/en:game-emote_logotwins] [H] |
| `emote_flatteredface` | Flattered Face (fork) | — (누락) | 우쭐한 얼굴 | [src:l10n/en:game-emote_flatteredface] [H] |
| `emote_salutingface` | Saluting Face (fork) | — (누락) | 경례하는 얼굴 | [src:l10n/en:game-emote_salutingface] [H] |
| `emote_traumatizedface` | Traumatized Face (fork) | — (누락) | 충격받은 얼굴 | [src:l10n/en:game-emote_traumatizedface] [H] |
| `emote_screamingface` | Screaming Face (fork) | — (누락) | 비명 지르는 얼굴 | [src:l10n/en:game-emote_screamingface] [H] |

### 설명문 (lore)

- en.json에는 의상·근접 무기 설명문(lore) 키가 20개 있고 (`outfitBase-lore`, `outfitTurkey-lore`, `outfitDev-lore`, `outfitMaintainer-lore`, `outfitGD-lore`, `outfitMod-lore`, `outfitParma-lore`, `outfitParmaPrestige-lore`, `outfitWoodland-lore`, `outfitKeyLime-lore`, `outfitCobaltShell-lore`, `outfitCarbonFiber-lore`, `outfitDarkGloves-lore`, `outfitDarkShirt-lore`, `outfitCamo-lore`, `outfitRed-lore`, `outfitWhite-lore`, `fists-lore`, `knuckles_rusted-lore`, `knuckles_heroic-lore`), ko.json에는 하나도 없다 [src:l10n/en:game-outfitBase-lore, l10n/en:game-fists-lore] [H]

### ko.json에만 있는 키

| 키 (survev id) | English (en.json) | 한국어 (ko.json) | 리버스 표기 | 출처 |
|---|---|---|---|---|
| `index-facebook` | (현재 en.json에 없음; 원본: Facebook) | Facebook | = | [src:l10n/ko:index-facebook, derived/git-a14ab228] [H] |
| `index-proxy-sites` | (현재 en.json에 없음; 원본: proxy sites) | 프록시 사이트 | = | [src:l10n/ko:index-proxy-sites, derived/git-a14ab228] [H] |
| `loadout-instagram-follow` | (현재 en.json에 없음; 원본: +15 XP) | +15 XP | = | [src:l10n/ko:loadout-instagram-follow, derived/git-a14ab228] [H] |
| `loadout-instagram-reward` | (현재 en.json에 없음; 원본: Follow us on Instagram and get 15 Pass XP!) | 저희 Instagram을 팔로우하시고 15 Pass XP를 얻으세요! | = | [src:l10n/ko:loadout-instagram-reward, derived/git-a14ab228] [H] |
| `loadout-youtube-subscribe` | (현재 en.json에 없음; 원본: +15 XP) | +15 XP | = | [src:l10n/ko:loadout-youtube-subscribe, derived/git-a14ab228] [H] |
| `loadout-youtube-reward` | (현재 en.json에 없음; 원본: Subscribe to us on YouTube and get 15 Pass XP!) | 저희 YouTube 채널을 구독하시고 15 Pass XP를 얻으세요! | = | [src:l10n/ko:loadout-youtube-reward, derived/git-a14ab228] [H] |
| `loadout-twitter-follow` | (현재 en.json에 없음; 원본: +15 XP) | +15 XP | = | [src:l10n/ko:loadout-twitter-follow, derived/git-a14ab228] [H] |
| `loadout-twitter-reward` | (현재 en.json에 없음; 원본: Follow us on Twitter and get 15 Pass XP!) | 저희 Twitter를 팔로우하시고 15 Pass XP를 얻으세요! | = | [src:l10n/ko:loadout-twitter-reward, derived/git-a14ab228] [H] |
| `loadout-facebook-like` | (현재 en.json에 없음; 원본: +15 XP) | +15 XP | = | [src:l10n/ko:loadout-facebook-like, derived/git-a14ab228] [H] |
| `loadout-facebook-reward` | (현재 en.json에 없음; 원본: Like us on Facebook and get 15 Pass XP!) | 저희 Facebook에서 좋아요를 누르시고 15 Pass XP를 얻으세요! | = | [src:l10n/ko:loadout-facebook-reward, derived/git-a14ab228] [H] |
| `game-outifitBeachCamo` | (오타 키; en은 `game-outfitBeachCamo` = Beach Shored) | 해변가 † | = | [src:l10n/ko:game-outifitBeachCamo] [H] |
| `bind-move-left` | Move Left (inputBinds.ts) | 왼쪽으로 이동 † | = | [src:l10n/ko:bind-move-left, survev/client/src/inputBinds.ts:27] [H] |
| `bind-move-right` | Move Right (inputBinds.ts) | 오른쪽으로 이동 † | = | [src:l10n/ko:bind-move-right, survev/client/src/inputBinds.ts:27] [H] |
| `bind-move-up` | Move Up (inputBinds.ts) | 위로 이동 † | = | [src:l10n/ko:bind-move-up, survev/client/src/inputBinds.ts:27] [H] |
| `bind-move-down` | Move Down (inputBinds.ts) | 아래로 이동 † | = | [src:l10n/ko:bind-move-down, survev/client/src/inputBinds.ts:27] [H] |
| `bind-fire` | Fire (inputBinds.ts) | 발사 † | = | [src:l10n/ko:bind-fire, survev/client/src/inputBinds.ts:27] [H] |
| `bind-reload` | Reload (inputBinds.ts) | 재장전 † | = | [src:l10n/ko:bind-reload, survev/client/src/inputBinds.ts:27] [H] |
| `bind-cancel` | Cancel (inputBinds.ts) | 취소 † | = | [src:l10n/ko:bind-cancel, survev/client/src/inputBinds.ts:27] [H] |
| `bind-interact` | Interact (inputBinds.ts) | 상호작용 † | = | [src:l10n/ko:bind-interact, survev/client/src/inputBinds.ts:27] [H] |
| `bind-revive` | Revive (inputBinds.ts) | 부활시키기 † | 소생시키기 | [src:l10n/ko:bind-revive, survev/client/src/inputBinds.ts:27] [H] |
| `bind-open-use` | Open/Use (inputBinds.ts) | 열기/사용 † | = | [src:l10n/ko:bind-open-use, survev/client/src/inputBinds.ts:27] [H] |
| `bind-loot` | Loot (inputBinds.ts) | 전리품 † | 아이템 줍기 | [src:l10n/ko:bind-loot, survev/client/src/inputBinds.ts:27] [H] |
| `bind-equip-primary` | Equip Primary (inputBinds.ts) | 주무기 장착 † | = | [src:l10n/ko:bind-equip-primary, survev/client/src/inputBinds.ts:27] [H] |
| `bind-equip-secondary` | Equip Secondary (inputBinds.ts) | 보조무기 장착 † | = | [src:l10n/ko:bind-equip-secondary, survev/client/src/inputBinds.ts:27] [H] |
| `bind-equip-melee` | Equip Melee (inputBinds.ts) | 근접무기 장착 † | = | [src:l10n/ko:bind-equip-melee, survev/client/src/inputBinds.ts:27] [H] |
| `bind-equip-throwable` | Equip Throwable (inputBinds.ts) | 투척무기 장착 † | = | [src:l10n/ko:bind-equip-throwable, survev/client/src/inputBinds.ts:27] [H] |
| `bind-equip-next-weapon` | Equip Next Weapon (inputBinds.ts) | 다음 무기 장착 † | = | [src:l10n/ko:bind-equip-next-weapon, survev/client/src/inputBinds.ts:27] [H] |
| `bind-equip-previous-weapon` | Equip Previous Weapon (inputBinds.ts) | 이전 무기 장착 † | = | [src:l10n/ko:bind-equip-previous-weapon, survev/client/src/inputBinds.ts:27] [H] |
| `bind-equip-last-weapon` | Equip Last Weapon (inputBinds.ts) | 마지막 무기 장착 † | = | [src:l10n/ko:bind-equip-last-weapon, survev/client/src/inputBinds.ts:27] [H] |
| `bind-stow-weapons` | Stow Weapons (inputBinds.ts) | 무기 집어넣기 † | = | [src:l10n/ko:bind-stow-weapons, survev/client/src/inputBinds.ts:27] [H] |
| `bind-equip-previous-scope` | Equip Previous Scope (inputBinds.ts) | 이전 조준경 장착 † | 이전 스코프 장착 | [src:l10n/ko:bind-equip-previous-scope, survev/client/src/inputBinds.ts:27] [H] |
| `bind-equip-next-scope` | Equip Next Scope (inputBinds.ts) | 다음 조준경 장착 † | 다음 스코프 장착 | [src:l10n/ko:bind-equip-next-scope, survev/client/src/inputBinds.ts:27] [H] |
| `bind-use-bandage` | Use Bandage (inputBinds.ts) | 붕대 사용 † | = | [src:l10n/ko:bind-use-bandage, survev/client/src/inputBinds.ts:27] [H] |
| `bind-use-med-kit` | Use Med Kit (inputBinds.ts) | 구급상자 사용 † | = | [src:l10n/ko:bind-use-med-kit, survev/client/src/inputBinds.ts:27] [H] |
| `bind-use-soda` | Use Soda (inputBinds.ts) | 소다 사용 † | = | [src:l10n/ko:bind-use-soda, survev/client/src/inputBinds.ts:27] [H] |
| `bind-use-pills` | Use Pills (inputBinds.ts) | 알약 사용 † | = | [src:l10n/ko:bind-use-pills, survev/client/src/inputBinds.ts:27] [H] |
| `bind-switch-gun-slots` | Switch Gun Slots (inputBinds.ts) | 총기 슬롯 전환 † | = | [src:l10n/ko:bind-switch-gun-slots, survev/client/src/inputBinds.ts:27] [H] |
| `bind-toggle-map` | Toggle Map (inputBinds.ts) | 지도 전환 † | = | [src:l10n/ko:bind-toggle-map, survev/client/src/inputBinds.ts:27] [H] |
| `bind-toggle-minimap` | Toggle Minimap (inputBinds.ts) | 미니맵 전환 † | = | [src:l10n/ko:bind-toggle-minimap, survev/client/src/inputBinds.ts:27] [H] |
| `bind-emote-menu` | Emote Menu (inputBinds.ts) | 이모티콘 메뉴 † | = | [src:l10n/ko:bind-emote-menu, survev/client/src/inputBinds.ts:27] [H] |
| `bind-team-ping-hold` | Team Ping Hold (inputBinds.ts) | 팀 핑 (길게 누름) † | = | [src:l10n/ko:bind-team-ping-hold, survev/client/src/inputBinds.ts:27] [H] |
| `bind-equip-other-gun` | Equip Other Gun (inputBinds.ts) | 다른 총 장착 † | = | [src:l10n/ko:bind-equip-other-gun, survev/client/src/inputBinds.ts:27] [H] |
| `bind-full-screen` | Full Screen (inputBinds.ts) | 전체 화면 † | = | [src:l10n/ko:bind-full-screen, survev/client/src/inputBinds.ts:27] [H] |
| `bind-hide-ui` | Hide UI (inputBinds.ts) | UI 숨기기 † | = | [src:l10n/ko:bind-hide-ui, survev/client/src/inputBinds.ts:27] [H] |
| `bind-team-ping-menu` | Team Ping Menu (inputBinds.ts) | 팀 핑 메뉴 † | = | [src:l10n/ko:bind-team-ping-menu, survev/client/src/inputBinds.ts:27] [H] |
| `Left Mouse` | Left Mouse (키 이름 자체) | 왼쪽 마우스 버튼 † | = | [src:l10n/ko:Left Mouse] [H] |
| `Right Mouse` | Right Mouse (키 이름 자체) | 오른쪽 마우스 버튼 † | = | [src:l10n/ko:Right Mouse] [H] |
| `Mouse Wheel Up` | Mouse Wheel Up (키 이름 자체) | 마우스 휠 위 † | = | [src:l10n/ko:Mouse Wheel Up] [H] |
| `Mouse Wheel Down` | Mouse Wheel Down (키 이름 자체) | 마우스 휠 아래 † | = | [src:l10n/ko:Mouse Wheel Down] [H] |

## Conflicts

- CONFLICT l10n-medic-term: 50v50 Medic(`medic`) 현재 ko "의사" [src:l10n/ko:game-medic] vs 원본 번역 "위생병" [src:derived/git-a14ab228] vs 나무위키 "의무병" [src:namu/Surviv.io/이벤트]; proposed: "위생병" (원본 복원, 퍽 "전투 의무병"·코발트 "메딕"과 구분) [L]
- CONFLICT l10n-scout-recon: `recon`과 `scout`가 모두 "정찰병" [src:l10n/ko:game-recon, l10n/ko:game-scout] vs 나무위키도 둘 다 "정찰병" [src:namu/Surviv.io/이벤트, namu/Surviv.io/직업]; proposed: recon=정찰병, scout=스카우트 [L]
- CONFLICT l10n-marksman-term: ko "명사수" [src:l10n/ko:game-marksman] vs 나무위키 "마크스맨" [src:namu/Surviv.io/이벤트]; proposed: UI는 "명사수", 문서·검색 별칭으로 "마크스맨" [L]
- CONFLICT l10n-bugler-term: ko "나팔수" [src:l10n/ko:game-bugler] vs 나무위키 "나팔병" [src:namu/Surviv.io/이벤트]; proposed: "나팔수" 유지 [L]
- CONFLICT l10n-epic-rarity: ko epic "전설" [src:l10n/ko:loadout-epic] vs 나무위키 "영웅" [src:namu/Surviv.io/의류]; proposed: "영웅" (전설은 legendary로 오해) [L]
- CONFLICT l10n-backpack-names: ko "큰 가방/밀리터리 가방" [src:l10n/ko:game-backpack02, l10n/ko:game-backpack03] vs 나무위키 "보통 가방/군용 가방" [src:namu/Surviv.io/장비]; proposed: "보통 가방/군용 가방" [L]
- CONFLICT l10n-mode-names: 로비 "개인전/2인 팀전/분대(4명)" [src:l10n/ko:index-solo, l10n/ko:index-squad] vs 퀘스트·원본 번역·나무위키 "솔로/듀오/스쿼드" [src:l10n/ko:quest_top_solo, namu/Surviv.io, derived/git-4d5acbc8]; proposed: 솔로/듀오/스쿼드 [L]
- CONFLICT l10n-revive-term: "소생" [src:l10n/ko:game-reviving] vs "부활" [src:l10n/ko:index-revive, l10n/ko:bind-revive]; proposed: "소생" 통일 [L]
- CONFLICT l10n-healing-tooltip-75: 툴팁 "75를 넘어 치료할 수 없습니다" [src:l10n/en:game-healing-tooltip, l10n/ko:game-healing-tooltip] vs 붕대 maxHeal 100(0.7.1부터) [src:survev/shared/defs/gameObjects/gearDefs.ts:393, changelog/0.7.1]; proposed: 정의값 100을 따르고 툴팁은 쓰지 않음 [L]
- CONFLICT l10n-flak-jacket-name: ko·나무위키 모두 "방탄 조끼" [src:l10n/ko:game-flak_jacket, namu/Surviv.io/이벤트] vs 효과는 폭발·파편 감쇠이고 조끼 장비와 이름이 겹침 [src:l10n/en:game-flak_jacket-desc, l10n/ko:game-chest01]; proposed: "방폭 재킷" (검색 별칭 "방탄 조끼") [L]

## Open questions

- a14ab228의 ko.json("survivreloaded-client"에서 가져옴)이 원작 0.8.82 클라이언트의 ko.json과 바이트 단위로 같은지 확인하지 못했다; 2026 재출시 클라이언트 번들에서 ko.json을 받아 비교하면 확정된다 [src:derived/git-a14ab228, kong/relaunch-client-defs] [L]
- 원작에 이모트·조준선 한국어 이름이 있었는지 알 수 없다 (2024 import 시점에도 키가 없었음) [src:derived/git-a14ab228] [L]
- "특전" vs "퍽": 공식 파일은 설명문 안에서만 "특전"을 쓰고 퍽 목록 제목 문자열은 없다; 리버스 UI에 어느 쪽을 노출할지 사용자 테스트가 필요하다 [src:l10n/ko:game-trick_nothing-desc, namu/Surviv.io/이벤트] [L]
- 상자 나무(Tree Cache)의 survev id를 이 조사에서 특정하지 못했다 [src:namu/Surviv.io/오브젝트] [L]
