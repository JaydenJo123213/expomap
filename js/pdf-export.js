// ─── PDF Export ───

// 저장 다이얼로그 (Chrome/Edge: 경로 선택 가능 / Safari·Firefox: 기본 다운로드)
async function _savePDF(doc, filename) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'PDF 파일', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(doc.output('blob'));
      await writable.close();
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // 사용자가 취소
      // 그 외 에러는 폴백
    }
  }
  doc.save(filename);
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
  const orient = document.getElementById('paperOrient')?.value || 'landscape';
  const offW = 2480, offH = 1748;
  const off = document.createElement('canvas');
  off.width = offW; off.height = offH;
  const octx = off.getContext('2d');
  renderForExport(octx, offW, offH, preset);
  const imgData = off.toDataURL('image/jpeg', 0.95);
  try {
    const { jsPDF } = window.jspdf;
    const paperMap = { a3: 'a3', a1: [594, 841], a0: [841, 1189] };
    const fmt = paperMap[paperSize] || 'a3';
    const doc = new jsPDF({ orientation: orient, unit: 'mm', format: fmt });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.addImage(imgData, 'JPEG', 0, 0, pw, ph);
    const presetNames = { construction: '시공팀용', sales: '영업팀용', company: '업체안내용', large: '대형출력용' };
    const _pdfPre = _currentExpo ? _currentExpo.pdfPrefix : 'ExpoMap';
    await _savePDF(doc, _pdfPre + '_' + (presetNames[preset] || preset) + '.pdf');
    closeModal('modalExport');
  } catch (e) {
    alert('PDF export failed: ' + e.message);
  }
}

async function executeAssignGuideExport() {
  state._exporting = true;
  const companyName = document.getElementById('assignGuideCompanyName').value.trim();
  if (!companyName) {
    alert('업체명을 입력해주세요.');
    state._exporting = false;
    return;
  }
  const showNames = document.getElementById('assignShowNames').checked;
  // 언어 선택 적용
  const assignLang = document.querySelector('input[name="assignLang"]:checked')?.value || 'ko';
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
    const dpi = 300, mmToPx = dpi / 25.4;
    const offW = Math.round(agContentW * mmToPx);
    const offH = Math.round(agContentH * mmToPx);
    const off = document.createElement('canvas');
    off.width = offW; off.height = offH;
    const octx = off.getContext('2d');
    if (!octx) throw new Error('캔버스 컨텍스트 생성 실패 (캔버스 크기 초과?)');
    renderForAssignGuideExport(octx, offW, offH, showNames);
    const imgData = off.toDataURL('image/jpeg', 0.95);
    doc.addImage(imgData, 'JPEG', agMargin, agMargin, agContentW, agContentH);
    const now = new Date();
    const dateStr = String(now.getFullYear()).slice(2) +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const langTag = assignLang === 'en' ? '_EN' : '';
    const _pdfPre = _currentExpo ? _currentExpo.pdfPrefix : 'ExpoMap';
    await _savePDF(doc, `${_pdfPre}_Floor Plan_${dateStr}_${companyName}${langTag}.pdf`);
    closeModal('modalAssignGuide');
  } catch (e) {
    alert('PDF 생성 실패: ' + e.message);
  } finally {
    state.lang = prevLang;  // 원래 언어로 복원 (항상 실행)
    state._exporting = false;
  }
}

