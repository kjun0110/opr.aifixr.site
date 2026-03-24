AIFIX – 제품 그룹 / 세부제품 공급망 UX 개선 + BOM 비교 기능

현재 설계된 프로젝트 / 공급망 화면을 개선한다.

목표는 제품 그룹 공급망 구조를 유지하면서 세부제품(BOM) 차이를 직관적으로 표시하는 UX를 구현하는 것이다.

현재 UI 구조는

조회조건 → 제품 / 세부제품 선택 → 공급망 표시

인데,
이 구조는 제품과 BOM이 같은 레벨 UI에서 처리되는 문제가 있다.

실제 데이터 구조는 다음과 같다.

프로젝트
   └ 제품 그룹
        └ BOM (세부제품)

따라서 UI도 이 데이터 구조와 동일하게 변경한다.

1️⃣ 제품 선택 UI 변경

현재

제품
세부제품

두 개의 드롭다운 구조를 다음 방식으로 변경한다.

제품 그룹 → 상단 탭 구조

조회 조건 영역 바로 아래에 제품 그룹 탭을 추가한다.

예시

제품A   제품B   제품C

스타일

pill tab UI

active 색상 #5B3BFA

inactive 배경 #F6F8FB

텍스트 Pretendard 600

탭을 클릭하면

해당 제품 그룹 공급망 모식도 로드

제품 그룹은 공급망 구조의 기준 단위이다.

2️⃣ 세부제품 선택 UI 변경

세부제품은 공급망 필터 역할로 변경한다.

위치

공급망 구조 카드 상단 오른쪽

UI

세부제품 선택 ▽

dropdown 목록

ALL
A'
A''
A'''

ALL 선택 시

제품 그룹 전체 공급망 표시
3️⃣ 세부제품 선택 시 공급망 표시 방식

제품 그룹 공급망 구조는 항상 동일하게 유지한다.

세부제품 선택 시

해당 세부제품에 포함되는 협력사

스타일

opacity 100%
border highlight
background highlight
해당 세부제품에 포함되지 않는 협력사

스타일

opacity 30%

이 방식으로

BOM 차이 시각화

를 구현한다.

사용자는 공급망 구조를 유지하면서 BOM 차이를 직관적으로 확인할 수 있다.

4️⃣ 공급망 카드 UI 개선

각 회사 카드에 BOM 포함 여부 정보를 추가한다.

예시

BOM A' ✓
BOM A'' ✓
BOM A''' -

또는

Included in A'

스타일

small badge group
5️⃣ 공급망 구조 상단 정보 표시

공급망 카드 상단에 다음 정보를 표시한다.

Customer : BMW
Branch : BMW Munich
Project : 2026 Battery Program
Product Group : 제품A
BOM Code : SCV-2026-01

스타일

info badge group
background #E9F5FF
text #2A64E0
6️⃣ BOM 비교 기능 (중요 기능)

세부제품 BOM이 바뀌면 공급망도 달라질 수 있다.

이를 직관적으로 보여주기 위해 BOM 비교 UI를 추가한다.

세부제품 선택 dropdown 옆에 다음 토글 버튼을 추가한다.

BOM 비교

토글 ON 시

공급망 카드 우측에 BOM 비교 열을 표시한다.

예시

회사명          A'    A''    A'''
한국배터리      ✓     ✓      -
글로벌소재      ✓     -      -
화학소재        ✓     ✓      ✓
셀테크          -     ✓      ✓

표시 규칙

✓ = 해당 BOM에 포함
- = 해당 BOM에 미포함

이 기능을 통해 사용자는

세부제품 BOM 변경으로 인한 공급망 차이

를 쉽게 확인할 수 있다.

7️⃣ 공급망 카드 상단 액션 버튼

공급망 카드 우측 상단에 버튼 추가

+ 1차 협력사 추가

스타일

secondary button
border #5B3BFA
text #5B3BFA
radius 12px
8️⃣ UI 레이아웃 최종 구조

최종 UI 구조는 다음과 같다.

조회 조건
   고객사
   지사
   프로젝트 기간

제품 그룹 탭
   제품A | 제품B | 제품C

공급망 카드
   세부제품 선택
   BOM 비교 토글
   + 1차 협력사 추가

공급망 트리
   Tier0
   Tier1
   Tier2
   Tier3
9️⃣ 디자인 스타일

기존 AIFIX 디자인 시스템 유지

Color

Primary #5B3BFA
Secondary #00B4FF
Background #F6F8FB

Font

Pretendard

Card

radius 20px
shadow subtle
padding 24px

UI 톤

Modern
Clean
Tech
Trustful
🔟 UX 설계 의도

이 구조는 데이터 구조와 UX 구조를 일치시키기 위한 설계이다.

데이터 구조

프로젝트
   └ 제품 그룹
        └ BOM (세부제품)

UX 구조

제품 그룹 = 공급망 구조 기준
세부제품 = BOM 필터 / 비교 기능

이 방식으로

공급망 구조 안정성
BOM 차이 가시성
데이터 구조 명확성

을 동시에 확보한다.