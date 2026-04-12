// ─── Supabase ───
// ─── Supabase 기본 연결 정보 (하드코딩) ───
const DEFAULT_SUPA_URL = 'https://pxlredqyzfffirxbmeuw.supabase.co';
const DEFAULT_SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4bHJlZHF5emZmZmlyeGJtZXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzQ3NzAsImV4cCI6MjA4OTgxMDc3MH0.dHDFT4ORVRH9WLiYjyHls97iHfjT8jzW35UdHz3aOyA';

let _supaClient = null;
let _supaProjectId = 'pxlredqyzfffirxbmeuw';
let _saveTimer = null;

// ─── Presence identity (session-scoped) ───
let _presenceChannel = null;
let _myUserId = null;
let _myName = null;
let _myColor = null;
let _cursorBroadcastTimer = null;

function initSupabase() {
  const url = localStorage.getItem('expomap_supa_url') || DEFAULT_SUPA_URL;
  const key = localStorage.getItem('expomap_supa_key') || DEFAULT_SUPA_KEY;
  // 전시회 URL이 있으면 해당 config의 id 사용, 아니면 localStorage 폴백
  _supaProjectId = _currentExpo ? _currentExpo.id
    : (localStorage.getItem('expomap_supa_project') || 'pxlredqyzfffirxbmeuw');
  if (url && key) {
    try {
      _supaClient = window.supabase.createClient(url, key);
      updateSaveIndicator('saved');
      document.getElementById('supaStatus').textContent = 'Connected';
      return true;
    } catch (e) {
      console.error('Supabase init failed:', e);
      _supaClient = null;
    }
  }
  updateSaveIndicator('offline');
  document.getElementById('supaStatus').textContent = 'Not connected';
  showConnectionAlert('Supabase에 연결되지 않았습니다.\n데이터가 저장되지 않습니다!');
  return false;
}

function saveSupaConfig() {
  const url = document.getElementById('supaUrl').value.trim();
  const key = document.getElementById('supaKey').value.trim();
  const pid = document.getElementById('supaProjectId').value.trim() || 'default';
  if (!url || !key) { alert('URL and Key are required.'); return; }
  localStorage.setItem('expomap_supa_url', url);
  localStorage.setItem('expomap_supa_key', key);
  if (!_currentExpo) localStorage.setItem('expomap_supa_project', pid);
  closeModal('modalSupaConfig');
  if (initSupabase()) {
    loadFromSupabase();
    initPresenceChannel();
  }
}

function scheduleSave() {
  if (!_supaClient) return;
  clearTimeout(_saveTimer);
  updateSaveIndicator('saving');
  _saveTimer = setTimeout(saveToSupabase, 2000);
  if (typeof markVersionDirty === 'function') markVersionDirty();
}

// ─── 5초 폴링 기반 협업 동기화 (Realtime 대체) ───
let _pollTimer = null;
let _lastKnownUpdatedAt = null;
const POLL_INTERVAL_MS = 5000;

function initPresenceIdentity() {
  // 커서 표시용 identity는 유지 (로컬 렌더링에 사용)
  let stored = null;
  try { stored = JSON.parse(sessionStorage.getItem('expomap_presence')); } catch {}
  if (stored && stored.userId && stored.name && stored.color) {
    _myUserId = stored.userId; _myName = stored.name; _myColor = stored.color; return;
  }
  _myUserId = 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const adj = CURSOR_ADJECTIVES[Math.floor(Math.random() * CURSOR_ADJECTIVES.length)];
  const animal = CURSOR_ANIMALS[Math.floor(Math.random() * CURSOR_ANIMALS.length)];
  _myName = adj + ' ' + animal;
  _myColor = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
  try { sessionStorage.setItem('expomap_presence', JSON.stringify({ userId: _myUserId, name: _myName, color: _myColor })); } catch {}
}

function initPresenceChannel() {
  // Realtime 채널 사용 안 함 — 5초 폴링으로 대체
  _presenceChannel = null;
  startSyncPolling();
}

function startSyncPolling() {
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(async () => {
    if (!_supaClient) return;
    try {
      const { data } = await _supaClient
        .from('expomap_state')
        .select('updated_at')
        .eq('id', _supaProjectId)
        .maybeSingle();
      if (!data) return;
      if (_lastKnownUpdatedAt && data.updated_at !== _lastKnownUpdatedAt) {
        // 다른 사람이 저장함 → 리로드
        const prevSelected = new Set(state.selectedIds);
        await loadFromSupabase();
        state.selectedIds = prevSelected;
        render();
      }
      _lastKnownUpdatedAt = data.updated_at;
    } catch { /* 무시 */ }
  }, POLL_INTERVAL_MS);
}

// 커서 브로드캐스트 — 폴링 방식에서는 사용 안 함
function broadcastCursorPosition(wx, wy) { /* no-op */ }
function broadcastCursorLeave() { /* no-op */ }

function pruneStaleRemoteCursors() {
  // 원격 커서 없음
  state.remoteCursors = {};
}

function drawRemoteCursors() {
  const entries = Object.values(state.remoteCursors);
  if (!entries.length) return;

  for (const cursor of entries) {
    const sx = cursor.wx * state.zoom + state.panX;
    const sy = cursor.wy * state.zoom + state.panY;
    const color = cursor.color;

    ctx.save();
    ctx.translate(sx, sy);

    // Triangle cursor
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 14);
    ctx.lineTo(4, 10);
    ctx.lineTo(7, 16);
    ctx.lineTo(9, 15);
    ctx.lineTo(6, 9);
    ctx.lineTo(11, 9);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    // Name tag
    const label = cursor.name;
    ctx.font = '600 11px Pretendard, sans-serif';
    const tw = ctx.measureText(label).width;
    const pad = 4;
    const tagX = 4;
    const tagY = 18;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tw + pad * 2, 18, 4);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, tagX + pad, tagY + 3);

    ctx.restore();
  }
}

