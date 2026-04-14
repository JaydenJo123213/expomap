// ─── PDF Export ───

// 저장 위치 선택 — 반드시 사용자 클릭 직후(PDF 생성 전)에 호출해야 함
// Chrome/Edge: 네이티브 OS 저장 다이얼로그  /  Safari·Firefox: 기본 다운로드 폴더
async function _pickSaveHandle(filename) {
  if (!window.showSaveFilePicker) return null;
  try {
    return await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'PDF 파일', accept: { 'application/pdf': ['.pdf'] } }],
    });
  } catch (e) {
    if (e.name === 'AbortError') return 'aborted'; // 사용자가 취소
    return null; // 그 외: 폴백
  }
}

// PDF blob을 핸들에 쓰거나 기본 다운로드
async function _writePDF(doc, filename, handle) {
  if (handle && handle !== 'aborted') {
    const writable = await handle.createWritable();
    await writable.write(doc.output('blob'));
    await writable.close();
  } else if (handle !== 'aborted') {
    doc.save(filename);
  }
}

let _selectedPreset = 'sales';
function selectPreset(card) {
  document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  _selectedPreset = card.dataset.preset;
  document.getElementById('paperSizeRow').style.display = _selectedPreset === 'large' ? 'flex' : 'none';
  const notes = {
    construction: 'Dimensions shown, company names hidden, grayscale rendering.',
    sales: 'Full color with company names and assignment status.',
    company: 'All booths gray; selected booths highlighted (internal status hidden).',
    large: 'Full-resolution export for large-format printing.',
  };
  document.getElementById('exportNote').textContent = notes[_selectedPreset] || '';
}

async function executeExport() {
  const preset = _selectedPreset;
  const paperSize = document.getElementById('paperSize')?.value || 'a3';
  const isConstruction = preset === 'construction';

  // bgFill 모드 여부 (exportFloorplanPDF 와 동일 로직)
  const _bgFill = !isConstruction && _currentExpo && _currentExpo.pdfMode === 'bgFill' && state.bg.img;
  // 방향: bgFill이면 BG 비율로 자동결정, large면 사용자 선택, 아니면 landscape
  let orient;
  if (_bgFill) {
    orient = state.bg.w > state.bg.h ? 'landscape' : 'portrait';
  } else if (preset === 'large') {
    orient = document.getElementById('paperOrient')?.value || 'landscape';
  } else {
    orient = 'landscape';
  }

  try {
    const { jsPDF } = window.jspdf;
    const paperMap = { a3: 'a3', a1: [594, 841], a0: [841, 1189] };
    const fmt = paperMap[paperSize] || 'a3';
    const doc = new jsPDF({ orientation: orient, unit: 'mm', format: fmt });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = _bgFill ? 0 : 10;
    const contentW = pw - 2 * margin;
    const contentH = ph - 2 * margin;

    // 300 DPI 캔버스
    const dpi = 300, mmToPx = dpi / 25.4;
    const offW = Math.round(contentW * mmToPx);
    const offH = Math.round(contentH * mmToPx);
    const off = document.createElement('canvas');
    off.width = offW; off.height = offH;
    const octx = off.getContext('2d');

    renderForExport(octx, offW, offH, preset, _bgFill);

    const imgData = off.toDataURL('image/jpeg', 0.95);
    doc.addImage(imgData, 'JPEG', margin, margin, contentW, contentH);
    const presetNames = { construction: '시공팀용', sales: '영업팀용', company: '업체안내용', large: '대형출력용' };
    const _pdfPre = _currentExpo ? _currentExpo.pdfPrefix : 'ExpoMap';
    await _savePDF(doc, _pdfPre + '_' + (presetNames[preset] || preset) + '.pdf');
    closeModal('modalExport');
  } catch (e) {
    alert('PDF export failed: ' + e.message);
  }
}

async function executeAssignGuideExport() {
  const companyName = document.getElementById('assignGuideCompanyName').value.trim();
  if (!companyName) { alert('업체명을 입력해주세요.'); return; }

  // ① 클릭 직후 저장 위치 먼저 선택
  const assignLang = document.querySelector('input[name="assignLang"]:checked')?.value || 'ko';
  const _pdfPreAG = _currentExpo ? _currentExpo.pdfPrefix : 'ExpoMap';
  const _nowAG = new Date();
  const _dateAG = String(_nowAG.getFullYear()).slice(2) + String(_nowAG.getMonth()+1).padStart(2,'0') + String(_nowAG.getDate()).padStart(2,'0');
  const _langTagAG = assignLang === 'en' ? '_EN' : '';
  const _fnameAG = `${_pdfPreAG}_Floor Plan_${_dateAG}_${companyName}${_langTagAG}.pdf`;
  const fileHandleAG = await _pickSaveHandle(_fnameAG);
  if (fileHandleAG === 'aborted') return;

  state._exporting = true;
  _showPdfLoading('📋 배정안내 PDF 생성 중...');
  const showNames = document.getElementById('assignShowNames').checked;
  const prevLang = state.lang;
  state.lang = assignLang;
  try {
    // exportFloorplanPDF와 동일한 캔버스/스케일 방식 사용
    const _bgFillAG = _currentExpo && _currentExpo.pdfMode === 'bgFill' && state.bg.img;
    const _orientAG = _bgFillAG ? (state.bg.w > state.bg.h ? 'landscape' : 'portrait') : 'portrait';
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: _orientAG, unit: 'mm', format: 'a3' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const agMargin = _bgFillAG ? 0 : 10;
    const agContentW = pw - 2 * agMargin;
    const agContentH = ph - 2 * agMargin;
    const dpi = 250, mmToPx = dpi / 25.4;
    const offW = Math.round(agContentW * mmToPx);
    const offH = Math.round(agContentH * mmToPx);
    const off = document.createElement('canvas');
    off.width = offW; off.height = offH;
    const octx = off.getContext('2d');
    if (!octx) throw new Error('캔버스 컨텍스트 생성 실패 (캔버스 크기 초과?)');
    renderForAssignGuideExport(octx, offW, offH, showNames);
    const imgData = off.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', agMargin, agMargin, agContentW, agContentH, undefined, 'SLOW');
    // ② PDF 생성 완료 후 핸들에 저장
    await _writePDF(doc, _fnameAG, fileHandleAG);
    closeModal('modalAssignGuide');
  } catch (e) {
    alert('PDF 생성 실패: ' + e.message);
  } finally {
    _hidePdfLoading();
    state.lang = prevLang;  // 원래 언어로 복원 (항상 실행)
    state._exporting = false;
  }
}

