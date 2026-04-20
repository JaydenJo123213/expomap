// ─── Spoqa Han Sans Neo TTF 캐시 (pdf-lib/fontkit 벡터용) ───
// 'Spoqa Han Sans Neo' OTF=CFF2 파싱 오류 → Spoqa Han Sans Neo TTF(TrueType) 로 교체
// 한글+영문+숫자+특수문자 완전 지원, 512KB subset, fontkit 완벽 호환
let _pretendardFontCache = null;

async function _loadSpoqaFontTTF() {
  if (_pretendardFontCache) return _pretendardFontCache;
  const BASE = 'https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@latest/Subset/SpoqaHanSansNeo/';
  const fetchBuf = url => fetch(url).then(r => {
    if (!r.ok) throw new Error(`폰트 로드 실패: ${url} (${r.status})`);
    return r.arrayBuffer();
  });
  const [regular, semibold] = await Promise.all([
    fetchBuf(BASE + 'SpoqaHanSansNeo-Regular.ttf'),
    fetchBuf(BASE + 'SpoqaHanSansNeo-Bold.ttf'),
  ]);
  _pretendardFontCache = { regular, semibold };
  return _pretendardFontCache;
}

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

// pdf-lib 바이트 배열 다운로드 (파일핸들 또는 기본 다운로드)
async function _downloadPdfBytes(pdfBytes, filename, handle) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  if (handle && handle !== 'aborted') {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } else if (handle !== 'aborted') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
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
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const showNames = document.getElementById('assignShowNames').checked;
  const prevLang = state.lang;
  state.lang = assignLang;
  try {
    const _bgFillAG = _currentExpo && _currentExpo.pdfMode === 'bgFill' && state.bg.img;
    const _orientAG = _bgFillAG ? (state.bg.w > state.bg.h ? 'landscape' : 'portrait') : 'portrait';

    // 벡터 PDF 생성 (부스·텍스트·기본부스번호 벡터, 오버레이 래스터)
    const pdfDoc = await _buildPDFLibDocument('assignGuide', {
      orientation: _orientAG,
      showNames,
    });

    const pdfBytes = await pdfDoc.save();
    await _downloadPdfBytes(pdfBytes, _fnameAG, fileHandleAG);
    _showSaveSuccess(_fnameAG);
    closeModal('modalAssignGuide');
  } catch (e) {
    alert('PDF 생성 실패: ' + e.message);
  } finally {
    _hidePdfLoading();
    state.lang = prevLang;
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
    } else if (_currentExpo?.boothColor && b.status !== 'facility') {
      // k-print 등 boothColor가 지정된 전시회: 배정상태 무관, 단일 색상 + 검정 텍스트
      fill = _currentExpo.boothColor; stroke = '#999999'; textColor = '#111111';
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

  // Base numbers
  _drawBaseNumbersCanvas(ectx, booths);

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
    ectx.font = `400 ${bnFz}px 'Spoqa Han Sans Neo', sans-serif`;
    ectx.textAlign = 'center';
    ectx.textBaseline = 'middle';
    ectx.fillText(bn.baseNo, bn.x + bn.w / 2, bn.y + bn.h / 2);
  }

  // 구조물 (부스 위에)
  drawStructures(ectx, zoom, false);

  // 실측 레이어 (showMeasure ON 시 배정안내 PDF에도 반영)
  drawMeasureLayer(ectx, zoom);

  // 배정논의 오버레이
  _drawDiscussOverlaysOnCanvas(ectx, zoom, selectedOverlays);

  ectx.restore();
}

