// ─── Version History ───
document.getElementById('btnSaveVersion').addEventListener('click', saveVersion);

// ─── Toolbar Buttons ───
document.querySelectorAll('#modeGroup .tool-btn').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
document.querySelectorAll('#snapGroup .tool-btn').forEach(btn => btn.addEventListener('click', () => setSnap(btn.dataset.snap)));
document.getElementById('btnMerge').addEventListener('click', mergeSelected);
document.getElementById('btnDivide').addEventListener('click', openDivideDialog);
// btnGroup / btnUngroup은 사이드바에 없음 (Ctrl+G/Shift+G 단축키로만 가능)
// document.getElementById('btnGroup').addEventListener('click', groupSelected);
// document.getElementById('btnUngroup').addEventListener('click', ungroupSelected);
document.getElementById('btnNumCopy').addEventListener('click', openNumericCopyDialog);
document.getElementById('btnLBooth').addEventListener('click', openLBoothDialog);
document.getElementById('propTextPlacement').addEventListener('change', (e) => {
  const b = getSelectedBooth();
  if (b) { saveUndo(); b.textPlacement = e.target.value; render(); }
});

// 폰트 크기 슬라이더 (드래그하며 실시간 조정)
document.getElementById('propFontSize').addEventListener('input', (e) => {
  const b = getSelectedBooth();
  if (!b) return;
  b.fontSize = parseInt(e.target.value);
  document.getElementById('propFontSizeVal').textContent = b.fontSize + 'px';
  document.getElementById('propFontSizeAuto').style.display = '';
  render();
});
document.getElementById('propFontSize').addEventListener('change', () => { saveUndo(); scheduleSave(); });

// 자동 버튼: 수동 폰트 크기 초기화 (국문)
document.getElementById('propFontSizeAuto').addEventListener('click', () => {
  const b = getSelectedBooth();
  if (!b) return;
  saveUndo();
  delete b.fontSize;
  document.getElementById('propFontSizeVal').textContent = '자동';
  document.getElementById('propFontSizeAuto').style.display = 'none';
  render();
  scheduleSave();
});

// 폰트 크기 슬라이더 (영문)
document.getElementById('propFontSizeEn').addEventListener('input', (e) => {
  const b = getSelectedBooth();
  if (!b) return;
  b.fontSizeEn = parseInt(e.target.value);
  document.getElementById('propFontSizeEnVal').textContent = b.fontSizeEn + 'px';
  document.getElementById('propFontSizeEnAuto').style.display = '';
  render();
});
document.getElementById('propFontSizeEn').addEventListener('change', () => { saveUndo(); scheduleSave(); });

// 자동 버튼: 수동 폰트 크기 초기화 (영문)
document.getElementById('propFontSizeEnAuto').addEventListener('click', () => {
  const b = getSelectedBooth();
  if (!b) return;
  saveUndo();
  delete b.fontSizeEn;
  document.getElementById('propFontSizeEnVal').textContent = '자동';
  document.getElementById('propFontSizeEnAuto').style.display = 'none';
  render();
  scheduleSave();
});
document.getElementById('btnArrayCopy').addEventListener('click', () => {
  if (!state.selectedIds.size) { alert('Select booths to array-copy.'); return; }
  openModal('modalArrayCopy');
});
// Delete 버튼 (HTML에서 제거됨 - Del/Backspace 키로 동작)
const btnDelete = document.getElementById('btnDelete');
if (btnDelete) {
  btnDelete.addEventListener('click', () => {
    if (state.selectedIds.size) {
      saveUndo();
      const ids = new Set(state.selectedIds);
      state.booths = state.booths.filter(b => !ids.has(b.id));
      state.groups.forEach(g => { g.boothIds = g.boothIds.filter(id => !ids.has(id)); });
      state.groups = state.groups.filter(g => g.boothIds.length > 0);
      state.selectedIds.clear(); render(); updateProps();
    } else if (state.selectedStructId) {
      saveUndo();
      state.structures = state.structures.filter(s => s.id !== state.selectedStructId);
      state.selectedStructId = null; render();
    } else if (state.selectedLogoId) {
      saveUndo();
      state.logos = state.logos.filter(l => l.id !== state.selectedLogoId);
      state.selectedLogoId = null; render();
    }
  });
}
document.getElementById('btnAutoNumber').addEventListener('click', () => openModal('modalBoothNum'));
document.getElementById('btnBaseNoNumber').addEventListener('click', () => openModal('modalBaseNoNum'));
document.getElementById('btnImport').addEventListener('click', () => { _importStep = 1; setImportStep(1); _importRawData = null; document.getElementById('importFileInfo').textContent = ''; document.getElementById('importBtnNext').textContent = 'Next →'; openModal('modalImport'); });
document.getElementById('btnExport').addEventListener('click', () => {
  selectPreset(document.querySelector('.preset-card[data-preset="sales"]'));
  openModal('modalExport');
});
document.getElementById('btnExportSVG').addEventListener('click', () => { exportSVG('ko'); });
document.getElementById('btnExportSVG_EN').addEventListener('click', () => { exportSVG('en'); });
document.getElementById('btnAssignGuide').addEventListener('click', () => {
  state.assignGuideMode = true;
  state.selectedDiscussIds.clear();
  render();
});
document.getElementById('btnPrintFloorplan').addEventListener('click', () => {
  exportFloorplanPDF();
});
document.getElementById('btnPrintAvailable').addEventListener('click', () => {
  exportAvailablePDF();
});

// ─── 제공부스 ───
document.getElementById('btnFreeBoothCard').addEventListener('click', () => {
  renderFreeBoothTable();
  openModal('modalFreeBooth');
});
document.getElementById('btnAddFreeBooth').addEventListener('click', () => {
  state.freeBooths.push({ name: '', contract: 0, free: 0 });
  renderFreeBoothTable();
  scheduleSave();
});

function renderFreeBoothTable() {
  const tbody = document.getElementById('freeBoothBody');
  tbody.innerHTML = state.freeBooths.map((item, i) =>
    `<tr>
      <td style="padding:4px 6px;border-bottom:1px solid var(--border)">
        <input type="text" value="${item.name}" data-fb-idx="${i}" data-fb-field="name"
          style="width:100%;padding:3px 6px;font-size:12px;border:1px solid var(--border);border-radius:3px;background:var(--bg);color:var(--text);font-family:inherit">
      </td>
      <td style="padding:4px 6px;border-bottom:1px solid var(--border)">
        <input type="number" value="${item.contract}" data-fb-idx="${i}" data-fb-field="contract" min="0" step="0.5"
          style="width:100%;padding:3px 6px;font-size:12px;border:1px solid var(--border);border-radius:3px;background:var(--bg);color:var(--text);text-align:center;font-family:inherit">
      </td>
      <td style="padding:4px 6px;border-bottom:1px solid var(--border)">
        <input type="number" value="${item.free}" data-fb-idx="${i}" data-fb-field="free" min="0" step="0.5"
          style="width:100%;padding:3px 6px;font-size:12px;border:1px solid var(--border);border-radius:3px;background:var(--bg);color:var(--text);text-align:center;font-family:inherit">
      </td>
      <td style="padding:4px 6px;border-bottom:1px solid var(--border);text-align:center">
        <button onclick="state.freeBooths.splice(${i},1);renderFreeBoothTable();updateFreeBoothCount();scheduleSave()"
          style="background:none;border:none;color:#f87171;cursor:pointer;font-size:13px">✕</button>
      </td>
    </tr>`
  ).join('');

  // 이벤트 바인딩
  tbody.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.fbIdx);
      const field = e.target.dataset.fbField;
      if (field === 'name') state.freeBooths[idx].name = e.target.value;
      else state.freeBooths[idx][field] = parseFloat(e.target.value) || 0;
      updateFreeBoothCount();
      scheduleSave();
    });
  });

  updateFreeBoothCount();
}

function updateFreeBoothCount() {
  const contractTotal = state.freeBooths.reduce((sum, item) => sum + (item.contract || 0), 0);
  const freeTotal = state.freeBooths.reduce((sum, item) => sum + (item.free || 0), 0);
  document.getElementById('freeBoothContractTotal').textContent = contractTotal;
  document.getElementById('freeBoothFreeTotal').textContent = freeTotal;
  document.getElementById('countFreeBooth').textContent = freeTotal;
}

document.getElementById('btnAssignGuideTopbar').addEventListener('click', () => {
  state.assignGuideMode = true;
  state.selectedDiscussIds.clear();
  render();
});
document.getElementById('btnAssignGuideConfirm').addEventListener('click', () => {
  if (state.selectedDiscussIds.size === 0) {
    alert('배정논의 오버레이를 선택해주세요.');
    return;
  }
  state.assignGuideMode = false;
  document.getElementById('assignGuideModeHint').style.display = 'none';
  openModal('modalAssignGuide');
  document.getElementById('assignGuideInfo').textContent = `선택된 배정논의: ${state.selectedDiscussIds.size}개`;
  // 현재 언어 상태에 맞게 라디오 초기값 동기화
  const langRadio = document.querySelector(`input[name="assignLang"][value="${state.lang}"]`);
  if (langRadio) langRadio.checked = true;
});
document.getElementById('btnManualSave').addEventListener('click', () => {
  if (!_supaClient) { alert('Supabase not connected. Set up in Settings first.'); return; }
  clearTimeout(_saveTimer);
  saveToSupabase();
});
document.getElementById('btnSupaConfig').addEventListener('click', () => {
  document.getElementById('supaUrl').value = localStorage.getItem('expomap_supa_url') || '';
  document.getElementById('supaKey').value = localStorage.getItem('expomap_supa_key') || '';
  const pidInput = document.getElementById('supaProjectId');
  if (_currentExpo) {
    pidInput.value = _currentExpo.id;
    pidInput.disabled = true;
    pidInput.title = '?expo= URL 파라미터에 의해 자동 설정됨';
  } else {
    pidInput.value = localStorage.getItem('expomap_supa_project') || 'default';
    pidInput.disabled = false;
    pidInput.title = '';
  }
  openModal('modalSupaConfig');
});