function renderForExport(ectx, W, H, preset, bgFill = false) {
  const booths = state.booths;
  const isConstruction = preset === 'construction';
  const isCompany = preset === 'company';
  const highlightIds = isCompany ? new Set(state.selectedIds) : null;

  // bounds 계산: bgFill이면 BG 이미지 기준, 아니면 부스/수동영역 기준
  let minX, minY, maxX, maxY;
  if (bgFill && state.bg.img) {
    minX = state.bg.x; minY = state.bg.y;
    maxX = state.bg.x + state.bg.w; maxY = state.bg.y + state.bg.h;
  } else if (state.exportRegion) {
    minX = state.exportRegion.x; minY = state.exportRegion.y;
    maxX = state.exportRegion.x + state.exportRegion.w;
    maxY = state.exportRegion.y + state.exportRegion.h;
  } else if (booths.length) {
    minX = Math.min(...booths.map(b => b.x)) - GRID_PX;
    minY = Math.min(...booths.map(b => b.y)) - GRID_PX;
    maxX = Math.max(...booths.map(b => b.x + b.w)) + GRID_PX;
    maxY = Math.max(...booths.map(b => b.y + b.h)) + GRID_PX;
  } else {
    minX = 0; minY = 0; maxX = 300; maxY = 300;
  }
  const sceneW = maxX - minX, sceneH = maxY - minY;
  // bgFill: 비율 유지하며 꽉 채움, 아니면 여백 5%
  const scaleX = W / sceneW, scaleY = H / sceneH;
  const zoom = bgFill ? Math.min(scaleX, scaleY) : Math.min(scaleX, scaleY) * 0.95;
  const panX = (W - sceneW * zoom) / 2 - minX * zoom;
  const panY = (H - sceneH * zoom) / 2 - minY * zoom;

  ectx.fillStyle = isConstruction ? '#fff' : '#ffffff';
  ectx.fillRect(0, 0, W, H);
  ectx.save();
  ectx.translate(panX, panY);
  ectx.scale(zoom, zoom);

  if (state.bg.img && !isConstruction) {
    // bgFill: 항상 100% opacity, 아니면 현재 설정값
    const alpha = bgFill ? 1 : (state.bg.visible ? state.bg.opacity : 0);
    const rot = (state.bg.rotation || 0) * Math.PI / 180;
    if (rot !== 0) {
      const cx = state.bg.x + state.bg.w / 2;
      const cy = state.bg.y + state.bg.h / 2;
      ectx.save();
      ectx.translate(cx, cy);
      ectx.rotate(rot);
      ectx.globalAlpha = alpha;
      ectx.drawImage(state.bg.img, -state.bg.w/2, -state.bg.h/2, state.bg.w, state.bg.h);
      ectx.globalAlpha = 1;
      ectx.restore();
    } else {
      ectx.globalAlpha = alpha;
      ectx.drawImage(state.bg.img, state.bg.x, state.bg.y, state.bg.w, state.bg.h);
      ectx.globalAlpha = 1;
    }
  }

  if (isConstruction) {
    ectx.strokeStyle = 'rgba(0,0,0,0.1)';
    ectx.lineWidth = 0.5 / zoom;
    for (let x = Math.floor(minX / GRID_PX) * GRID_PX; x < maxX; x += GRID_PX) {
      ectx.beginPath(); ectx.moveTo(x, minY); ectx.lineTo(x, maxY); ectx.stroke();
    }
    for (let y = Math.floor(minY / GRID_PX) * GRID_PX; y < maxY; y += GRID_PX) {
      ectx.beginPath(); ectx.moveTo(minX, y); ectx.lineTo(maxX, y); ectx.stroke();
    }
  }

  // Booths
  booths.forEach(b => {
    let fill, stroke, textColor;
    if (isConstruction) {
      fill = '#e8e8e8'; stroke = '#333'; textColor = '#333';
    } else if (isCompany) {
      const isHighlight = highlightIds && highlightIds.has(b.id);
      fill = isHighlight ? '#4CAF50' : STATUS_COLORS.available.fill;
      stroke = isHighlight ? '#3DAF6E' : STATUS_COLORS.available.stroke;
      textColor = isHighlight ? '#fff' : STATUS_COLORS.available.text;
    } else {
      const statusKey = b.status === 'excluded' ? 'available' : b.status;
      const c = STATUS_COLORS[statusKey] || STATUS_COLORS.available;
      fill = c.fill; stroke = c.stroke; textColor = c.text;
    }

    ectx.fillStyle = fill;
    fillBoothShape(ectx, b);
    ectx.strokeStyle = isConstruction ? stroke : '#000000';
    ectx.lineWidth = 0.5 / zoom;
    strokeBoothShape(ectx, b, zoom);

    drawBoothContent(ectx, b, zoom, textColor, isConstruction, false, false, isConstruction ? null : '#000000');
  });

  // Structures (부스 위에)
  drawStructures(ectx, zoom, isConstruction);

  ectx.restore();
  ectx.fillStyle = 'rgba(79,140,255,0.4)';
  ectx.font = '500 18px sans-serif';
  ectx.textAlign = 'right';
  ectx.textBaseline = 'bottom';
  ectx.fillText('ExpoMap', W - 16, H - 12);
}

