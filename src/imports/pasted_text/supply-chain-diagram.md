현재 프로젝트 / 공급망 관리 화면의 공급망 구조 UI를 개선한다.

현재 공급망 구조는 세로 리스트 트리 형태이다.

이를 그래프 기반 공급망 모식도(Supply Chain Diagram) 형태로 변경한다.

1️⃣ 공급망 표시 방식 변경

현재

Tier 리스트

변경

그래프형 공급망 다이어그램

구조

Tier0
   │
Tier1 ─ Tier1
   │
Tier2 ─ Tier2 ─ Tier2

노드는 카드 형태로 표현한다.

2️⃣ 노드 카드 디자인

각 회사는 카드 노드로 표시한다.

카드 구조

Tier Badge
회사명
국가
제품 역할

예시

Tier1
한국배터리
South Korea
Battery Cell

카드 스타일

background #FFFFFF
border radius 16px
shadow subtle
padding 16px
3️⃣ Tier 색상 구분

Tier별 색상

Tier0 → #5B3BFA
Tier1 → #2A64E0
Tier2 → #00A3B5
Tier3 → #8C8C8C

Tier는 카드 상단 badge로 표시.

4️⃣ 연결선 디자인

노드 사이 연결선은

curved line

또는

straight connector

색상

#D9D9D9

hover 시

#5B3BFA
5️⃣ BOM 표시

노드 카드 하단에 BOM 포함 여부 표시.

예

A' ✓
A'' ✓
A''' -

또는 아이콘

✓
—
6️⃣ 세부제품 선택 시 UX

세부제품 dropdown에서 BOM 선택 시

해당 BOM에 포함된 회사 노드는

opacity 100%
border highlight

포함되지 않은 노드는

opacity 30%
7️⃣ 그래프 인터랙션

공급망 모식도는 다음 인터랙션을 지원한다.

zoom
pan
node hover
node click

노드 클릭 시

회사 상세 정보
PCF 결과
데이터 상태

팝업 표시.

8️⃣ UI 배경

공급망 다이어그램 영역은

background #F6F8FB

canvas 스타일.

개인적으로 추천

너 서비스 수준이면
지금 UI에서 이거 하나만 더 추가하면 진짜 좋아진다.

PCF 배출 기여도 표시

예

한국배터리
CO₂ 기여도 42%

노드 하단에

carbon contribution bar

표시.

이거 넣으면 PCF 서비스 느낌이 확 살아.