# 나무위키 (namu.wiki) Surviv.io 문서 정리

> 나무위키는 Cloudflare 챌린지 때문에 직접 열 수 없다. 이 파일의 모든 namu 사실은 WebSearch(allowed_domains: namu.wiki) 결과 스니펫에서 나왔고, 스니펫은 검색 요약기가 다시 쓴 문장이다 (2026-10-05, 질의 약 60회).
> 규칙: `namu` 단독 출처는 최대 [M]. 요약이 모호하거나 다른 판(revision)·다른 출처와 어긋나면 [L]. survev 소스로 같은 값이 확인되면 survev 인용을 덧붙여 [H].
> 하위 문서를 특정할 수 없는 스니펫은 검색 결과 URL 목록에서 가장 가능성 높은 문서를 골랐고, 그런 줄은 [L]로 낮췄다.
> 수치 비교: namu 수치가 survev와 다르고 survev `balance.txt`가 그 항목을 fork 변경으로 적고 있으면, namu 값은 원작(0.8.82) 값의 독립 증거로 취급한다.

## 문서 목록과 접근 경로

- 나무위키에는 본문서 `Surviv.io`와 하위 문서 `Surviv.io/무기`, `/팁`, `/이벤트`, `/장비`, `/의료품`, `/의류`, `/건물`, `/오브젝트`, `/이모트`가 있다 [src:namu/Surviv.io, namu/Surviv.io/무기, namu/Surviv.io/팁, namu/Surviv.io/이벤트] [M]
- 하위 문서 `Surviv.io/직업`도 존재하며 en.namu.wiki 기계번역 미러("Surviv.io/Job")로 검색된다 [src:namu/Surviv.io/직업] [M]
- 무기 요약 틀 `틀:Surviv.io/무기 정리`가 있고 검색된 판은 r13이다 [src:namu/틀:Surviv.io/무기_정리] [M]
- 별도 문서 `SURVIV.IO 마이너 갤러리`(디시인사이드 갤러리 문서, r45 판 확인)가 있다 [src:namu/SURVIV.IO_마이너_갤러리] [M]
- 검색에 잡힌 본문서 판은 r1819 ~ r2919, `/무기`는 r1193 ~ r1852, `/팁`은 r180·r257, `/이벤트`는 r570이다 [src:namu/Surviv.io, namu/Surviv.io/무기, namu/Surviv.io/팁, namu/Surviv.io/이벤트] [M]
- en.namu.wiki에 본문서, `/무기`, `/팁`, `/이벤트`, `/이모트`, `/오브젝트`, `/의류`, `/직업`의 영어 기계번역 미러가 있다 [src:namu/Surviv.io/이모트, namu/Surviv.io/무기] [M]
- 나무위키에 `survev.io` 단독 문서는 검색되지 않았고, survev 관련 서술은 본문서 `Surviv.io` 안에 있다 [src:namu/Surviv.io] [L]

## Surviv.io (본문서)

### 개요

- PUBG·포트나이트·H1Z1과 비슷한 2D 배틀로얄로, "2D 배그"로 불린다 [src:namu/Surviv.io] [M]
- 개발자는 Justin Kim과 Nick Clark 두 사람이며, 배틀그라운드 성공 이후 나온 여러 웹 게임 중 하나로 소개된다 [src:namu/Surviv.io, wp-en/Surviv.io] [H]
- 개인·2인·4인 팀이 무기·탄약·아이템을 모으며 줄어드는 레드존(자기장)을 피해 마지막 한 팀이 남을 때까지 싸운다 [src:namu/Surviv.io] [M]
- PC와 모바일 모두에서 플레이할 수 있다 [src:namu/Surviv.io] [M]
- 공식 한국어 클라이언트도 슬로건을 "2D 배틀 로얄", 도움말 제목을 "2D PUBG"로 적는다 [src:l10n/ko:index-slogan, l10n/ko:index-tips-2] [H]

### 게임 모드·인원

- 기본 모드는 솔로(개인)·듀오(2인)·스쿼드(4인)이다 [src:namu/Surviv.io] [M]
- 솔로는 서비스 시작 때부터 있던 기본 모드로, 팀원 실력·팀워크 없이 본인의 운과 실력으로만 겨룬다 [src:namu/Surviv.io] [M]
- 한 게임 최대 인원은 80명이다 [src:namu/Surviv.io] [M]
- 맵이 다른 배틀로얄보다 좁아서 초반에 절반 넘는 플레이어가 죽는 경우가 많다 [src:namu/Surviv.io] [M]
- 후기(서술 시점)에는 클래식 솔로 인원이 30명을 넘지 않고 듀오·스쿼드는 거의 없었으며, 플레이어 대부분이 매일 바뀌는 이벤트 모드를 했다 [src:namu/Surviv.io] [M]

### 서버

- 서버 지역은 북미·남미·유럽·아시아·대한민국이다 (한 판본은 러시아를 더해 6개로 적는다) [src:namu/Surviv.io] [L]
- survev 클라이언트는 러시아를 포함한 6개 지역 문자열을 갖지만 `index-russia`는 survev가 2025-12-16에 추가한 키이고, 원본 문자열(2024-02 import)에는 북미·유럽·아시아·남미·한국 5개만 있다 [src:l10n/ko:index-russia, l10n/ko:index-korea, derived/git-cc2b58c9, derived/git-a14ab228] [H]
- fandom도 지역을 5개(NA·SA·EU·AS·KR)로 적고, KR은 서울(SEL) 존 하나다 [src:fandom/Servers] [M]
- 동시접속은 평균적으로 북미가 가장 많고 유럽·아시아가 뒤를 잇고, 러시아·남미가 가장 적지만 시간대에 따라 크게 달라진다 [src:namu/Surviv.io] [M]
- 아시아 서버는 아시아권 저녁 시간과 주말에, 한국 서버는 한국 저녁·주말에 인원이 크게 는다 [src:namu/Surviv.io] [M]
- 아시아 서버에는 실력자가 비교적 많아 신규 유저에게 어렵다; 다른 서버는 핑 문제가 있어 아시아 유저가 "혹독한 훈련"을 거쳐 자연스럽게 실력자가 된다고 서술한다 [src:namu/Surviv.io] [M]
- 아시아 서버는 2022-11-23, 대한민국 서버는 2023-01-04에 폐쇄되었다 [src:namu/Surviv.io] [M]
- 2023-01-02에 접속 불가 사태가 있었고 그 과정에서 대한민국 서버가 폐쇄되었다 [src:namu/Surviv.io] [M]
- 두 서버는 이후 survev.io 등장과 함께 복구되었다고 서술한다 [src:namu/Surviv.io] [L]

### 클랜·커뮤니티 (요약, 자세한 내용은 community-ko.md)

- CBS: 한국 최상위 유저 KRNumber1이 만든 클랜으로, 전원 한국인이며 "한국 1위 클랜"으로 소개된다 [src:namu/Surviv.io] [M]
- KOR: 2021년 Surviv.io 아시아 클랜 대회를 위해 한국 상위 10명만 모아 만든 클랜으로, 대회 1위를 하고 대회 후 해체했다 [src:namu/Surviv.io] [M]
- 유저 클랜은 주로 디스코드·네이버 카페·밴드에서 활동한다 [src:namu/Surviv.io] [M]
- 디시인사이드 Surviv.io 마이너 갤러리와 클랜 커뮤니티는 사이가 나쁘며 예전부터 티밍 문제로 다퉈 왔다 [src:namu/Surviv.io] [M]
- 솔로에서 국기 이모트 등으로 같은 나라 유저끼리 팀을 맺어 몰려다니는 "티밍"이 종종 있고, 불법이라 단정하긴 어렵지만 사회적 인식은 나쁘다 [src:namu/Surviv.io] [M]
- 한국 유튜버 "Surviv Serin"(구독자 약 2.14천 명)은 한국 공식 최고 킬 기록 보유자이며 Mk Hero 등 다른 한국 유튜버를 가르쳤다고 서술된다 [src:namu/Surviv.io] [L]

### 핵(치트)