// ─── 배정안내 PDF 렌더 ───
function renderForAssignGuideExport(ectx, W, H, _showNames) {
  const booths = state.booths;
  const selectedOverlays = state.discussOverlays.filter(ov => state.selectedDiscussIds.has(ov.id));

  // exportFloorplanPDF와 동일한 bounds/scale/translate 방식
  const _bgFillAGR = _currentExpo && _currentExpo.pdfMode === 'bgFill' && state.bg.img;
  let bounds;
  if (_bgFillAGR) {
    bounds = { x1: state.bg.x, y1: state.bg.y, x2: state.bg.x + state.bg.w, y2: state.bg.y + state.bg.h };
  } else {
    bounds = { x1: 0, y1: 0, x2: 1200, y2: 800 };
    if (booths.length) {
      for (const b of booths) {
        bounds.x1 = Math.min(bounds.x1, b.x);
        bounds.y1 = Math.min(bounds.y1, b.y);
        bounds.x2 = Math.max(bounds.x2, b.x + b.w);
        bounds.y2 = Math.max(bounds.y2, b.y + b.h);
      }
    }
    bounds.x1 -= 50;
    bounds.y1 -= 100;
    bounds.x2 += 50;
    bounds.y2 += 50;
  }

  const scaleX = W / (bounds.x2 - bounds.x1);
  const scaleY = H / (bounds.y2 - bounds.y1);
  const zoom = _bgFillAGR ? Math.min(scaleX, scaleY) : scaleX;

  // 흰 배경
  ectx.fillStyle = '#FFFFFF';
  ectx.fillRect(0, 0, W, H);
  ectx.save();
  ectx.translate(-bounds.x1 * zoom, -bounds.y1 * zoom);
  ectx.scale(zoom, zoom);

  // 배경 이미지 (항상 opacity 100%, visible 무관)
  if (state.bg.img) {
    ectx.globalAlpha = 1;
    ectx.save();
    if (state.bg.rotation) {
      const cx = state.bg.x + state.bg.w / 2;
      const cy = state.bg.y + state.bg.h / 2;
      ectx.translate(cx, cy);
      ectx.rotate(state.bg.rotation * Math.PI / 180);
      ectx.translate(-cx, -cy);
    }
    ectx.drawImage(state.bg.img, state.bg.x, state.bg.y, state.bg.w, state.bg.h);
    ectx.restore();
    ectx.globalAlpha = 1;
  }

  // 부스 렌더링 — 도면출력/배정가능위치와 동일 디자인
  for (const b of booths) {
    const isFacility = b.status === 'facility';
    const fill = isFacility ? '#EFEFEF' : VIEWER_STATUS_COLORS.available.fill;
    ectx.fillStyle = fill;
    fillBoothShape(ectx, b);
    ectx.strokeStyle = '#000000';
    ectx.lineWidth = 0.5 / zoom;
    strokeBoothShape(ectx, b, zoom);

    // 업체명/부스번호 항상 표시 (배정 현황 확인용)
    drawBoothContent(ectx, b, zoom, '#111111', false, false, false, '#000000');
  }

  // 기본부스번호 렌더링 (도면출력과 동일 로직)
  for (const bn of state.baseNumbers) {
    if (!bn.baseNo) continue;
    const covering = booths.find(b =>
      b.x < bn.x + bn.w && b.x + b.w > bn.x &&
      b.y < bn.y + bn.h && b.y + b.h > bn.y &&
      (b.companyName || b.companyNameEn)
    );
    if (covering) continue;
    ectx.fillStyle = '#333';
    const bnFz = Math.min(bn.w, bn.h) * 0.35;
    ectx.font = `600 ${bnFz}px Pretendard, sans-serif`;
    ectx.textAlign = 'center';
    ectx.textBaseline = 'middle';
    ectx.fillText(bn.baseNo, bn.x + bn.w / 2, bn.y + bn.h / 2);
  }

  // 구조물 (부스 위에)
  drawStructures(ectx, zoom, false);

  // 실측 레이어 (showMeasure ON 시 배정안내 PDF에도 반영)
  drawMeasureLayer(ectx, zoom);

  // 배정논의 오버레이 (불투명 처리 - 아래 블럭이 안보이게)
  selectedOverlays.forEach(ov => {
    ectx.fillStyle = '#FFC700';  // 진한 노란색
    ectx.fillRect(ov.x, ov.y, ov.w, ov.h);
    ectx.strokeStyle = '#CC9900';
    ectx.lineWidth = 2.5 / zoom;
    ectx.setLineDash([]);
    ectx.strokeRect(ov.x, ov.y, ov.w, ov.h);

    // 라벨 (검정색, </br> 줄바꿈 지원)
    if (ov.label) {
      const fz = Math.max(10/zoom, 8);
      ectx.font = `600 ${fz}px Pretendard, sans-serif`;
      ectx.fillStyle = '#000000';
      ectx.textAlign = 'center';
      ectx.textBaseline = 'middle';
      const lines = ov.label.split('</br>').map(s => s.trim());
      const lineH = fz * 1.3;
      const startY = ov.y + ov.h / 2 - (lines.length - 1) * lineH / 2;
      lines.forEach((line, i) => ectx.fillText(line, ov.x + ov.w / 2, startY + i * lineH));
    }
  });

  // 선택된 오버레이 2개 이상 → 연결선 + 중심원
  if (selectedOverlays.length >= 2) {
    const cx = selectedOverlays.reduce((s, ov) => s + ov.x + ov.w / 2, 0) / selectedOverlays.length;
    const cy = selectedOverlays.reduce((s, ov) => s + ov.y + ov.h / 2, 0) / selectedOverlays.length;

    // 노란 점선 연결
    ectx.strokeStyle = 'rgba(255,214,0,0.8)';
    ectx.lineWidth = 1.5 / zoom;
    ectx.setLineDash([5 / zoom, 4 / zoom]);
    selectedOverlays.forEach(ov => {
      ectx.beginPath();
      ectx.moveTo(ov.x + ov.w / 2, ov.y + ov.h / 2);
      ectx.lineTo(cx, cy);
      ectx.stroke();
    });
    ectx.setLineDash([]);

    // 중심 노란 원
    ectx.fillStyle = '#FFD600';
    ectx.beginPath();
    ectx.arc(cx, cy, 5 / zoom, 0, Math.PI * 2);
    ectx.fill();
  }

  // 각 오버레이 상단에 빨간색 화살표 (모든 선택된 오버레이)
  if (selectedOverlays.length > 0) {
    ectx.strokeStyle = '#E53935';
    ectx.fillStyle = '#E53935';
    ectx.lineWidth = 5.2 / zoom;  // 50% 더 크게 (3.5 → 5.2)
    ectx.lineCap = 'round';
    ectx.lineJoin = 'round';

    selectedOverlays.forEach(ov => {
      const arrowX = ov.x + ov.w / 2;
      const arrowStartY = ov.y - GRID_PX * 1.2;  // 50% 더 크게
      const arrowEndY = ov.y - GRID_PX * 0.3;    // 50% 더 크게
      const arrowHeadSize = GRID_PX * 0.75;      // 50% 더 크게 (0.5 → 0.75)

      // 화살 줄기
      ectx.beginPath();
      ectx.moveTo(arrowX, arrowStartY);
      ectx.lineTo(arrowX, arrowEndY);
      ectx.stroke();

      // 화살촉
      ectx.beginPath();
      ectx.moveTo(arrowX, arrowEndY);
      ectx.lineTo(arrowX - arrowHeadSize * 0.6, arrowEndY - arrowHeadSize * 0.8);
      ectx.lineTo(arrowX + arrowHeadSize * 0.6, arrowEndY - arrowHeadSize * 0.8);
      ectx.closePath();
      ectx.fill();

      // 부스 개수 텍스트 (화살표 위, 1부스 이상만 표시)
      const boothCountX = (ov.w / GRID_PX);
      const boothCountY = (ov.h / GRID_PX);
      const boothCount = boothCountX * boothCountY;

      if (boothCount >= 1) {
        const boothText = boothCount % 1 === 0 ? String(Math.round(boothCount)) : boothCount.toFixed(2);
        const boothFontSize = Math.max(15/zoom, 12);
        ectx.font = `600 ${boothFontSize}px Pretendard, sans-serif`;
        ectx.fillStyle = '#E53935';
        ectx.textAlign = 'center';
        ectx.textBaseline = 'bottom';
        ectx.fillText(`${boothText} Booth`, arrowX, arrowStartY - 2/zoom);
      }
    });
  }

  ectx.restore();
}

// ─── 벡터 PDF 헬퍼 ───