// ─── SVG 문자열 생성 (bg 이미지 포함, 기존 exportSVG()는 수정 없음)
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
      else if (isSpot && !_isUnderDiscussOverlay(b))  { fill = '#FFD600'; stroke = '#F9A825'; }
      else              { fill = VIEWER_STATUS_COLORS.available.fill; stroke = '#000000'; }
    } else {
      fill   = isFacility ? '#EFEFEF' : VIEWER_STATUS_COLORS.available.fill;
      stroke = isFacility ? '#999999' : '#000000';
    }
    if (b.cells && b.cells.length > 1) {
      p.push(_strokeLShapeSVG(b, fill, stroke, 0.5));
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
    p.push(`<text x="${bn.x+bn.w/2}" y="${bn.y+bn.h/2+fz*0.35}" font-family="'Spoqa Han Sans Neo',sans-serif" font-size="${fz}" font-weight="400" fill="#333" text-anchor="middle">${_escXml(bn.baseNo)}</text>`);
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
      p.push(`<text x="${s.x + (s.w||0)/2}" y="${s.y + (s.h||0)/2}" font-family="'Spoqa Han Sans Neo',sans-serif" font-size="${tfz}" font-weight="${s.bold?'700':'400'}" fill="${col}" text-anchor="middle">${_escXml(s.text||'')}</text>`);
    }
    if (s.label) {
      const lx = s.x !== undefined ? s.x : (s.x1+s.x2)/2;
      const ly = (s.y !== undefined ? s.y : (s.y1+s.y2)/2) - 8;
      p.push(`<text x="${lx}" y="${ly}" font-family="'Spoqa Han Sans Neo',sans-serif" font-size="8" fill="${col}" text-anchor="middle">${_escXml(s.label)}</text>`);
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
      pNos.push(`<text x="${tr.x+pad}" y="${tr.y+pad+noFz}" font-family="'Spoqa Han Sans Neo',sans-serif" font-size="${noFz}" font-weight="600" fill="#000000" opacity="0.65">${_escXml(b.boothId)}</text>`);
    };

    const shouldDrawLogo = area >= 36 && hasCompany && b.companyLogoUrl;
    let logoDrawn = false;
    if (shouldDrawLogo) {
      const logoImg = state.logoCache.get(b.id);
      if (logoImg) {
        const logoDataUrl = _imgToDataUrl(logoImg);
        if (logoDataUrl) {
          logoDrawn = true;
          const noReserve = hasBoothNo ? calcFontSize(mc, b.boothId, 26) + 4 : 0;
          const { logoX, logoY, drawW, drawH, textRect } = _calcLogoLayout(b, tr, noReserve, logoImg.naturalWidth, logoImg.naturalHeight);
          pLogos.push(`<image href="${logoDataUrl}" xlink:href="${logoDataUrl}" x="${logoX}" y="${logoY}" width="${drawW}" height="${drawH}" opacity="0.9" preserveAspectRatio="xMidYMid meet"/>`);

          const lines = wrapText(displayName);
          const longestLine = lines.reduce((a,l) => a.length >= l.length ? a : l, '');
          if (textRect.w >= 20 && textRect.h > 0) {
            let fz = fontSizeOverride != null ? Math.max(1.5, Math.min(fontSizeOverride, 60))
              : (() => { let v = calcFontSize(mc, longestLine||'A', textRect.w*0.9); if (textRect.h > 0) v = Math.min(v, (textRect.h/lines.length)/1.25); return Math.max(1.5, Math.min(v, 12)); })();
            const lineH = fz*1.25, blockH = lines.length*lineH;
            const startY = textRect.y + (textRect.h-blockH)/2 + fz*0.5;
            const cx = tr.x+tr.w/2, baseY = startY+fz*0.35;
            const body = lines.length === 1 ? _escXml(lines[0]) : lines.map((l,i) => `<tspan x="${cx}" dy="${i===0?0:lineH}">${_escXml(l)}</tspan>`).join('');
            pNames.push(`<text x="${cx}" y="${baseY}" font-family="'Spoqa Han Sans Neo',sans-serif" font-size="${fz}" font-weight="400" fill="#111111" text-anchor="middle">${body}</text>`);
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
          pNames.push(`<text x="${cx}" y="${baseY}" font-family="'Spoqa Han Sans Neo',sans-serif" font-size="${fz}" font-weight="400" fill="#111111" text-anchor="middle">${body}</text>`);
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

function _showSaveSuccess(filename) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
    background: #fff; color: #111; border-radius: 12px;
    padding: 14px 24px; font-size: 15px; font-weight: 600;
    display: flex; align-items: center; gap: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15); border: 1px solid #e5e7eb;
    z-index: 99999; opacity: 0; transition: opacity 0.25s ease;
    max-width: 90vw; word-break: break-all;
  `;
  const icon = document.createElement('span');
  icon.textContent = '✅';
  icon.style.fontSize = '20px';
  const msg = document.createElement('span');
  msg.textContent = `저장 완료!  ${filename}`;
  toast.appendChild(icon);
  toast.appendChild(msg);
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── 배정안내(discuss) overlay 교차 여부 ───
function _isUnderDiscussOverlay(b) {
  if (!state.discussOverlays || !state.discussOverlays.length) return false;
  return state.discussOverlays.some(ov =>
    b.x < ov.x + ov.w && b.x + b.w > ov.x &&
    b.y < ov.y + ov.h && b.y + b.h > ov.y
  );
}

// ─── 부스 색상 헬퍼 (mode별) ───
function _boothColors(b, mode) {
  const isFacility = b.status === 'facility', isSpot = b.status === 'spot';
  if (mode === 'available') {
    if (isFacility)  return { fill: '#EFEFEF', stroke: '#999999' };
    if (isSpot && !_isUnderDiscussOverlay(b)) return { fill: '#FFD600', stroke: '#F9A825' };
    return { fill: VIEWER_STATUS_COLORS.available.fill, stroke: '#000000' };
  }
  return {
    fill:   isFacility ? '#EFEFEF' : VIEWER_STATUS_COLORS.available.fill,
    stroke: isFacility ? '#999999' : '#000000',
  };
}

// ─── PDF 공통: 기본부스번호 캔버스 렌더 헬퍼 ───
function _drawBaseNumbersCanvas(ctx, booths) {
  for (const bn of state.baseNumbers) {
    if (!bn.baseNo) continue;
    const cov = booths.find(b2 =>
      b2.x < bn.x + bn.w && b2.x + b2.w > bn.x && b2.y < bn.y + bn.h && b2.y + b2.h > bn.y &&
      (b2.companyName || b2.companyNameEn));
    if (cov) continue;
    const fz = Math.min(bn.w, bn.h) * 0.35;
    ctx.fillStyle = '#333';
    ctx.font = `400 ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(bn.baseNo, bn.x + bn.w / 2, bn.y + bn.h / 2);
  }
}

// ─── PDF 공통: 배경 이미지 캔버스 렌더 헬퍼 ───
function _drawBgCanvas(ctx) {
  if (!state.bg.img) return;
  ctx.globalAlpha = 1;
  ctx.save();
  if (state.bg.rotation) {
    const cx = state.bg.x + state.bg.w / 2, cy = state.bg.y + state.bg.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(state.bg.rotation * Math.PI / 180);
    ctx.translate(-cx, -cy);
  }
  ctx.drawImage(state.bg.img, state.bg.x, state.bg.y, state.bg.w, state.bg.h);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ─── pdf-lib: L자 부스 외곽선 ───
// _subtractIntervals는 render.js에 전역 정의됨
function _strokeLShapePdfLib(page, b, toX, toY, pageH, color, lw) {
  const cells = b.cells;
  const EPS = 0.5;
  const toPageY = worldY => pageH - toY(worldY); // pdf-lib y=0은 하단
  for (const c of cells) {
    const r = c.x + c.w, bot = c.y + c.h;
    for (const [edgeY, adjFn] of [
      [c.y,  o => o.y + o.h],
      [bot,  o => o.y],
    ]) {
      const covered = [];
      for (const o of cells) {
        if (o === c) continue;
        if (Math.abs(edgeY - adjFn(o)) < EPS) {
          const ox1 = Math.max(c.x, o.x), ox2 = Math.min(r, o.x + o.w);
          if (ox2 > ox1 + EPS) covered.push([ox1, ox2]);
        }
      }
      for (const [sx1, sx2] of _subtractIntervals(c.x, r, covered))
        page.drawLine({ start: { x: toX(sx1), y: toPageY(edgeY) }, end: { x: toX(sx2), y: toPageY(edgeY) }, color, thickness: lw });
    }
    for (const [edgeX, adjFn] of [
      [c.x,  o => o.x + o.w],
      [r,    o => o.x],
    ]) {
      const covered = [];
      for (const o of cells) {
        if (o === c) continue;
        if (Math.abs(edgeX - adjFn(o)) < EPS) {
          const oy1 = Math.max(c.y, o.y), oy2 = Math.min(bot, o.y + o.h);
          if (oy2 > oy1 + EPS) covered.push([oy1, oy2]);
        }
      }
      for (const [sy1, sy2] of _subtractIntervals(c.y, bot, covered))
        page.drawLine({ start: { x: toX(edgeX), y: toPageY(sy1) }, end: { x: toX(edgeX), y: toPageY(sy2) }, color, thickness: lw });
    }
  }
}

// ─── SVG: L자 부스 외곽선 (내부 셀 경계 제외) ───
function _strokeLShapeSVG(b, fill, stroke, sw) {
  const cells = b.cells;
  const EPS = 0.5;
  const lines = [];
  for (const c of cells) {
    const r = c.x + c.w, bot = c.y + c.h;
    for (const [edgeY, adjFn] of [
      [c.y,  o => o.y + o.h],
      [bot,  o => o.y],
    ]) {
      const covered = [];
      for (const o of cells) {
        if (o === c) continue;
        if (Math.abs(edgeY - adjFn(o)) < EPS) {
          const ox1 = Math.max(c.x, o.x), ox2 = Math.min(r, o.x + o.w);
          if (ox2 > ox1 + EPS) covered.push([ox1, ox2]);
        }
      }
      for (const [sx1, sx2] of _subtractIntervals(c.x, r, covered))
        lines.push(`<line x1="${sx1}" y1="${edgeY}" x2="${sx2}" y2="${edgeY}" stroke="${stroke}" stroke-width="${sw}"/>`);
    }
    for (const [edgeX, adjFn] of [
      [c.x,  o => o.x + o.w],
      [r,    o => o.x],
    ]) {
      const covered = [];
      for (const o of cells) {
        if (o === c) continue;
        if (Math.abs(edgeX - adjFn(o)) < EPS) {
          const oy1 = Math.max(c.y, o.y), oy2 = Math.min(bot, o.y + o.h);
          if (oy2 > oy1 + EPS) covered.push([oy1, oy2]);
        }
      }
      for (const [sy1, sy2] of _subtractIntervals(c.y, bot, covered))
        lines.push(`<line x1="${edgeX}" y1="${sy1}" x2="${edgeX}" y2="${sy2}" stroke="${stroke}" stroke-width="${sw}"/>`);
    }
  }
  const fills = cells.map(c => `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="${fill}" stroke="none"/>`).join('');
  return `<g>${fills}${lines.join('')}</g>`;
}

// ─── pdf-lib: 부스 텍스트 + 번호 벡터 렌더 ───
function _drawBoothTextPdfLib(page, b, fontReg, fontBold, scalePt, toX, toY, pageH, mc) {
  const { rgb } = PDFLib;
  const lang = state.lang;
  const displayName = lang === 'en' ? (b.companyNameEn || '') : (b.companyName || '');
  const fontSizeOverride = lang === 'en' ? (b.fontSizeEn ?? null) : (b.fontSize ?? null);
  const pad = 2;
  const tr = (typeof getTextRect === 'function') ? getTextRect(b) : { x: b.x, y: b.y, w: b.w, h: b.h };
  const availW = tr.w - pad * 2, availH = tr.h - pad * 2;
  const toPageY = worldY => pageH - toY(worldY);
  // world-px → pt
  const toPt = px => px * scalePt;

  const drawNo = (noFz) => {
    if (!b.boothId) return;
    const ptSz = toPt(noFz);
    if (ptSz < 0.5) return;
    const tx = toX(tr.x + pad);
    // canvas textBaseline='top' → baseline ≈ top + 0.80 * fz (Spoqa Han Sans Neo ascender ≈ 0.80)
    const ty = toPageY(tr.y + pad + noFz * 0.80);
    page.drawText(b.boothId, { x: tx, y: ty, size: ptSz, font: fontBold, color: rgb(0,0,0), opacity: 0.65 });
  };

  const drawName = (lines, fz, startY, cx = tr.x + tr.w / 2) => {
    if (!lines.length) return;
    const ptSz = toPt(fz);
    if (ptSz < 0.5) return;
    const lineH = fz * 1.25;
    lines.forEach((line, i) => {
      const tw = fontReg.widthOfTextAtSize(line, ptSz);
      const tx = toX(cx) - tw / 2;
      // canvas textBaseline='middle' → center 기준, pdf-lib은 baseline 기준
      // Spoqa Han Sans Neo: baseline = middle + 0.30 * fz
      // startY는 canvas의 (textAreaTop + (blockH 여백)/2) 로 넘어옴 → center = startY + fz*0.5
      // pdf baseline = center + 0.30*fz = startY + fz*0.80
      const ty = toPageY(startY + i * lineH + fz * 0.80);
      page.drawText(line, { x: tx, y: ty, size: ptSz, font: fontReg, color: rgb(0.067,0.067,0.067) });
    });
  };

  const hasCompany = !!displayName, hasBoothNo = !!b.boothId;
  const area = (b.w / 10) * (b.h / 10);
  const shouldDrawLogo = area >= 36 && hasCompany && b.companyLogoUrl;
  let logoDrawn = false;

  if (shouldDrawLogo) {
    const logoImg = state.logoCache?.get(b.id);
    if (logoImg) {
      const logoDataUrl = _imgToDataUrl(logoImg);
      if (logoDataUrl) {
        logoDrawn = true;
        const noFz = hasBoothNo && mc ? calcFontSize(mc, b.boothId, 26) : 0;
        const noReserve = noFz ? noFz + 4 : 0;
        // 로고 embed는 _buildPDFLibDocument 내부 pdfDoc 참조가 필요해서 여기선 스킵
        const { textRect } = _calcLogoLayout(b, tr, noReserve, logoImg.naturalWidth, logoImg.naturalHeight);
        const lines = typeof wrapText === 'function' ? wrapText(displayName) : [displayName];
        const longestLine = lines.reduce((a, l) => a.length >= l.length ? a : l, '');
        if (textRect.w >= 20 && textRect.h > 0) {
          let fz = fontSizeOverride != null
            ? Math.max(1.5, Math.min(fontSizeOverride, 60))
            : Math.max(1.5, Math.min(mc ? calcFontSize(mc, longestLine || 'A', textRect.w * 0.9) : 8, 12));
          fz = Math.min(fz, (textRect.h / lines.length) / 1.25);
          const lineH = fz * 1.25, blockH = lines.length * lineH;
          const startY = textRect.y + (textRect.h - blockH) / 2 + fz * 0.5;
          const textCX = textRect.x + textRect.w / 2;
          drawName(lines, fz, startY - fz * 0.5, textCX);
        }
        if (hasBoothNo) drawNo(noFz);
      }
    }
  }

  if (!logoDrawn) {
    if (hasCompany) {
      const lines = typeof wrapText === 'function' ? wrapText(displayName) : [displayName];
      const longestLine = lines.reduce((a, l) => a.length >= l.length ? a : l, '');
      const noFz = hasBoothNo && mc ? calcFontSize(mc, b.boothId, 26) : 0;
      const topReserve = noFz ? noFz + 2 : 0;
      const textAreaH = availH - topReserve;
      let fz = fontSizeOverride != null
        ? Math.max(1.5, Math.min(fontSizeOverride, 60))
        : Math.max(1.5, Math.min(mc ? calcFontSize(mc, longestLine || 'A', availW * 0.9) : 10, 16));
      if (textAreaH > 0) fz = Math.min(fz, (textAreaH / lines.length) / 1.25);
      const lineH = fz * 1.25, blockH = lines.length * lineH;
      const startY = tr.y + topReserve + pad + (textAreaH - blockH) / 2;
      drawName(lines, fz, startY);
      if (hasBoothNo) drawNo(noFz);
    } else if (hasBoothNo) {
      drawNo(mc ? calcFontSize(mc, b.boothId, 26) : 8);
    }
  }
}

// ─── pdf-lib: 기본부스번호 벡터 렌더 ───
function _drawBaseNumbersPdfLib(page, booths, fontReg, scalePt, toX, toY, pageH) {
  const { rgb } = PDFLib;
  const toPageY = worldY => pageH - toY(worldY);
  for (const bn of (state.baseNumbers || [])) {
    if (!bn.baseNo) continue;
    const cov = booths.find(b2 =>
      b2.x < bn.x+bn.w && b2.x+b2.w > bn.x && b2.y < bn.y+bn.h && b2.y+b2.h > bn.y &&
      (b2.companyName || b2.companyNameEn));
    if (cov) continue;
    const fz = Math.min(bn.w, bn.h) * 0.35;
    const ptSz = fz * scalePt;
    if (ptSz < 0.5) continue;
    const tw = fontReg.widthOfTextAtSize(bn.baseNo, ptSz);
    page.drawText(bn.baseNo, {
      x: toX(bn.x + bn.w / 2) - tw / 2,
      y: toPageY(bn.y + bn.h / 2) - ptSz * 0.35,
      size: ptSz, font: fontReg, color: rgb(0.2, 0.2, 0.2),
    });
  }
}

// ─── 캔버스 → ArrayBuffer 헬퍼 (toBlob 타임아웃/null 방어) ───
function _canvasToArrayBuffer(canvas, type = 'image/png') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('toBlob 타임아웃')), 15000);
    canvas.toBlob(blob => {
      clearTimeout(timer);
      if (!blob) { reject(new Error('toBlob 결과 null')); return; }
      blob.arrayBuffer().then(resolve).catch(reject);
    }, type);
  });
}

