PDF 출력 관련 작업을 시작합니다.

## 읽어야 할 파일
- `js/pdf-export.js` — 모든 PDF 함수 (374줄)
  - `exportFloorplanPDF()` — 도면 출력 PDF
  - `exportAvailablePDF()` — 배정가능위치 PDF
  - `executeAssignGuideExport()` — 배정안내 PDF 실행
  - `renderForAssignGuideExport()` — 배정안내 렌더링
  - `renderForExport()` — 일반 PDF 렌더
  - `executeExport()` — PDF 내보내기 실행

## 의존 함수 (수정 필요 시 참조)
- `js/render.js` — `fillBoothShape`, `strokeBoothShape`, `drawBoothContent`, `drawStructures`
- `js/measure.js` — `drawMeasureLayer` (showMeasure ON 시 PDF에도 반영)
- `js/state.js` — `state`, `_currentExpo`, `VIEWER_STATUS_COLORS`

## 주요 규칙
- PDF 방향: `_bgFill` 모드 = BG 이미지 비율로 자동 결정 (portrait/landscape)
- 여백: bgFill 모드는 margin=0, 일반은 margin=10
- 포맷: A3, 300dpi
- 실측 레이어: `state.showMeasure === true`일 때 PDF에도 표시됨

이제 `js/pdf-export.js`를 읽고 작업을 시작하세요.
