(function () {
  'use strict';

  /* ---------- 저장 키 (설정·보관함·추가 이력은 기존 도구와 공유) ---------- */
  var SKEY0 = 'jangan-monthly-report-settings-v1', LKEY0 = 'jangan-monthly-report-library-v1', HEXTRA0 = 'jangan-monthly-report-history-extra-v1';
  var DEPT_KEY = 'jangan-monthly-report-easy-dept-v1';
  var DEF_DEPT = '장안구민회관';   /* 기존 도구 자료와 이어지는 기본 부서 */
  /* 2026년 9~11월 월간업무보고에 실제로 실린 부서 이름. 목록에 없으면 직접 입력할 수 있습니다. */
  var DEPTS_DEFAULT = ['안전감사실', '홍보마케팅실', '기획처', '경영지원처', '사업기획처', '도시개발처', '도시정비처', '주차사업처', '교통약자지원센터', '교통시설사업처', '연화장', '자원순환센터', '장안구민회관', '종합운동장', '체육시설사업처', '가족여성회관', '장기요양지원센터'];
  var DEPT = DEF_DEPT, DEPTCFG = { cur: null, custom: [] }, EMBEDS = [];
  function dk(b) { return DEPT === DEF_DEPT ? b : b + ':' + DEPT; }   /* 부서마다 저장 칸을 따로 씀 */
  function sK() { return dk(SKEY0); } function lK() { return dk(LKEY0); } function hK() { return dk(HEXTRA0); }
  var STAFF_KEY = 'jangan-monthly-report-easy-staff-v1', LEAD_KEY = 'jangan-monthly-report-easy-lead-v1', TOUR_KEY = 'jangan-monthly-report-easy-tour-v1';
  var SET, LIB, HIST = [], HIST_READY = false, EMBED = null;
  var STAFF, LEAD;            /* 저장소 전체 */
  var S = null, L = null;     /* 지금 작성 중인 직원 작업 / 팀장 작업 */
  var UI = { view: 'start', step: 1, showOthers: false, settingsFrom: 'start' };
  var RE_Q = /인원|참여|실적|건수|횟수|만족도|결과|매출|수입|이용/;
  var STEP_NAMES = ['보고월·파트', '지난달 결과', '이번 달 계획', '확인·제출'];

  var $ = function (id) { return document.getElementById(id); };
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 3200); }
  function loadKey(k, def) { try { var r = localStorage.getItem(k); if (r) return JSON.parse(r); } catch (e) {} return def; }
  var storageOk = true;
  function saveKey(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); storageOk = true; } catch (e) { storageOk = false; } showSaved(); }
  function showSaved() {
    var el = $('saveState');
    if (!storageOk) { el.textContent = '자동 저장 안 됨 — 제출 파일로 보관하세요'; el.className = 'savestate bad'; return; }
    el.textContent = '자동 저장됨 · ' + new Date().toTimeString().slice(0, 5); el.className = 'savestate';
  }
  function norm(l) { return String(l || '').replace(/\s+/g, ''); }
  function hk(y, m) { return y + '-' + m; }
  function ymText(y, m) { return y + '년 ' + m + '월호'; }
  function cmpYM(a, b) { return (a.y * 12 + a.m) - (b.y * 12 + b.m); }
  function nextYM(y, m) { return m === 12 ? { y: y + 1, m: 1 } : { y: y, m: m + 1 }; }

  /* ---------- 설정 ---------- */
  function defaultSettings() {
    return {
      parts: DEPT === DEF_DEPT ? MR.PARTS.slice() : ['전체'],
      dateWords: ['일시', '기간', '일자', '일정', '날짜', '기한'],
      fields: [
        { label: '운영일시', values: [] }, { label: '운영기간', values: [] },
        { label: '운영장소', values: DEPT === DEF_DEPT ? ['장안구민회관 한누리아트홀', '장안구민회관 노송갤러리', '구민회관 2층 회의실', '장안구민회관 3층 헬스장', '푸르내수영장', '능실종합사회복지관'] : [] },
        { label: '운영대상', values: DEPT === DEF_DEPT ? ['수강생', '지역 어르신', '시민', '강사'] : ['시민', '직원'] },
        { label: '참여인원', values: [] }, { label: '운영내용', values: [] }, { label: '추진목적', values: [] }, { label: '추진일정', values: [] },
        { label: '회의일시', values: [] }, { label: '회의장소', values: DEPT === DEF_DEPT ? ['구민회관 2층 회의실'] : [] }, { label: '참석대상', values: [] },
        { label: '주요내용', values: [] }, { label: '모집기간', values: [] }, { label: '모집대상', values: [] }, { label: '소요예산', values: [] },
        { label: '기대효과', values: [] }, { label: '향후계획', values: [] }
      ]
    };
  }
  function saveSet() { saveKey(sK(), SET); buildDatalists(); }
  function saveLib() { saveKey(lK(), LIB); }
  function isDateLabel(t) { var n = norm(t); return !!n && SET.dateWords.some(function (w) { return w && n.indexOf(norm(w)) >= 0; }); }
  /* '장소'처럼 짧은 이름이면 '운영장소', '회의장소'의 자주 쓰는 값을 함께 보여 줌 */
  function valuesFor(label) {
    var n = norm(label); if (!n) return [];
    var out = [];
    SET.fields.forEach(function (f) {
      var fl = norm(f.label);
      if (fl === n || (n.length >= 2 && fl.slice(-n.length) === n)) f.values.forEach(function (v) { if (out.indexOf(v) < 0) out.push(v); });
    });
    return out;
  }
  function buildDatalists() {
    var dl = $('dlLabels'); dl.innerHTML = '';
    ['일정', '장소', '대상', '주요내용'].concat(SET.fields.map(function (f) { return f.label; })).forEach(function (l) { dl.appendChild(h('option', { value: l })); });
  }
  var dlSeq = 0;
  function attachList(input, label) {
    var vals = valuesFor(label);
    var old = input.getAttribute('list'); if (old) { var o = $(old); if (o) o.remove(); input.removeAttribute('list'); }
    if (!vals.length) return;
    var id = 'dlv' + (++dlSeq), d = h('datalist', { id: id });
    vals.forEach(function (v) { d.appendChild(h('option', { value: v })); });
    $('dlValues').appendChild(d); input.setAttribute('list', id);
  }

  /* ---------- 파일 도우미 ---------- */
  function download(name, blob) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function pickFiles(accept, multiple, cb) {
    var fi = $('fileInput'); fi.value = ''; fi.accept = accept; fi.multiple = !!multiple;
    fi.onchange = function () { if (fi.files && fi.files.length) cb(Array.prototype.slice.call(fi.files)); };
    fi.click();
  }
  function readText(f) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = no; r.readAsText(f, 'utf-8'); }); }
  function readBuf(f) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = no; r.readAsArrayBuffer(f); }); }
  function parseJson(txt) {
    var o = JSON.parse(txt);
    if (!o || o.app !== 'jangan-monthly-report' || !Array.isArray(o.items)) throw new Error('월간업무보고 작성 도구에서 만든 파일이 아닙니다');
    if (o.dept && o.dept !== DEPT) throw new Error('다른 부서(' + o.dept + ')에서 만든 파일입니다. 부서를 바꾼 뒤 여세요');
    return o;
  }
  function importHwpx(buf) {
    return JSZip.loadAsync(buf).then(function (z) {
      var f = z.file('Contents/section0.xml');
      if (!f) throw new Error('HWPX 본문을 찾지 못했습니다');
      return f.async('string');
    }).then(function (xml) {
      var r = MR.parseHwpxSection(xml, DOMParser, { facility: DEPT, defaultPart: DEPT === DEF_DEPT ? null : (SET.parts[0] || '전체') });
      if (r.facilityFound === false) throw new Error('이 파일에서 「' + DEPT + '」을(를) 찾지 못했습니다. 파일에 있는 부서: ' + (r.boxNames || []).slice(0, 8).join(', ') + ' … 부서를 바꾸거나 다른 파일을 고르세요');
      return r;
    });
  }
  /* 공사 전체 월간업무보고(.hwpx) 여러 개에서 내 부서 부분만 과거 보고서로 보관 */
  function importHistoryFiles(files) {
    var ok = [], bad = [];
    return files.reduce(function (p, f) {
      return p.then(function () {
        return readBuf(f).then(importHwpx).then(function (r) {
          if (!r.meta.year || !r.meta.month) throw new Error('보고월을 찾지 못했습니다');
          if (!r.items.length) throw new Error('내 부서 항목이 없습니다');
          addHistory({ y: r.meta.year, m: r.meta.month, items: r.items.map(plainCopy) }); ok.push(r.meta.year + '년 ' + r.meta.month + '월');
        }).catch(function (e) { bad.push(f.name + ' (' + e.message + ')'); });
      });
    }, Promise.resolve()).then(function () {
      toast((ok.length ? DEPT + ' 과거 보고서 ' + ok.length + '개를 보관했습니다: ' + ok.join(', ') : '보관한 파일이 없습니다') + (bad.length ? ' / 못 읽은 파일: ' + bad.join(' · ') : ''));
      return ok.length;
    });
  }
  /* .월보 / .json / .hwpx 를 모두 {meta, items, part}로 읽음 */
  function readReportFile(f) {
    if (/\.hwpx$/i.test(f.name)) return readBuf(f).then(importHwpx).then(function (r) { return { year: r.meta.year, month: r.meta.month, part: null, items: r.items, reportDate: '' }; });
    return readText(f).then(parseJson);
  }
  function confirmBox(title, text, yesLabel, noLabel) {
    return new Promise(function (ok) {
      $('cfTitle').textContent = title; $('cfText').textContent = text; $('cfYes').textContent = yesLabel || '확인'; $('cfNo').textContent = noLabel || '취소';
      var d = $('dlgConfirm');
      $('cfYes').onclick = function () { d.close(); ok(true); };
      $('cfNo').onclick = function () { d.close(); ok(false); };
      d.showModal();
    });
  }

  /* ---------- 작업 저장 ---------- */
  function defaultYM() {
    var d = new Date(), y = d.getFullYear(), m = d.getMonth() + 2;
    if (m > 12) { m = 1; y++; }
    return { y: y, m: m };
  }
  function newWork(y, m, part) {
    var s = MR.newState(y, m); s.part = part || null; s.carry = {}; s.prevPool = null; s.dept = DEPT; return s;
  }
  function wsKey(y, m, part) { return DEPT + '|' + hk(y, m) + '|' + part; }
  function lk(y, m) { return DEPT + '|' + hk(y, m); }
  function openStaffWork(y, m, part) {
    var k = wsKey(y, m, part);
    if (!STAFF.ws[k]) STAFF.ws[k] = newWork(y, m, part);
    S = STAFF.ws[k]; S.carry = S.carry || {};
    STAFF.pref = { y: y, m: m, part: part };
    trimWS(STAFF.ws, 12);
    saveStaffNow();
  }
  function trimWS(ws, keep) {
    var keys = Object.keys(ws).sort(function (a, b) { return (ws[b].updatedAt || '').localeCompare(ws[a].updatedAt || ''); });
    keys.slice(keep).forEach(function (k) { delete ws[k]; });
  }
  var stT, ldT;
  function saveStaff() { if (S) S.updatedAt = new Date().toISOString(); clearTimeout(stT); stT = setTimeout(saveStaffNow, 250); }
  function saveStaffNow() { clearTimeout(stT); saveKey(STAFF_KEY, STAFF); }
  function saveLead() { if (L) L.updatedAt = new Date().toISOString(); clearTimeout(ldT); ldT = setTimeout(saveLeadNow, 250); }
  function saveLeadNow() { clearTimeout(ldT); saveKey(LEAD_KEY, LEAD); }
  function touch() { if (UI.view === 'lead') saveLead(); else saveStaff(); }
  function openLeadWork(y, m) {
    var k = lk(y, m);
    if (!LEAD.ws[k]) { LEAD.ws[k] = MR.newState(y, m); LEAD.ws[k].received = {}; }
    L = LEAD.ws[k]; L.received = L.received || {}; L.dept = DEPT;
    LEAD.cur = k; trimWS(LEAD.ws, 6); saveLeadNow();
  }

  /* 빈 고정 칸(일정·장소 등 비워 둔 칸)은 보고서에서 뺌 */
  function sanitizeItem(it) {
    var c = MR.clone(it), out = [];
    c.blocks.forEach(function (b, i) {
      if (b.k === 'box' && b.opt) {
        var next = c.blocks[i + 1];
        if (!String(b.value || '').trim() && !(next && next.k === 'sub')) return;
      }
      if (b.k === 'sub' && !String(b.text || '').trim()) return;
      var nb = MR.clone(b); delete nb.opt; out.push(nb);
    });
    c.blocks = out;
    return c;
  }
  function sanitized(st) { var c = MR.clone(st); c.items = st.items.map(sanitizeItem); return c; }
  function isBlankItem(it) {
    return !it.blocks.some(function (b) {
      if (b.k === 'box') return String(b.value || '').trim() || (!b.opt && String(b.label || '').trim());
      if (b.k === 'table') return b.rows.some(function (r) { return r.some(function (c) { return String(c.t || '').trim(); }); });
      if (b.k === 'stat') return b.rows.some(function (r) { return r.v.some(function (v) { return v !== ''; }); });
      return String(b.text || '').trim();
    });
  }

  /* ---------- 과거 보고서 ---------- */
  function histFind(key) { return HIST.filter(function (r) { return hk(r.y, r.m) === key; })[0]; }
  var histTok = 0, BASE_TXT = null;
  function baseText() {
    if (BASE_TXT) return Promise.resolve(BASE_TXT);
    var bin = atob(TPL.history), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return JSZip.loadAsync(u8).then(function (z) { return z.file('h.json').async('string'); }).then(function (t) { BASE_TXT = t; return t; });
  }
  function loadHistory() {
    var tok = ++histTok; HIST_READY = false; HIST = [];
    /* 기본 수록 보고서는 장안구민회관 자료입니다. 다른 부서는 가져온 보고서·배포 자료로 채웁니다. */
    var p = DEPT === DEF_DEPT ? baseText() : Promise.resolve('[]');
    return p.then(function (t) {
      if (tok !== histTok) return;
      var base = JSON.parse(t), extra = loadKey(hK(), []), map = {};
      base.forEach(function (r) { r.src = '기본 수록'; map[hk(r.y, r.m)] = r; });
      (Array.isArray(extra) ? extra : []).forEach(function (r) { r.src = '이 PC에 추가'; map[hk(r.y, r.m)] = r; });
      ((EMBED && EMBED.hist) || []).forEach(function (r) { r.src = '배포판'; map[hk(r.y, r.m)] = MR.clone(r); });
      HIST = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.y - a.y || b.m - a.m; });
      HIST.forEach(function (r) { r.items.forEach(function (it, i) { it._k = hk(r.y, r.m) + '#' + i; }); });
      HIST_READY = true; render();
    }).catch(function (e) { if (tok !== histTok) return; HIST = []; HIST_READY = true; toast('과거 보고서를 불러오지 못했습니다: ' + e.message); render(); });
  }
  function addHistory(rep) {
    var extra = loadKey(hK(), []); if (!Array.isArray(extra)) extra = [];
    extra = extra.filter(function (r) { return !(r.y === rep.y && r.m === rep.m); }); extra.push(rep);
    saveKey(hK(), extra);
    rep.src = '이 PC에 추가';
    HIST = HIST.filter(function (r) { return !(r.y === rep.y && r.m === rep.m); }).concat([rep]).sort(function (a, b) { return b.y - a.y || b.m - a.m; });
    rep.items.forEach(function (it, i) { it._k = hk(rep.y, rep.m) + '#' + i; });
  }
  function plainCopy(i) { var c = MR.clone(i); delete c.id; delete c._k; delete c.needsResult; delete c.needsReview; delete c.fromPrev; delete c.fromHist; return c; }

  /* ---------- 공통: 요약 줄, 날짜 넣기 ---------- */
  function blockLine(b) {
    if (b.k === 'box') return '□ ' + MR.boxText(b);
    if (b.k === 'sub') return '   ○ ' + b.text;
    if (b.k === 'note') return '   ※ ' + b.text;
    if (b.k === 'unit' || b.k === 'plain') return String(b.text || '').trim();
    var t = b.k === 'stat' ? MR.statToTable(b) : b;
    return t.rows.map(function (r) { return '  | ' + r.map(function (c) { return String(c.t || '').replace(/\n/g, ' '); }).join(' | '); }).join('\n');
  }
  function summary(it, n) {
    var lines = [];
    it.blocks.forEach(function (b) {
      if (b.k === 'box' && b.opt && !String(b.value || '').trim()) return;
      if (b.k === 'table' || b.k === 'stat') { lines.push('[표]'); return; }
      var l = blockLine(b); if (l.trim()) lines.push(l);
    });
    return lines.slice(0, n || 3).join('\n');
  }
  function closeDatePop() { var p = $('datePop'); if (p) p.remove(); }
  function fmtRange(a, b) {
    if (!b || b === a) return MR.fmtDate(a);
    var pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    var right = pb[0] !== pa[0] ? MR.fmtDate(b) : pb[1] + '. ' + pb[2] + '.(' + MR.wdOf(pb[0], pb[1], pb[2]) + ')';
    return MR.fmtDate(a) + ' ~ ' + right;
  }
  function datePopover(target) {
    closeDatePop();
    var r = target.getBoundingClientRect();
    var d1 = h('input', { type: 'date', 'aria-label': '시작 날짜' }), d2 = h('input', { type: 'date', 'aria-label': '끝 날짜(기간일 때만)' });
    var pos = { s: target.selectionStart, e: target.selectionEnd };
    var pop = h('div', { class: 'pop-date', id: 'datePop' },
      h('span', { class: 'lbl', text: '날짜' }), d1, h('span', { class: 'lbl', text: '~ (기간이면)' }), d2,
      h('button', { type: 'button', class: 'btn pri sm', text: '넣기', onclick: function () {
        if (!d1.value) { toast('날짜를 고르세요'); return; }
        var txt = fmtRange(d1.value, d2.value), v = target.value, s = pos.s == null ? v.length : pos.s, e = pos.e == null ? v.length : pos.e;
        target.value = v.slice(0, s) + txt + v.slice(e);
        target.dispatchEvent(new Event('input', { bubbles: true }));
        closeDatePop(); target.focus();
      } }), h('button', { type: 'button', class: 'btn sm', text: '닫기', onclick: closeDatePop }));
    var host = target.closest('dialog') || document.body;
    host.appendChild(pop);
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 430)) + 'px';
    pop.style.top = Math.min(r.bottom + 6, window.innerHeight - 120) + 'px';
    d1.focus();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDatePop(); });
  function dateBtn(input, labelSrc) {
    var btn = h('button', { type: 'button', class: 'datebtn', title: '달력에서 골라 요일과 함께 넣기', text: '📅 날짜 넣기', onclick: function () { datePopover(input); } });
    var upd = function () { btn.classList.toggle('hidden', !isDateLabel(typeof labelSrc === 'string' ? labelSrc : labelSrc.value)); };
    if (typeof labelSrc !== 'string') labelSrc.addEventListener('input', upd);
    upd();
    return btn;
  }

  /* ---------- 항목 템플릿 ---------- */
  var TEMPLATES = [
    { key: '일반', name: '일반 업무', desc: '일정 · 장소 · 대상 · 주요내용 칸에 쓰기 (대부분 이것)' },
    { key: '정규강좌', name: '정규강좌 모집·운영', desc: '강좌수·정원·등록인원 표, 합계·등록비율 자동 계산' },
    { key: '대관 현황', name: '대관 현황', desc: '공연장·전시실 3개년 비교 표' },
    { key: '시설 공사·관리 성과', name: '시설 공사·관리', desc: '구분·일시·내용·기대효과·소요예산 표' },
    { key: '자원봉사·문화사랑방', name: '자원봉사·문화사랑방', desc: '운영일시·장소·대상·인원 칸' }
  ];
  function optBox(label) { return { k: 'box', label: label, value: '', opt: true }; }
  function newItem(tkey, sec, part, st) {
    var it;
    if (tkey === '일반') {
      it = { id: MR.uid(), sec: sec, part: part, type: '기타', title: '', blocks: [optBox('일정'), optBox('장소'), optBox('대상'), optBox('주요내용')], needsResult: false, fromPrev: false };
    } else {
      it = MR.makeItem(tkey, sec, part, st);
      if (tkey === '자원봉사·문화사랑방') it.blocks = it.blocks.map(function (b) { if (b.k === 'box') b.opt = true; return b; }).filter(function (b) { return !(b.k === 'sub' && !b.text); });
    }
    it.part = part;
    return it;
  }

  /* ======================================================================
     편집 대화상자 — 고정 칸(□ 이름 : 내용 + ○ 세부 줄), 표는 유형별 자동
     ====================================================================== */
  var ED = { it: null, st: null, onDone: null }, OPEN_SUBS = [];
  function toGroups(blocks) {
    var gs = [], cur = null;
    blocks.forEach(function (b) {
      if (b.k === 'box') { cur = { k: 'field', box: b, subs: [] }; gs.push(cur); }
      else if (b.k === 'sub' && cur) cur.subs.push(b.text || '');
      else { cur = null; gs.push({ k: 'other', b: b }); }
    });
    return gs;
  }
  function fromGroups(gs) {
    var out = [];
    gs.forEach(function (g) {
      if (g.k === 'field') { out.push(g.box); g.subs.forEach(function (t) { if (String(t).trim()) out.push({ k: 'sub', text: t }); }); }
      else out.push(g.b);
    });
    return out;
  }
  function openEditor(it, st, onDone) {
    ED.it = it; ED.st = st; ED.onDone = onDone;
    renderEditor();
    var d = $('dlgEdit');
    if (!d.open) d.showModal();
    var ti = d.querySelector('.title-in'); if (ti && !ti.value) ti.focus();
  }
  $('dlgEdit').addEventListener('close', function () { closeDatePop(); var f = ED.onDone; ED.it = null; if (f) f(); });
  function edChanged() { touch(); updatePrev(); }
  function updatePrev() {
    var host = $('edPrevBody'); if (!host || !ED.it) return;
    host.innerHTML = '';
    host.appendChild(paper({ year: ED.st.year, month: ED.st.month, reportDate: '', items: [sanitizeItem(ED.it)] }, { compact: true, part: '-' }));
  }
  function renderEditor() {
    var it = ED.it, st = ED.st; if (!it) return;
    var lead = UI.view === 'lead';
    var pm = MR.prevYM(st.year, st.month);
    $('edTitle').textContent = it.sec === 'plan' ? st.month + '월 계획 항목' : pm.m + '월 성과(결과) 항목';
    $('edDesc').textContent = '칸에 내용만 쓰면 됩니다. 비워 둔 칸(일정·장소 등)은 보고서에서 자동으로 빠집니다. 입력하는 즉시 자동 저장됩니다.';
    var b = $('edBody'); b.innerHTML = '';
    if (lead) {
      var secSel = h('select', { 'aria-label': '구분', onchange: function () { it.sec = this.value; edChanged(); renderEditor(); } },
        h('option', { value: 'plan', text: st.month + '월 계획' }), h('option', { value: 'result', text: pm.m + '월 성과' }));
      secSel.value = it.sec;
      var partSel = h('select', { 'aria-label': '파트', onchange: function () { it.part = this.value; edChanged(); } });
      (SET.parts.indexOf(it.part) < 0 ? SET.parts.concat([it.part]) : SET.parts).forEach(function (p) { partSel.appendChild(h('option', { value: p, text: p })); });
      partSel.value = it.part;
      b.appendChild(h('div', { class: 'row' }, h('span', { class: 'lbl', text: '구분' }), secSel, h('span', { class: 'lbl', text: '파트' }), partSel));
    }
    b.appendChild(h('label', { class: 'lbl', style: 'display:flex;flex-direction:column;gap:6px' }, '제목 (보고서의 번호 옆 굵은 글씨)',
      h('input', { type: 'text', class: 'title-in', value: it.title, placeholder: '예: 2027년 문화강좌 운영 방향 회의', oninput: function () { it.title = this.value; edChanged(); } })));
    if (it.needsResult || it.fromPrev) {
      b.appendChild(flagRow(it.needsResult, '계획 때 쓴 내용입니다. 바뀐 일정·실제 참여인원·결과로 고친 뒤 체크하세요.', '실적 반영 완료', function (on) { it.needsResult = !on; }));
    }
    if (it.needsReview || it.fromHist) {
      b.appendChild(flagRow(it.needsReview, (it.fromHist || '과거') + ' 보고서에서 가져온 내용입니다. 날짜·인원·예산·장소를 이번 달에 맞게 고친 뒤 체크하세요.', '내용 확인 완료 (' + (it.fromHist || '과거 보고서') + '에서 가져옴)', function (on) { it.needsReview = !on; }));
    }
    var wrap = h('div', { class: 'fields' });
    renderFields(it, wrap);
    b.appendChild(wrap);
    var gs = function () { return toGroups(it.blocks); };
    var addG = function (g) { var x = gs(); x.push(g); it.blocks = fromGroups(x); edChanged(); renderEditor(); var ins = $('edBody').querySelectorAll('.flab'); if (ins.length && g.k === 'field') ins[ins.length - 1].focus(); };
    b.appendChild(h('div', { class: 'addbar' },
      h('span', { class: 'lbl', text: '칸 더하기:' }),
      h('button', { type: 'button', class: 'btn sm', text: '+ □ 칸 (이름 : 내용)', onclick: function () { addG({ k: 'field', box: { k: 'box', label: '', value: '' }, subs: [] }); } }),
      h('button', { type: 'button', class: 'btn sm', text: '+ ※ 참고', onclick: function () { addG({ k: 'other', b: { k: 'note', text: '' } }); } }),
      h('button', { type: 'button', class: 'btn sm', text: '+ 표', onclick: function () { addG({ k: 'other', b: { k: 'table', head: 1, widths: [], rows: [[cell('구분'), cell('내용'), cell('비고')], [cell(''), cell(''), cell('')]] } }); } }),
      h('button', { type: 'button', class: 'btn sm', text: '+ 합계 자동 표', onclick: function () { addG({ k: 'other', b: { k: 'stat', unit: '(단위 : 명)', cats: ['구분1', '구분2'], rows: [{ label: '항목', v: ['', ''] }], rate: null } }); } })));
    b.appendChild(simBox(it, st));
    var f = $('edFoot'); f.innerHTML = '';
    f.appendChild(h('button', { type: 'button', class: 'btn', text: '자주 쓰는 업무로 저장', title: '매달 반복되는 업무를 저장해 두고 다음 달에 바로 불러 씁니다', onclick: function () { saveToLib(it); } }));
    f.appendChild(h('button', { type: 'button', class: 'btn danger', text: '이 항목 지우기', onclick: function () {
      confirmBox('항목 지우기', '「' + (it.title || '제목 없음') + '」 항목을 지울까요?', '지우기').then(function (ok) {
        if (!ok) return;
        st.items.splice(st.items.indexOf(it), 1);
        if (st.carry) Object.keys(st.carry).forEach(function (k) { if (st.carry[k].id === it.id) delete st.carry[k]; });
        edChanged(); $('dlgEdit').close();
      });
    } }));
    f.appendChild(h('span', { class: 'grow' }));
    f.appendChild(h('button', { type: 'button', class: 'btn pri lg', text: '다 썼어요', onclick: function () { $('dlgEdit').close(); } }));
    /* 왼쪽 입력 / 오른쪽 보고서 모양(입력하는 대로 바뀜) */
    var left = h('div', { class: 'edleft' }); while (b.firstChild) left.appendChild(b.firstChild);
    b.classList.add('edgrid'); b.appendChild(left);
    b.appendChild(h('aside', { class: 'edprev', 'aria-label': '보고서 모양 미리보기' }, h('div', { class: 'edprev-h', text: '보고서에는 이렇게 나옵니다' }), h('div', { id: 'edPrevBody' })));
    updatePrev();
  }
  function cell(t) { return { t: t, cs: 1, rs: 1 }; }
  function flagRow(pending, text, doneText, set) {
    var id = 'fl' + MR.uid();
    var cb = h('input', { type: 'checkbox', id: id, checked: !pending, onchange: function () { set(this.checked); edChanged(); renderEditor(); } });
    return h('div', { class: 'resflag' + (pending ? '' : ' done') }, cb, h('label', { for: id, text: pending ? text : doneText }));
  }
  function renderFields(it, wrap) {
    var groups = toGroups(it.blocks);
    var commit = function () { it.blocks = fromGroups(groups); edChanged(); };
    var rerender = function () { commit(); renderEditor(); };
    var remove = function (g) { groups.splice(groups.indexOf(g), 1); rerender(); };
    var xbtn = function (g) { return h('button', { type: 'button', class: 'x', 'aria-label': '이 칸 지우기', title: '이 칸 지우기', text: '✕', onclick: function () { remove(g); } }); };
    if (!groups.length) wrap.appendChild(h('p', { class: 'lbl', text: '아래 ‘칸 더하기’로 내용을 넣으세요.' }));
    groups.forEach(function (g) {
      if (g.k === 'field') {
        var bx = g.box;
        var lab = h('input', { type: 'text', class: 'flab', 'aria-label': '칸 이름', list: 'dlLabels', placeholder: '칸 이름', value: bx.label || '' });
        var val = h('input', { type: 'text', 'aria-label': (bx.label || '칸') + ' 내용', value: bx.value || '', placeholder: placeholderFor(bx.label) });
        attachList(val, bx.label);
        lab.addEventListener('input', function () { bx.label = this.value; delete bx.opt; commit(); attachList(val, bx.label); val.placeholder = placeholderFor(bx.label); });
        val.addEventListener('input', function () { bx.value = this.value; commit(); });
        var showSubs = g.subs.length || /내용/.test(bx.label || '') || OPEN_SUBS.indexOf(bx) >= 0;
        var row = h('div', { class: 'fld' }, lab, h('div', { class: 'fval' }, val, dateBtn(val, lab)), xbtn(g));
        if (showSubs) {
          var ta = h('textarea', { 'aria-label': (bx.label || '') + ' 세부 줄', rows: Math.max(3, g.subs.length + 1), placeholder: '한 줄에 하나씩 쓰면 줄마다 ○ 표시가 붙습니다\n예) 강좌발표회 및 새빛 노래자랑 행사', value: g.subs.join('\n') });
          ta.addEventListener('input', function () { g.subs = this.value.split('\n'); commit(); });
          row.appendChild(ta);
          row.appendChild(h('div', { class: 'hint', text: '○ 세부 줄 — 한 줄에 하나씩' }));
        } else if (!(bx.opt && /^(일정|장소|대상)$/.test(norm(bx.label)))) {
          row.appendChild(h('button', { type: 'button', class: 'btn ghost sm addsub', text: '+ 아래에 ○ 세부 줄 쓰기', onclick: function () { OPEN_SUBS.push(bx); renderEditor(); var t = $('edBody').querySelectorAll('textarea'); for (var q = 0; q < t.length; q++) if (!t[q].value) { t[q].focus(); break; } } }));
        }
        wrap.appendChild(row);
      } else {
        var bb = g.b, nm = { sub: '○ 세부', note: '※ 참고', unit: '단위 표기', plain: '문장', table: '표', stat: '표(합계 자동)' }[bb.k] || bb.k;
        if (bb.k === 'table' || bb.k === 'stat') {
          wrap.appendChild(h('div', { class: 'fld' }, h('div', { class: 'lbl', style: 'padding-top:8px;font-weight:700', text: nm }), h('span'), xbtn(g),
            bb.k === 'stat' ? statEditor(bb) : tableEditor(bb, rerender)));
        } else {
          var inp = h('input', { type: 'text', 'aria-label': nm, value: bb.text || '', oninput: function () { bb.text = this.value; commit(); } });
          wrap.appendChild(h('div', { class: 'fld' }, h('div', { class: 'lbl', style: 'padding-top:9px;font-weight:700', text: nm }), h('div', { class: 'fval' }, inp, dateBtn(inp, '날짜')), xbtn(g)));
        }
      }
    });
  }
  function placeholderFor(label) {
    var n = norm(label);
    if (isDateLabel(n)) return '예) 2026. 12. 3.(목) 14:00  — 오른쪽 날짜 넣기 버튼 사용';
    if (/장소/.test(n)) return '목록에서 고르거나 직접 입력';
    if (/대상/.test(n)) return '예) 수강생 및 지역 주민';
    if (/인원/.test(n)) return '예) 45명';
    if (/예산/.test(n)) return '예) 금1,500천원(수선유지비)';
    if (/내용/.test(n)) return '한 줄 요약 (세부는 아래 칸에)';
    return '내용';
  }
  function statEditor(blk) {
    var totals = MR.statTotals(blk);
    var tb = h('table'), rateCells = [];
    tb.appendChild(h('tr', null,
      h('th', { class: 'hd' }, h('input', { type: 'text', 'aria-label': '단위', value: blk.unit || '', placeholder: '(단위)', oninput: function () { blk.unit = this.value; touch(); } })),
      h('th', { class: 'hd calc', style: 'text-align:center', text: '합 계' }),
      blk.cats.map(function (c, i) { return h('th', { class: 'hd' }, h('input', { type: 'text', 'aria-label': '구분명 ' + (i + 1), value: c, oninput: function () { blk.cats[i] = this.value; touch(); } })); })));
    var hasRate = blk.rate && blk.rows[blk.rate.num] && blk.rows[blk.rate.den];
    function rates() {
      var n = blk.rows[blk.rate.num].v, d = blk.rows[blk.rate.den].v, f = function (a, b) { return b > 0 ? (a / b * 100).toFixed(2) : '-'; };
      var tn = n.reduce(function (a, x) { return a + MR.num(x); }, 0), td = d.reduce(function (a, x) { return a + MR.num(x); }, 0);
      return [f(tn, td)].concat(n.map(function (x, i) { return f(MR.num(x), MR.num(d[i])); }));
    }
    blk.rows.forEach(function (r, ri) {
      var totCell = h('td', { class: 'calc', text: MR.fmtNum(totals[ri]) });
      tb.appendChild(h('tr', null,
        h('td', null, h('input', { type: 'text', 'aria-label': '행 이름', value: r.label, oninput: function () { r.label = this.value; touch(); } })),
        totCell,
        r.v.map(function (v, ci) {
          return h('td', { class: 'num' }, h('input', { type: 'number', inputmode: 'numeric', 'aria-label': r.label + ' ' + blk.cats[ci], value: v, oninput: function () {
            r.v[ci] = this.value === '' ? '' : Number(this.value); touch();
            totCell.textContent = MR.fmtNum(MR.statTotals(blk)[ri]);
            if (hasRate) rates().forEach(function (x, i) { rateCells[i].textContent = x; });
          } }));
        })));
    });
    if (hasRate) {
      rateCells = rates().map(function (x) { return h('td', { class: 'calc', text: x }); });
      tb.appendChild(h('tr', null, h('td', { class: 'calc', style: 'text-align:left', text: blk.rate.label + ' · 자동' }), rateCells));
    }
    return h('div', { class: 'tablebox' }, tb);
  }
  function tableEditor(blk, rerender) {
    var g = MR.tableGrid(blk.rows), hasSpan = g.placed.some(function (p) { return p.cs > 1 || p.rs > 1; });
    var tb = h('table');
    blk.rows.forEach(function (row, ri) {
      var tr = h('tr');
      row.forEach(function (c, ci) {
        var isH = ri < (blk.head || 0);
        var td = h(isH ? 'th' : 'td', { class: isH ? 'hd' : null, colspan: c.cs > 1 ? c.cs : null, rowspan: c.rs > 1 ? c.rs : null });
        td.appendChild(h('input', { type: 'text', 'aria-label': (ri + 1) + '행 ' + (ci + 1) + '번째 칸', value: c.t || '', oninput: function () { c.t = this.value; touch(); } }));
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    var cols = g.cols;
    var bar = h('div', { class: 'row', style: 'padding:6px' },
      h('button', { type: 'button', class: 'btn sm', text: '+ 줄 추가', onclick: function () { var r = []; for (var i = 0; i < cols; i++) r.push(cell('')); blk.rows.push(r); rerender(); } }),
      h('button', { type: 'button', class: 'btn sm', text: '− 마지막 줄', onclick: function () { if (blk.rows.length > (blk.head || 0) + 1) { blk.rows.pop(); rerender(); } } }),
      hasSpan ? h('span', { class: 'lbl', text: '병합된 칸이 있어 열 추가·삭제는 막혀 있습니다' }) : [
        h('button', { type: 'button', class: 'btn sm', text: '+ 열', onclick: function () { blk.rows.forEach(function (r) { r.push(cell('')); }); blk.widths = []; rerender(); } }),
        h('button', { type: 'button', class: 'btn sm', text: '− 마지막 열', onclick: function () { if (cols > 1) { blk.rows.forEach(function (r) { r.pop(); }); blk.widths = []; rerender(); } } })]);
    return h('div', { class: 'tablebox' }, tb, bar);
  }
  function simBox(it, st) {
    var d = h('details', { class: 'simbox' });
    var sm = h('summary', { text: '과거 보고서에서 비슷한 항목 찾기 (내용 채우기)' });
    d.appendChild(sm);
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      while (d.childNodes.length > 1) d.removeChild(d.lastChild);
      if (!HIST_READY) { d.appendChild(h('p', { class: 'lbl', text: '과거 보고서를 불러오는 중입니다…' })); return; }
      if (MR.normTitle(it.title).length < 2) { d.appendChild(h('p', { class: 'lbl', text: '제목을 먼저 쓰면 비슷한 제목의 과거 항목을 찾아 드립니다.' })); return; }
      var sims = [];
      HIST.forEach(function (r) { r.items.forEach(function (x) { var sc = MR.similarity(it.title, x.title); if (sc >= 0.35) sims.push({ r: r, it: x, sc: sc }); }); });
      sims.sort(function (a, b) { return b.sc - a.sc || b.r.y - a.r.y || b.r.m - a.r.m; });
      if (!sims.length) { d.appendChild(h('p', { class: 'lbl', text: '비슷한 제목이 없습니다.' })); return; }
      sims.slice(0, 5).forEach(function (x) {
        d.appendChild(h('div', { class: 'hcard' },
          h('div', { class: 'row' }, h('b', { class: 'grow', text: x.it.title }), h('span', { class: 'chip', text: x.r.y + '.' + x.r.m + '월호 ' + (x.it.sec === 'plan' ? '계획' : '성과') }), h('span', { class: 'chip', text: '비슷함 ' + Math.round(x.sc * 100) + '%' }),
            h('button', { type: 'button', class: 'btn sm', text: '이 내용으로 채우기', onclick: function () {
              confirmBox('내용 채우기', '지금 칸 내용을 ' + x.r.y + '년 ' + x.r.m + '월호 「' + x.it.title + '」 내용으로 바꿉니다. 제목은 그대로 둡니다. 날짜의 연도는 올해로 바꿉니다.', '바꾸기').then(function (ok) {
                if (!ok) return;
                var c = histCopy(x, it.sec, st);
                it.blocks = c.blocks; it.needsReview = true; it.fromHist = c.fromHist;
                if (it.type === '기타' && c.type !== '기타') it.type = c.type;
                touch(); renderEditor(); toast('채웠습니다. 날짜·인원을 이번 달에 맞게 고치세요');
              });
            } })),
          h('pre', { text: x.it.blocks.map(blockLine).join('\n') || '(내용 없음)' })));
      });
    });
    return d;
  }
  function histCopy(x, sec, st, noShift) {
    var c = MR.clone(x.it); delete c._k;
    c.id = MR.uid(); c.sec = sec; c.needsResult = false; c.fromPrev = false; c.needsReview = true; c.fromHist = x.r.y + '년 ' + x.r.m + '월호';
    if (SET.parts.indexOf(c.part) < 0) c.part = SET.parts[0];
    return MR.shiftItem(c, noShift ? 0 : st.year - x.r.y, st);
  }

  /* ---------- 자주 쓰는 업무(보관함) ---------- */
  function saveToLib(it) {
    var key = norm(it.title);
    if (!key) { toast('제목을 먼저 쓰세요'); return; }
    var entry = { id: MR.uid(), title: it.title.trim(), part: it.part, type: it.type, blocks: MR.clone(it.blocks), savedAt: new Date().toISOString().slice(0, 10) };
    var dup = LIB.filter(function (u) { return norm(u.title) === key; })[0];
    var go = dup ? confirmBox('자주 쓰는 업무 바꾸기', '「' + entry.title + '」이(가) 이미 저장되어 있습니다. 지금 내용으로 바꿀까요?', '바꾸기') : Promise.resolve(true);
    go.then(function (ok) {
      if (!ok) return;
      if (dup) { entry.id = dup.id; LIB[LIB.indexOf(dup)] = entry; } else LIB.push(entry);
      saveLib(); toast('자주 쓰는 업무로 저장했습니다: ' + entry.title);
    });
  }

  /* ======================================================================
     화면 그리기
     ====================================================================== */
  function render() {
    var app = $('app'); app.innerHTML = '';
    $('navbar').classList.toggle('hidden', UI.view !== 'staff');
    $('btnHome').classList.toggle('hidden', UI.view === 'start' || !DEPTCFG.cur);
    var db = $('btnDept'); db.classList.toggle('hidden', !DEPTCFG.cur); db.textContent = DEPT + ' ▾';
    document.title = '월간업무보고 쉬운 작성 · ' + (DEPTCFG.cur ? DEPT : '수원도시공사');
    $('ctxText').textContent = UI.view === 'staff' && S ? '직원 · ' + ymText(S.year, S.month) + (S.part && SET.parts.length > 1 ? ' · ' + S.part + ' 파트' : '')
      : UI.view === 'lead' && L ? '팀장 · ' + ymText(L.year, L.month) + ' 모아서 보고서 만들기' : UI.view === 'set' ? '설정' : UI.view === 'dept' ? '부서 선택' : '';
    if (UI.view === 'start') renderStart(app);
    else if (UI.view === 'staff') renderStaff(app);
    else if (UI.view === 'lead') renderLead(app);
    else if (UI.view === 'dept') renderDeptPick(app);
    else renderSettings(app);
  }

  /* ---------- 시작 화면 ---------- */
  function deptList() { return DEPTS_DEFAULT.concat(DEPTCFG.custom.filter(function (d) { return DEPTS_DEFAULT.indexOf(d) < 0; })); }
  function pickDept(d) {
    d = String(d || '').trim().replace(/\s+/g, ' ');
    if (d.length < 2 || d.length > 20) { toast('부서 이름은 2~20자로 입력하세요'); return; }
    if (S || L) { saveStaffNow(); saveLeadNow(); }
    if (deptList().indexOf(d) < 0) DEPTCFG.custom.push(d);
    DEPTCFG.cur = d; saveKey(DEPT_KEY, DEPTCFG);
    loadDept(d); UI.view = 'start'; UI.step = 1; render(); window.scrollTo(0, 0);
    toast(d + '(으)로 시작합니다. 부서는 언제든 위 이름을 눌러 바꿀 수 있습니다');
    if (!loadKey(TOUR_KEY, null)) setTimeout(function () { if (UI.view === 'start' && !TOUR) startTour(startTourSteps()); }, 500);
  }
  function renderDeptPick(app) {
    var first = !DEPTCFG.cur, wrap = h('div', { class: 'start deptpick' });
    wrap.appendChild(h('div', null, h('h2', { text: first ? '어느 부서에서 쓰시나요?' : '부서 바꾸기' }),
      h('p', { class: 'intro', text: '수원도시공사 월간업무보고 작성 도구입니다. 부서를 고르면 그 부서의 파트·자주 쓰는 업무·과거 보고서가 따로 저장됩니다. 한 번 고르면 다음에도 기억합니다.' })));
    var grid = h('div', { class: 'deptgrid', role: 'list' });
    var q = h('input', { type: 'search', class: 'deptq', id: 'deptQ', placeholder: '부서 이름 검색 (예: 연화장)', 'aria-label': '부서 검색', oninput: function () { draw(); } });
    var draw = function () {
      grid.innerHTML = ''; var t = norm(q.value);
      var list = deptList().filter(function (d) { return !t || norm(d).indexOf(t) >= 0; });
      list.forEach(function (d) { grid.appendChild(h('button', { type: 'button', role: 'listitem', class: 'dept' + (DEPTCFG.cur === d ? ' cur' : ''), text: d, onclick: function () { pickDept(d); } })); });
      if (!list.length) grid.appendChild(h('div', { class: 'lbl', text: '목록에 없습니다. 아래 칸에 부서 이름을 직접 입력하세요.' }));
    };
    var nm = h('input', { type: 'text', id: 'deptNew', placeholder: '예: 새 부서 이름', maxlength: '20', 'aria-label': '부서 직접 입력', onkeydown: function (e) { if (e.key === 'Enter') pickDept(this.value); } });
    wrap.appendChild(h('div', { class: 'panel' }, q, grid));
    wrap.appendChild(h('div', { class: 'panel' }, h('b', { text: '목록에 없는 부서' }),
      h('div', { class: 'row', style: 'margin-top:8px' }, nm, h('button', { type: 'button', class: 'btn pri', id: 'deptAdd', text: '이 부서로 시작', onclick: function () { pickDept(nm.value); } }))));
    if (!first) wrap.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', text: '← 그대로 두기', onclick: function () { UI.view = 'start'; render(); } })));
    app.appendChild(wrap); draw();
  }
  function loadDept(d) {
    DEPT = d; S = null; L = null; EMBED = embedFor(d);
    SET = loadKey(sK(), null);
    if (!SET || !SET.parts || !SET.fields || !SET.dateWords) SET = (EMBED && EMBED.settings) ? MR.clone(EMBED.settings) : defaultSettings();
    LIB = loadKey(lK(), []); if (!Array.isArray(LIB)) LIB = [];
    if (EMBED && Array.isArray(EMBED.library)) {
      var added = 0;
      EMBED.library.forEach(function (u) { if (!LIB.some(function (x) { return norm(x.title) === norm(u.title); })) { LIB.push(u); added++; } });
      if (added) saveKey(lK(), LIB);
    }
    buildDatalists(); loadHistory();
  }
  function embedFor(d) {
    var best = null;
    EMBEDS.forEach(function (e) {
      if ((e.dept || DEF_DEPT) !== d) return;
      if (!best || (e.year * 12 + e.month) > (best.year * 12 + best.month)) best = e;
    });
    return best;
  }
  function renderStart(app) {
    if (!DEPTCFG.cur) { renderDeptPick(app); return; }
    var pref = STAFF.pref, w = pref && STAFF.ws[wsKey(pref.y, pref.m, pref.part)];
    var lw = LEAD.cur && LEAD.ws[LEAD.cur];
    app.appendChild(h('div', { class: 'start' },
      h('div', null, h('h2', { text: '무엇을 하시겠어요?' }), h('p', { class: 'intro', text: DEPT + ' 월간업무보고 — 직원은 내 몫만 쓰고, 팀장은 모아서 한글(HWPX) 보고서를 만듭니다.' })),
      h('div', { class: 'deptbar', id: 'deptBar' }, h('span', { class: 'lbl', text: '내 부서' }), h('b', { text: DEPT }), h('button', { type: 'button', class: 'btn sm', text: '부서 바꾸기', onclick: function () { UI.view = 'dept'; render(); } })),
      EMBED ? h('div', { class: 'embedinfo', text: '지금은 ' + ymText(EMBED.year, EMBED.month) + ' 배포 자료가 들어 있습니다. 지난달(' + (EMBED.base ? EMBED.base.m + '월호' : '') + ') 계획이 들어 있어 ‘지난달 결과’ 단계에 바로 나타납니다.' }) : null,
      h('div', { class: 'roles' },
        h('button', { type: 'button', class: 'role', id: 'roleStaff', onclick: goStaff },
          h('span', { class: 'who', text: '직원' }), h('b', { text: '내 파트 작성하기' }),
          h('span', { text: '보고월을 확인하고 4단계로 씁니다. 다 쓰면 ‘제출하기’로 파일 1개를 받아 팀장에게 보냅니다.' }),
          w && w.items.length ? h('span', { class: 'now', text: '이어서 쓰기: ' + ymText(w.year, w.month) + ' ' + w.part + ' 파트 · ' + w.items.length + '건 작성 중' }) : null),
        h('button', { type: 'button', class: 'role', id: 'roleLead', onclick: goLead },
          h('span', { class: 'who', text: '팀장' }), h('b', { text: '모아서 보고서 만들기' }),
          h('span', { text: '직원들이 보낸 제출 파일을 끌어다 놓고, 순서를 정리한 뒤 HWPX 보고서와 다음 달 배포판을 만듭니다.' }),
          lw && lw.items.length ? h('span', { class: 'now', text: '이어서: ' + ymText(lw.year, lw.month) + ' · ' + lw.items.length + '건 모음' }) : null)),
      h('div', { class: 'startlinks' },
        h('span', { class: 'lbl', text: '자료는 이 PC에만 저장되고 인터넷으로 보내지 않습니다.' }))));
  }
  function goStaff() {
    var p = STAFF.pref, ym;
    if (EMBED && (!p || cmpYM({ y: p.y, m: p.m }, { y: EMBED.year, m: EMBED.month }) < 0)) ym = { y: EMBED.year, m: EMBED.month };
    else if (p) ym = { y: p.y, m: p.m };
    else ym = defaultYM();
    var part = p && p.part && SET.parts.indexOf(p.part) >= 0 ? p.part : null;
    if (!part && SET.parts.length === 1) part = SET.parts[0];
    if (part) openStaffWork(ym.y, ym.m, part); else { S = newWork(ym.y, ym.m, null); }
    UI.view = 'staff'; UI.step = 1; render(); window.scrollTo(0, 0);
    if (!loadKey(TOUR_KEY + '-staff', null)) setTimeout(function () { startTour(staffTour()); saveKey(TOUR_KEY + '-staff', 1); }, 350);
  }
  function goLead() {
    var k = LEAD.cur, ym;
    if (k && LEAD.ws[k] && LEAD.ws[k].dept === DEPT) { L = LEAD.ws[k]; L.received = L.received || {}; }
    else {
      ym = EMBED ? { y: EMBED.year, m: EMBED.month } : defaultYM();
      openLeadWork(ym.y, ym.m);
    }
    UI.view = 'lead'; render(); window.scrollTo(0, 0);
  }

  /* ---------- 직원: 4단계 ---------- */
  function renderStaff(app) {
    var wz = h('div', { class: 'wiz' });
    var steps = h('div', { class: 'steps', id: 'stepsBar', role: 'navigation', 'aria-label': '작성 단계' });
    STEP_NAMES.forEach(function (nm, i) {
      var n = i + 1;
      steps.appendChild(h('button', { type: 'button', class: (n === UI.step ? 'cur' : (n < UI.step ? 'done' : '')), 'aria-current': n === UI.step ? 'step' : null, onclick: function () { goStep(n); } },
        h('div', { class: 'bar' }), h('span', { text: n + '. ' + nm })));
    });
    wz.appendChild(steps);
    if (UI.step === 1) step1(wz);
    else if (UI.step === 2) step2(wz);
    else if (UI.step === 3) step3(wz);
    else step4(wz);
    app.appendChild(wz);
    $('btnPrev').disabled = UI.step === 1;
    $('btnPrev').textContent = '이전';
    $('btnNext').classList.toggle('hidden', UI.step === 4);
    $('btnNext').textContent = UI.step === 3 ? '다음: 확인하고 제출' : '다음: ' + STEP_NAMES[UI.step];
    $('btnNext').disabled = UI.step === 1 && !(S && S.part);
    $('btnNext').title = '단축키 Alt + →'; $('btnPrev').title = '단축키 Alt + ←';
    $('navInfo').textContent = S && S.part ? ymText(S.year, S.month) + ' · ' + S.part + ' 파트 · 계획 ' + count('plan') + '건 · 결과 ' + count('result') + '건' : '';
  }
  function count(sec) { return S.items.filter(function (i) { return i.sec === sec; }).length; }
  function goStep(n) {
    if (n > 1 && !(S && S.part)) { toast('먼저 내 파트를 고르세요'); UI.step = 1; render(); return; }
    UI.step = n; render(); window.scrollTo(0, 0);
  }
  $('btnPrev').onclick = function () { if (UI.step > 1) goStep(UI.step - 1); };
  $('btnNext').onclick = function () { if (UI.step < 4) goStep(UI.step + 1); };

  document.addEventListener('keydown', function (e) {
    if (UI.view !== 'staff' || !e.altKey || TOUR || document.querySelector('dialog[open]')) return;
    if (e.key === 'ArrowRight' && UI.step < 4) { e.preventDefault(); goStep(UI.step + 1); }
    else if (e.key === 'ArrowLeft' && UI.step > 1) { e.preventDefault(); goStep(UI.step - 1); }
  });
  function stepHead(wz, title, desc) { wz.appendChild(h('div', { class: 'stephead' }, h('h2', { text: title }), h('p', { text: desc }))); }

  function step1(wz) {
    if (!S.part && SET.parts.length === 1) openStaffWork(S.year, S.month, SET.parts[0]);
    stepHead(wz, SET.parts.length > 1 ? '1. 보고월과 내 파트를 고르세요' : '1. 보고월을 확인하세요', '한 번 고르면 다음에 열 때도 기억합니다.');
    var sy = h('select', { 'aria-label': '보고 연도' }), sm = h('select', { 'aria-label': '보고 월' });
    for (var y = 2025; y <= 2030; y++) sy.appendChild(h('option', { value: y, text: y + '년' }));
    for (var m = 1; m <= 12; m++) sm.appendChild(h('option', { value: m, text: m + '월호' }));
    sy.value = S.year; sm.value = S.month;
    var onYM = function () {
      var y2 = +sy.value, m2 = +sm.value;
      if (S.part) openStaffWork(y2, m2, S.part); else S = newWork(y2, m2, null);
      render();
    };
    sy.onchange = onYM; sm.onchange = onYM;
    var pm = MR.prevYM(S.year, S.month);
    var pp = h('div', { class: 'partpick', role: 'group', 'aria-label': '내 파트' });
    SET.parts.forEach(function (p) {
      pp.appendChild(h('button', { type: 'button', 'aria-pressed': S.part === p ? 'true' : 'false', text: p, onclick: function () { openStaffWork(S.year, S.month, p); render(); } }));
    });
    var addIn = h('input', { type: 'text', 'aria-label': '새 파트 이름', placeholder: '예: 운영팀', maxlength: '20' });
    var addBtn = h('button', { type: 'button', class: 'btn sm', text: '파트 추가', onclick: function () {
      var v = addIn.value.trim(); if (!v) return;
      if (SET.parts.indexOf(v) < 0) { SET.parts.push(v); saveSet(); }
      openStaffWork(S.year, S.month, v); render();
    } });
    wz.appendChild(h('div', { class: 'panel formgrid' },
      h('span', { class: 'k', text: '보고월' }), h('div', { class: 'row' }, sy, sm, h('span', { class: 'lbl', text: '→ ' + S.month + '월 계획과 ' + pm.m + '월 결과를 씁니다' })),
      h('span', { class: 'k', text: SET.parts.length > 1 ? '내 파트' : '내 파트(팀)' }), h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, pp,
        h('details', { class: 'more' }, h('summary', { text: '내 파트(팀)가 목록에 없나요?' }), h('div', { class: 'row', style: 'margin-top:8px' }, addIn, addBtn)))));
    if (S.part) {
      var n = S.items.length;
      wz.appendChild(h('div', { class: 'notice ' + (n ? 'ok' : 'info'), text: n ? '이 달·이 파트로 이미 ' + n + '건을 써 두었습니다. ‘다음’을 눌러 이어서 쓰세요.' : '좋습니다. ‘다음’을 눌러 지난달 결과부터 정리합니다.' }));
    }
    wz.appendChild(h('details', { class: 'more' }, h('summary', { text: '예전에 저장한 파일로 이어서 쓰기 (.월보 / .json)' }),
      h('p', { class: 'lbl', text: '다른 PC에서 쓰던 내용이나 예전 작성 도구의 작업 파일을 불러옵니다. 지금 이 달·파트에 쓴 내용은 파일 내용으로 바뀝니다.' }),
      h('button', { type: 'button', class: 'btn', text: '파일 고르기', onclick: function () {
        pickFiles('.월보,.json', false, function (fs) {
          readText(fs[0]).then(parseJson).then(function (o) {
            var part = o.part || S.part;
            if (!part) { toast('파일에 파트 정보가 없습니다. 먼저 내 파트를 고르세요'); return; }
            var items = o.part ? o.items : o.items.filter(function (i) { return i.part === part; });
            if (!items.length) items = o.items;
            return confirmBox('이어서 쓰기', '「' + fs[0].name + '」(' + ymText(o.year, o.month) + ', ' + part + ' 파트, ' + items.length + '건)을 불러옵니다.', '불러오기').then(function (ok) {
              if (!ok) return;
              if (SET.parts.indexOf(part) < 0) { SET.parts.push(part); saveSet(); }
              openStaffWork(o.year, o.month, part);
              S.items = items.map(function (i) { i.part = part; return i; }); S.carry = o.carry || {};
              saveStaffNow(); render(); toast('불러왔습니다');
            });
          }).catch(function (e) { toast('열 수 없습니다: ' + e.message); });
        });
      } })));
  }

  /* 2단계: 지난달 계획 카드 */
  function prevPool() {
    if (S.prevPool && S.prevPool.items && S.prevPool.items.length) return { src: S.prevPool.src, items: S.prevPool.items, file: true };
    var pm = MR.prevYM(S.year, S.month), rep = histFind(hk(pm.y, pm.m));
    if (!rep) return null;
    return { src: ymText(rep.y, rep.m) + (rep.src === '배포판' ? ' (배포판)' : rep.src === '이 PC에 추가' ? ' (이 PC)' : ' (수록 보고서)'), items: rep.items.filter(function (i) { return i.sec === 'plan'; }) };
  }
  function step2(wz) {
    var pm = MR.prevYM(S.year, S.month);
    stepHead(wz, '2. 지난달(' + pm.m + '월) 계획은 어떻게 되었나요?', '카드마다 하나만 누르세요. ‘예정대로 함’이면 참여인원 같은 숫자만 넣으면 됩니다.');
    if (!HIST_READY && !S.prevPool) { wz.appendChild(h('div', { class: 'empty', text: '지난달 보고서를 찾는 중입니다…' })); return; }
    var pool = prevPool();
    var srcRow = h('div', { class: 'row' });
    if (pool) srcRow.appendChild(h('span', { class: 'lbl', text: '불러온 곳: ' + pool.src + ' · 계획 ' + pool.items.length + '건' }));
    srcRow.appendChild(h('span', { class: 'grow' }));
    srcRow.appendChild(h('button', { type: 'button', class: 'btn sm', text: '다른 파일에서 지난달 계획 불러오기', title: '.hwpx, .월보, .json', onclick: pickPrevFile }));
    if (S.prevPool) srcRow.appendChild(h('button', { type: 'button', class: 'btn ghost sm', text: '수록된 보고서로 되돌리기', onclick: function () { S.prevPool = null; saveStaff(); render(); } }));
    wz.appendChild(srcRow);
    if (!pool) {
      wz.appendChild(h('div', { class: 'empty' }, h('div', { text: pm.y + '년 ' + pm.m + '월호 ' + DEPT + ' 보고서가 아직 없습니다.' }),
        h('div', { text: '위의 ‘다른 파일에서 지난달 계획 불러오기’로 지난달 월간업무보고(.hwpx)를 고르세요. 공사 전체 보고서 파일이면 「' + DEPT + '」 부분만 자동으로 가져옵니다. 이번이 첫 달이면 3단계로 넘어가도 됩니다.' })));
    } else {
      var mine = pool.items.filter(function (x) { return x.part === S.part; });
      var others = pool.items.filter(function (x) { return x.part !== S.part; });
      var cards = h('div', { class: 'cards' });
      if (!mine.length) cards.appendChild(h('div', { class: 'notice info', text: S.part + ' 파트로 분류된 지난달 계획이 없습니다. 아래 ‘다른 파트로 분류된 항목’에 내 업무가 있으면 펼쳐서 고르세요.' }));
      mine.forEach(function (x, i) { cards.appendChild(carryCard(x, poolKey(pool, x, i))); });
      if (mine.length) {
        var doneN = mine.filter(function (x, i) { return S.carry[poolKey(pool, x, i)]; }).length;
        wz.appendChild(h('div', { class: 'prog' }, h('div', { class: 'progbar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(mine.length), 'aria-valuenow': String(doneN) }, h('i', { style: 'width:' + Math.round(doneN / mine.length * 100) + '%' })),
          h('span', { class: 'lbl', text: mine.length + '건 중 ' + doneN + '건 정리' + (doneN === mine.length ? ' — 모두 끝났습니다' : '') })));
      }
      var pend = mine.filter(function (x, i) { return !S.carry[poolKey(pool, x, i)]; });
      if (pend.length > 1) wz.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', id: 'btnAllDone', text: '남은 ' + pend.length + '건 모두 ‘예정대로 함’으로', onclick: function () {
        pend.forEach(function (x) { setCarry(x, poolKey(pool, x, mine.indexOf(x)), 'done', true); }); render();
        toast(pend.length + '건을 ‘예정대로 함’으로 했습니다. 참여인원 같은 숫자는 각 카드에서 넣으세요');
      } }), h('span', { class: 'lbl', text: '대부분 예정대로 했다면 먼저 누르고, 바뀐 카드만 고르세요.' })));
      wz.appendChild(cards);
      if (others.length) {
        var picked = others.filter(function (x, i) { return S.carry[poolKey(pool, x, 'o' + i)]; }).length;
        var det = h('details', { class: 'more' }, h('summary', { text: '다른 파트로 분류된 지난달 계획 ' + others.length + '건' + (picked ? ' (고른 것 ' + picked + '건)' : '') + ' — 내 업무가 섞여 있으면 여기서 고르세요' }));
        if (UI.showOthers) det.open = true;
        det.addEventListener('toggle', function () { UI.showOthers = det.open; });
        var oc = h('div', { class: 'cards', style: 'margin-top:10px' });
        others.forEach(function (x, i) { oc.appendChild(carryCard(x, poolKey(pool, x, 'o' + i), true)); });
        det.appendChild(oc);
        wz.appendChild(det);
      }
    }
    var extra = S.items.filter(function (i) { return i.sec === 'result' && !i.fromPrev; });
    var box = h('div', { class: 'panel', style: 'padding:16px 18px;display:flex;flex-direction:column;gap:10px' },
      h('div', { class: 'row' }, h('b', { text: '계획에 없던 ' + pm.m + '월 성과' }), h('span', { class: 'lbl', text: '지난달 계획에는 없었지만 한 일이 있으면 더하세요.' }), h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'btn', text: '+ 성과 새로 쓰기', onclick: function () { chooseTemplate('result'); } })));
    if (extra.length) { var l = h('div', { class: 'cards' }); extra.forEach(function (it) { l.appendChild(itemCard(it, S)); }); box.appendChild(l); }
    wz.appendChild(box);
  }
  function poolKey(pool, x, i) { return (pool.file ? 'f:' : '') + (x._k || ('p' + i)) + ':' + MR.normTitle(x.title).slice(0, 20); }
  function pickPrevFile() {
    pickFiles('.hwpx,.월보,.json', false, function (fs) {
      readReportFile(fs[0]).then(function (o) {
        var items = o.items.filter(function (i) { return i.sec === 'plan'; }).map(function (i, n) { var c = MR.clone(i); c._k = 'file#' + n; return c; });
        if (!items.length) { toast('이 파일에서 계획 항목을 찾지 못했습니다'); return; }
        var pm = MR.prevYM(S.year, S.month);
        S.prevPool = { src: fs[0].name, items: items };
        saveStaff(); render();
        toast('계획 ' + items.length + '건을 불러왔습니다' + (o.month && o.month !== pm.m ? ' — 주의: ' + o.month + '월호 파일입니다(지난달은 ' + pm.m + '월)' : ''));
      }).catch(function (e) { toast('읽을 수 없습니다: ' + e.message); });
    });
  }
  function carryCard(x, key, other) {
    var c = S.carry[key], st = c && c.st, res = c && c.id ? S.items.filter(function (i) { return i.id === c.id; })[0] : null;
    if (c && c.st !== 'cancel' && !res) { delete S.carry[key]; c = null; st = null; }
    var card = h('div', { class: 'card' + (st ? ' s-' + st : '') });
    card.appendChild(h('div', { class: 'ct', text: x.title || '(제목 없음)' }));
    card.appendChild(h('div', { class: 'cmeta' }, other ? h('span', { class: 'chip', text: x.part + ' 파트로 분류됨' }) : null,
      st === 'done' ? h('span', { class: 'chip ok', text: '예정대로 함' }) : st === 'changed' ? h('span', { class: 'chip warn', text: res && res.needsResult ? '변경됨 · 고쳐 쓰기 필요' : '변경됨 · 고쳐 씀' }) : st === 'cancel' ? h('span', { class: 'chip', text: '취소 — 보고서에 넣지 않음' }) : h('span', { class: 'chip warn', text: '아직 고르지 않음' })));
    var sm = summary(res || x, 3); if (sm) card.appendChild(h('div', { class: 'csum', text: sm }));
    var set = function (ns) { setCarry(x, key, ns); };
    card.appendChild(h('div', { class: 'choice3' },
      h('button', { type: 'button', class: 'c-done', 'aria-pressed': st === 'done' ? 'true' : 'false', text: '✔ 예정대로 함', onclick: function () { set('done'); } }),
      h('button', { type: 'button', class: 'c-changed', 'aria-pressed': st === 'changed' ? 'true' : 'false', text: '✎ 변경됨', onclick: function () { set('changed'); } }),
      h('button', { type: 'button', class: 'c-cancel', 'aria-pressed': st === 'cancel' ? 'true' : 'false', text: '✕ 취소', onclick: function () { set('cancel'); } }),
      res ? h('button', { type: 'button', class: 'btn ghost', text: '자세히 고치기', onclick: function () { openEditor(res, S, render); } }) : null));
    if (st === 'done' && res) card.appendChild(quickBox(res));
    return card;
  }
  function setCarry(x, key, ns, quiet) {
    var c = S.carry[key], res = c && c.id ? S.items.filter(function (i) { return i.id === c.id; })[0] : null;
    if (ns === 'cancel') {
      if (res) S.items.splice(S.items.indexOf(res), 1);
      S.carry[key] = { st: 'cancel' };
      saveStaff(); if (!quiet) render(); return;
    }
    if (!res) {
      res = MR.clone(x); delete res._k;
      res.id = MR.uid(); res.sec = 'result'; res.part = S.part; res.fromPrev = true; res.needsReview = false; delete res.fromHist;
      S.items.push(res);
    }
    res.needsResult = ns === 'changed';
    S.carry[key] = { st: ns, id: res.id };
    saveStaff();
    if (quiet) return;
    if (ns === 'changed') openEditor(res, S, render); else render();
  }
  /* '예정대로 함' 카드의 숫자 입력 칸 */
  function quickBox(it) {
    var q = h('div', { class: 'quick' }), n = 0;
    it.blocks.forEach(function (b) {
      if (b.k === 'box' && RE_Q.test(norm(b.label))) {
        n++;
        var inp = h('input', { type: 'text', value: b.value || '', 'aria-label': b.label, placeholder: '예) 45명', oninput: function () { b.value = this.value; saveStaff(); } });
        attachList(inp, b.label);
        q.appendChild(h('label', null, b.label.trim(), inp));
      } else if (b.k === 'plain') {
        var m = String(b.text || '').match(/^(\s*)([^:：]{1,12}?)(\s*[:：]\s*)(.*)$/);
        if (m && RE_Q.test(norm(m[2]))) {
          n++;
          q.appendChild(h('label', null, m[2].trim(), h('input', { type: 'text', value: m[4], 'aria-label': m[2].trim(), oninput: function () { b.text = m[1] + m[2] + m[3] + this.value; saveStaff(); } })));
        }
      } else if (b.k === 'stat') {
        n++;
        var w = h('div', { style: 'flex:1 1 100%' }); w.appendChild(statEditor(b)); q.appendChild(w);
      }
    });
    if (!n) {
      var inp2 = h('input', { type: 'text', placeholder: '예) 45명 (없으면 비워 두기)', 'aria-label': '참여인원' });
      inp2.addEventListener('change', function () {
        var v = this.value.trim(); if (!v) return;
        var lastBox = -1; it.blocks.forEach(function (b, i) { if (b.k === 'box') lastBox = i; });
        var at = lastBox + 1; while (it.blocks[at] && it.blocks[at].k === 'sub') at++;
        it.blocks.splice(at, 0, { k: 'box', label: '참여인원', value: v });
        saveStaff(); render();
      });
      q.appendChild(h('label', null, '참여인원', inp2));
    }
    q.appendChild(h('span', { class: 'lbl', text: '숫자만 고치면 됩니다. 다른 내용이 바뀌었으면 ‘자세히 고치기’' }));
    return q;
  }
  function itemCard(it, st, opts) {
    opts = opts || {};
    var issues = MR.validate(sanitized({ year: st.year, month: st.month, reportDate: 'x', items: [it] })).filter(function (x) { return x.itemId === it.id; });
    var errs = issues.filter(function (x) { return x.level === 'error'; }).length;
    var card = h('div', { class: 'card' });
    card.appendChild(h('div', { class: 'row' }, h('span', { class: 'ct grow', text: it.title || '(제목 없음 — 고치기를 눌러 제목을 쓰세요)' }),
      opts.move ? h('span', { class: 'mv' },
        h('button', { type: 'button', 'aria-label': '위로', text: '▲', onclick: function () { opts.move(it, -1); } }),
        h('button', { type: 'button', 'aria-label': '아래로', text: '▼', onclick: function () { opts.move(it, 1); } })) : null));
    card.appendChild(h('div', { class: 'cmeta' },
      opts.showPart ? h('span', { class: 'chip part', text: it.part }) : null,
      it.needsReview ? h('span', { class: 'chip warn', text: '확인 필요 · ' + (it.fromHist || '과거') + '에서 가져옴' }) : null,
      it.needsResult ? h('span', { class: 'chip warn', text: '실적 고쳐 쓰기 필요' }) : null,
      errs ? h('span', { class: 'chip err', text: '오류 ' + errs }) : null,
      isBlankItem(it) ? h('span', { class: 'chip warn', text: '내용 비어 있음' }) : null));
    var sm = summary(it, 3); if (sm) card.appendChild(h('div', { class: 'csum', text: sm }));
    card.appendChild(h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', text: '고치기', onclick: function () { openEditor(it, st, render); } }),
      it.needsReview ? h('button', { type: 'button', class: 'btn ghost', text: '확인했어요', onclick: function () { it.needsReview = false; touch(); render(); } }) : null,
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn ghost', style: 'color:var(--err)', text: '지우기', onclick: function () {
        confirmBox('항목 지우기', '「' + (it.title || '제목 없음') + '」 항목을 지울까요?', '지우기').then(function (ok) {
          if (!ok) return; st.items.splice(st.items.indexOf(it), 1);
          if (st.carry) Object.keys(st.carry).forEach(function (k) { if (st.carry[k].id === it.id) delete st.carry[k]; });
          touch(); render();
        });
      } })));
    return card;
  }
  function moveIn(st, sec) {
    return function (it, d) {
      var same = st.items.filter(function (i) { return i.sec === sec; });
      var k = same.indexOf(it), j = k + d;
      if (j < 0 || j >= same.length) return;
      var a = st.items.indexOf(it), b = st.items.indexOf(same[j]);
      st.items[a] = same[j]; st.items[b] = it;
      touch(); render();
    };
  }

  /* 3단계: 이번 달 계획 */
  function step3(wz) {
    stepHead(wz, '3. ' + S.month + '월에 할 일(계획)을 넣으세요', '세 가지 방법 중 편한 것을 고르세요. 여러 번 눌러 섞어 써도 됩니다.');
    var ly = sameMonthReport(S);
    wz.appendChild(h('div', { class: 'big-choices', id: 'planChoices' },
      h('button', { type: 'button', class: 'bigc', onclick: function () { pickFromHist(S, 'plan'); } },
        h('b', { text: '📂 작년 같은 달에서' }), h('span', { text: ly ? ymText(ly.y, ly.m) + ' 계획에서 골라 가져옵니다. 연도는 올해로 바뀝니다.' : (HIST_READY ? '같은 달 보고서가 없습니다. 눌러서 지난 보고서(.hwpx)를 가져오세요.' : '과거 보고서를 불러오는 중…') })),
      h('button', { type: 'button', class: 'bigc', onclick: function () { pickFromLib(S, 'plan'); } },
        h('b', { text: '⭐ 자주 쓰는 업무에서' }), h('span', { text: '저장해 둔 반복 업무 ' + LIB.filter(function (u) { return u.part === S.part; }).length + '건 (전체 ' + LIB.length + '건)' })),
      h('button', { type: 'button', class: 'bigc', onclick: function () { chooseTemplate('plan'); } },
        h('b', { text: '✏️ 새로 쓰기' }), h('span', { text: '일정·장소·대상·주요내용 칸에 씁니다. 표가 필요한 업무는 표가 미리 만들어집니다.' }))));
    var list = S.items.filter(function (i) { return i.sec === 'plan'; });
    if (!list.length) wz.appendChild(h('div', { class: 'empty', text: '아직 넣은 계획이 없습니다. 위 세 가지 중 하나를 누르세요.' }));
    else {
      var cards = h('div', { class: 'cards' });
      var mv = moveIn(S, 'plan');
      list.forEach(function (it) { cards.appendChild(itemCard(it, S, { move: mv })); });
      wz.appendChild(h('div', { class: 'row' }, h('b', { text: S.month + '월 계획 ' + list.length + '건' }), h('span', { class: 'lbl', text: '▲▼로 순서를 바꿀 수 있습니다.' })));
      wz.appendChild(cards);
    }
  }
  function sameMonthReport(st) {
    for (var y = st.year - 1; y >= st.year - 5; y--) { var r = histFind(hk(y, st.month)); if (r) return r; }
    return null;
  }
  function chooseTemplate(sec, st, after) {
    st = st || S;
    var pm = MR.prevYM(st.year, st.month);
    var part = UI.view === 'lead' ? null : st.part;
    $('pkTitle').textContent = sec === 'plan' ? st.month + '월 계획 새로 쓰기' : pm.m + '월 성과 새로 쓰기';
    $('pkDesc').textContent = '어떤 모양의 업무인가요? 잘 모르겠으면 ‘일반 업무’를 고르세요.';
    var b = $('pkBody'); b.innerHTML = '';
    var partSel = null;
    if (UI.view === 'lead') {
      partSel = h('select', { 'aria-label': '파트' }); SET.parts.forEach(function (p) { partSel.appendChild(h('option', { value: p, text: p })); });
      b.appendChild(h('div', { class: 'row' }, h('span', { class: 'lbl', text: '파트' }), partSel));
    }
    var g = h('div', { class: 'big-choices' });
    TEMPLATES.forEach(function (t) {
      g.appendChild(h('button', { type: 'button', class: 'bigc', onclick: function () {
        var it = newItem(t.key, sec, part || (partSel && partSel.value) || SET.parts[0], st);
        st.items.push(it); touch(); $('dlgPick').close();
        openEditor(it, st, after || render);
      } }, h('b', { text: t.name }), h('span', { text: t.desc })));
    });
    b.appendChild(g);
    var f = $('pkFoot'); f.innerHTML = '';
    f.appendChild(h('span', { class: 'grow' })); f.appendChild(h('button', { type: 'button', class: 'btn', text: '닫기', onclick: function () { $('dlgPick').close(); } }));
    $('dlgPick').showModal();
  }
  function pickFromHist(st, sec) {
    if (!HIST_READY) { toast('과거 보고서를 불러오는 중입니다. 잠시 후 다시 누르세요'); return; }
    if (!HIST.length) { histImportDialog(); return; }
    var def = sameMonthReport(st) || HIST[0], key = hk(def.y, def.m), pick = {}, shift = true, showAll = false;
    var draw = function () {
      var rep = histFind(key);
      $('pkTitle').textContent = '작년 같은 달에서 가져오기';
      $('pkDesc').textContent = '가져올 항목을 체크하세요. 가져온 항목은 ‘확인 필요’ 표시가 붙으니 날짜·인원을 이번 달에 맞게 고치면 됩니다.';
      var b = $('pkBody'); b.innerHTML = '';
      var sel = h('select', { 'aria-label': '볼 보고서', onchange: function () { key = this.value; pick = {}; draw(); } });
      HIST.forEach(function (r) { sel.appendChild(h('option', { value: hk(r.y, r.m), text: ymText(r.y, r.m) + (r.m === st.month ? ' · 같은 달' : '') })); });
      sel.value = key;
      b.appendChild(h('div', { class: 'row' }, h('span', { class: 'lbl', text: '보고서' }), sel,
        h('label', { class: 'lbl', style: 'display:flex;gap:6px;align-items:center' }, h('input', { type: 'checkbox', checked: shift, onchange: function () { shift = this.checked; } }), '연도를 올해로 바꾸고 요일 다시 계산')));
      var list = rep.items.filter(function (x) { return x.sec === sec; });
      var part = UI.view === 'lead' ? null : st.part;
      var mine = part ? list.filter(function (x) { return x.part === part; }) : list;
      var rest = part ? list.filter(function (x) { return x.part !== part; }) : [];
      var row = function (x) {
        var id = 'pk' + x._k.replace(/\W/g, '_'), have = st.items.some(function (i) { return i.sec === sec && MR.similarity(i.title, x.title) >= 0.6; });
        var pre = h('pre', { class: 'hidden', style: 'white-space:pre-wrap;font-size:13px;background:#F8FAFC;padding:8px;border-radius:6px;margin:0 0 6px 32px', text: x.blocks.map(blockLine).join('\n') });
        return [h('label', { class: 'pick', for: id },
          h('input', { type: 'checkbox', id: id, checked: !!pick[x._k], onchange: function () { if (this.checked) pick[x._k] = x; else delete pick[x._k]; upd(); } }),
          h('span', { class: 'pt', text: x.title }), part ? null : h('span', { class: 'chip part', text: x.part }), have ? h('span', { class: 'chip ok', text: '이미 있음' }) : null,
          h('button', { type: 'button', class: 'btn ghost sm', text: '내용 보기', onclick: function (e) { e.preventDefault(); pre.classList.toggle('hidden'); } })), pre];
      };
      if (part) b.appendChild(h('b', { text: part + ' 파트 ' + mine.length + '건' }));
      if (!mine.length) b.appendChild(h('p', { class: 'lbl', text: '이 보고서에는 ' + (part || '') + ' 파트로 분류된 항목이 없습니다.' }));
      mine.forEach(function (x) { add(b, row(x)); });
      if (rest.length) {
        var det = h('details', { class: 'more' }, h('summary', { text: '다른 파트로 분류된 항목 ' + rest.length + '건 (분류가 틀렸을 수 있습니다)' }));
        det.open = showAll; det.addEventListener('toggle', function () { showAll = det.open; });
        rest.forEach(function (x) { add(det, row(x)); });
        b.appendChild(det);
      }
      var f = $('pkFoot'); f.innerHTML = '';
      var go = h('button', { type: 'button', class: 'btn pri', onclick: function () {
        var l = Object.keys(pick).map(function (k) { return pick[k]; }); if (!l.length) return;
        var added = l.map(function (x) { var c = histCopy({ r: rep, it: x }, sec, st, !shift); if (part) c.part = part; return c; });
        st.items = st.items.concat(added); touch(); $('dlgPick').close(); render();
        toast(added.length + '건을 가져왔습니다. ‘확인 필요’ 항목의 날짜·인원을 이번 달에 맞게 고치세요');
      } });
      var upd = function () { var n = Object.keys(pick).length; go.textContent = '선택한 ' + n + '건 가져오기'; go.disabled = !n; };
      f.appendChild(h('span', { class: 'grow' })); f.appendChild(h('button', { type: 'button', class: 'btn', text: '닫기', onclick: function () { $('dlgPick').close(); } })); f.appendChild(go);
      upd();
    };
    draw(); $('dlgPick').showModal();
  }
  function histImportDialog() {
    $('pkTitle').textContent = '과거 보고서 가져오기';
    $('pkDesc').textContent = DEPT + '의 과거 보고서가 아직 없습니다. 지난 월간업무보고(.hwpx)를 고르면 그 안에서 우리 부서 부분만 보관합니다.';
    var b = $('pkBody'); b.innerHTML = '';
    b.appendChild(h('div', { class: 'notice info', text: '공사 전체 보고서 파일을 그대로 고르면 됩니다. 여러 달을 한꺼번에 골라도 됩니다. 파일은 이 PC 안에서만 읽고 어디로도 보내지 않습니다.' }));
    b.appendChild(h('button', { type: 'button', class: 'btn pri lg', id: 'btnHistImport', text: '보고서(.hwpx) 고르기', onclick: function () {
      pickFiles('.hwpx', true, function (fs) { importHistoryFiles(fs).then(function (n) { if (n) { $('dlgPick').close(); render(); } }); });
    } }));
    var f = $('pkFoot'); f.innerHTML = '';
    f.appendChild(h('span', { class: 'grow' })); f.appendChild(h('button', { type: 'button', class: 'btn', text: '닫기', onclick: function () { $('dlgPick').close(); } }));
    $('dlgPick').showModal();
  }
  function pickFromLib(st, sec) {
    var part = UI.view === 'lead' ? null : st.part, all = !part, pick = {};
    var draw = function () {
      $('pkTitle').textContent = '자주 쓰는 업무에서 가져오기';
      $('pkDesc').textContent = '매달 반복하는 업무를 골라 넣습니다. 편집 화면의 ‘자주 쓰는 업무로 저장’을 누르면 여기에 쌓입니다.';
      var b = $('pkBody'); b.innerHTML = '';
      if (part) b.appendChild(h('label', { class: 'lbl', style: 'display:flex;gap:6px;align-items:center' }, h('input', { type: 'checkbox', checked: all, onchange: function () { all = this.checked; draw(); } }), '다른 파트 업무도 보기'));
      var list = LIB.filter(function (u) { return all || u.part === part; });
      if (!list.length) b.appendChild(h('div', { class: 'empty', text: '저장된 업무가 없습니다. 항목을 쓴 뒤 편집 화면 아래 ‘자주 쓰는 업무로 저장’을 누르면 다음 달부터 여기서 고를 수 있습니다.' }));
      list.forEach(function (u) {
        var id = 'lb' + u.id;
        b.appendChild(h('label', { class: 'pick', for: id },
          h('input', { type: 'checkbox', id: id, checked: !!pick[u.id], onchange: function () { if (this.checked) pick[u.id] = u; else delete pick[u.id]; upd(); } }),
          h('span', { class: 'pt', text: u.title }), h('span', { class: 'chip part', text: u.part }), h('span', { class: 'lbl', text: u.savedAt || '' })));
      });
      var f = $('pkFoot'); f.innerHTML = '';
      var go = h('button', { type: 'button', class: 'btn pri', onclick: function () {
        var l = Object.keys(pick).map(function (k) { return pick[k]; }); if (!l.length) return;
        l.forEach(function (u) { st.items.push({ id: MR.uid(), sec: sec, part: part || u.part, type: u.type, title: u.title, blocks: MR.clone(u.blocks), needsResult: false, fromPrev: false, needsReview: true, fromHist: '자주 쓰는 업무' }); });
        touch(); $('dlgPick').close(); render(); toast(l.length + '건을 넣었습니다. 날짜·인원을 이번 달 내용으로 고치세요');
      } });
      var upd = function () { var n = Object.keys(pick).length; go.textContent = '선택한 ' + n + '건 넣기'; go.disabled = !n; };
      f.appendChild(h('span', { class: 'grow' })); f.appendChild(h('button', { type: 'button', class: 'btn', text: '닫기', onclick: function () { $('dlgPick').close(); } })); f.appendChild(go);
      upd();
    };
    draw(); $('dlgPick').showModal();
  }

  /* 4단계: 확인·제출 */
  function staffIssues() {
    var st = sanitized(S); st.reportDate = 'x';
    var list = MR.validate(st);
    S.items.forEach(function (it) { if (isBlankItem(it)) list.push({ level: 'warn', itemId: it.id, msg: '내용이 비어 있습니다 — 칸을 채우거나 항목을 지우세요' }); });
    var pool = prevPool();
    if (pool) {
      var waiting = 0;
      pool.items.forEach(function (x, i) { if (x.part === S.part && !S.carry[poolKey(pool, x, i)]) waiting++; });
      if (waiting) list.unshift({ level: 'warn', itemId: null, step: 2, msg: '지난달 계획 중 아직 ‘예정대로 함 / 변경됨 / 취소’를 고르지 않은 카드가 ' + waiting + '건 있습니다' });
    }
    if (!count('plan')) list.unshift({ level: 'warn', itemId: null, step: 3, msg: S.month + '월 계획이 한 건도 없습니다' });
    return list;
  }
  function checkList(list, st, goto) {
    var box = h('div', { class: 'checks' });
    var e = list.filter(function (x) { return x.level === 'error'; }).length, w = list.length - e;
    box.appendChild(h('div', { class: 'row' }, h('span', { class: 'chip ' + (e ? 'err' : 'ok'), text: '오류 ' + e }), h('span', { class: 'chip ' + (w ? 'warn' : 'ok'), text: '확인할 것 ' + w })));
    if (!list.length) { box.appendChild(h('div', { class: 'msg ok', text: '빠진 것이 없습니다. 날짜·요일·연도·제목 검사도 통과했습니다.' })); return box; }
    list.sort(function (a, b) { return (a.level === 'error' ? 0 : 1) - (b.level === 'error' ? 0 : 1); });
    list.forEach(function (x) {
      var it = st.items.filter(function (i) { return i.id === x.itemId; })[0];
      box.appendChild(h('button', { type: 'button', class: 'msg ' + x.level, onclick: function () {
        if (it) openEditor(it, st, render); else if (x.step) goto(x.step);
      } }, it ? h('small', { text: (it.sec === 'plan' ? '계획' : '결과') + ' · ' + (it.title || '제목 없음') + ' — 눌러서 고치기' }) : (x.step ? h('small', { text: x.step + '단계로 가기' }) : null), x.msg));
    });
    return box;
  }
  function step4(wz) {
    stepHead(wz, '4. 확인하고 제출하세요', '빠진 것을 확인한 뒤 ‘제출하기’를 누르면 파일 1개가 내려받아집니다. 그 파일을 팀장에게 보내면 끝입니다.');
    var list = staffIssues();
    wz.appendChild(h('div', { class: 'panel', style: 'padding:16px 18px;display:flex;flex-direction:column;gap:10px' }, h('b', { text: '빠진 것 확인' }), checkList(list, S, goStep)));
    var fname = submitName();
    var errs = list.filter(function (x) { return x.level === 'error'; }).length;
    wz.appendChild(h('div', { class: 'panel', style: 'padding:18px;display:flex;flex-direction:column;gap:12px' },
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn pri lg', id: 'btnSubmit', text: '제출하기', onclick: function () { doSubmit(errs); } }),
        h('span', { class: 'lbl', text: '내려받을 파일: ' + fname })),
      S.submittedAt ? h('div', { class: 'notice ok', text: '마지막 제출 파일: ' + S.submittedAt.replace('T', ' ').slice(0, 16) + ' — 고친 뒤 다시 제출하면 팀장 쪽에서는 새 파일로 바뀝니다.' }) : null,
      h('div', { class: 'lbl', text: '제출 파일은 메신저 첨부나 공유 폴더로 팀장에게 보내세요. 팀장 화면에 끌어다 놓으면 자동으로 합쳐집니다.' })));
    var pv = h('div', { class: 'previewwrap' }); pv.appendChild(paper(sanitized(S), { part: S.part }));
    wz.appendChild(h('div', { class: 'panel', style: 'padding:16px 18px;display:flex;flex-direction:column;gap:10px' }, h('b', { text: '미리보기 (내 파트만)' }), pv));
  }
  function submitName() { return S.year + '년 ' + S.month + '월_' + S.part + '.월보'; }
  function doSubmit(errs) {
    var go = errs ? confirmBox('오류가 남아 있습니다', '날짜·요일 오류 등 ' + errs + '건이 있습니다. 그래도 제출할까요? (빨간 줄을 누르면 바로 고칠 수 있습니다)', '그래도 제출', '고치러 가기') : Promise.resolve(true);
    go.then(function (ok) {
      if (!ok) return;
      var o = { app: 'jangan-monthly-report', version: 1, kind: 'submit', dept: DEPT, year: S.year, month: S.month, reportDate: '', part: S.part, savedAt: new Date().toISOString(), carry: S.carry,
        items: S.items.map(function (i) { var c = sanitizeItem(i); c.part = S.part; return c; }) };
      download(submitName(), new Blob([JSON.stringify(o, null, 1)], { type: 'application/json' }));
      S.submittedAt = new Date().toISOString(); saveStaffNow(); render();
      toast('제출 파일을 만들었습니다: ' + submitName() + ' — 팀장에게 보내세요');
    });
  }

  /* ---------- 미리보기 종이 ---------- */
  function previewTable(blk) {
    var t = blk.k === 'stat' ? MR.statToTable(blk) : blk;
    var tb = h('table');
    t.rows.forEach(function (row, ri) {
      tb.appendChild(h('tr', null, row.map(function (c) { return h('td', { class: ri < (t.head || 0) ? 'h' : null, colspan: c.cs > 1 ? c.cs : null, rowspan: c.rs > 1 ? c.rs : null, style: 'white-space:pre-line', text: c.t }); })));
    });
    return tb;
  }
  function paper(st, opts) {
    opts = opts || {};
    var pm = MR.prevYM(st.year, st.month);
    var p = h('div', { class: 'paper' });
    if (!opts.part && !opts.compact) {
      p.appendChild(h('div', { style: 'text-align:center', text: '『시민이 행복한 도시환경 창조』' }));
      p.appendChild(h('div', { style: 'text-align:right', text: MR.fmtCoverDate(st.reportDate) + ' 서면보고' }));
      p.appendChild(h('div', { class: 'cover' }, h('div', { text: '수원의 미래가치 디자이너 수원도시공사' }), h('div', { style: 'font-size:22px;font-weight:700', text: st.year + '년 ' + st.month + '월 월간업무보고' })));
    }
    [['plan', st.year + '년 ' + st.month + '월', '주요업무계획'], ['result', pm.y + '년 ' + pm.m + '월', '주요업무성과']].forEach(function (s) {
      var items = st.items.filter(function (i) { return i.sec === s[0]; });
      if (s[0] === 'result' && !items.length) return;
      if (!opts.compact) {
        p.appendChild(h('div', { class: 'secdiv', text: '- ' + s[1] + ' -  ' + s[2] }));
        p.appendChild(h('div', { class: 'fac', text: DEPT + (opts.part ? ' · ' + opts.part + ' 파트' : '') }));
      }
      if (!items.length) p.appendChild(h('div', { class: 'lbl', text: '(항목 없음)' }));
      items.forEach(function (it, n) {
        p.appendChild(h('div', { class: 'pt' }, h('span', { class: 'n', text: String(n + 1) }), h('b', { text: it.title })));
        it.blocks.forEach(function (b) {
          if (b.k === 'box') p.appendChild(h('div', { text: ' □ ' + MR.boxText(b) }));
          else if (b.k === 'sub') p.appendChild(h('div', { style: 'padding-left:16px', text: '○ ' + b.text }));
          else if (b.k === 'note') p.appendChild(h('div', { style: 'padding-left:16px;font-size:13px', text: '※ ' + b.text }));
          else if (b.k === 'unit') p.appendChild(h('div', { style: 'text-align:right;font-size:12px', text: b.text }));
          else if (b.k === 'plain') p.appendChild(h('div', { style: 'white-space:pre', text: b.text }));
          else { if (b.k === 'stat' && b.unit) p.appendChild(h('div', { style: 'text-align:right;font-size:12px', text: b.unit })); p.appendChild(previewTable(b)); }
        });
      });
    });
    return p;
  }
  function showPreview(st, opts) {
    $('pkTitle').textContent = '미리보기';
    $('pkDesc').textContent = '대략적인 모양입니다. 글꼴·쪽 나눔은 HWPX를 한글에서 열면 원본 서식으로 적용됩니다.';
    var b = $('pkBody'); b.innerHTML = '';
    var w = h('div', { class: 'previewwrap', style: 'max-height:none' }); w.appendChild(paper(sanitized(st), opts)); b.appendChild(w);
    var f = $('pkFoot'); f.innerHTML = '';
    f.appendChild(h('span', { class: 'grow' })); f.appendChild(h('button', { type: 'button', class: 'btn', text: '닫기', onclick: function () { $('dlgPick').close(); } }));
    if (UI.view === 'lead') f.appendChild(h('button', { type: 'button', class: 'btn pri', text: 'HWPX 만들기', onclick: function () { $('dlgPick').close(); doExport(); } }));
    $('dlgPick').showModal();
  }

  /* ======================================================================
     팀장 화면
     ====================================================================== */
  function renderLead(app) {
    var wrap = h('div', { class: 'lead' });
    /* 1. 보고월·서면보고일 */
    var sy = h('select', { 'aria-label': '보고 연도' }), sm = h('select', { 'aria-label': '보고 월' });
    for (var y = 2025; y <= 2030; y++) sy.appendChild(h('option', { value: y, text: y + '년' }));
    for (var m = 1; m <= 12; m++) sm.appendChild(h('option', { value: m, text: m + '월호' }));
    sy.value = L.year; sm.value = L.month;
    sy.onchange = sm.onchange = function () { openLeadWork(+sy.value, +sm.value); render(); };
    var rd = h('input', { type: 'date', value: L.reportDate || '', 'aria-label': '서면보고일', onchange: function () { L.reportDate = this.value; saveLead(); render(); } });
    wrap.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'row' }, h('b', { text: '보고월' }), sy, sm, h('span', { style: 'width:16px' }), h('b', { text: '서면보고일(표지)' }), rd,
        h('span', { class: 'chip', text: L.reportDate ? '표지: ' + MR.fmtCoverDate(L.reportDate) : '아직 안 고름' }))));

    /* 진행 안내 */
    var allParts = SET.parts.slice(); L.items.forEach(function (i) { if (allParts.indexOf(i.part) < 0) allParts.push(i.part); });
    var inParts = allParts.filter(function (p) { return L.received[p] || L.items.some(function (i) { return i.part === p; }); });
    var waitParts = allParts.filter(function (p) { return inParts.indexOf(p) < 0; });
    var goto = function (id) { return function () { var e = $(id); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; };
    wrap.appendChild(h('nav', { class: 'leadnav', 'aria-label': '팀장 작업 순서' },
      h('button', { type: 'button', onclick: goto('panelRecv') }, h('b', { text: '1' }), ' 제출 파일 모으기'),
      h('button', { type: 'button', onclick: goto('panelOrder') }, h('b', { text: '2' }), ' 순서 정리'),
      h('button', { type: 'button', onclick: goto('panelMake') }, h('b', { text: '3' }), ' 확인하고 만들기')));
    wrap.appendChild(h('div', { class: 'leadsum notice ' + (!L.items.length ? 'info' : waitParts.length ? 'info' : 'ok') },
      !L.items.length ? '아직 받은 내용이 없습니다. 아래 ‘1. 제출 파일 모으기’에 직원들이 보낸 .월보 파일을 끌어다 놓으세요.'
        : allParts.length > 1 ? allParts.length + '개 파트 중 ' + inParts.length + '개 들어왔습니다.' + (waitParts.length ? ' 아직 없는 파트: ' + waitParts.join(', ') : ' 모두 들어왔습니다. 순서를 확인하고 만들면 됩니다.')
          : '내용이 들어왔습니다. 순서를 확인하고 만들면 됩니다.'));

    /* 2. 제출 파일 받기 */
    var drop = h('div', { class: 'drop', id: 'dropZone' },
      h('b', { text: '직원들이 보낸 제출 파일(.월보)을 여기에 끌어다 놓으세요' }),
      h('span', { class: 'lbl', text: '여러 개를 한꺼번에 놓아도 됩니다. 같은 파트를 다시 놓으면 새 파일 내용으로 바뀝니다. 예전 도구의 .json 파트 파일도 됩니다.' }),
      h('button', { type: 'button', class: 'btn', text: '파일 고르기', onclick: function () { pickFiles('.월보,.json', true, receiveFiles); } }));
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { var fs = Array.prototype.slice.call(e.dataTransfer.files || []); if (fs.length) receiveFiles(fs); });
    var tbl = h('table', { class: 'stbl' }, h('tr', null, h('th', { text: '파트' }), h('th', { text: '상태' }), h('th', { text: '계획' }), h('th', { text: '결과' }), h('th', { text: '받은 파일' }), h('th', { text: '' })));
    var parts = SET.parts.slice();
    L.items.forEach(function (i) { if (parts.indexOf(i.part) < 0) parts.push(i.part); });
    parts.forEach(function (p) {
      var rc = L.received[p], np = L.items.filter(function (i) { return i.part === p && i.sec === 'plan'; }).length, nr = L.items.filter(function (i) { return i.part === p && i.sec === 'result'; }).length;
      var has = np + nr > 0;
      tbl.appendChild(h('tr', null, h('td', null, h('b', { text: p })),
        h('td', null, rc ? h('span', { class: 'chip ok', text: '제출됨' }) : has ? h('span', { class: 'chip part', text: '직접 입력' }) : h('span', { class: 'chip warn', text: '미제출' })),
        h('td', { text: np + '건' }), h('td', { text: nr + '건' }),
        h('td', { class: 'lbl', text: rc ? rc.file + ' · ' + String(rc.at || '').replace('T', ' ').slice(5, 16) : '' }),
        h('td', null, has ? h('button', { type: 'button', class: 'btn ghost sm', style: 'color:var(--err)', text: '이 파트 빼기', onclick: function () {
          confirmBox('파트 빼기', p + ' 파트 항목 ' + (np + nr) + '건을 이번 보고서에서 뺄까요? 제출 파일을 다시 놓으면 다시 들어옵니다.', '빼기').then(function (ok) {
            if (!ok) return; L.items = L.items.filter(function (i) { return i.part !== p; }); delete L.received[p]; saveLead(); render();
          });
        } }) : null)));
    });
    var mineBtn = null, mine = myStaffWorks();
    if (mine.length) mineBtn = h('button', { type: 'button', class: 'btn sm', text: '이 PC에서 직원 화면으로 쓴 내용 가져오기 (' + mine.map(function (w) { return w.part; }).join(', ') + ')', onclick: function () {
      mine.forEach(function (w) { mergePart(w.part, w.items.map(sanitizeItem), '이 PC 직원 화면'); }); saveLead(); render(); toast('가져왔습니다');
    } });
    wrap.appendChild(h('div', { class: 'panel', id: 'panelRecv' }, h('h2', { text: '1. 제출 파일 모으기' }), drop, h('div', { style: 'height:12px' }), mineBtn, h('div', { style: 'overflow-x:auto;margin-top:8px' }, tbl)));

    /* 3. 순서 정리 */
    var pm = MR.prevYM(L.year, L.month);
    var col = function (sec, title) {
      var list = L.items.filter(function (i) { return i.sec === sec; }), mv = moveIn(L, sec);
      var ol = h('div', { class: 'olist' });
      if (!list.length) ol.appendChild(h('div', { class: 'lbl', text: '아직 없습니다.' }));
      list.forEach(function (it, n) {
        var flags = it.needsResult || it.needsReview;
        ol.appendChild(h('div', dragAttrs(it, sec), h('span', { class: 'grip', 'aria-hidden': 'true', text: '⠿' }), h('span', { class: 'no', text: String(n + 1) }),
          h('span', { class: 'chip part', text: it.part }),
          h('button', { type: 'button', class: 'tt', title: '눌러서 고치기', text: it.title || '(제목 없음)', onclick: function () { openEditor(it, L, render); } }),
          flags ? h('span', { class: 'chip warn', text: '확인 필요' }) : null,
          h('span', { class: 'mv' }, h('button', { type: 'button', 'aria-label': '위로', text: '▲', onclick: function () { mv(it, -1); } }), h('button', { type: 'button', 'aria-label': '아래로', text: '▼', onclick: function () { mv(it, 1); } }))));
      });
      return h('div', null, h('div', { class: 'row', style: 'margin-bottom:8px' }, h('b', { text: title + ' ' + list.length + '건' }), h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'btn sm', text: '+ 직접 쓰기', onclick: function () { chooseTemplate(sec, L); } })), ol);
    };
    wrap.appendChild(h('div', { class: 'panel', id: 'panelOrder' }, h('div', { class: 'row' }, h('h2', { class: 'grow', text: '2. 순서 정리' }),
      h('button', { type: 'button', class: 'btn sm', text: '파트 순서대로 정렬', onclick: sortByPart })),
      h('p', { class: 'lbl', style: 'margin:0 0 12px', text: '제목을 누르면 고칠 수 있고, 줄을 끌어서 옮기거나 ▲▼로 보고서 순서를 바꿉니다.' }),
      h('div', { class: 'cols2' }, col('plan', L.month + '월 계획'), col('result', pm.m + '월 성과'))));

    /* 4. 확인·만들기 */
    var issues = MR.validate(sanitized(L));
    L.items.forEach(function (it) { if (isBlankItem(it)) issues.push({ level: 'warn', itemId: it.id, msg: '내용이 비어 있습니다' }); });
    var missing = SET.parts.length > 1 ? SET.parts.filter(function (p) { return !L.items.some(function (i) { return i.part === p; }); }) : [];
    if (missing.length) issues.unshift({ level: 'warn', itemId: null, msg: '아직 항목이 없는 파트: ' + missing.join(', ') });
    var other = h('details', { class: 'more' }, h('summary', { text: '다른 파일 열기·저장' }),
      h('div', { class: 'actions', style: 'margin-top:10px' },
        h('button', { type: 'button', class: 'btn sm', text: '작업 파일(.json) 열기', onclick: openWorkJson }),
        h('button', { type: 'button', class: 'btn sm', text: '기존 보고서(.hwpx) 열기', onclick: openHwpxReplace }),
        h('button', { type: 'button', class: 'btn sm', text: '전체 작업 파일(.json) 저장', onclick: function () {
          var o = { app: 'jangan-monthly-report', version: 1, dept: DEPT, year: L.year, month: L.month, reportDate: L.reportDate, part: null, savedAt: new Date().toISOString(), items: L.items };
          download(L.year + '년' + L.month + '월호_전체.json', new Blob([JSON.stringify(o, null, 1)], { type: 'application/json' }));
        } }),
        h('button', { type: 'button', class: 'btn danger sm', text: '이 달 모은 내용 모두 지우기', onclick: function () {
          confirmBox('모두 지우기', ymText(L.year, L.month) + '에 모은 항목 ' + L.items.length + '건을 모두 지웁니다.', '지우기').then(function (ok) { if (ok) { L.items = []; L.received = {}; saveLead(); render(); } });
        } })));
    wrap.appendChild(h('div', { class: 'panel', id: 'panelMake' }, h('h2', { text: '3. 확인하고 만들기' }),
      checkList(issues, L, function () {}),
      h('div', { class: 'actions', style: 'margin-top:14px' },
        h('button', { type: 'button', class: 'btn lg', text: '미리보기', onclick: function () { showPreview(L); } }),
        h('button', { type: 'button', class: 'btn pri lg', id: 'btnExport', text: 'HWPX 만들기', onclick: doExport }),
        h('button', { type: 'button', class: 'btn lg', id: 'btnDist', text: '다음 달 배포판 만들기', onclick: makeDist })),
      h('p', { class: 'lbl', text: '‘다음 달 배포판’은 이번 달 계획이 들어간 배포 자료(.js)를 만듭니다. 웹 폴더의 js/dist-data.js 에 반영하면 다음 달 ‘지난달 결과’ 단계에 이 계획이 바로 카드로 나옵니다.' }),
      other));
    app.appendChild(wrap);
  }
  var DRAG = null;
  function dragAttrs(it, sec) {
    return { class: 'oitem', draggable: 'true',
      ondragstart: function (e) { DRAG = it; this.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', it.id); } catch (x) {} },
      ondragend: function () { DRAG = null; this.classList.remove('dragging'); },
      ondragover: function (e) { if (DRAG && DRAG !== it && DRAG.sec === sec) { e.preventDefault(); this.classList.add('dropat'); } },
      ondragleave: function () { this.classList.remove('dropat'); },
      ondrop: function (e) {
        e.preventDefault(); e.stopPropagation();
        if (!DRAG || DRAG === it || DRAG.sec !== sec) return;
        var from = L.items.indexOf(DRAG), was = L.items.indexOf(it);
        L.items.splice(from, 1);
        var to = L.items.indexOf(it); if (from < was) to++;
        L.items.splice(to, 0, DRAG); DRAG = null; saveLead(); render();
      } };
  }
  function myStaffWorks() {
    return Object.keys(STAFF.ws).map(function (k) { return STAFF.ws[k]; }).filter(function (w) { return w.year === L.year && w.month === L.month && (w.dept || DEF_DEPT) === DEPT && w.part && w.items.length; });
  }
  function sortByPart() {
    var order = SET.parts;
    var rank = function (p) { var i = order.indexOf(p); return i < 0 ? 99 : i; };
    ['plan', 'result'].forEach(function () {});
    var idx = {}; L.items.forEach(function (it, i) { idx[it.id] = i; });
    L.items.sort(function (a, b) { return (a.sec === b.sec ? 0 : (a.sec === 'plan' ? -1 : 1)) || rank(a.part) - rank(b.part) || idx[a.id] - idx[b.id]; });
    saveLead(); render();
  }
  /* 같은 파트 항목은 처음 있던 자리에서 새 내용으로 바꿈 */
  function mergePart(part, items, fileName) {
    items = items.map(function (i) { var c = MR.clone(i); c.part = part; if (!c.id || L.items.some(function (x) { return x.id === c.id && x.part !== part; })) c.id = MR.uid(); return c; });
    ['plan', 'result'].forEach(function (sec) {
      var incoming = items.filter(function (i) { return i.sec === sec; });
      var firstOld = -1;
      L.items.forEach(function (i, n) { if (firstOld < 0 && i.part === part && i.sec === sec) firstOld = n; });
      var rest = L.items.filter(function (i) { return !(i.part === part && i.sec === sec); });
      if (firstOld < 0) {
        var lastSec = -1; rest.forEach(function (i, n) { if (i.sec === sec) lastSec = n; });
        if (lastSec < 0) lastSec = sec === 'plan' ? -1 : rest.length - 1;
        rest.splice.apply(rest, [lastSec + 1, 0].concat(incoming));
      } else {
        var before = L.items.slice(0, firstOld).filter(function (i) { return !(i.part === part && i.sec === sec); }).length;
        rest.splice.apply(rest, [before, 0].concat(incoming));
      }
      L.items = rest;
    });
    L.received[part] = { at: new Date().toISOString(), file: fileName, plan: items.filter(function (i) { return i.sec === 'plan'; }).length, result: items.filter(function (i) { return i.sec === 'result'; }).length };
  }
  function receiveFiles(fs) {
    Promise.all(fs.map(function (f) { return readText(f).then(parseJson).then(function (o) { return { f: f, o: o }; }, function (e) { return { f: f, err: e }; }); })).then(function (list) {
      var bad = list.filter(function (x) { return x.err; }), good = list.filter(function (x) { return !x.err; });
      var diff = good.filter(function (x) { return x.o.year !== L.year || x.o.month !== L.month; });
      var go;
      if (diff.length && !L.items.length && good.every(function (x) { return x.o.year === good[0].o.year && x.o.month === good[0].o.month; })) {
        openLeadWork(good[0].o.year, good[0].o.month); go = Promise.resolve(true);
      } else if (diff.length) {
        go = confirmBox('보고월이 다른 파일', diff.map(function (x) { return x.f.name + ' (' + ymText(x.o.year, x.o.month) + ')'; }).join(', ') + ' — 지금은 ' + ymText(L.year, L.month) + '을 만들고 있습니다. 그래도 합칠까요?', '그래도 합치기', '다른 달 파일은 빼기');
      } else go = Promise.resolve(true);
      go.then(function (okDiff) {
        var msgs = [];
        good.forEach(function (x) {
          if (!okDiff && (x.o.year !== L.year || x.o.month !== L.month)) return;
          var o = x.o;
          if (o.part) { mergePart(o.part, o.items, x.f.name); msgs.push(o.part + ' ' + o.items.length + '건'); }
          else {
            var byPart = {};
            o.items.forEach(function (i) { (byPart[i.part] = byPart[i.part] || []).push(i); });
            Object.keys(byPart).forEach(function (p) { mergePart(p, byPart[p], x.f.name); });
            msgs.push('전체 ' + o.items.length + '건');
          }
          if (o.reportDate && !L.reportDate) L.reportDate = o.reportDate;
        });
        saveLead(); render();
        toast((msgs.length ? '합쳤습니다: ' + msgs.join(', ') : '합친 파일이 없습니다') + (bad.length ? ' / 읽지 못한 파일: ' + bad.map(function (x) { return x.f.name + '(' + x.err.message + ')'; }).join(' · ') : ''));
      });
    });
  }
  function openWorkJson() {
    pickFiles('.json,.월보', false, function (fs) {
      readText(fs[0]).then(parseJson).then(function (o) {
        return confirmBox('작업 파일 열기', '지금 모은 내용을 「' + fs[0].name + '」(' + ymText(o.year, o.month) + ', ' + o.items.length + '건)로 바꿉니다.', '열기').then(function (ok) {
          if (!ok) return; openLeadWork(o.year, o.month); L.items = o.items; L.reportDate = o.reportDate || L.reportDate || ''; L.received = {}; saveLead(); render(); toast('열었습니다');
        });
      }).catch(function (e) { toast('열 수 없습니다: ' + e.message); });
    });
  }
  function openHwpxReplace() {
    pickFiles('.hwpx', false, function (fs) {
      readBuf(fs[0]).then(importHwpx).then(function (r) {
        return confirmBox('기존 보고서 열기', '「' + fs[0].name + '」에서 계획 ' + r.items.filter(function (i) { return i.sec === 'plan'; }).length + '건, 성과 ' + r.items.filter(function (i) { return i.sec === 'result'; }).length + '건을 읽었습니다. 지금 모은 내용을 이것으로 바꿀까요?', '바꾸기').then(function (ok) {
          if (!ok) return; openLeadWork(r.meta.year || L.year, r.meta.month || L.month); L.items = r.items; L.received = {}; saveLead(); render(); toast('가져왔습니다');
        });
      }).catch(function (e) { toast('읽을 수 없습니다: ' + e.message); });
    });
  }
  function doExport() {
    var st = sanitized(L); st.dept = DEPT;
    var issues = MR.validate(st), e = issues.filter(function (x) { return x.level === 'error'; }).length;
    if (!st.items.length) { toast('모은 항목이 없습니다'); return; }
    var go = e ? confirmBox('오류가 있습니다', '날짜·요일 오류 등 ' + e + '건이 남아 있습니다. 그대로 만들까요?', '그대로 만들기') : Promise.resolve(true);
    go.then(function (ok) {
      if (!ok) return;
      var bin = atob(TPL.basePkg), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return JSZip.loadAsync(u8).then(function (z) {
        z.file('Contents/section0.xml', MR.buildSection(TPL, st));
        z.file('Preview/PrvText.txt', MR.previewText(st));
        z.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
        return z.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/hwp+zip' });
      }).then(function (blob) {
        download(L.year + '년 ' + L.month + '월 월간업무보고(' + DEPT + ').hwpx', blob);
        addHistory({ y: L.year, m: L.month, items: st.items.map(plainCopy) });
        L.exportedAt = new Date().toISOString(); saveLead();
        toast('HWPX를 만들었습니다. 이 PC의 과거 보고서에도 보관했습니다. 다음은 ‘다음 달 배포판 만들기’');
      });
    }).catch(function (err) { toast('만들기 실패: ' + err.message); });
  }
  function makeDist() {
    var st = sanitized(L);
    if (!st.items.some(function (i) { return i.sec === 'plan'; })) { toast(L.month + '월 계획이 없어 배포판을 만들 수 없습니다'); return; }
    var nm = nextYM(L.year, L.month);
    var hist = ((EMBED && EMBED.hist) || []).filter(function (r) { return !(r.y === L.year && r.m === L.month); });
    hist.push({ y: L.year, m: L.month, items: st.items.map(plainCopy) });
    hist.sort(function (a, b) { return (b.y * 12 + b.m) - (a.y * 12 + a.m); });
    hist = hist.slice(0, 24);
    var embed = { app: 'jangan-monthly-report-dist', version: 2, dept: DEPT, year: nm.y, month: nm.m, base: { y: L.year, m: L.month }, createdAt: new Date().toISOString(), hist: hist, settings: SET, library: LIB };
    var js = '/* 월간업무보고 쉬운 작성 — ' + DEPT + ' ' + nm.y + '년 ' + nm.m + '월호 배포 자료 (' + L.year + '년 ' + L.month + '월 계획 포함) */\n(window.EASY_EMBEDS = window.EASY_EMBEDS || []).push(' + JSON.stringify(embed).replace(/</g, '\\u003c') + ');\n';
    download('dist-data_' + DEPT + '.js', new Blob([js], { type: 'text/javascript;charset=utf-8' }));
    confirmBox('배포 자료를 만들었습니다', '내려받은 「dist-data_' + DEPT + '.js」를 웹 폴더의 js/dist-data.js 에 반영하세요. 우리 부서 전용 웹이면 이 파일 내용으로 바꾸고, 공사 공용 웹이면 설정의 ‘배포 자료 합치기’로 다른 부서 자료와 하나로 만든 뒤 바꿉니다. 그러면 ' + DEPT + ' 직원이 같은 주소를 열 때 ' + nm.m + '월호 ‘지난달 결과’ 카드가 자동으로 나옵니다.', '알겠습니다', '닫기');
  }
  /* 배포 자료(.js) 여러 개를 부서별 최신 것 하나씩만 남겨 dist-data.js 하나로 합침 */
  function scanEmbeds(text) {
    var out = [], re = /(?:\.push\(|EASY_EMBED\s*=)\s*/g, m;
    while ((m = re.exec(text))) {
      var i = re.lastIndex; if (text.charAt(i) !== '{') continue;
      var depth = 0, str = false, esc = false, j = i;
      for (; j < text.length; j++) {
        var ch = text.charAt(j);
        if (str) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') str = false; continue; }
        if (ch === '"') str = true; else if (ch === '{') depth++; else if (ch === '}') { depth--; if (!depth) break; }
      }
      try { var o = JSON.parse(text.slice(i, j + 1)); if (o && o.app === 'jangan-monthly-report-dist') out.push(o); } catch (e) {}
    }
    return out;
  }
  function mergeDist(files) {
    Promise.all(files.map(readText)).then(function (texts) {
      var best = {}, total = 0;
      texts.forEach(function (t) {
        scanEmbeds(t).forEach(function (o) {
          total++; var d = o.dept || DEF_DEPT, cur = best[d];
          if (!cur || (o.year * 12 + o.month) > (cur.year * 12 + cur.month) || ((o.year * 12 + o.month) === (cur.year * 12 + cur.month) && String(o.createdAt) > String(cur.createdAt))) best[d] = o;
        });
      });
      var names = Object.keys(best);
      if (!names.length) { toast('배포 자료를 찾지 못했습니다. dist-data_부서.js 파일을 고르세요'); return; }
      var js = '/* 월간업무보고 쉬운 작성 — 공용 배포 자료 (' + names.length + '개 부서) */\n' + names.map(function (d) {
        return '(window.EASY_EMBEDS = window.EASY_EMBEDS || []).push(' + JSON.stringify(best[d]).replace(/</g, '\\u003c') + ');';
      }).join('\n') + '\n';
      download('dist-data.js', new Blob([js], { type: 'text/javascript;charset=utf-8' }));
      toast('합쳤습니다: ' + names.map(function (d) { return d + ' ' + best[d].year + '년 ' + best[d].month + '월호'; }).join(', ') + ' (읽은 자료 ' + total + '개) — 내려받은 dist-data.js 로 js/dist-data.js 를 바꾸세요');
    }).catch(function (e) { toast('합칠 수 없습니다: ' + e.message); });
  }

  /* ---------- 설정 화면 ---------- */
  function renderSettings(app) {
    var v = h('div', { class: 'view' });
    v.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', text: '← 돌아가기', onclick: function () { UI.view = UI.settingsFrom; render(); } })));
    v.appendChild(h('div', { class: 'panel' }, h('h2', { text: '내 부서: ' + DEPT }),
      h('p', { class: 'desc', text: '아래 설정·자주 쓰는 업무·과거 보고서는 부서마다 따로 저장됩니다. 다른 부서 것을 바꾸려면 부서를 먼저 바꾸세요.' }),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', text: '부서 바꾸기', onclick: function () { UI.view = 'dept'; render(); } }),
        DEPTCFG.custom.indexOf(DEPT) >= 0 ? h('button', { type: 'button', class: 'btn danger', text: '직접 입력한 이 부서를 목록에서 지우기', onclick: function () {
          confirmBox('목록에서 지우기', '「' + DEPT + '」을(를) 부서 목록에서 지웁니다. 저장된 작업은 남아 있으니 같은 이름으로 다시 추가하면 이어서 쓸 수 있습니다.', '지우기').then(function (ok) {
            if (!ok) return; DEPTCFG.custom = DEPTCFG.custom.filter(function (d) { return d !== DEPT; }); DEPTCFG.cur = null; saveKey(DEPT_KEY, DEPTCFG); UI.view = 'start'; render();
          });
        } }) : null)));
    v.appendChild(h('div', { class: 'panel' }, h('h2', { text: '과거 보고서 가져오기' }),
      h('p', { class: 'desc', text: '공사 전체 월간업무보고(.hwpx)를 여러 개 고르면, 그 안에서 「' + DEPT + '」 부분만 골라 이 PC에 보관합니다. ‘작년 같은 달에서’와 지난달 카드에 쓰입니다.' + (DEPT === DEF_DEPT ? ' (장안구민회관은 2024~2026년 보고서가 이미 들어 있습니다.)' : '') }),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', text: '보고서(.hwpx) 고르기', onclick: function () { pickFiles('.hwpx', true, function (fs) { importHistoryFiles(fs).then(function () { render(); }); }); } }),
        h('span', { class: 'lbl', text: '지금 보관된 보고서: ' + (HIST_READY ? HIST.length + '개월분' : '불러오는 중') }))));
    v.appendChild(h('div', { class: 'panel' }, h('h2', { text: '배포 자료 합치기 (공사 공용 웹 관리자용)' }),
      h('p', { class: 'desc', text: '각 부서 팀장이 만든 dist-data_부서.js 파일을 한꺼번에 고르면, 부서별 최신 자료만 남겨 dist-data.js 하나로 합칩니다. 이 파일로 웹 폴더의 js/dist-data.js 를 바꾸세요.' }),
      h('button', { type: 'button', class: 'btn', text: '배포 자료(.js) 고르기', onclick: function () { pickFiles('.js', true, mergeDist); } })));
    var tb = h('table', { class: 'libtbl' }, h('tr', null, h('th', { text: '자주 쓰는 업무(제목)' }), h('th', { text: '파트' }), h('th', { text: '내용' }), h('th', { text: '저장일' }), h('th', { text: '' })));
    LIB.forEach(function (u) {
      var ps = h('select', { 'aria-label': '파트', onchange: function () { u.part = this.value; saveLib(); } });
      (SET.parts.indexOf(u.part) < 0 ? SET.parts.concat([u.part]) : SET.parts).forEach(function (p) { ps.appendChild(h('option', { value: p, text: p })); }); ps.value = u.part;
      var lines = u.blocks.filter(function (b) { return b.k === 'box'; }).map(function (b) { return b.label; }).filter(Boolean).slice(0, 4).join(' · ');
      tb.appendChild(h('tr', null,
        h('td', null, h('input', { type: 'text', 'aria-label': '업무 제목', value: u.title, style: 'width:100%', oninput: function () { u.title = this.value; saveLib(); } })),
        h('td', null, ps), h('td', { class: 'lbl', text: lines || (u.blocks.length + '줄') }), h('td', { class: 'lbl', text: u.savedAt || '' }),
        h('td', null, h('button', { type: 'button', class: 'btn danger sm', text: '지우기', onclick: function () {
          confirmBox('자주 쓰는 업무 지우기', '「' + u.title + '」을(를) 지울까요? 이미 보고서에 넣은 항목은 그대로 남습니다.', '지우기').then(function (ok) { if (ok) { LIB.splice(LIB.indexOf(u), 1); saveLib(); render(); } });
        } }))));
    });
    v.appendChild(h('div', { class: 'panel' }, h('h2', { text: '자주 쓰는 업무' }),
      h('p', { class: 'desc', text: '편집 화면의 ‘자주 쓰는 업무로 저장’으로 쌓입니다. 3단계 ‘자주 쓰는 업무에서’로 불러 씁니다.' }),
      LIB.length ? h('div', { style: 'overflow-x:auto' }, tb) : h('p', { class: 'lbl', text: '아직 저장한 업무가 없습니다.' })));
    var linesOf = function (t) { return String(t).split(/[\n,]/).map(function (x) { return x.trim(); }).filter(Boolean); };
    var rows = h('div');
    SET.fields.forEach(function (f, i) {
      rows.appendChild(h('div', { class: 'setrow' },
        h('input', { type: 'text', 'aria-label': '칸 이름', value: f.label, onchange: function () { f.label = this.value.trim(); saveSet(); } }),
        h('textarea', { rows: Math.max(2, f.values.length + 1), 'aria-label': f.label + ' 자주 쓰는 값', placeholder: '자주 쓰는 값을 한 줄에 하나씩', value: f.values.join('\n'), onchange: function () { f.values = this.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); saveSet(); } }),
        h('button', { type: 'button', class: 'btn danger sm', 'aria-label': f.label + ' 지우기', text: '✕', onclick: function () { SET.fields.splice(i, 1); saveSet(); render(); } })));
    });
    v.appendChild(h('div', { class: 'panel' }, h('h2', { text: '칸 이름과 자주 쓰는 값' }),
      h('p', { class: 'desc', text: '칸 이름(예: 운영장소)에 맞춰 여기 적어 둔 값이 목록으로 뜹니다. ‘장소’ 칸에는 이름이 ‘장소’로 끝나는 모든 값이 함께 뜹니다.' }),
      rows, h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { type: 'button', class: 'btn', text: '+ 칸 이름 추가', onclick: function () { SET.fields.push({ label: '새 칸', values: [] }); saveSet(); render(); } }))));
    v.appendChild(h('div', { class: 'panel' }, h('h2', { text: '파트' }),
      h('p', { class: 'desc', text: '한 줄에 하나씩 적습니다. 직원 1단계와 팀장 제출 현황표에 쓰입니다.' }),
      h('textarea', { 'aria-label': '파트 목록', rows: SET.parts.length + 1, style: 'width:100%', value: SET.parts.join('\n'), onchange: function () {
        var p = linesOf(this.value); if (!p.length) { toast('파트는 하나 이상 있어야 합니다'); this.value = SET.parts.join('\n'); return; }
        SET.parts = p; saveSet(); toast('파트 목록을 저장했습니다');
      } })));
    v.appendChild(h('div', { class: 'panel' }, h('h2', { text: '날짜 넣기 버튼' }),
      h('p', { class: 'desc', text: '칸 이름에 아래 단어가 들어 있으면 ‘날짜 넣기’ 버튼이 나옵니다. 쉼표로 구분합니다.' }),
      h('input', { type: 'text', style: 'width:100%', 'aria-label': '날짜 단어', value: SET.dateWords.join(', '), onchange: function () { SET.dateWords = linesOf(this.value); saveSet(); toast('저장했습니다'); } })));
    v.appendChild(h('div', { class: 'panel' }, h('h2', { text: '팀원과 나누기' }),
      h('p', { class: 'desc', text: '설정과 자주 쓰는 업무를 파일 하나로 주고받습니다(같은 부서끼리). 팀장이 만드는 ‘다음 달 배포 자료’에도 자동으로 들어갑니다.' }),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', text: '설정·업무 파일 저장', onclick: function () {
          var o = { app: 'jangan-monthly-report-settings', version: 1, dept: DEPT, savedAt: new Date().toISOString(), settings: SET, library: LIB };
          download('월간업무보고_설정·단위업무.json', new Blob([JSON.stringify(o, null, 1)], { type: 'application/json' }));
        } }),
        h('button', { type: 'button', class: 'btn', text: '설정·업무 파일 불러오기', onclick: function () {
          pickFiles('.json', false, function (fs) {
            readText(fs[0]).then(function (t) {
              var o = JSON.parse(t);
              if (!o || o.app !== 'jangan-monthly-report-settings') throw new Error('설정·단위업무 파일이 아닙니다');
              if (o.dept && o.dept !== DEPT) throw new Error('다른 부서(' + o.dept + ') 설정 파일입니다');
              if (o.settings && o.settings.parts) { SET = o.settings; saveSet(); }
              (o.library || []).forEach(function (u) { var d = LIB.filter(function (x) { return norm(x.title) === norm(u.title); })[0]; if (d) LIB[LIB.indexOf(d)] = u; else LIB.push(u); });
              saveLib(); render(); toast('불러왔습니다');
            }).catch(function (e) { toast('불러올 수 없습니다: ' + e.message); });
          });
        } }),
        h('button', { type: 'button', class: 'btn danger', text: '설정 처음 상태로', onclick: function () {
          confirmBox('설정 초기화', '칸 이름·자주 쓰는 값·파트·날짜 단어를 처음 상태로 되돌립니다. 자주 쓰는 업무는 그대로 둡니다.', '되돌리기').then(function (ok) { if (ok) { SET = defaultSettings(); saveSet(); render(); } });
        } }))));
    app.appendChild(v);
  }

  /* ---------- 둘러보기 ---------- */
  function startTourSteps() {
    return [
      { sel: '#deptBar', title: '내 부서', text: '부서가 맞는지 확인하세요. 파트·자주 쓰는 업무·과거 보고서는 부서마다 따로 저장됩니다. 다르면 ‘부서 바꾸기’를 누르세요.' },
      { sel: '#roleStaff', title: '직원은 여기', text: '내 파트 내용만 4단계로 씁니다. 다른 파트나 보고서 전체 모양은 신경 쓰지 않아도 됩니다.' },
      { sel: '#roleLead', title: '팀장은 여기', text: '직원들이 보낸 제출 파일을 끌어다 놓으면 합쳐지고, 순서 정리 후 HWPX 보고서를 만듭니다.' },
      { sel: null, title: '직원 작성 순서 (4단계)', text: '① 보고월·파트 고르기 → ② 지난달 계획 카드마다 ‘예정대로 함 / 변경됨 / 취소’ → ③ 이번 달 계획 넣기 (작년 같은 달 · 자주 쓰는 업무 · 새로 쓰기) → ④ 확인 후 ‘제출하기’' },
      { sel: '#saveState', title: '저장은 자동', text: '입력하는 즉시 이 PC에 저장됩니다. 창을 닫았다 열어도 그대로 이어서 쓸 수 있습니다.' },
      { sel: '#btnTour', title: '다시 보려면', text: '언제든 ‘둘러보기’를 누르면 지금 화면에 맞는 안내가 다시 나옵니다.' }
    ];
  }
  function staffTour() {
    return [
      { sel: '#stepsBar', title: '진행 막대', text: '지금 몇 단계인지 보여 줍니다. 단계 이름을 눌러 앞뒤로 오갈 수 있습니다.' },
      { sel: '.partpick', title: SET.parts.length > 1 ? '내 파트 고르기' : '내 파트', text: SET.parts.length > 1 ? '보고월을 확인하고 내 파트를 누르세요. 다음에 열면 기억해 둡니다.' : '파트가 하나뿐이라 자동으로 골랐습니다. 보고월만 확인하세요.' },
      { sel: '#btnNext', title: '다음으로', text: '한 단계씩 ‘다음’을 누르면 됩니다. 마지막 단계에서 ‘제출하기’를 누르면 팀장에게 보낼 파일이 만들어집니다.' }
    ];
  }
  function leadTour() {
    return [
      { sel: '#dropZone', title: '제출 파일 놓기', text: '직원들이 보낸 .월보 파일을 여기에 끌어다 놓으세요. 파트별 제출 현황이 아래 표에 나옵니다.' },
      { sel: '#btnExport', title: 'HWPX 만들기', text: '순서를 정리하고 빠진 것을 확인한 뒤 누르면 한글 보고서가 내려받아집니다.' },
      { sel: '#btnDist', title: '다음 달 배포판', text: '이번 달 계획이 들어간 배포 자료(.js)를 만들어 웹 폴더의 js/dist-data.js 에 반영하면, 다음 달 ‘지난달 결과’ 카드가 자동으로 나옵니다.' }
    ];
  }
  var TOUR = null;
  function startTour(steps) {
    endTour();
    steps = steps.filter(function (s) { return !s.sel || document.querySelector(s.sel); });
    if (!steps.length) return;
    TOUR = { steps: steps, i: 0, dim: h('div', { class: 'tour-dim' }), hole: h('div', { class: 'tour-hole' }), tip: h('div', { class: 'tour-tip', role: 'dialog', 'aria-live': 'polite' }) };
    document.body.appendChild(TOUR.dim); document.body.appendChild(TOUR.hole); document.body.appendChild(TOUR.tip);
    TOUR.dim.addEventListener('click', function (e) { e.stopPropagation(); });
    tourShow();
  }
  function tourShow() {
    var t = TOUR, s = t.steps[t.i], el = s.sel ? document.querySelector(s.sel) : null;
    if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
    var r = el ? el.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2 - 40, width: 0, height: 0, bottom: window.innerHeight / 2 - 40 };
    var pad = el ? 6 : 0;
    t.hole.style.left = (r.left - pad) + 'px'; t.hole.style.top = (r.top - pad) + 'px'; t.hole.style.width = (r.width + pad * 2) + 'px'; t.hole.style.height = (r.height + pad * 2) + 'px';
    t.tip.innerHTML = '';
    var last = t.i === t.steps.length - 1;
    t.tip.appendChild(h('span', { class: 'dots', text: (t.i + 1) + ' / ' + t.steps.length }));
    t.tip.appendChild(h('b', { text: s.title }));
    t.tip.appendChild(h('p', { text: s.text }));
    t.tip.appendChild(h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn ghost sm', text: '건너뛰기', onclick: endTour }), h('span', { class: 'grow' }),
      t.i ? h('button', { type: 'button', class: 'btn sm', text: '이전', onclick: function () { t.i--; tourShow(); } }) : null,
      h('button', { type: 'button', class: 'btn pri sm', id: 'tourNext', text: last ? '시작하기' : '다음', onclick: function () { if (last) endTour(); else { t.i++; tourShow(); } } })));
    var tw = Math.min(380, window.innerWidth * 0.92), th = t.tip.offsetHeight || 180;
    var left = Math.max(10, Math.min(r.left, window.innerWidth - tw - 10));
    var top = r.bottom + 14;
    if (top + th > window.innerHeight - 10) top = Math.max(10, r.top - th - 14);
    if (!el) { left = (window.innerWidth - tw) / 2; top = (window.innerHeight - th) / 2; }
    t.tip.style.left = left + 'px'; t.tip.style.top = top + 'px';
    var nb = $('tourNext'); if (nb) nb.focus();
  }
  function endTour() {
    if (!TOUR) return;
    [TOUR.dim, TOUR.hole, TOUR.tip].forEach(function (x) { x.remove(); });
    TOUR = null; saveKey(TOUR_KEY, 1);
  }
  document.addEventListener('keydown', function (e) { if (TOUR && e.key === 'Escape') endTour(); });
  window.addEventListener('resize', function () { if (TOUR) tourShow(); });
  $('btnTour').onclick = function () {
    if (UI.view === 'staff') startTour(staffTour().concat(UI.step === 2 ? [{ sel: '.choice3', title: '카드마다 하나만', text: '예정대로 했으면 ‘예정대로 함’ 후 숫자만, 일정·내용이 바뀌었으면 ‘변경됨’, 안 했으면 ‘취소’를 누르세요.' }] : UI.step === 3 ? [{ sel: '#planChoices', title: '계획 넣는 세 가지 방법', text: '작년 같은 달 보고서에서 고르거나, 저장해 둔 반복 업무를 넣거나, 새로 쓰세요.' }] : UI.step === 4 ? [{ sel: '#btnSubmit', title: '제출하기', text: '파일 1개가 내려받아집니다. 메신저나 공유 폴더로 팀장에게 보내면 끝입니다.' }] : []));
    else if (UI.view === 'lead') startTour(leadTour());
    else { UI.view = 'start'; render(); startTour(startTourSteps()); }
  };
  $('btnDept').onclick = function () { UI.view = 'dept'; render(); window.scrollTo(0, 0); };
  $('btnSettings').onclick = function () { if (UI.view !== 'set') UI.settingsFrom = UI.view; UI.view = 'set'; render(); window.scrollTo(0, 0); };
  $('homeBtn').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); } });
  $('btnHome').onclick = $('homeBtn').onclick = function () { saveStaffNow(); saveLeadNow(); UI.view = 'start'; render(); window.scrollTo(0, 0); };

  /* ---------- 시작 ---------- */
  EMBEDS = [].concat(window.EASY_EMBEDS || [], window.EASY_EMBED ? [window.EASY_EMBED] : []).filter(function (e) { return e && e.app === 'jangan-monthly-report-dist'; });
  var hadOld = false; try { hadOld = !!(localStorage.getItem(STAFF_KEY) || localStorage.getItem(SKEY0)); } catch (e) {}
  DEPTCFG = loadKey(DEPT_KEY, null); if (!DEPTCFG || !Array.isArray(DEPTCFG.custom)) DEPTCFG = { cur: (DEPTCFG && DEPTCFG.cur) || null, custom: [] };
  STAFF = loadKey(STAFF_KEY, null); if (!STAFF || !STAFF.ws) STAFF = { pref: null, ws: {} };
  LEAD = loadKey(LEAD_KEY, null); if (!LEAD || !LEAD.ws) LEAD = { cur: null, ws: {} };
  /* 부서 구분이 없던 예전 작업은 장안구민회관 것으로 옮김 */
  Object.keys(STAFF.ws).forEach(function (k) { if (k.split('|').length === 2) { STAFF.ws[DEF_DEPT + '|' + k] = STAFF.ws[k]; STAFF.ws[DEF_DEPT + '|' + k].dept = DEF_DEPT; delete STAFF.ws[k]; } });
  Object.keys(LEAD.ws).forEach(function (k) { if (k.indexOf('|') < 0) { LEAD.ws[DEF_DEPT + '|' + k] = LEAD.ws[k]; LEAD.ws[DEF_DEPT + '|' + k].dept = DEF_DEPT; delete LEAD.ws[k]; } });
  if (LEAD.cur && LEAD.cur.indexOf('|') < 0) LEAD.cur = DEF_DEPT + '|' + LEAD.cur;
  if (!DEPTCFG.cur) {
    var embDepts = []; EMBEDS.forEach(function (e) { var n = e.dept || DEF_DEPT; if (embDepts.indexOf(n) < 0) embDepts.push(n); });
    if (embDepts.length === 1) DEPTCFG.cur = embDepts[0];      /* 한 부서 전용 웹이면 묻지 않음 */
    else if (hadOld) DEPTCFG.cur = DEF_DEPT;                    /* 예전 도구를 쓰던 PC */
    if (DEPTCFG.cur) saveKey(DEPT_KEY, DEPTCFG);
  }
  if (DEPTCFG.cur) loadDept(DEPTCFG.cur); else { SET = defaultSettings(); LIB = []; HIST_READY = true; }
  buildDatalists();
  render();
  $('saveState').textContent = '자동 저장 켜짐';
  if (DEPTCFG.cur && !loadKey(TOUR_KEY, null)) setTimeout(function () { if (UI.view === 'start') startTour(startTourSteps()); }, 500);
  /* 테스트용 진입점 */
  window.__easy = { pickDept: pickDept, state: function () { return { S: S, L: L, UI: UI, HIST_READY: HIST_READY, HIST: HIST, LIB: LIB, DEPT: DEPT, SET: SET, EMBED: EMBED }; } };
})();