- 크롬 확장 프로그램 형태의 핵이 퍼졌고, 심하면 한 판에 핵 사용자가 3명까지 보인다 [src:namu/Surviv.io] [M]
- 흔한 핵 기능: 자동 아이템 줍기(파밍), 공습·수류탄·연막탄 효과 범위 표시, 플레이어 이름 표시, 아군·적의 탄 퍼짐 표시 [src:namu/Surviv.io] [M]
- 신고는 계정이 있어야 하며, 관전으로 영상 증거를 모으고 계정 매치 기록에서 핵 사용자 이름을 캡처해 공식 디스코드에 제보하는 방식이다 [src:namu/Surviv.io] [M]
- 디스코드의 전적 조회 봇이 고장 나 신고가 무력해졌고, 로그인하지 않은 핵 사용자는 신고할 수도 없다 [src:namu/Surviv.io] [M]
- 2025년 기준, survev.io가 원작을 대체한 뒤 "2판 중 1판"꼴로 핵이 나온다는 서술이 있다 (편집자 의견에 가까움) [src:namu/Surviv.io] [L]

### 운영사·쇠퇴·부활

- Nick과 Justin이 게임을 Kongregate에 팔았고 이후 업데이트를 Kongregate가 맡았다 [src:namu/Surviv.io, wp-en/Surviv.io] [H]
- 인수 후 Kongregate는 운영에 안일했고 스킨과 서바이버 패스에만 집중했으며, 운영·업데이트 질이 두 개발자 시절보다 나쁘다고 평가된다 [src:namu/Surviv.io] [M]
- 2022년 하반기부터 대규모 오류와 늦은 대응이 이어져 급격히 몰락했고, 동접이 많던 북미 서버조차 100명을 겨우 넘었다 [src:namu/Surviv.io] [M]
- 서비스 종료 선언일을 2023-02-14로 적는다 (영문 위키·fandom은 2023-02-13 발표, 2023-03-02 종료) [src:namu/Surviv.io, wp-en/Surviv.io] [L]
- 2024년 12월 기준 surviv.io 도메인은 전혀 다른 io 게임 사이트로 리디렉션되었다 [src:namu/Surviv.io] [M]
- 한 팬이 철자 한 글자를 바꾼 "survev.io"로 게임을 부활시켰다; 판에 따라 2024년 9월 또는 10월로 적는다 [src:namu/Surviv.io] [L]
- 2026-03-26 Kongregate가 surviv.io 도메인으로 공식 재서비스를 시작했다고 적는다 [src:namu/Surviv.io] [M]
- 재서비스 복구 시점(2026-03-21) 기준 옛 계정 데이터가 모두 사라졌고, Kongregate 인수 이후 업데이트된 콘텐츠는 플레이할 수 없다고 적는다 [src:namu/Surviv.io] [M]
- 재서비스 빌드가 0.8.82 체인지로그를 그대로 싣고 0.9.0(2026-03-26)부터 이어진다는 점은 관측으로 확인된다 [src:kong/relaunch-changelog] [H]

## Surviv.io/무기

### 분류

- 탄약별로 9mm, 12게이지, 7.62mm, 5.56mm, .50 AE, .308 아음속, .45 ACP, 40mm, 신호탄(플레어), 감자 탄약 무기를 나누고 근접·투척 무기를 따로 다룬다 [src:namu/Surviv.io/무기] [M]
- 사막·숲·겨울·50 vs 50 이벤트 전용 무기 항목이 따로 있다 [src:namu/Surviv.io/무기] [M]
- 9mm는 노란 테두리, .45 ACP는 보라 테두리, M79의 40mm는 민트색 테두리로 표시된다 [src:namu/Surviv.io/무기] [M]
- 9mm는 가장 흔한 탄으로 가볍고 많이 들 수 있지만 한 발 피해가 낮다 [src:namu/Surviv.io/무기] [M]
- 5.56mm는 가방 없이 90발, 3레벨 가방으로 300발까지 들 수 있다 [src:namu/Surviv.io/무기, survev/shared/gameConfig.ts:418] [H]
- 사막 이벤트와 사바나에서는 9mm 대신 .45 ACP가 대량으로 나온다 [src:namu/Surviv.io/무기] [M]
- 헤드샷은 15% 확률로 발생하며 기본 2배, 샷건(MP220·SPAS-12·M870·Saiga-12)과 저격총은 1.5배다 [src:namu/Surviv.io/무기, namu/Surviv.io/팁, survev/shared/gameConfig.ts:200] [H]

### 9mm

- M9: 반자동 권총, 극초반에 가장 흔히 보이는 무기 [src:namu/Surviv.io/무기] [M]
- MP5: 가장 찾기 쉬운 SMG 중 하나, 탄이 흔하고 성능이 균형 잡혀 입문용, 9mm치고 명중률·사거리가 좋다 [src:namu/Surviv.io/무기] [M]
- UMP9: 3점사 SMG [src:namu/Surviv.io/무기] [M]
- MAC-10: 자동 SMG, 입문자에게 적합 [src:namu/Surviv.io/무기] [M]
- Vector: MAC-10의 상위호환 자동 SMG, 연사력·피해가 높고 재장전이 짧고 명중률이 좋다 [src:namu/Surviv.io/무기] [M]
- CZ-3A1: 커뮤니티 업데이트로 처음 나온 고성능 SMG, 빠른 연사·높은 명중률, 소음기로 조용하고 탄이 반투명하다 [src:namu/Surviv.io/무기] [M]
- G18C 단발: 장탄 17, 피해 9, 탄속 70, 사거리 44, 재장전 1.95초, 연사 16.67발/초, 탄퍼짐 12, DPS 150 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:2410] [H]
- 듀얼 G18C: 장탄 34, 재장전 3.8초, 연사 33.33발/초, DPS 300으로 게임에서 가장 빠른 총이며 최상위 DPS [src:namu/Surviv.io/무기] [M]
- 듀얼 G18C는 탄퍼짐이 심해 근접전 외에는 쓰기 어렵고, 장탄은 MAC-10보다 2발 많지만 재장전이 3초를 넘어 교전 중 두 탄창을 돌리기 어렵다 [src:namu/Surviv.io/무기] [M]

### 12게이지

- M870: 펌프액션, 피해 12.5×9, 장탄 5, MP220과 같은 피해 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:1761] [H]
- Saiga-12: M870의 5발 장탄과 MP220의 연사력을 합친 반자동 산탄총으로 전체 DPS 3위 [src:namu/Surviv.io/무기] [M]
- SPAS-12: 2018-06-22 업데이트로 추가된 펌프액션 "유사 저격총", 플레셰트 탄이라 탄퍼짐이 매우 적고 탄속이 빠르며 사거리가 길다 (원작 체인지로그는 0.4.2, 2018-06-21; 하루 차이는 시차로 보임) [src:namu/Surviv.io/무기, changelog/0.4.2, survev/shared/defs/gameObjects/gunDefs.ts:1957] [H]
- SPAS-12의 거리별 피해 감소(falloff) 계수를 85%로 적는다 [src:namu/Surviv.io/무기] [L]
- 12게이지 산탄총은 중거리에서 가장 강하고, 너무 붙으면 총신 길이 때문에 펠릿이 대상에 닿지 않는다 (이전 조사 리드, 이번 스니펫에서는 미확인) [src:namu/Surviv.io/무기] [L]
- USAS-12: 숲 모드에서 나온 완전자동 산탄총으로 "OP 3대장" 중 하나, 느린 빨간 탄 하나가 조준점에서 폭발해 수류탄처럼 범위 피해와 파편을 낸다 [src:namu/Surviv.io/무기] [M]

### 7.62mm

