Figma / UI 동작 수정 프롬프트

현재 공급망 그래프에서 노드 카드를 드래그하면
손을 놓는 순간 원래 위치로 자동 복귀하는 문제가 발생한다.

이 문제는 그래프가 자동 Tree Layout 모드로 계속 재정렬되기 때문이다.

다음 방식으로 동작을 수정한다.

1️⃣ 그래프 레이아웃 모드 추가

공급망 그래프 상단에 다음 버튼을 추가한다.

Auto Layout
Manual Layout

스타일

pill toggle button
2️⃣ Auto Layout 모드

Auto Layout 모드에서는

Tree Layout 자동 정렬

규칙

Tier0 → 상단
Tier1 → 2번째 줄
Tier2 → 3번째 줄
Tier3 → 4번째 줄

노드는 부모 중심으로 정렬한다.

이 모드에서는

drag 이동 불가
3️⃣ Manual Layout 모드

Manual Layout 모드에서는

노드 drag 이동 가능

동작

drag → 위치 유지
auto layout 재계산 금지

노드 위치는

canvas 좌표 기준으로 저장
4️⃣ Reset Layout 버튼 추가

Manual Layout 사용 후

Reset Layout

버튼을 제공한다.

동작

Tree Layout 자동 재정렬
5️⃣ 그래프 인터랙션 개선

노드 이동 시

connector line 자동 재연결

애니메이션

ease-in-out 200ms
하나 더 (UX적으로 매우 중요한 것)

지금 화면에서 노드 간 간격이 좁아질 수 있음.

그래서 drag 영역을 조금 더 넓히는 것이 좋다.

그래프 canvas padding 추천

padding: 120px
지금 화면은 사실 꽤 잘 만들어진 상태

현재 UI 수준은 이미

공급망 시각화
BOM 비교
세부제품 필터

까지 있어서 데모용으로 충분히 좋다.

여기에 딱 두 가지만 추가하면 완성도 크게 올라감

1️⃣ 자동정렬 / 수동정렬 토글
2️⃣ PCF 기여도 강조

예

한국배터리
CO₂ 기여도 42%

이거 넣으면

공급망 관리 → PCF 분석

스토리가 자연스럽게 연결됨.