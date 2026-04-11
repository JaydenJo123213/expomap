// ─── Version History ───

// 버전 이름용 날짜 포맷 ("2026-04-11 14:30")
function formatKoreanDateTime(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

// 상대 시간 표시 ("방금", "5분 전", "1일 전" 등)
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

// 현재 state → 버전 스냅샷 (bg.dataUrl, logos.dataUrl 제외)
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

// Supabase에 버전 저장
async function saveVersion() {
  if (!_supaClient) { alert('Supabase에 연결되지 않았습니다.'); return; }
  const btn = document.getElementById('btnSaveVersion');
  btn.disabled = true;
  btn.textContent = '저장 중...';
  try {
    const versionName = '버전 ' + formatKoreanDateTime(new Date());
    const snapshot = buildVersionSnapshot();
    const { error } = await _supaClient
      .from('expomap_versions')
      .insert({ exhibition_id: _supaProjectId, version_name: versionName, state_json: snapshot });
    if (error) throw error;
    const versions = await loadVersionList();
    renderVersionList(versions);
  } catch (e) {
    console.error('버전 저장 실패:', e);
    alert('버전 저장 실패: ' + (e.message || '서버 오류'));
  } finally {
    btn.disabled = false;
    btn.textContent = '+ 버전 저장';
  }
}

// 버전 목록 조회 (최신 30개)
async function loadVersionList() {
  if (!_supaClient) return [];
  try {
    const { data, error } = await _supaClient
      .from('expomap_versions')
      .select('id, version_name, created_at, state_json')
      .eq('exhibition_id', _supaProjectId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('버전 목록 조회 실패:', e);
    return [];
  }
}

// 버전 목록 DOM 렌더링
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
  versions.forEach((v, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'padding:7px 8px;border-radius:5px;cursor:pointer;background:var(--surface,#23262d);border:1px solid transparent;transition:background 0.15s,border-color 0.15s';
    row.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:var(--text,#e8eaf0)">🕑 ${v.version_name}</div>
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
      if (bA[f] !== bB[f]) {
        changedFields.push({ field: f, from: bA[f], to: bB[f] });
      }
    });
    if (changedFields.length > 0) {
      modified.push({ id: bB.id, boothId: bB.boothId, companyName: bB.companyName, fields: changedFields });
    }
  });

  const structsA = (snapA.structures || []).length;
  const structsB = (snapB.structures || []).length;

  // bg 비교 (dataUrl 제외, 위치/크기/opacity만)
  const bgA = snapA.bg || {};
  const bgB = snapB.bg || {};
  const bgChanged = ['x','y','w','h','opacity','visible','rotation'].some(k => bgA[k] !== bgB[k]);

  return {
    booths: { added, removed, modified },
    structures: { added: Math.max(0, structsB - structsA), removed: Math.max(0, structsA - structsB) },
    bgChanged,
  };
}

// ─── Diff 뷰 표시 ───

let _pendingRestoreSnapshot = null;

function showVersionDiff(version, allVersions) {
  // 현재 state를 snapB로, 선택한 버전을 snapA로 비교
  const snapA = version.state_json;
  const snapB = buildVersionSnapshot();
  const diff = diffSnapshots(snapA, snapB);

  _pendingRestoreSnapshot = snapA;
  document.getElementById('btnRestoreVersion').onclick = () => {
    if (confirm('현재 작업이 덮어씌워집니다. 계속하시겠습니까?')) {
      restoreVersion(snapA);
      closeModal('modalVersionDiff');
    }
  };

  renderDiffView(diff, version.version_name);
  openModal('modalVersionDiff');
}

function fieldLabel(field) {
  const map = { status: '상태', companyName: '업체명', companyNameEn: '업체명(영문)', boothId: '부스번호', x: 'X 위치', y: 'Y 위치', w: '폭', h: '높이' };
  return map[field] || field;
}

function statusLabel(val) {
  const map = { available: '기본', spot: '배정가능위치', hold: '홀딩', online: '온라인신청', proposing: '계약서접수', assigned: '배정완료', discuss: '논의중', fake: '가부스', excluded: '제외', facility: '시설' };
  return map[val] || (val == null ? '(없음)' : val);
}

