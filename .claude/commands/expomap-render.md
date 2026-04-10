부스/캔버스 렌더링 관련 작업을 시작합니다.

## 읽어야 할 파일
- `js/render.js` — 메인 렌더링 엔진 (1129줄)
  - `render()` — 에디터 메인 렌더
  - `renderViewer()` — 뷰어 렌더
  - `drawGrid()` — 격자 렌더
  - `fillBoothShape()`, `strokeBoothShape()` — 부스 모양 렌더
  - `drawBoothContent()` — 업체명/부스번호/뱃지 렌더
  - `drawBoothWarnings()`, `drawElecBadges()`, `drawOtherBadges()`
  - `drawStructures()` — 구조물 렌더
  - `drawBaseNumbers()`, `drawDiscussOverlays()`, `drawLogos()`

## 렌더 순서 (중요)
BG → baseNumbers → logos → booths → structures → measure → overlays

## 의존 파일
- `js/state.js` — `state`, `STATUS_COLORS`, `VIEWER_STATUS_COLORS`, `PX_PER_METER`
- `js/measure.js` — `drawMeasureLayer` (render 내에서 호출)
- `js/booth-ops.js` — `getBoothOuterRect`, `getBoothGroup`

## 스케일 규칙
- `PX_PER_METER = 10` (10px = 1m)
- `GRID_PX = 30` (3m 부스)
- L자 부스: `b.cells` 배열 기준 렌더

이제 `js/render.js`를 읽고 작업을 시작하세요.