// SVG 문자열 생성 (bg 이미지 포함, 기존 exportSVG()는 수정 없음)
function _buildSVGString(mode) {
  const booths = state.booths;
  const lang = state.lang;

  // Bounds: bg 이미지 기준 (없으면 부스 extents)
  let bounds;
  if (state.bg.img) {
    const bg = state.bg;
    bounds = { x1: bg.x, y1: bg.y, x2: bg.x + bg.w, y2: bg.y + bg.h };
    for (const b of booths) {
      bounds.x1 = Math.min(bounds.x1, b.x); bounds.y1 = Math.min(bounds.y1, b.y);
      bounds.x2 = Math.max(bounds.x2, b.x + b.w); bounds.y2 = Math.max(bounds.y2, b.y + b.h);
    }
  } else if (booths.length) {
    bounds = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
    for (const b of booths) {
      bounds.x1 = Math.min(bounds.x1, b.x); bounds.y1 = Math.min(bounds.y1, b.y);
      bounds.x2 = Math.max(bounds.x2, b.x + b.w); bounds.y2 = Math.max(bounds.y2, b.y + b.h);
    }
    bounds.x1 -= 50; bounds.y1 -= 50; bounds.x2 += 50; bounds.y2 += 50;
  } else {
    bounds = { x1: 0, y1: 0, x2: 1200, y2: 800 };
  }

  const vw = bounds.x2 - bounds.x1;
  const vh = bounds.y2 - bounds.y1;
  const p = [];
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}">`);
  p.push(`<g transform="translate(${-bounds.x1} ${-bounds.y1})">`);

  // ① 배경 이미지 (raster embed)
  if (state.bg.img) {
    const bgDataUrl = state.bg.dataUrl || _imgToDataUrl(state.bg.img);
    if (bgDataUrl) {
      const bg = state.bg;
      const cx = bg.x + bg.w / 2, cy = bg.y + bg.h / 2;
      const rotAttr = bg.rotation ? ` transform="rotate(${bg.rotation}, ${cx}, ${cy})"` : '';
      p.push(`<image href="${bgDataUrl}" xlink:href="${bgDataUrl}" x="${bg.x}" y="${bg.y}" width="${bg.w}" height="${bg.h}" preserveAspectRatio="none"${rotAttr}/>`);
    }
  }

  // ② 부스
  p.push('<g id="booths">');
  for (const b of booths) {
    const isFacility = b.status === 'facility';
    const isSpot = b.status === 'spot';
    let fill, stroke;
    if (mode === 'available') {
      if (isFacility)   { fill = '#EFEFEF'; stroke = '#999999'; }
      else if (isSpot)  { fill = '#FFD600'; stroke = '#F9A825'; }
      else              { fill = VIEWER_STATUS_COLORS.available.fill; stroke = '#000000'; }
    } else {
      fill   = isFacility ? '#EFEFEF' : VIEWER_STATUS_COLORS.available.fill;
      stroke = isFacility ? '#999999' : '#000000';
    }
    if (b.cells && b.cells.length > 1) {
      p.push('<g>');
      for (const c of b.cells) p.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="${fill}" stroke="none"/>`);
      p.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${stroke}" stroke-width="0.5"/>`);
      p.push('</g>');
    } else {
      p.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>`);
    }
  }
  p.push('</g>');

  // ③ 기본부스번호
  p.push('<g id="base-numbers">');
  for (const bn of state.baseNumbers) {
    if (!bn.baseNo) continue;
    const covering = booths.find(b => b.x < bn.x+bn.w && b.x+b.w > bn.x && b.y < bn.y+bn.h && b.y+b.h > bn.y && (b.companyName || b.companyNameEn));
    if (covering) continue;
    const fz = Math.min(bn.w, bn.h) * 0.35;
    p.push(`<text x="${bn.x+bn.w/2}" y="${bn.y+bn.h/2+fz*0.35}" font-family="Pretendard,sans-serif" font-size="${fz}" font-weight="600" fill="#333" text-anchor="middle">${_escXml(bn.baseNo)}</text>`);
  }
  p.push('</g>');

  // ④ 구조물
  p.push('<g id="structures">');
  for (const s of state.structures) {
    const col = s.color || '#888', fillCol = s.fillColor || '#5C5C5C', th = s.thickness || 2;
    if (s.type === 'column') {
      if (s.columnShape === 'square') {
        const hw = (s.w || s.radius*2)/2, hh = (s.h || s.radius*2)/2;
        p.push(`<rect x="${s.x-hw}" y="${s.y-hh}" width="${hw*2}" height="${hh*2}" fill="${fillCol}" stroke="${col}" stroke-width="0.5"/>`);
      } else {
        p.push(`<circle cx="${s.x}" cy="${s.y}" r="${s.radius}" fill="${fillCol}" stroke="${col}" stroke-width="0.5"/>`);
      }
    } else if (s.type === 'circle') {
      p.push(`<circle cx="${s.x}" cy="${s.y}" r="${s.radius}" fill="${fillCol}" stroke="${col}" stroke-width="0.5"/>`);
    } else if (s.type === 'wall' || s.type === 'line') {
      p.push(`<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${col}" stroke-width="${th}" stroke-linecap="round"/>`);
    } else if (s.type === 'arrow') {
      const ang = Math.atan2(s.y2-s.y1, s.x2-s.x1), hl = 10;
      p.push(`<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${col}" stroke-width="${th}" stroke-linecap="round"/>`);
      const ax1 = s.x2-hl*Math.cos(ang-Math.PI/6), ay1 = s.y2-hl*Math.sin(ang-Math.PI/6);
      const ax2 = s.x2-hl*Math.cos(ang+Math.PI/6), ay2 = s.y2-hl*Math.sin(ang+Math.PI/6);
      p.push(`<polyline points="${ax1},${ay1} ${s.x2},${s.y2} ${ax2},${ay2}" stroke="${col}" stroke-width="${th}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    } else if (s.type === 'text') {
      const tfz = s.fontSize || 14;
      p.push(`<text x="${s.x + (s.w||0)/2}" y="${s.y + (s.h||0)/2}" font-family="Pretendard,sans-serif" font-size="${tfz}" font-weight="${s.bold?'700':'400'}" fill="${col}" text-anchor="middle">${_escXml(s.text||'')}</text>`);
    }
    if (s.label) {
      const lx = s.x !== undefined ? s.x : (s.x1+s.x2)/2;
      const ly = (s.y !== undefined ? s.y : (s.y1+s.y2)/2) - 8;
      p.push(`<text x="${lx}" y="${ly}" font-family="Pretendard,sans-serif" font-size="8" fill="${col}" text-anchor="middle">${_escXml(s.label)}</text>`);
    }
  }
  p.push('</g>');

  // ⑤ 부스 콘텐츠 (업체명/부스번호/로고) — fontSizeOverride 지원
  const pLogos = [], pNos = [], pNames = [];
  const mc = document.createElement('canvas').getContext('2d');
  for (const b of booths) {
    const isEnMode = lang === 'en';
    const displayName = isEnMode ? (b.companyNameEn || '') : (b.companyName || '');
    const fontSizeOverride = isEnMode ? (b.fontSizeEn ?? null) : (b.fontSize ?? null);
    const pad = 2;
    const tr = (typeof getTextRect === 'function') ? getTextRect(b) : { x: b.x, y: b.y, w: b.w, h: b.h };
    const availW = tr.w - pad*2, availH = tr.h - pad*2;
    const area = typeof getBoothAreaM2 === 'function' ? getBoothAreaM2(b) : (b.w/10)*(b.h/10);
    const hasCompany = !!displayName, hasBoothNo = !!b.boothId;

    const addBoothNo = (noFz) => {
      pNos.push(`<text x="${tr.x+pad}" y="${tr.y+pad+noFz}" font-family="Pretendard,sans-serif" font-size="${noFz}" font-weight="600" fill="#000000" opacity="0.65">${_escXml(b.boothId)}</text>`);
    };

    const shouldDrawLogo = area >= 36 && hasCompany && b.companyLogoUrl;
    let logoDrawn = false;
    if (shouldDrawLogo) {
      const logoImg = state.logoCache.get(b.id);
      if (logoImg) {
        const logoDataUrl = _imgToDataUrl(logoImg);
        if (logoDataUrl) {
          logoDrawn = true;
          const scale = (b.logoScale ?? 100) / 100;
          const gap = (b.logoGap ?? 0) * (tr.h / 100);
          const noReserve = hasBoothNo ? calcFontSize(mc, b.boothId, 26) + 4 : 0;
          const logoPad = tr.w * 0.08, logoTopPad = Math.max(tr.h*0.05, noReserve);
          const logoAreaH = tr.h * 0.60;
          const logoW = tr.w - logoPad*2, logoH = logoAreaH - logoTopPad - tr.h*0.02;
          const imgAspect = (logoImg.naturalWidth||1) / (logoImg.naturalHeight||1);
          const areaAspect = logoW / logoH;
          let drawW, drawH;
          if (imgAspect > areaAspect) { drawW = logoW; drawH = logoW/imgAspect; }
          else { drawH = logoH; drawW = logoH*imgAspect; }
          drawW *= scale; drawH *= scale;
          const logoX = tr.x + (tr.w-drawW)/2;
          const logoY = tr.y + logoTopPad + logoH/2 - drawH/2;
          pLogos.push(`<image href="${logoDataUrl}" xlink:href="${logoDataUrl}" x="${logoX}" y="${logoY}" width="${drawW}" height="${drawH}" opacity="0.9" preserveAspectRatio="xMidYMid meet"/>`);

          const textAreaY = tr.y + tr.h*0.58 + gap;
          const textAreaH = tr.h*0.36 - gap;
          const lines = wrapText(displayName);
          const longestLine = lines.reduce((a,l) => a.length >= l.length ? a : l, '');
          let fz = fontSizeOverride != null ? Math.max(1.5, Math.min(fontSizeOverride, 60))
            : (() => { let v = calcFontSize(mc, longestLine||'A', availW*0.85); if (textAreaH > 0) v = Math.min(v, (textAreaH/lines.length)/1.25); return Math.max(1.5, Math.min(v, 12)); })();
          const lineH = fz*1.25, blockH = lines.length*lineH;
          const startY = textAreaY + (textAreaH-blockH)/2 + fz*0.5;
          { const cx = tr.x+tr.w/2, baseY = startY+fz*0.35;
            const body = lines.length === 1 ? _escXml(lines[0]) : lines.map((l,i) => `<tspan x="${cx}" dy="${i===0?0:lineH}">${_escXml(l)}</tspan>`).join('');
            pNames.push(`<text x="${cx}" y="${baseY}" font-family="Pretendard,sans-serif" font-size="${fz}" font-weight="400" fill="#111111" text-anchor="middle">${body}</text>`);
          }
          if (hasBoothNo) addBoothNo(calcFontSize(mc, b.boothId, 26));
        }
      }
    }

    if (!logoDrawn) {
      if (hasCompany) {
        const lines = wrapText(displayName);
        const longestLine = lines.reduce((a,l) => a.length >= l.length ? a : l, '');
        const noFz = hasBoothNo ? calcFontSize(mc, b.boothId, 26) : 0;
        const topReserve = hasBoothNo ? noFz+2 : 0;
        const textAreaH = availH - topReserve;
        let fz = fontSizeOverride != null ? Math.max(1.5, Math.min(fontSizeOverride, 60))
          : (() => { let v = calcFontSize(mc, longestLine||'A', availW*0.9); if (textAreaH > 0) v = Math.min(v, (textAreaH/lines.length)/1.25); return Math.max(1.5, Math.min(v, 16)); })();
        const lineH = fz*1.25, blockH = lines.length*lineH;
        const startY = tr.y + topReserve + pad + (textAreaH-blockH)/2 + fz*0.5;
        { const cx = tr.x+tr.w/2, baseY = startY+fz*0.35;
          const body = lines.length === 1 ? _escXml(lines[0]) : lines.map((l,i) => `<tspan x="${cx}" dy="${i===0?0:lineH}">${_escXml(l)}</tspan>`).join('');
          pNames.push(`<text x="${cx}" y="${baseY}" font-family="Pretendard,sans-serif" font-size="${fz}" font-weight="400" fill="#111111" text-anchor="middle">${body}</text>`);
        }
        if (hasBoothNo) addBoothNo(noFz);
      } else if (hasBoothNo) {
        addBoothNo(calcFontSize(mc, b.boothId, 26));
      }
    }
  }
  if (pLogos.length) { p.push('<g id="booth-logos">'); pLogos.forEach(e => p.push(e)); p.push('</g>'); }
  if (pNos.length)   { p.push('<g id="booth-numbers">'); pNos.forEach(e => p.push(e)); p.push('</g>'); }
  if (pNames.length) { p.push('<g id="company-names">'); pNames.forEach(e => p.push(e)); p.push('</g>'); }

  // ⑥ 장식 로고
  if (state.logos && state.logos.length) {
    p.push('<g id="decorative-logos">');
    for (const logo of state.logos) {
      if (!logo.img) continue;
      const dataUrl = logo.dataUrl || _imgToDataUrl(logo.img);
      if (dataUrl) p.push(`<image href="${dataUrl}" xlink:href="${dataUrl}" x="${logo.x}" y="${logo.y}" width="${logo.w}" height="${logo.h}" preserveAspectRatio="xMidYMid meet"/>`);
    }
    p.push('</g>');
  }

  p.push('</g>');
  p.push('</svg>');
  return p.join('\n');
}

// SVG 문자열 → 벡터 PDF (svg2pdf.js 사용)
async function _svgToPDF(svgString, filename, fileHandle) {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = svgDoc.documentElement;
  // svg2pdf이 처리하려면 DOM에 부착 필요
  svgEl.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:0;left:0';
  document.body.appendChild(svgEl);
  try {
    const vb = svgEl.viewBox.baseVal;
    const orientation = vb.width > vb.height ? 'landscape' : 'portrait';
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation, unit: 'mm', format: 'a3' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 10, cw = pw - margin*2, ch = ph - margin*2;
    // svg2pdf.js v2 UMD: 전역이 함수 직접이거나 {svg2pdf: fn} 객체일 수 있음
    const svg2pdfFn = (typeof svg2pdf === 'function')
      ? svg2pdf
      : (window.svg2pdf && typeof window.svg2pdf.svg2pdf === 'function')
        ? window.svg2pdf.svg2pdf
        : null;
    if (!svg2pdfFn) throw new Error('svg2pdf 라이브러리가 로드되지 않았습니다.');
    await svg2pdfFn(svgEl, doc, { x: margin, y: margin, width: cw, height: ch });
    await _writePDF(doc, filename, fileHandle);
  } finally {
    document.body.removeChild(svgEl);
  }
}

// ─── PDF 로딩 오버레이 ───
function _showPdfLoading(text) {
  const el = document.getElementById('pdfLoadingOverlay');
  if (!el) return;
  el.style.display = 'flex';
  const t = document.getElementById('pdfLoadingText');
  if (t) t.textContent = text || 'PDF 생성 중...';
}
function _hidePdfLoading() {
  const el = document.getElementById('pdfLoadingOverlay');
  if (el) el.style.display = 'none';
}

// ─── 벡터 PDF 공통 (jsPDF 직접 드로잉 + 고화질 텍스트 오버레이) ───
async function _buildJsPDFVector(mode, filename, fileHandle) {
  const booths = state.booths;
  // 배정안내와 동일한 bgFill 판단
  const _bgFill = _currentExpo && _currentExpo.pdfMode === 'bgFill' && state.bg.img;

  // Bounds — bgFill이면 bg 기준, 아니면 부스 기준 (배정안내와 동일 패딩)
  let bounds;
  if (_bgFill) {
    bounds = { x1: state.bg.x, y1: state.bg.y, x2: state.bg.x + state.bg.w, y2: state.bg.y + state.bg.h };
  } else {
    bounds = { x1: 0, y1: 0, x2: 1200, y2: 800 };
    if (booths.length) {
      for (const b of booths) {
        bounds.x1 = Math.min(bounds.x1, b.x); bounds.y1 = Math.min(bounds.y1, b.y);
        bounds.x2 = Math.max(bounds.x2, b.x + b.w); bounds.y2 = Math.max(bounds.y2, b.y + b.h);
      }
      bounds.x1 -= 50; bounds.y1 -= 100; bounds.x2 += 50; bounds.y2 += 50;
    }
  }

  const vw = bounds.x2 - bounds.x1, vh = bounds.y2 - bounds.y1;
  const { jsPDF } = window.jspdf;
  // bgFill: bg 비율로 방향; 아니면 portrait
  const orientation = _bgFill ? (state.bg.w > state.bg.h ? 'landscape' : 'portrait') : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a3' });
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
  const margin = _bgFill ? 0 : 10;
  const cw = pw - margin * 2, ch = ph - margin * 2;

  // Scale: bgFill → fit (min), normal → fill width (scaleX) — 배정안내와 동일
  const scaleX = cw / vw, scaleY = ch / vh;
  const scaleMm = _bgFill ? Math.min(scaleX, scaleY) : scaleX;
  // Offset: bgFill → 중앙 정렬; normal → 좌상단 (margin)
  const offX = _bgFill ? margin + (cw - vw * scaleMm) / 2 : margin;
  const offY = _bgFill ? margin + (ch - vh * scaleMm) / 2 : margin;
  const toX = px => offX + (px - bounds.x1) * scaleMm;
  const toY = py => offY + (py - bounds.y1) * scaleMm;
  const toS = px => px * scaleMm;

  const hexRgb = h => ({ r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16) });

  // 흰 배경
  doc.setFillColor(255,255,255);
  doc.rect(0, 0, pw, ph, 'F');

  // Layer 1: 배경 이미지 (raster)
  if (state.bg.img) {
    const bgDataUrl = state.bg.dataUrl || _imgToDataUrl(state.bg.img);
    if (bgDataUrl) {
      try { doc.addImage(bgDataUrl, 'PNG', toX(state.bg.x), toY(state.bg.y), toS(state.bg.w), toS(state.bg.h)); }
      catch(e) {}
    }
  }

  // Layer 2: 부스 rect — VECTOR (선 굵기: 배정안내와 동일하게 0.5 world-px 환산)
  const lw = Math.max(0.05, 0.5 * scaleMm);
  doc.setLineWidth(lw);
  for (const b of booths) {
    const isFacility = b.status === 'facility', isSpot = b.status === 'spot';
    let fillHex, strokeHex;
    if (mode === 'available') {
      if (isFacility)    { fillHex = '#EFEFEF'; strokeHex = '#999999'; }
      else if (isSpot)   { fillHex = '#FFD600'; strokeHex = '#F9A825'; }
      else               { fillHex = VIEWER_STATUS_COLORS.available.fill; strokeHex = '#000000'; }
    } else {
      fillHex   = isFacility ? '#EFEFEF' : VIEWER_STATUS_COLORS.available.fill;
      strokeHex = isFacility ? '#999999' : '#000000';
    }
    const fr = hexRgb(fillHex), sr = hexRgb(strokeHex);

    if (b.cells && b.cells.length > 1) {
      // L자: 셀 fill만, 셀 간 경계선 없음
      for (const c of b.cells) {
        doc.setFillColor(fr.r, fr.g, fr.b);
        doc.setDrawColor(fr.r, fr.g, fr.b);
        doc.rect(toX(c.x), toY(c.y), toS(c.w), toS(c.h), 'FD');
      }
      doc.setDrawColor(sr.r, sr.g, sr.b);
      doc.rect(toX(b.x), toY(b.y), toS(b.w), toS(b.h), 'S');
    } else {
      doc.setFillColor(fr.r, fr.g, fr.b);
      doc.setDrawColor(sr.r, sr.g, sr.b);
      doc.rect(toX(b.x), toY(b.y), toS(b.w), toS(b.h), 'FD');
    }
  }

  // Layer 3: 텍스트/로고/구조물/실측 — 600 DPI 투명 캔버스 오버레이
  const dpi = 600, mmpx = dpi / 25.4;
  const oc = document.createElement('canvas');
  oc.width = Math.round(cw * mmpx);
  oc.height = Math.round(ch * mmpx);
  const ctx = oc.getContext('2d');
  ctx.clearRect(0, 0, oc.width, oc.height); // 투명 배경

  // world → canvas px 변환 (배정안내 translate/scale 방식과 동일)
  const wScale = scaleMm * mmpx; // world-px → canvas-px
  const cOffX = (offX - margin) * mmpx, cOffY = (offY - margin) * mmpx;
  ctx.save();
  ctx.translate(cOffX - bounds.x1 * wScale, cOffY - bounds.y1 * wScale);
  ctx.scale(wScale, wScale);

  // 부스 텍스트 & 로고
  for (const b of booths) drawBoothContent(ctx, b, wScale, '#111111', false);

  // 기본부스번호
  for (const bn of state.baseNumbers) {
    if (!bn.baseNo) continue;
    const cov = booths.find(b2 =>
      b2.x < bn.x+bn.w && b2.x+b2.w > bn.x && b2.y < bn.y+bn.h && b2.y+b2.h > bn.y &&
      (b2.companyName || b2.companyNameEn));
    if (cov) continue;
    const fz = Math.min(bn.w, bn.h) * 0.35;
    ctx.fillStyle = '#333';
    ctx.font = `600 ${fz}px Pretendard, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(bn.baseNo, bn.x + bn.w/2, bn.y + bn.h/2);
  }

  // 구조물 & 실측
  drawStructures(ctx, wScale, false);
  drawMeasureLayer(ctx, wScale);

  ctx.restore();

  doc.addImage(oc.toDataURL('image/png'), 'PNG', margin, margin, cw, ch);
  await _writePDF(doc, filename, fileHandle);
}

