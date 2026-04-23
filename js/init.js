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
  // 전시회별 부스 색상 오버라이드
  if (expo.boothColor) {
    STATUS_COLORS.available = { fill: expo.boothColor, stroke: '#b0b8a0', text: '#555555' };
    VIEWER_STATUS_COLORS.available = { fill: expo.boothColor, stroke: '#b0b8a0', text: '#555555', label: '배정가능' };
  }
}

function _showAppLoading() {
  const el = document.getElementById('appLoadingOverlay');
  if (el) el.style.display = 'flex';
  _setLoadingProgress(0, '도면을 불러오는 중입니다...');
}

function _hideAppLoading() {
  const el = document.getElementById('appLoadingOverlay');
  if (!el) return;
  el.style.display = 'none';
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
  // 전시회 선택 화면: 오버레이는 기본 숨김(display:none)이므로 그냥 선택 화면 표시
  if (!EXPO_SLUG) {
    showExpoSelector();
    return;
  }
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
    if (initSupabase()) {
      _setLoadingProgress(10, '서버에 연결 중...');
      await loadFromSupabase();
      _setLoadingProgress(55, '부스 데이터 완료, 도면 불러오는 중...');
      const bgP = getBgLoadPromise();
      if (bgP) await bgP;
      _setLoadingProgress(100, '완료!');
      initAutoVersion();
    } else {
      _setLoadingProgress(20, '로컬 데이터 복원 중...');
      const bgKey = 'expomap_bg_dataurl_' + _supaProjectId;
      const savedBg = localStorage.getItem(bgKey);
      if (savedBg) {
        restoreBgImage(savedBg);
        _setLoadingProgress(60, '도면 이미지 불러오는 중...');
        const bgP = getBgLoadPromise();
        if (bgP) await bgP;
      }
      _setLoadingProgress(100, '완료!');
    }
  } finally {
    // 성공/실패 모두 오버레이 숨김
    _hideAppLoading();
  }

  // ─── Presence init ───
  initPresenceIdentity();
  if (_supaClient) {
    initPresenceChannel();
  }
  setInterval(pruneStaleRemoteCursors, 1000);
  window.addEventListener('beforeunload', () => { broadcastCursorLeave(); broadcastSelectionClear(); });
  updateLockButton();
  initBoothSearch();
  render();
}
init();