- AK-47: 장탄 30, 피해 13.5, 탄속 100, 사거리 200, 재장전 2.5초, 10발/초, 탄퍼짐 2.5, DPS 135 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:824] [H]
- DP-28: LMG, 장탄 60, 피해 14, 탄속 110, 사거리 225, 재장전 3.3초, 8.7발/초, 탄퍼짐 2, DPS 121.74 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:1113] [H]
- SCAR-H: 장탄 20, 피해 15, 탄속 108, 사거리 175, 재장전 2.7초, 11.11발/초, 탄퍼짐 2, DPS 166.67 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:871] [H]
- AN-94: 2점사, 장탄 45, 피해 17.5, 탄속 110, 사거리 300, 재장전 2.35초, 8.33발/초, 탄퍼짐 1.5, DPS 145.83 [src:namu/Surviv.io/무기] [M]
- AN-94의 namu 피해 17.5·탄속 110은 survev balance.txt가 적은 원작 값과 같다 (survev는 20·120으로 상향) [src:namu/Surviv.io/무기, balance/6, balance/7, survev/shared/defs/gameObjects/gunDefs.ts:965] [H]
- AN-94는 50v50과 사막 이벤트에만 나오며 50v50에서 (청팀) 지휘관에게 주어진다 [src:namu/Surviv.io/무기, namu/Surviv.io/이벤트] [M]
- Groza: 장탄 30, 피해 12.5, 탄속 104, 사거리 175, 재장전 2.8초, 12.82발/초, 탄퍼짐 5, DPS 160.26 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:1015] [H]
- Mosin-Nagant: 첫 볼트액션 저격총, 피해 72, 장탄 5, 탄속 178, 사거리 500; 빈 탄창은 클립으로 5발을 한 번에, 몇 발 쏜 뒤에는 한 발씩 장전한다 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:1461] [H]
- SV-98: 두 번째 볼트액션 저격총이자 모신의 완벽한 상위호환, 피해 80, 장탄 10, 탄속 182, 사거리 520, 0.67발/초 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:1516] [H]
- M134 미니건: "반자동"(원문 표기), 장탄 200, 피해 10, 탄속 130, 재장전 8초, 18.18발/초, 7.62 화기 중 PKP·M249급 화력 [src:namu/Surviv.io/무기] [L]
- SVD-63(드라구노프 계열 DMR), BLR 81(레버액션), Mk 20 SSR(DMR)은 2019-09-12 퍽 시스템 업데이트와 함께 추가되었다 [src:namu/Surviv.io/이벤트, changelog/0.8.3] [H]

### 5.56mm

- M416: 완전자동 AR, 장탄 30, 피해 11, DPS 146.67 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:480] [H]
- FAMAS: 3점사 AR, 장탄 25, 피해 17, DPS 145.71 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:429] [H]
- Mk 12 SPR: 반자동 DMR, 장탄 20, 피해 22.5, DPS 125 [src:namu/Surviv.io/무기] [M]
- Mk 12의 namu 피해 22.5는 survev balance.txt의 원작 값과 같다 (survev는 23) [src:namu/Surviv.io/무기, balance/49, survev/shared/defs/gameObjects/gunDefs.ts:575] [H]
- M249: 완전자동 LMG, 장탄 100, 피해 14, DPS 175 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:669] [H]
- 나무위키는 M249를 "게임에서 가장 희귀한 총"이라 적지만, 원작 0.7.5 뉴스는 일반 게임에서 PKP가 M249보다 더 희귀하다고 적는다 [src:namu/Surviv.io/무기, fandom/Changelog] [L]
- QBB-97: 불펍 LMG, 75발 드럼, 피해 14, DPS 140; 장탄은 M249의 75%지만 재장전은 3.9초로 M249(6.7초)의 58% [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:720] [H]
- SV-98·AWM-S·M79·M249가 (서술 시점) 가장 강한 무기로 꼽힌다 [src:namu/Surviv.io/무기] [M]

### .45 ACP·.308·40mm·기타

- Peacemaker: 리볼버, 장탄 6(듀얼 12), 피해 29, 탄속 106, 사거리 110; 빠르게 클릭하면 단발, 누르고 있으면 패닝으로 연사한다 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:2806] [H]
- M1911: 반자동 권총, 장탄 7(듀얼 14), 피해 14, 탄속 80, 사거리 88, "Surviv.io 역사상 최악의 총" [src:namu/Surviv.io/무기] [M]
- M1911의 namu 피해 14는 survev balance.txt의 원작 값과 같다 (survev는 16) [src:namu/Surviv.io/무기, balance/28, survev/shared/defs/gameObjects/gunDefs.ts:2905] [H]
- Model 94, Peacemaker, M1911, M1A1, Vector(.45 ACP)는 사막 이벤트 무기다 [src:namu/Surviv.io/무기] [M]
- AWM-S: 세 번째 저격총, 피해 180, 장탄 5, 탄속 136, 사거리 300, 0.67발/초; 저격총치고 탄속이 느려 조준이 어렵다 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:1567] [H]
- AWM-S 스프라이트는 AE 모델 기반이고 내부 ID는 "AWC"다 (이전 조사 리드) [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/gunDefs.ts:1567] [M]
- M79: 40mm를 쓰는 유일한 무기, 폭발 범위가 매우 넓고 물체에 맞지 않으면 1.3초 뒤 자동 폭발한다 [src:namu/Surviv.io/무기] [M]
- 감자 대포(포테이토 캐논)도 특수 무기로 다뤄진다 [src:namu/Surviv.io/무기] [M]
- 레이저 이벤트의 레이저 건은 12게이지를 쓰고 탄이 물체에 맞으면 튕긴다 [src:namu/Surviv.io/이벤트] [M]

### 근접 무기

- 카타나: 피해 40, 장애물 피해 60(배율 1.5), 초당 2.5회(쿨다운 0.4초), DPS 100 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/meleeDefs.ts:628] [H]
- 카타나는 가로 리치가 나기나타 다음으로 길어 전방 약 110°에 동시에 닿는다 [src:namu/Surviv.io/무기] [M]
- 카타나는 온실 아래 벙커 깊은 비밀방과 찻집에서(확률) 나온다 [src:namu/Surviv.io/무기] [M]
- 마체테: 피해 33, 장애물 피해 33, 초당 3.33회, DPS 110; 카타나보다 DPS는 높지만 장애물 피해가 낮아 파밍이 불편하다 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/meleeDefs.ts:408] [H]
- 마체테(타이가 마체테)는 50v50에서 홍팀 리더에게 주어진다 [src:namu/Surviv.io/무기, namu/Surviv.io/이벤트] [M]
- 나기나타: 피해 56, 장애물 피해 107.52(배율 1.92), 초당 1.85회(쿨다운 0.54초), DPS 103.7; 근접 무기 중 리치가 가장 길다(공격 오프셋 3.5, 카타나 1.75) [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/meleeDefs.ts:684] [H]
- 나기나타는 찻집 상자에서 낮은 확률로 나온다 [src:namu/Surviv.io/무기] [M]
- 후라이팬은 들고 있으면 날아오는 총알을 막는다; 감자는 파편이 없어서 후라이팬으로 막을 수 없다 [src:namu/Surviv.io/무기] [L]
- 해적 상자에서 근접 무기로 후크가 나온다 [src:namu/Surviv.io/오브젝트] [M]

### 투척 무기

- 파편 수류탄: 갈색 원형, 피해 125, 파편 12개, 던진 뒤 4초에 폭발 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/explosionsDefs.ts:31, survev/shared/defs/gameObjects/throwableDefs.ts:73] [H]
- 연막탄: 회색 원통형, 던진 뒤 2.5초에 터져 시야를 가리는 연기를 만든다 [src:namu/Surviv.io/무기, survev/shared/defs/gameObjects/throwableDefs.ts:291] [H]
- MIRV: 일반 수류탄처럼 한 번 터진 뒤 작은 수류탄 6개가 나와 다시 터진다 [src:namu/Surviv.io/무기, namu/Surviv.io/팁] [M]
- 스트로브는 가장 강력한 투척물 중 하나지만 사람들이 자주 피한다고 서술한다 [src:namu/Surviv.io/무기] [L]
- "마음의 파편"(Heart Shards)이라는 투척 무기가 언급된다 [src:namu/Surviv.io/무기] [L]

## 틀:Surviv.io/무기 정리

- 무기 종류 분류는 권총(Pistol), 리볼버, SMG, SG, AR, DMR, 볼트액션 SR, LMG, 레버액션 소총이다 [src:namu/틀:Surviv.io/무기_정리] [M]
- 9mm 열에 M9, MP5, MAC-10, Vector, CZ-3A1이 있다 [src:namu/틀:Surviv.io/무기_정리] [M]
- 12게이지 열에 M870, MP220, Saiga-12, SPAS-12가 있다 [src:namu/틀:Surviv.io/무기_정리] [M]
- 7.62mm 열에 AK-47, M1 Garand, Mosin Nagant가 있다 [src:namu/틀:Surviv.io/무기_정리] [M]
- 5.56mm 열에 M416, Mk 12 SPR, M249가 있다 [src:namu/틀:Surviv.io/무기_정리] [M]

## Surviv.io/장비