async function exportFloorplanPDF() {
  if (state.booths.length === 0) { alert('부스가 없습니다.'); return; }

  // ① 클릭 직후 저장 위치 먼저 선택 (transient activation 만료 전)
  const _pdfPre0 = _currentExpo ? _currentExpo.pdfPrefix : 'ExpoMap';
  const _today0 = new Date();
  const _date0 = String(_today0.getFullYear()).slice(2) + String(_today0.getMonth()+1).padStart(2,'0') + String(_today0.getDate()).padStart(2,'0');
  const _lang0 = state.lang === 'en' ? '_EN' : '';
  const _fname0 = `${_pdfPre0}_Floor Plan_${_date0}${_lang0}.pdf`;
  const fileHandle = await _pickSaveHandle(_fname0);
  if (fileHandle === 'aborted') return;

  state._exporting = true;
  _showPdfLoading('🖨️ 도면출력 PDF 생성 중...');
  try {
    await _buildJsPDFVector('floorplan', _fname0, fileHandle);
  } catch (e) {
    alert('PDF 생성 실패: ' + e.message);
  } finally {
    _hidePdfLoading();
    state._exporting = false;
  }
}

async function exportAvailablePDF() {
  if (state.booths.length === 0) { alert('부스가 없습니다.'); return; }

  // ① 클릭 직후 저장 위치 먼저 선택
  const _pdfPre2a = _currentExpo ? _currentExpo.pdfPrefix : 'ExpoMap';
  const _today2 = new Date();
  const _date2 = String(_today2.getFullYear()).slice(2) + String(_today2.getMonth()+1).padStart(2,'0') + String(_today2.getDate()).padStart(2,'0');
  const _lang2 = state.lang === 'en' ? '_EN' : '';
  const _fname2 = `${_pdfPre2a}_Floor Plan_${_date2}_Available${_lang2}.pdf`;
  const fileHandle2 = await _pickSaveHandle(_fname2);
  if (fileHandle2 === 'aborted') return;

  state._exporting = true;
  _showPdfLoading('📍 배정가능위치 PDF 생성 중...');
  try {
    await _buildJsPDFVector('available', _fname2, fileHandle2);
  } catch (e) {
    alert('PDF 생성 실패: ' + e.message);
  } finally {
    _hidePdfLoading();
    state._exporting = false;
  }
}

