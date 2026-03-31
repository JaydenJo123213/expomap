# ExpoMap v3.4 — Product Design Specification

> **"이미 있는 DB에 눈을 달아주는 것"**
> 참가신청 플로우 안 바꿈. 홈페이지 안 바꿈.
> 관리자 페이지에서 엑셀 다운 → ExpoMap에 업로드 → 도면 위에서 배정 → PDF로 업체 안내

- **Version**: 3.4 (Final)
- **Date**: 2026-03-27
- **Author**: Jayden / Korea E&X
- **Status**: Design Complete — Ready for Development

---

## 1. Executive Summary

ExpoMap은 전시회 주최사를 위한 **도면 시각화 + 부스 배정 플랫폼**이다.
A2Z/ShowYourMap/Expocad 같은 올인원이 아니라, **도면 위에서 배정하는 것에만 집중**한다.

### Target Users
- Primary: 세일즈팀 3~5명 동시 접속
- Secondary: 시공팀(도면 참조), 시설팀(설비 계획), 경영진(현황 대시보드)

---

## 2. MVP Specification

| Parameter | Spec |
|-----------|------|
| Concurrent Users | 3~5명 (세일즈팀) |
| Data IN | 엑셀 Import (company_uid 매핑 키) |
| Data OUT | PDF Export (엑셀 Export 없음) |
| Mapping Key | company_uid (부스번호가 아님) |
| Default View | 배정현황 레이어 — 빈 부스(회색)가 한눈에 |
| Platform | Web (반응형). Supabase + Next.js 또는 React SPA |
| API | 후순위 (Phase 4) |

### Tech Stack
- **Frontend**: Next.js 14+ (App Router) + TypeScript
- **Canvas**: Konva.js (react-konva) 또는 Fabric.js
- **State**: Zustand (global) + React Query (server)
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **PDF**: pdf-lib 또는 Puppeteer (server-side)
- **Styling**: Tailwind CSS

---

## 3. Coordinate System

- **스케일**: 10px = 1m (30px = 3m). 프로젝트 설정에서 변경 가능
- **치수 기준**: 채움 영역(fill) 기준. 테두리(stroke)는 시각적 장식
- **블럭 2개 붙이면**: 테두리가 겹쳐서 1줄로 보임. 누적 오차 = 0
- **좌표 원점**: 캔버스 좌상단

---

## 4. Background Floor Plan

### Import
COEX CAD/PDF → 이미지(JPG/PNG) 변환 → 업로드

### Calibration
두 점 클릭 + 실제 거리(m) 입력 → 스케일 자동 계산

### Controls
- 켜기/끄기 토글
- 투명도 조절
- 여러 장 올리기 (홀별)
- 위치/크기 조정
- 잠금

---

## 5. Drawing Tools

### 5.1 Booth Blocks

기본 단위: **3×3m (9㎡)**

#### Edit Modes (3단계)
| Mode | Shortcut | Snap |
|------|----------|------|
| Grid | G | 3m |
| Half-Grid | H | 0.5m |
| Free | F | 없음 |

#### Merge
Shift+클릭 다중선택 → Ctrl+M
- 인접성 검증 + 직사각형 검증
- 비직사각형 → 경고

#### Divide
Ctrl+D → 방향 + 분할수 선택 → 미리보기 → 확인
- 최소 1칸

#### Undo/Redo
Ctrl+Z / Ctrl+Shift+Z — 최대 50단계

### 5.2 Building Structures

| 구조물 | 설명 |
|--------|------|
| 기둥 | 원형/사각형. 클릭으로 위치+크기 입력 |
| 벽면 | 직선 (MVP) + 베지어 곡선 (Phase 2) |
| 출입구 | 벽면 위 문 표시 |
| 비상구 | 비상구 아이콘 |
| 화장실/엘리베이터 | 영역 박스 |
| 물/전기 인입구 | 점 또는 라인 마커 |

### 5.3 Text & Images
- 텍스트 입력 (전시회명, 홀번호 등)
- 이미지 업로드 (로고 PNG/SVG)
- 도면 여백에 배치