- 방어구는 1~4레벨이며, 헬멧은 헤드샷, 조끼는 몸통 피해를 줄인다 [src:namu/Surviv.io/장비] [M]
- 헬멧 1~4레벨: 일반 방어력 7.5% / 12% / 16.5% / 21%, 헤드샷 방어력 25% / 40% / 55% / 70% [src:namu/Surviv.io/장비, survev/shared/defs/gameObjects/gearDefs.ts:124, survev/server/src/game/objects/player.ts:2489] [H]
- 위 일반 방어력은 survev 서버가 몸통 피격 시 헬멧 감쇠에 0.3을 곱하는 것과 정확히 맞는다 (0.25×0.3 = 7.5%) [src:survev/server/src/game/objects/player.ts:2489, derived/helmet-body-0.3] [H]
- 조끼 1레벨 25%, 2레벨 38% (3·4레벨 수치는 스니펫에 없음; survev는 45%·60%) [src:namu/Surviv.io/장비, survev/shared/defs/gameObjects/gearDefs.ts:26, survev/shared/defs/gameObjects/gearDefs.ts:86] [H]
- 가방은 총 용량이 아니라 아이템별 소지 한도를 올린다; 붕대 한도에 닿으면 다른 아이템을 버려도 붕대를 더 들 수 없다 [src:namu/Surviv.io/장비] [M]
- 조끼·헬멧과 달리 가방은 한 번 장착하면 버릴 수 없다 [src:namu/Surviv.io/장비] [M]
- 가방 단계 명칭: 기본 주머니, 1레벨 작은 가방, 2레벨 보통 가방, 3레벨 군용 가방 (공식 한국어는 주머니·작은 가방·큰 가방·밀리터리 가방) [src:namu/Surviv.io/장비, l10n/ko:game-backpack02, l10n/ko:game-backpack03] [H]
- 9mm 소지 한도 120 / 240 / 330 / 420 (주머니→3레벨) [src:namu/Surviv.io/장비, survev/shared/gameConfig.ts:416] [H]
- 주머니(0레벨) 의료품 한도 붕대 5, 구급상자 1, 소다 2, 알약 1 (이전 조사 리드, survev와 일치) [src:namu/Surviv.io/장비, survev/shared/gameConfig.ts:432] [H]
- 스코프는 1·2·4·8·15배율이 있고 언제든 바꿀 수 있다 [src:namu/Surviv.io/장비] [M]
- 스코프 내부 이름을 SV scope1, SV X2, SV X4, SV X8, SV X15로 적는다 [src:namu/Surviv.io/장비] [L]
- 2배율이 가장 흔하고, 8배율부터 제대로 된 장거리전이 가능하다 [src:namu/Surviv.io/장비] [M]
- 금색 상자에서는 주로 4~8배율, 상자 나무에서는 주로 2~4배율이 나오고 가끔 15배율도 나온다 [src:namu/Surviv.io/장비] [M]
- 일부 특수 헬멧(퍽 헬멧)은 3레벨 헬멧 성능을 기본으로 가진다 [src:namu/Surviv.io/장비] [M]
- 지휘관 공통 장비: 8배율, 신호탄 총, 신호탄 1발, 노란 별이 그려진 4레벨 지휘관 헬멧, 3레벨 조끼, 군용 가방 [src:namu/Surviv.io/장비, survev/shared/defs/gameObjects/roleDefs.ts:112] [H]
- 마크스맨 장비: 8배율, 군용 가방, 3레벨 조끼, 화살 두 개가 교차된 3레벨 헬멧(모자), 쿠크리 [src:namu/Surviv.io/장비, survev/shared/defs/gameObjects/roleDefs.ts:256] [H]
- 부관(Deputy) 헬멧을 쓰면 화력(Firepower) 퍽 효과를 얻는다 [src:namu/Surviv.io/장비, survev/shared/defs/gameObjects/roleDefs.ts:195] [H]

## Surviv.io/의료품

- 붕대: 체력 15 회복, 사용 중 빨간 십자 파티클, 100까지 회복, 단축키 7 [src:namu/Surviv.io/의료품, survev/shared/defs/gameObjects/gearDefs.ts:388] [H]
- 구급상자: 체력 100 회복, 단축키 8 [src:namu/Surviv.io/의료품, survev/shared/defs/gameObjects/gearDefs.ts:411] [H]
- 소다: 아드레날린 25 증가, 단축키 9 [src:namu/Surviv.io/의료품, survev/shared/defs/gameObjects/gearDefs.ts:325] [H]
- 알약: 단축키 0; 사용 시간과 아드레날린 획득량을 따지면 알약은 "풀 부스트"용, 소다는 그 사이를 채우는 용도 [src:namu/Surviv.io/의료품] [M]
- 붕대 3초·구급상자 6초 사용 시간 (이전 조사 리드, survev와 일치) [src:namu/Surviv.io/의료품, survev/shared/defs/gameObjects/gearDefs.ts:391] [H]

## Surviv.io/의류

- 희귀도 구분으로 일반·희귀·영웅을 쓴다 (공식 한국어는 epic을 "전설"로 번역) [src:namu/Surviv.io/의류, l10n/ko:loadout-epic] [H]
- 사격 표적(Target Practice, `outfitRed`): 희귀 등급, 필드에서 무작위로 나오지만 매우 눈에 띄어 "진짜 표적"이 된다 [src:namu/Surviv.io/의류] [M]
- 길리 슈트(`outfitGhillie`): 영웅 등급, 어디서나 매우 희귀, 풀 색과 거의 같고 입으면 조끼·헬멧·가방 외형이 가려진다 [src:namu/Surviv.io/의류] [M]
- 황실의 인장(Imperial Seal, `outfitImperial`): 황갈색 배낭과 흰 장갑이 달린 빨간 옷, 국화 벙커와 도끼(Hatchet) 벙커에서만 나와 꽤 희귀하다 [src:namu/Surviv.io/의류] [M]
- 사막 길리 슈트(`outfitDesertGhillie`): 길리 슈트처럼 조끼·배낭·헬멧 외형을 지우고 모래색에 맞춘다; 길리 슈트 색이 이벤트에 맞춰 바뀌게 되면서 삭제된 스킨이다 [src:namu/Surviv.io/의류] [M]
- 서바이버 패스 2의 30레벨 보상으로 의상 "크로메시스"(Chromesis)가 있다 (post-0.8.82) [src:namu/Surviv.io/의류] [L]
- 은행 금고 중앙에서 의상 "Jester's Folly"(`outfitJester`)가 100% 나온다 [src:namu/Surviv.io/건물] [M]

## Surviv.io/건물