// ─── 배정논의 오버레이 캔버스 드로잉 (world좌표 transform 적용된 ctx) ───
function _drawDiscussOverlaysOnCanvas(ctx, zoom, overlays) {
  // 오버레이 채우기 + 테두리 + 라벨
  overlays.forEach(ov => {
    ctx.fillStyle = '#FFC700';
    ctx.fillRect(ov.x, ov.y, ov.w, ov.h);
    ctx.strokeStyle = '#CC9900';
    ctx.lineWidth = 2.5 / zoom;
    ctx.setLineDash([]);
    ctx.strokeRect(ov.x, ov.y, ov.w, ov.h);
    if (ov.label) {
      const fz = Math.max(10 / zoom, 8);
      ctx.font = `600 ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = ov.label.split('</br>').map(s => s.trim());
      const lineH = fz * 1.3;
      const startY = ov.y + ov.h / 2 - (lines.length - 1) * lineH / 2;
      lines.forEach((line, i) => ctx.fillText(line, ov.x + ov.w / 2, startY + i * lineH));
    }
  });

  // 2개 이상: 노란 점선 연결 + 중심원
  if (overlays.length >= 2) {
    const cx = overlays.reduce((s, ov) => s + ov.x + ov.w / 2, 0) / overlays.length;
    const cy = overlays.reduce((s, ov) => s + ov.y + ov.h / 2, 0) / overlays.length;
    ctx.strokeStyle = 'rgba(255,214,0,0.8)';
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([5 / zoom, 4 / zoom]);
    overlays.forEach(ov => {
      ctx.beginPath();
      ctx.moveTo(ov.x + ov.w / 2, ov.y + ov.h / 2);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.fillStyle = '#FFD600';
    ctx.beginPath();
    ctx.arc(cx, cy, 5 / zoom, 0, Math.PI * 2);
    ctx.fill();
  }

  // 빨간 화살표 + 부스 수
  if (overlays.length > 0) {
    ctx.strokeStyle = '#E53935';
    ctx.fillStyle = '#E53935';
    ctx.lineWidth = 5.2 / zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    overlays.forEach(ov => {
      const arrowX = ov.x + ov.w / 2;
      const arrowStartY = ov.y - GRID_PX * 1.2;
      const arrowEndY   = ov.y - GRID_PX * 0.3;
      const arrowHeadSize = GRID_PX * 0.75;
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowStartY);
      ctx.lineTo(arrowX, arrowEndY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowEndY);
      ctx.lineTo(arrowX - arrowHeadSize * 0.6, arrowEndY - arrowHeadSize * 0.8);
      ctx.lineTo(arrowX + arrowHeadSize * 0.6, arrowEndY - arrowHeadSize * 0.8);
      ctx.closePath();
      ctx.fill();
      const boothCount = Math.floor((ov.w / GRID_PX) * (ov.h / GRID_PX) * 2) / 2;
      if (boothCount >= 1) {
        const boothText = boothCount % 1 === 0 ? String(boothCount) : boothCount.toFixed(1);
        const boothFontSize = Math.max(15 / zoom, 12);
        ctx.font = `600 ${boothFontSize}px 'Spoqa Han Sans Neo', sans-serif`;
        ctx.fillStyle = '#E53935';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${boothText} Booth`, arrowX, arrowStartY - 2 / zoom);
      }
    });
  }
}