function renderForExport(ectx, W, H, preset) {
  const booths = state.booths;
  let minX, minY, maxX, maxY;
  if (state.exportRegion) {
    // 수동 지정 영역 사용
    minX = state.exportRegion.x;
    minY = state.exportRegion.y;
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
  const zoom = Math.min(W / sceneW, H / sceneH) * 0.95;
  const panX = (W - sceneW * zoom) / 2 - minX * zoom;
  const panY = (H - sceneH * zoom) / 2 - minY * zoom;
  const isConstruction = preset === 'construction';
  const isCompany = preset === 'company';
  const highlightIds = isCompany ? new Set(state.selectedIds) : null;

  ectx.fillStyle = isConstruction ? '#fff' : '#1a1a2e';
  ectx.fillRect(0, 0, W, H);
  ectx.save();
  ectx.translate(panX, panY);
  ectx.scale(zoom, zoom);

  if (state.bg.img && state.bg.visible && !isConstruction) {
    const rot = (state.bg.rotation || 0) * Math.PI / 180;
    if (rot !== 0) {
      const cx = state.bg.x + state.bg.w / 2;
      const cy = state.bg.y + state.bg.h / 2;
      ectx.save();
      ectx.translate(cx, cy);
      ectx.rotate(rot);
      ectx.globalAlpha = state.bg.opacity;
      ectx.drawImage(state.bg.img, -state.bg.w/2, -state.bg.h/2, state.bg.w, state.bg.h);
      ectx.globalAlpha = 1;
      ectx.restore();
    } else {
      ectx.globalAlpha = state.bg.opacity;
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
      const c = STATUS_COLORS[b.status] || STATUS_COLORS.available;
      fill = c.fill; stroke = c.stroke; textColor = c.text;
    }

    ectx.fillStyle = fill;
    fillBoothShape(ectx, b);
    ectx.strokeStyle = stroke;
    ectx.lineWidth = 1 / zoom;
    strokeBoothShape(ectx, b, zoom);

    drawBoothContent(ectx, b, zoom, textColor, isConstruction);
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
function renderForAssignGuideExport(ectx, W, H, showNames) {
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
    const isFacility = b.status === 'facility' || b.status === 'excluded';
    const fill = isFacility ? '#EFEFEF' : VIEWER_STATUS_COLORS.available.fill;
    const stroke = isFacility ? '#999999' : VIEWER_STATUS_COLORS.available.stroke;
    ectx.fillStyle = fill;
    fillBoothShape(ectx, b);
    ectx.strokeStyle = stroke;
    ectx.lineWidth = 1 / zoom;
    strokeBoothShape(ectx, b, zoom);

    // 업체명/부스번호 항상 표시 (배정 현황 확인용)
    drawBoothContent(ectx, b, zoom, '#111111', false);
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

async function exportFloorplanPDF() {
  state._exporting = true;
  if (state.booths.length === 0) {
    alert('부스가 없습니다.');
    state._exporting = false;
    return;
  }

  // PDF 방향/스케일 결정
  const { jsPDF } = window.jspdf;
  const _bgFill = _currentExpo && _currentExpo.pdfMode === 'bgFill' && state.bg.img;
  // bgFill: BG 이미지 비율로 방향 결정, 아니면 portrait
  const _pdfOrient = _bgFill ? (state.bg.w > state.bg.h ? 'landscape' : 'portrait') : 'portrait';
  const pdf = new jsPDF({ orientation: _pdfOrient, unit: 'mm', format: 'a3' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = _bgFill ? 0 : 10;  // bgFill은 여백 없이 꽉 채움
  const contentWidth = pageWidth - 2 * margin;
  const contentHeight = pageHeight - 2 * margin;

  // 캔버스 생성 및 렌더링
  const canvas = document.createElement('canvas');
  const dpi = 300;
  const mmToPx = dpi / 25.4;
  canvas.width = contentWidth * mmToPx;
  canvas.height = contentHeight * mmToPx;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 도면 범위 계산
  let bounds;
  if (_bgFill) {
    // BG 이미지 영역 기준 — BG가 A3를 꽉 채움
    bounds = { x1: state.bg.x, y1: state.bg.y, x2: state.bg.x + state.bg.w, y2: state.bg.y + state.bg.h };
  } else {
    bounds = state.bounds || { x1: 0, y1: 0, x2: 1200, y2: 800 };
    if (!state.bounds) {
      bounds = { x1: 0, y1: 0, x2: 1200, y2: 800 };
      for (const b of state.booths) {
        bounds.x1 = Math.min(bounds.x1, b.x);
        bounds.y1 = Math.min(bounds.y1, b.y);
        bounds.x2 = Math.max(bounds.x2, b.x + b.w);
        bounds.y2 = Math.max(bounds.y2, b.y + b.h);
      }
      bounds.x1 -= 50;
      bounds.y1 -= 100;
      bounds.x2 += 50;
      bounds.y2 += 50;
    }
  }

  // 도면 렌더링 (모든 부스, 모든 업체명 표시)
  const scaleX = canvas.width / (bounds.x2 - bounds.x1);
  const scaleY = canvas.height / (bounds.y2 - bounds.y1);
  const scale = _bgFill ? Math.min(scaleX, scaleY) : scaleX;
  ctx.save();
  ctx.translate(-bounds.x1 * scale, -bounds.y1 * scale);
  ctx.scale(scale, scale);

  // 배경 렌더링 (항상 opacity 100%)
  if (state.bg.img) {
    ctx.globalAlpha = 1;
    ctx.save();
    if (state.bg.rotation) {
      const cx = state.bg.x + state.bg.w / 2;
      const cy = state.bg.y + state.bg.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(state.bg.rotation * Math.PI / 180);
      ctx.translate(-cx, -cy);
    }
    ctx.drawImage(state.bg.img, state.bg.x, state.bg.y, state.bg.w, state.bg.h);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // 부스 렌더링 — L자 부스 지원, 전시회별 색상
  for (const booth of state.booths) {
    const isFacility = booth.status === 'facility' || booth.status === 'excluded';
    ctx.fillStyle = isFacility ? '#EFEFEF' : VIEWER_STATUS_COLORS.available.fill;
    fillBoothShape(ctx, booth);
    ctx.strokeStyle = isFacility ? '#999999' : VIEWER_STATUS_COLORS.available.stroke;
    ctx.lineWidth = 1 / scale;
    strokeBoothShape(ctx, booth, scale);

    drawBoothContent(ctx, booth, scale, '#111111', false);
  }

  // 기본부스번호 렌더링 (부스에 업체명/부스번호 있으면 숨김)
  for (const bn of state.baseNumbers) {
    if (!bn.baseNo) continue;
    const covering = state.booths.find(b =>
      b.x < bn.x + bn.w && b.x + b.w > bn.x &&
      b.y < bn.y + bn.h && b.y + b.h > bn.y &&
      (b.companyName || b.companyNameEn)
    );
    if (covering) continue;
    ctx.fillStyle = '#333';
    const bnFz = Math.min(bn.w, bn.h) * 0.35;
    ctx.font = `600 ${bnFz}px Pretendard, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bn.baseNo, bn.x + bn.w / 2, bn.y + bn.h / 2);
  }

  // 구조물 렌더링 (부스 위에)
  drawStructures(ctx, scale, false);

  // 실측 레이어 (showMeasure ON 시 PDF에도 반영)
  drawMeasureLayer(ctx, scale);

  ctx.restore();

  // PDF에 이미지 추가
  const imgData = canvas.toDataURL('image/png', 0.95);
  pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);

  const _pdfPre = _currentExpo ? _currentExpo.pdfPrefix : 'ExpoMap';
  const today = new Date();
  const dateStr = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  const langSuffix = state.lang === 'en' ? '_EN' : '';
  await _savePDF(pdf, `${_pdfPre}_Floor Plan_${dateStr}${langSuffix}.pdf`);
  state._exporting = false;
}

async function exportAvailablePDF() {
  state._exporting = true;
  if (state.booths.length === 0) {
    alert('부스가 없습니다.');
    state._exporting = false;
    return;
  }

  const { jsPDF } = window.jspdf;
  const _bgFill2 = _currentExpo && _currentExpo.pdfMode === 'bgFill' && state.bg.img;
  const _pdfOrient2 = _bgFill2 ? (state.bg.w > state.bg.h ? 'landscape' : 'portrait') : 'portrait';
  const pdf = new jsPDF({ orientation: _pdfOrient2, unit: 'mm', format: 'a3' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = _bgFill2 ? 0 : 10;
  const contentWidth = pageWidth - 2 * margin;
  const contentHeight = pageHeight - 2 * margin;

  const canvas = document.createElement('canvas');
  const dpi = 300;
  const mmToPx = dpi / 25.4;
  canvas.width = contentWidth * mmToPx;
  canvas.height = contentHeight * mmToPx;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let bounds;
  if (_bgFill2) {
    bounds = { x1: state.bg.x, y1: state.bg.y, x2: state.bg.x + state.bg.w, y2: state.bg.y + state.bg.h };
  } else {
    bounds = { x1: 0, y1: 0, x2: 1200, y2: 800 };
    for (const b of state.booths) {
      bounds.x1 = Math.min(bounds.x1, b.x);
      bounds.y1 = Math.min(bounds.y1, b.y);
      bounds.x2 = Math.max(bounds.x2, b.x + b.w);
      bounds.y2 = Math.max(bounds.y2, b.y + b.h);
    }
    bounds.x1 -= 50;
    bounds.y1 -= 100;
    bounds.x2 += 50;
    bounds.y2 += 50;
  }

  const scaleX2 = canvas.width / (bounds.x2 - bounds.x1);
  const scaleY2 = canvas.height / (bounds.y2 - bounds.y1);
  const scale = _bgFill2 ? Math.min(scaleX2, scaleY2) : scaleX2;
  ctx.save();
  ctx.translate(-bounds.x1 * scale, -bounds.y1 * scale);
  ctx.scale(scale, scale);

  // 배경 렌더링 (항상 opacity 100%)
  if (state.bg.img) {
    ctx.globalAlpha = 1;
    ctx.save();
    if (state.bg.rotation) {
      const cx = state.bg.x + state.bg.w / 2;
      const cy = state.bg.y + state.bg.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(state.bg.rotation * Math.PI / 180);
      ctx.translate(-cx, -cy);
    }
    ctx.drawImage(state.bg.img, state.bg.x, state.bg.y, state.bg.w, state.bg.h);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // 부스 렌더링 — 배정가능위치(spot)만 노란색, 나머지 전시회별 색상, L자 지원
  for (const booth of state.booths) {
    const isFacility = booth.status === 'facility' || booth.status === 'excluded';
    const isSpot = booth.status === 'spot';
    let fill, stroke;
    if (isFacility) {
      fill = '#EFEFEF'; stroke = '#999999';
    } else if (isSpot) {
      fill = '#FFD600'; stroke = '#F9A825';
    } else {
      fill = VIEWER_STATUS_COLORS.available.fill; stroke = VIEWER_STATUS_COLORS.available.stroke;
    }
    ctx.fillStyle = fill;
    fillBoothShape(ctx, booth);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1 / scale;
    strokeBoothShape(ctx, booth, scale);

    drawBoothContent(ctx, booth, scale, '#111111', false);
  }

  // 기본부스번호 렌더링 (부스에 업체명/부스번호 있으면 숨김)
  for (const bn of state.baseNumbers) {
    if (!bn.baseNo) continue;
    const covering = state.booths.find(b =>
      b.x < bn.x + bn.w && b.x + b.w > bn.x &&
      b.y < bn.y + bn.h && b.y + b.h > bn.y &&
      (b.companyName || b.companyNameEn)
    );
    if (covering) continue;
    ctx.fillStyle = '#333';
    const bnFz = Math.min(bn.w, bn.h) * 0.35;
    ctx.font = `600 ${bnFz}px Pretendard, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bn.baseNo, bn.x + bn.w / 2, bn.y + bn.h / 2);
  }

  // 구조물 렌더링 (부스 위에)
  drawStructures(ctx, scale, false);

  // 실측 레이어 (showMeasure ON 시 PDF에도 반영)
  drawMeasureLayer(ctx, scale);

  ctx.restore();

  const imgData = canvas.toDataURL('image/png', 0.95);
  pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);

  const today = new Date();
  const dateStr = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  const langSuffix = state.lang === 'en' ? '_EN' : '';
  const _pdfPre2 = _currentExpo ? _currentExpo.pdfPrefix : 'ExpoMap';
  await _savePDF(pdf, `${_pdfPre2}_Available Spots_${dateStr}${langSuffix}.pdf`);
  state._exporting = false;
}
