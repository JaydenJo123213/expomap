// ─── Version History ───

// ─── 자동 저장 상태 ───
// "첫 변경 발생 후 4시간 뒤 저장" 방식
// → 변경이 생기면 타이머를 한 번만 걸고, 4시간 후 실행. 그 사이 추가 변경은 무시(타이머 재설정 안 함).
let _autoVersionTimer = null;
const AUTO_VERSION_DELAY_MS = 4 * 60 * 60 * 1000; // 4시간
const VERSION_MAX_DAYS = 7;

// scheduleSave() 호출 시 이 함수가 호출됨 (supabase.js)
function markVersionDirty() {
  if (_autoVersionTimer !== null) return; // 이미 타이머 걸려 있으면 무시
  _autoVersionTimer = setTimeout(async () => {
    _autoVersionTimer = null;
    if (!_supaClient) return;
    await _insertVersionRow('자동저장 ' + formatKoreanDateTime(new Date()));
    await runVersionCleanup();
    if (document.getElementById('sidebarTab-history')?.classList.contains('active')) {
      renderVersionList(await loadVersionList());
    }
  }, AUTO_VERSION_DELAY_MS);
}

// init.js에서 호출 — 현재는 markVersionDirty()가 자체적으로 타이머를 관리하므로 빈 함수
function initAutoVersion() {
  // no-op: markVersionDirty()가 직접 타이머를 스케줄함
}

// ─── 유틸 ───

