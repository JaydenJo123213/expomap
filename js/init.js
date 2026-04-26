// ─── 모바일 디버그 패널 (?debug=1 파라미터 시 활성화) ───
const _DEBUG = new URLSearchParams(location.search).get('debug') === '1';
const _dbgStart = Date.now();
let _debugEl = null;

function _dbg(msg, color) {
  const t = '+' + ((Date.now() - _dbgStart) / 1000).toFixed(2) + 's';
  console.log('[DBG]', t, msg);
  if (!_DEBUG) return;
  if (!_debugEl) {
    const wrap = document.createElement('div');
    wrap.id = '_debugPanel';
    wrap.style.cssText = [
      'position:fixed;bottom:0;left:0;right:0;z-index:99999',
      'background:rgba(0,0,0,0.88);color:#39ff14;font:11px/1.4 monospace',
      'max-height:45vh;overflow-y:auto;padding:6px 8px',
      'border-top:2px solid #39ff14;pointer-events:auto',
    ].join(';');
    // 닫기 버튼
    const btn = document.createElement('button');
    btn.textContent = '✕ close';
    btn.style.cssText = 'float:right;background:#333;color:#fff;border:none;padding:2px 6px;cursor:pointer;font-size:10px;margin-bottom:4px';
    btn.onclick = () => wrap.remove();
    wrap.appendChild(btn);
    document.body.appendChild(wrap);
    _debugEl = wrap;
  }
  const line = document.createElement('div');
  line.style.cssText = 'padding:1px 0;border-bottom:1px solid #1a3a1a;word-break:break-all;color:' + (color || '#39ff14');
  line.textContent = t + ' ' + msg;
  _debugEl.appendChild(line);
  _debugEl.scrollTop = _debugEl.scrollHeight;
}

function showExpoSelector() {
  document.getElementById('expoSelector').style.display = '';
  const list = document.getElementById('expoList');
  list.innerHTML = Object.entries(EXHIBITIONS).map(([slug, ex]) => `
    <div style="background:#16213e;border:1px solid #2a3a5c;border-radius:12px;padding:20px;margin-bottom:16px;text-align:left">
      <div style="font-size:18px;font-weight:700;margin-bottom:12px">${ex.name}</div>
      <div style="display:flex;gap:10px">
        <a href="?expo=${slug}" style="flex:1;text-align:center;padding:10px;background:#4F8CFF;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">공개도면</a>
        <a href="?expo=${slug}&mode=admin" style="flex:1;text-align:center;padding:10px;background:#FF9800;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">배정모드</a>
      </div>
    </div>
  `).join('');
}

// ─── 동적 브랜딩 ───
function applyExhibitionBranding(expo) {
  document.title = 'ExpoMap — ' + expo.name;
  const topExpoName = document.getElementById('topbarExpoName');
  if (topExpoName) topExpoName.textContent = expo.nameShort;
  const viewerLogo = document.querySelector('.viewer-logo');
  if (viewerLogo) viewerLogo.innerHTML = 'ExpoMap <span>' + expo.nameShort + ' 공개도면</span>';
  // 전시회별 부스 색상 오버라이드 — 공개모드·PDF 전용 (배정모드 STATUS_COLORS는 건드리지 않음)
  if (expo.boothColor || expo.boothStrokeColor || expo.boothTextColor) {
    const fill   = expo.boothColor       || VIEWER_STATUS_COLORS.available.fill;
    const stroke = expo.boothStrokeColor || VIEWER_STATUS_COLORS.available.stroke;
    const text   = expo.boothTextColor   || VIEWER_STATUS_COLORS.available.text;
    VIEWER_STATUS_COLORS.available = { fill, stroke, text, label: '배정가능' };
  }
}

function _showAppLoading() {
  const el = document.getElementById('appLoadingOverlay');
  if (el) { el.style.display = 'flex'; el.style.pointerEvents = ''; }
  _setLoadingProgress(0, '도면을 불러오는 중입니다...');
}

function _hideAppLoading() {
  const el = document.getElementById('appLoadingOverlay');
  if (!el) return;
  // pointer-events: none 유지 — display:none 후 iOS compositor 지연 기간 동안 터치 차단 방지
  // (display:none만으로는 iOS에서 compositor가 늦게 처리되어 잠깐 터치를 가로채는 현상)
  el.style.pointerEvents = 'none';
  el.style.display = 'none';
  // 터치 응답 지연 측정용 — 첫 터치까지 몇 초 걸리는지 디버그 패널에 표시
  if (typeof _dbg === 'function') {
    window._overlayHiddenAt = Date.now();
    _dbg('오버레이 숨김 완료 — 이후 터치 대기 중...');
  }
}

function _setLoadingProgress(pct, label) {
  const bar = document.getElementById('appLoadingBar');
  const pctEl = document.getElementById('appLoadingPct');
  const labelEl = document.getElementById('appLoadingLabel');
  if (bar) bar.style.width = pct + '%';
  if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  if (label && labelEl) labelEl.textContent = label;
}