- 벙커 종류: 히드라, 소라(Conch), 폭풍(Storm), 달걀(Egg), 건널목(Crossing), 도끼(Hatchet), 눈(Eye), 국화(Chrysanthemum), 쌍둥이(Twins) [src:namu/Surviv.io/건물] [M]
- 이전 조사 리드는 벙커 목록에 구름(Cloud), 유성우(Meteor Shower)도 포함한다 [src:namu/Surviv.io/건물] [L]
- 히드라 벙커: 저택·경찰서보다 크고, 넓은 내부가 시야를 제한하며 흰 바닥 때문에 총알이 잘 안 보인다 [src:namu/Surviv.io/건물] [M]
- 폭풍 벙커: 무작위 오두막(shack) 위치에 생기며, 해적 표시 없는 고급 상자 1개, 가끔 히드라 벙커 도끼 상자, "핵" 상자 1개가 있다 [src:namu/Surviv.io/건물] [L]
- 건널목 벙커: 다리처럼 강 밑에 있고 바깥에서 일부가 보이며, 물 바닥이지만 이동 속도가 줄지 않는다 [src:namu/Surviv.io/건물] [M]
- 건널목 벙커 안에는 사물함, 자판기, 경찰서 화장실, 작동하면 도끼를 주는 제어판, 탄약 나무통, 책장이 있다 [src:namu/Surviv.io/건물] [M]
- 벙커 비밀번호(퍼즐) 순서를 달걀, 히드라(머리 3개 뱀), 폭풍(번개 구름), 소라, 건널목(다리), 도끼로 적는다 [src:namu/Surviv.io/건물] [L]
- 은행은 사물함과 서랍이 있는 건물이며 (한 스니펫은 "사막 마을"에 있다고 적는다) [src:namu/Surviv.io/건물] [L]
- 경찰서: T자형 건물, 포스터가 붙은 주차장, 입구에 소다 자판기 [src:namu/Surviv.io/건물] [M]
- 50v50에서 저택(맨션)은 홍팀 쪽에 있다 [src:namu/Surviv.io/건물, namu/Surviv.io/이벤트] [M]
- 찻집: 스프링 피버 이벤트에 추가(원작 0.7.3, 2019-03-21), 입구 근처 나무통 2개, 내부 항아리 3개 [src:namu/Surviv.io/건물, changelog/0.7.3] [M]
- 온실: 사방 유리벽과 유리 천장, 꽃 두 송이씩 든 화분 여러 개, 벙커로 내려가는 계단 [src:namu/Surviv.io/건물] [M]
- 헛간: 부술 수 있는 오븐, 부술 수 없는 냉장고, 부술 수 있는 탁자, 덤불 2개, 아이템 상자 5개, 화장실; 한 종류는 방탄 방, 다른 종류는 벙커가 있다 [src:namu/Surviv.io/건물] [M]
- 오두막(바다 오두막): 2018-06-22 추가(원작 0.4.2 "hut", 2018-06-21), 바다 위에 있고 다리로 들어가며, 지붕 불이 켜져 있으면 가운데 상자에 SPAS-12가 있다 [src:namu/Surviv.io/건물, changelog/0.4.2] [M]
- 컨테이너: 한쪽 또는 양쪽에 문이 있는 작은 구조물, 지붕은 가운데가 뚫린 X자 또는 긴 틈이 있는 번개 모양 [src:namu/Surviv.io/건물] [M]
- 큰 다리는 2018년 9월 업데이트로 추가되었다 (원작 0.6.0, 2018-09-07: large bridge, medium bridge, cabin, crossing bunker) [src:namu/Surviv.io/오브젝트, changelog/0.6.0] [H]
- 강 다리 가운데에 가끔 총이 놓여 있다 (이전 조사 리드) [src:namu/Surviv.io/건물] [L]

## Surviv.io/오브젝트

- 나무 상자(Crate): 내구도 75, 총·탄약·가방·붕대·구급상자·소다·알약 중 무작위 [src:namu/Surviv.io/오브젝트, survev/shared/defs/mapObjects/obstacles/crateDefs.ts:21] [H]
- 소련 상자(Soviet Crate, "군용 상자"라고도 함): 내구도 120, 미니맵에 표시되지 않아 찾기 어렵고 단단하며, 총·탄약·붕대·소다·구급상자·스코프 중 몇 개가 나온다 [src:namu/Surviv.io/오브젝트] [L]
- 소련 상자가 미니맵에 표시되지 않는다는 점은 survev 정의(`crate_02`, map.display false)와 맞지만 내구도는 140이다 [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:383] [H]
- 해적 상자(Treasure Chest): 내구도 140, 해안에만 있고 가장 희귀한 상자 중 하나; 후크와 7.62·5.56 총이 주로, 가끔 샷건·9mm가 나온다 [src:namu/Surviv.io/오브젝트, survev/shared/defs/mapObjects/obstacles/crateDefs.ts:315] [H]
- 벙커 상자·금색 벙커 상자: 내구도 140 [src:namu/Surviv.io/오브젝트] [M]
- 상자 나무(Tree Cache): 거의 모든 이벤트에 맵당 정확히 1개, 일반 나무와 비슷하지만 약간 짙은 초록 [src:namu/Surviv.io/오브젝트] [M]
- 나무 잎은 반투명해서 숲 의상으로 위장할 수 있다 [src:namu/Surviv.io/오브젝트] [M]
- 하드스톤 바위: 두 손이 받친 눈 문양이 있고 이벤트에서만 여러 개 나온다 [src:namu/Surviv.io/오브젝트] [M]
- 사물함: 경찰서와 히드라 벙커에 있고, 가끔 금색 사물함이 나와 50% 확률로 3레벨 가방·조끼·헬멧 또는 SCAR-H 같은 좋은 아이템을 준다 [src:namu/Surviv.io/오브젝트] [M]
- 은행 사물함(Deposit Box): 은행 금고 안, 경찰서 사물함보다 크고 아이템은 비슷하다; 금색 손잡이 버전은 총/총 또는 아이템/총 2개를 준다 [src:namu/Surviv.io/오브젝트] [M]
- 냉장고: 파란 소다 라벨 상자 모양, 경찰서와 은행에 있고 보통 소다 3개, 가끔 탄약 [src:namu/Surviv.io/오브젝트] [M]
- 자판기는 여러 건물의 실내 오브젝트다 [src:namu/Surviv.io/오브젝트] [M]
- 화장실(변기)은 부술 수 있는 나무 벽으로 된 옥외 화장실 안에 보통 하나 있다 [src:namu/Surviv.io/오브젝트] [M]
- 은행 금고는 F키로 열고, 안에 보라색 의상과 회색 금고(사물함) 6개가 있으며 금색 금고는 최소 1개 아이템을 보장한다 [src:namu/Surviv.io/오브젝트] [L]
- 크림슨(레드) 클럽 금고 비밀번호는 키릴 문자 к, р, у, г 순서이고 안에 마체테와 은행 사물함이 있다 [src:namu/Surviv.io/오브젝트] [L]
- 기름통(드럼통)은 흔한 폭발 오브젝트로, 적이 근처에 있을 때 쏴서 터뜨려 잡을 수 있고, 연기가 나는 기름통 근처는 피해야 한다 [src:namu/Surviv.io/오브젝트, namu/Surviv.io/팁] [M]
- 보급 상자는 낙하산으로 내려오며 착지 지점 바로 밑에 있으면 즉사한다 [src:namu/Surviv.io/오브젝트] [M]
- 끝이 금색인 보급 상자는 CZ-3A1, OTs-38, M1 Garand, M249, M4A1-S, AWM-S 중 하나를 준다 [src:namu/Surviv.io/오브젝트] [L]
- 금색 에어드랍은 주로 후반에 나오고 USAS-12, M249, AWM-S, M134, M79 같은 OP 무기가 2개씩 나온다 [src:namu/Surviv.io/오브젝트] [L]
- 공습: 배그처럼 노란 폭격 위치가 예고된 뒤 전투기가 빠르게 지나가며 "아이언 밤"이라는 노란 폭탄을 떨어뜨리고, 실제 범위는 지도 경고보다 약간 넓다 [src:namu/Surviv.io/오브젝트] [M]
- 50v50의 특수 군용 보급은 일반 보급보다 훨씬 크고 아이템·OP 총·근접·투척 무기가 대량으로 들어 있다 [src:namu/Surviv.io/이벤트] [M]

## Surviv.io/이벤트

### 이벤트 일반

- 이벤트는 하루 한 번 바뀌는 특수 맵의 특수 매치다 [src:namu/Surviv.io/이벤트] [M]
- 개발권이 다른 회사로 넘어간 뒤 감자·코발트·50v50·나무(숲의 왕)·운석·사바나 이벤트가 월요일 기준 2주 주기로 매일 바뀌며 나왔다 (post-0.8.82) [src:namu/Surviv.io/이벤트] [M]
- 이벤트 목록에 클래식·운석·사바나·숲·50 VS 50이 나란히 표시된다 [src:namu/Surviv.io/이벤트] [M]

### 50 VS 50