// Z-order & Lock buttons
document.getElementById('btnBringFront').addEventListener('click', bringToFront);
document.getElementById('btnSendBack').addEventListener('click', sendToBack);

// Structure buttons
document.querySelectorAll('#structGroup .tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.struct;
    // 실측 버튼: 레이어가 꺼져 있으면 클릭 무시
    if (type === 'measureLine' && !state.showMeasure) return;
    if (state.structMode === type) {
      // toggle off
      state.structMode = null;
      state.wallStart = null;
      clearStructButtons();
      hideStructHint();
    } else {
      state.structMode = type;
      state.wallStart = null;
      state.bgMoveMode = false;
      document.getElementById('btnBgMove').classList.remove('active');
      container.classList.remove('bg-move');
      clearStructButtons();
      btn.classList.add('active');
      const hints = {
        column: 'Click to place a column. Escape to exit.',
        wall: 'Click to set wall start point. Escape to exit.',
        door: 'Click to place a door (2m wide). Escape to exit.',
        rect: 'Click and drag to draw rectangle. Escape to exit.',
        circle: 'Click to place a circle. Escape to exit.',
        line: 'Click two points to draw a line. Escape to exit.',
        arrow: 'Click two points to draw an arrow. Escape to exit.',
        text: 'Click to place text label. Escape to exit.',
        measureLine: '실측 선을 드래그해서 그리세요. 부스 끝 라인에 자동으로 붙습니다. Escape로 종료.',
      };
      showStructHint(hints[type] || '');
    }
    render();
  });
});

