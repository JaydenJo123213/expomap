# ExpoMap

전시회 도면 시각화 + 부스 배정 플랫폼

## 시작하기

```bash
# 프로토타입 실행 (브라우저에서 열기만 하면 됨)
open index.html
```

## 파일 구조

```
expomap/
├── index.html          ← 프로토타입 (바로 브라우저에서 열기)
├── CLAUDE.md           ← Claude Code가 참고하는 프로젝트 컨텍스트
├── README.md
└── docs/
    ├── SPEC.md         ← 전체 설계 사양 (Claude Code 참조용)
    └── ExpoMap_v3.4_Design_Spec.docx  ← 공식 설계서
```

## 프로토타입 기능

현재 index.html에 구현된 기능:
- ✅ Canvas 기반 도면 에디터
- ✅ 줌/패닝 (스크롤 + Space+Drag)
- ✅ 3m 그리드 렌더링
- ✅ 부스 블럭 그리기 (B키 → 드래그)
- ✅ 선택/다중선택 (V키 → 클릭 / Shift+클릭)
- ✅ Merge (Ctrl+M)
- ✅ 삭제 (Delete)
- ✅ 스냅 모드 3단계 (G/H/F)
- ✅ 배정 상태 변경 (Properties 패널)
- ✅ Undo/Redo (Ctrl+Z / Ctrl+Shift+Z)
- ✅ 통계 패널 (좌측)

## Claude Code로 개발하기

```bash
cd expomap
# Claude Code에서 이렇게 지시:
# "CLAUDE.md 읽고, docs/SPEC.md 섹션 6을 참고해서 아일랜드 그룹 기능 구현해줘"
```

## 다음 구현 우선순위

1. 아일랜드 그룹 (Ctrl+G / 더블클릭)
2. 복사 4종 (Alt+Drag, 수치복사, 반복, 배열)
3. 배경 이미지 업로드 + 캘리브레이션
4. 부스번호 자동 배정
5. 엑셀 Import