- 홍팀 50명과 청팀 50명이 싸우는 대규모 이벤트로, Surviv.io에서 가장 인기 있는 이벤트다 [src:namu/Surviv.io/이벤트] [M]
- 처음엔 짧게 열렸다가 사라지고 다시 나오기를 반복했고, 2020-10-16에 재출시되었다 (post-0.8.82) [src:namu/Surviv.io/이벤트] [L]
- 전용 오브젝트: 홍팀 탄약 보급, 청 벙커 상자, 빨간 소련 상자, 각 팀 동상; 무기 AN-94, Super 90, 타이가 마체테, 탈로우의 쿠크리, 나팔; 건물 거대 다리 [src:namu/Surviv.io/이벤트] [M]
- 큰 강이 땅을 둘로 나누며 저택(맨션) 쪽이 홍팀, 경찰서 쪽이 청팀이다 [src:namu/Surviv.io/이벤트] [M]
- 50v50의 "거대 다리"는 원작 0.7.0(2019-01-31)에 추가된 extra large bridge이고, 0.7.3에서 일반 맵에 잘못 생성되던 문제가 고쳐졌다 [src:changelog/0.7.0, changelog/0.7.3, namu/Surviv.io/이벤트] [H]
- 강마을: 50v50에 생긴 지역으로 강 위 거대 다리를 중심으로, 청팀 쪽은 항구처럼 초록 판잣집·창고·컨테이너, 홍팀 쪽은 집 3채가 있다 [src:namu/Surviv.io/이벤트] [M]
- 강마을은 양 팀의 교차점이라 전투가 잦고 공습도 자주 떨어진다 [src:namu/Surviv.io/이벤트] [M]
- 2019년 9월 기준 역할은 지휘관·부관·의무병·마크스맨이었고, 이후 나팔병·척탄병·정찰병이 추가되었다 [src:namu/Surviv.io/이벤트, changelog/0.8.81] [H]
- 팀당 역할 배정 순서: 지휘관 1, 부관 1, 마크스맨 1, 척탄병 1, 정찰병 1, 의무병 1, 나팔병 1 = 7명 [src:namu/Surviv.io/이벤트] [M]
- 지휘관이 죽었을 때 부관이 살아 있으면 부관이 지휘관으로 승진한다 [src:namu/Surviv.io/이벤트, l10n/en:game-promoted-to] [M]
- 지휘관 퍽 "리더십": 아드레날린이 항상 최대, 크기 25% 증가; 커서 잘 맞지만 무한 아드레날린과 지휘관 헬멧의 높은 방어력으로 상쇄된다 [src:namu/Surviv.io/이벤트, survev/shared/defs/gameObjects/perkDefs.ts:5] [H]
- 홍팀 지휘관은 Super 90, 12게이지 90발, 마체테를 받는다 [src:namu/Surviv.io/이벤트] [M]
- 쿠크리와 AN-94, 부관 헬멧은 벙커 안 청 벙커 상자에서 나오며 청팀 리더와 연관된다 (이전 리드: 청팀 지휘관은 AN-94, 7.62 300발, 쿠크리) [src:namu/Surviv.io/이벤트] [L]
- 마크스맨: 홍팀은 L86A2와 5.56 300발, 청팀은 SVD-63과 7.62 300발 [src:namu/Surviv.io/이벤트] [M]
- 마크스맨의 퍽은 하이 밸류 타겟(특수 능력 보유자에게 추가 피해)이지만 효과가 잘 안 느껴지고 대상이 적어 쓸모가 제한적이다 [src:namu/Surviv.io/이벤트, survev/shared/defs/gameObjects/roleDefs.ts:256] [H]
- 척탄병: 퍽 방탄 조끼(Flak Jacket), Saiga-12, 카타나, 수류탄·MIRV 최대치 [src:namu/Surviv.io/이벤트, survev/shared/defs/gameObjects/roleDefs.ts:314] [H]
- 방탄 조끼(Flak Jacket)는 폭발 피해를 80%(다른 서술 80~90%) 줄이고 크기를 약 20% 키운다 [src:namu/Surviv.io/이벤트] [M]
- 정찰병: 크로우바, 소다, 듀얼 권총 등을 받는다 [src:namu/Surviv.io/이벤트, survev/shared/defs/gameObjects/roleDefs.ts:291] [H]
- 의무병: 퍽 "전투 의무병"(이동 속도 감소 없이 의료품 사용), 기본 장비로 구급상자 1개 [src:namu/Surviv.io/이벤트] [L]
- 나팔병: 나팔과 후라이팬; 나팔은 두 번째 무기 칸을 차지해 총을 하나만 들 수 있다 [src:namu/Surviv.io/이벤트, survev/shared/defs/gameObjects/roleDefs.ts:338] [H]
- 나팔은 탄약이 필요 없고 일정 시간마다 자동 충전되며, 불면 음표가 나오고 주변 아군이 잠시 이동 속도 버프를 받는다 [src:namu/Surviv.io/이벤트] [M]
- 론 서바이버: 마지막 2명 남았을 때(또는 3~4명 중 1~2명이 기절) 주어지며 PKP·M249와 4레벨 방어구를 받는 "진정한 최종 보스" [src:namu/Surviv.io/이벤트, survev/shared/defs/gameObjects/roleDefs.ts:360] [H]
- 론 서바이버는 윈드워크(총알이 스치거나 맞으면 잠시 가속)를 얻는다 [src:namu/Surviv.io/이벤트, survev/shared/defs/gameObjects/roleDefs.ts:360] [H]

### 코발트 (Class Warfare)

- 2019-12-02~09에 열렸고 이후 매주 월·목요일에 나왔다; 나무가 뾰족하고 어두워지며 6개 캐릭터(클래스) 중 하나를 고른다 [src:namu/Surviv.io/이벤트, changelog/0.8.8] [H]
- 클래스를 고르면 정해진 퍽과 아이템을 가지고 낙하하며, 클래스마다 퍽이 2개다 [src:namu/Surviv.io/직업, survev/shared/defs/gameObjects/roleDefs.ts:453] [H]
- 정찰병(Scout): "소형 화기로 최전선을 정찰", 크기가 작아지고 이동이 빨라진다 [src:namu/Surviv.io/직업, survev/shared/defs/gameObjects/roleDefs.ts:505] [H]
- 저격수(Sniper): "스코프를 당겨 한 발 남은 탄을 쏜다" [src:namu/Surviv.io/직업, survev/shared/defs/gameObjects/roleDefs.ts:487] [H]
- 의무병(Medic): 고수들이 선호하는 클래스 [src:namu/Surviv.io/직업] [M]
- 돌격병(Assault): 가장 무난한 직업, 피해 배율이 꽤 도움이 되고 일반 모드처럼 플레이하고 싶을 때 적합 [src:namu/Surviv.io/직업] [M]
- 폭파병(Demolitionist): 후방에서 폭발물 투척으로 지원 [src:namu/Surviv.io/직업] [M]
- 장갑병(Tank): 주철 방어구(Cast Ironskin)를 두른다 [src:namu/Surviv.io/직업, survev/shared/defs/gameObjects/roleDefs.ts:471] [H]
- 코발트의 전투 의무병 퍽은 이동 속도 감소 없이 의료품을 쓰게 한다 [src:namu/Surviv.io/이벤트, survev/shared/defs/gameObjects/roleDefs.ts:453] [H]

### 사바나 (All Perked Up)

- 2019-09-12에 처음 열렸고 이후 2019-10-08, 2020-02-25 등에 2주마다 수·화요일에 나왔다 [src:namu/Surviv.io/이벤트, changelog/0.8.3] [M]
- 2019-09-12 사바나 업데이트로 헬멧의 특수 능력이 "퍽 시스템"으로 공식 명명되고 퍽이 많이 추가되었다 [src:namu/Surviv.io/이벤트, changelog/0.8.3] [H]
- SCAR-H를 뺀 AR, 산탄총, 2배율 스코프가 나오지 않는다 [src:namu/Surviv.io/이벤트] [M]
- 4배율 이상이 필수지만 4배율은 매우 흔하다 [src:namu/Surviv.io/이벤트] [M]
- 이벤트에서 SV-98은 AWM-S보다 희귀하다 [src:namu/Surviv.io/이벤트] [M]
- "수배자(The Hunted)"가 되면 위치가 모든 적에게 드러난다 [src:namu/Surviv.io/이벤트, l10n/en:game-hunted-desc] [H]
- 구름 상자(Cloud Crate)에는 총 1개와 퍽 1개가 들어 있다 [src:namu/Surviv.io/이벤트] [M]

### 숲·숲의 왕·운석·감자

