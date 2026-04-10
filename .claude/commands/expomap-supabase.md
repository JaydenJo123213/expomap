Supabase 데이터 연동 관련 작업을 시작합니다.

## 읽어야 할 파일
- `js/supabase.js` — Supabase 연결 + Presence (187줄)
  - `initSupabase()` — Supabase 클라이언트 초기화
  - `saveSupaConfig()` — 상태 저장 (booth, structures, baseNumbers 등)
  - `scheduleSave()` — 디바운스 저장
  - `initPresenceChannel()` — 실시간 커서 채널
  - `broadcastCursorPosition()`, `broadcastCursorLeave()`
  - `pruneStaleRemoteCursors()`, `drawRemoteCursors()`

## 주요 규칙
- 저장 키: `expomap_bg_dataurl_{projectId}` (localStorage 폴백)
- Presence: 실시간 커서 공유 (같은 전시회 내 다중 사용자)
- `_supaClient` 전역 변수로 연결 상태 확인

이제 `js/supabase.js`를 읽고 작업을 시작하세요.