function setMode(mode) {
  state.mode = mode;
  state.structMode = null;
  state.wallStart = null;
  clearStructButtons();
  hideStructHint();
  document.querySelectorAll('#modeGroup .tool-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  container.style.cursor = mode === 'draw' ? 'crosshair' : 'default';
}
function setSnap(snap) {
  state.snap = snap;
  document.querySelectorAll('#snapGroup .tool-btn').forEach(b => b.classList.toggle('active', b.dataset.snap === snap));
  const labels = { grid: '3m', half: '0.5m', free: 'Off' };
  document.getElementById('gridInfo').textContent = `Grid: ${labels[snap]}`;
}
function fitAll() {
  if (!state.booths.length) return;
  const minX = Math.min(...state.booths.map(b => b.x));
  const minY = Math.min(...state.booths.map(b => b.y));
  const maxX = Math.max(...state.booths.map(b => b.x + b.w));
  const maxY = Math.max(...state.booths.map(b => b.y + b.h));
  const rect = container.getBoundingClientRect();
  const zx = rect.width * 0.85 / (maxX - minX);
  const zy = rect.height * 0.85 / (maxY - minY);
  state.zoom = Math.min(zx, zy, 5);
  state.panX = rect.width / 2 - ((minX + maxX) / 2) * state.zoom;
  state.panY = rect.height / 2 - ((minY + maxY) / 2) * state.zoom;
  document.getElementById('zoomDisplay').textContent = Math.round(state.zoom * 100) + '%';
  render();
}

// ─── 레이어 렌더링 ───
function renderLayers() {
  const sidebarLayersList = document.getElementById('sidebarLayersList');
  if (sidebarLayersList) {
    sidebarLayersList.innerHTML = LAYERS.map(layer => {
      const isVisible = layer.customGetter ? layer.customGetter() : state[layer.stateKey];
      const isLocked = state.layerLocked[layer.id];
      const eyeIcon = isVisible ? '👀' : '😴';  // 뜬 눈 vs 감은 눈
      const lockIcon = isLocked ? '🔒' : '🔓';  // 잠긴 자물쇠 vs 열린 자물쇠

      return `
        <div style="display:grid;grid-template-columns:1fr 40px 40px;gap:6px;padding:4px 6px;background:var(--surface-hover);border-radius:4px;align-items:center;user-select:none;cursor:pointer" onclick="selectLayerProperties('${layer.id}')">
          <span style="color:var(--text);font-size:12px">${layer.label}</span>
          <button onclick="event.stopPropagation(); toggleLayerVisibility('${layer.id}')" style="background:none;border:none;color:var(--text);cursor:pointer;font-size:16px;padding:0;text-align:center;flex-shrink:0;min-width:20px">${eyeIcon}</button>
          <button onclick="event.stopPropagation(); toggleLayerLock('${layer.id}')" style="background:none;border:none;color:var(--text);cursor:pointer;font-size:16px;padding:0;text-align:center;flex-shrink:0;min-width:20px">${lockIcon}</button>
        </div>
      `;
    }).join('');
  }

  // 실측 버튼 활성화 상태 동기화
  const measureBtn = document.querySelector('#structGroup .tool-btn[data-struct="measureLine"]');
  if (measureBtn) {
    const on = state.showMeasure;
    measureBtn.disabled = !on;
    measureBtn.style.opacity = on ? '' : '0.35';
    measureBtn.title = on ? '' : '실측 레이어를 켜야 사용할 수 있습니다';
  }
}

function selectLayerProperties(layerId) {
  // 각 레이어에 따라 해당 properties 표시
  state.selectedIds.clear();
  state.selectedBaseNoIds.clear();
  state.selectedDiscussIds.clear();
  state.selectedStructId = null;
  state.selectedLogoId = null;

  const panel = document.getElementById('panelRight');
  const bgSection = document.getElementById('bgPanelSection') || { style: {} };
  const boothSection = document.getElementById('boothPropsSection');
  const baseNoSection = document.getElementById('baseNoPropsSection');
  const discussSection = document.getElementById('discussPropsSection');
  const multiSection = document.getElementById('multiSelectSection');
  const boothTypeLegend = document.getElementById('boothTypeLegendSection');
  const elecLegend = document.getElementById('elecLegendSection');
  const otherLegend = document.getElementById('otherLegendSection');

  // 모든 섹션 숨기기
  if (bgSection && bgSection.style) bgSection.style.display = 'none';
  boothSection.style.display = 'none';
  baseNoSection.style.display = 'none';
  discussSection.style.display = 'none';
  multiSection.style.display = 'none';
  boothTypeLegend.style.display = 'none';
  elecLegend.style.display = 'none';
  otherLegend.style.display = 'none';

  switch(layerId) {
    case 'booth':
      // 첫 번째 부스 선택
      if (state.booths.length > 0) {
        state.selectedIds.add(state.booths[0].id);
      }
      break;
    case 'baseNo':
      // 첫 번째 baseNo 선택
      if (state.baseNumbers.length > 0) {
        state.selectedBaseNoIds.add(state.baseNumbers[0].id);
      }
      break;
    case 'discuss':
      // 첫 번째 discuss overlay 선택
      if (state.discussOverlays.length > 0) {
        state.selectedDiscussIds.add(state.discussOverlays[0].id);
      }
      break;
    case 'bg':
      // 배경 정보 표시
      panel.classList.add('visible');
      if (bgSection && bgSection.style) bgSection.style.display = '';
      break;
    case 'elec':
      panel.classList.add('visible');
      elecLegend.style.display = '';
      updateElecLegend();
      break;
    case 'other':
      panel.classList.add('visible');
      otherLegend.style.display = '';
      updateOtherLegend();
      break;
    case 'boothType':
      panel.classList.add('visible');
      boothTypeLegend.style.display = '';
      break;
  }

  updateProps();
  render();
}

function toggleLayerVisibility(layerId) {
  const layer = LAYERS.find(l => l.id === layerId);
  if (!layer) return;

  if (layer.customSetter) {
    layer.customSetter(!layer.customGetter());
  } else {
    state[layer.stateKey] = !state[layer.stateKey];
  }

  // 부대시설 레이어 토글 시 범례도 함께 표시
  const isNowVisible = layer.customGetter ? layer.customGetter() : state[layer.stateKey];
  if (isNowVisible) {
    const panel = document.getElementById('panelRight');
    if (layerId === 'elec') {
      panel.classList.add('visible');
      document.getElementById('elecLegendSection').style.display = '';
      updateElecLegend();
    } else if (layerId === 'other') {
      panel.classList.add('visible');
      document.getElementById('otherLegendSection').style.display = '';
      updateOtherLegend();
    }
  }

  // 실측 레이어 꺼지면 실측 버튼 비활성화 + 모드 해제
  const measureBtn = document.querySelector('#structGroup .tool-btn[data-struct="measureLine"]');
  if (measureBtn) {
    const measureVisible = state.showMeasure;
    measureBtn.disabled = !measureVisible;
    measureBtn.style.opacity = measureVisible ? '' : '0.35';
    measureBtn.title = measureVisible ? '' : '실측 레이어를 켜야 사용할 수 있습니다';
    if (!measureVisible && state.structMode === 'measureLine') {
      state.structMode = null;
      clearStructButtons();
      hideStructHint();
    }
  }

  renderLayers();
  render();
}

function toggleLayerLock(layerId) {
  state.layerLocked[layerId] = !state.layerLocked[layerId];
  renderLayers();
}

// ─── Properties Panel ───
function updateProps() {
  if (VIEWER_MODE) return;
  const panel = document.getElementById('panelRight');
  const boothSection = document.getElementById('boothPropsSection');
  const structSection = document.getElementById('panelStructProps');
  const baseNoSection = document.getElementById('baseNoPropsSection');
  const discussSection = document.getElementById('discussPropsSection');
  const measureLineSection = document.getElementById('measureLinePropsSection');
  const multiSection = document.getElementById('multiSelectSection');

  // ─── 실측선 선택 ───
  if (state.selectedMeasureLineId !== null) {
    const line = state.measureLines.find(l => l.id === state.selectedMeasureLineId);
    panel.classList.add('visible');
    multiSection.style.display = 'none';
    boothSection.style.display = 'none';
    structSection.style.display = 'none';
    baseNoSection.style.display = 'none';
    discussSection.style.display = 'none';
    measureLineSection.style.display = 'block';
    if (line) {
      const isH = Math.abs(line.y2 - line.y1) < 0.5;
      const lengthPx = Math.abs(isH ? line.x2 - line.x1 : line.y2 - line.y1);
      document.getElementById('propMeasureLineLength').textContent = pxToM(lengthPx).toFixed(1) + 'm';
    }
    return;
  }
  if (measureLineSection) measureLineSection.style.display = 'none';

  if (state.selectedDiscussIds.size === 1) {
    panel.classList.add('visible');
    multiSection.style.display = 'none';
    boothSection.style.display = 'none';
    structSection.style.display = 'none';
    baseNoSection.style.display = 'none';
    discussSection.style.display = 'block';
    const selectedId = [...state.selectedDiscussIds][0];
    const ov = state.discussOverlays.find(o => o.id === selectedId);
    if (!ov) return;
    document.getElementById('propDiscussLabel').value = ov.label || '';
    document.getElementById('propDiscussX').value = pxToM(ov.x).toFixed(1);
    document.getElementById('propDiscussY').value = pxToM(ov.y).toFixed(1);
    document.getElementById('propDiscussW').value = pxToM(ov.w).toFixed(1);
    document.getElementById('propDiscussH').value = pxToM(ov.h).toFixed(1);
    document.getElementById('propDiscussGroupId').textContent = ov.groupId !== null ? ov.groupId : '—';
  } else if (state.selectedDiscussIds.size > 1) {
    panel.classList.add('visible');
    multiSection.style.display = 'none';
    boothSection.style.display = 'none';
    baseNoSection.style.display = 'none';
    structSection.style.display = 'none';
    discussSection.style.display = 'block';
    // 다중선택 시: 그룹 연결 버튼만 표시
    document.getElementById('propDiscussLabel').style.display = 'none';
    document.getElementById('propDiscussLabel').parentElement.style.display = 'none';
    document.getElementById('propDiscussX').style.display = 'none';
    document.getElementById('propDiscussX').parentElement.style.display = 'none';
    document.getElementById('propDiscussY').style.display = 'none';
    document.getElementById('propDiscussY').parentElement.style.display = 'none';
    document.getElementById('propDiscussW').style.display = 'none';
    document.getElementById('propDiscussW').parentElement.style.display = 'none';
    document.getElementById('propDiscussH').style.display = 'none';
    document.getElementById('propDiscussH').parentElement.style.display = 'none';
    document.getElementById('propDiscussGroupId').style.display = 'none';
    document.getElementById('propDiscussGroupId').parentElement.style.display = 'none';
    document.getElementById('btnDiscussDelete').style.display = 'none';
    document.getElementById('btnDiscussConnect').textContent = state.selectedDiscussIds.size + '개 선택항목 연결 (그룹)';
    document.getElementById('btnDiscussConnect').style.display = 'block';
  } else if (state.selectedBaseNoIds.size === 1) {
    panel.classList.add('visible');
    multiSection.style.display = 'none';
    boothSection.style.display = 'none';
    structSection.style.display = 'none';
    baseNoSection.style.display = 'block';
    const selectedId = [...state.selectedBaseNoIds][0];
    const bn = state.baseNumbers.find(b => b.id === selectedId);
    if (!bn) return;
    document.getElementById('propBaseNo').value = bn.baseNo;
    document.getElementById('propBaseNoX').value = pxToM(bn.x).toFixed(1);
    document.getElementById('propBaseNoY').value = pxToM(bn.y).toFixed(1);
    document.getElementById('propBaseNoW').value = pxToM(bn.w).toFixed(1);
    document.getElementById('propBaseNoH').value = pxToM(bn.h).toFixed(1);
  } else if (state.selectedBaseNoIds.size > 1) {
    panel.classList.add('visible');
    multiSection.style.display = 'block';
    boothSection.style.display = 'none';
    baseNoSection.style.display = 'none';
    structSection.style.display = 'none';
    document.getElementById('multiSelectCount').textContent = state.selectedBaseNoIds.size + '개 BaseNo 선택';
  } else if (state.selectedStructId) {
    panel.classList.add('visible');
    multiSection.style.display = 'none';
    boothSection.style.display = 'none';
    baseNoSection.style.display = 'none';
    structSection.style.display = 'block';
    populateStructProps();
  } else if (state.selectedIds.size > 1) {
    panel.classList.add('visible');
    multiSection.style.display = 'block';
    boothSection.style.display = 'none';
    baseNoSection.style.display = 'none';
    structSection.style.display = 'none';
    document.getElementById('multiSelectCount').textContent = state.selectedIds.size + '개 선택';
  } else if (state.selectedIds.size === 1) {
    panel.classList.add('visible');
    multiSection.style.display = 'none';
    boothSection.style.display = 'block';
    document.getElementById('boothPropsEmpty').style.display = 'none';
    document.getElementById('boothPropsContent').style.display = 'block';
    baseNoSection.style.display = 'none';
    structSection.style.display = 'none';
    const b = getSelectedBooth();
    if (!b) return;
    document.getElementById('propBoothId').value = b.boothId;
    document.getElementById('propCompanyName').value = b.companyName;
    document.getElementById('propCompanyNameEn').value = b.companyNameEn || '';
    document.getElementById('propCompany').value = b.companyUid;
    document.getElementById('propX').value = pxToM(b.x).toFixed(1);
    document.getElementById('propY').value = pxToM(b.y).toFixed(1);
    document.getElementById('propW').value = pxToM(b.w).toFixed(1);
    document.getElementById('propH').value = pxToM(b.h).toFixed(1);
    document.getElementById('propArea').textContent = getBoothAreaM2(b).toFixed(1) + '㎡';
    const isIrregular = !!(b.cells && b.cells.length > 1);
    document.getElementById('rowTextPlacement').style.display = isIrregular ? '' : 'none';
    if (isIrregular) document.getElementById('propTextPlacement').value = b.textPlacement || 'auto';
    // 폰트 크기 (국문)
    const hasFontKo = b.fontSize != null;
    document.getElementById('propFontSize').value = hasFontKo ? b.fontSize : 12;
    document.getElementById('propFontSizeVal').textContent = hasFontKo ? b.fontSize + 'px' : '자동';
    document.getElementById('propFontSizeAuto').style.display = hasFontKo ? '' : 'none';
    // 폰트 크기 (영문)
    const hasFontEn = b.fontSizeEn != null;
    document.getElementById('propFontSizeEn').value = hasFontEn ? b.fontSizeEn : 12;
    document.getElementById('propFontSizeEnVal').textContent = hasFontEn ? b.fontSizeEn + 'px' : '자동';
    document.getElementById('propFontSizeEnAuto').style.display = hasFontEn ? '' : 'none';
    document.getElementById('propStatus').value = b.status;
    const colors = STATUS_COLORS[b.status] || STATUS_COLORS.available;
    document.getElementById('propFillColor').value = b.fillColor || rgbToHex(colors.fill) || '#3D4255';
    document.getElementById('propFillColor').style.opacity = b.fillColor ? '1' : '0.45';
    const group = getBoothGroup(b.id);
    document.getElementById('propGroupLabel').textContent = group ? group.label : '—';
    document.getElementById('propMemo').value = b.memo || '';
    // 부스 타입 버튼 활성화
    const btype = b.boothType || '';
    document.querySelectorAll('#boothTypeBtns button').forEach(btn => {
      const active = btn.dataset.btype === btype;
      btn.style.background = active ? 'var(--accent)' : 'var(--surface-hover)';
      btn.style.color = active ? '#fff' : 'var(--text)';
    });
    const hasCov = btype === '조립' || btype === '자체';
    document.getElementById('boothTypeCoverageSection').style.display = hasCov ? '' : 'none';
    if (hasCov) {
      const cov = b.boothTypeCoverage ?? 100;
      document.getElementById('boothTypeCoverage').value = cov;
      document.getElementById('boothTypeCoverageVal').textContent = cov + '%';
      document.getElementById('boothTypeDir').value = b.boothTypeDir || 'full';
    }
    // 전기 위치 버튼 활성화
    document.querySelectorAll('#elecSideBtns button').forEach(btn => {
      const active = (btn.dataset.side === (b.elecSide || ''));
      btn.style.background = active ? 'var(--accent)' : 'var(--surface-hover)';
      btn.style.color = active ? '#fff' : 'var(--text)';
    });
    // 기타 위치 버튼 활성화
    document.querySelectorAll('#otherSideBtns button').forEach(btn => {
      const active = (btn.dataset.side === (b.otherSide || ''));
      btn.style.background = active ? 'var(--accent)' : 'var(--surface-hover)';
      btn.style.color = active ? '#fff' : 'var(--text)';
    });
    // 로고 섹션: 4부스 이상일 때만 표시
    const area = pxToM(b.w) * pxToM(b.h);
    const logoSection = document.getElementById('propLogoSection');
    if (area >= 36) {
      logoSection.style.display = 'block';
      // 로고 미리보기 업데이트
      const preview = document.getElementById('propLogoPreview');
      if (b.companyLogoUrl) {
        const img = new Image();
        img.src = b.companyLogoUrl;
        img.onload = () => {
          preview.innerHTML = '';
          preview.style.background = 'var(--bg)';
          const container = document.createElement('div');
          container.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%';
          img.style.cssText = 'max-width:90%;max-height:90%;object-fit:contain';
          container.appendChild(img);
          preview.appendChild(container);
        };
        img.onerror = () => {
          preview.innerHTML = '<span style="color:var(--text-dim);font-size:12px">로고 로드 실패</span>';
        };
      } else {
        preview.innerHTML = '<span style="color:var(--text-dim);font-size:12px">로고 없음</span>';
        preview.style.background = 'var(--bg)';
      }
      // 로고 컨트롤 (로고가 있을 때만 표시)
      const logoControls = document.getElementById('propLogoControls');
      if (b.companyLogoUrl) {
        logoControls.style.display = 'block';
        document.getElementById('propLogoScale').value = b.logoScale ?? 100;
        document.getElementById('propLogoScaleVal').textContent = (b.logoScale ?? 100) + '%';
        document.getElementById('propLogoGap').value = b.logoGap ?? 0;
        document.getElementById('propLogoGapVal').textContent = b.logoGap ?? 0;
      } else {
        logoControls.style.display = 'none';
      }
    } else {
      logoSection.style.display = 'none';
    }
  } else {
    multiSection.style.display = 'none';
    boothSection.style.display = 'block';
    document.getElementById('boothPropsEmpty').style.display = 'block';
    document.getElementById('boothPropsContent').style.display = 'none';
    structSection.style.display = 'none';
    baseNoSection.style.display = 'none';
    discussSection.style.display = 'none';
    // Reset discuss section visibility for next use
    document.getElementById('propDiscussLabel').style.display = '';
    document.getElementById('propDiscussLabel').parentElement.style.display = '';
    document.getElementById('propDiscussX').style.display = '';
    document.getElementById('propDiscussX').parentElement.style.display = '';
    document.getElementById('propDiscussY').style.display = '';
    document.getElementById('propDiscussY').parentElement.style.display = '';
    document.getElementById('propDiscussW').style.display = '';
    document.getElementById('propDiscussW').parentElement.style.display = '';
    document.getElementById('propDiscussH').style.display = '';
    document.getElementById('propDiscussH').parentElement.style.display = '';
    document.getElementById('propDiscussGroupId').style.display = '';
    document.getElementById('propDiscussGroupId').parentElement.style.display = '';
    document.getElementById('btnDiscussDelete').style.display = '';
    document.getElementById('btnDiscussConnect').textContent = '선택항목 연결 (그룹)';
    // 전기/부스타입 범례가 켜져 있으면 패널 유지, 아니면 숨김
    if (state.showElec || state.showBoothType) {
      panel.classList.add('visible');
    } else {
      panel.classList.remove('visible');
    }
  }
}
function rgbToHex(color) {
  // color이 이미 #hex면 그대로 반환, rgba/rgb면 변환
  if (!color) return '#3D4255';
  if (color.startsWith('#')) return color.slice(0, 7);
  const m = color.match(/[\d.]+/g);
  if (!m || m.length < 3) return '#3D4255';
  return '#' + [m[0], m[1], m[2]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('');
}
document.getElementById('propBoothId').addEventListener('change', (e) => { const b = getSelectedBooth(); if (b) { saveUndo(); b.boothId = e.target.value; render(); } });
document.getElementById('propStatus').addEventListener('change', (e) => { const b = getSelectedBooth(); if (b) { saveUndo(); b.status = e.target.value; render(); updateProps(); } });
document.getElementById('propFillColor').addEventListener('input', (e) => {
  const b = getSelectedBooth(); if (!b) return;
  saveUndo(); b.fillColor = e.target.value;
  e.target.style.opacity = '1';
  scheduleSave(); render();
});
document.getElementById('btnFillColorDefault').addEventListener('click', () => {
  saveUndo();
  state.booths.forEach(b => { b.fillColor = null; });
  updateProps(); scheduleSave(); render();
});

document.getElementById('propMemo').addEventListener('change', (e) => {
  const b = getSelectedBooth(); if (!b) return;
  saveUndo(); b.memo = e.target.value; scheduleSave(); render();
});

// ─── Logo Upload ───
document.getElementById('propLogoUploadBtn').addEventListener('click', () => {
  document.getElementById('propLogoUploadInput').click();
});

document.getElementById('propLogoUploadInput').addEventListener('change', async (e) => {
  const b = getSelectedBooth(); if (!b) return;
  const file = e.target.files[0];
  if (!file) return;

  const dataUrl = await uploadCompanyLogo(file);
  if (dataUrl) {
    saveUndo();
    b.companyLogoUrl = dataUrl;
    state.logoCache.delete(b.id);
    // company 객체에도 저장
    const company = state.companies.find(c => c.company_uid === b.companyUid);
    if (company) {
      company.logo_url = dataUrl;
    }
    scheduleSave();
    render();
    updateProps();
  }
  e.target.value = '';
});

document.getElementById('propLogoDeleteBtn').addEventListener('click', () => {
  const b = getSelectedBooth(); if (!b) return;
  if (!confirm('로고를 삭제하시겠습니까?')) return;

  saveUndo();
  const company = state.companies.find(c => c.company_uid === b.companyUid);
  if (company) {
    company.logo_url = null;
  }
  state.logoCache.delete(b.id);
  b.companyLogoUrl = null;
  scheduleSave();
  render(); updateProps();
});

document.getElementById('propLogoScale').addEventListener('input', (e) => {
  const b = getSelectedBooth(); if (!b) return;
  b.logoScale = parseInt(e.target.value);
  document.getElementById('propLogoScaleVal').textContent = b.logoScale + '%';
  state.logoCache.delete(b.companyUid || b.id);
  render();
});
document.getElementById('propLogoScale').addEventListener('change', () => { saveUndo(); scheduleSave(); });

document.getElementById('propLogoGap').addEventListener('input', (e) => {
  const b = getSelectedBooth(); if (!b) return;
  b.logoGap = parseInt(e.target.value);
  document.getElementById('propLogoGapVal').textContent = b.logoGap;
  render();
});
document.getElementById('propLogoGap').addEventListener('change', () => { saveUndo(); scheduleSave(); });

// ─── BaseNo Props ───
['propBaseNo', 'propBaseNoX', 'propBaseNoY', 'propBaseNoW', 'propBaseNoH'].forEach(id => {
  document.getElementById(id).addEventListener('change', (e) => {
    if (state.selectedBaseNoIds.size !== 1) return;
    const selectedId = [...state.selectedBaseNoIds][0];
    const bn = state.baseNumbers.find(b => b.id === selectedId);
    if (!bn) return;
    saveUndo();
    if (id === 'propBaseNo') bn.baseNo = e.target.value;
    else if (id === 'propBaseNoX') bn.x = mToPx(parseFloat(e.target.value));
    else if (id === 'propBaseNoY') bn.y = mToPx(parseFloat(e.target.value));
    else if (id === 'propBaseNoW') bn.w = mToPx(parseFloat(e.target.value));
    else if (id === 'propBaseNoH') bn.h = mToPx(parseFloat(e.target.value));
    scheduleSave(); render();
  });
});
document.getElementById('btnDeleteBaseNoProp').addEventListener('click', () => {
  if (state.selectedBaseNoIds.size) {
    saveUndo();
    const ids = new Set(state.selectedBaseNoIds);
    state.baseNumbers = state.baseNumbers.filter(bn => !ids.has(bn.id));
    state.selectedBaseNoIds.clear();
    scheduleSave(); render(); updateProps();
  }
});

// 배정논의 오버레이 속성
document.getElementById('propDiscussLabel').addEventListener('input', (e) => {
  if (state.selectedDiscussIds.size !== 1) return;
  const id = [...state.selectedDiscussIds][0];
  const ov = state.discussOverlays.find(o => o.id === id);
  if (ov) {
    ov.label = e.target.value;
    scheduleSave(); render();
  }
});

['propDiscussX', 'propDiscussY', 'propDiscussW', 'propDiscussH'].forEach(propId => {
  document.getElementById(propId).addEventListener('input', (e) => {
    if (state.selectedDiscussIds.size !== 1) return;
    const id = [...state.selectedDiscussIds][0];
    const ov = state.discussOverlays.find(o => o.id === id);
    if (!ov) return;
    const newVal = mToPx(parseFloat(e.target.value) || 0);
    const prop = propId.replace('propDiscuss', '').toLowerCase();
    if (prop === 'x') ov.x = newVal;
    else if (prop === 'y') ov.y = newVal;
    else if (prop === 'w') ov.w = newVal;
    else if (prop === 'h') ov.h = newVal;
    scheduleSave(); render();
  });
});

document.getElementById('btnDeleteMeasureLine').addEventListener('click', () => {
  if (state.selectedMeasureLineId === null) return;
  saveUndo();
  state.measureLines = state.measureLines.filter(l => l.id !== state.selectedMeasureLineId);
  state.selectedMeasureLineId = null;
  scheduleSave(); render(); updateProps();
});

document.getElementById('btnDiscussConnect').addEventListener('click', () => {
  if (state.selectedDiscussIds.size < 2) return;
  saveUndo();
  const grpId = state.nextDiscussGroupId++;
  state.discussOverlays.forEach(ov => {
    if (state.selectedDiscussIds.has(ov.id)) ov.groupId = grpId;
  });
  scheduleSave(); render(); updateProps();
});

document.getElementById('btnDiscussDelete').addEventListener('click', () => {
  if (state.selectedDiscussIds.size) {
    saveUndo();
    const ids = new Set(state.selectedDiscussIds);
    state.discussOverlays = state.discussOverlays.filter(ov => !ids.has(ov.id));
    state.selectedDiscussIds.clear();
    scheduleSave(); render(); updateProps();
  }
});

// 부스 타입 버튼
document.getElementById('boothTypeBtns').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const b = getSelectedBooth(); if (!b) return;
  saveUndo();
  b.boothType = btn.dataset.btype;
  // 회사 DB도 동기화
  const comp = state.companies.find(c => c.company_uid === b.companyUid);
  if (comp) comp.booth_type = b.boothType;
  scheduleSave(); updateProps(); render();
});
document.getElementById('boothTypeCoverage').addEventListener('input', (e) => {
  const b = getSelectedBooth(); if (!b) return;
  b.boothTypeCoverage = parseInt(e.target.value);
  document.getElementById('boothTypeCoverageVal').textContent = e.target.value + '%';
  scheduleSave(); render();
});
document.getElementById('boothTypeDir').addEventListener('change', (e) => {
  const b = getSelectedBooth(); if (!b) return;
  saveUndo(); b.boothTypeDir = e.target.value;
  scheduleSave(); render();
});