- 숲 이벤트(INTO THE WOODS): 맵이 나무로 가득 찬다 [src:namu/Surviv.io/이벤트] [M]
- 숲의 왕(King of the Woods): 2019-04-15부터 (원작 0.7.5 "숲의 왕" 역할·PKP 추가일과 같음) [src:namu/Surviv.io/이벤트, changelog/0.7.5, fandom/Changelog] [H]
- 이후 2주마다 목·토요일에 나왔다 (post-0.8.82 로테이션) [src:namu/Surviv.io/이벤트] [L]
- 숲의 왕 맵에는 항구만 한 벌목장(logging camp)이 있고, 창고 같은 벙커에 신호탄 총과 USAS-12 또는 M249가 항상 나오며 도끼 상자는 M249 또는 USAS-12를 준다 [src:namu/Surviv.io/이벤트] [M]
- USAS, PKP, M249 같은 OP 무기가 특정 위치에만 나와 빨리 파밍하는 플레이어가 유리하다 [src:namu/Surviv.io/이벤트] [M]
- 운석(Meteor Shower, 신호탄 총) 이벤트: 2주마다 토·수요일, 보급이 훨씬 자주 떨어진다 [src:namu/Surviv.io/이벤트] [M]
- 감자 이벤트(Rotato Potatos): 감자 오브젝트가 맵에 깔리고 일정 간격으로 나타나며 무기를 바꿔 준다 [src:namu/Surviv.io/이벤트] [M]
- 감자 모드는 로테이션에서 월요일(듀오)·일요일(솔로)에 나왔다 [src:namu/Surviv.io/이벤트] [L]
- "Desert Rain" 이벤트도 목록에 있다 [src:namu/Surviv.io/이벤트] [L]

### 계절·특별 이벤트

- 할로윈(Night Falls On): 10월 말, 할로윈 이틀 전부터 할로윈 당일까지 약 3일 [src:namu/Surviv.io/이벤트] [M]
- 할로윈 신규 요소: 호박, 오브젝트로 변하는 의상, 잭오랜턴 모양 수류탄, 눈(Eye) 벙커 (눈 벙커는 원작 0.6.4, 2018-10-29) [src:namu/Surviv.io/이벤트, changelog/0.6.4] [M]
- 두 번째 할로윈 업데이트에서 "Trick Or Treat?" 퍽이 추가되었고, 주우면 좋은 퍽(Treats) 또는 나쁜 퍽(Tricks)이 무작위로 주어진다 [src:namu/Surviv.io/이벤트, changelog/0.8.7] [H]
- Tricks를 받으면 웃음소리와 악마 이모트, Treats를 받으면 경쾌한 소리와 웃는 얼굴 이모트가 나온다 [src:namu/Surviv.io/이벤트] [M]
- "Candy Corn" 퍽은 9mm 과충전(9mm Overpressure)과 차이가 없다고 서술한다 [src:namu/Surviv.io/이벤트] [L]
- "Full Size OKAMI Bar"는 Trick Or Treat?에서 나올 수 있는 가장 희귀한 퍽이다 [src:namu/Surviv.io/이벤트] [M]
- 겨울 이벤트(SNOWBALL EFFECT): 2018-12-19, 다른 이벤트보다 길게 진행; 땅이 하얗고 눈이 내리며 눈싸움을 할 수 있다 [src:namu/Surviv.io/이벤트, changelog/0.6.9] [H]
- 겨울 이벤트에서는 건물·오브젝트·나무가 눈에 덮이고(나무 투명도 낮음), 리본 두른 나무 상자와 수류탄 상자 대신 눈덩이 상자가 나온다 [src:namu/Surviv.io/이벤트] [M]
- 겨울 이벤트 신규 아이템: 눈 덮인 나무, 눈덩이 상자, 크리스마스 트리, OTs-38, 눈덩이, 의상 Tallow's Little Helper·Siberian Assault [src:namu/Surviv.io/이벤트, changelog/0.6.9] [H]
- 2018년 12월 초 사막 계열 이벤트에는 하드스톤 바위, 두 번째 사막 지역, 온실과 국화 벙커가 새로 나왔다 (원작 체인지로그상 온실은 0.6.7, 2018-11-29 추가) [src:namu/Surviv.io/이벤트, changelog/0.6.7] [L]
- "Into the Woods and Snow!": 2019-01-10, 숲 이벤트와 겨울 이벤트를 합친 이벤트 [src:namu/Surviv.io/이벤트] [M]
- 레이저 이벤트: 2020-05-04~11, 스타워즈 모티브(추정); 레이저 건·라이트세이버, 우주 상자·하늘색 상자, 소모품 펄스 박스; 가장 인기 있던 비정기 이벤트 (post-0.8.82) [src:namu/Surviv.io/이벤트] [M]
- 에그포컬립스(Egg-pocalypse)는 이벤트 18번째로, 달걀 콘텐츠는 4월 부활절 이벤트에 나왔다 (post-0.8.82) [src:namu/Surviv.io/이벤트] [L]

## Surviv.io/직업

- 50 vs 50 역할(지휘관·부관·의무병·마크스맨 + 나팔병·척탄병·정찰병)과 코발트 6클래스를 함께 정리한 문서다 [src:namu/Surviv.io/직업] [M]

## Surviv.io/이모트

- 게임에서 동시에 쓸 수 있는 이모트는 4개다 [src:namu/Surviv.io/이모트] [M]
- 이모트 설정 창에서 승리·사망 시 자동 이모트를 지정할 수 있다 [src:namu/Surviv.io/이모트] [M]
- 짧은 시간에 이모트를 많이 쓰면 한동안 쓸 수 없다 [src:namu/Surviv.io/이모트] [M]
- 마우스 오른쪽 클릭으로 이모트를 띄운다 [src:namu/Surviv.io/이모트, l10n/en:index-use-emote-ctrl] [H]
- 분류: 외곽선(outline), 얼굴, 음식, 사물, 벙커·표지, 국기, 기타 [src:namu/Surviv.io/이모트] [M]
- 기본 제공 외의 국기 등 이모트를 쓰려면 SNS 링크를 눌러 로그인해야 한다 [src:namu/Surviv.io/이모트] [M]
- 벙커·표지 이모트: 달걀 벙커 로고, 손도끼(Hatchet), 유성우 벙커 로고, 폭풍 벙커 로고, 돼지 벙커 로고, 쌍둥이 벙커 로고 [src:namu/Surviv.io/이모트] [M]
- 국기 이모트와 쌍둥이 벙커 이모트는 솔로에서 같은 나라 유저끼리 티밍할 때 흔히 쓰인다 [src:namu/Surviv.io/이모트] [M]

## Surviv.io/팁

### 기본

- 로비 대기 없이 들어온 순서대로 스폰되며, 이미 털린 곳이나 운 좋게 건물 근처에 떨어질 수 있다 [src:namu/Surviv.io/팁] [M]
- 일단 아무 무기나 먼저 줍는다 (이전 조사 리드) [src:namu/Surviv.io/팁] [L]
- 가방을 일찍 얻어야 파밍 중 칸 부족으로 답답해지지 않는다 [src:namu/Surviv.io/팁] [M]
- Surviv.io는 상대 행동을 읽고 전략적으로 싸워야 하는 심리전 게임이다 [src:namu/Surviv.io/팁] [M]
- 미니맵의 초록 선을 따라가면 경기 구역의 정중앙으로 가며, 자기장이 줄어 새 구역이 정해질 때마다 중심이 바뀐다 [src:namu/Surviv.io/팁] [M]
- 초반 자기장은 약해서 아드레날린 없이 그 안에서 파밍해도 괜찮다 (이전 조사 리드) [src:namu/Surviv.io/팁] [L]
- 듀오 전에 솔로부터 해 보라고 권한다 (이전 조사 리드) [src:namu/Surviv.io/팁] [L]

### 전투

- 소다·알약을 꽉 채운 "풀 도핑"은 교전 중 체력 회복과 이동 속도 증가를 주며 후반에 특히 중요하다 [src:namu/Surviv.io/팁] [M]
- 아드레날린이 3/4 이상이면 이동 속도가 오르고 체력이 자동 회복된다 [src:namu/Surviv.io/팁] [M]
- 후반에는 수상한 덤불·풀숲에 먼저 시험 사격을 해 숨은 적을 찾는다 [src:namu/Surviv.io/팁] [M]
- 수류탄은 클릭 후 4초 뒤 터지고, 좌클릭을 누르고 있으면 쿠킹할 수 있어 타이밍을 맞춰 던질 수 있다 [src:namu/Surviv.io/팁, survev/shared/defs/gameObjects/throwableDefs.ts:73] [H]
- 1대1에서 체력·도핑이 불리하면 연막탄을 이어서 뿌리고 그 안에서 치료한다; 도망칠 때도 연막으로 시야를 가린다 [src:namu/Surviv.io/팁] [M]
- 상대가 엄폐물 뒤에서 치료하면 연막 속에서 쿠킹한 수류탄을 던지고, 상대가 연막을 마구 쏘면 나를 못 보는 점을 이용해 움직이며 쏘거나 수류탄을 던진다 [src:namu/Surviv.io/팁] [M]
- 표준 조합은 중거리 총 1정 + 샷건 또는 근거리 SMG (이전 조사 리드) [src:namu/Surviv.io/팁] [L]

