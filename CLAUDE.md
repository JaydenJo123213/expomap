# ExpoMap — Claude Code Instructions

## 이 프로젝트는 뭔가
전시회 도면 시각화 + 부스 배정 웹 플랫폼.
"이미 있는 DB에 눈을 달아주는 것" — 엑셀 업로드 → 도면 위에서 배정 → PDF 출력.

## 핵심 설계서
- `docs/SPEC.md` — 전체 설계 사양 (반드시 참고)
- `docs/ExpoMap_v3.4_Design_Spec.docx` — 공식 문서 버전

## 개발 순서 (MVP)

### Phase A: Canvas Foundation
1. HTML5 Canvas (Konva.js) 기본 셋업
2. 줌/패닝/그리드 렌더링
3. 3×3m 부스 블럭 그리기
4. 블럭 선택/이동/삭제
5. 스냅 모드 3단계 (Grid 3m / Half-Grid 0.5m / Free)

### Phase B: Block Operations
6. Merge (Shift+클릭 → Ctrl+M)
7. Divide (Ctrl+D)
8. 복사 4종 (Alt+Drag, Ctrl+Shift+C, Ctrl+D, 배열복사)
9. 아일랜드 그룹 (Ctrl+G / Ctrl+Shift+G / 더블클릭)
10. Undo/Redo (50 step)

### Phase C: Floor Plan
11. 배경 이미지 업로드 + 캘리브레이션
12. 구조물 (기둥, 벽면, 출입구)
13. 부스번호 체계 (구역+번호)
14. 부스 속성 (타입, 시공방식, 전기, 급수)

### Phase D: Assignment
15. 4단계 배정 워크플로우 (배정가능/홀딩/배정중/배정완료)
16. 엑셀 Import + 컬럼 매핑
17. 부스 검색 + 필터
18. 사이드바 부스 목록

### Phase E: Export & Collab
19. PDF Export (4 프리셋)
20. 동시 편집 (object locking + live cursor)
21. 레이어 시스템 (6개)
22. 스냅샷/버전 관리

## 기술 스택
- **현재**: 단일 HTML + vanilla JS (프로토타입)
- **목표**: Next.js + TypeScript + Konva.js + Supabase + Tailwind

## 코딩 컨벤션
- 한국어 주석 OK
- 변수명/함수명은 영어
- 부스 관련: booth, block, island, zone
- 배정 관련: available, hold, proposing, assigned
- 매핑 키: company_uid (부스번호 아님)

## 스케일 규칙
- 10px = 1m
- 3×3m 부스 = 30×30px
- fill 영역 기준 (stroke 제외)
- 인접 블럭은 테두리 겹침 → 누적오차 0

## 색상 체계
### 배정 상태
- 배정가능: #E0E0E0 (회색)
- 홀딩: #FF9800 (주황)
- 배정중: #FFC107 (노랑)
- 배정완료: #4CAF50 (초록)

### 시공 방식
- organizer: #4CAF50 (초록)
- self: #2196F3 (파랑)
- designated: #9C27B0 (보라)

### 전기
- 110V: #FFF9C4 (연회)
- 220V: #FF9800 (주황)
- custom: #F44336 (빨강)