document.getElementById('elecSideBtns').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const b = getSelectedBooth(); if (!b) return;
  saveUndo();
  b.elecSide = btn.dataset.side;
  scheduleSave();
  updateProps();
  render();
});

document.getElementById('otherSideBtns').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const b = getSelectedBooth(); if (!b) return;
  saveUndo();
  b.otherSide = btn.dataset.side;
  scheduleSave();
  updateProps();
  render();
});

// ─── 멀티셀렉 일괄 적용 ───
document.getElementById('btnMultiApply').addEventListener('click', () => {
  const ids = state.selectedIds;
  if (!ids.size) return;
  const newStatus = document.getElementById('multiPropStatus').value;
  const changeFill = document.getElementById('multiChangeFill').checked;
  const newColor = document.getElementById('multiPropFillColor').value;
  saveUndo();
  state.booths.forEach(b => {
    if (!ids.has(b.id)) return;
    if (newStatus) b.status = newStatus;
    if (changeFill) b.fillColor = newColor;
  });
  scheduleSave(); render(); updateProps();
});
document.getElementById('btnMultiFillDefault').addEventListener('click', () => {
  const ids = state.selectedIds;
  if (!ids.size) return;
  saveUndo();
  state.booths.forEach(b => { if (ids.has(b.id)) b.fillColor = null; });
  scheduleSave(); render();
});
document.getElementById('propCompany').addEventListener('change', (e) => {
  const b = getSelectedBooth();
  if (b) {
    saveUndo();
    b.companyUid = e.target.value;
    // 선택된 회사의 logo_url을 가져와서 세팅
    const company = state.companies.find(c => c.company_uid === e.target.value);
    if (company && company.logo_url) {
      b.companyLogoUrl = company.logo_url;
    } else {
      b.companyLogoUrl = '';
    }
    render();
  }
});
document.getElementById('propCompanyName').addEventListener('change', (e) => {
  const b = getSelectedBooth();
  if (b) {
    saveUndo();
    b.companyName = e.target.value;
    // 같은 회사명을 가진 company 객체에서 logo_url을 가져와서 세팅
    if (b.companyUid) {
      const company = state.companies.find(c => c.company_uid === b.companyUid);
      if (company && company.logo_url) {
        b.companyLogoUrl = company.logo_url;
      }
    }
    render();
  }
});
document.getElementById('propCompanyNameEn').addEventListener('change', (e) => {
  const b = getSelectedBooth();
  if (b) { saveUndo(); b.companyNameEn = e.target.value; render(); }
});
document.getElementById('propX').addEventListener('change', (e) => { const b = getSelectedBooth(); if (b) { saveUndo(); b.x = mToPx(parseFloat(e.target.value) || 0); render(); } });
document.getElementById('propY').addEventListener('change', (e) => { const b = getSelectedBooth(); if (b) { saveUndo(); b.y = mToPx(parseFloat(e.target.value) || 0); render(); } });
document.getElementById('propW').addEventListener('change', (e) => { const b = getSelectedBooth(); if (b) { saveUndo(); b.w = mToPx(Math.max(0.5, parseFloat(e.target.value) || 3)); render(); updateProps(); } });
document.getElementById('propH').addEventListener('change', (e) => { const b = getSelectedBooth(); if (b) { saveUndo(); b.h = mToPx(Math.max(0.5, parseFloat(e.target.value) || 3)); render(); updateProps(); } });