---

## 6. Island System

### Default Size
2열 × 5행 = 10칸 (6m × 15m) — KIMES 기준. 변경 가능

### Group Behavior
- **Ctrl+G**: 그룹화
- **클릭**: 전체 선택
- **더블클릭**: 내부 접근
- **Ctrl+Shift+G**: 그룹 해제

### Internal Layout
- 모든 내부 블럭 = 3×3m
- 블럭 사이 간격 = 0 (바로 붙어있음)
- 큰 부스 → Merge로 합치기

### Zones
사용자 자유 정의. 아일랜드 1개 = 1구역 또는 홀 전체 = 1구역

---

## 7. Copy Operations (4 Types)

| # | Method | Shortcut | Description |
|---|--------|----------|-------------|
| 1 | Snap Copy | Alt+Drag | 드래그하면서 복사 |
| 2 | Numeric Offset | Ctrl+Shift+C | x/y 오프셋 직접 입력 |
| 3 | Repeat | Ctrl+D | 직전 복사 동작 반복 |
| 4 | Array Copy | Dialog | 가로 N개, 세로 M개, 간격 지정 |

통로 폭 (보통 3m, 3.5m, 4.3m 등) → 수치 입력 복사로 정밀 제어

---

## 8. Dimension Display

평소에는 숨김. 호버/클릭 시에만 표시.
- 부스 블록: 안에 작은 글씨 (예: 3m×3m)
- 통로: 통로 폭
- 아일랜드: 전체 가로/세로

---

## 9. Booth Numbering

- 형식: 구역(A,B,C…) + 번호(01,02…) = A-01, A-02, B-01…
- 구역: 통로로 구분. 사용자 자유 정의
- 번호 순서 방향: 사용자 지정
- 더블클릭으로 수동 편집

---

## 10. Booth Properties

| Property | Values | Layer |
|----------|--------|-------|
| 부스 타입 | assembled(조립) / independent(독립) | 부스타입 |
| 시공 방식 | organizer(주최사) / self(자체) / designated(지정업체) | 시공방식 |
| 전기 | 110V / 220V / custom / none | 전기/설비 |
| 급수/배수 | none / supply / drain / both | 전기/설비 |

### Business Rules
- 조립 = 항상 organizer
- 독립만 self 또는 designated 가능

### Construction Colors
- organizer = 초록, self = 파랑, designated = 보라

### Booth Decoration
- 내부 텍스트, 색상 직접 지정, 테두리 스타일, 아이콘/마커

---

## 11. Assignment Workflow — 4 Stages

| Status | Color | Description |
|--------|-------|-------------|
| 배정가능 | 회색 | 빈 부스 |
| 홀딩블럭 | 주황 | 주최사 임의 잠금. **메모 필수** |
| 배정중 | 노랑 | 업체에 1개 이상 위치 제안. 다른 담당자 차단. 점선 연결 |
| 배정완료 | 초록 | 확정. company_uid → DB에서 정보 자동 불러옴. 계약서 업로드 |

### State Transitions
```
배정가능 → 홀딩 / 배정중 / 배정완료
홀딩 → 배정가능(해제) / 배정중
배정중 → 배정완료(확정1개, 나머지 자동복귀) / 배정가능(전체취소)
배정완료 → 배정가능(취소, 사유 필수)
```

### Company Guidance Flow
1. 모든 배정 단계에서 PDF 내보내기 가능
2. "3곳 중 골라주세요" → 3개 부스 하이라이트 PDF → 업체 전달

---

## 12. Excel Import

### Fields
| Field | Required | Description |
|-------|----------|-------------|
| company_uid | Yes (Key) | 참가기업 고유번호. 매핑 키 |
| company_name | Yes | 업체명 |
| booth_id | No | 사전 배정된 부스번호 |
| booth_type | No | assembled / independent |
| booth_size | No | 요청 부스 크기 |
| contact_name | No | 담당자명 |
| contact_phone | No | 연락처 |
| preferred_location | No | 선호 위치 메모 |
| note | No | 비고 |

