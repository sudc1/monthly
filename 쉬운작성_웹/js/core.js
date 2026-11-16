/* 월간업무보고 작성 도구 — 핵심 로직 (DOM 비의존: 브라우저와 Node 테스트 공용) */
(function (root) {
  'use strict';
  var WD = '일월화수목금토';
  var PARTS = ['문화', '스포츠', '시설', '대관', '기획프로그램'];
  var TYPES = ['정규강좌', '대관 현황', '시설 공사·관리 성과', '자원봉사·문화사랑방', '기타'];

  function uid() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function daysIn(y, m) { return new Date(y, m, 0).getDate(); }
  function wdOf(y, m, d) { return WD.charAt(new Date(y, m - 1, d).getDay()); }
  /* 본문 표기: 2026. 11. 5.(목) */
  function fmtDate(iso) {
    var p = String(iso || '').split('-').map(Number);
    if (p.length !== 3 || !p[0]) return '';
    return p[0] + '. ' + p[1] + '. ' + p[2] + '.(' + wdOf(p[0], p[1], p[2]) + ')';
  }
  /* 표지 표기(기존 양식 유지): 2026. 12. 01(화) */
  function fmtCoverDate(iso) {
    var p = String(iso || '').split('-').map(Number);
    if (p.length !== 3 || !p[0]) return '2026. 00. 00(0)';
    return p[0] + '. ' + pad2(p[1]) + '. ' + pad2(p[2]) + '(' + wdOf(p[0], p[1], p[2]) + ')';
  }
  function prevYM(y, m) { return m === 1 ? { y: y - 1, m: 12 } : { y: y, m: m - 1 }; }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
  function fmtNum(n) { return Number(n || 0).toLocaleString('ko-KR'); }

  function newState(y, m) {
    return { app: 'jangan-monthly-report', version: 1, year: y, month: m, reportDate: '', items: [] };
  }

  /* ---------- 항목 템플릿 ---------- */
  function box(label, value) { return { k: 'box', label: label || '', value: value || '' }; }
  function sub(text) { return { k: 'sub', text: text || '' }; }
  function cellsRow(arr) { return arr.map(function (t) { return { t: t, cs: 1, rs: 1 }; }); }

  function makeItem(type, sec, part, st) {
    var y = st ? st.year : 2026, m = st ? st.month : 1;
    var refM = sec === 'plan' ? m : prevYM(y, m).m;
    var it = { id: uid(), sec: sec, part: part || '문화', type: type, title: '', blocks: [], needsResult: false, fromPrev: false };
    if (type === '정규강좌') {
      it.title = '건강한 여가를 책임지는 문화‧스포츠 정규강좌';
      it.part = part || '스포츠';
      it.blocks = [
        box('스포츠강좌', refM + '월 스포츠 강좌 회원모집 및 운영'),
        sub('강좌기간 : '), sub('모집기간 : '),
        { k: 'stat', unit: '(단위 : 반, 명)', cats: ['수영', '헬스', '스쿼시', '생활체육'],
          rows: [{ label: '모집강좌(반)', v: ['', '', '', ''] }, { label: '모집정원(명)', v: ['', '', '', ''] }], rate: null },
        box('문화강좌', ''),
        sub('강좌기간 : '),
        { k: 'stat', unit: '(단위 : 반, 명)', cats: ['일반', '초등 및 유아', '시니어', '장애인'],
          rows: [{ label: '모집강좌(반)', v: ['', '', '', ''] }, { label: '모집정원(명)', v: ['', '', '', ''] }, { label: '등록인원(명)', v: ['', '', '', ''] }],
          rate: { label: '등록비율(%)', num: 2, den: 1 } }
      ];
    } else if (type === '대관 현황') {
      it.title = refM + '월 한누리아트홀 및 노송갤러리 운영';
      it.part = part || '대관';
      var head1 = [{ t: '구 분', cs: 1, rs: 3 }, { t: y + '년', cs: 4, rs: 1 }, { t: (y - 1) + '년', cs: 4, rs: 1 }, { t: (y - 2) + '년', cs: 4, rs: 1 }];
      var head2 = [], head3 = [];
      for (var i = 0; i < 3; i++) { head2.push({ t: '누 계', cs: 2, rs: 1 }, { t: refM + '월', cs: 2, rs: 1 }); head3 = head3.concat(cellsRow(['건수', '일수', '건수', '일수'])); }
      it.blocks = [
        box('대관 신청 현황', ''),
        { k: 'unit', text: '(' + y + '. ' + refM + '.  . 기준, 단위 : 건, 일)' },
        { k: 'table', head: 3, widths: [8, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
          rows: [head1, head2, head3, cellsRow(['공연장', '', '', '', '', '', '', '', '', '', '', '', '']), cellsRow(['전시실', '', '', '', '', '', '', '', '', '', '', '', ''])] },
        { k: 'note', text: refM + '월 미 대관 기간은 수시대관 접수 중' }
      ];
    } else if (type === '시설 공사·관리 성과') {
      it.title = refM + '월 기타 시설 공사·관리 성과';
      it.part = part || '시설';
      it.blocks = [{ k: 'table', head: 1, widths: [9, 4, 9, 6, 6],
        rows: [cellsRow(['구  분', '일시', '내  용', '기대효과', '소요예산']), cellsRow(['', '', '', '', ''])] }];
    } else if (type === '자원봉사·문화사랑방') {
      it.title = '';
      it.blocks = [box('운영일시', ''), box('운영장소', ''), box('운영대상', ''), box('참여인원', ''), box('운영내용', ''), sub('')];
    } else {
      it.type = '기타';
      it.blocks = [box('', '')];
    }
    return it;
  }

  /* ---------- 표 격자 계산 ---------- */
  function tableGrid(rows) {
    var occ = [], placed = [], cols = 0;
    rows.forEach(function (row, r) {
      occ[r] = occ[r] || [];
      var c = 0;
      row.forEach(function (cell) {
        while (occ[r][c]) c++;
        var cs = Math.max(1, cell.cs | 0), rs = Math.max(1, cell.rs | 0);
        for (var dr = 0; dr < rs; dr++) { occ[r + dr] = occ[r + dr] || []; for (var dc = 0; dc < cs; dc++) occ[r + dr][c + dc] = true; }
        placed.push({ r: r, c: c, cs: cs, rs: rs, cell: cell });
        cols = Math.max(cols, c + cs);
        c += cs;
      });
    });
    return { placed: placed, cols: cols, rowCnt: Math.max(rows.length, occ.length) };
  }
  function statToTable(b) {
    var head = [{ t: '구 분', cs: 1, rs: 1 }, { t: '합 계', cs: 1, rs: 1 }].concat(b.cats.map(function (c) { return { t: c, cs: 1, rs: 1 }; }));
    var rows = [head];
    b.rows.forEach(function (r) {
      var tot = r.v.reduce(function (a, v) { return a + num(v); }, 0);
      rows.push(cellsRow([r.label, fmtNum(tot)].concat(r.v.map(function (v) { return v === '' ? '' : fmtNum(num(v)); }))));
    });
    if (b.rate && b.rows[b.rate.num] && b.rows[b.rate.den]) {
      var nr = b.rows[b.rate.num].v, dr = b.rows[b.rate.den].v;
      var rate = function (n, d) { return d > 0 ? (n / d * 100).toFixed(2) : '-'; };
      var tn = nr.reduce(function (a, v) { return a + num(v); }, 0), td = dr.reduce(function (a, v) { return a + num(v); }, 0);
      rows.push(cellsRow([b.rate.label, rate(tn, td)].concat(nr.map(function (v, i) { return rate(num(v), num(dr[i])); }))));
    }
    var w = [7, 6].concat(b.cats.map(function () { return 6; }));
    return { k: 'table', head: 1, rows: rows, widths: w };
  }
  function statTotals(b) {
    return b.rows.map(function (r) { return r.v.reduce(function (a, v) { return a + num(v); }, 0); });
  }

  /* ---------- 검증 ---------- */
  function blockTexts(b) {
    if (b.k === 'box') return [(b.label || '') + ' : ' + (b.value || '')];
    if (b.k === 'table') { var a = []; b.rows.forEach(function (r) { r.forEach(function (c) { a.push(c.t || ''); }); }); return a; }
    if (b.k === 'stat') return [b.unit || ''].concat(b.cats).concat(b.rows.map(function (r) { return r.label; }));
    return [b.text || ''];
  }
  function guessYear(m, st, sec) {
    var y = st.year, rm = st.month;
    if (m - rm > 6) return y - 1;
    if (rm - m > 6) return y + 1;
    return y;
  }
  function checkDates(text, st, sec, push) {
    var masked = text;
    var full = /(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})(?!\d)\s*\.?\s*(?:\(\s*([월화수목금토일])\s*\))?/g, m;
    var lastYear = null;
    while ((m = full.exec(text))) {
      var y = +m[1], mo = +m[2], d = +m[3];
      lastYear = y;
      masked = masked.slice(0, m.index) + new Array(m[0].length + 1).join(' ') + masked.slice(m.index + m[0].length);
      if (mo < 1 || mo > 12) continue;
      if (d < 1 || d > daysIn(y, mo)) { push('error', '없는 날짜: ' + m[0].trim() + ' (' + mo + '월은 ' + daysIn(y, mo) + '일까지)'); continue; }
      if (m[4] && m[4] !== wdOf(y, mo, d)) push('error', '요일 오류: ' + y + '. ' + mo + '. ' + d + '.은 ' + wdOf(y, mo, d) + '요일입니다 (적힌 요일: ' + m[4] + ')');
      if (y < st.year - 1 || y > st.year + 1) push('warn', '연도 확인: ' + m[0].trim() + ' — 보고 연도(' + st.year + ')와 차이가 큽니다');
      else if (sec === 'plan' && y < st.year && !(st.month === 1 && mo === 12)) push('warn', '연도 확인: 금월 계획에 작년 날짜(' + m[0].trim() + ')가 있습니다');
    }
    var short = /(^|[^\d.])(\d{1,2})\s*\.\s*(\d{1,2})(?!\d)\s*\.?\s*(\(\s*([월화수목금토일])\s*\)|)/g;
    while ((m = short.exec(masked))) {
      var mo2 = +m[2], d2 = +m[3], w = m[5];
      var prefix = masked.slice(Math.max(0, m.index - 3), m.index + m[1].length);
      var isRange = /~\s*$/.test(prefix);
      if (!w && !isRange) continue;
      if (mo2 < 1 || mo2 > 12) continue;
      var yy = lastYear && Math.abs(lastYear - st.year) <= 1 ? lastYear : guessYear(mo2, st, sec);
      if (d2 < 1 || d2 > daysIn(yy, mo2)) { push('error', '없는 날짜: ' + mo2 + '. ' + d2 + '. (' + mo2 + '월은 ' + daysIn(yy, mo2) + '일까지)'); continue; }
      if (w && w !== wdOf(yy, mo2, d2)) push('error', '요일 오류: ' + yy + '. ' + mo2 + '. ' + d2 + '.은 ' + wdOf(yy, mo2, d2) + '요일입니다 (적힌 요일: ' + w + ')');
    }
  }
  function validate(st) {
    var out = [];
    if (!st.reportDate) out.push({ level: 'warn', itemId: null, msg: '표지의 서면보고일이 비어 있습니다 (상단에서 선택)' });
    ['plan', 'result'].forEach(function (sec) {
      var seen = {};
      st.items.filter(function (i) { return i.sec === sec; }).forEach(function (it) {
        var got = {};
        var push = function (level, msg) { if (got[msg]) return; got[msg] = 1; out.push({ level: level, itemId: it.id, msg: msg }); };
        var key = (it.title || '').replace(/\s+/g, '');
        if (!key) push('error', '제목이 비어 있습니다');
        else if (seen[key]) push('warn', '같은 제목이 이미 있습니다: 「' + it.title.trim() + '」');
        seen[key] = true;
        if (it.needsReview) push('warn', '과거 보고서에서 가져옴 — 날짜·인원·예산 등을 이번 달 내용으로 확인한 뒤 ‘내용 확인 완료’를 체크하세요');
        if (it.needsResult) push('warn', '실적 보완 필요 — 지난달 계획에서 불러온 항목입니다. 실제 실적으로 고친 뒤 ‘실적 반영 완료’를 체크하세요');
        var texts = [it.title || ''];
        it.blocks.forEach(function (b) { texts = texts.concat(blockTexts(b)); });
        texts.forEach(function (tx) {
          checkDates(tx, st, sec, push);
          if (/00\.\s*00/.test(tx)) push('warn', '자리표시 날짜(00. 00)가 남아 있습니다');
          if (/동시공사/.test(tx)) push('warn', '오탈자 의심: ‘동시공사’ → ‘도시공사’');
          if (/천원/.test(tx) && /(^|[^천\d,])[\d,]{2,}원/.test(tx.replace(/[\d,]+천원/g, ''))) push('warn', '금액 단위 혼용: 천원과 원 단위가 한 줄에 함께 있습니다');
        });
      });
    });
    return out;
  }

  /* ---------- HWPX 생성 ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fill(tpl, map) {
    return tpl.replace(/\{\{(\w+)\}\}/g, function (_, k) { return map[k] == null ? '' : map[k]; });
  }
  var BF = { head: [32, 33, 34], first: [35, 36, 37], mid: [38, 39, 40], last: [28, 70, 29] };
  function tableXml(T, b, tid) {
    var g = tableGrid(b.rows);
    var cols = g.cols, rowsN = g.rowCnt, head = Math.min(b.head || 0, rowsN);
    var W = T.tableWidth;
    var wr = (b.widths && b.widths.length === cols) ? b.widths.map(num) : [];
    if (!wr.length || wr.some(function (x) { return !(x > 0); })) { wr = []; for (var i = 0; i < cols; i++) wr.push(1); }
    var sumW = wr.reduce(function (a, x) { return a + x; }, 0), colW = [], acc = 0;
    wr.forEach(function (x, i) { var w = i === cols - 1 ? W - acc : Math.round(W * x / sumW); colW.push(w); acc += w; });
    var rowH = [];
    for (var r = 0; r < rowsN; r++) rowH.push(r < head ? 2430 : 2400);
    var trs = [];
    for (r = 0; r < rowsN; r++) trs.push([]);
    g.placed.forEach(function (p) {
      var w = 0, h = 0, k;
      for (k = 0; k < p.cs; k++) w += colW[p.c + k];
      for (k = 0; k < p.rs; k++) h += rowH[p.r + k];
      var band = p.r < head ? 'head' : (p.r === head ? 'first' : (p.r + p.rs >= rowsN ? 'last' : 'mid'));
      if (band === 'first' && p.r + p.rs >= rowsN && rowsN - head > 1) band = 'last';
      var pos = p.c === 0 ? 0 : (p.c + p.cs >= cols ? 2 : 1);
      if (cols === 1) pos = 1;
      var bf = BF[band][pos];
      var cp = p.r < head ? 38 : 34;
      var lines = String(p.cell.t == null ? '' : p.cell.t).split('\n');
      var paras = lines.map(function (ln) {
        return '<hp:p id="2147483648" paraPrIDRef="39" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="' + cp + '">' +
          (ln === '' ? '' : '<hp:t>' + esc(ln) + '</hp:t>') + '</hp:run></hp:p>';
      }).join('');
      trs[p.r].push('<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="' + bf + '">' +
        '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">' +
        paras + '</hp:subList><hp:cellAddr colAddr="' + p.c + '" rowAddr="' + p.r + '"/><hp:cellSpan colSpan="' + p.cs + '" rowSpan="' + p.rs + '"/>' +
        '<hp:cellSz width="' + w + '" height="' + h + '"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>');
    });
    var H = rowH.reduce(function (a, x) { return a + x; }, 0);
    return fill(T.tablePre, { TID: tid, ROWS: rowsN, COLS: cols, W: W, H: H }) +
      trs.map(function (cells) { return '<hp:tr>' + cells.join('') + '</hp:tr>'; }).join('') + T.tablePost;
  }
  function boxText(b) {
    var l = (b.label || '').trim(), v = (b.value || '');
    if (l && v.trim()) return l + ' : ' + v;
    return l || v;
  }
  function itemXml(T, it, no, nextId) {
    var x = fill(T.title, { NO: no, TITLE: esc((it.title || '').trim()), TID: nextId() });
    it.blocks.forEach(function (b) {
      if (b.k === 'box') x += fill(T.box, { TEXT: esc(boxText(b)) });
      else if (b.k === 'sub') x += fill(T.sub, { TEXT: esc(b.text) });
      else if (b.k === 'note') x += fill(T.note, { TEXT: esc(b.text) });
      else if (b.k === 'unit') x += fill(T.unit, { TEXT: esc(b.text) });
      else if (b.k === 'plain') x += fill(T.box.replace('<hp:t> □ {{TEXT}}</hp:t>', '<hp:t>{{TEXT}}</hp:t>'), { TEXT: esc(b.text) });
      else if (b.k === 'table') x += tableXml(T, b, nextId());
      else if (b.k === 'stat') {
        if (b.unit) x += fill(T.unit, { TEXT: esc(b.unit) });
        x += tableXml(T, statToTable(b), nextId());
      }
    });
    return x + T.spacer;
  }
  function buildSection(T, st) {
    var tid = 1900000000;
    var nextId = function () { return String(tid++); };
    var pm = prevYM(st.year, st.month);
    var x = T.head + fill(T.cover, { REPORT_DATE: esc(fmtCoverDate(st.reportDate)), TITLE_YM: st.year + '년 ' + st.month + '월' });
    var fac = String(st.dept || '장안구민회관').replace(/\s+/g, '');
    var hdr = function (y, m, kind, brk) {
      var h = fill(T.sectionHeader, { HDR_YM: '- ' + y + '년 ' + m + '월 -', HDR_KIND: kind });
      if (fac !== '장안구민회관') h = h.split('장안구민회관').join(esc(fac));
      if (brk) h = h.replace('pageBreak="0"', 'pageBreak="1"');
      return h;
    };
    var plan = st.items.filter(function (i) { return i.sec === 'plan'; });
    var res = st.items.filter(function (i) { return i.sec === 'result'; });
    x += hdr(st.year, st.month, '주요업무계획', false);
    plan.forEach(function (it, i) { x += itemXml(T, it, i + 1, nextId); });
    if (res.length) {
      x += hdr(pm.y, pm.m, '주요업무성과', true);
      res.forEach(function (it, i) { x += itemXml(T, it, i + 1, nextId); });
    }
    return x + T.tail;
  }
  function previewText(st) {
    var lines = ['『시민이 행복한 도시환경 창조』', '<' + fmtCoverDate(st.reportDate) + ' 서면보고>', '<수원의 미래가치 디자이너 수원도시공사 ' + st.year + '년 ' + st.month + '월 월간업무보고>'];
    st.items.forEach(function (it) { lines.push('<' + (it.title || '') + '>'); });
    return lines.join('\r\n');
  }

  /* ---------- HWPX 가져오기 (DOMParser 필요) ---------- */
  var HP = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
  function kids(el, name) { var a = []; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.localName === name) a.push(c); return a; }
  function allText(el) { var a = el.getElementsByTagNameNS(HP, 't'), s = ''; for (var i = 0; i < a.length; i++) s += a[i].textContent; return s; }
  function ownText(p) {
    var s = '';
    kids(p, 'run').forEach(function (run) { kids(run, 't').forEach(function (t) { s += t.textContent; }); });
    return s;
  }
  function firstTbl(p) {
    var runs = kids(p, 'run');
    for (var i = 0; i < runs.length; i++) { var t = kids(runs[i], 'tbl'); if (t.length) return t[0]; }
    return null;
  }
  function cellText(tc) {
    var sl = kids(tc, 'subList')[0]; if (!sl) return '';
    return kids(sl, 'p').map(function (p) { return allText(p).replace(/\s+$/, ''); }).join('\n').replace(/^\s+|\s+$/g, '');
  }
  var TAG_RE = /^\s*[\[\(]\s*(ESG\s*-?\s*[ESG]|안전경영|안전시설|산업안전|안전교육|고객서비스|정규강좌|특강강좌|성과공유제|시범사업|직무교육|시민참여|협업)\s*[\]\)]\s*/;
  function stripTag(t) { var prev; do { prev = t; t = t.replace(TAG_RE, ''); } while (t !== prev); return t.trim(); }
  function guessType(t) {
    if (/정규강좌/.test(t)) return '정규강좌';
    if (/한누리아트홀|노송갤러리|대관/.test(t)) return '대관 현황';
    if (/시설 공사|공사·관리|공사ㆍ관리/.test(t)) return '시설 공사·관리 성과';
    if (/자원봉사|문화사랑방/.test(t)) return '자원봉사·문화사랑방';
    return '기타';
  }
  function guessPart(t) {
    if (/한누리아트홀|노송갤러리|대관/.test(t)) return '대관';
    if (/스포츠|헬스|수영|스쿼시|생활체육|체육시설/.test(t) && !/문화강좌/.test(t)) return '스포츠';
    if (/시설|점검|공사|청사|소방|승강기|정비|교체|계측|물탱크|전기|방역|안전/.test(t)) return '시설';
    return '문화';
  }
  function parseHwpxSection(xml, DOMParserCtor, opts) {
    opts = opts || {};
    var doc = new DOMParserCtor().parseFromString(xml, 'application/xml');
    var rootEl = doc.documentElement;
    var FAC = String(opts.facility || '장안구민회관').replace(/\s+/g, '');
    var items = [], sec = null, cur = null, meta = {};
    var t0 = allText(rootEl).match(/(\d{4})년\s*(\d{1,2})월\s*월간업무보고/);
    if (t0) { meta.year = +t0[1]; meta.month = +t0[2]; }
    var hdrNo = 0, planHeaders = 0, resultHeaders = 0, otherFacility = false, boxes = {};
    var boxText = function (p) {
      var tb = firstTbl(p); if (!tb || tb.getAttribute('rowCnt') !== '1' || tb.getAttribute('colCnt') !== '1') return '';
      var x = allText(tb).replace(/\s+/g, '');
      return x && x.length <= 12 && !/\d|그림/.test(x) ? x : '';
    };
    kids(rootEl, 'p').forEach(function (p) { var b = boxText(p); if (b) boxes[b] = 1; });
    var boxNames = Object.keys(boxes);
    var compiled = boxNames.filter(function (b) { return b !== FAC; }).length >= 2 && boxes[FAC];
    /* 여러 부서가 묶인 전체 보고서인데 찾는 부서 이름이 없는 경우: 엉뚱한 부서 내용을 가져오지 않도록 비워서 돌려줌 */
    if (!compiled && !boxes[FAC] && boxNames.length >= 3) return { meta: meta, items: [], boxNames: boxNames, facilityFound: false };
    if (compiled) otherFacility = true;
    kids(rootEl, 'p').forEach(function (p) {
      var t = allText(p);
      if (!firstTbl(p) && /^\s*-\s*20\d\d\s*년\s*\d{1,2}\s*월\s*-/.test(t) && /주요\s*업무/.test(t)) { if (/계획/.test(t)) planHeaders++; else resultHeaders++; }
    });
    if (planHeaders === 0 && resultHeaders === 1) sec = 'plan';
    kids(rootEl, 'p').forEach(function (p) {
      var txt = allText(p);
      if (compiled) { var bx = boxText(p); if (bx) { otherFacility = bx !== FAC; cur = null; return; } }
      var tbl = firstTbl(p);
      var hdr = !tbl && /^\s*-\s*20\d\d\s*년\s*\d{1,2}\s*월\s*-/.test(txt) && /주요\s*업무/.test(txt);
      if (hdr) {
        hdrNo++;
        var isPlan = /계획/.test(txt) || (hdrNo === 1 && resultHeaders >= 2 && planHeaders === 0);
        sec = isPlan ? 'plan' : 'result'; cur = null; otherFacility = !!compiled;
        var hm = txt.match(/(20\d\d)\s*년\s*(\d{1,2})\s*월/);
        if (isPlan && hm && !meta.year) { meta.year = +hm[1]; meta.month = +hm[2]; }
        return;
      }
      if (!sec) return;
      if (tbl) {
        var rc = +tbl.getAttribute('rowCnt'), cc = +tbl.getAttribute('colCnt');
        var trs = kids(tbl, 'tr');
        var one = rc === 1 && cc === 1 ? allText(tbl).replace(/\s+/g, '') : '';
        if (one === FAC) { otherFacility = false; cur = null; return; }
        if (one && one.length <= 12 && /(운동장|사업처|여성회관|지원센터|체육관|체육센터|회관|본부)$/.test(one)) { otherFacility = true; cur = null; return; }
        if (rc === 1 && cc === 3) {
          var tcs = kids(trs[0], 'tc');
          var n = cellText(tcs[0]);
          if (/^\d{1,2}$/.test(n)) {
            var title = cellText(tcs[2]);
            if (opts.stripTags !== false) title = stripTag(title);
            cur = { id: uid(), sec: sec, part: opts.defaultPart || guessPart(title), type: guessType(title), title: title, blocks: [], needsResult: false, fromPrev: false };
            if (!otherFacility) items.push(cur);
            return;
          }
        }
        if (!cur) return;
        if (rc === 1 && cc === 2 && /^\s*담당/.test(cellText(kids(trs[0], 'tc')[0]))) return; /* 담당자 표기는 가져오지 않음 */
        var pre = ownText(p).replace(/\s+$/, '');
        if (pre.trim()) cur.blocks.push({ k: 'unit', text: pre.trim() });
        var cells = [], widths = {};
        trs.forEach(function (tr) {
          kids(tr, 'tc').forEach(function (tc) {
            var a = kids(tc, 'cellAddr')[0], s = kids(tc, 'cellSpan')[0], sz = kids(tc, 'cellSz')[0];
            var c = +a.getAttribute('colAddr'), r = +a.getAttribute('rowAddr');
            var cs = s ? +s.getAttribute('colSpan') : 1, rs = s ? +s.getAttribute('rowSpan') : 1;
            if (cs === 1 && sz && widths[c] == null) widths[c] = +sz.getAttribute('width');
            cells.push({ r: r, c: c, cs: cs, rs: rs, t: cellText(tc) });
          });
        });
        cells.sort(function (a, b) { return a.r - b.r || a.c - b.c; });
        var rows = [];
        cells.forEach(function (x) { (rows[x.r] = rows[x.r] || []).push({ t: x.t, cs: x.cs, rs: x.rs }); });
        rows = rows.map(function (r) { return r || []; });
        var w = []; for (var i = 0; i < cc; i++) w.push(widths[i] || 0);
        cur.blocks.push({ k: 'table', head: 1, rows: rows, widths: w.every(function (x) { return x > 0; }) ? w : [] });
        return;
      }
      if (!cur) return;
      var line = ownText(p).replace(/\s+$/, '');
      if (!line.trim()) return;
      var tl = line.replace(/^\s+/, '');
      if (tl.charAt(0) === '□') {
        var body = tl.slice(1).replace(/^\s+/, '');
        var ci = -1, dep = 0;
        for (var q = 0; q < body.length; q++) { var ch = body.charAt(q); if (ch === '(' || ch === '[' || ch === '「') dep++; else if (ch === ')' || ch === ']' || ch === '」') dep = Math.max(0, dep - 1); else if ((ch === ':' || ch === '：') && dep === 0) { ci = q; break; } }
        if (ci > 0 && ci < 16) cur.blocks.push(box(body.slice(0, ci).replace(/\s+$/, ''), body.slice(ci + 1).replace(/^\s+/, '')));
        else cur.blocks.push(box(body, ''));
      } else if (tl.charAt(0) === '○') cur.blocks.push(sub(tl.slice(1).replace(/^\s+/, '')));
      else if (tl.charAt(0) === '※') cur.blocks.push({ k: 'note', text: tl.slice(1).replace(/^\s+/, '') });
      else if (/^\(.*단위/.test(tl) || /기준.*단위/.test(tl)) cur.blocks.push({ k: 'unit', text: tl });
      else cur.blocks.push({ k: 'plain', text: line });
    });
    return { meta: meta, items: items, boxNames: boxNames, facilityFound: true };
  }


  /* ---------- 과거 보고서: 유사도·날짜 이월 ---------- */
  function normTitle(t) {
    return String(t || '').replace(/[\[\(][^\]\)]{0,20}[\]\)]/g, '').replace(/20\d\d\s*년도?|\d+\s*월|\d+\s*분기|상반기|하반기/g, '')
      .replace(/[^가-힣a-zA-Z]/g, '');
  }
  function bigrams(s) { var a = {}; for (var i = 0; i < s.length - 1; i++) { var g = s.substr(i, 2); a[g] = (a[g] || 0) + 1; } return a; }
  function similarity(x, y) {
    var a = normTitle(x), b = normTitle(y);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    var A = bigrams(a), B = bigrams(b), inter = 0, na = 0, nb = 0, k;
    for (k in A) { na += A[k]; if (B[k]) inter += Math.min(A[k], B[k]); }
    for (k in B) nb += B[k];
    return 2 * inter / (na + nb);
  }
  function fixWeekdays(t, st) {
    t = t.replace(/(20\d\d)(\s*\.\s*)(\d{1,2})(\s*\.\s*)(\d{1,2})(?!\d)(\s*\.?\s*)\(\s*([월화수목금토일])\s*\)/g, function (m, y, s1, mo, s2, d, s3, w) {
      var Y = +y, M = +mo, D = +d;
      if (M < 1 || M > 12 || D < 1 || D > daysIn(Y, M)) return m;
      return y + s1 + mo + s2 + d + s3 + '(' + wdOf(Y, M, D) + ')';
    });
    var lastYear = null, mm = t.match(/(20\d\d)\s*\.\s*\d{1,2}\s*\./); if (mm) lastYear = +mm[1];
    return t.replace(/(^|[^\d.])(\d{1,2})(\s*\.\s*)(\d{1,2})(?!\d)(\s*\.?\s*)\(\s*([월화수목금토일])\s*\)/g, function (m, pre, mo, s1, d, s2, w) {
      var M = +mo, D = +d;
      if (M < 1 || M > 12) return m;
      var yy = lastYear && Math.abs(lastYear - st.year) <= 1 ? lastYear : guessYear(M, st);
      if (D < 1 || D > daysIn(yy, M)) return m;
      return pre + mo + s1 + d + s2 + '(' + wdOf(yy, M, D) + ')';
    });
  }
  function shiftText(t, dy, st) {
    if (!dy || !t) return t;
    t = String(t);
    t = t.replace(/(^|[^\d,.])(20[12]\d)(?!\d|,\d|\s*(명|원|건|개|회|석|㎡|m|천|만|대|권|점|kg|%))/g, function (m, pre, y) { return pre + (+y + dy); });
    t = t.replace(/(^|[^\d])(2\d)(?=년도)/g, function (m, pre, y) { return pre + (+y + dy); });
    return fixWeekdays(t, st);
  }
  function shiftItem(it, dy, st) {
    if (!dy) return it;
    it.title = shiftText(it.title, dy, st);
    it.blocks.forEach(function (b) {
      if (b.k === 'box') { b.label = shiftText(b.label, dy, st); b.value = shiftText(b.value, dy, st); }
      else if (b.k === 'table') b.rows.forEach(function (r) { r.forEach(function (c) { c.t = shiftText(c.t, dy, st); }); });
      else if (b.k === 'stat') { b.unit = shiftText(b.unit, dy, st); }
      else b.text = shiftText(b.text, dy, st);
    });
    return it;
  }

  var api = {
    WD: WD, PARTS: PARTS, TYPES: TYPES, uid: uid, clone: clone, fmtDate: fmtDate, fmtCoverDate: fmtCoverDate, wdOf: wdOf,
    prevYM: prevYM, num: num, fmtNum: fmtNum, newState: newState, makeItem: makeItem, tableGrid: tableGrid,
    statToTable: statToTable, statTotals: statTotals, validate: validate, buildSection: buildSection,
    previewText: previewText, parseHwpxSection: parseHwpxSection, similarity: similarity, shiftText: shiftText, shiftItem: shiftItem, normTitle: normTitle, boxText: boxText, guessPart: guessPart, guessType: guessType
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MR = api;
})(this);