// ─── BG Fine-Tune ───
function updateBgFineTuneInputs() {
  if (!state.bg.img) return;
  document.getElementById('bgFtX').value = Math.round(state.bg.x);
  document.getElementById('bgFtY').value = Math.round(state.bg.y);
  document.getElementById('bgFtW').value = Math.round(state.bg.w);
  document.getElementById('bgFtH').value = Math.round(state.bg.h);
  document.getElementById('bgFtRot').value = (state.bg.rotation || 0).toFixed(1);
}

['bgFtX','bgFtY','bgFtW','bgFtH'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    state.bg.x = parseFloat(document.getElementById('bgFtX').value) || 0;
    state.bg.y = parseFloat(document.getElementById('bgFtY').value) || 0;
    state.bg.w = parseFloat(document.getElementById('bgFtW').value) || state.bg.natW;
    state.bg.h = parseFloat(document.getElementById('bgFtH').value) || state.bg.natH;
    scheduleSave(); render();
  });
});
document.getElementById('bgFtRot').addEventListener('input', () => {
  state.bg.rotation = parseFloat(document.getElementById('bgFtRot').value) || 0;
  scheduleSave(); render();
});

// ─── Struct Properties ───
function populateStructProps() {
  const s = state.structures.find(s => s.id === state.selectedStructId);
  if (!s) return;

  const typeLabels = { rect: 'Rect', circle: 'Circle', column: 'Column', wall: 'Wall', line: 'Line', arrow: 'Arrow', door: 'Door', text: 'Text' };
  document.getElementById('structPropTitle').textContent = typeLabels[s.type] || 'Object';

  const isXY = ['rect','door','circle','column','text'].includes(s.type);
  const isWH = ['rect','door'].includes(s.type);
  const isColumnSquare = s.type === 'column' && s.columnShape === 'square';
  const isR = (s.type === 'circle') || (s.type === 'column' && !isColumnSquare);
  const isLine = ['wall','line','arrow'].includes(s.type);
  const isText = s.type === 'text' || s.type === 'rect';
  const hasFill = ['rect','circle','column','door'].includes(s.type);
  const hasThick = ['wall','line','arrow'].includes(s.type);
  const isColumn = s.type === 'column';

  document.getElementById('sRowXY').style.display = isXY ? '' : 'none';
  document.getElementById('sRowWH').style.display = isWH ? '' : 'none';
  document.getElementById('sRowColumnShape').style.display = isColumn ? '' : 'none';
  document.getElementById('sRowR').style.display = isR ? '' : 'none';
  document.getElementById('sRowColumnWH').style.display = isColumnSquare ? '' : 'none';
  document.getElementById('sRowLine').style.display = isLine ? '' : 'none';
  document.getElementById('sRowText').style.display = isText ? '' : 'none';
  document.getElementById('sRowFill').style.display = hasFill ? '' : 'none';
  document.getElementById('sRowThick').style.display = hasThick ? '' : 'none';

  // Column 형태 버튼 active 상태
  if (isColumn) {
    document.getElementById('btnColumnCircle').classList.toggle('active', !isColumnSquare);
    document.getElementById('btnColumnSquare').classList.toggle('active', isColumnSquare);
  }

  if (isXY) {
    document.getElementById('sPropX').value = pxToM(s.x).toFixed(1);
    document.getElementById('sPropY').value = pxToM(s.y).toFixed(1);
  }
  if (isWH) {
    document.getElementById('sPropW').value = pxToM(s.w).toFixed(1);
    document.getElementById('sPropH').value = pxToM(s.h).toFixed(1);
  }
  if (isR) {
    document.getElementById('sPropR').value = pxToM(s.radius).toFixed(1);
  }
  if (isColumnSquare) {
    document.getElementById('sPropColW').value = pxToM(s.w || s.radius * 2).toFixed(1);
    document.getElementById('sPropColH').value = pxToM(s.h || s.radius * 2).toFixed(1);
  }
  if (isLine) {
    document.getElementById('sPropX1').value = pxToM(s.x1).toFixed(1);
    document.getElementById('sPropY1').value = pxToM(s.y1).toFixed(1);
    document.getElementById('sPropX2').value = pxToM(s.x2).toFixed(1);
    document.getElementById('sPropY2').value = pxToM(s.y2).toFixed(1);
  }
  if (isText) {
    document.getElementById('sPropText').value = s.text || '';
    document.getElementById('sPropFontSize').value = s.fontSize || 12;
    document.getElementById('sPropBold').checked = (s.fontWeight === 700 || s.fontWeight === '700' || s.fontWeight === 'bold');
  }
  document.getElementById('sPropThick').value = s.thickness || 2;
  if (hasFill) {
    const fillHex = parseColorToHex(s.fillColor || '#888888');
    document.getElementById('sPropFill').value = fillHex;
    document.getElementById('sPropFillOpacity').value = parseColorAlpha(s.fillColor || 'rgba(100,100,100,0.3)').toFixed(2);
  }
  document.getElementById('sPropStroke').value = parseColorToHex(s.color || '#888888');
}

function parseColorToHex(color) {
  if (!color) return '#888888';
  if (color.startsWith('#')) return color.length === 7 ? color : color;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
  return '#888888';
}
function parseColorAlpha(color) {
  if (!color) return 1;
  if (color.startsWith('rgba')) {
    const m = color.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([0-9.]+)\)/);
    return m ? parseFloat(m[1]) : 1;
  }
  return 1;
}

function applyStructProp(fn) {
  const s = state.structures.find(s => s.id === state.selectedStructId);
  if (!s || s.locked) return;
  saveUndo();
  fn(s);
  render();
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : hex;
}

document.getElementById('sPropX').addEventListener('change', e => applyStructProp(s => s.x = mToPx(parseFloat(e.target.value)||0)));
document.getElementById('sPropY').addEventListener('change', e => applyStructProp(s => s.y = mToPx(parseFloat(e.target.value)||0)));
document.getElementById('sPropW').addEventListener('change', e => applyStructProp(s => s.w = mToPx(parseFloat(e.target.value)||1)));
document.getElementById('sPropH').addEventListener('change', e => applyStructProp(s => s.h = mToPx(parseFloat(e.target.value)||1)));
document.getElementById('sPropR').addEventListener('change', e => applyStructProp(s => s.radius = mToPx(parseFloat(e.target.value)||1)));
document.getElementById('sPropColW').addEventListener('change', e => applyStructProp(s => { s.w = mToPx(parseFloat(e.target.value)||0.5); scheduleSave(); }));
document.getElementById('sPropColH').addEventListener('change', e => applyStructProp(s => { s.h = mToPx(parseFloat(e.target.value)||0.5); scheduleSave(); }));