function formatKoreanDateTime(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '방금';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

// ─── 스냅샷 ───

function buildVersionSnapshot() {
  return {
    booths: state.booths.map(b => ({ ...b })),
    groups: state.groups.map(g => ({ ...g, boothIds: [...g.boothIds] })),
    structures: state.structures.map(s => ({ ...s })),
    logos: state.logos.map(l => ({ id: l.id, x: l.x, y: l.y, w: l.w, h: l.h, name: l.name, dataUrl: null })),
    companies: state.companies.map(c => ({ ...c })),
    nextId: state.nextId,
    nextGroupId: state.nextGroupId,
    nextStructId: state.nextStructId,
    nextLogoId: state.nextLogoId,
    baseNumbers: state.baseNumbers.map(b => ({ ...b })),
    nextBaseNoId: state.nextBaseNoId,
    discussOverlays: state.discussOverlays.map(o => ({ ...o })),
    nextDiscussOverlayId: state.nextDiscussOverlayId,
    nextDiscussGroupId: state.nextDiscussGroupId,
    freeBooths: (state.freeBooths || []).map(f => ({ ...f })),
    measureLines: state.measureLines.map(m => ({ ...m })),
    nextMeasureLineId: state.nextMeasureLineId,
    bg: {
      x: state.bg.x, y: state.bg.y,
      w: state.bg.w, h: state.bg.h,
      natW: state.bg.natW, natH: state.bg.natH,
      opacity: state.bg.opacity,
      visible: state.bg.visible,
      rotation: state.bg.rotation || 0,
      dataUrl: null,
    },
  };
}

// ─── 저장 ───

// 실제 INSERT (버튼/자동저장 공통)
async function _insertVersionRow(versionName) {
  const snapshot = buildVersionSnapshot();
  const { error } = await _supaClient
    .from('expomap_versions')
    .insert({ exhibition_id: _supaProjectId, version_name: versionName, state_json: snapshot });
  if (error) throw error;
}

// 버튼 클릭 시 수동 저장
async function saveVersion() {
  if (!_supaClient) { alert('Supabase에 연결되지 않았습니다.'); return; }
  const btn = document.getElementById('btnSaveVersion');
  btn.disabled = true;
  btn.textContent = '저장 중...';
  try {
    await _insertVersionRow('버전 ' + formatKoreanDateTime(new Date()));
    await runVersionCleanup();
    renderVersionList(await loadVersionList());
  } catch (e) {
    console.error('버전 저장 실패:', e);
    alert('버전 저장 실패: ' + (e.message || '서버 오류'));
  } finally {
    btn.disabled = false;
    btn.textContent = '+ 버전 저장';
  }
}

// ─── 수동 저장 (상단 버튼) — 최근 버전 덮어쓰기 ───

let _saveToastTimer = null;

function showSaveToast(msg, type = 'saving') {
  const toast = document.getElementById('saveToast');
  if (!toast) return;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '…';
  toast.textContent = icon + ' ' + msg;
  toast.className = 'save-toast ' + type + ' show';
  if (_saveToastTimer) clearTimeout(_saveToastTimer);
  if (type !== 'saving') {
    _saveToastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
  }
}

async function manualSaveVersion() {
  const btn = document.getElementById('btnManualSave');
  if (!_supaClient) { showSaveToast('Supabase에 연결되지 않음', 'error'); return; }
  btn.disabled = true;
  btn.textContent = '저장 중…';
  showSaveToast('저장 중…', 'saving');
  try {
    await saveToSupabase();
    const snapshot = buildVersionSnapshot();
    const label = '버전 ' + formatKoreanDateTime(new Date());
    const { data: latest, error: fetchErr } = await _supaClient
      .from('expomap_versions')
      .select('id')
      .eq('exhibition_id', _supaProjectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (latest) {
      const { error } = await _supaClient
        .from('expomap_versions')
        .update({ state_json: snapshot, version_name: label, created_at: new Date().toISOString() })
        .eq('id', latest.id);
      if (error) throw error;
    } else {
      await _insertVersionRow(label);
    }
    showSaveToast('저장 완료', 'success');
  } catch (e) {
    console.error('저장 실패:', e);
    showSaveToast('저장 실패: ' + (e.message || '서버 오류'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 저장';
  }
}

// ─── 보관 정책 ───
//
// • 최근 24h   → 전부 유지 (4h 간격 자동저장 기준 최대 6개)
// • 1일 ~ 7일  → 하루에 1개 (자정 00:00에 가장 가까운 것)
// • 7일 초과   → 삭제

async function runVersionCleanup() {
  if (!_supaClient) return;
  try {
    // id + created_at만 조회 (state_json 제외, 가볍게)
    const { data, error } = await _supaClient
      .from('expomap_versions')
      .select('id, created_at')
      .eq('exhibition_id', _supaProjectId)
      .order('created_at', { ascending: false });
    if (error || !data) return;

    const now = Date.now();
    const MS_24H = 24 * 60 * 60 * 1000;
    const MS_7D  = VERSION_MAX_DAYS * MS_24H;

    const toDelete = [];

    // 1일~7일 구간: 날짜별 그룹 (로컬 날짜 기준)
    const byDay = {}; // "2026-04-10" → [{id, created_at, msFromMidnight}]

    data.forEach(v => {
      const age = now - new Date(v.created_at).getTime();
      if (age > MS_7D) {
        // 7일 초과 → 삭제
        toDelete.push(v.id);
      } else if (age > MS_24H) {
        // 1일~7일 → 날짜별 그룹화
        const d = new Date(v.created_at);
        const dayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const midnight = new Date(d); midnight.setHours(0, 0, 0, 0);
        const msFromMidnight = Math.abs(d - midnight);
        if (!byDay[dayKey]) byDay[dayKey] = [];
        byDay[dayKey].push({ id: v.id, msFromMidnight });
      }
      // < 24h → 유지 (아무것도 안 함)
    });

    // 각 날짜에서 자정에 가장 가까운 것 1개만 남기고 나머지 삭제
    Object.values(byDay).forEach(group => {
      group.sort((a, b) => a.msFromMidnight - b.msFromMidnight);
      group.slice(1).forEach(v => toDelete.push(v.id));
    });

    if (toDelete.length === 0) return;
    await _supaClient
      .from('expomap_versions')
      .delete()
      .in('id', toDelete);
  } catch (e) {
    console.error('버전 정리 실패:', e);
  }
}

// ─── 목록 조회 ───

async function loadVersionList() {
  if (!_supaClient) return [];
  try {
    const { data, error } = await _supaClient
      .from('expomap_versions')
      .select('id, version_name, created_at, state_json')
      .eq('exhibition_id', _supaProjectId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('버전 목록 조회 실패:', e);
    return [];
  }
}

// ─── 목록 렌더링 ───

function renderVersionList(versions) {
  const empty = document.getElementById('versionListEmpty');
  const list = document.getElementById('versionList');
  if (!list) return;
  list.innerHTML = '';
  if (!versions || versions.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  // 날짜별 구분선으로 그룹핑
  let lastDay = null;
  versions.forEach(v => {
    const d = new Date(v.created_at);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (dayKey !== lastDay) {
      lastDay = dayKey;
      const divider = document.createElement('div');
      divider.style.cssText = 'font-size:10px;font-weight:700;color:var(--text-dim,#8b9098);letter-spacing:0.06em;padding:6px 4px 2px;text-transform:uppercase';
      divider.textContent = dayKey;
      list.appendChild(divider);
    }

    const isAuto = v.version_name.startsWith('자동저장');
    const row = document.createElement('div');
    row.style.cssText = 'padding:7px 8px;border-radius:5px;cursor:pointer;background:var(--surface,#23262d);border:1px solid transparent;transition:background 0.15s,border-color 0.15s';
    row.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:var(--text,#e8eaf0)">${isAuto ? '🔄' : '🕑'} ${v.version_name}</div>
      <div style="font-size:10px;color:var(--text-dim,#8b9098);margin-top:2px">${relativeTime(v.created_at)}</div>
    `;
    row.addEventListener('mouseenter', () => {
      row.style.background = 'var(--surface-hover,#2c3040)';
      row.style.borderColor = 'var(--accent,#4F8CFF)';
    });
    row.addEventListener('mouseleave', () => {
      row.style.background = 'var(--surface,#23262d)';
      row.style.borderColor = 'transparent';
    });
    row.addEventListener('click', () => showVersionDiff(v, versions));
    list.appendChild(row);
  });
}

// ─── Diff 계산 ───

const DIFF_FIELDS = ['status', 'companyName', 'companyNameEn', 'boothId', 'x', 'y', 'w', 'h'];

function diffSnapshots(snapA, snapB) {
  const boothsA = snapA.booths || [];
  const boothsB = snapB.booths || [];
  const mapA = Object.fromEntries(boothsA.map(b => [b.id, b]));
  const mapB = Object.fromEntries(boothsB.map(b => [b.id, b]));

  const added = boothsB.filter(b => !mapA[b.id]);
  const removed = boothsA.filter(b => !mapB[b.id]);
  const modified = [];

  boothsB.forEach(bB => {
    const bA = mapA[bB.id];
    if (!bA) return;
    const changedFields = [];
    DIFF_FIELDS.forEach(f => {
      if (bA[f] !== bB[f]) changedFields.push({ field: f, from: bA[f], to: bB[f] });
    });
    if (changedFields.length > 0) modified.push({ id: bB.id, boothId: bB.boothId, companyName: bB.companyName, fields: changedFields });
  });

  const structsA = (snapA.structures || []).length;
  const structsB = (snapB.structures || []).length;
  const bgA = snapA.bg || {};
  const bgB = snapB.bg || {};
  const bgChanged = ['x','y','w','h','opacity','visible','rotation'].some(k => bgA[k] !== bgB[k]);

  return {
    booths: { added, removed, modified },
    structures: { added: Math.max(0, structsB - structsA), removed: Math.max(0, structsA - structsB) },
    bgChanged,
  };
}

// ─── Diff 뷰 ───

function showVersionDiff(version) {
  const snapA = version.state_json;
  const snapB = buildVersionSnapshot();
  const diff = diffSnapshots(snapA, snapB);

  document.getElementById('btnRestoreVersion').onclick = () => {
    if (confirm('현재 작업이 덮어씌워집니다. 계속하시겠습니까?')) {
      restoreVersion(snapA);
      closeModal('modalVersionDiff');
    }
  };

  renderDiffView(diff, version.version_name);
  openModal('modalVersionDiff');
}

function fieldLabel(f) {
  return { status: '상태', companyName: '업체명', companyNameEn: '업체명(영문)', boothId: '부스번호', x: 'X 위치', y: 'Y 위치', w: '폭', h: '높이' }[f] || f;
}

function statusLabel(val) {
  const m = { available: '기본', spot: '배정가능위치', hold: '홀딩', online: '온라인신청', proposing: '계약서접수', assigned: '배정완료', discuss: '논의중', fake: '가부스', excluded: '제외', facility: '시설' };
  return m[val] ?? (val == null ? '(없음)' : String(val));
}

function renderDiffView(diff, versionName) {
  const body = document.getElementById('versionDiffBody');
  document.getElementById('versionDiffTitle').textContent = `변경내역 — ${versionName}`;

  const { booths, structures, bgChanged } = diff;
  const noChange = !booths.added.length && !booths.removed.length && !booths.modified.length
    && !structures.added && !structures.removed && !bgChanged;

  if (noChange) {
    body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-dim,#8b9098)">이 버전과 현재 상태가 동일합니다.</div>';
    return;
  }

  const section = (title, content) =>
    `<div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text-dim,#8b9098);letter-spacing:0.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border,#2e3340)">${title}</div>
      ${content}
    </div>`;

  let boothHtml = '';
  if (!booths.added.length && !booths.removed.length && !booths.modified.length) {
    boothHtml = `<div style="font-size:12px;color:var(--text-dim,#8b9098)">변경 없음</div>`;
  } else {
    if (booths.added.length)
      boothHtml += `<div style="margin-bottom:6px"><span style="color:#4CAF50;font-weight:600">✚ 추가됨 (${booths.added.length})</span> <span style="font-size:11px;color:var(--text-dim,#8b9098)">${booths.added.map(b => b.boothId || '#'+b.id).join(', ')}</span></div>`;
    if (booths.removed.length)
      boothHtml += `<div style="margin-bottom:6px"><span style="color:#F44336;font-weight:600">✖ 삭제됨 (${booths.removed.length})</span> <span style="font-size:11px;color:var(--text-dim,#8b9098)">${booths.removed.map(b => b.boothId || '#'+b.id).join(', ')}</span></div>`;
    if (booths.modified.length) {
      boothHtml += `<div style="margin-bottom:4px"><span style="color:#FF9800;font-weight:600">✎ 변경됨 (${booths.modified.length})</span></div><div style="padding-left:8px">`;
      booths.modified.forEach(m => {
        const name = m.companyName ? ` <span style="color:var(--text-dim,#8b9098)">(${m.companyName})</span>` : '';
        boothHtml += `<div style="font-size:12px;margin-bottom:4px;padding:4px 8px;background:var(--surface,#23262d);border-radius:4px"><span style="font-weight:600">${m.boothId || '#'+m.id}</span>${name}`;
        m.fields.forEach(fc => {
          let from = fc.field === 'status' ? statusLabel(fc.from) : (fc.from == null ? '(없음)' : fc.from);
          let to   = fc.field === 'status' ? statusLabel(fc.to)   : (fc.to   == null ? '(없음)' : fc.to);
          if (fc.field === 'x' || fc.field === 'y' || fc.field === 'w' || fc.field === 'h') {
            from = Math.round(fc.from / 10) + 'm';
            to   = Math.round(fc.to   / 10) + 'm';
          }
          boothHtml += `<div style="font-size:11px;color:var(--text-dim,#8b9098);margin-top:2px;padding-left:8px">${fieldLabel(fc.field)}: <span style="color:#F44336">${from}</span> → <span style="color:#4CAF50">${to}</span></div>`;
        });
        boothHtml += `</div>`;
      });
      boothHtml += `</div>`;
    }
  }

  const structHtml = (structures.added || structures.removed)
    ? `${structures.added  ? `<span style="color:#4CAF50;font-weight:600;margin-right:16px">✚ 추가됨: ${structures.added}</span>`  : ''}
       ${structures.removed ? `<span style="color:#F44336;font-weight:600">✖ 삭제됨: ${structures.removed}</span>` : ''}`
    : `<span style="color:var(--text-dim,#8b9098)">변경 없음</span>`;

  const bgHtml = bgChanged
    ? `<span style="color:#FF9800">위치/크기/투명도 변경됨</span>`
    : `<span style="color:var(--text-dim,#8b9098)">변경 없음</span>`;

  body.innerHTML =
    section('부스 (Booths)', boothHtml) +
    section('구조물 (Structures)', structHtml) +
    section('배경 이미지', bgHtml);
}

// ─── 복원 ───

function restoreVersion(snapshot) {
  saveUndo();
  state.booths = (snapshot.booths || []).map(b => ({ ...b, companyNameEn: b.companyNameEn || '' }));
  state.groups = snapshot.groups || [];
  state.structures = snapshot.structures || [];
  state.companies = snapshot.companies || [];
  state.nextId = snapshot.nextId || 1;
  state.nextGroupId = snapshot.nextGroupId || 1;
  state.nextStructId = snapshot.nextStructId || 1;
  state.nextLogoId = snapshot.nextLogoId || 1;
  state.baseNumbers = snapshot.baseNumbers || [];
  state.nextBaseNoId = snapshot.nextBaseNoId || 1;
  state.discussOverlays = snapshot.discussOverlays || [];
  state.nextDiscussOverlayId = snapshot.nextDiscussOverlayId || 1;
  state.nextDiscussGroupId = snapshot.nextDiscussGroupId || 1;
  state.freeBooths = snapshot.freeBooths || [];
  state.measureLines = snapshot.measureLines || [];
  state.nextMeasureLineId = snapshot.nextMeasureLineId || 1;

  if (snapshot.bg) {
    state.bg.x = snapshot.bg.x || 0;
    state.bg.y = snapshot.bg.y || 0;
    state.bg.w = snapshot.bg.w || 0;
    state.bg.h = snapshot.bg.h || 0;
    state.bg.natW = snapshot.bg.natW || 0;
    state.bg.natH = snapshot.bg.natH || 0;
    state.bg.opacity = snapshot.bg.opacity ?? 0.5;
    state.bg.visible = snapshot.bg.visible ?? true;
    state.bg.rotation = snapshot.bg.rotation || 0;
  }

  const oldLogosMap = Object.fromEntries(state.logos.map(l => [l.id, l]));
  state.logos = (snapshot.logos || []).map(l => {
    const old = oldLogosMap[l.id];
    return old ? { ...l, dataUrl: old.dataUrl, _img: old._img } : l;
  });

  state.selectedIds.clear();
  state.selectedStructId = null;
  state.selectedLogoId = null;
  state.selectedBaseNoIds.clear();
  state.selectedDiscussIds.clear();

  render();
  updateProps();
  scheduleSave();
}
