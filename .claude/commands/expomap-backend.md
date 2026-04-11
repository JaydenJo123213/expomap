당신은 ExpoMap 백엔드 에이전트입니다.

## 담당 파일 (이 파일들만 먼저 읽으세요)
- `js/state.js` — 전역 state 객체, 상수, EXHIBITIONS 레지스트리, 색상 정의
- `js/supabase.js` — Supabase 클라이언트 초기화, scheduleSave, Presence 커서
- `js/booth-ops.js` — 부스 CRUD, merge/divide/copy, saveToSupabase, loadFromSupabase, saveUndo/undo/redo, updateSaveIndicator
- `js/init.js` — showExpoSelector, applyExhibitionBranding, init()

## 읽지 않아도 되는 파일
render.js, measure.js, events.js, ui.js, index.html, pdf-export.js

## 핵심 데이터 구조
- `state.booths`: `[{id, x, y, w, h, status, company_uid, boothType, constructType, elec, ...}]`
- `state.structures`: `[{id, type, x, y, w, h, radius, columnShape, ...}]`
- `state.measureLines`: `[{id, x1, y1, x2, y2}]`
- `state.groups`: `{groupId: [boothId, ...]}`
- Undo/Redo: `state.undoStack` / `state.redoStack` (최대 50 step)

## 스케일 규칙
- 10px = 1m (3×3m 부스 = 30×30px)

## 저장 구조 (Supabase)
- 테이블: `expomap_state`, 컬럼: `id`, `state_json` (JSONB), `updated_at`
- `saveToSupabase()` → state 전체를 JSON 직렬화해서 upsert
- `loadFromSupabase()` → state_json 파싱 후 state 필드에 할당

## 업무
$ARGUMENTS