// ─── pdf-lib: 메인 PDF 빌더 (벡터 부스+텍스트, 래스터 bg+구조물) ───
async function _buildPDFLibDocument(mode, options = {}) {
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const { PDFDocument, rgb } = PDFLib;
  const MM_TO_PT = 72 / 25.4;
  const booths = state.booths;
  const _bgFill = _currentExpo && _currentExpo.pdfMode === 'bgFill' && state.bg.img;
  const _boothColorOverride = _currentExpo?.boothColor || null; // k-print 등

  // 페이지 크기 결정
  let pgWmm, pgHmm;
  if (options.pageSize === 'custom') {
    pgWmm = options.customW || 420; pgHmm = options.customH || 297;
    if (options.orientation === 'portrait' && pgWmm > pgHmm) [pgWmm, pgHmm] = [pgHmm, pgWmm];
    if (options.orientation === 'landscape' && pgHmm > pgWmm) [pgWmm, pgHmm] = [pgHmm, pgWmm];
  } else {
    pgWmm = options.orientation === 'landscape' ? 420 : 297;
    pgHmm = options.orientation === 'landscape' ? 297 : 420;
  }
  const pgWpt = pgWmm * MM_TO_PT, pgHpt = pgHmm * MM_TO_PT;

  // Bounds 계산
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
  const scaleX = pgWpt / vw, scaleY = pgHpt / vh;
  const scalePt = _bgFill ? Math.min(scaleX, scaleY) : scaleX;
  const offX = _bgFill ? (pgWpt - vw * scalePt) / 2 : 0;
  const offY = _bgFill ? (pgHpt - vh * scalePt) / 2 : 0;

  const toX     = wx => offX + (wx - bounds.x1) * scalePt;
  const toY     = wy => offY + (wy - bounds.y1) * scalePt;
  const toPageY = wy => pgHpt - toY(wy);
  const toS     = px => px * scalePt;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // ── Spoqa Han Sans Neo TTF 임베딩 (벡터 텍스트) ──
  let fontRegEmbed = null, fontBoldEmbed = null;
  try {
    const fontBufs = await _loadSpoqaFontTTF();
    fontRegEmbed  = await pdfDoc.embedFont(fontBufs.regular);
    fontBoldEmbed = await pdfDoc.embedFont(fontBufs.semibold);
  } catch(e) {
    console.warn('폰트 임베딩 실패, 캔버스 래스터로 대체:', e.message);
  }

  const page = pdfDoc.addPage([pgWpt, pgHpt]);
  page.drawRectangle({ x: 0, y: 0, width: pgWpt, height: pgHpt, color: rgb(1,1,1) });

  // Layer 1: 배경 이미지 → 캔버스로 렌더 (state.bg.img 직접 사용)
  if (state.bg.img) {
    try {
      const DPI = 200, mmToPx = DPI / 25.4;
      const bc = document.createElement('canvas');
      bc.width = Math.round(pgWmm * mmToPx); bc.height = Math.round(pgHmm * mmToPx);
      const bctx = bc.getContext('2d');
      const wScale = scalePt * mmToPx / MM_TO_PT;
      bctx.save();
      bctx.translate(offX * mmToPx / MM_TO_PT - bounds.x1 * wScale,
                     offY * mmToPx / MM_TO_PT - bounds.y1 * wScale);
      bctx.scale(wScale, wScale);
      _drawBgCanvas(bctx);
      bctx.restore();
      const bgPng = await _canvasToArrayBuffer(bc);
      const bgImg = await pdfDoc.embedPng(bgPng);
      page.drawImage(bgImg, { x: 0, y: 0, width: pgWpt, height: pgHpt });
    } catch(e) { console.warn('bg 레이어 실패:', e.message); }
  }

  // Layer 2: 부스 fill/stroke 벡터
  const hexToRgb = h => {
    const r = parseInt(h.slice(1,3),16)/255, g = parseInt(h.slice(3,5),16)/255, b = parseInt(h.slice(5,7),16)/255;
    return rgb(r, g, b);
  };
  const lw = Math.max(0.3, 0.5 * scalePt / MM_TO_PT);
  for (const b of booths) {
    const isFacility = b.status === 'facility';
    let fillHex, strokeHex;
    const isSpotBooth = b.status === 'spot';
    const isYellowSpot = mode === 'available' && isSpotBooth && !_isUnderDiscussOverlay(b);
    if (_boothColorOverride && !isFacility && !isYellowSpot) {
      // k-print 등 boothColor 지정 전시회: 단일 색상 적용
      // 단, available 모드에서 overlay 밖 spot 부스는 노란색 우선
      // overlay 아래 spot 부스는 expo 기본색으로 표시
      fillHex = _boothColorOverride; strokeHex = '#999999';
    } else {
      const r = _boothColors(b, mode);
      fillHex = r.fill; strokeHex = r.stroke;
    }
    const fillC = hexToRgb(fillHex), strokeC = hexToRgb(strokeHex);
    if (b.cells && b.cells.length > 1) {
      for (const c of b.cells) {
        page.drawRectangle({ x: toX(c.x), y: toPageY(c.y + c.h), width: toS(c.w), height: toS(c.h), color: fillC, borderWidth: 0 });
      }
      _strokeLShapePdfLib(page, b, toX, toY, pgHpt, strokeC, lw);
    } else {
      page.drawRectangle({ x: toX(b.x), y: toPageY(b.y + b.h), width: toS(b.w), height: toS(b.h), color: fillC, borderColor: strokeC, borderWidth: lw });
    }
  }

  // Layer 2.5: assignGuide 모드 — spot 부스 노란 반투명 오버레이 (부스번호 가독성)
  if (mode === 'assignGuide') {
    const { rgb: rgb2 } = PDFLib;
    for (const b of booths) {
      if (b.status !== 'spot') continue;
      if (b.cells && b.cells.length > 1) {
        for (const cell of b.cells) {
          page.drawRectangle({ x: toX(cell.x), y: toPageY(cell.y + cell.h), width: toS(cell.w), height: toS(cell.h), color: rgb2(1, 0.86, 0), opacity: 0.45 });
        }
      } else {
        page.drawRectangle({ x: toX(b.x), y: toPageY(b.y + b.h), width: toS(b.w), height: toS(b.h), color: rgb2(1, 0.86, 0), opacity: 0.45 });
      }
    }
  }

  // Layer 3: 텍스트 + 로고 — 벡터(폰트 임베딩 성공) / 래스터 폴백
  // assignGuide 모드에서 showNames=false 이면 텍스트 레이어 전체 스킵 (빈 부스만 출력)
  const showText = mode !== 'assignGuide' || options.showNames !== false;
  if (fontRegEmbed && fontBoldEmbed) {
    if (showText) {
      // 벡터 텍스트 (Spoqa Han Sans Neo TTF 임베딩)
      const mc = document.createElement('canvas').getContext('2d');

      // 로고 먼저 (텍스트가 로고 위에 그려지도록 — 간격 좁혀 겹칠 때 텍스트가 위에 와야 함)
      for (const b of booths) {
        const area = (b.w / 10) * (b.h / 10);
        if (area < 36 || !b.companyLogoUrl || !b.companyName) continue;
        const logoImg = state.logoCache?.get(b.id);
        if (!logoImg) continue;
        try {
          const logoDataUrl = _imgToDataUrl(logoImg);
          if (!logoDataUrl) continue;
          const tr = (typeof getTextRect === 'function') ? getTextRect(b) : { x: b.x, y: b.y, w: b.w, h: b.h };
          const noFz = b.boothId ? calcFontSize(mc, b.boothId, 26) : 0;
          const noReserve = noFz ? noFz + 4 : 0;
          const { logoX, logoY, drawW, drawH } = _calcLogoLayout(b, tr, noReserve, logoImg.naturalWidth, logoImg.naturalHeight);
          const b64 = logoDataUrl.split(',')[1];
          const binStr = atob(b64);
          const imgBytes = new Uint8Array(binStr.length);
          for (let j = 0; j < binStr.length; j++) imgBytes[j] = binStr.charCodeAt(j);
          const isJpeg = logoDataUrl.startsWith('data:image/jpeg') || logoDataUrl.startsWith('data:image/jpg');
          const embImg = isJpeg ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);
          page.drawImage(embImg, {
            x: toX(logoX),
            y: toPageY(logoY + drawH),
            width: toS(drawW),
            height: toS(drawH),
            opacity: 0.9,
          });
        } catch(e) { console.warn('로고 임베딩 실패:', b.id, e.message); }
      }

      // 텍스트는 로고 위에 (로고와 겹칠 때 텍스트가 보여야 함)
      for (const b of booths) _drawBoothTextPdfLib(page, b, fontRegEmbed, fontBoldEmbed, scalePt, toX, toY, pgHpt, mc);
      _drawBaseNumbersPdfLib(page, booths, fontRegEmbed, scalePt, toX, toY, pgHpt);
    } // if (showText) 벡터 경로 끝
  } else {
    // 래스터 텍스트 폴백
    if (showText) {
      try {
        const DPI = 200, mmToPx = DPI / 25.4;
        const tc = document.createElement('canvas');
        tc.width = Math.round(pgWmm * mmToPx); tc.height = Math.round(pgHmm * mmToPx);
        const tctx = tc.getContext('2d');
        const wScale = scalePt * mmToPx / MM_TO_PT;
        tctx.clearRect(0, 0, tc.width, tc.height);
        tctx.save();
        tctx.translate(offX * mmToPx / MM_TO_PT - bounds.x1 * wScale,
                       offY * mmToPx / MM_TO_PT - bounds.y1 * wScale);
        tctx.scale(wScale, wScale);
        // assignGuide 래스터 폴백: spot 부스 노란 오버레이
        if (mode === 'assignGuide') {
          tctx.fillStyle = 'rgba(255, 220, 0, 0.45)';
          for (const b of booths) {
            if (b.status !== 'spot') continue;
            if (b.cells && b.cells.length > 1) { b.cells.forEach(cell => tctx.fillRect(cell.x, cell.y, cell.w, cell.h)); }
            else { tctx.fillRect(b.x, b.y, b.w, b.h); }
          }
        }
        const textColor = _boothColorOverride ? '#111111' : null;
        for (const b of booths) {
          const tc2 = textColor || (_boothColors(b, mode).text || '#111111');
          drawBoothContent(tctx, b, wScale, tc2, false);
        }
        _drawBaseNumbersCanvas(tctx, booths);
        tctx.restore();
        const tPng = await _canvasToArrayBuffer(tc);
        const tImg = await pdfDoc.embedPng(tPng);
        page.drawImage(tImg, { x: 0, y: 0, width: pgWpt, height: pgHpt });
      } catch(e) { console.warn('텍스트 레이어 실패:', e.message); }
    } // if (showText) 래스터 폴백 끝
  }

  // Layer 4: 구조물 + 실측 → 투명 캔버스
  try {
    const DPI = 200, mmToPx = DPI / 25.4;
    const oc = document.createElement('canvas');
    oc.width = Math.round(pgWmm * mmToPx); oc.height = Math.round(pgHmm * mmToPx);
    const ctx = oc.getContext('2d');
    if (ctx) {
      const wScale = scalePt * mmToPx / MM_TO_PT;
      ctx.clearRect(0, 0, oc.width, oc.height);
      ctx.save();
      ctx.translate(offX * mmToPx / MM_TO_PT - bounds.x1 * wScale,
                    offY * mmToPx / MM_TO_PT - bounds.y1 * wScale);
      ctx.scale(wScale, wScale);
      if (typeof drawStructures === 'function') drawStructures(ctx, wScale, false);
      if (typeof drawMeasureLayer === 'function') drawMeasureLayer(ctx, wScale);
      ctx.restore();
      const sPng = await _canvasToArrayBuffer(oc);
      const sImg = await pdfDoc.embedPng(sPng);
      page.drawImage(sImg, { x: 0, y: 0, width: pgWpt, height: pgHpt });
    }
  } catch(e) { console.warn('구조물 레이어 실패:', e.message); }

  // Layer 5: 배정논의 오버레이 (assignGuide 모드 전용, 벡터)
  if (mode === 'assignGuide') {
    const selectedOverlays = (state.discussOverlays || []).filter(
      ov => state.selectedDiscussIds && state.selectedDiscussIds.has(ov.id));
    if (selectedOverlays.length > 0) {
      const { rgb } = PDFLib;
      const yellowFill   = rgb(1, 0.780, 0);        // #FFC700
      const yellowBorder = rgb(0.8, 0.6, 0);         // #CC9900
      const yellowLine   = rgb(1, 0.843, 0);         // #FFD600
      const redColor     = rgb(0.898, 0.224, 0.208); // #E53935
      const blackColor   = rgb(0, 0, 0);

      // ① 오버레이 박스 + 라벨
      for (const ov of selectedOverlays) {
        page.drawRectangle({
          x: toX(ov.x), y: toPageY(ov.y + ov.h),
          width: toS(ov.w), height: toS(ov.h),
          color: yellowFill, borderColor: yellowBorder,
          borderWidth: Math.max(0.5, toS(2.5)),
        });
        if (ov.label && fontBoldEmbed) {
          const lines = ov.label.split('</br>').map(s => s.trim()).filter(Boolean);
          const fz = Math.max(toS(8), 5);
          const lineH = fz * 1.3;
          const cx = toX(ov.x + ov.w / 2);
          const startY = toPageY(ov.y + ov.h / 2) + (lines.length - 1) * lineH / 2;
          lines.forEach((line, i) => {
            const tw = fontBoldEmbed.widthOfTextAtSize(line, fz);
            page.drawText(line, { x: cx - tw / 2, y: startY - i * lineH, size: fz, font: fontBoldEmbed, color: blackColor });
          });
        }
      }

      // ② 연결선 + 중심원 (2개 이상)
      if (selectedOverlays.length >= 2) {
        const cx = selectedOverlays.reduce((s, ov) => s + ov.x + ov.w / 2, 0) / selectedOverlays.length;
        const cy = selectedOverlays.reduce((s, ov) => s + ov.y + ov.h / 2, 0) / selectedOverlays.length;
        for (const ov of selectedOverlays) {
          page.drawLine({
            start: { x: toX(ov.x + ov.w / 2), y: toPageY(ov.y + ov.h / 2) },
            end:   { x: toX(cx), y: toPageY(cy) },
            thickness: Math.max(0.4, toS(1.5)), color: yellowLine,
          });
        }
        page.drawEllipse({
          x: toX(cx), y: toPageY(cy),
          xScale: Math.max(1.5, toS(5)), yScale: Math.max(1.5, toS(5)),
          color: yellowLine,
        });
      }

      // ③ 빨간 화살표 + 부스 수 텍스트
      const arrowLw = Math.max(0.8, toS(5.2));
      for (const ov of selectedOverlays) {
        const arrowX      = ov.x + ov.w / 2;
        const arrowStartY = ov.y - GRID_PX * 1.2;
        const arrowEndY   = ov.y - GRID_PX * 0.3;
        const headSize    = GRID_PX * 0.75;
        const headHalf    = toS(headSize * 0.6);
        const tipX  = toX(arrowX);
        const tipY  = toPageY(arrowEndY);
        const baseY = toPageY(arrowEndY - headSize * 0.8);

        // 줄기
        page.drawLine({ start: { x: tipX, y: toPageY(arrowStartY) }, end: { x: tipX, y: tipY }, thickness: arrowLw, color: redColor });
        // 화살촉 (V자 두 선)
        page.drawLine({ start: { x: tipX, y: tipY }, end: { x: tipX - headHalf, y: baseY }, thickness: arrowLw, color: redColor });
        page.drawLine({ start: { x: tipX, y: tipY }, end: { x: tipX + headHalf, y: baseY }, thickness: arrowLw, color: redColor });

        // 부스 수 텍스트
        const boothCount = Math.floor((ov.w / GRID_PX) * (ov.h / GRID_PX) * 2) / 2;
        if (boothCount >= 1 && fontBoldEmbed) {
          const boothText = `${boothCount % 1 === 0 ? String(boothCount) : boothCount.toFixed(1)} Booth`;
          const fz = Math.max(toS(12), 7);
          const tw = fontBoldEmbed.widthOfTextAtSize(boothText, fz);
          page.drawText(boothText, {
            x: tipX - tw / 2, y: toPageY(arrowStartY) + fz * 0.2,
            size: fz, font: fontBoldEmbed, color: redColor,
          });
        }
      }
    }
  }

  return pdfDoc;
}

