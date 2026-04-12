// ════════════════════════════════════════
//  ExpoMap Prototype v0.3 — Canvas Engine
// ════════════════════════════════════════

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');

// ─── URL 파라미터 ───
const _urlParams = new URLSearchParams(window.location.search);
const APP_MODE = _urlParams.get('mode') || 'view';
const EXPO_SLUG = _urlParams.get('expo');  // null이면 전시회 선택 화면
const VIEWER_MODE = APP_MODE !== 'admin';

// ─── 전시회 레지스트리 ───
const EXHIBITIONS = {
  'kimes-busan-2026': {
    id: 'kimes-busan-2026',
    name: 'KIMES BUSAN 2026',
    nameShort: 'KIMES BUSAN',
    pdfPrefix: 'KIMES BUSAN 2026',
  },
  'kprint-2026': {
    id: 'kprint-2026',
    name: 'K-PRINT 2026',
    nameShort: 'K-PRINT',
    pdfPrefix: 'K-PRINT 2026',
    boothColor: '#f6f9e8',
    pdfMode: 'bgFill',  // BG 이미지를 A3에 꽉 채워서 출력 (방향은 BG 비율로 자동 결정)
  },
  // 새 전시회 추가 시 여기에 한 블럭 추가
};

function resolveExhibition(slug) {
  if (!slug) return null;
  if (EXHIBITIONS[slug]) return EXHIBITIONS[slug];
  // 미등록 slug → slug 자체를 ID/이름으로 사용 (새 전시회 즉시 사용 가능)
  return { id: slug, name: slug, nameShort: slug, pdfPrefix: slug };
}

let _currentExpo = null;

const PX_PER_METER = 10;
const GRID_PX = 30;
const HALF_GRID_PX = 5;

// ─── Presence / Anonymous Cursors ───
const CURSOR_ADJECTIVES = [
  '멋진','용감한','귀여운','씩씩한','빠른','느긋한','영리한',
  '활발한','조용한','따뜻한','차가운','강인한','부드러운','재빠른','우아한',
  '밝은','어두운','크기크는','작디작은','날랜','느린','무거운','가벼운',
  '반짝이는','흐릿한','선명한','희미한','예쁜','못생긴','깔끔한','지저분한',
  '똑똑한','어리석은','똑바른','삐뚤어진','높은','낮은','넓은','좁은'
];
const CURSOR_ANIMALS = [
  '고양이','여우','늑대','곰','호랑이','토끼','사슴','독수리',
  '판다','수달','하이에나','고슴도치','미어캣','카피바라','라쿤','기린'
];
const CURSOR_COLORS = [
  '#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF922B',
  '#DA77F2','#20C997','#F06595','#74C0FC','#A9E34B'
];
const CURSOR_STALE_MS = 5000;
const CURSOR_THROTTLE_MS = 20;