document.getElementById('btnColumnCircle').addEventListener('click', () => {
  const s = state.structures.find(s => s.id === state.selectedStructId);
  if (!s || s.type !== 'column' || s.columnShape !== 'square') return;
  saveUndo();
  s.columnShape = 'circle';
  s.radius = Math.max(s.w || 10, s.h || 10) / 2;
  delete s.w; delete s.h;
  scheduleSave(); render(); updateProps();
});
document.getElementById('btnColumnSquare').addEventListener('click', () => {
  const s = state.structures.find(s => s.id === state.selectedStructId);
  if (!s || s.type !== 'column' || s.columnShape === 'square') return;
  saveUndo();
  const side = (s.radius || 5) * 2;
  s.columnShape = 'square';
  s.w = side; s.h = side;
  scheduleSave(); render(); updateProps();
});
document.getElementById('sPropX1').addEventListener('change', e => applyStructProp(s => s.x1 = mToPx(parseFloat(e.target.value)||0)));
document.getElementById('sPropY1').addEventListener('change', e => applyStructProp(s => s.y1 = mToPx(parseFloat(e.target.value)||0)));
document.getElementById('sPropX2').addEventListener('change', e => applyStructProp(s => s.x2 = mToPx(parseFloat(e.target.value)||0)));
document.getElementById('sPropY2').addEventListener('change', e => applyStructProp(s => s.y2 = mToPx(parseFloat(e.target.value)||0)));
document.getElementById('sPropText').addEventListener('change', e => applyStructProp(s => s.text = e.target.value));
document.getElementById('sPropFontSize').addEventListener('change', e => applyStructProp(s => s.fontSize = parseInt(e.target.value)||12));
document.getElementById('sPropBold').addEventListener('change', e => applyStructProp(s => s.fontWeight = e.target.checked ? 700 : 400));
document.getElementById('sPropThick').addEventListener('change', e => applyStructProp(s => s.thickness = parseFloat(e.target.value)||2));
document.getElementById('sPropFill').addEventListener('input', e => {
  const alpha = parseFloat(document.getElementById('sPropFillOpacity').value) || 1;
  applyStructProp(s => s.fillColor = hexToRgba(e.target.value, alpha));
});
document.getElementById('sPropFillOpacity').addEventListener('change', e => {
  const hex = document.getElementById('sPropFill').value;
  const alpha = parseFloat(e.target.value) || 1;
  applyStructProp(s => s.fillColor = hexToRgba(hex, alpha));
});
document.getElementById('sPropStroke').addEventListener('input', e => applyStructProp(s => s.color = e.target.value));

// ─── Stats ───
function updateStats() {
  // 줌 % 업데이트
  const zoomPercent = Math.round(state.zoom * 100);
  const zoomEl = document.getElementById('zoomPercent');
  if (zoomEl) zoomEl.textContent = zoomPercent + '%';

  const counts = { available: 0, discuss: 0, spot: 0, hold: 0, proposing: 0, assigned: 0, online: 0, fake: 0, excluded: 0, facility: 0 };
  let totalArea = 0;
  for (const b of state.booths) {
    const area = getBoothAreaM2(b);  // 비정형 부스는 cells 실면적 사용
    const units = Math.round(area / 9) || 1;
    counts[b.status] = (counts[b.status] || 0) + units;
    if (b.status !== 'excluded' && b.status !== 'facility') totalArea += area;
  }
  document.getElementById('countAvailable').textContent = counts.available;
  document.getElementById('countDiscuss').textContent = counts.discuss;
  document.getElementById('countSpot').textContent = counts.spot;
  document.getElementById('countHold').textContent = counts.hold;
  document.getElementById('countProposing').textContent = counts.proposing;
  document.getElementById('countAssigned').textContent = counts.assigned;
  document.getElementById('countOnline').textContent = counts.online;
  document.getElementById('countFake').textContent = counts.fake;
  document.getElementById('countExcluded').textContent = counts.excluded;
  document.getElementById('countFacility').textContent = counts.facility;

  // 상단 툴바 카드 업데이트
  // 1. 전체: available + spot + hold + online + proposing + assigned + fake
  const countTotal = counts.available + counts.spot + counts.hold + counts.online + counts.proposing + counts.assigned + counts.fake;
  // 2. 배정: hold + online + proposing + assigned
  const countAssigning = counts.hold + counts.online + counts.proposing + counts.assigned;
  // 3. 계약: proposing + assigned
  const countContract = counts.proposing + counts.assigned;
  // 4. 미배정: spot + fake
  const countUnassigned = counts.spot + counts.fake;

  document.getElementById('countTotal').textContent = countTotal;
  document.getElementById('countAssigning').textContent = countAssigning;
  document.getElementById('countContract').textContent = countContract;
  document.getElementById('countUnassigned').textContent = countUnassigned;

  // 제공부스 카운트
  const freeTotal = state.freeBooths.reduce((sum, item) => sum + (item.free || 0), 0);
  document.getElementById('countFreeBooth').textContent = freeTotal;
}
function updateRepeatBadge() {
  document.getElementById('repeatBadge').style.display = state.lastCopyOp ? 'inline' : 'none';
}

// ─── Floorplan PDF Export ───

function getBoothFillColor(booth) {
  const statusColors = {
    'available': STATUS_COLORS.available.fill,
    'spot': '#FF9800',
    'hold': '#F06292',
    'online': '#29B6F6',
    'proposing': '#3DAF6E',
    'discuss': '#FFD600',
    'assigned': '#E0E0E0',
    'fake': '#F44336',
    'excluded': '#444444',
    'facility': '#F5F5F5'
  };
  return statusColors[booth.status] || '#FFFFFF';
}

// ─── Status Selection ───
function selectByStatus(status) {
  state.selectedIds.clear();
  const selected = [];
  for (const booth of state.booths) {
    if (booth.status === status) {
      state.selectedIds.add(booth.id);
      selected.push({
        id: booth.id,
        x: pxToM(booth.x).toFixed(1),
        y: pxToM(booth.y).toFixed(1),
        w: pxToM(booth.w).toFixed(1),
        h: pxToM(booth.h).toFixed(1),
        company: booth.companyUid || '—'
      });
    }
  }
  render();
  updateProps();

  // 선택된 부스 좌표 표시
  if (selected.length > 0) {
    showBoothCoordinates(status, selected);
  }
}

function showBoothCoordinates(status, booths) {
  const statusLabel = {
    'available': '기본',
    'spot': '배정가능위치',
    'hold': '홀딩',
    'online': '온라인신청',
    'proposing': '계약서접수',
    'discuss': '배정논의',
    'assigned': '배정완료',
    'fake': '가짜배정',
    'excluded': '배정제외',
    'facility': '기타부대설비'
  }[status] || status;

  let html = `<table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead>
      <tr style="background:var(--bg);border-bottom:1px solid var(--border)">
        <th style="padding:6px;text-align:left;color:var(--text-dim)">부스ID</th>
        <th style="padding:6px;text-align:right;color:var(--text-dim)">X (m)</th>
        <th style="padding:6px;text-align:right;color:var(--text-dim)">Y (m)</th>
        <th style="padding:6px;text-align:right;color:var(--text-dim)">W (m)</th>
        <th style="padding:6px;text-align:right;color:var(--text-dim)">H (m)</th>
      </tr>
    </thead>
    <tbody>`;

  for (const b of booths) {
    html += `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px">${b.id}</td>
      <td style="padding:6px;text-align:right">${b.x}</td>
      <td style="padding:6px;text-align:right">${b.y}</td>
      <td style="padding:6px;text-align:right">${b.w}</td>
      <td style="padding:6px;text-align:right">${b.h}</td>
    </tr>`;
  }

  html += `</tbody></table>`;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:3000';

  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;min-width:500px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.6)">
      <div style="padding:16px 20px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:15px;font-weight:600">${statusLabel} - ${booths.length}개 부스</span>
        <button onclick="this.closest('.modal-overlay').remove()" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer;padding:0 4px">×</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:16px 20px">
        ${html}
      </div>
      <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end">
        <button onclick="this.closest('.modal-overlay').remove()" style="padding:7px 16px;background:var(--accent);color:#fff;border:none;border-radius:5px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit">닫기</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// ─── Modal Helpers ───
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
});

function updateLockButton() {
  const btn = document.getElementById('btnLockCanvas');
  if (state.locked) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
}

// ─── Viewer BG Toggle ───
// ─── 부스 타입 표시 토글 ───
function toggleBoothTypeDisplay() {
  state.showBoothType = !state.showBoothType;
  const btn = document.getElementById('btnBoothTypeToggle');
  if (btn) btn.classList.toggle('active', state.showBoothType);
  // viewer-bar 버튼 동기화
  const vBtn = document.getElementById('btnViewerBoothTypeToggle');
  if (vBtn) vBtn.style.opacity = state.showBoothType ? '1' : '0.4';
  const section = document.getElementById('boothTypeLegendSection');
  const panel = document.getElementById('panelRight');
  if (section) section.style.display = state.showBoothType ? '' : 'none';
  if (panel) {
    if (state.showBoothType) {
      panel.classList.add('visible');
    } else if (!state.showElec && !state.selectedIds.size && !state.selectedStructId) {
      panel.classList.remove('visible');
    }
  }
  render();
}

function openBoothTypeDb() {
  renderBoothTypeDbTable();
  openModal('modalBoothTypeDB');
}

