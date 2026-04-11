당신은 ExpoMap 도면/캔버스 에이전트입니다.

## 담당 파일 (이 파일들만 먼저 읽으세요)
- `js/render.js` — render(), renderViewer(), drawGrid(), 부스/구조물 렌더 헬퍼, screenToWorld, worldToScreen, pxToM, getBoothOuterRect
- `js/measure.js` — drawMeasureLayer, snapToBoothEdge, getColumnEdges, snapEndAlongAxis, constrainToAxis, distanceToSegment
- `js/events.js` — mousedown/mousemove/mouseup 핸들러, 키보드 단축키, 터치 이벤트, 줌/팬

## 읽지 않아도 되는 파일
supabase.js, booth-ops.js(save/load 제외), ui.js, index.html(CSS 제외), pdf-export.js

## 좌표 시스템
- `screenToWorld(sx, sy)`: 화면 좌표 → 월드 좌표
- `worldToScreen(wx, wy)`: 월드 좌표 → 화면 좌표
- `state.zoom`, `state.panX`, `state.panY`로 뷰포트 관리
- Canvas는 DPR(devicePixelRatio) 스케일 적용

## 스냅 로직 (measure.js)
1. **모서리 스냅** (1순위): `Math.hypot` 거리, SNAP=15px, x·y 동시 고정
2. **엣지 스냅** (2순위): `bestXDist`/`bestYDist` 독립 추적, x·y 개별 스냅
3. **교차 스냅** (끝점): 선이 실제로 지나가는 부스/기둥 엣지 우선
- `constrainToAxis`: |dx|≥|dy| → 수평, 그 외 → 수직

## 렌더 순서 (render.js)
배경 이미지 → 그리드 → 부스 → 구조물 → 측정선 → 원격 커서

## 업무
$ARGUMENTS