// ─── State ───
let state = {
  mode: 'select',
  snap: 'grid',
  zoom: 1,
  panX: 0, panY: 0,
  isPanning: false,
  panStartX: 0, panStartY: 0,
  isDrawing: false,
  drawStartX: 0, drawStartY: 0,
  drawCurrentX: 0, drawCurrentY: 0,
  selectedIds: new Set(),
  booths: [],
  groups: [],
  editingGroupId: null,
  nextId: 1,
  nextGroupId: 1,
  undoStack: [],
  redoStack: [],
  mouseX: 0, mouseY: 0,
  // drag-to-move
  isDragging: false,
  dragReady: false,
  dragStartSX: 0, dragStartSY: 0,
  dragBoothsOrigin: [],
  // alt+drag copy
  isAltDragging: false,
  altDragClones: [],
  altDragOriginSX: 0, altDragOriginSY: 0,
  // copy ops
  lastCopyOp: null,
  // marquee selection
  isMarquee: false,
  marqueeStartX: 0, marqueeStartY: 0,
  marqueeEndX: 0, marqueeEndY: 0,
  // background
  bg: { img: null, x: 0, y: 0, w: 0, h: 0, natW: 0, natH: 0, opacity: 0.5, visible: true, rotation: 0, dataUrl: null, storageUrl: null },
  bgCalMode: false,
  bgCalPoints: [],
  bgMoveMode: false,
  bgDragging: false,
  bgDragStartX: 0, bgDragStartY: 0,
  bgDragOriginX: 0, bgDragOriginY: 0,
  // structures
  structures: [],
  nextStructId: 1,
  structMode: null, // null | 'column' | 'wall' | 'door' | 'rect' | 'circle' | 'line' | 'arrow' | 'text'
  wallStart: null,  // temp first click for wall/line/arrow
  selectedStructId: null,
  structDragging: false,
  structDragStartX: 0, structDragStartY: 0,
  structDragOriginX: 0, structDragOriginY: 0,
  structDrawStart: null, structDrawCurrent: null,
  exportRegion: null,        // {x,y,w,h} world coords — null = auto
  exportRegionMode: false,   // 영역 드래그 선택 중
  exportRegionStart: null,
  structResizing: false, structResizeHandle: null,
  // ─── 실측 선 ───
  measureLines: [],           // [{id, x1, y1, x2, y2}] world px 절대 좌표
  nextMeasureLineId: 1,
  selectedMeasureLineId: null,
  measureLineDrawStart: null,  // 드래그 시작점 {x, y}
  measureLinePreviewEnd: null, // 드래그 현재 끝점 {x, y} (constrained + snapped)
  // logos/images
  logos: [],       // [{id, x, y, w, h, dataUrl, name, _img}]
  nextLogoId: 1,
  selectedLogoId: null,
  logoDragging: false,
  logoDragStartX: 0, logoDragStartY: 0,
  logoDragOriginX: 0, logoDragOriginY: 0,
  logoResizing: false,
  logoResizeCorner: null,
  // companies
  companies: [],
  logoCache: new Map(),  // company_uid → HTMLImageElement (캐시)
  freeBooths: [],  // [{ name, contract, free }]
  // 배정 워크플로우
  showElec: false,
  showOther: false,
  showBoothType: true,
  showBooths: true,
  showMeasure: false,
  locked: true,
  lang: 'ko',  // 'ko' | 'en' — 캔버스 표시 언어
  // viewer mode
  showViewerAvailable: true,
  viewerHoverId: null,
  _viewerClickStartX: 0,
  _viewerClickStartY: 0,
  // ─── Remote cursors ───
  remoteCursors: {},
  // ─── Base Number Layer ───
  baseNumbers: [],
  nextBaseNoId: 1,
  showBaseNumbers: true,
  isBaseDrawing: false,
  baseDrawStartX: 0, baseDrawStartY: 0,
  baseDrawCurrentX: 0, baseDrawCurrentY: 0,
  selectedBaseNoIds: new Set(),
  baseNoDragReady: false,
  baseNoDragStartSX: 0, baseNoDragStartSY: 0,
  baseNoDragBoothsOrigin: [],
  baseNoDragging: false,
  baseNoDragOriginW: 0, baseNoDragOriginH: 0,
  baseNoResizeHandle: null,
  // ─── DiscussOverlay Layer (배정논의 레이어) ───
  discussOverlays: [],
  nextDiscussOverlayId: 1,
  nextDiscussGroupId: 1,
  showDiscussLayer: true,
  selectedDiscussIds: new Set(),
  isDiscussDrawing: false,
  discussDrawStartX: 0, discussDrawStartY: 0,
  discussDrawCurrentX: 0, discussDrawCurrentY: 0,
  discussDragReady: false,
  discussDragStartSX: 0, discussDragStartSY: 0,
  discussDragOrigins: [],
  discussDragging: false,
  discussResizeHandle: null,
  discussResizeOriginW: 0, discussResizeOriginH: 0,
  // booth drag/resize
  boothDragging: false,
  boothDragStartSX: 0, boothDragStartSY: 0,
  boothDragOrigins: [],  // [{id, x, y, w, h}]
  boothResizeHandle: null,  // 'se' or null
  boothResizeDragStartSX: 0, boothResizeDragStartSY: 0,
  boothResizeOrigins: [],  // [{id, w, h}] for resized booths
  // 배정안내 모드
  assignGuideMode: false,
  // ─── 레이어 잠금 상태 ───
  layerLocked: {
    'other': false,       // 부대시설_기타
    'elec': false,        // 부대시설_전기
    'boothType': false,   // 부스타입 (조립부스)
    'discuss': false,     // 배정안내
    'booth': false,       // 부스블럭
    'baseNo': true,       // 기본부스번호 (기본 잠금)
    'bg': false,          // 도면배경
    'measure': false,     // 실측
  },
};