function renderBoothTypeDbTable(filter = '') {
  const tbody = document.getElementById('boothTypeDbBody');
  // 배정된 부스만 표시 (boothType 있거나 companyUid 있는 것)
  const booths = state.booths.filter(b => b.companyUid || b.boothType);
  const filtered = filter
    ? booths.filter(b => (b.companyUid||'').includes(filter) || (b.companyName||'').includes(filter) || (b.companyNameEn||'').includes(filter))
    : booths;

  const TYPE_COLORS_MAP = { '조립': '#FFEE58', '자체': '#FFA726', '독립': 'transparent' };
  tbody.innerHTML = filtered.map(b => {
    const typeOpts = ['', '조립', '독립', '자체'].map(t =>
      `<option value="${t}" ${(b.boothType||'') === t ? 'selected' : ''}>${t || '—'}</option>`
    ).join('');
    const dirOpts = ['full','left','right','top','bottom'].map(d =>
      `<option value="${d}" ${(b.boothTypeDir||'full') === d ? 'selected' : ''}>${{full:'전체',left:'좌',right:'우',top:'상',bottom:'하'}[d]}</option>`
    ).join('');
    const bg = TYPE_COLORS_MAP[b.boothType] || 'transparent';
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:5px 10px;font-size:11px;color:var(--text-dim)">${b.companyUid||'—'}</td>
      <td style="padding:5px 10px">${b.companyName||'—'}</td>
      <td style="padding:5px 10px;color:var(--text-dim)">${b.boothId||'—'}</td>
      <td style="padding:5px 10px;text-align:center">
        <select data-bid="${b.id}" data-key="boothType" style="background:${bg};border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:11px;padding:2px 4px;font-family:inherit;cursor:pointer">
          ${typeOpts}
        </select>
      </td>
      <td style="padding:5px 10px;text-align:center">
        <input type="number" data-bid="${b.id}" data-key="boothTypeCoverage" value="${b.boothTypeCoverage??100}" min="10" max="100"
          style="width:52px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:11px;padding:2px 4px;text-align:center;font-family:inherit">
      </td>
      <td style="padding:5px 10px;text-align:center">
        <select data-bid="${b.id}" data-key="boothTypeDir" style="background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:11px;padding:2px 4px;font-family:inherit;cursor:pointer">
          ${dirOpts}
        </select>
      </td>
    </tr>`;
  }).join('');

  // 이벤트 등록
  tbody.querySelectorAll('select[data-bid], input[data-bid]').forEach(el => {
    el.addEventListener('change', handleBoothTypeDbEdit);
  });
}

function handleBoothTypeDbEdit(e) {
  const bid = parseInt(e.target.dataset.bid);
  const key = e.target.dataset.key;
  const b = state.booths.find(x => x.id === bid);
  if (!b) return;
  saveUndo();
  b[key] = key === 'boothTypeCoverage' ? (parseInt(e.target.value) || 100) : e.target.value;
  // 회사 DB도 동기화
  const comp = state.companies.find(c => c.company_uid === b.companyUid);
  if (comp && key === 'boothType') comp.booth_type = b.boothType;
  // 선택 색상 업데이트
  if (key === 'boothType') {
    const TYPE_COLORS_MAP = { '조립': '#FFEE58', '자체': '#FFA726', '독립': 'transparent' };
    e.target.style.background = TYPE_COLORS_MAP[e.target.value] || 'transparent';
  }
  scheduleSave(); render(); updateProps();
}

// ─── 전기 표시 토글 ───
function toggleOtherDisplay() {
  state.showOther = !state.showOther;
  const btn = document.getElementById('btnOtherToggle');
  if (btn) btn.classList.toggle('active', state.showOther);
  updateOtherLegend();
  render();
}

function updateOtherLegend() {
  const section = document.getElementById('otherLegendSection');
  const panel = document.getElementById('panelRight');
  if (!section || !panel) return;
  section.style.display = state.showOther ? '' : 'none';
  if (state.showOther) {
    panel.classList.add('visible');
    const list = document.getElementById('otherLegendList');
    const labels = { other_tela:'국내전화', other_telb:'국제전화', other_net:'인터넷', other_giga:'기가인터넷', other_wifi:'공유기', other_water:'수도', other_air:'압축공기' };
    list.innerHTML = OTHER_TYPES.map(t =>
      `<div style="display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${t.color};border:1.5px solid ${t.border};flex-shrink:0;line-height:14px;text-align:center;font-size:8px;font-weight:700;color:${t.textColor}">${t.label}</span>
        <span style="color:var(--text)">${labels[t.key]||t.key}</span>
      </div>`
    ).join('');
  } else if (!state.selectedIds.size && !state.selectedStructId && !state.showElec) {
    panel.classList.remove('visible');
  }
}

function toggleElecDisplay() {
  state.showElec = !state.showElec;
  const btn = document.getElementById('btnElecToggle');
  if (btn) btn.classList.toggle('active', state.showElec);
  // viewer-bar 버튼 동기화
  const vBtn = document.getElementById('btnViewerElecToggle');
  if (vBtn) vBtn.style.opacity = state.showElec ? '1' : '0.4';
  updateElecLegend();
  render();
}

function updateElecLegend() {
  const section = document.getElementById('elecLegendSection');
  const panel = document.getElementById('panelRight');
  if (!section || !panel) return;
  section.style.display = state.showElec ? '' : 'none';
  if (state.showElec) {
    panel.classList.add('visible');
    const list = document.getElementById('elecLegendList');
    list.innerHTML = ELEC_TYPES.map(t =>
      `<div style="display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${t.color};border:1.5px solid ${t.border};flex-shrink:0"></span>
        <span style="color:var(--text)">${t.label}</span>
      </div>`
    ).join('');
  } else {
    // 선택된 것이 없으면 패널 닫기
    if (!state.selectedIds.size && !state.selectedStructId) {
      panel.classList.remove('visible');
    }
  }
}

// ─── Company DB ───
function openCompanyDb() {
  renderCompanyDbTable();
  openModal('modalCompanyDB');
}

// ─── Other DB ───
function openOtherDb() {
  renderOtherDbTable();
  openModal('modalOtherDB');
}

function renderOtherDbTable(filter) {
  const tbody = document.getElementById('otherDbBody');
  const filterStr = filter !== undefined ? filter : (document.getElementById('otherDbSearch')?.value || '');
  const list = filterStr
    ? state.companies.filter(c =>
        (c.company_uid||'').toLowerCase().includes(filterStr.toLowerCase()) ||
        (c.company_name||'').toLowerCase().includes(filterStr.toLowerCase()))
    : state.companies;

  const cellStyle = 'padding:6px 10px;border-bottom:1px solid var(--border);outline:none;';
  const inputStyle = 'background:transparent;border:none;outline:none;width:100%;font-size:12px;color:var(--text);font-family:inherit;';

  tbody.innerHTML = list.map(comp => {
    const booth = getBoothByUid(comp.company_uid);
    const otherCols = OTHER_TYPES.map(t =>
      `<td style="${cellStyle}text-align:center">
        <input type="number" min="0" value="${comp[t.key]||0}"
          data-uid="${comp.company_uid||''}" data-key="${t.key}"
          style="${inputStyle}text-align:center;width:50px"
          class="odb-input">
       </td>`
    ).join('');
    return `<tr>
      <td style="${cellStyle}"><input class="odb-input" data-uid="${comp.company_uid||''}" data-key="company_uid" value="${comp.company_uid||''}" style="${inputStyle}min-width:120px" readonly></td>
      <td style="${cellStyle}"><input class="odb-input" data-uid="${comp.company_uid||''}" data-key="company_name" value="${comp.company_name||''}" style="${inputStyle}min-width:130px" readonly></td>
      <td style="${cellStyle}text-align:center;color:var(--text-dim);font-size:11px">${booth ? booth.boothId || '—' : '—'}</td>
      ${otherCols}
      <td style="${cellStyle}text-align:center">
        <button onclick="deleteCompanyEntry('${(comp.company_uid||'').replace(/'/g,"\\'")}\')"
          style="color:#f87171;background:none;border:none;cursor:pointer;font-size:14px;line-height:1">×</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.odb-input').forEach(inp => {
    inp.addEventListener('change', handleOtherDbEdit);
  });
}

function handleOtherDbEdit(e) {
  const inp = e.target;
  const uid = inp.dataset.uid;
  const key = inp.dataset.key;
  const val = inp.value.trim();
  const comp = state.companies.find(c => c.company_uid === uid);
  if (!comp) return;
  comp[key] = OTHER_KEYS.includes(key) ? (parseFloat(val) || 0) : val;
  scheduleSave(); render();
}

function getBoothByUid(uid) {
  return state.booths.find(b => b.companyUid === uid) || null;
}