### Import Flow
1. 업로드 → 2. 컬럼 매핑 → 3. 미리보기 → 4. Diff 비교(재업로드 시) → 5. 확정
- 재업로드: 신규/수정/충돌 표시. ExpoMap 유지 vs 엑셀 덮어쓰기 선택

---

## 13. PDF Export

엑셀 Export 없음. PDF + PNG만.

### 5 Presets
| # | Preset | Description |
|---|--------|-------------|
| 1 | 시공팀용 | 치수 전체, 업체명 없음, 흑백, 시공구역 빗금 |
| 2 | 영업팀용 | 업체명 + 상태 색상 |
| 3 | 업체안내용 | 모든 부스 회색 + 선택 부스만 강조 (내부 상태 비공개) |
| 4 | 대형출력용 | 영역 선택 + 용지 크기(A0/A1/A3) |
| 5 | 참관객용 | Phase 5 |

---

## 14. Collaborative Editing

### Object Locking
- 단위: 개별 부스
- 클릭 → 자동 잠김
- 30초 미조작 → 자동 해제
- "홍길동 편집 중" 툴팁 + 클릭 차단 + 색상 테두리

### Live Cursors
Figma 스타일. Supabase Realtime 브로드캐스트.

---

## 15. Canvas Layers (6)

| Layer | Color Scheme | User |
|-------|-------------|------|
| **배정현황 (기본)** | 배정가능=회, 홀딩=주황, 배정중=노랑, 배정완료=초록 | 영업팀 |
| 부스타입 | 조립=초록, 독립=파랑 | All |
| 시공방식 | 주최사=초록, 자체=파랑, 지정업체=보라 | 시공팀 |
| 전기/설비 | 110V=연회, 220V=주황, custom=빨강 | 시설팀 |
| 파빌리온 | 파빌리온별 커스텀 색상 | 경영진 |
| 시공구역 | 빗금 패턴 오버레이 | 시공팀 |

---

## 16. Zoom Level Text

| Zoom | 표시 정보 | 빈 부스 |
|------|----------|--------|
| 줌 아웃 | 색상 + 부스번호 | 번호만 |
| 줌 중간 | 부스번호 + 업체명 | 번호만 |
| 줌 인 | 부스번호 + 업체명 + 칸수 | 번호만 |

---

## 17. Version Control

- 매일 자정 자동 스냅샷
- 날짜별 확인 + 복원
- 복원 전 현재 상태 자동 스냅샷
- 보관: 90일
- 수동 백업 가능

---

## 18. D-Day Mobile View

- **읽기 전용**. 편집 불가
- 부스 위치 확인 + 업체 검색
- 터치 최적화 (줌/패닝)
- 같은 URL, 반응형 자동 전환

---

## 19. Edge Cases

| Case | Description |
|------|-------------|
| 시공구역 | 부스 내부 일부만 공사 → 빗금 패턴 |
| 분산 부스 | 한 업체 여러 위치 → company_uid 연결 + 점선 |
| 서브부스 | 큰 부스 안 소규모 업체 → parent-child 구조 |
| 파빌리온/특별관 | 여러 부스 그룹핑 → 커스텀 색상+경계+필터 |
| NES | 통로/휴게실/세미나실/기둥/빈공간 |

---

## 20. Validation Rules (13)

| # | Rule | Severity |
|---|------|----------|
| 1 | 부스번호 중복 | ERROR |
| 2 | 부스 겹침 | ERROR |
| 3 | 비정상 간격 | WARN |
| 4 | 그리드 정렬 | WARN |
| 5 | 미연결 블럭 | WARN |
| 6 | 부스번호 형식 | ERROR |
| 7 | 면적 이상치 | INFO |
| 8 | 번호 연속성 | INFO |
| 9 | Hold 만료 임박 | WARN |
| 10 | 서브부스 범위 초과 | ERROR |
| 11 | NES-부스 겹침 | WARN |
| 12 | 통로 폭 미달 | WARN |
| 13 | 기둥-부스 충돌 | ERROR |

---

## 21. Convenience Features

