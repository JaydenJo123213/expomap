# ExpoMap 개발 진행 현황 (2026-04-10)

## 대상 파일
`/Users/junhyunjo/Desktop/claude_agent/Expomap/expomap-starter/index.html`
GitHub: `https://github.com/JaydenJo123213/expomap` (branch: main)
최신 커밋: `0baffa3`
백업: `index.backup.20260410_164025.html`

---

## 완료된 작업

### K-PRINT PDF 출력
- `pdfMode: 'bgFill'` — BG 이미지를 A3에 꽉 채워 출력, BG 비율로 방향(portrait/landscape) 자동 결정
- 부스 색상 `#f6f9e8` (연한연두) — KIMES BUSAN 연분홍과 구분
- **3개 PDF 함수 모두 적용**: `exportFloorplanPDF`, `exportAvailablePDF`, `executeAssignGuideExport`
- 여백 0 (bgFill 모드), bounds = BG 이미지 영역 기준

### 배정안내 PDF 렌더링 통일
- `renderForAssignGuideExport`를 `exportFloorplanPDF`와 동일한 방식으로 통일
  - bounds/scale/translate 방식 일치
  - BG 항상 100% opacity (visible 무관)
  - 부스 업체명/부스번호 항상 표시 (배정 현황 확인용)
  - 기본부스번호 렌더링 로직 동일

### 구조물 렌더 순서 (부스 위에)
- 에디터(`render()`), 뷰어(`renderViewer()`), 모든 PDF 함수에서 `drawStructures` 호출을 부스 렌더링 **이후**로 이동
- `drawStructures` 시작 시 `globalAlpha = 1` 강제 → 부스 반투명(0.55)에 영향받지 않음
- 렌더 순서: BG → 기본부스번호 → 로고 → 부스 → **구조물** → 오버레이

### 방향키 이동
- 선택된 항목(부스/기본부스번호/구조물)에 방향키 이동 지원
- snap 모드 연동: Grid(G)=30px, Half(H)=5px, Free(F)=0.5px
- L자 부스의 `cells` 배열도 함께 이동
- 구조물: 기둥/원은 x/y, 선/벽/화살표는 양 끝점(x1y1, x2y2)

### 실측 레이어 (`showMeasure`)
레이어 패널에 "실측" 토글 추가. ON 시 아래 3가지 표시.

**① 부스 치수선** (`drawMeasureBooths`)
- 각 부스 상단에 가로 치수선, 좌측에 세로 치수선 (라벨 90° 회전)
- 외곽만 표시: 위에 붙은 부스 있으면 가로 스킵, 좌측에 붙은 부스 있으면 세로 스킵
- L자 부스는 cells AABB 기준
- offset: 부스 외곽에서 8px

**② 통로 폭** (`drawMeasurePassageways`)
- nearest-neighbor 쌍 탐색 (각 방향별, 10m 이내)
- 수평 통로(상하 gap): 두 부스의 겹침 X 구간 좌끝/우끝에 수직 치수선
- 수직 통로(좌우 gap): 두 부스의 겹침 Y 구간 위끝/아래끝에 수평 치수선
- 중복 방지: `Set("id1:id2:H|V")`
- 관계없는 부스로 범위 확장 안 함 (겹침 구간 그대로 사용)

**③ 기둥 거리** (`drawMeasureColumns`)
- 기둥/circle 구조물 대상
- 기둥이 부스 안에 있으면: 기둥 edge → 소속 부스 4방향 끝선까지 거리
- 기둥이 부스 밖이면: 해당 방향 15m 이내 가장 가까운 부스 edge까지
- 기둥 edge 기준 (center ± radius)

**스타일**: 색상 `#1E88E5`, 라벨 pill `rgba(30,136,229,0.15)`

---

## 진행 중 / 미완성 이슈

*(없음 — 아래 완료됨)*

---

## 다음 단계 (사용자 요청 예정 or 논의된 항목)

### 실측 레이어 추가 개선
- [x] 실측 레이어 PDF 출력 지원 — `exportFloorplanPDF`, `exportAvailablePDF`, `renderForAssignGuideExport` 모두에 `drawMeasureLayer(ctx, scale)` 추가 (showMeasure ON 시만 동작)
- [x] 통로 치수선 개선 — 겹침 구간 ≥ 60px(6m)이면 양끝, 아니면 중앙 하나만 표시 (기존 `> 1` 임계값 → 60px)
- [x] 기둥 치수선 방향 개선 — 부스 안 기둥: N/S 중 더 가까운 방향 하나, E/W 중 더 가까운 방향 하나만 표시 (최대 2선)

### 미구현 Phase (CLAUDE.md 기준)
- [ ] Phase D: 4단계 배정 워크플로우, 엑셀 Import + 컬럼 매핑, 사이드바 부스 목록
- [ ] Phase E: PDF Export 4 프리셋 고도화, 동시 편집, 레이어 시스템 6개, 스냅샷/버전 관리

---

## 주요 상수 / 규칙

```
PX_PER_METER = 10   (10px = 1m)
GRID_PX = 30        (3m 부스)
HALF_GRID_PX = 5    (0.5m)

EXHIBITIONS:
  kimes-busan-2026 → portrait A3, 부스색 #E0E0E0
  kprint-2026      → bgFill A3, 부스색 #f6f9e8, pdfMode: 'bgFill'

배정 상태 색상:
  available: #E0E0E0 / K-PRINT: #f6f9e8
  hold: #FF9800
  proposing: #FFC107
  assigned: #4CAF50
```

## 코딩 컨벤션
- 한국어 주석 OK, 변수/함수명 영어
- 부스: booth, block, island, zone
- 배정: available, hold, proposing, assigned
- 매핑 키: company_uid (부스번호 아님)