function renderCompanyDbTable(filter) {
  const tbody = document.getElementById('companyDbBody');
  const filterStr = filter !== undefined ? filter : (document.getElementById('companyDbSearch')?.value || '');
  const list = filterStr
    ? state.companies.filter(c =>
        (c.company_uid||'').toLowerCase().includes(filterStr.toLowerCase()) ||
        (c.company_name||'').toLowerCase().includes(filterStr.toLowerCase()))
    : state.companies;

  const cellStyle = 'padding:6px 10px;border-bottom:1px solid var(--border);outline:none;';
  const inputStyle = 'background:transparent;border:none;outline:none;width:100%;font-size:12px;color:var(--text);font-family:inherit;';

  tbody.innerHTML = list.map(comp => {
    const booth = getBoothByUid(comp.company_uid);
    const elecCols = ELEC_TYPES.map(t =>
      `<td style="${cellStyle}text-align:center">
        <input type="number" min="0" value="${comp[t.key]||0}"
          data-uid="${comp.company_uid||''}" data-key="${t.key}"
          style="${inputStyle}text-align:center;width:50px"
          class="cdb-input">
       </td>`
    ).join('');
    return `<tr>
      <td style="${cellStyle}"><input class="cdb-input" data-uid="${comp.company_uid||''}" data-key="company_uid" value="${comp.company_uid||''}" style="${inputStyle}min-width:120px"></td>
      <td style="${cellStyle}"><input class="cdb-input" data-uid="${comp.company_uid||''}" data-key="company_name" value="${comp.company_name||''}" style="${inputStyle}min-width:130px"></td>
      <td style="${cellStyle}text-align:center;color:var(--text-dim);font-size:11px">${booth ? booth.boothId || '—' : '—'}</td>
      ${elecCols}
      <td style="${cellStyle}text-align:center">
        <button onclick="deleteCompanyEntry('${(comp.company_uid||'').replace(/'/g,"\\'")}\')"
          style="color:#f87171;background:none;border:none;cursor:pointer;font-size:14px;line-height:1">×</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.cdb-input').forEach(inp => {
    inp.addEventListener('change', handleCompanyDbEdit);
  });
}

function handleCompanyDbEdit(e) {
  const inp = e.target;
  const uid = inp.dataset.uid;
  const key = inp.dataset.key;
  const val = inp.value.trim();
  const comp = state.companies.find(c => c.company_uid === uid);
  if (!comp) return;
  comp[key] = (ELEC_KEYS.includes(key) || OTHER_KEYS.includes(key)) ? (parseFloat(val) || 0) : val;
  // company_uid 변경 시 부스 참조도 업데이트
  if (key === 'company_uid') {
    state.booths.forEach(b => { if (b.companyUid === uid) b.companyUid = val; });
    document.querySelectorAll(`#companyDbBody [data-uid="${uid}"]`).forEach(el => el.dataset.uid = val);
  }
  scheduleSave(); render();
}

function deleteCompanyEntry(uid) {
  if (!confirm(`'${uid}' 업체를 삭제하시겠습니까?`)) return;
  state.companies = state.companies.filter(c => c.company_uid !== uid);
  renderCompanyDbTable();
  renderOtherDbTable();
  scheduleSave(); render();
}

function addCompanyRow() {
  const newComp = { company_uid: `uid_${Date.now()}`, company_name: '' };
  ELEC_KEYS.forEach(k => { newComp[k] = 0; });
  OTHER_KEYS.forEach(k => { newComp[k] = 0; });
  state.companies.push(newComp);
  renderCompanyDbTable();
  scheduleSave();
}

// ─── Company DB 이벤트 ───
document.addEventListener('DOMContentLoaded', () => {
  // 전기/기타 범례 초기 상태 반영
  updateElecLegend();
  updateOtherLegend();

  // 부스타입 DB 이벤트
  document.getElementById('boothTypeDbSearch').addEventListener('input', e => {
    renderBoothTypeDbTable(e.target.value);
  });
  document.getElementById('btnBoothTypeDbClearAll').addEventListener('click', () => {
    if (!confirm('모든 부스의 타입을 초기화하시겠습니까?')) return;
    saveUndo();
    state.booths.forEach(b => { b.boothType = ''; b.boothTypeCoverage = 100; b.boothTypeDir = 'full'; });
    state.companies.forEach(c => { c.booth_type = ''; });
    renderBoothTypeDbTable(); scheduleSave(); render(); updateProps();
  });
  document.getElementById('boothTypeDbPasteArea').addEventListener('paste', e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;
    const rows = text.trim().split('\n').map(r => r.split('\t'));
    if (!rows.length) return;
    // 첫 줄이 헤더인지 확인 (첫 셀이 숫자가 아니면 헤더)
    let dataRows = rows;
    if (rows.length > 1 && isNaN(rows[0][0])) dataRows = rows.slice(1);
    saveUndo();
    let count = 0;
    dataRows.forEach(row => {
      const uid = (row[0] || '').trim();
      const rawType = (row[1] || '').trim();
      if (!uid) return;
      // 타입 정규화
      let btype = '';
      const tl = rawType.replace(/\s/g,'');
      if (tl.includes('조립')) btype = '조립';
      else if (tl.includes('자체') || tl.includes('독자')) btype = '자체';
      else if (tl.includes('독립')) btype = '독립';
      // 부스에 적용
      const b = state.booths.find(x => x.companyUid === uid);
      if (b) { b.boothType = btype; count++; }
      // 회사 DB도 동기화
      const comp = state.companies.find(c => c.company_uid === uid);
      if (comp) comp.booth_type = btype;
    });
    const hint = document.getElementById('boothTypeDbPasteHint');
    hint.textContent = `${count}개 적용됨`;
    setTimeout(() => { hint.textContent = ''; }, 3000);
    renderBoothTypeDbTable(); scheduleSave(); render(); updateProps();
  });

  // 부스타입 범례 초기 상태 반영
  if (state.showBoothType) {
    document.getElementById('boothTypeLegendSection').style.display = '';
    document.getElementById('panelRight').classList.add('visible');
  }

  document.getElementById('companyDbSearch').addEventListener('input', e => {
    renderCompanyDbTable(e.target.value);
  });
  document.getElementById('btnCompanyDbAddRow').addEventListener('click', addCompanyRow);
  document.getElementById('btnCompanyDbClearAll').addEventListener('click', () => {
    if (!state.companies.length) return;
    if (!confirm(`Company DB 전체 ${state.companies.length}개를 삭제하시겠습니까?`)) return;
    saveUndo();
    state.companies = [];
    renderCompanyDbTable();
    scheduleSave(); render();
  });

  // 붙여넣기: textarea 전용 — 이벤트 간섭 없이 확실하게 처리
  document.getElementById('companyDbPasteArea').addEventListener('paste', e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;

    const allRows = text.trim().split(/\r?\n/).map(r => r.split('\t'));
    if (!allRows.length) return;

    // 첫 행 헤더 여부: 첫 셀이 숫자(또는 4자리 숫자 시작)이면 데이터, 아니면 헤더로 스킵
    const firstCell = (allRows[0][0] || '').trim();
    const isHeader = !firstCell || (isNaN(Number(firstCell)) && !/^\d{4,}/.test(firstCell));
    const dataRows = isHeader ? allRows.slice(1) : allRows;
    if (!dataRows.length) return;

    saveUndo();
    let added = 0, updated = 0;

    dataRows.forEach(row => {
      // 고정 순서: 0=uid, 1=이름, 2=부스, 3~8=elec 6종
      const uid = (row[0] || '').trim();
      if (!uid) return;

      let comp = state.companies.find(c => c.company_uid === uid);
      if (comp) { updated++; } else {
        comp = { company_uid: uid };
        state.companies.push(comp);
        added++;
      }

      comp.company_uid  = uid;
      comp.company_name = (row[1] || '').trim();
      comp.booth_id     = (row[2] || '').trim();
      ELEC_KEYS.forEach((k, i) => {
        comp[k] = parseFloat((row[3 + i] || '').trim()) || 0;
      });

      if (comp.booth_id) {
        const booth = state.booths.find(b => b.boothId === comp.booth_id);
        if (booth) { booth.companyUid = uid; booth.companyName = comp.company_name; }
      }
    });

    // textarea 비우기
    e.target.value = '';
    renderCompanyDbTable();
    scheduleSave(); render();

    const hint = document.getElementById('companyDbPasteHint');
    if (hint) {
      hint.textContent = `완료: ${added}개 추가 / ${updated}개 업데이트`;
      setTimeout(() => { if (hint) hint.textContent = ''; }, 4000);
    }
  });

  // ─── Other DB 이벤트 ───
  document.getElementById('otherDbSearch').addEventListener('input', e => {
    renderOtherDbTable(e.target.value);
  });
  document.getElementById('btnOtherDbAddRow').addEventListener('click', () => {
    const newComp = { company_uid: `uid_${Date.now()}`, company_name: '' };
    ELEC_KEYS.forEach(k => { newComp[k] = 0; });
    OTHER_KEYS.forEach(k => { newComp[k] = 0; });
    state.companies.push(newComp);
    renderOtherDbTable();
    scheduleSave();
  });
  document.getElementById('otherDbPasteArea').addEventListener('paste', e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;
    const allRows = text.trim().split(/\r?\n/).map(r => r.split('\t'));
    if (!allRows.length) return;
    const firstCell = (allRows[0][0] || '').trim();
    const isHeader = !firstCell || (isNaN(Number(firstCell)) && !/^\d{4,}/.test(firstCell));
    const dataRows = isHeader ? allRows.slice(1) : allRows;
    if (!dataRows.length) return;
    saveUndo();
    let added = 0, updated = 0;
    dataRows.forEach(row => {
      // 순서: 0=uid, 1=이름, 2=부스, 3~9=other 7종
      const uid = (row[0] || '').trim();
      if (!uid) return;
      let comp = state.companies.find(c => c.company_uid === uid);
      if (comp) { updated++; } else {
        comp = { company_uid: uid, company_name: '' };
        ELEC_KEYS.forEach(k => { comp[k] = 0; });
        OTHER_KEYS.forEach(k => { comp[k] = 0; });
        state.companies.push(comp);
        added++;
      }
      comp.company_uid  = uid;
      comp.company_name = (row[1] || '').trim();
      OTHER_KEYS.forEach((k, i) => {
        comp[k] = parseFloat((row[3 + i] || '').trim()) || 0;
      });
    });
    e.target.value = '';
    renderOtherDbTable();
    scheduleSave(); render();
    const hint = document.getElementById('otherDbPasteHint');
    if (hint) {
      hint.textContent = `완료: ${added}개 추가 / ${updated}개 업데이트`;
      setTimeout(() => { if (hint) hint.textContent = ''; }, 4000);
    }
  });
});

function toggleBgPanel() {
  const panel = document.getElementById('bgPanelSection');
  const sep = document.getElementById('bgPanelSeparator');
  const btn = document.getElementById('btnBgPanel');
  if (!panel || !sep || !btn) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  sep.style.display = isOpen ? 'none' : '';
  btn.classList.toggle('active', !isOpen);
}

function toggleLang() {
  state.lang = state.lang === 'ko' ? 'en' : 'ko';
  const label = state.lang === 'en' ? 'KO' : 'EN';
  const active = state.lang === 'en';
  // 뷰어 버튼
  const vBtn = document.getElementById('btnViewerLang');
  if (vBtn) {
    vBtn.textContent = label;
    vBtn.style.background = active ? '#1a73e8' : '#fff';
    vBtn.style.color = active ? '#fff' : '#333';
    vBtn.style.borderColor = active ? '#1a73e8' : '#666';
  }
  // 관리자 버튼
  const aBtn = document.getElementById('btnAdminLang');
  if (aBtn) {
    aBtn.textContent = label;
    aBtn.style.background = active ? '#1a73e8' : '';
    aBtn.style.color = active ? '#fff' : '#333';
  }
  render();
}

function toggleViewerAvailable() {
  state.showViewerAvailable = !state.showViewerAvailable;
  const btn = document.getElementById('btnViewerAvailable');
  if (state.showViewerAvailable) {
    btn.style.background = '#FFD600';
    btn.style.color = '#7A5800';
    btn.style.borderColor = '#F9A825';
  } else {
    btn.style.background = '#F8F9FA';
    btn.style.color = '#555';
    btn.style.borderColor = '#E0E0E0';
  }
  render();
}

function toggleViewerBg() {
  state.bg.visible = !state.bg.visible;
  const btn = document.getElementById('btnViewerBgToggle');
  btn.textContent = state.bg.visible ? '🗺 도면 숨기기' : '🗺 도면 보이기';
  btn.style.background = state.bg.visible ? '#F8F9FA' : '#E8F0FE';
  btn.style.color = state.bg.visible ? '#555' : '#1a73e8';
  btn.style.borderColor = state.bg.visible ? '#E0E0E0' : '#1a73e8';
  render();
}

document.getElementById('btnLockCanvas').addEventListener('click', () => {
  state.locked = !state.locked;
  updateLockButton();
});

// ─── Init ───
// ─── 전시회 선택 화면 ───