### MVP
- **부스 검색**: 업체명/부스번호 → 자동 이동+하이라이트
- **필터**: 빈부스만, 3칸 이상만, 특정 구역만
- **부스 목록 사이드바**: 도면 옆 리스트
- **담당자별 통계**: 홍길동 15건, 김철수 10건
- **담당자 코멘트**: 부스별 대화

### Additional Tools
- 거리 측정 (두 점 클릭 → 거리)
- 정렬 가이드라인 (드래그 시 스마트 가이드)
- 객체 정보 패널 (x/y/w/h 수치 표시/수정)

---

## 22. Settings & Admin

- 로그인/권한 (관리자 vs 일반)
- 프로젝트 설정 (그리드 크기, 부스번호 컨벤션, 프로젝트명)
- 데이터 백업/복원
- **프로젝트 복사**: 전년도 → 올해 (레이아웃 유지, 업체 데이터 초기화)
- 공유 링크 (URL, 로그인 필요)

---

## 23. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| G / H / F | Grid / Half-Grid / Free 모드 |
| Ctrl+G | 그룹화 (아일랜드) |
| Ctrl+Shift+G | 그룹 해제 |
| Ctrl+M | Merge |
| Ctrl+D | Divide 또는 반복 복사 |
| Ctrl+Shift+C | 수치 입력 복사 |
| Alt+Drag | 스냅 복사 |
| Ctrl+Z / Ctrl+Shift+Z | Undo / Redo |
| Ctrl+0 / Ctrl+1 | 전체보기 / 100% |
| Shift+Click | 다중 선택 |
| Double-click | 그룹 내부 접근 / 부스번호 편집 |
| Delete | 삭제 |
| Space+Drag | 캔버스 패닝 |

---

## 24. Floor Plan Creation Workflow

1. 배경 도면 업로드 + 캘리브레이션
2. 구조물 그리기 (벽면, 기둥, 출입구, 비상구, 화장실/엘베)
3. 아일랜드 그리기 (3×3 → 10칸 → 그룹화 → 복사/배열복사)
4. 벽면 부스 배치
5. 부스번호 배정
6. 엑셀 Import
7. 로고/텍스트 배치

> 전년도 복사 시: 1~5번 완료 상태. 6~7번만 수행

---

## 25. Roadmap

| Phase | Scope |
|-------|-------|
| **MVP** | 도면에디터 + 엑셀Import + 4단계배정 + Realtime + PDF4종 + 검색/필터 + 사이드바/통계/코멘트 + 모바일뷰 + 검증13개 + 스냅샷 + 로그인/설정 |
| Phase 2 | 시공구역 + 서브부스 + 파빌리온 + NES + 베지어벽면 + 일괄상태변경 + 도면메모 + 부스히스토리 |
| Phase 3 | 계약서 + 타임라인 + 알림 + 버전비교 |
| Phase 4 | API 연동 (SI 스웨거) → 엑셀 제거 |
| Phase 5 | 참관객 공개 도면 |

---

## 26. Database Tables

### Core
- `projects` — 프로젝트 메타 (이름, 스케일, 그리드 설정)
- `booths` — 부스 레코드 (위치, 크기, 번호, 타입, 상태, 배정 업체)
- `companies` — 엑셀에서 Import한 업체 마스터
- `booth_proposals` — 배정중 상태 추적 (어떤 부스를 어떤 업체에 제안)
- `contracts` — 계약서 파일 업로드

### Structures
- `structures` — 기둥, 벽면, 출입구, 비상구, 화장실, 설비
- `island_groups` — 아일랜드 그룹 정의
- `decorations` — 텍스트, 이미지, 시각 오버레이

### Extended (Phase 2+)
- `pavilions` — 파빌리온/특별관
- `nes_spaces` — Non-Exhibitor Space
- `construction_zones` — 시공구역

### System
- `booth_history` — 부스 상태 변경 감사 로그
- `import_logs` — 엑셀 Import 이력
- `snapshots` — 자동/수동 스냅샷
- `object_locks` — 실시간 편집 잠금
- `pdf_presets` — PDF Export 설정
