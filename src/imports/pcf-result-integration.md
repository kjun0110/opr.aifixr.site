AIFIX – PCF 결과 조회 구조 통합 설계

너는 제조업 공급망 ESG / PCF 관리 SaaS AIFIX의 시니어 프로덕트 디자이너다.

현재 시스템에는 다음 화면이 존재한다.

1️⃣ PCF 산정 탭

원청사의 PCF 산정 실행 화면

제품 / 공급망 버전 / M-BOM / 기간 선택

공급망 데이터 준비 상태 확인

PCF 계산 실행

계산 결과 상세보기 페이지 존재

2️⃣ 데이터 관리 탭

공급망 데이터를 조회하는 화면

회사별 공급망 트리 구조

회사별 상세보기 존재

Excel 다운로드 기능 존재

그러나 현재 구조에서는

PCF 계산 결과가 데이터 관리 화면과 연결되지 않는 문제가 있다.

따라서 다음 기준에 따라 UI 구조를 개선하라.

1️⃣ 데이터 관리 화면에 PCF 결과 연결

데이터 관리 화면의 공급망 트리 테이블에서
각 회사의 PCF 상태를 다음과 같이 표시한다.

현재 컬럼

Tier
회사명
국가
회사 유형
납품량
제품 유형
PCF 결과
상태
상세보기

여기에 다음 규칙을 적용한다.

PCF 결과 표시 규칙
협력사

협력사는 자기 회사의 PCF만 표시

PCF 결과
= 해당 회사 제품 PCF

예시

Tier1 한국배터리
12,820 kg CO₂e
원청사

원청사는 최종 제품 PCF 표시

Tier0 삼성SDI
32,420 kg CO₂e
2️⃣ 상세보기 버튼 구조 분리

현재 데이터 관리 화면에서 모든 상세보기 버튼이 동일한 페이지로 이동한다.

이 구조를 다음처럼 분리한다.

① 회사 상세보기

목적

개별 회사 데이터 확인

조회 내용

회사 정보
사업장
제품 납품 정보
공정 데이터
해당 회사 PCF 결과

즉

회사 단위 PCF
② 공급망 PCF 상세보기 (신규)

원청 행(Tier0)에는 새로운 버튼을 추가한다.

버튼

공급망 PCF 보기

클릭 시 이동

공급망 PCF 계산 상세 페이지

이 페이지는 현재 존재하는

PCF 산정 상세보기 화면을 재사용한다.

구성

PCF 계산 메타정보
Computation Tree
협력사 기여도
데이터 품질 지표
배출량 Breakdown

즉

제품 PCF 전체 계산 구조

을 보여준다.

3️⃣ PCF 상태 표시 추가

데이터 관리 화면의 상태 컬럼을 개선한다.

현재

PCF 계산 완료
미산정
데이터 미제출

개선

PCF 계산 완료
PCF 계산 가능
하위 데이터 부족
데이터 미제출

판정 기준

하위 협력사 PCF 미완료 → 하위 데이터 부족
모든 협력사 완료 → PCF 계산 가능
원청 PCF 실행 완료 → PCF 계산 완료
4️⃣ Excel 다운로드에 PCF 시트 추가

현재 Excel 다운로드에는

공급망 구조
기업정보
사업장
납품제품
자재/품목
생산투입실적
공정운영
담당자

시트가 존재한다.

여기에 PCF 관련 시트를 추가한다.

신규 시트 1
PCF_RESULT

내용

companyId
companyName
tier
product
deliveredQuantity
pcfResult
pcfUnit
calculationStatus
dataCoverage
dqrScore

목적

회사별 PCF 결과 확인
신규 시트 2
PCF_BREAKDOWN

내용

product
stage
company
process
activityData
emissionFactor
emissionResult

예시

Material extraction
Cell production
Module assembly
Transport

목적

PCF 계산 과정 투명성 제공
신규 시트 3
PCF_SUPPLYCHAIN_SUMMARY

내용

product
supplyChainId
totalEmission
tier1Contribution
tier2Contribution
tier3Contribution
transportContribution

목적

공급망 전체 PCF 요약
5️⃣ 데이터 관리 화면에 PCF 필터 추가

조회 조건에 다음 필터를 추가한다.

PCF 상태

ALL
PCF 계산 완료
PCF 계산 가능
미산정
6️⃣ UX 개선

원청 행에 시각적 강조 추가

예시

Tier0 행 → 배경 강조

이유

최종 제품 PCF 위치 명확화
최종 UX 흐름

사용자 흐름은 다음과 같다.

데이터 입력
→ 협력사 PCF 계산
→ 원청 PCF 계산
→ 데이터 관리 탭 조회
→ 공급망 PCF 상세보기
→ Excel Export
🎯 추가 UX 제안 (중요)

지금 서비스 수준이면 이 기능 하나 넣으면 완성도 급상승한다.

데이터 관리 화면에

PCF 계산 트리 버튼

추가

PCF Tree

클릭 시

공급망 탄소 계산 트리

시각화

Tier0
 ├ Tier1
 │  ├ Tier2
 │  └ Tier2
 └ Tier1

이거는

ESG / 배터리 여권 / CBAM 시스템에서 매우 중요한 기능이다.