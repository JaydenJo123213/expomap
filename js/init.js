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

function _hideAppLoading() {
  const el = document.getElementById('appLoadingOverlay');
  if (!el) return;
  el.style.pointerEvents = 'none'; // 즉시 이벤트 차단 해제 (opacity fade 중에도 클릭 통과)
  el.style.transition = 'opacity 0.4s ease';
  el.style.opacity = '0';
  setTimeout(() => { el.style.display = 'none'; }, 400);
}

async function init() {
  // 전시회 선택 화면 (BG 없으므로 즉시 오버레이 숨김)
  if (!EXPO_SLUG) {
    _hideAppLoading();
    showExpoSelector();
    return;
  }
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
      await loadFromSupabase();
      initAutoVersion();
    } else {
      // Supabase 없을 때 localStorage 폴백으로 bg 복원
      const bgKey = 'expomap_bg_dataurl_' + _supaProjectId;
      const savedBg = localStorage.getItem(bgKey);
      if (savedBg) restoreBgImage(savedBg);
    }

    // BG 이미지가 있다면 완전히 로드될 때까지 대기 (최대 10초)
    const bgProm = typeof getBgLoadPromise === 'function' ? getBgLoadPromise() : null;
    if (bgProm) {
      await Promise.race([bgProm, new Promise(r => setTimeout(r, 10000))]);
    }
  } finally {
    // 성공/실패/타임아웃 모두 오버레이 숨김
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