// ─── 레이어 정의 ───
const LAYERS = [
  { id: 'measure', label: '실측', stateKey: 'showMeasure' },
  { id: 'other', label: '부대시설_기타', stateKey: 'showOther' },
  { id: 'elec', label: '부대시설_전기', stateKey: 'showElec' },
  { id: 'boothType', label: '조립부스', stateKey: 'showBoothType' },
  { id: 'discuss', label: '배정안내', stateKey: 'showDiscussLayer' },
  { id: 'booth', label: '부스블럭', stateKey: 'showBooths' },
  { id: 'baseNo', label: '기본부스번호', stateKey: 'showBaseNumbers' },
  // 도면배경은 좌측 패널 '디자인 탭 → Background' 에서 관리
];

// ─── 부스 타입 ───
const BOOTH_TYPE_OPTIONS = [
  { key: '조립', label: '조립부스',  fill: 'rgba(255,235,59,0.4)',  stroke: '#F9A825' },
  { key: '독립', label: '독립부스',  fill: null,                    stroke: null },
  { key: '자체', label: '자체시공',  fill: 'rgba(255,152,0,0.42)',  stroke: '#E65100' },
];

// ─── 전기내역 6종 ───
const ELEC_TYPES = [
  { key: 'elec_lighting', label: '조명용',   color: '#42A5F5', border: '#1565C0', textColor: '#fff' },
  { key: 'elec_power',    label: '단상동력', color: '#EC407A', border: '#880E4F', textColor: '#fff' },
  { key: 'elec_3p3w',    label: '3상3선',   color: '#FFEE58', border: '#F9A825', textColor: '#333' },
  { key: 'elec_3p4w',    label: '3상4선',   color: '#7E57C2', border: '#311B92', textColor: '#fff' },
  { key: 'elec_24h',     label: '24시간',   color: '#66BB6A', border: '#1B5E20', textColor: '#fff' },
  { key: 'elec_rigging', label: '리깅',     color: '#FFA726', border: '#E65100', textColor: '#fff' },
];
const ELEC_KEYS = ELEC_TYPES.map(t => t.key);

const OTHER_TYPES = [
  { key: 'other_tela',  label: 'Ta', color: '#5C6BC0', border: '#283593', textColor: '#fff' }, // 국내전화
  { key: 'other_telb',  label: 'Tb', color: '#00ACC1', border: '#006064', textColor: '#fff' }, // 국제전화
  { key: 'other_net',   label: 'I',  color: '#26A69A', border: '#004D40', textColor: '#fff' }, // 인터넷
  { key: 'other_giga',  label: 'G',  color: '#8D6E63', border: '#3E2723', textColor: '#fff' }, // 기가인터넷
  { key: 'other_wifi',  label: 'wi', color: '#78909C', border: '#263238', textColor: '#fff' }, // 공유기
  { key: 'other_water', label: 'W',  color: '#29B6F6', border: '#0277BD', textColor: '#fff' }, // 수도
  { key: 'other_air',   label: 'A',  color: '#EF5350', border: '#B71C1C', textColor: '#fff' }, // 압축공기
];
const OTHER_KEYS = OTHER_TYPES.map(t => t.key);

