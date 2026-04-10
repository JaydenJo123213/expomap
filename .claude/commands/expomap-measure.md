실측 레이어 관련 작업을 시작합니다.

## 읽어야 할 파일
- `js/measure.js` — 실측 레이어 전체 (260줄)
  - `drawMeasureLayer(ctx, zoom)` — 진입점 (state.showMeasure 가드 포함)
  - `drawMeasureBooths()` — 각 부스 가로/세로 치수선
  - `drawMeasurePassageways()` — 부스 간 통로 폭
  - `drawMeasureColumns()` — 기둥 ↔ 부스 거리
  - `drawDimension()` — 수평 치수선
  - `drawDimensionVertical()` — 수직 치수선 (라벨 90° 회전)

## 주요 규칙
- `PX_PER_METER = 10` (10px = 1m)
- 색상: `MEASURE_COLOR = '#1E88E5'`, 라벨 pill `rgba(30,136,229,0.15)`
- 통로 치수선: 겹침 구간 ≥ 60px(6m) → 양끝 2개, 미만 → 중앙 1개
- 기둥 치수선: 부스 안 기둥은 N/S·E/W 각 축에서 더 가까운 쪽만 (최대 2선)
- PDF 반영: `drawMeasureLayer`는 PDF export 함수에서도 호출됨 (`js/pdf-export.js`)

이제 `js/measure.js`를 읽고 작업을 시작하세요.
