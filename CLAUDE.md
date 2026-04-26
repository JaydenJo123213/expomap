# ExpoMap — Claude Code Instructions

## ⚠️ 환경 규칙 (반드시 준수)

**이 디렉토리는 운영 환경(PROD)입니다.**
- GitHub `JaydenJo123213/expomap`으로 배포 중인 git repo
- **코드 수정은 `Expomap/expomap_dev`에서 진행 후 반영하세요.**

### 운영 반영 절차

`expomap_dev`에서 검증 완료 후, 변경 파일만 복사:

```bash
cp Expomap/expomap_dev/js/state.js    Expomap/expomap-starter/js/state.js
cp Expomap/expomap_dev/js/supabase.js Expomap/expomap-starter/js/supabase.js
cp Expomap/expomap_dev/js/init.js     Expomap/expomap-starter/js/init.js
cp Expomap/expomap_dev/.claude/commands/expomap-add-expo.md \
   Expomap/expomap-starter/.claude/commands/expomap-add-expo.md
```

그 다음 git push:

```bash
git add js/state.js js/supabase.js js/init.js .claude/commands/expomap-add-expo.md
git commit -m "..."
git push
```

> **절대 금지**: `cp -r expomap_dev expomap-starter` 폴더 전체 복사

---

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

## 파일 구조 (작업 전 참조)

| 파일 | 담당 기능 |
|------|----------|
| `js/state.js` | state 객체, 상수, EXHIBITIONS, 색상 정의 |
| `js/supabase.js` | Supabase 연결, save/load, Presence 커서 |
| `js/booth-ops.js` | 부스 CRUD, merge/divide/copy, 구조물 편집, BG이미지, 로고, 번호부여, Excel import |
| `js/render.js` | render(), renderViewer(), 부스·구조물 렌더 헬퍼, drawGrid() |
| `js/measure.js` | 실측 레이어 (drawMeasureLayer, 치수선 함수) |
| `js/pdf-export.js` | PDF 3종 (exportFloorplanPDF, exportAvailablePDF, renderForAssignGuideExport) |
| `js/events.js` | 마우스·키보드·터치 이벤트 핸들러 |
| `js/ui.js` | 툴바, 레이어 패널, 속성 패널, 통계, DB 모달 |
| `js/init.js` | showExpoSelector, applyExhibitionBranding, init() |

## 작업 전 필독: 에이전트 라우팅 규칙

업무 지시를 받으면 아래 표를 먼저 확인하고, **해당 파일들만** 읽어서 작업하세요. 불필요한 파일은 읽지 마세요.

| 업무 유형 | 읽을 파일 | Skill 명령 |
|---------|---------|-----------|
| DB 저장/로드, state 구조 변경, Undo/Redo, 전시회 추가 | state.js, supabase.js, booth-ops.js, init.js | `/expomap-backend` |
| 렌더링 버그, 스냅 로직, 마우스/키보드 이벤트, 실측선 | render.js, measure.js, events.js | `/expomap-canvas` |
| 패널 UI, 모달, 속성창, 레이어, CSS, 버튼 | ui.js, index.html | `/expomap-ui` |
| PDF 내보내기, 프리셋 수정 | pdf-export.js | `/expomap-pdf` |

두 영역에 걸치는 작업만 여러 파일을 읽을 것.

**Skill 명령 사용 예시:**
- `/expomap-backend measureLines 저장 누락 확인`
- `/expomap-canvas 부스 클릭 감지 안 되는 버그 수정`
- `/expomap-ui 우측 패널에 새 속성 섹션 추가`
- `/expomap-pdf sales 프리셋 회사명 표시 안 되는 버그`

## 기술 스택
- **현재**: HTML + vanilla JS, 파일 분리 (`js/*.js`)
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