function renderDiffView(diff, versionName) {
  const body = document.getElementById('versionDiffBody');
  document.getElementById('versionDiffTitle').textContent = `변경내역 — ${versionName}`;

  const { booths, structures, bgChanged } = diff;
  const noChange = booths.added.length === 0 && booths.removed.length === 0 &&
    booths.modified.length === 0 && structures.added === 0 && structures.removed === 0 && !bgChanged;

  if (noChange) {
    body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-dim,#8b9098)">이 버전과 현재 상태가 동일합니다.</div>';
    return;
  }

  let html = '';

  // ─ 부스 섹션
  html += `<div style="margin-bottom:16px">`;
  html += `<div style="font-size:12px;font-weight:700;color:var(--text-dim,#8b9098);letter-spacing:0.05em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border,#2e3340)">부스 (Booths)</div>`;

  if (booths.added.length === 0 && booths.removed.length === 0 && booths.modified.length === 0) {
    html += `<div style="font-size:12px;color:var(--text-dim,#8b9098)">변경 없음</div>`;
  } else {
    if (booths.added.length > 0) {
      html += `<div style="margin-bottom:6px"><span style="color:#4CAF50;font-weight:600">✚ 추가됨 (${booths.added.length})</span>`;
      html += `<span style="font-size:11px;color:var(--text-dim,#8b9098);margin-left:8px">${booths.added.map(b => b.boothId || `#${b.id}`).join(', ')}</span></div>`;
    }
    if (booths.removed.length > 0) {
      html += `<div style="margin-bottom:6px"><span style="color:#F44336;font-weight:600">✖ 삭제됨 (${booths.removed.length})</span>`;
      html += `<span style="font-size:11px;color:var(--text-dim,#8b9098);margin-left:8px">${booths.removed.map(b => b.boothId || `#${b.id}`).join(', ')}</span></div>`;
    }
    if (booths.modified.length > 0) {
      html += `<div style="margin-bottom:4px"><span style="color:#FF9800;font-weight:600">✎ 변경됨 (${booths.modified.length})</span></div>`;
      html += `<div style="padding-left:8px">`;
      booths.modified.forEach(m => {
        const label = m.boothId || `#${m.id}`;
        const nameStr = m.companyName ? ` <span style="color:var(--text-dim,#8b9098)">(${m.companyName})</span>` : '';
        html += `<div style="font-size:12px;margin-bottom:4px;padding:4px 8px;background:var(--surface,#23262d);border-radius:4px">`;
        html += `<span style="font-weight:600;color:var(--text,#e8eaf0)">${label}</span>${nameStr}`;
        m.fields.forEach(fc => {
          let fromStr = fc.field === 'status' ? statusLabel(fc.from) : (fc.from == null ? '(없음)' : fc.from);
          let toStr = fc.field === 'status' ? statusLabel(fc.to) : (fc.to == null ? '(없음)' : fc.to);
          if (fc.field === 'x' || fc.field === 'y') {
            fromStr = Math.round(fc.from / 10) + 'm';
            toStr = Math.round(fc.to / 10) + 'm';
          } else if (fc.field === 'w' || fc.field === 'h') {
            fromStr = Math.round(fc.from / 10) + 'm';
            toStr = Math.round(fc.to / 10) + 'm';
          }
          html += `<div style="font-size:11px;color:var(--text-dim,#8b9098);margin-top:2px;padding-left:8px">${fieldLabel(fc.field)}: <span style="color:#F44336">${fromStr}</span> → <span style="color:#4CAF50">${toStr}</span></div>`;
        });
        html += `</div>`;
      });
      html += `</div>`;
    }
  }
  html += `</div>`;

  // ─ 구조물 섹션
  html += `<div style="margin-bottom:16px">`;
  html += `<div style="font-size:12px;font-weight:700;color:var(--text-dim,#8b9098);letter-spacing:0.05em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border,#2e3340)">구조물 (Structures)</div>`;
  if (structures.added === 0 && structures.removed === 0) {
    html += `<div style="font-size:12px;color:var(--text-dim,#8b9098)">변경 없음</div>`;
  } else {
    if (structures.added > 0) html += `<span style="color:#4CAF50;font-weight:600;margin-right:16px">✚ 추가됨: ${structures.added}</span>`;
    if (structures.removed > 0) html += `<span style="color:#F44336;font-weight:600">✖ 삭제됨: ${structures.removed}</span>`;
  }
  html += `</div>`;

  // ─ 배경 이미지 섹션
  html += `<div>`;
  html += `<div style="font-size:12px;font-weight:700;color:var(--text-dim,#8b9098);letter-spacing:0.05em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border,#2e3340)">배경 이미지</div>`;
  html += `<div style="font-size:12px;color:var(--text-dim,#8b9098)">${bgChanged ? '<span style="color:#FF9800">위치/크기/투명도 변경됨</span>' : '변경 없음'}</div>`;
  html += `</div>`;

  body.innerHTML = html;
}

// ─── 버전 복원 ───

function restoreVersion(snapshot) {
  saveUndo();
  // bg dataUrl/img는 현재 것 유지, 나머지 필드만 적용
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

  // bg 위치/크기만 복원 (dataUrl/img는 현재 유지)
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

  // logos는 dataUrl이 없으므로 현재 logos에서 매칭해서 _img 유지
  // 간단히: logos 메타만 복원, _img는 기존 것 재활용
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
