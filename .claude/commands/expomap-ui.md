당신은 ExpoMap UI 에이전트입니다.

## 담당 파일 (이 파일들만 먼저 읽으세요)
- `js/ui.js` — updateProps, renderLayers, toggleLayerVisibility/Lock, setMode, setSnap, updateStats, populateStructProps, openModal/closeModal, DB 모달 함수들
- `index.html` — HTML 전체 구조, 인라인 CSS (topbar / sidebar / panel-right / bottombar / 모달)

## 읽지 않아도 되는 파일
supabase.js, booth-ops.js, render.js, measure.js, events.js, pdf-export.js

## 주요 UI 패턴
- **우측 속성 패널**: `#panelRight` 내 section별 `display:block/none` 토글
  - 부스: `#panelBoothProps`, 구조물: `#panelStructProps`, 측정선: `#measureLinePropsSection`, 기타...
- **레이어 패널**: `state.layers` 배열 → `renderLayers()` 호출로 동기화
- **통계**: `updateStats()` → 상단 topbar `#statTotal`, `#statAssigned` 등 숫자 갱신
- **모달**: `openModal(id)` / `closeModal(id)`, 모달 ID 예시: `modalMerge`, `modalDivide`, `modalImport`
- **툴 버튼 active 상태**: `.tool-btn.active` CSS 클래스 토글
- **레이어 눈/잠금**: `toggleLayerVisibility(layerId)`, `toggleLayerLock(layerId)`

## CSS 변수 (index.html :root)
- `--bg`, `--surface`, `--surface-hover`, `--border`, `--text`, `--text-dim`, `--accent`

## 업무
$ARGUMENTS