// ─── Public Export 함수 ───
async function exportFloorplanPDF(options = {}) {
  if (state.booths.length === 0) { alert('부스가 없습니다.'); return; }
  const mode = options.mode || 'floorplan';
  const _pdfPre = _currentExpo ? _currentExpo.pdfPrefix : 'ExpoMap';
  const d = new Date();
  const _date = String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  const _lang = state.lang === 'en' ? '_EN' : '';
  const _suffix = mode === 'available' ? '_Available' : '';
  const _fname = `${_pdfPre}_Floor Plan_${_date}${_suffix}${_lang}.pdf`;
  const fileHandle = await _pickSaveHandle(_fname);
  if (fileHandle === 'aborted') return;

  state._exporting = true;
  const loadingMsg = mode === 'available' ? '📍 배정가능위치 PDF 생성 중...' : '🖨️ 도면출력 PDF 생성 중...';
  _showPdfLoading(loadingMsg);
  try {
    const pdfDoc = await _buildPDFLibDocument(mode, options);
    const pdfBytes = await pdfDoc.save();
    await _downloadPdfBytes(pdfBytes, _fname, fileHandle);
    _showSaveSuccess(_fname);
  } catch (e) {
    alert('PDF 생성 실패: ' + e.message);
    console.error(e);
  } finally {
    _hidePdfLoading();
    state._exporting = false;
  }
}

