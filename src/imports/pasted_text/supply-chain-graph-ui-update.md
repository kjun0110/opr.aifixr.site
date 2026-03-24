다음 내용 기준으로 프로젝트 / 공급망 관리 화면의 공급망 그래프 UI를 개선한다.

현재 화면에서는 다음 문제가 있다.

1. 카드 크기가 커서 전체 공급망이 한 화면에 잘 보이지 않음
2. 줌 아웃하면 글씨가 거의 보이지 않음
3. Auto Layout / Manual Layout 모드가 UX적으로 혼란을 줌

이를 다음 기준으로 수정한다.

1️⃣ 노드 카드 크기 최적화

현재 카드 크기가 너무 커서 그래프 가독성이 떨어진다.

카드 디자인을 compact node card 형태로 변경한다.

현재 카드 구조

Tier
회사명
국가
제품
BOM
CO₂ 기여도

개선된 카드 구조

Tier Badge
회사명
국가 | 역할
CO₂ 기여도

BOM 정보는 아이콘 형태로 축소한다.

예

A' ✓
A'' -
A''' ✓

카드 크기 기준

width: 160px
height: 100px
padding: 12px

폰트 크기

회사명: 14px
서브텍스트: 12px
2️⃣ 그래프 viewport 자동 맞춤 (Fit to View)

공급망 그래프가 처음 로드될 때

전체 공급망이 화면 안에 들어오도록
자동 zoom 및 center 적용

즉

Fit to View

동작을 기본 적용한다.

그래프 canvas padding

padding: 120px
3️⃣ Zoom UX 개선

현재 zoom out 시 텍스트가 너무 작아진다.

그래프 노드에 다음 규칙을 적용한다.

zoom level < 60%

일 때

카드 내부 텍스트를

축약 표시

예

한국배터리 → Korea Battery
Global Materials → G. Materials
4️⃣ Auto Layout / Manual Layout 구조 단순화

현재

Auto Layout
Manual Layout

두 모드가 존재한다.

이 구조는 사용자에게 혼란을 줄 수 있다.

따라서 다음 방식으로 변경한다.

그래프 기본 모드는

Manual Layout

노드 drag 이동 가능

위치 변경 시

node position 저장
5️⃣ Auto Arrange 버튼 추가

그래프 상단에 다음 버튼을 추가한다.

Auto Arrange

버튼 클릭 시

Tree Layout 자동 정렬

적용한다.

예

Tier0
Tier1
Tier2
Tier3

구조로 자동 정렬.

6️⃣ Reset Layout 기능 유지

Reset Layout 버튼은 유지한다.

동작

저장된 노드 위치 초기화
7️⃣ 그래프 가독성 개선

노드 간 최소 간격

horizontal gap: 120px
vertical gap: 140px

연결선 스타일

stroke: #D9D9D9
width: 2px

hover 시

stroke: #5B3BFA
8️⃣ 미니맵 개선

우측 미니맵 영역을 약간 확대한다.

width: 180px
height: 120px

현재 viewport 위치를 강조 표시한다.

9️⃣ 그래프 인터랙션 유지

그래프는 다음 기능을 유지한다.

zoom
pan
node drag
node hover highlight
디자인 스타일 유지

AIFIX 디자인 시스템 유지

Color

Primary #5B3BFA
Secondary #00B4FF
Background #F6F8FB

Font

Pretendard

Card

radius 16px
shadow subtle
마지막 UX 추천 (중요)

카드가 작아지면 정보 과부하를 막기 위해 hover 패널을 추가하는 것이 좋다.

노드 hover 시

회사 상세 정보
BOM 포함 여부
PCF 기여도
데이터 상태

tooltip 또는 side panel 표시.