// ─── SVG 대형출력 Export ───

function _escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _imgToDataUrl(img) {
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width || 1;
    c.height = img.naturalHeight || img.height || 1;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/png');
  } catch (e) {
    return null;
  }
}

async function _saveSVG(svgString, filename) {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'SVG 파일', accept: { 'image/svg+xml': ['.svg'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function exportSVG(lang = 'ko') {
  state._exporting = true;
  try {
    const booths = state.booths;

    // SVG bounds: 부스 기준 (bg 이미지는 PNG 래스터이므로 SVG에서 제외)
    let bounds = { x1: 0, y1: 0, x2: 1200, y2: 800 };
    if (booths.length) {
      bounds = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
      for (const b of booths) {
        bounds.x1 = Math.min(bounds.x1, b.x);
        bounds.y1 = Math.min(bounds.y1, b.y);
        bounds.x2 = Math.max(bounds.x2, b.x + b.w);
        bounds.y2 = Math.max(bounds.y2, b.y + b.h);
      }
      bounds.x1 -= 50; bounds.y1 -= 50;
      bounds.x2 += 50; bounds.y2 += 50;
    }
    const vw = bounds.x2 - bounds.x1;
    const vh = bounds.y2 - bounds.y1;

    const p = [];
    p.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}">`);
    p.push(`<g transform="translate(${-bounds.x1} ${-bounds.y1})">`);

    // ① 부스 (벡터 rect)
    p.push('<g id="booths">');
    for (const b of booths) {
      const isFacility = b.status === 'facility';
      const fill = isFacility ? '#EFEFEF' : VIEWER_STATUS_COLORS.available.fill;
      if (b.cells && b.cells.length > 1) {
        // L자 부스: 셀은 fill만, 바운딩박스에 테두리
        p.push('<g>');
        for (const c of b.cells) {
          p.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="${fill}" stroke="none"/>`);
        }
        p.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#000000" stroke-width="0.5"/>`);
        p.push('</g>');
      } else {
        p.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${fill}" stroke="#000000" stroke-width="0.5"/>`);
      }
    }
    p.push('</g>');

    // ③ 기본부스번호
    p.push('<g id="base-numbers">');
    for (const bn of state.baseNumbers) {
      if (!bn.baseNo) continue;
      const covering = booths.find(b =>
        b.x < bn.x + bn.w && b.x + b.w > bn.x &&
        b.y < bn.y + bn.h && b.y + b.h > bn.y &&
        (b.companyName || b.companyNameEn)
      );
      if (covering) continue;
      const fz = Math.min(bn.w, bn.h) * 0.35;
      p.push(`<text x="${bn.x + bn.w/2}" y="${bn.y + bn.h/2 + fz * 0.35}" font-family="Pretendard,sans-serif" font-size="${fz}" font-weight="600" fill="#333" text-anchor="middle">${_escXml(bn.baseNo)}</text>`);
    }
    p.push('</g>');

    // ④ 구조물
    p.push('<g id="structures">');
    for (const s of state.structures) {
      const col = s.color || '#888';
      const fillCol = s.fillColor || '#5C5C5C';
      const th = s.thickness || 2;
      if (s.type === 'column') {
        if (s.columnShape === 'square') {
          const hw = (s.w || s.radius * 2) / 2, hh = (s.h || s.radius * 2) / 2;
          p.push(`<rect x="${s.x-hw}" y="${s.y-hh}" width="${hw*2}" height="${hh*2}" fill="${fillCol}" stroke="${col}" stroke-width="0.5"/>`);
        } else {
          p.push(`<circle cx="${s.x}" cy="${s.y}" r="${s.radius}" fill="${fillCol}" stroke="${col}" stroke-width="0.5"/>`);
        }
      } else if (s.type === 'circle') {
        p.push(`<circle cx="${s.x}" cy="${s.y}" r="${s.radius}" fill="${fillCol}" stroke="${col}" stroke-width="0.5"/>`);
      } else if (s.type === 'wall' || s.type === 'line') {
        p.push(`<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${col}" stroke-width="${th}" stroke-linecap="round"/>`);
      } else if (s.type === 'arrow') {
        const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
        const hl = 10;
        p.push(`<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${col}" stroke-width="${th}" stroke-linecap="round"/>`);
        const ax1 = s.x2 - hl * Math.cos(ang - Math.PI/6), ay1 = s.y2 - hl * Math.sin(ang - Math.PI/6);
        const ax2 = s.x2 - hl * Math.cos(ang + Math.PI/6), ay2 = s.y2 - hl * Math.sin(ang + Math.PI/6);
        p.push(`<polyline points="${ax1},${ay1} ${s.x2},${s.y2} ${ax2},${ay2}" stroke="${col}" stroke-width="${th}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
      }
      if (s.label) {
        const lx = s.x !== undefined ? s.x : (s.x1 + s.x2) / 2;
        const ly = (s.y !== undefined ? s.y : (s.y1 + s.y2) / 2) - 8;
        p.push(`<text x="${lx}" y="${ly}" font-family="Pretendard,sans-serif" font-size="8" fill="${col}" text-anchor="middle">${_escXml(s.label)}</text>`);
      }
    }
    p.push('</g>');

    // ⑤ 부스 콘텐츠 — 레이어 분리: booth-logos / booth-numbers / company-names
    const pLogos = [], pNos = [], pNames = [];
    const mc = document.createElement('canvas').getContext('2d');
    for (const b of booths) {
      const displayName = lang === 'en' ? (b.companyNameEn || '') : (b.companyName || '');
      const pad = 2;
      // L자 부스: 가장 큰 셀 기준 (render.js getTextRect와 동일)
      const tr = (typeof getTextRect === 'function') ? getTextRect(b) : { x: b.x, y: b.y, w: b.w, h: b.h };
      const availW = tr.w - pad * 2;
      const availH = tr.h - pad * 2;
      const wm = typeof pxToM === 'function' ? pxToM(b.w) : b.w / 10;
      const hm = typeof pxToM === 'function' ? pxToM(b.h) : b.h / 10;
      const area = typeof getBoothAreaM2 === 'function' ? getBoothAreaM2(b) : wm * hm;
      const hasCompany = !!displayName;
      const hasBoothNo = !!b.boothId;

      const addBoothNo = (noFz) => {
        pNos.push(`<text x="${tr.x + pad}" y="${tr.y + pad + noFz}" font-family="Pretendard,sans-serif" font-size="${noFz}" font-weight="600" fill="#000000" opacity="0.65">${_escXml(b.boothId)}</text>`);
      };

      // Case 1: 로고 있음 (render.js:106-190)
      const shouldDrawLogo = area >= 36 && hasCompany && b.companyLogoUrl;
      let logoDrawn = false;
      if (shouldDrawLogo) {
        const logoImg = state.logoCache.get(b.id);
        if (logoImg) {
          const logoDataUrl = _imgToDataUrl(logoImg);
          if (logoDataUrl) {
            logoDrawn = true;
            const scale = (b.logoScale ?? 100) / 100;
            const gap = (b.logoGap ?? 0) * (tr.h / 100);
            const noReserve = hasBoothNo ? calcFontSize(mc, b.boothId, 26) + 4 : 0;
            const logoPad = tr.w * 0.08;
            const logoTopPad = Math.max(tr.h * 0.05, noReserve);
            const logoBottomPad = tr.h * 0.02;
            const logoAreaH = tr.h * 0.60;
            const logoW = tr.w - logoPad * 2;
            const logoH = logoAreaH - logoTopPad - logoBottomPad;
            const imgAspect = (logoImg.naturalWidth || 1) / (logoImg.naturalHeight || 1);
            const areaAspect = logoW / logoH;
            let drawW, drawH;
            if (imgAspect > areaAspect) {
              drawW = logoW; drawH = logoW / imgAspect;
            } else {
              drawH = logoH; drawW = logoH * imgAspect;
            }
            drawW *= scale; drawH *= scale;
            const logoX = tr.x + (tr.w - drawW) / 2;
            const logoCenterY = tr.y + logoTopPad + logoH / 2;
            const logoY = logoCenterY - drawH / 2;
            pLogos.push(`<image xlink:href="${logoDataUrl}" x="${logoX}" y="${logoY}" width="${drawW}" height="${drawH}" opacity="0.9" preserveAspectRatio="xMidYMid meet"/>`);

            // 텍스트 영역: 로고 아래 (render.js:143-159)
            const textAreaY = tr.y + tr.h * 0.58 + gap;
            const textAreaH = tr.h * 0.36 - gap;
            const lines = wrapText(displayName);
            const longestLine = lines.reduce((a, l) => a.length >= l.length ? a : l, '');
            let fz = calcFontSize(mc, longestLine || 'A', availW * 0.85);
            if (textAreaH > 0) fz = Math.min(fz, (textAreaH / lines.length) / 1.25);
            fz = Math.max(1.5, Math.min(fz, 12));
            const lineH = fz * 1.25;
            const blockH = lines.length * lineH;
            const startY = textAreaY + (textAreaH - blockH) / 2 + fz * 0.5;
            { const cx = tr.x + tr.w / 2, baseY = startY + fz * 0.35;
              const body = lines.length === 1
                ? _escXml(lines[0])
                : lines.map((l, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : lineH}">${_escXml(l)}</tspan>`).join('');
              pNames.push(`<text x="${cx}" y="${baseY}" font-family="Pretendard,sans-serif" font-size="${fz}" font-weight="400" fill="#111111" text-anchor="middle">${body}</text>`);
            }

            if (hasBoothNo) addBoothNo(calcFontSize(mc, b.boothId, 26));
          }
        }
      }

      if (!logoDrawn) {
        if (hasCompany) {
          // Case 2: 업체명만 (render.js:212-253)
          const lines = wrapText(displayName);
          const longestLine = lines.reduce((a, l) => a.length >= l.length ? a : l, '');
          const noFz = hasBoothNo ? calcFontSize(mc, b.boothId, 26) : 0;
          const topReserve = hasBoothNo ? noFz + 2 : 0;
          const textAreaH = availH - topReserve;
          let fz = calcFontSize(mc, longestLine || 'A', availW * 0.9);
          if (textAreaH > 0) fz = Math.min(fz, (textAreaH / lines.length) / 1.25);
          fz = Math.max(1.5, Math.min(fz, 16));
          const lineH = fz * 1.25;
          const blockH = lines.length * lineH;
          const startY = tr.y + topReserve + pad + (textAreaH - blockH) / 2 + fz * 0.5;
          { const cx = tr.x + tr.w / 2, baseY = startY + fz * 0.35;
            const body = lines.length === 1
              ? _escXml(lines[0])
              : lines.map((l, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : lineH}">${_escXml(l)}</tspan>`).join('');
            pNames.push(`<text x="${cx}" y="${baseY}" font-family="Pretendard,sans-serif" font-size="${fz}" font-weight="400" fill="#111111" text-anchor="middle">${body}</text>`);
          }
          if (hasBoothNo) addBoothNo(noFz);
        } else if (hasBoothNo) {
          // Case 3: 부스번호만 (render.js:254-260)
          addBoothNo(calcFontSize(mc, b.boothId, 26));
        }
      }
    }
    if (pLogos.length) { p.push('<g id="booth-logos">'); pLogos.forEach(e => p.push(e)); p.push('</g>'); }
    if (pNos.length)   { p.push('<g id="booth-numbers">'); pNos.forEach(e => p.push(e)); p.push('</g>'); }
    if (pNames.length) { p.push('<g id="company-names">'); pNames.forEach(e => p.push(e)); p.push('</g>'); }

    // ⑥ 장식 로고 (state.logos)
    if (state.logos && state.logos.length) {
      p.push('<g id="decorative-logos">');
      for (const logo of state.logos) {
        if (!logo.img) continue;
        const dataUrl = logo.dataUrl || _imgToDataUrl(logo.img);
        if (dataUrl) p.push(`<image xlink:href="${dataUrl}" x="${logo.x}" y="${logo.y}" width="${logo.w}" height="${logo.h}" preserveAspectRatio="xMidYMid meet"/>`);
      }
      p.push('</g>');
    }

    p.push('</g>');
    p.push('</svg>');

    const now = new Date();
    const dateStr = String(now.getFullYear()).slice(2) + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
    const _pdfPre = _currentExpo ? _currentExpo.pdfPrefix : 'ExpoMap';
    const _langSuffix = lang === 'en' ? '_EN' : '';
    await _saveSVG(p.join('\n'), `${_pdfPre}_Floor Plan_${dateStr}_Vector${_langSuffix}.svg`);
  } catch (e) {
    alert('SVG 생성 실패: ' + e.message);
  } finally {
    state._exporting = false;
  }
}