// ─── SVG 대형출력 Export ───

function _escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// render.js 와 동일한 로고 레이아웃 계산 (모든 PDF 렌더러에서 공용)
function _calcLogoLayout(b, tr, noReserve, imgW, imgH) {
  const scale    = (b.logoScale    ?? 100) / 100;
  const pos      =  b.logoPosition ?? 'top';
  const offsetX  = (b.logoOffsetX  ?? 0) * tr.w / 100;
  const offsetY  = (b.logoOffsetY  ?? 0) * tr.h / 100;

  const baseSide = Math.min(tr.w, tr.h - noReserve);
  const imgAspect = (imgW || 1) / (imgH || 1);
  let drawW, drawH;
  if (imgAspect >= 1) { drawW = baseSide * scale; drawH = drawW / imgAspect; }
  else                { drawH = baseSide * scale; drawW = drawH * imgAspect; }

  const defOX = pos === 'left' ? -tr.w * 0.18 : pos === 'right' ? tr.w * 0.18 : 0;
  const defOY = pos === 'top'  ? -tr.h * 0.15 : pos === 'bottom' ? tr.h * 0.15 : 0;
  const logoCX = tr.x + tr.w / 2 + defOX + offsetX;
  const logoCY = tr.y + noReserve + (tr.h - noReserve) / 2 + defOY + offsetY;
  const logoX  = logoCX - drawW / 2;
  const logoY  = logoCY - drawH / 2;

  const gapH = (b.logoGap ?? 5) * tr.h / 100;
  const gapW = (b.logoGap ?? 5) * tr.w / 100;
  let textRect;
  if (pos === 'top') {
    const textY = logoCY + drawH / 2 + gapH;
    textRect = { x: tr.x, y: textY, w: tr.w, h: Math.max(0, tr.y + tr.h - textY - tr.h * 0.02) };
  } else if (pos === 'bottom') {
    const textBottom = logoCY - drawH / 2 - gapH;
    const textTop = tr.y + noReserve + tr.h * 0.02;
    textRect = { x: tr.x, y: textTop, w: tr.w, h: Math.max(0, textBottom - textTop) };
  } else if (pos === 'left') {
    const textX = logoCX + drawW / 2 + gapW;
    textRect = { x: textX, y: tr.y + noReserve, w: Math.max(0, tr.x + tr.w - textX - tr.w * 0.02), h: tr.h - noReserve };
  } else {
    const textRight = logoCX - drawW / 2 - gapW;
    const textLeft  = tr.x + tr.w * 0.02;
    textRect = { x: textLeft, y: tr.y + noReserve, w: Math.max(0, textRight - textLeft), h: tr.h - noReserve };
  }
  return { logoX, logoY, logoCX, logoCY, drawW, drawH, textRect };
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
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false; // 사용자 취소
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  return true;
}