function normalizeElecKey(h) {
  const s = h.toLowerCase().replace(/[\s\-_()\u0028\u0029\uff08\uff09]/g, '');
  // 전기 6종 (더 구체적인 것 먼저)
  if (s.includes('조명')) return 'elec_lighting';
  if (s.includes('동력')) return 'elec_power';
  if ((s.includes('3상') && s.includes('3선')) || s.includes('3선식')) return 'elec_3p3w';
  if ((s.includes('3상') && s.includes('4선')) || s.includes('4선식') || s.includes('380')) return 'elec_3p4w';
  if (s.includes('24시간')) return 'elec_24h';
  if (s.includes('리깅')) return 'elec_rigging';
  // 기타 7종
  if (s.includes('국내전화') || s.includes('내선')) return 'other_tela';
  if (s.includes('국제전화') || s.includes('외선')) return 'other_telb';
  if (s.includes('기가인터넷') || s.includes('기가넷') || s.includes('gigabit')) return 'other_giga';
  if (s.includes('인터넷') || s === 'internet' || s === 'net') return 'other_net';
  if (s.includes('공유기') || s.includes('wifi') || s.includes('wi-fi') || s.includes('router')) return 'other_wifi';
  if (s.includes('수도') || s === 'water') return 'other_water';
  if (s.includes('압축공기') || s.includes('에어') || s === 'air') return 'other_air';
  // company_uid: 아이디, id, uid 등
  if (s === '아이디' || s === 'id' || s === 'uid' || s.includes('companyuid') || s === 'company_uid') return 'company_uid';
  // company_name: 회사명, 업체명, 기관명 등
  if (s.includes('회사명') || s.includes('업체명') || s.includes('기관명') || s.includes('companyname') || s === 'company_name') return 'company_name';
  // booth_id: 부스, 부스번호, boothid 등
  if (s === '부스' || s.includes('부스번호') || s.includes('boothid') || s === 'booth_id') return 'booth_id';
  return h;
}

const STATUS_COLORS = {
  available: { fill: '#3D4255', stroke: '#555A6E', text: '#8B8FA3' },   // 기본 (유지)
  discuss:   { fill: '#3D3200', stroke: '#FFD600', text: '#FFE57F' },   // 배정논의 — 노랑
  spot:      { fill: '#4A2800', stroke: '#FF9800', text: '#FFA726' },   // 배정가능위치 — 주황
  hold:      { fill: '#4A0A2A', stroke: '#E91E8C', text: '#F48FB1' },   // 홀딩 — 핑크
  proposing: { fill: '#1A3D2A', stroke: '#2E8B57', text: '#3DAF6E' },   // 계약서 접수 — 초록
  assigned:  { fill: '#f9e5de', stroke: '#d4a89a', text: '#111111' },   // 배정완료 — 연분홍 검정글씨
  online:    { fill: '#0A2035', stroke: '#29B6F6', text: '#4FC3F7' },   // 온라인신청 — 하늘색
  fake:      { fill: '#3D0A0A', stroke: '#F44336', text: '#EF9A9A' },   // 가짜배정 — 빨강
  excluded:  { fill: '#1A1A1A', stroke: '#444',    text: '#555' },      // 배정제외 (유지)
  facility:  { fill: '#EFEFEF', stroke: '#111111', text: '#111111' },  // 기타부대설비 — 연한회색
};
const SELECTED_STROKE = '#4F8CFF';
const GROUP_STROKE = '#4F8CFF';

const VIEWER_STATUS_COLORS = {
  available: { fill: '#f9e5de', stroke: '#d4a89a', text: '#7a5045', label: '배정가능' },
  discuss:   { fill: '#FFFDE7', stroke: '#FDD835', text: '#F57F17', label: '배정논의' },      // 노랑
  spot:      { fill: '#FFF3E0', stroke: '#FFA726', text: '#E65100', label: '배정가능위치' },  // 주황
  hold:      { fill: '#FCE4EC', stroke: '#F06292', text: '#C2185B', label: '홀딩' },           // 핑크
  proposing: { fill: '#E8F5E9', stroke: '#66BB6A', text: '#2E7D32', label: '계약서 접수' },       // 초록
  assigned:  { fill: '#FFFFFF', stroke: '#757575', text: '#212121', label: '배정완료' },        // 흰/검정
  online:    { fill: '#E1F5FE', stroke: '#29B6F6', text: '#0277BD', label: '온라인신청' },     // 하늘색
  fake:      { fill: '#FFEBEE', stroke: '#EF5350', text: '#C62828', label: '가짜배정' },        // 빨강
  excluded:  { fill: '#FAFAFA', stroke: '#EEEEEE', text: '#BDBDBD', label: '배정제외' },
  facility:  { fill: '#EFEFEF', stroke: '#111111', text: '#111111', label: '기타부대설비' },
};
const STRUCT_COLORS = {
  column: { fill: '#5C5C5C', stroke: '#888' },
  wall:   { stroke: '#888', width: 3 },
  door:   { fill: '#CC7700', stroke: '#FF9800' },
};