async function init() {
  // 전시회 선택 화면: DB에서 목록 로드 후 표시 (폴백: EXHIBITIONS_FALLBACK)
  if (!EXPO_SLUG) {
    const supaOk = initSupabase();
    if (supaOk) {
      const rows = await loadExhibitions();
      if (rows?.length) setExhibitions(rows);
    }
    showExpoSelector();
    return;
  }
  _dbg('init() start | expo=' + EXPO_SLUG + ' | UA=' + navigator.userAgent.slice(0, 60));
  _showAppLoading();
  _currentExpo = resolveExhibition(EXPO_SLUG);
  applyExhibitionBranding(_currentExpo);

  if (VIEWER_MODE) {
    document.body.classList.add('viewer');
    container.style.cursor = 'default';
    document.getElementById('viewerSearch')?.addEventListener('input', () => render());
  }
  resize();
  state.panX = 50;
  state.panY = 50;

  try {
    const supaOk = initSupabase();
    _dbg('initSupabase() → ' + (supaOk ? 'OK' : 'OFFLINE'));
    if (supaOk) {
      // exhibitions 테이블에서 전시회 목록 로드 → 브랜딩 재적용
      const _exRows = await loadExhibitions();
      if (_exRows?.length) {
        setExhibitions(_exRows);
        _currentExpo = resolveExhibition(EXPO_SLUG);
        applyExhibitionBranding(_currentExpo);
      }
      _setLoadingProgress(5, '부스 블럭 로딩 중...');
      _dbg('loadFromSupabase() 시작');
      const _t0 = Date.now();
      await loadFromSupabase();
      _dbg('loadFromSupabase() 완료 (' + (Date.now() - _t0) + 'ms) | booths=' + state.booths.length + ' | hasBgUrl=' + !!state.bg.storageUrl);
      _setLoadingProgress(5, '부스 블럭 완료!');
      initAutoVersion();
      // BG 로딩 + img.decode() 완전 디코딩 대기
      // img.decode()는 메인 스레드를 차단하지 않으므로 오버레이 중 디코딩 완료
      // → 오버레이 사라지면 ctx.drawImage 시 추가 디코딩 없음 → 즉시 터치 가능
      const bgP = getBgLoadPromise();
      if (bgP) {
        _setLoadingProgress(10, '배경 도면 로딩 중...');
        // 화면 꺼짐 경고 팁 표시
        const _tip = document.getElementById('appLoadingTip');
        if (_tip) _tip.style.display = '';
        _dbg('BG 로딩+디코딩 대기 중 | hasBgPromise=true');
        // 시각적 진행: 10→50% (500ms마다 1%, 최대 40초)
        let _bgPct = 10;
        const _bgTimer = setInterval(() => {
          if (_bgPct < 50) { _bgPct++; _setLoadingProgress(_bgPct); }
        }, 500);
        await bgP;
        clearInterval(_bgTimer);
        if (_tip) _tip.style.display = 'none';
        _dbg('BG 로딩+디코딩 완료');
        _setLoadingProgress(55, '배경 도면 완료!');
      } else {
        _setLoadingProgress(55, '부스 데이터 완료!');
      }
    } else {
      _setLoadingProgress(5, '오프라인 모드...');
      const bgKey = 'expomap_bg_dataurl_' + _supaProjectId;
      const savedBg = localStorage.getItem(bgKey);
      _dbg('오프라인 모드 | savedBg=' + (savedBg ? savedBg.slice(0, 40) + '...' : 'null'));
      if (savedBg) restoreBgImage(savedBg);
      const bgPOff = getBgLoadPromise();
      if (bgPOff) { await bgPOff; }
      _setLoadingProgress(55, '로컬 데이터 복원 완료!');
    }
  } finally {
    // 초기화 → 렌더 → 100% 완료 표시
    _dbg('finally: 렌더 시작');
    initPresenceIdentity();
    if (_supaClient) { initPresenceChannel(); }
    setInterval(pruneStaleRemoteCursors, 1000);
    window.addEventListener('beforeunload', () => { broadcastCursorLeave(); broadcastSelectionClear(); });
    updateLockButton();
    initBoothSearch();
    render();
    _setLoadingProgress(95, '최적화 중...');
    // pointer-events: none → 터치가 오버레이 시각 제거 전에 캔버스로 즉시 통과
    // iOS Safari는 display:none 직후보다 pointer-events 변경 시 터치 대상을 더 빠르게 재평가
    const _overlay = document.getElementById('appLoadingOverlay');
    if (_overlay) _overlay.style.pointerEvents = 'none';
    // 2 rAF: 캔버스 렌더 완료 후 오버레이 시각 제거
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    _setLoadingProgress(100, '도면 불러오기 완료!');
    _hideAppLoading();
    const _ov = document.getElementById('appLoadingOverlay');
    _dbg('로딩 완료! overlay.display=' + (_ov ? _ov.style.display : 'null') + ' | overlay.pointerEvents=' + (_ov ? getComputedStyle(_ov).pointerEvents : 'null'));
    // 캔버스 위에 실제로 어떤 요소가 있는지 확인 (첫 터치 불응 원인 추적)
    try {
      const _cx = window.innerWidth / 2, _cy = window.innerHeight / 2;
      const _top = document.elementFromPoint(_cx, _cy);
      _dbg('화면 중앙 최상위 요소: ' + (_top ? _top.tagName + '#' + (_top.id || '(no-id)') + '.' + (_top.className || '(no-class)').slice(0, 30) : 'null'));
    } catch {}
    // 1초 후 재확인 (애니메이션 완료 후 상태)
    setTimeout(() => {
      try {
        const _cx = window.innerWidth / 2, _cy = window.innerHeight / 2;
        const _top = document.elementFromPoint(_cx, _cy);
        _dbg('1초 후 화면 중앙 최상위 요소: ' + (_top ? _top.tagName + '#' + (_top.id || '(no-id)') + '.' + (_top.className || '(no-class)').slice(0, 30) : 'null'));
      } catch {}
    }, 1000);
  }
}
init();