async function exportSVG(lang = 'ko') {
  state._exporting = true;
  _showPdfLoading('🖋️ 벡터 SVG 생성 중...');
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
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
        p.push(_strokeLShapeSVG(b, fill, '#000000', 0.5));
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
      p.push(`<text x="${bn.x + bn.w/2}" y="${bn.y + bn.h/2 + fz * 0.35}" font-family="'Spoqa Han Sans Neo',sans-serif" font-size="${fz}" font-weight="400" fill="#333" text-anchor="middle">${_escXml(bn.baseNo)}</text>`);
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
        p.push(`<text x="${lx}" y="${ly}" font-family="'Spoqa Han Sans Neo',sans-serif" font-size="8" fill="${col}" text-anchor="middle">${_escXml(s.label)}</text>`);
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
        pNos.push(`<text x="${tr.x + pad}" y="${tr.y + pad + noFz}" font-family="'Spoqa Han Sans Neo',sans-serif" font-size="${noFz}" font-weight="600" fill="#000000" opacity="0.65">${_escXml(b.boothId)}</text>`);
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
            const noReserve = hasBoothNo ? calcFontSize(mc, b.boothId, 26) + 4 : 0;
            const { logoX, logoY, drawW, drawH, textRect } = _calcLogoLayout(b, tr, noReserve, logoImg.naturalWidth, logoImg.naturalHeight);
            pLogos.push(`<image xlink:href="${logoDataUrl}" x="${logoX}" y="${logoY}" width="${drawW}" height="${drawH}" opacity="0.9" preserveAspectRatio="xMidYMid meet"/>`);

            const lines = wrapText(displayName);
            const longestLine = lines.reduce((a, l) => a.length >= l.length ? a : l, '');
            if (textRect.w >= 20 && textRect.h > 0) {
              let fz = calcFontSize(mc, longestLine || 'A', textRect.w * 0.9);
              if (textRect.h > 0) fz = Math.min(fz, (textRect.h / lines.length) / 1.25);
              fz = Math.max(1.5, Math.min(fz, 12));
              const lineH = fz * 1.25, blockH = lines.length * lineH;
              const startY = textRect.y + (textRect.h - blockH) / 2 + fz * 0.5;
              const cx = tr.x + tr.w / 2, baseY = startY + fz * 0.35;
              const body = lines.length === 1
                ? _escXml(lines[0])
                : lines.map((l, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : lineH}">${_escXml(l)}</tspan>`).join('');
              pNames.push(`<text x="${cx}" y="${baseY}" font-family="'Spoqa Han Sans Neo',sans-serif" font-size="${fz}" font-weight="400" fill="#111111" text-anchor="middle">${body}</text>`);
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
            pNames.push(`<text x="${cx}" y="${baseY}" font-family="'Spoqa Han Sans Neo',sans-serif" font-size="${fz}" font-weight="400" fill="#111111" text-anchor="middle">${body}</text>`);
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
    const _svgFname = `${_pdfPre}_Floor Plan_${dateStr}_Vector${_langSuffix}.svg`;
    const saved = await _saveSVG(p.join('\n'), _svgFname);
    if (saved) _showSaveSuccess(_svgFname);
  } catch (e) {
    alert('SVG 생성 실패: ' + e.message);
  } finally {
    _hidePdfLoading();
    state._exporting = false;
  }
}
