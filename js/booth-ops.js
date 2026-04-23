// ─── Base Number Layer ───
function createBaseNumber(x, y, w, h) {
  const bn = { id: state.nextBaseNoId++, x, y, w, h, baseNo: '' };
  state.baseNumbers.push(bn);
  state.selectedBaseNoIds.clear();
  state.selectedBaseNoIds.add(bn.id);
  render(); updateProps();
  return bn;
}

function getBaseNoAt(wx, wy) {
  return state.baseNumbers.find(bn =>
    wx >= bn.x && wx <= bn.x + bn.w && wy >= bn.y && wy <= bn.y + bn.h
  );
}

function deleteBaseNo(id) {
  saveUndo();
  state.baseNumbers = state.baseNumbers.filter(bn => bn.id !== id);
  if (state.selectedBaseNoIds.has(id)) state.selectedBaseNoIds.delete(id);
  scheduleSave(); render(); updateProps();
}

function toggleBaseNoDisplay() {
  state.showBaseNumbers = !state.showBaseNumbers;
  document.getElementById('btnBaseNoToggle').classList.toggle('active', state.showBaseNumbers);
  render();
}

function toggleDiscussLayer() {
  state.showDiscussLayer = !state.showDiscussLayer;
  document.getElementById('btnDiscussToggle').classList.toggle('active', state.showDiscussLayer);
  render();
}