### 조작

- PC: 1·2번 무기, 3번 주먹, 4번 수류탄; 7·8·9·0은 붕대·구급상자·소다·알약 [src:namu/Surviv.io/팁, l10n/en:index-use-medical-ctrl, l10n/en:index-change-weapons-ctrl] [H]
- 퀵스위치는 SPACE, 줍기는 F로 두기를 권하며, 마우스 휠로 1~4번을 대신할 수 있다 [src:namu/Surviv.io/팁] [M]
- 화면 오른쪽 아래 "조작키 재지정" 메뉴(설정의 키보드 아이콘)에서 키를 바꾼다 [src:namu/Surviv.io/팁] [M]
- 모바일: 탄창 수 왼쪽의 총알 3개 버튼으로 장전, 장전 시간 아래 검은 사각형으로 장전 취소 [src:namu/Surviv.io/팁] [M]
- 모바일 설정에서 조준 보조선, 자동 상자 파괴 등을 켤 수 있지만 퀵스위치는 거의 불가능하고 PC만큼 빠르지 않다 [src:namu/Surviv.io/팁] [M]

## Surviv.io 서바이버 패스·퍽 (본문서·이벤트 문서)

- 서바이버 패스는 모든 플레이어에게 무료로 주어지는 퀘스트형 시스템이다 [src:namu/Surviv.io] [M]
- 하루 최대 48개 퀘스트, 퀘스트당 16~70 XP를 얻어 레벨업하고 레벨별 보상을 받는다 [src:namu/Surviv.io] [M]
- 최대 레벨 99(100), 만렙까지 총 7400 XP; 99레벨 XP를 채운 뒤에는 퀘스트 완료·아티팩트 획득 시 아무 일도 없다 [src:namu/Surviv.io] [L]
- 퍽 시스템 도입일은 2019-09-12다 [src:namu/Surviv.io/이벤트, changelog/0.8.3] [H]

## SURVIV.IO 마이너 갤러리 (나무위키 문서)

- 디시인사이드 마이너 갤러리로, io 게임 계열의 "2D 배그" Surviv.io 정보를 나누려고 2018-03-19에 개설되었다 [src:namu/SURVIV.IO_마이너_갤러리, web/https://m.dcinside.com/board/surviv] [M]
- 게임이 단순한 편이지만 고정 유저들이 질문에 꾸준히 좋은 답을 단다 [src:namu/SURVIV.IO_마이너_갤러리] [M]
- (개설 첫해) 7월 중순까지는 게임 이야기보다 저격글·역저격글이 가장 활발했지만 7월 중순 매니저가 뽑힌 뒤 분쟁이 정리되었다 [src:namu/SURVIV.IO_마이너_갤러리] [M]
- 게임 서비스 종료 후 비활성 갤러리가 되었다 [src:namu/SURVIV.IO_마이너_갤러리] [M]

## Conflicts

- CONFLICT namu-soviet-crate-health: namu 소련 상자 내구도 120 [src:namu/Surviv.io/오브젝트] vs survev `crate_02` health 140 [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:383]; proposed: survev 140 유지(정의 파일 우선), namu 값은 다른 상자(예: 다른 판의 상자)와 혼동 가능성 [L]
- CONFLICT namu-flak-jacket-reduction: namu 방탄 조끼(Flak Jacket) 폭발 피해 −80%(또는 80~90%) [src:namu/Surviv.io/이벤트] vs survev explosionDamageReduction 0.9 [src:survev/shared/defs/gameObjects/perkDefs.ts:17]; proposed: survev 0.9 유지, 크기 배율은 balance.txt대로 원작 0.2(namu "약 20%"와 일치) [src:balance/136] [L]
- CONFLICT namu-faction-medic-perk: namu는 50v50 의무병 퍽을 "전투 의무병"(Combat Medic)으로 적음 [src:namu/Surviv.io/이벤트] vs survev 50v50 `medic` 퍽은 aoe_heal(Mass Medicate)·self_revive(Revivify)이고 field_medic은 코발트 `healer` 퍽 [src:survev/shared/defs/gameObjects/roleDefs.ts:226, survev/shared/defs/gameObjects/roleDefs.ts:453]; proposed: survev 유지, namu 스니펫은 코발트 의무병과 섞인 것으로 본다 [L]
- CONFLICT namu-shutdown-date: namu 서비스 종료 선언 2023-02-14 [src:namu/Surviv.io] vs 발표 2023-02-13, 종료 2023-03-02 [src:wp-en/Surviv.io, fandom/Changelog]; proposed: 발표 2023-02-13 / 종료 2023-03-02 (namu 날짜는 KST 기준 하루 차이일 가능성) [L]
- CONFLICT namu-survev-launch-month: namu 판마다 survev 부활을 2024년 9월 또는 10월로 적음 [src:namu/Surviv.io] vs fandom "2024-10-30부터" [src:fandom/Changelog]; proposed: history.md 판정을 따른다 (2024년 가을, 정확한 날짜 미확정) [L]
- CONFLICT namu-relaunch-date: namu 재서비스 2026-03-26(복구 시점 2026-03-21) [src:namu/Surviv.io] vs fandom Kongregate 자체 사이트 재출시 2026-03-20 [src:fandom/Changelog]; proposed: 공식 체인지로그의 0.9.0 날짜 2026-03-26을 서비스 재개일로 쓴다 [src:kong/relaunch-changelog] [L]
- CONFLICT namu-server-regions: namu 한 판본은 서버 5개(북미·남미·유럽·아시아·대한민국), 다른 판본은 러시아 포함 6개 [src:namu/Surviv.io] vs 원작 클라이언트 문자열과 fandom은 5개 지역(러시아는 survev가 2025-12에 추가) [src:fandom/Servers, derived/git-cc2b58c9]; proposed: 0.8.82 기준 5개 지역(NA·SA·EU·AS·KR), 러시아는 post-0.8.82 또는 fork로 보고 선택 사항 [L]
- CONFLICT namu-m134-existence: namu는 금색 에어드랍과 무기 목록에 M134 미니건(장탄 200, 피해 10)을 적음 [src:namu/Surviv.io/무기] vs survev 정의에는 M134가 없고 미니건은 fork 감자 무기 PMG-134뿐 [src:survev/shared/defs/gameObjects/gunDefs.ts:3531]; proposed: M134는 0.8.82 이후 원작 콘텐츠이거나 namu 오기로 보고 리버스 범위에서 제외 [L]
- CONFLICT namu-candy-corn: namu "Candy Corn 퍽은 9mm 과충전과 차이가 없다" [src:namu/Surviv.io/이벤트] vs 공식 설명 "9mm 탄환이 더 어둡고 치명적" (별도 퍽 id `treat_9mm`) [src:l10n/en:game-treat_9mm-desc]; proposed: 별도 퍽으로 구현하되 수치는 survev 정의를 따른다 [L]

## Open questions

- 소련 상자 120 vs 140: namu 판 r1913 전후의 상자 표를 브라우저로 직접 확인할 필요가 있다 [src:namu/Surviv.io/오브젝트] [L]
- 끝이 금색인 보급 상자의 무기 목록(CZ-3A1, OTs-38, M1 Garand, M249, M4A1-S, AWM-S)이 0.8.82 보급 테이블과 같은지 survev `tier_airdrop_*`와 대조 필요 [src:namu/Surviv.io/오브젝트] [L]
- 벙커 퍼즐 "비밀번호 순서"(달걀→히드라→폭풍→소라→건널목→도끼)가 실제 퍼즐 정의인지, 단순 벙커 목록 순서인지 불명확 [src:namu/Surviv.io/건물] [L]
- 크림슨 클럽 금고(к, р, у, г) 서술은 survev `club_01` 퍼즐과 대조 필요 [src:namu/Surviv.io/오브젝트, survev/shared/defs/puzzles.ts:18] [L]
- SPAS-12 "거리별 피해 감소 85%"가 falloff 값인지 다른 의미인지 스니펫만으로 알 수 없다 [src:namu/Surviv.io/무기] [L]