function selectSidebarTab(tabId) {
  // 아이콘 버튼 active 상태 전환
  document.querySelectorAll('.sidebar-icon-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById('sidebarBtn-' + tabId);
  if (activeBtn) activeBtn.classList.add('active');
  // 탭 내용 전환
  document.querySelectorAll('.sidebar-tab').forEach(tab => tab.classList.remove('active'));
  const activeTab = document.getElementById('sidebarTab-' + tabId);
  if (activeTab) activeTab.classList.add('active');
  // 패널 표시
  document.getElementById('sidebarPanel').classList.add('visible');
  // 버전 히스토리 탭: 목록 로드
  if (tabId === 'history') {
    loadVersionList().then(renderVersionList);
  }
}

function cancelAssignGuideMode() {
  state.assignGuideMode = false;
  state.selectedDiscussIds.clear();
  render();
}

function toggleBoothsDisplay() {
  state.showBooths = !state.showBooths;
  document.getElementById('btnBoothsToggle').classList.toggle('active', state.showBooths);
  render();
}

// ─── DiscussOverlay Layer ───
function drawDiscussOverlays(c, zoom) {
  if (!state.showDiscussLayer) return;

  // 그룹별 연결선 먼저 그리기
  const grpMap = {};
  state.discussOverlays.forEach(ov => {
    if (!ov.groupId) return;
    if (!grpMap[ov.groupId]) grpMap[ov.groupId] = [];
    grpMap[ov.groupId].push(ov);
  });

  Object.values(grpMap).forEach(group => {
    if (group.length < 2) return;

    // Centroid 계산
    const cx = group.reduce((s, ov) => s + ov.x + ov.w / 2, 0) / group.length;
    const cy = group.reduce((s, ov) => s + ov.y + ov.h / 2, 0) / group.length;

    // 연결선 그리기
    c.strokeStyle = 'rgba(255,214,0,0.7)';
    c.lineWidth = 1.5 / zoom;
    c.setLineDash([5 / zoom, 4 / zoom]);
    group.forEach(ov => {
      c.beginPath();
      c.moveTo(ov.x + ov.w / 2, ov.y + ov.h / 2);
      c.lineTo(cx, cy);
      c.stroke();
    });
    c.setLineDash([]);

    // 중심점에 노란 원
    c.fillStyle = '#FFD600';
    c.beginPath();
    c.arc(cx, cy, 4 / zoom, 0, Math.PI * 2);
    c.fill();
  });

  // 오버레이 박스 그리기
  state.discussOverlays.forEach(ov => {
    const isSelected = state.selectedDiscussIds.has(ov.id);

    // 배경 영역
    c.fillStyle = 'rgba(255,214,0,0.12)';
    c.fillRect(ov.x, ov.y, ov.w, ov.h);

    // 테두리
    c.strokeStyle = isSelected ? '#4F8CFF' : '#FFD600';
    c.lineWidth = isSelected ? 2 / zoom : 1.5 / zoom;
    c.setLineDash([]);
    c.strokeRect(ov.x, ov.y, ov.w, ov.h);

    // 리사이즈 핸들 (단일선택)
    if (isSelected && state.selectedDiscussIds.size === 1) {
      const hs = 8 / zoom;
      c.fillStyle = '#4F8CFF';
      c.fillRect(ov.x + ov.w - hs, ov.y + ov.h - hs, hs, hs);
    }

    // 라벨 텍스트 (</br> 줄바꿈 지원)
    if (ov.label) {
      const fz = 7;
      c.font = `500 ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
      c.fillStyle = '#FFD600';
      c.globalAlpha = 0.9;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const lines = ov.label.split('</br>').map(s => s.trim());
      const lineH = fz * 1.3;
      const startY = ov.y + ov.h / 2 - (lines.length - 1) * lineH / 2;
      lines.forEach((line, i) => c.fillText(line, ov.x + ov.w / 2, startY + i * lineH));
      c.globalAlpha = 1;
    }
  });

}

function drawBaseNumbers(c, zoom) {
  if (!state.showBaseNumbers) return;
  state.baseNumbers.forEach(bn => {
    // 공개모드에서는 테두리만 숨김 (텍스트는 표시)
    if (!VIEWER_MODE) {
      const isSelected = state.selectedBaseNoIds.has(bn.id);
      c.strokeStyle = isSelected ? '#4F8CFF' : 'rgba(150,150,150,0.5)';
      c.lineWidth = isSelected ? (1.5 / zoom) : (0.5 / zoom);
      c.setLineDash([3/zoom, 3/zoom]);
      c.strokeRect(bn.x, bn.y, bn.w, bn.h);
      c.setLineDash([]);

      // Resize handle (selected only)
      if (isSelected) {
        const handleSize = 8 / zoom;
        c.fillStyle = '#4F8CFF';
        c.fillRect(bn.x + bn.w - handleSize, bn.y + bn.h - handleSize, handleSize, handleSize);
      }
    }

    if (!bn.baseNo) return;

    // Hide text if covered by booth with boothId or companyName
    const covering = state.booths.find(b =>
      b.x < bn.x + bn.w && b.x + b.w > bn.x &&
      b.y < bn.y + bn.h && b.y + b.h > bn.y &&
      (b.companyName || b.companyNameEn)
    );
    if (covering) return;

    // Match booth boothId text style
    c.font = `400 7px 'Spoqa Han Sans Neo', sans-serif`;
    c.fillStyle = '#8B8FA3';
    c.globalAlpha = 0.65;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(bn.baseNo, bn.x + bn.w / 2, bn.y + bn.h / 2);
    c.globalAlpha = 1;
  });
}

let _isLoading = false;

async function saveToSupabase() {
  if (!_supaClient) return;
  const data = {
    booths: state.booths,
    groups: state.groups,
    structures: state.structures,
    logos: state.logos.map(l => ({
      id: l.id, x: l.x, y: l.y, w: l.w, h: l.h, name: l.name,
      storageUrl: l.storageUrl || null,
      // storageUrl 없으면 dataUrl 보존 (마이그레이션 전 안전망)
      dataUrl: l.storageUrl ? null : (l.dataUrl || null),
    })),
    companies: state.companies,
    nextId: state.nextId,
    nextGroupId: state.nextGroupId,
    nextStructId: state.nextStructId,
    nextLogoId: state.nextLogoId,
    baseNumbers: state.baseNumbers,
    nextBaseNoId: state.nextBaseNoId,
    discussOverlays: state.discussOverlays,
    nextDiscussOverlayId: state.nextDiscussOverlayId,
    nextDiscussGroupId: state.nextDiscussGroupId,
    freeBooths: state.freeBooths,
    bg: { x: state.bg.x, y: state.bg.y, w: state.bg.w, h: state.bg.h, natW: state.bg.natW, natH: state.bg.natH, opacity: state.bg.opacity, visible: state.bg.visible, rotation: state.bg.rotation || 0, storageUrl: state.bg.storageUrl || null },
    measureLines: state.measureLines,
    nextMeasureLineId: state.nextMeasureLineId,
  };
  try {
    const savedAt = new Date().toISOString();
    const { error } = await _supaClient
      .from('expomap_state')
      .upsert({ id: _supaProjectId, state_json: data, updated_at: savedAt });
    if (error) throw error;
    _localUpdatedAt = savedAt;
    updateSaveIndicator('saved');
    if (_presenceChannel && _myUserId) {
      _presenceChannel.send({ type: 'broadcast', event: 'save', payload: { userId: _myUserId, updatedAt: savedAt } });
    }
  } catch (e) {
    console.error('Save failed:', e);
    updateSaveIndicator('error');
    showConnectionAlert('저장 실패: ' + (e.message || '서버 연결 끊김') + '\n데이터가 저장되지 않고 있습니다!');
  }
}

async function loadFromSupabase({ preserveSelection = false } = {}) {
  if (!_supaClient) return;
  if (_isLoading) return;
  _isLoading = true;
  try {
    // 먼저 지정 ID로 시도, 없으면 가장 최근 행으로 폴백
    let data, error;
    ({ data, error } = await _supaClient
      .from('expomap_state')
      .select('state_json, updated_at')
      .eq('id', _supaProjectId)
      .maybeSingle());
    if (!data && !error) {
      // id로 못 찾으면 updated_at 기준 최신 행
      ({ data, error } = await _supaClient
        .from('expomap_state')
        .select('state_json, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle());
    }
    if (error) throw error;
    if (!data) { console.log('No saved state, starting fresh.'); return; }
    if (data?.state_json) {
      const s = data.state_json;
      state.booths = (s.booths || []).map(b => ({ ...b, companyNameEn: b.companyNameEn || '' }));
      state.groups = s.groups || [];
      state.structures = s.structures || [];
      state.companies = s.companies || [];
      state.nextId = s.nextId || 1;
      state.nextGroupId = s.nextGroupId || 1;
      state.nextStructId = s.nextStructId || 1;
      state.nextLogoId = s.nextLogoId || 1;
      state.baseNumbers = s.baseNumbers || [];
      state.nextBaseNoId = s.nextBaseNoId || 1;
      state.discussOverlays = s.discussOverlays || [];
      state.nextDiscussOverlayId = s.nextDiscussOverlayId || 1;
      state.nextDiscussGroupId = s.nextDiscussGroupId || 1;
      state.freeBooths = s.freeBooths || [];
      state.measureLines = s.measureLines || [];
      state.nextMeasureLineId = s.nextMeasureLineId || 1;
      restoreLogos(s.logos || []);
      if (s.bg) {
        state.bg.x = s.bg.x || 0;
        state.bg.y = s.bg.y || 0;
        state.bg.w = s.bg.w || 0;
        state.bg.h = s.bg.h || 0;
        state.bg.natW = s.bg.natW || 0;
        state.bg.natH = s.bg.natH || 0;
        state.bg.opacity = s.bg.opacity ?? 0.5;
        state.bg.visible = s.bg.visible ?? true;
        state.bg.rotation = s.bg.rotation || 0;
        if (s.bg.storageUrl) {
          state.bg.storageUrl = s.bg.storageUrl;
          restoreBgImage(s.bg.storageUrl);
        } else if (s.bg.dataUrl) {
          // 레거시 dataUrl → Storage 자동 마이그레이션
          restoreBgImage(s.bg.dataUrl);
          if (_supaClient) {
            _uploadBgDataUrlToStorage(s.bg.dataUrl)
              .then(url => {
                state.bg.storageUrl = url;
                state.bg.dataUrl = null;
                scheduleSave();
                console.log('BG 마이그레이션 완료:', url);
              })
              .catch(err => console.warn('BG 마이그레이션 실패:', err));
          }
        }
      }
      if (!preserveSelection) {
        state.selectedIds = new Set();
        state.selectedBaseNoIds = new Set();
        state.selectedDiscussIds = new Set();
      }
      if (data.updated_at) _localUpdatedAt = data.updated_at;
      render(); updateProps();
      updateSaveIndicator('saved');
      // 기존 base64 로고 → Storage 마이그레이션 (백그라운드, 비차단)
      Promise.all([_migrateDecorativeLogos(), _migrateCompanyLogos()])
        .catch(err => console.warn('[Logo Migration] 예외:', err));
    }
  } catch (e) {
    console.error('Load failed:', e);
    updateSaveIndicator('error');
    showConnectionAlert('데이터 로드 실패: ' + (e.message || '서버 연결 끊김') + '\n설정에서 Supabase 연결을 확인해주세요!');
  } finally {
    _isLoading = false;
  }
}

function updateSaveIndicator(status) {
  const el = document.getElementById('saveIndicator');
  if (!el) return;
  el.className = 'save-indicator ' + status;
  const target = _supaClient ? 'Supabase' : 'Local';
  const exName = _currentExpo ? ' [' + _currentExpo.nameShort + ']' : '';
  const labels = {
    saved: `● ${target} saved${exName}`,
    saving: `● ${target} saving...`,
    error: `● ${target} save error`,
    offline: '● offline (저장 안 됨)'
  };
  el.textContent = labels[status] || status;
}

let _lastAlertTime = 0;
function showConnectionAlert(msg) {
  const now = Date.now();
  if (now - _lastAlertTime < 30000) return;  // 30초 내 중복 알림 방지
  _lastAlertTime = now;
  alert('⚠️ Supabase 연결 문제\n\n' + msg);
}

// ─── Resize ───
function resize() {
  const dpr = getEffectiveDpr();
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}
window.addEventListener('resize', resize);

// ─── Coordinate Helpers ───
function screenToWorld(sx, sy) {
  return { x: (sx - state.panX) / state.zoom, y: (sy - state.panY) / state.zoom };
}
function worldToScreen(wx, wy) {
  return { x: wx * state.zoom + state.panX, y: wy * state.zoom + state.panY };
}
function snapValue(v) {
  if (state.snap === 'grid') return Math.round(v / GRID_PX) * GRID_PX;
  if (state.snap === 'half') return Math.round(v / HALF_GRID_PX) * HALF_GRID_PX;
  return v;
}
function pxToM(px) { return px / PX_PER_METER; }
function mToPx(m) { return m * PX_PER_METER; }
// cells 기반 실제 면적 (m²) — L자 등 비정형 부스는 bounding box가 아닌 실면적 반환
function getBoothAreaM2(b) {
  if (b.cells && b.cells.length > 1) {
    return b.cells.reduce((sum, c) => sum + pxToM(c.w) * pxToM(c.h), 0);
  }
  return pxToM(b.w) * pxToM(b.h);
}

// ─── Undo / Redo ───
function saveUndo() {
  state.undoStack.push(JSON.parse(JSON.stringify({ booths: state.booths, groups: state.groups, structures: state.structures, logos: state.logos.map(l => ({id:l.id,x:l.x,y:l.y,w:l.w,h:l.h,dataUrl:l.dataUrl,name:l.name})), baseNumbers: state.baseNumbers, nextBaseNoId: state.nextBaseNoId, discussOverlays: state.discussOverlays, nextDiscussOverlayId: state.nextDiscussOverlayId, nextDiscussGroupId: state.nextDiscussGroupId })));
  if (state.undoStack.length > 50) state.undoStack.shift();
  state.redoStack = [];
  scheduleSave();
}
function undo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(JSON.parse(JSON.stringify({ booths: state.booths, groups: state.groups, structures: state.structures, logos: state.logos.map(l => ({id:l.id,x:l.x,y:l.y,w:l.w,h:l.h,dataUrl:l.dataUrl,name:l.name})), baseNumbers: state.baseNumbers, nextBaseNoId: state.nextBaseNoId, discussOverlays: state.discussOverlays, nextDiscussOverlayId: state.nextDiscussOverlayId, nextDiscussGroupId: state.nextDiscussGroupId })));
  const snap = state.undoStack.pop();
  state.booths = snap.booths;
  state.groups = snap.groups;
  state.structures = snap.structures || [];
  state.baseNumbers = snap.baseNumbers || [];
  state.nextBaseNoId = snap.nextBaseNoId || 1;
  state.discussOverlays = snap.discussOverlays || [];
  state.nextDiscussOverlayId = snap.nextDiscussOverlayId || 1;
  state.nextDiscussGroupId = snap.nextDiscussGroupId || 1;
  restoreLogos(snap.logos || []);
  state.selectedIds.clear();
  state.selectedBaseNoIds.clear();
  state.selectedDiscussIds.clear();
  scheduleSave();
  render(); updateProps();
}
function redo() {
  if (!state.redoStack.length) return;
  state.undoStack.push(JSON.parse(JSON.stringify({ booths: state.booths, groups: state.groups, structures: state.structures, logos: state.logos.map(l => ({id:l.id,x:l.x,y:l.y,w:l.w,h:l.h,dataUrl:l.dataUrl,name:l.name})), baseNumbers: state.baseNumbers, nextBaseNoId: state.nextBaseNoId, discussOverlays: state.discussOverlays, nextDiscussOverlayId: state.nextDiscussOverlayId, nextDiscussGroupId: state.nextDiscussGroupId })));
  const snap = state.redoStack.pop();
  state.booths = snap.booths;
  state.groups = snap.groups;
  state.structures = snap.structures || [];
  state.baseNumbers = snap.baseNumbers || [];
  state.nextBaseNoId = snap.nextBaseNoId || 1;
  state.discussOverlays = snap.discussOverlays || [];
  state.nextDiscussOverlayId = snap.nextDiscussOverlayId || 1;
  state.nextDiscussGroupId = snap.nextDiscussGroupId || 1;
  restoreLogos(snap.logos || []);
  state.selectedIds.clear();
  state.selectedBaseNoIds.clear();
  state.selectedDiscussIds.clear();
  scheduleSave();
  render(); updateProps();
}

// ─── Booth CRUD ───
function createBooth(x, y, w, h) {
  const booth = { id: state.nextId++, x, y, w, h, boothId: '', status: 'available', companyUid: '', companyName: '', companyNameEn: '', companyLogoUrl: '', logoScale: 100, logoGap: 0, logoPosition: 'top', logoOffsetX: 0, logoOffsetY: 0, groupId: null, locked: false, memo: '', elecSide: '', otherSide: '', boothType: '', boothTypeCoverage: 100, boothTypeDir: 'full' };
  saveUndo();
  state.booths.push(booth);
  return booth;
}
function pointInBooth(b, wx, wy) {
  if (b.cells && b.cells.length > 1) {
    return b.cells.some(c => wx >= c.x && wx <= c.x + c.w && wy >= c.y && wy <= c.y + c.h);
  }
  return wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h;
}
function getBoothAt(wx, wy) {
  for (let i = state.booths.length - 1; i >= 0; i--) {
    if (pointInBooth(state.booths[i], wx, wy)) return state.booths[i];
  }
  return null;
}
function getDiscussOverlayAt(wx, wy) {
  for (let i = state.discussOverlays.length - 1; i >= 0; i--) {
    const ov = state.discussOverlays[i];
    if (wx >= ov.x && wx <= ov.x + ov.w && wy >= ov.y && wy <= ov.y + ov.h) return ov;
  }
  return null;
}
function getSelectedBooth() {
  if (state.selectedIds.size !== 1) return null;
  return state.booths.find(b => b.id === [...state.selectedIds][0]);
}
function getBoothGroup(boothId) {
  return state.groups.find(g => g.boothIds.includes(boothId)) || null;
}
function getGroupBounds(group) {
  const bs = state.booths.filter(b => group.boothIds.includes(b.id));
  if (!bs.length) return null;
  return {
    x: Math.min(...bs.map(b => b.x)),
    y: Math.min(...bs.map(b => b.y)),
    x2: Math.max(...bs.map(b => b.x + b.w)),
    y2: Math.max(...bs.map(b => b.y + b.h)),
  };
}

// ─── Merge ───
function mergeSelected() {
  if (state.selectedIds.size < 2) return;
  const selected = state.booths.filter(b => state.selectedIds.has(b.id));
  const minX = Math.min(...selected.map(b => b.x));
  const minY = Math.min(...selected.map(b => b.y));
  const maxX = Math.max(...selected.map(b => b.x + b.w));
  const maxY = Math.max(...selected.map(b => b.y + b.h));
  saveUndo();
  const ids = new Set(selected.map(b => b.id));
  state.groups.forEach(g => { g.boothIds = g.boothIds.filter(id => !ids.has(id)); });
  state.groups = state.groups.filter(g => g.boothIds.length > 0);
  state.booths = state.booths.filter(b => !ids.has(b.id));
  // 셀 목록 저장 — ㄴ/ㄱ자 등 비정형 부스 지원
  const cells = selected.map(s => {
    // 이미 cells가 있는 부스(재머지)면 풀어서 합침
    if (s.cells && s.cells.length > 1) return s.cells;
    return [{ x: s.x, y: s.y, w: s.w, h: s.h }];
  }).flat();
  // 바운딩 박스와 동일하면 cells 불필요 (일반 직사각형)
  const isRect = cells.length === 1 || (
    cells.every(c => c.x >= minX && c.y >= minY && c.x + c.w <= maxX && c.y + c.h <= maxY) &&
    cells.reduce((s, c) => s + c.w * c.h, 0) === (maxX - minX) * (maxY - minY)
  );
  const merged = { id: state.nextId++, x: minX, y: minY, w: maxX - minX, h: maxY - minY, boothId: '', status: 'available', companyUid: '', companyName: '', companyNameEn: '', groupId: null, memo: '', elecSide: '', otherSide: '', boothType: '', boothTypeCoverage: 100, boothTypeDir: 'full', cells: isRect ? null : cells, textPlacement: 'auto' };
  state.booths.push(merged);
  state.selectedIds.clear();
  state.selectedIds.add(merged.id);
  render(); updateProps();
}

// ─── L자 부스 ───
function openLBoothDialog() {
  openModal('modalLBooth');
}

function createLBooth() {
  const dir  = document.querySelector('input[name="lDir"]:checked')?.value || 'TR';
  const aW   = parseFloat(document.getElementById('lTotalW').value) || 0;
  const aH   = parseFloat(document.getElementById('lTotalH').value) || 0;
  const bW   = parseFloat(document.getElementById('lCutW').value)   || 0;
  const bH   = parseFloat(document.getElementById('lCutH').value)   || 0;

  if (aW <= 0 || aH <= 0 || bW <= 0 || bH <= 0) { alert('모든 값은 0보다 커야 합니다.'); return; }
  if (bW >= aW) { alert('잘린 너비는 전체 너비보다 작아야 합니다.'); return; }
  if (bH >= aH) { alert('잘린 높이는 전체 높이보다 작아야 합니다.'); return; }
  if ([aW, aH, bW, bH].some(v => v % 3 !== 0)) { alert('모든 값은 3m 배수여야 합니다.'); return; }

  // aW=전체너비, aH=전체높이, bW=잘린너비, bH=잘린높이
  const W    = aW * PX_PER_METER;   // 전체 bounding box 너비
  const H    = aH * PX_PER_METER;   // 전체 bounding box 높이
  const cWpx = bW * PX_PER_METER;   // 잘린 모서리 너비
  const cHpx = bH * PX_PER_METER;   // 잘린 모서리 높이
  const mH   = H - cHpx;            // 긴 쪽 높이 (전체 - 잘린)
  const mW   = W - cWpx;            // 긴 쪽 너비 (전체 - 잘린)

  // 뷰포트 중앙에 그리드 스냅
  const cw = canvas.width  / (window.devicePixelRatio || 1);
  const ch = canvas.height / (window.devicePixelRatio || 1);
  const center = screenToWorld(cw / 2, ch / 2);
  const bx = Math.round((center.x - W / 2) / GRID_PX) * GRID_PX;
  const by = Math.round((center.y - H / 2) / GRID_PX) * GRID_PX;

  // 방향별 cells (3개 셀 — 변이 완전히 맞닿아야 hasAdjacentEdge가 내부선 제거 가능)
  // TL=좌상단 결락, TR=우상단 결락, BL=좌하단 결락, BR=우하단 결락
  let cells;
  if (dir === 'TL') {
    // [NOTCH    ][top-right strip]
    // [bot-left ][bot-right      ]
    cells = [
      { x: bx + cWpx, y: by,         w: mW,   h: cHpx },  // top strip (우측)
      { x: bx,        y: by + cHpx,  w: cWpx, h: mH   },  // bottom left
      { x: bx + cWpx, y: by + cHpx,  w: mW,   h: mH   },  // bottom right
    ];
  } else if (dir === 'TR') {
    // [top-left strip][NOTCH]
    // [bot-left  ][bot-right]
    cells = [
      { x: bx,        y: by,         w: mW,   h: cHpx },  // top strip (좌측)
      { x: bx,        y: by + cHpx,  w: mW,   h: mH   },  // bottom left
      { x: bx + mW,   y: by + cHpx,  w: cWpx, h: mH   },  // bottom right
    ];
  } else if (dir === 'BL') {
    // [top-left][top-right]
    // [NOTCH   ][bot strip]
    cells = [
      { x: bx,        y: by,         w: cWpx, h: mH   },  // top left
      { x: bx + cWpx, y: by,         w: mW,   h: mH   },  // top right
      { x: bx + cWpx, y: by + mH,    w: mW,   h: cHpx },  // bottom strip (우측)
    ];
  } else { // BR
    // [top-left][top-right]
    // [bot strip][NOTCH   ]
    cells = [
      { x: bx,        y: by,         w: mW,   h: mH   },  // top left
      { x: bx + mW,   y: by,         w: cWpx, h: mH   },  // top right
      { x: bx,        y: by + mH,    w: mW,   h: cHpx },  // bottom strip (좌측)
    ];
  }

  // 텍스트 배치용 암(arm) rect — b.x/b.y 기준 상대 좌표(dx, dy) 저장
  // 절대 좌표 저장 시 부스 이동 후 어긋나므로 반드시 상대값 사용
  // wide = 전폭 row, tall = 전고 column
  let textRects;
  if (dir === 'TL') {
    textRects = {
      wide: { dx: 0,    dy: cHpx, w: W,  h: mH },  // 하단 전체 행 (전폭)
      tall: { dx: cWpx, dy: 0,    w: mW, h: H  },  // 우측 전체 열 (전고)
    };
  } else if (dir === 'TR') {
    textRects = {
      wide: { dx: 0, dy: cHpx, w: W,  h: mH },    // 하단 전체 행 (전폭)
      tall: { dx: 0, dy: 0,    w: mW, h: H  },    // 좌측 전체 열 (전고)
    };
  } else if (dir === 'BL') {
    textRects = {
      wide: { dx: 0,    dy: 0, w: W,  h: mH },    // 상단 전체 행 (전폭)
      tall: { dx: cWpx, dy: 0, w: mW, h: H  },    // 우측 전체 열 (전고)
    };
  } else { // BR
    textRects = {
      wide: { dx: 0, dy: 0, w: W,  h: mH },       // 상단 전체 행 (전폭)
      tall: { dx: 0, dy: 0, w: mW, h: H  },       // 좌측 전체 열 (전고)
    };
  }

  saveUndo();
  const booth = { id: state.nextId++, x: bx, y: by, w: W, h: H, boothId: '', status: 'available', companyUid: '', companyName: '', companyNameEn: '', companyLogoUrl: '', logoScale: 100, logoGap: 0, groupId: null, locked: false, memo: '', elecSide: '', otherSide: '', boothType: '', boothTypeCoverage: 100, boothTypeDir: 'full', cells, textPlacement: 'auto', textRects };
  state.booths.push(booth);
  state.selectedIds.clear();
  state.selectedIds.add(booth.id);

  closeModal('modalLBooth');
  render(); updateProps();
}

// ─── Divide ───
function openDivideDialog() {
  if (state.selectedIds.size !== 1) { alert('Select exactly one booth to divide.'); return; }
  openModal('modalDivide');
}
function executeDivide() {
  const b = getSelectedBooth();
  if (!b) return;
  const dir = document.querySelector('input[name="divDir"]:checked')?.value || 'h';
  const count = Math.max(2, Math.min(20, parseInt(document.getElementById('divCount').value) || 2));
  saveUndo();
  state.booths = state.booths.filter(x => x.id !== b.id);
  const newBooths = [];
  if (dir === 'h') {
    const nw = b.w / count;
    for (let i = 0; i < count; i++) newBooths.push({ id: state.nextId++, x: b.x + i * nw, y: b.y, w: nw, h: b.h, boothId: '', status: 'available', companyUid: '', companyName: '', companyNameEn: '', groupId: b.groupId, memo: '', elecSide: '', otherSide: '', boothType: '', boothTypeCoverage: 100, boothTypeDir: 'full' });
  } else {
    const nh = b.h / count;
    for (let i = 0; i < count; i++) newBooths.push({ id: state.nextId++, x: b.x, y: b.y + i * nh, w: b.w, h: nh, boothId: '', status: 'available', companyUid: '', companyName: '', companyNameEn: '', groupId: b.groupId, memo: '', elecSide: '', otherSide: '', boothType: '', boothTypeCoverage: 100, boothTypeDir: 'full' });
  }
  if (b.groupId) {
    const g = state.groups.find(g => g.id === b.groupId);
    if (g) {
      g.boothIds = g.boothIds.filter(id => id !== b.id);
      newBooths.forEach(nb => g.boothIds.push(nb.id));
    }
  }
  state.booths.push(...newBooths);
  state.selectedIds.clear();
  newBooths.forEach(nb => state.selectedIds.add(nb.id));
  state.lastCopyOp = null;
  closeModal('modalDivide');
  render(); updateProps();
}

// ─── Copy Operations ───
function openNumericCopyDialog() {
  if (!state.selectedIds.size && !state.selectedBaseNoIds.size) { alert('Select booths or BaseNo to copy.'); return; }
  openModal('modalNumCopy');
}
function executeNumericCopy() {
  const hasBooths = state.selectedIds.size > 0;
  const hasBaseNos = state.selectedBaseNoIds.size > 0;
  if (!hasBooths && !hasBaseNos) return;

  const dx = parseFloat(document.getElementById('numCopyDx').value) * PX_PER_METER || 0;
  const dy = parseFloat(document.getElementById('numCopyDy').value) * PX_PER_METER || 0;
  saveUndo();

  // Copy booths
  if (hasBooths) {
    const selected = state.booths.filter(b => state.selectedIds.has(b.id));
    const newBooths = selected.map(b => ({ id: state.nextId++, x: b.x + dx, y: b.y + dy, w: b.w, h: b.h, boothId: '', status: 'available', companyUid: '', companyName: '', companyNameEn: '', groupId: null, memo: '', elecSide: '', otherSide: '', boothType: '', boothTypeCoverage: 100, boothTypeDir: 'full' }));
    state.booths.push(...newBooths);
    state.selectedIds.clear();
    newBooths.forEach(nb => state.selectedIds.add(nb.id));
  }

  // Copy BaseNos
  if (hasBaseNos) {
    const selected = state.baseNumbers.filter(bn => state.selectedBaseNoIds.has(bn.id));
    const newBaseNos = selected.map(bn => ({ id: state.nextBaseNoId++, x: bn.x + dx, y: bn.y + dy, w: bn.w, h: bn.h, baseNo: bn.baseNo }));
    state.baseNumbers.push(...newBaseNos);
    state.selectedBaseNoIds.clear();
    newBaseNos.forEach(bn => state.selectedBaseNoIds.add(bn.id));
  }

  state.lastCopyOp = { dx, dy };
  updateRepeatBadge();
  closeModal('modalNumCopy');
  render(); updateProps();
}
function repeatLastCopy() {
  if (!state.lastCopyOp) return;
  const hasBooths = state.selectedIds.size > 0;
  const hasBaseNos = state.selectedBaseNoIds.size > 0;
  if (!hasBooths && !hasBaseNos) return;

  const { dx, dy } = state.lastCopyOp;
  saveUndo();

  // Repeat booth copy
  if (hasBooths) {
    const selected = state.booths.filter(b => state.selectedIds.has(b.id));
    const newBooths = selected.map(b => ({ id: state.nextId++, x: b.x + dx, y: b.y + dy, w: b.w, h: b.h, boothId: '', status: 'available', companyUid: '', companyName: '', companyNameEn: '', groupId: null, memo: '', elecSide: '', otherSide: '', boothType: '', boothTypeCoverage: 100, boothTypeDir: 'full' }));
    state.booths.push(...newBooths);
    state.selectedIds.clear();
    newBooths.forEach(nb => state.selectedIds.add(nb.id));
  }

  // Repeat BaseNo copy
  if (hasBaseNos) {
    const selected = state.baseNumbers.filter(bn => state.selectedBaseNoIds.has(bn.id));
    const newBaseNos = selected.map(bn => ({ id: state.nextBaseNoId++, x: bn.x + dx, y: bn.y + dy, w: bn.w, h: bn.h, baseNo: bn.baseNo }));
    state.baseNumbers.push(...newBaseNos);
    state.selectedBaseNoIds.clear();
    newBaseNos.forEach(bn => state.selectedBaseNoIds.add(bn.id));
  }

  render(); updateProps();
}
function executeArrayCopy() {
  if (!state.selectedIds.size) { alert('Select booths to array-copy.'); return; }
  const cols = Math.max(1, parseInt(document.getElementById('arrCols').value) || 1);
  const rows = Math.max(1, parseInt(document.getElementById('arrRows').value) || 1);
  const spx = parseFloat(document.getElementById('arrSpacingX').value) * PX_PER_METER || 0;
  const spy = parseFloat(document.getElementById('arrSpacingY').value) * PX_PER_METER || 0;
  const selected = state.booths.filter(b => state.selectedIds.has(b.id));
  if (!selected.length) return;
  const selW = Math.max(...selected.map(b => b.x + b.w)) - Math.min(...selected.map(b => b.x));
  const selH = Math.max(...selected.map(b => b.y + b.h)) - Math.min(...selected.map(b => b.y));
  const stepX = selW + spx;
  const stepY = selH + spy;
  saveUndo();
  const newBooths = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) continue;
      selected.forEach(b => {
        newBooths.push({ id: state.nextId++, x: b.x + c * stepX, y: b.y + r * stepY, w: b.w, h: b.h, boothId: '', status: 'available', companyUid: '', companyName: '', companyNameEn: '', groupId: null, memo: '', elecSide: b.elecSide || '', otherSide: b.otherSide || '' });
      });
    }
  }
  state.booths.push(...newBooths);
  state.selectedIds.clear();
  newBooths.forEach(nb => state.selectedIds.add(nb.id));
  state.lastCopyOp = null;
  closeModal('modalArrayCopy');
  render(); updateProps();
}

// ─── Island Groups ───
function groupSelected() {
  if (state.selectedIds.size < 2) { alert('Select at least 2 booths to group.'); return; }
  const ids = [...state.selectedIds];
  saveUndo();
  state.groups.forEach(g => { g.boothIds = g.boothIds.filter(id => !ids.includes(id)); });
  state.groups = state.groups.filter(g => g.boothIds.length > 0);
  const gid = state.nextGroupId++;
  const group = { id: gid, boothIds: ids, label: 'G' + gid };
  state.groups.push(group);
  state.booths.forEach(b => { if (ids.includes(b.id)) b.groupId = gid; });
  render();
}
function ungroupSelected() {
  const ids = [...state.selectedIds];
  const affectedGroups = new Set();
  ids.forEach(id => {
    const g = getBoothGroup(id);
    if (g) affectedGroups.add(g.id);
  });
  if (!affectedGroups.size) { alert('No groups in selection.'); return; }
  saveUndo();
  affectedGroups.forEach(gid => {
    state.groups = state.groups.filter(g => g.id !== gid);
    state.booths.forEach(b => { if (b.groupId === gid) b.groupId = null; });
  });
  state.editingGroupId = null;
  render();
}

// ─── Background Image Storage helpers ───
async function _uploadBgFileToStorage(file) {
  const path = `${_supaProjectId}/background`;
  const { error } = await _supaClient.storage
    .from('expomap-backgrounds')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data: { publicUrl } } = _supaClient.storage
    .from('expomap-backgrounds')
    .getPublicUrl(path);
  return publicUrl + '?t=' + Date.now(); // cache-bust
}

function _dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function _uploadBgDataUrlToStorage(dataUrl) {
  const blob = _dataUrlToBlob(dataUrl);
  const path = `${_supaProjectId}/background`;
  console.log('[BG Migration] 업로드 시작:', path, blob.size, 'bytes');
  const { error } = await _supaClient.storage
    .from('expomap-backgrounds')
    .upload(path, blob, { upsert: true, contentType: blob.type });
  if (error) { console.error('[BG Migration] 업로드 실패:', error); throw error; }
  const { data: { publicUrl } } = _supaClient.storage
    .from('expomap-backgrounds')
    .getPublicUrl(path);
  return publicUrl + '?t=' + Date.now();
}

// ─── Logo Storage helpers ───
async function _uploadLogoDataUrlToStorage(dataUrl, storagePath) {
  const blob = _dataUrlToBlob(dataUrl);
  const { error } = await _supaClient.storage
    .from('expomap-backgrounds')
    .upload(storagePath, blob, { upsert: true, contentType: blob.type });
  if (error) throw error;
  const { data: { publicUrl } } = _supaClient.storage
    .from('expomap-backgrounds')
    .getPublicUrl(storagePath);
  return publicUrl + '?t=' + Date.now();
}

async function _uploadCompanyLogoToStorage(dataUrl, companyUid) {
  const path = `${_supaProjectId}/logos/company_${companyUid}`;
  return _uploadLogoDataUrlToStorage(dataUrl, path);
}

// 페이지 로드 후 기존 base64 장식 로고 → Storage 마이그레이션 (백그라운드)
async function _migrateDecorativeLogos() {
  if (!_supaClient) return;
  const logosToMigrate = state.logos.filter(l => l.dataUrl && !l.storageUrl);
  if (logosToMigrate.length === 0) return;
  let migrated = 0;
  for (const logo of logosToMigrate) {
    try {
      const path = `${_supaProjectId}/logos/logo_${logo.id}`;
      const url = await _uploadLogoDataUrlToStorage(logo.dataUrl, path);
      logo.storageUrl = url;
      logo.dataUrl = null;
      migrated++;
    } catch (err) {
      console.warn('[Logo Migration] 실패:', logo.id, err);
    }
  }
  if (migrated > 0) {
    scheduleSave();
    console.log(`[Logo Migration] 장식 로고 ${migrated}개 마이그레이션 완료`);
  }
}

// 페이지 로드 후 기존 base64 회사 로고 → Storage 마이그레이션 (백그라운드)
async function _migrateCompanyLogos() {
  if (!_supaClient) return;
  // 회사별로 중복 없이 수집
  const companyLogoMap = new Map(); // companyUid → dataUrl
  for (const b of state.booths) {
    if (b.companyLogoUrl && b.companyLogoUrl.startsWith('data:') && b.companyUid) {
      if (!companyLogoMap.has(b.companyUid)) {
        companyLogoMap.set(b.companyUid, b.companyLogoUrl);
      }
    }
  }
  if (companyLogoMap.size === 0) return;
  let migrated = 0;
  for (const [companyUid, dataUrl] of companyLogoMap) {
    try {
      const url = await _uploadCompanyLogoToStorage(dataUrl, companyUid);
      // 해당 회사의 모든 부스 업데이트
      state.booths.forEach(b => {
        if (b.companyUid === companyUid) {
          b.companyLogoUrl = url;
          state.logoCache.delete(b.id);
        }
      });
      // companies 배열 업데이트
      const company = state.companies.find(c => c.company_uid === companyUid);
      if (company) company.logo_url = url;
      migrated++;
    } catch (err) {
      console.warn('[Company Logo Migration] 실패:', companyUid, err);
    }
  }
  if (migrated > 0) {
    scheduleSave();
    console.log(`[Company Logo Migration] ${migrated}개 회사 마이그레이션 완료`);
  }
}

// ─── Background Image ───
document.getElementById('bgUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  const applyBg = (src) => {
    const img = new Image();
    if (src.startsWith('http')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      state.bg.img = img;
      state.bg.natW = img.naturalWidth;
      state.bg.natH = img.naturalHeight;
      state.bg.w = img.naturalWidth;
      state.bg.h = img.naturalHeight;
      state.bg.x = 0;
      state.bg.y = 0;
      state.bg.visible = true;
      state.bg.rotation = 0;
      scheduleSave();
      updateBgFineTuneInputs();
      render();
    };
    img.src = src;
  };

  if (_supaClient) {
    updateSaveIndicator('saving');
    try {
      const url = await _uploadBgFileToStorage(file);
      state.bg.storageUrl = url;
      state.bg.dataUrl = null;
      localStorage.removeItem('expomap_bg_dataurl_' + _supaProjectId);
      applyBg(url);
      return;
    } catch (err) {
      console.warn('Storage 업로드 실패, 로컬 폴백 사용:', err);
    }
  }

  // Storage 실패 or 미연결 시 기존 dataUrl 방식 폴백
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    state.bg.dataUrl = dataUrl;
    state.bg.storageUrl = null;
    try { localStorage.setItem('expomap_bg_dataurl_' + _supaProjectId, dataUrl); } catch(err) { console.warn('BG localStorage 저장 실패:', err); }
    applyBg(dataUrl);
  };
  reader.readAsDataURL(file);
});
document.getElementById('bgOpacity').addEventListener('input', (e) => {
  state.bg.opacity = e.target.value / 100;
  document.getElementById('bgOpacityVal').textContent = e.target.value + '%';
  render();
});
document.getElementById('btnBgToggle').addEventListener('click', () => {
  state.bg.visible = !state.bg.visible;
  document.getElementById('btnBgToggle').textContent = state.bg.visible ? 'Hide' : 'Show';
  render();
});
document.getElementById('btnBgRemove').addEventListener('click', async () => {
  if (_supaClient && state.bg.storageUrl) {
    try {
      await _supaClient.storage
        .from('expomap-backgrounds')
        .remove([`${_supaProjectId}/background`]);
    } catch (err) { console.warn('Storage 파일 삭제 실패:', err); }
  }
  state.bg.img = null;
  state.bg.dataUrl = null;
  state.bg.storageUrl = null;
  localStorage.removeItem('expomap_bg_dataurl_' + _supaProjectId);
  scheduleSave();
  render();
});
document.getElementById('btnBgMove').addEventListener('click', () => {
  state.bgMoveMode = !state.bgMoveMode;
  document.getElementById('btnBgMove').classList.toggle('active', state.bgMoveMode);
  container.classList.toggle('bg-move', state.bgMoveMode);
  if (state.bgMoveMode) {
    // exit other modes
    state.structMode = null;
    clearStructButtons();
    showStructHint('Drag to move background image. Click "Move BG" again to exit.');
  } else {
    hideStructHint();
  }
});
document.getElementById('btnCalibrate').addEventListener('click', () => {
  if (!state.bg.img) { alert('Upload a background image first.'); return; }
  state.bgCalMode = true;
  state.bgCalPoints = [];
  showCalHint('Click point 1 on the background image');
});
function showCalHint(msg) {
  let hint = document.getElementById('calHint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'calHint';
    hint.className = 'cal-hint';
    container.appendChild(hint);
  }
  hint.textContent = msg;
  hint.style.display = 'block';
}
function hideCalHint() {
  const hint = document.getElementById('calHint');
  if (hint) hint.style.display = 'none';
  state.bgCalMode = false;
}
function showStructHint(msg) {
  let hint = document.getElementById('structHint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'structHint';
    hint.className = 'struct-hint';
    container.appendChild(hint);
  }
  hint.textContent = msg;
  hint.style.display = 'block';
}
function hideStructHint() {
  const hint = document.getElementById('structHint');
  if (hint) hint.style.display = 'none';
}
function showMeasureAlert() {
  if (document.getElementById('measureAlert')) return; // 중복 방지
  const el = document.createElement('div');
  el.id = 'measureAlert';
  el.style.cssText = [
    'position:fixed', 'bottom:28px', 'left:50%', 'transform:translateX(-50%)',
    'background:#1565C0', 'color:#fff', 'padding:10px 22px', 'border-radius:8px',
    'font-size:13px', 'z-index:9999', 'box-shadow:0 4px 16px rgba(0,0,0,0.25)',
    'pointer-events:none', 'white-space:nowrap'
  ].join(';');
  el.textContent = '실측 레이어를 켜시고 실측 라인을 확인해주세요.';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
function cancelCalibration() {
  hideCalHint();
  state.bgCalPoints = [];
  closeModal('modalCalDist');
  render();
}
function applyCalibration() {
  const pts = state.bgCalPoints;
  if (pts.length < 2) return;
  const dist = parseFloat(document.getElementById('calDistance').value);
  if (!dist || dist <= 0) return;
  const pixelDist = Math.sqrt((pts[1].x - pts[0].x) ** 2 + (pts[1].y - pts[0].y) ** 2);
  if (pixelDist < 1) { alert('Points too close. Try again.'); closeModal('modalCalDist'); return; }
  const scaleFactor = (dist * PX_PER_METER) / pixelDist;
  const mx = (pts[0].x + pts[1].x) / 2;
  const my = (pts[0].y + pts[1].y) / 2;
  const fracX = (mx - state.bg.x) / state.bg.w;
  const fracY = (my - state.bg.y) / state.bg.h;
  state.bg.w = state.bg.natW * scaleFactor;
  state.bg.h = state.bg.natH * scaleFactor;
  state.bg.x = mx - fracX * state.bg.w;
  state.bg.y = my - fracY * state.bg.h;
  closeModal('modalCalDist');
  hideCalHint();
  state.bgCalPoints = [];
  scheduleSave();
  render();
}

// ─── Structures ───
function createStructure(type, props) {
  saveUndo();
  const s = { id: state.nextStructId++, type, locked: false, ...props };
  state.structures.push(s);
  state.selectedStructId = s.id;
  render();
  return s;
}
function getStructAt(wx, wy) {
  const hitR = 6 / state.zoom;
  for (let i = state.structures.length - 1; i >= 0; i--) {
    const s = state.structures[i];
    if (s.type === 'column' || s.type === 'circle') {
      const dx = wx - s.x, dy = wy - s.y;
      if (dx * dx + dy * dy <= (s.radius + hitR) * (s.radius + hitR)) return s;
    } else if (s.type === 'wall' || s.type === 'line' || s.type === 'arrow') {
      const d = distToSegment(wx, wy, s.x1, s.y1, s.x2, s.y2);
      if (d < hitR + 2) return s;
    } else if (s.type === 'door' || s.type === 'rect') {
      if (wx >= s.x && wx <= s.x + s.w && wy >= s.y && wy <= s.y + s.h) return s;
    } else if (s.type === 'text') {
      if (wx >= s.x && wx <= s.x + (s.w || 50) && wy >= s.y - (s.fontSize || 12) && wy <= s.y + 4) return s;
    }
  }
  return null;
}
function getStructCenter(s) {
  if (s.type === 'column' || s.type === 'circle') return { x: s.x, y: s.y };
  if (s.type === 'wall' || s.type === 'line' || s.type === 'arrow') return { x: (s.x1+s.x2)/2, y: (s.y1+s.y2)/2 };
  if (s.type === 'door' || s.type === 'rect') return { x: s.x + s.w/2, y: s.y + s.h/2 };
  if (s.type === 'text') return { x: s.x, y: s.y };
  return { x: 0, y: 0 };
}
function getStructHandles(s) {
  if (!s) return [];
  const t = s.type;
  if (t === 'rect' || t === 'door') {
    return [
      { id: 'nw', x: s.x,           y: s.y           },
      { id: 'n',  x: s.x + s.w/2,   y: s.y           },
      { id: 'ne', x: s.x + s.w,     y: s.y           },
      { id: 'e',  x: s.x + s.w,     y: s.y + s.h/2   },
      { id: 'se', x: s.x + s.w,     y: s.y + s.h     },
      { id: 's',  x: s.x + s.w/2,   y: s.y + s.h     },
      { id: 'sw', x: s.x,           y: s.y + s.h     },
      { id: 'w',  x: s.x,           y: s.y + s.h/2   },
    ];
  }
  if (t === 'circle' || t === 'column') {
    return [
      { id: 'n', x: s.x,            y: s.y - s.radius },
      { id: 'e', x: s.x + s.radius, y: s.y            },
      { id: 's', x: s.x,            y: s.y + s.radius },
      { id: 'w', x: s.x - s.radius, y: s.y            },
    ];
  }
  if (t === 'wall' || t === 'line' || t === 'arrow') {
    return [
      { id: 'p1', x: s.x1, y: s.y1 },
      { id: 'p2', x: s.x2, y: s.y2 },
    ];
  }
  return [];
}
function getStructHandleAt(s, wx, wy) {
  const hitR = 7 / state.zoom;
  for (const h of getStructHandles(s)) {
    if (Math.abs(wx - h.x) <= hitR && Math.abs(wy - h.y) <= hitR) return h;
  }
  return null;
}
function applyStructResize(s, handleId, wx, wy) {
  if (s.type === 'rect' || s.type === 'door') {
    const x2 = s.x + s.w, y2 = s.y + s.h;
    if (handleId === 'nw') { s.x = wx; s.y = wy; s.w = x2 - wx; s.h = y2 - wy; }
    else if (handleId === 'n')  { s.y = wy; s.h = y2 - wy; }
    else if (handleId === 'ne') { s.y = wy; s.w = wx - s.x; s.h = y2 - wy; }
    else if (handleId === 'e')  { s.w = wx - s.x; }
    else if (handleId === 'se') { s.w = wx - s.x; s.h = wy - s.y; }
    else if (handleId === 's')  { s.h = wy - s.y; }
    else if (handleId === 'sw') { s.x = wx; s.w = x2 - wx; s.h = wy - s.y; }
    else if (handleId === 'w')  { s.x = wx; s.w = x2 - wx; }
    if (s.w < 5) s.w = 5;
    if (s.h < 5) s.h = 5;
  } else if (s.type === 'circle' || s.type === 'column') {
    const dx = wx - s.x, dy = wy - s.y;
    s.radius = Math.max(3, Math.sqrt(dx*dx + dy*dy));
  } else if (s.type === 'wall' || s.type === 'line' || s.type === 'arrow') {
    if (handleId === 'p1') { s.x1 = wx; s.y1 = wy; }
    else if (handleId === 'p2') { s.x2 = wx; s.y2 = wy; }
  }
}
function moveStruct(s, dx, dy) {
  if (s.locked) return;
  if (s.type === 'column' || s.type === 'circle' || s.type === 'text') { s.x += dx; s.y += dy; }
  else if (s.type === 'wall' || s.type === 'line' || s.type === 'arrow') { s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; }
  else if (s.type === 'door' || s.type === 'rect') { s.x += dx; s.y += dy; }
}
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}
function clearStructButtons() {
  document.querySelectorAll('#structGroup .tool-btn').forEach(b => b.classList.remove('active'));
}

// ─── Z-Order ───
function bringToFront() {
  if (state.selectedIds.size) {
    saveUndo();
    const sel = state.booths.filter(b => state.selectedIds.has(b.id));
    state.booths = state.booths.filter(b => !state.selectedIds.has(b.id));
    state.booths.push(...sel);
    render();
  } else if (state.selectedStructId) {
    saveUndo();
    const idx = state.structures.findIndex(s => s.id === state.selectedStructId);
    if (idx >= 0) {
      const [s] = state.structures.splice(idx, 1);
      state.structures.push(s);
      render();
    }
  } else if (state.selectedLogoId) {
    saveUndo();
    const idx = state.logos.findIndex(l => l.id === state.selectedLogoId);
    if (idx >= 0) {
      const [l] = state.logos.splice(idx, 1);
      state.logos.push(l);
      render();
    }
  }
}
function sendToBack() {
  if (state.selectedIds.size) {
    saveUndo();
    const sel = state.booths.filter(b => state.selectedIds.has(b.id));
    state.booths = state.booths.filter(b => !state.selectedIds.has(b.id));
    state.booths.unshift(...sel);
    render();
  } else if (state.selectedStructId) {
    saveUndo();
    const idx = state.structures.findIndex(s => s.id === state.selectedStructId);
    if (idx >= 0) {
      const [s] = state.structures.splice(idx, 1);
      state.structures.unshift(s);
      render();
    }
  } else if (state.selectedLogoId) {
    saveUndo();
    const idx = state.logos.findIndex(l => l.id === state.selectedLogoId);
    if (idx >= 0) {
      const [l] = state.logos.splice(idx, 1);
      state.logos.unshift(l);
      render();
    }
  }
}

// ─── Lock/Unlock ───
function toggleLock() {
  if (state.selectedIds.size) {
    saveUndo();
    state.booths.forEach(b => {
      if (state.selectedIds.has(b.id)) b.locked = !b.locked;
    });
    render(); updateProps();
  } else if (state.selectedStructId) {
    saveUndo();
    const s = state.structures.find(s => s.id === state.selectedStructId);
    if (s) { s.locked = !s.locked; render(); }
  } else if (state.selectedLogoId) {
    saveUndo();
    const l = state.logos.find(l => l.id === state.selectedLogoId);
    if (l) { l.locked = !l.locked; render(); }
  }
}

// ─── Logos & Images ───
document.getElementById('logoUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const dataUrl = ev.target.result;
    const img = new Image();
    img.onload = async () => {
      const scale = 100 / img.naturalWidth;
      const logoId = state.nextLogoId++;
      const logo = {
        id: logoId,
        x: (state.mouseX || 100),
        y: (state.mouseY || 100),
        w: img.naturalWidth * scale,
        h: img.naturalHeight * scale,
        storageUrl: null,
        dataUrl: dataUrl,  // 임시, Storage 업로드 완료 후 제거
        name: file.name,
        _img: img,
      };
      saveUndo();
      state.logos.push(logo);
      state.selectedLogoId = logoId;
      updateLogoList();
      render();
      // Storage 업로드 (백그라운드)
      if (_supaClient) {
        try {
          const path = `${_supaProjectId}/logos/logo_${logoId}`;
          const url = await _uploadLogoDataUrlToStorage(dataUrl, path);
          logo.storageUrl = url;
          logo.dataUrl = null;
          scheduleSave();
        } catch (err) {
          console.warn('[Logo] Storage 업로드 실패, dataUrl 유지:', err);
          scheduleSave();
        }
      } else {
        scheduleSave();
      }
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
});

let _bgLoadPromise = null;
function getBgLoadPromise() { return _bgLoadPromise; }

// 모바일에서 Supabase Storage URL을 이미지 transform 엔드포인트로 변환
// width=1200, quality=65, format=webp → 수 MB PNG를 수백 KB로 축소
function _getMobileBgUrl(src) {
  if (!src || window.innerWidth > 768) return src;
  if (!src.includes('/storage/v1/object/public/')) return src;
  return src
    .replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    .replace(/\?[^#]*/, '')  // 기존 쿼리 파라미터 제거
    + '?width=1200&quality=65&format=webp';
}

function restoreBgImage(src) {
  const optimizedSrc = _getMobileBgUrl(src);
  const img = new Image();
  if (optimizedSrc && optimizedSrc.startsWith('http')) img.crossOrigin = 'anonymous';
  _bgLoadPromise = new Promise((resolve) => {
    img.onload = () => {
      state.bg.img = img;
      if (!src.startsWith('http')) state.bg.dataUrl = src;
      render();
      resolve(true);
    };
    img.onerror = () => {
      if (optimizedSrc !== src) {
        // transform 실패 → 원본 URL로 재시도
        console.warn('BG transform load failed, retrying with original:', src);
        const fallback = new Image();
        if (src.startsWith('http')) fallback.crossOrigin = 'anonymous';
        fallback.onload = () => { state.bg.img = fallback; render(); resolve(true); };
        fallback.onerror = () => { console.warn('BG image load failed:', src); resolve(false); };
        fallback.src = src;
      } else {
        console.warn('BG image load failed:', src);
        resolve(false);
      }
    };
  });
  img.src = optimizedSrc;
}

function restoreLogos(logoData) {
  state.logos = logoData.map(l => {
    const img = new Image();
    const src = l.storageUrl || l.dataUrl;
    if (src) {
      if (src.startsWith('http')) img.crossOrigin = 'anonymous';
      img.onload = () => render();
      img.src = src;
    }
    return { ...l, _img: img };
  });
  updateLogoList();
}

function getLogoAt(wx, wy) {
  for (let i = state.logos.length - 1; i >= 0; i--) {
    const l = state.logos[i];
    if (wx >= l.x && wx <= l.x + l.w && wy >= l.y && wy <= l.y + l.h) return l;
  }
  return null;
}

function getLogoResizeCorner(logo, wx, wy) {
  const hitSize = 6 / state.zoom;
  // bottom-right corner
  if (Math.abs(wx - (logo.x + logo.w)) < hitSize && Math.abs(wy - (logo.y + logo.h)) < hitSize) return 'br';
  return null;
}

function updateLogoList() {
  const el = document.getElementById('logoList');
  if (!state.logos.length) { el.innerHTML = ''; return; }
  el.innerHTML = state.logos.map(l =>
    `<div style="display:flex;align-items:center;gap:4px;padding:2px 0">
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.name}</span>
      <button onclick="deleteLogo(${l.id})" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:11px">✕</button>
    </div>`
  ).join('');
}

function deleteLogo(id) {
  saveUndo();
  const logo = state.logos.find(l => l.id === id);
  state.logos = state.logos.filter(l => l.id !== id);
  if (state.selectedLogoId === id) state.selectedLogoId = null;
  updateLogoList();
  render();
  // Storage 파일 삭제 (best-effort)
  if (_supaClient && logo?.storageUrl) {
    _supaClient.storage
      .from('expomap-backgrounds')
      .remove([`${_supaProjectId}/logos/logo_${id}`])
      .catch(err => console.warn('[Logo] Storage 삭제 실패:', err));
  }
}

// ─── Company Logo Caching & Upload ───
function getLogoImage(booth, logoCache) {
  if (!booth.companyLogoUrl) return null;
  const cacheKey = booth.id;

  if (logoCache.has(cacheKey)) {
    return logoCache.get(cacheKey);
  }

  const img = new Image();
  if (booth.companyLogoUrl.startsWith('http')) img.crossOrigin = 'anonymous';
  img.src = booth.companyLogoUrl;
  img.onload = () => {
    logoCache.set(cacheKey, img);
    render();
  };
  img.onerror = () => {
    console.warn('Failed to load logo for booth:', booth.id);
  };
  return null;  // 로딩 중엔 null, onload 시 재렌더
}

async function uploadCompanyLogo(file, companyUid) {
  if (!file.type.startsWith('image/')) {
    alert('이미지 파일만 업로드 가능합니다 (PNG/JPEG).');
    return null;
  }

  const progress = document.getElementById('propLogoUploadProgress');
  progress.style.display = 'block';
  progress.textContent = '리사이즈 중...';

  const MAX_SIZE = 1040;

  // 파일 읽기 + 리사이즈
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > MAX_SIZE || h > MAX_SIZE) {
          if (w > h) { h = Math.round(h * MAX_SIZE / w); w = MAX_SIZE; }
          else { w = Math.round(w * MAX_SIZE / h); h = MAX_SIZE; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png', 0.9));
      };
      img.onerror = () => reject(new Error('이미지 로드 실패'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsDataURL(file);
  }).catch(err => {
    alert(err.message);
    progress.style.display = 'none';
    return null;
  });

  if (!dataUrl) return null;

  // Storage 업로드 시도
  if (_supaClient && companyUid) {
    try {
      progress.textContent = '업로드 중...';
      const url = await _uploadCompanyLogoToStorage(dataUrl, companyUid);
      progress.textContent = '완료';
      setTimeout(() => { progress.style.display = 'none'; }, 1500);
      return url;
    } catch (err) {
      console.warn('[Company Logo] Storage 업로드 실패, dataUrl 사용:', err);
    }
  }

  progress.textContent = '완료';
  setTimeout(() => { progress.style.display = 'none'; }, 1500);
  return dataUrl;
}

function drawLogos(c, zoom) {
  state.logos.forEach(l => {
    if (l._img && l._img.complete) {
      c.drawImage(l._img, l.x, l.y, l.w, l.h);
    }
    // 선택 표시
    if (l.id === state.selectedLogoId) {
      c.strokeStyle = '#4F8CFF';
      c.lineWidth = 2 / zoom;
      c.setLineDash([4/zoom, 4/zoom]);
      c.strokeRect(l.x, l.y, l.w, l.h);
      c.setLineDash([]);
      // resize handle (bottom-right)
      const hs = 6 / zoom;
      c.fillStyle = '#4F8CFF';
      c.fillRect(l.x + l.w - hs, l.y + l.h - hs, hs * 2, hs * 2);
    }
  });
}

// ─── Booth Numbering ───
function executeAutoNumber() {
  const zone = document.getElementById('numZone').value.trim() || 'A';
  const start = parseInt(document.getElementById('numStart').value) || 1;
  const dir = document.getElementById('numDir').value;
  const target = document.getElementById('numTarget').value;
  const overwrite = document.getElementById('numOverwrite').checked;
  let booths = target === 'selected' ? state.booths.filter(b => state.selectedIds.has(b.id)) : [...state.booths];
  if (!booths.length) { alert('No booths to number.'); return; }
  if      (dir === 'lr-tb') booths.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
  else if (dir === 'lr-bt') booths.sort((a, b) => a.y !== b.y ? b.y - a.y : a.x - b.x);
  else if (dir === 'tb-lr') booths.sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
  else if (dir === 'bt-lr') booths.sort((a, b) => a.x !== b.x ? a.x - b.x : b.y - a.y);
  else if (dir === 'rl-tb') booths.sort((a, b) => a.y !== b.y ? a.y - b.y : b.x - a.x);
  else if (dir === 'rl-bt') booths.sort((a, b) => a.y !== b.y ? b.y - a.y : b.x - a.x);
  saveUndo();
  let n = start;
  booths.forEach(b => {
    if (!b.boothId || overwrite) {
      b.boothId = zone + '-' + String(n).padStart(2, '0');
      n++;
    }
  });
  closeModal('modalBoothNum');
  render(); updateProps();
}

// ─── BaseNo Auto Numbering ───
function executeAutoAssignBaseNo() {
  const dir = document.getElementById('baseNoNumDir').value || 'lr-tb';
  // 선택된 BaseNo만 할당 (선택 없으면 모두)
  let baseNumbers = state.selectedBaseNoIds.size > 0
    ? state.baseNumbers.filter(bn => state.selectedBaseNoIds.has(bn.id))
    : [...state.baseNumbers];
  if (!baseNumbers.length) { alert('할당할 기본부스번호가 없습니다.'); return; }
  // Sort by direction
  if      (dir === 'lr-tb') baseNumbers.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
  else if (dir === 'lr-bt') baseNumbers.sort((a, b) => a.y !== b.y ? b.y - a.y : a.x - b.x);
  else if (dir === 'tb-lr') baseNumbers.sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
  else if (dir === 'bt-lr') baseNumbers.sort((a, b) => a.x !== b.x ? a.x - b.x : b.y - a.y);
  else if (dir === 'rl-tb') baseNumbers.sort((a, b) => a.y !== b.y ? a.y - b.y : b.x - a.x);
  else if (dir === 'rl-bt') baseNumbers.sort((a, b) => a.y !== b.y ? b.y - a.y : b.x - a.x);
  saveUndo();
  const zone = document.getElementById('baseNoNumZone').value.trim() || 'A';
  const start = parseInt(document.getElementById('baseNoNumStart').value) || 1;
  let n = start;
  baseNumbers.forEach(bn => {
    if (!bn.baseNo) {
      bn.baseNo = zone + '-' + String(n).padStart(2, '0');
      n++;
    }
  });
  closeModal('modalBaseNoNum');
  render(); updateProps(); scheduleSave();
}

// ─── Excel Import ───
let _importRawData = null;
let _importColHeaders = [];
let _importMapping = {};
let _importStep = 1;

const TARGET_FIELDS = ['company_uid', 'company_name', 'booth_id', 'booth_type', 'booth_size', 'contact_name', 'contact_phone', 'note', 'elec_lighting', 'elec_power', 'elec_3p3w', 'elec_3p4w', 'elec_24h', 'elec_rigging', 'other_tela', 'other_telb', 'other_net', 'other_giga', 'other_wifi', 'other_water', 'other_air', '(skip)'];

document.getElementById('excelFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      _importRawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!_importRawData.length) { alert('Empty file.'); return; }
      _importColHeaders = _importRawData[0].map(h => String(h));
      document.getElementById('importFileInfo').textContent = `✓ ${file.name} — ${_importRawData.length - 1} rows, ${_importColHeaders.length} columns`;
      document.getElementById('importBtnNext').disabled = false;
    } catch (err) {
      alert('Failed to parse file: ' + err.message);
    }
  };
  reader.readAsBinaryString(file);
  e.target.value = '';
});

function importNext() {
  if (_importStep === 1) {
    if (!_importRawData) { alert('Upload a file first.'); return; }
    buildColMapping();
    setImportStep(2);
  } else if (_importStep === 2) {
    gatherMapping();
    buildPreview();
    setImportStep(3);
    document.getElementById('importBtnNext').textContent = 'Import';
  } else if (_importStep === 3) {
    confirmImport();
  }
}
function importPrev() {
  if (_importStep === 2) { setImportStep(1); document.getElementById('importBtnBack').style.display = 'none'; }
  else if (_importStep === 3) { setImportStep(2); document.getElementById('importBtnNext').textContent = 'Next →'; }
}
function setImportStep(n) {
  _importStep = n;
  [1,2,3].forEach(i => {
    document.getElementById('importStep' + i).classList.toggle('active', i === n);
    const lbl = document.getElementById('importStep' + i + 'Label');
    lbl.classList.toggle('active', i === n);
    lbl.classList.toggle('done', i < n);
  });
  document.getElementById('importBtnBack').style.display = n > 1 ? 'inline-block' : 'none';
}
function buildColMapping() {
  const container2 = document.getElementById('colMappingRows');
  container2.innerHTML = '';
  _importMapping = {};
  _importColHeaders.forEach((h, i) => {
    const row = document.createElement('div');
    row.className = 'col-map-row';
    let autoMatch = '(skip)';
    const normalized = normalizeElecKey(h);
    if (TARGET_FIELDS.includes(normalized) && normalized !== '(skip)') {
      autoMatch = normalized;
    } else {
      TARGET_FIELDS.forEach(f => { if (f !== '(skip)' && h.toLowerCase().replace(/[_ ]/g,'').includes(f.replace(/[_ ]/g,'').toLowerCase())) autoMatch = f; });
    }
    row.innerHTML = `<span class="col-name" title="${h}">${h}</span><select data-col="${i}">${TARGET_FIELDS.map(f => `<option value="${f}" ${f === autoMatch ? 'selected' : ''}>${f}</option>`).join('')}</select>`;
    container2.appendChild(row);
  });
}
function gatherMapping() {
  _importMapping = {};
  document.querySelectorAll('#colMappingRows select').forEach(sel => {
    const colIdx = parseInt(sel.dataset.col);
    const field = sel.value;
    if (field !== '(skip)') _importMapping[field] = colIdx;
  });
}
function buildPreview() {
  const rows = _importRawData.slice(1, 51);
  const head = document.getElementById('previewHead');
  const body = document.getElementById('previewBody');
  const fields = Object.keys(_importMapping).filter(f => f !== '(skip)');
  head.innerHTML = '<tr>' + fields.map(f => `<th>${f}</th>`).join('') + '<th>Action</th></tr>';
  body.innerHTML = '';
  let newCount = 0, updateCount = 0;
  rows.forEach(row => {
    const obj = {};
    fields.forEach(f => { obj[f] = String(row[_importMapping[f]] ?? ''); });
    const existBooth = obj.booth_id ? state.booths.find(b => b.boothId === obj.booth_id) : null;
    const existComp = obj.company_uid ? state.companies.find(c => c.company_uid === obj.company_uid) : null;
    let badge;
    if (existBooth || existComp) { badge = '<span class="badge-update">update</span>'; updateCount++; }
    else { badge = '<span class="badge-new">new</span>'; newCount++; }
    const tr = document.createElement('tr');
    tr.innerHTML = fields.map(f => `<td>${obj[f] || ''}</td>`).join('') + `<td>${badge}</td>`;
    body.appendChild(tr);
  });
  document.getElementById('importSummary').innerHTML = `<b>${_importRawData.length - 1}</b> rows: <span class="badge-new">${newCount} new</span> <span class="badge-update">${updateCount} update</span> (preview shows first 50)`;
}
function confirmImport() {
  const rows = _importRawData.slice(1);
  const fields = Object.keys(_importMapping).filter(f => f !== '(skip)');
  saveUndo();
  rows.forEach(row => {
    const obj = {};
    fields.forEach(f => { obj[f] = String(row[_importMapping[f]] ?? ''); });
    if (!obj.company_uid && !obj.company_name) return;
    let comp = state.companies.find(c => c.company_uid === obj.company_uid);
    if (!comp) { comp = {}; state.companies.push(comp); }
    Object.assign(comp, obj);
    ELEC_KEYS.forEach(k => { if (obj[k] !== undefined) comp[k] = parseFloat(obj[k]) || 0; });
    OTHER_KEYS.forEach(k => { if (obj[k] !== undefined) comp[k] = parseFloat(obj[k]) || 0; });
    if (obj.booth_id) {
      const booth = state.booths.find(b => b.boothId === obj.booth_id);
      if (booth) {
        booth.companyUid = obj.company_uid || obj.company_name;
        booth.companyName = obj.company_name || '';
        booth.companyNameEn = obj.company_name_en || '';
        if (!booth.status || booth.status === 'available') booth.status = 'assigned';
      }
    }
  });
  closeModal('modalImport');
  render(); updateProps();
  alert(`Import complete. ${state.companies.length} companies loaded.`);
}

// ─── Export Region ───
function startExportRegion() {
  closeModal('modalExport');
  state.exportRegionMode = true;
  state.exportRegionStart = null;
  showStructHint('드래그해서 Export 영역을 지정하세요. Escape 취소.');
}
function clearExportRegion() {
  state.exportRegion = null;
  document.getElementById('btnClearExportRegion').style.display = 'none';
  document.getElementById('exportRegionInfo').textContent = '미지정 시 부스 전체 영역 자동';
}
function updateExportRegionUI() {
  const r = state.exportRegion;
  if (r) {
    document.getElementById('btnClearExportRegion').style.display = '';
    document.getElementById('exportRegionInfo').textContent =
      `지정됨: ${pxToM(r.w).toFixed(1)}×${pxToM(r.h).toFixed(1)}m`;
  }
}

