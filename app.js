/* Kantin Menü Sistemi - eklentiler. index.html'deki ilgili fonksiyonların yerine geçer. */
const DAILY_TARGET = 5;
const PAY_LABELS = { kart:'Kart', nakit:'Nakit', iban:'IBAN' };
const PAY_BTNS = { kart:'💳 Kartla ödedim', nakit:'💵 Nakit ödedim', iban:"🏦 IBAN'a ödedim" };
const PAY_TXT = { ok:'Ödendi (onaylı)', wait:'Bildirildi – onay bekliyor', rej:'Ödeme reddedildi', no:'Ödenmedi' };
Object.assign(state, { payPicker:{}, exportMode:'week', exportDate:'', tFrom:'', tTo:'' });
document.head.appendChild(el('style', { text:'.toggle-btn:disabled{opacity:.55;cursor:not-allowed}' }));

/* ---------- yardımcılar ---------- */
normalizeSelection = function(sel, fb){
  if(sel === true) sel = { optionIds: fb ? [fb] : [] };
  if(!sel || typeof sel !== 'object') return null;
  return {
    optionIds: Array.isArray(sel.optionIds) ? sel.optionIds.slice() : (sel.optionId ? [sel.optionId] : (fb ? [fb] : [])),
    paidByTeacher: !!sel.paidByTeacher, paidConfirmed: !!sel.paidConfirmed, paymentRejected: !!sel.paymentRejected,
    payMethod: sel.payMethod || null, paidAt: sel.paidAt || null
  };
};
const selTotal = (day, s) => s.optionIds.reduce((t, id) => { const o = (day.options||[]).find(x=>x.id===id); return t + (o ? Number(o.price)||0 : 0); }, 0);
const selNames = (day, s) => s.optionIds.map(id => ((day.options||[]).find(o=>o.id===id)||{}).name).filter(Boolean).join(', ');
const payState = s => s.paidConfirmed ? 'ok' : s.paidByTeacher ? 'wait' : s.paymentRejected ? 'rej' : 'no';
const methodTxt = k => PAY_LABELS[k] || 'Yöntem belirtilmemiş';
const dmy = s => s.split('-').reverse().join('.');
const dateToStr = dt => dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
const isDayClosed = (cfg, d) => !cfg.ordersOpen || !!(cfg.closedDays||{})[d.id];
const isOptClosed = (cfg, o) => !!(cfg.closedOpts||{})[o.id];
async function setClosed(kind, id, val){
  const cfg = await getConfig(), k = kind === 'day' ? 'closedDays' : 'closedOpts';
  cfg[k] = cfg[k] || {};
  if(val) cfg[k][id] = true; else delete cfg[k][id];
  await setConfig(cfg); render();
}
const countOrders = (raw, dayId) => Object.keys(raw[dayId]||{}).filter(t => { const s = normalizeSelection(raw[dayId][t]); return s && s.optionIds.length; }).length;

/* ---------- öğretmen: ödeme kontrolleri ---------- */
function payControls(day, sel, tid, canUndo){
  const w = el('div', { style:{ paddingTop:'8px', borderTop:'1px solid var(--card-line)' } });
  const row = el('div', { style:{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' } });
  const upd = async fn => {
    clearMsgs();
    const f = await getSelections(), c = normalizeSelection(f[day.id] && f[day.id][tid]);
    if(!c) return;
    fn(c); f[day.id][tid] = c; await setSelections(f); render();
  };
  w.appendChild(row);
  if(sel.paidByTeacher){
    row.appendChild(el('span', { text:'✓ Ödeme bildirildi · ' + methodTxt(sel.payMethod), style:{ fontSize:'13.5px', fontWeight:'600' } }));
    row.appendChild(el('span', { text: sel.paidConfirmed ? '✓ Kantinci onayladı' : 'Onay bekleniyor', style:{ fontSize:'12.5px', fontWeight:'600', color: sel.paidConfirmed ? 'var(--success)' : 'var(--muted)' } }));
    if(canUndo) row.appendChild(el('button', { class:'btn btn-outline btn-sm', text:'Geri al', on:{ click:()=>upd(c=>{ c.paidByTeacher=false; c.paidConfirmed=false; c.payMethod=null; c.paidAt=null; }) } }));
  } else {
    const open = !!state.payPicker[day.id];
    row.appendChild(el('button', { class:'btn btn-outline btn-sm', text:'Ödeme yaptım ' + (open ? '▴' : '▾'), on:{ click:()=>{ state.payPicker[day.id] = !open; render(); } } }));
    if(open){
      const m = el('div', { style:{ display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'10px' } });
      Object.keys(PAY_BTNS).forEach(k => m.appendChild(el('button', { class:'btn btn-dark btn-sm', text:PAY_BTNS[k], on:{ click:()=>{
        state.payPicker[day.id] = false;
        upd(c=>{ c.paidByTeacher=true; c.paidConfirmed=false; c.paymentRejected=false; c.payMethod=k; c.paidAt=new Date().toISOString(); });
      } } })));
      w.appendChild(m);
    }
  }
  return w;
}
function pastCard(d, s, tid, undo){
  const card = el('div', { class:'day-card' });
  card.appendChild(el('div', { class:'dc-top' }, [ el('div', { class:'dc-date', text:formatDateTR(d.date) }), el('div', { class:'dc-price', text:formatPrice(selTotal(d, s)) }) ]));
  card.appendChild(el('div', { class:'dc-items', text:'Siparişiniz: ' + selNames(d, s) }));
  card.appendChild(payControls(d, s, tid, undo));
  return card;
}

/* ---------- öğretmen paneli ---------- */
viewTeacherPanel = async function(){
  const c = el('div'), tid = state.session.teacherId, today = todayStr();
  const [menu, raw, cfg] = await Promise.all([getMenu(), getSelections(), getConfig()]);
  const getSel = d => normalizeSelection(raw[d.id] && raw[d.id][tid], d.options && d.options[0] && d.options[0].id);
  const has = s => s && s.optionIds.length > 0;
  c.appendChild(el('h2', { text:'Haftalık menü', style:{ fontSize:'21px', marginBottom:'4px' } }));
  c.appendChild(el('p', { text:'Katılmak istediğiniz günleri ve seçeneği işaretleyin.', style:{ color:'var(--muted)', fontSize:'14px', display:'block', marginBottom:'18px' } }));
  const mb = msgBox(); if(mb) c.appendChild(mb);
  const rej = menu.filter(d => { const s = getSel(d); return s && s.paymentRejected; });
  if(rej.length){
    const b = el('div', { class:'msg error' });
    b.appendChild(el('div', { text:'⚠ Ödeme onaylanmadı', style:{ fontWeight:'700', marginBottom:'4px' } }));
    rej.forEach(d => b.appendChild(el('div', { text: formatDateTR(d.date) + ' tarihli siparişiniz için ödemeniz onaylanmadı. Lütfen kantinciyle görüşün.' })));
    c.appendChild(b);
  }
  if(!cfg.ordersOpen) c.appendChild(el('div', { class:'msg error', text:'Kantinci şu anda yeni sipariş almıyor. Sipariş alımı tekrar açıldığında seçim yapabilirsiniz.' }));
  if(!menu.length){ c.appendChild(el('div', { class:'empty-note', text:'Bu hafta için menü henüz girilmedi.' })); return c; }

  // ödemesi bekleyen geçmiş günler
  const pend = menu.filter(d => d.date < today && has(getSel(d)) && !getSel(d).paidByTeacher);
  if(pend.length){
    c.appendChild(el('div', { class:'section-title' }, [ el('h2', { text:'Ödemesi bekleyen geçmiş siparişler' }) ]));
    pend.forEach(d => c.appendChild(pastCard(d, getSel(d), tid, true)));
    c.appendChild(el('div', { class:'section-title' }, [ el('h2', { text:'Yaklaşan günler' }) ]));
  }

  const up = menu.filter(d => d.date >= today);
  if(!up.length) c.appendChild(el('div', { class:'empty-note', text:'Yaklaşan menü bulunmuyor.' }));
  up.forEach(day => {
    const sel = getSel(day), chosen = has(sel), dayClosed = isDayClosed(cfg, day);
    const n = countOrders(raw, day.id), hit = n >= DAILY_TARGET;
    const card = el('div', { class:'day-card' });
    card.appendChild(el('div', { class:'dc-top' }, [ el('div', { class:'dc-date', text:formatDateTR(day.date) }) ]));
    card.appendChild(el('div', {
      text: hit ? `🎯 Günlük hedefe ulaşıldı (${n}/${DAILY_TARGET} sipariş)` : `🎯 Günlük hedefe ulaşılmadı (${n}/${DAILY_TARGET} sipariş) · ${DAILY_TARGET - n} sipariş daha gerekiyor`,
      style:{ fontSize:'13px', fontWeight:'600', marginBottom:'10px', padding:'8px 10px', borderRadius:'9px', background: hit ? 'rgba(63,125,74,0.12)' : 'rgba(201,154,61,0.16)', color: hit ? 'var(--success)' : 'var(--gold-dark)' }
    }));
    card.appendChild(el('div', { class:'hint', text: (cfg.closedDays||{})[day.id] ? '🔒 Bu gün için sipariş alımı kapatıldı.' : 'Birden fazla seçenek işaretleyebilirsiniz.', style:{ display:'block', marginBottom:'8px' } }));
    const ow = el('div', { style:{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'12px' } });
    (day.options||[]).forEach(opt => {
      const active = chosen && sel.optionIds.includes(opt.id), oc = isOptClosed(cfg, opt), locked = dayClosed || oc;
      const b = el('button', { class:'toggle-btn' + (active ? ' active' : ''), style:{ display:'flex', justifyContent:'space-between', textAlign:'left' }, attrs: locked ? { disabled:'disabled' } : {} }, [
        el('span', { text:(active ? '✓ ' : '') + opt.name + (oc ? ' 🔒 kapalı' : '') }), el('span', { text:formatPrice(opt.price) })
      ]);
      b.addEventListener('click', async () => {
        clearMsgs();
        const fc = await getConfig();
        if(isDayClosed(fc, day) || isOptClosed(fc, opt)){ state.error = 'Bu seçenek için sipariş alımı kapatıldı.'; render(); return; }
        const f = await getSelections(); f[day.id] = f[day.id] || {};
        const cur = normalizeSelection(f[day.id][tid]) || { optionIds:[], paidByTeacher:false, paidConfirmed:false, paymentRejected:false, payMethod:null, paidAt:null };
        const i = cur.optionIds.indexOf(opt.id);
        if(i > -1) cur.optionIds.splice(i, 1); else cur.optionIds.push(opt.id);
        if(cur.optionIds.length) f[day.id][tid] = cur; else delete f[day.id][tid];
        await setSelections(f); render();
      });
      ow.appendChild(b);
    });
    card.appendChild(ow);
    if(chosen){
      card.appendChild(el('div', { text:'Toplam: ' + formatPrice(selTotal(day, sel)), style:{ fontWeight:'700', color:'var(--gold-dark)', fontSize:'14.5px', marginBottom:'10px' } }));
      card.appendChild(payControls(day, sel, tid, true));
    }
    c.appendChild(card);
  });

  // geçmiş siparişlerim (takvim)
  c.appendChild(el('div', { class:'section-title' }, [ el('h2', { text:'Geçmiş siparişlerim' }) ]));
  const cal = el('div', { class:'panel-card', style:{ marginBottom:'14px' } }), r = el('div', { class:'row' });
  [['Başlangıç tarihi','tFrom'], ['Bitiş tarihi (isteğe bağlı)','tTo']].forEach(([lab, k]) => {
    const f = el('div', { class:'field', style:{ marginBottom:'0' } }); f.appendChild(el('label', { text:lab }));
    const i = el('input', { attrs:{ type:'date', max:today } }); i.value = state[k];
    i.addEventListener('change', () => { state[k] = i.value; render(); });
    f.appendChild(i); r.appendChild(f);
  });
  cal.appendChild(r); c.appendChild(cal);
  let a = state.tFrom, b2 = state.tTo;
  if(a || b2){
    a = a || b2; b2 = b2 || a; if(a > b2) [a, b2] = [b2, a];
    const days = menu.filter(d => d.date >= a && d.date <= b2);
    if(!days.length) c.appendChild(el('div', { class:'empty-note', text:'Bu tarihlerde menü kaydı yok.' }));
    let tot = 0, ok = 0;
    days.forEach(d => { const s = getSel(d); if(has(s)){ const t = selTotal(d, s); tot += t; if(s.paidConfirmed) ok += t; } });
    if(tot) c.appendChild(el('div', { class:'msg success', text:`Toplam: ${formatPrice(tot)} · Onaylı ödeme: ${formatPrice(ok)} · Kalan: ${formatPrice(tot - ok)}` }));
    days.forEach(d => {
      const s = getSel(d);
      if(!has(s)){ c.appendChild(el('div', { class:'day-card', style:{ opacity:'0.75' } }, [ el('div', { class:'dc-date', text:formatDateTR(d.date) }), el('div', { class:'dc-items', text:'Bu gün sipariş vermediniz.', style:{ margin:'4px 0 0' } }) ])); return; }
      const card = pastCard(d, s, tid, false);
      if(s.paidByTeacher) card.lastChild.replaceWith(el('div', { text: PAY_TXT[payState(s)] + ' · ' + methodTxt(s.payMethod), style:{ paddingTop:'8px', borderTop:'1px solid var(--card-line)', fontSize:'13.5px', fontWeight:'600', color: s.paidConfirmed ? 'var(--success)' : 'var(--muted)' } }));
      c.appendChild(card);
    });
  }
  return c;
};

/* ---------- kantinci: sipariş satırı ---------- */
function orderRow(c, day, sels, tm){
  const raw = sels[day.id] || {}, fb = day.options && day.options[0] && day.options[0].id;
  const ents = Object.keys(raw).map(t => ({ t, s:normalizeSelection(raw[t], fb) })).filter(x => x.s && x.s.optionIds.length).sort((p, q) => (tm[p.t]||'').localeCompare(tm[q.t]||'', 'tr'));
  const pend = ents.filter(x => !x.s.paidConfirmed).length;
  c.appendChild(el('div', { class:'selection-row', on:{ click:()=>{ state.expanded[day.id] = !state.expanded[day.id]; render(); } } }, [
    el('div', { text:formatDateTR(day.date) }), el('div', { class:'count', text: ents.length + ' öğretmen' + (pend ? ` · ${pend} ödeme bekliyor` : '') })
  ]));
  if(!state.expanded[day.id]) return;
  const dt = el('div', { class:'selection-names', style:{ display:'flex', flexDirection:'column', gap:'8px', padding:'10px 4px 4px 4px' } });
  if(!ents.length) dt.appendChild(el('div', { text:'Henüz seçim yapılmadı.', style:{ color:'var(--muted)' } }));
  const set = async (t, fn) => { const f = await getSelections(), cur = normalizeSelection(f[day.id] && f[day.id][t]); if(!cur) return; fn(cur); f[day.id][t] = cur; await setSelections(f); render(); };
  const sp = (text, color) => el('span', { text, style:{ fontSize:'12.5px', fontWeight:'600', color:color || 'var(--muted)' } });
  const bt = (cls, text, fn) => el('button', { class:'btn ' + cls + ' btn-sm', text, on:{ click:fn } });
  ents.forEach(({ t, s }) => {
    const ln = el('div', { style:{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap', padding:'8px 10px', background:'var(--cream)', borderRadius:'9px' } });
    ln.appendChild(el('div', {}, [ el('div', { text:tm[t] || 'Bilinmeyen öğretmen', style:{ fontWeight:'600', fontSize:'14px' } }), el('div', { text:(selNames(day, s) || 'Seçenek silinmiş') + ' · ' + formatPrice(selTotal(day, s)), style:{ fontSize:'12.5px', color:'var(--muted)' } }) ]));
    const pw = el('div', { style:{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' } }), st = payState(s), mt = methodTxt(s.payMethod);
    if(st === 'ok'){ pw.appendChild(sp('✓ Ödendi · ' + mt, 'var(--success)')); pw.appendChild(bt('btn-outline', 'Geri al', () => set(t, x => { x.paidConfirmed = false; }))); }
    else if(st === 'wait'){
      pw.appendChild(sp('Ödeme bildirildi · ' + mt));
      pw.appendChild(bt('btn-gold', 'Onayla', () => set(t, x => { x.paidConfirmed = true; x.paymentRejected = false; })));
      pw.appendChild(bt('btn-danger', 'Reddet', () => set(t, x => { x.paidByTeacher = false; x.paidConfirmed = false; x.paymentRejected = true; x.payMethod = null; x.paidAt = null; })));
    } else pw.appendChild(sp(st === 'rej' ? 'Ödeme reddedildi' : 'Ödeme bekleniyor', 'var(--danger)'));
    ln.appendChild(pw); dt.appendChild(ln);
  });
  if(ents.length){
    const tb = el('div', { style:{ marginTop:'4px', paddingTop:'10px', borderTop:'1px dashed var(--card-line)' } });
    const h = t => el('div', { text:t, style:{ fontWeight:'700', fontSize:'13.5px', margin:'0 0 6px' } });
    const li = t => el('div', { text:t, style:{ fontSize:'13.5px', padding:'2px 0' } });
    tb.appendChild(h('Ürün bazında toplam'));
    (day.options||[]).forEach(o => { const n = ents.filter(x => x.s.optionIds.includes(o.id)).length; if(n) tb.appendChild(li(`${o.name}: ${n} adet`)); });
    const h2 = h('Ödeme özeti'); h2.style.marginTop = '10px'; tb.appendChild(h2);
    const sum = {}; let ok = 0, all = 0;
    ents.forEach(({ s }) => { const t = selTotal(day, s); all += t; if(s.paidConfirmed) ok += t; if(s.paidByTeacher){ const k = methodTxt(s.payMethod); sum[k] = sum[k] || [0, 0]; sum[k][0]++; sum[k][1] += t; } });
    Object.keys(sum).forEach(k => tb.appendChild(li(`${k}: ${sum[k][0]} kişi — ${formatPrice(sum[k][1])}`)));
    tb.appendChild(li(`Onaylı: ${formatPrice(ok)} · Kalan: ${formatPrice(all - ok)} · Toplam: ${formatPrice(all)}`));
    dt.appendChild(tb);
  }
  c.appendChild(dt);
}

/* ---------- kantinci: Excel ---------- */
function xlTable(ws, head, rows, o){
  o = o || {};
  const B = { style:'thin', color:{ argb:'FFBBBBBB' } }, bd = { top:B, left:B, bottom:B, right:B }, money = o.money || [], fmt = '#,##0.00 "₺"';
  const fill = argb => ({ type:'pattern', pattern:'solid', fgColor:{ argb } });
  const h = ws.addRow(head);
  h.eachCell(c => { c.font = { bold:true, color:{ argb:'FFFFFFFF' } }; c.fill = fill('FF28362C'); c.alignment = { horizontal:'center', vertical:'middle', wrapText:true }; c.border = bd; });
  rows.forEach(r => ws.addRow(r).eachCell({ includeEmpty:true }, (c, i) => {
    c.border = bd; c.alignment = { vertical:'middle', wrapText:true };
    if(money.includes(i - 1)) c.numFmt = fmt;
    if((o.date||[]).includes(i - 1)) c.numFmt = 'dd.mm.yyyy';
  }));
  const f = h.number + 1, l = h.number + rows.length;
  if(o.sum && rows.length){
    const t = ws.addRow(head.map((_, i) => i === 0 ? 'TOPLAM' : ''));
    o.sum.forEach(i => { const L = String.fromCharCode(65 + i); t.getCell(i + 1).value = { formula:`SUBTOTAL(109,${L}${f}:${L}${l})`, result: rows.reduce((s, r) => s + (Number(r[i])||0), 0) }; if(money.includes(i)) t.getCell(i + 1).numFmt = fmt; });
    t.eachCell({ includeEmpty:true }, c => { c.font = { bold:true }; c.border = bd; c.fill = fill('FFF2EAD9'); });
  }
  return { f, l };
}
async function exportExcel(mode, ds){
  if(typeof ExcelJS === 'undefined'){ alert('Excel kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.'); return; }
  const [y, mo, d0] = ds.split('-').map(Number), dow = mode === 'day' ? 0 : (new Date(y, mo-1, d0).getDay() + 6) % 7;
  const from = dateToStr(new Date(y, mo-1, d0 - dow)), to = mode === 'day' ? from : dateToStr(new Date(y, mo-1, d0 - dow + 6));
  const [menu, sels, teachers] = await Promise.all([getMenu(), getSelections(), getTeachers()]);
  const tm = {}; teachers.forEach(t => tm[t.id] = t.name);
  const UD = s => { const [a, b, c] = s.split('-').map(Number); return new Date(Date.UTC(a, b-1, c)); };
  const gun = s => DAYS_TR[UD(s).getUTCDay()];
  const detail = [], prod = [], perDay = [], perT = {}, meth = { kart:[0,0,0], nakit:[0,0,0], iban:[0,0,0], yok:[0,0,0] }, G = { n:0, tot:0, ok:0, wait:0, no:0 };
  menu.filter(d => d.date >= from && d.date <= to).forEach(d => {
    const ents = Object.keys(sels[d.id]||{}).map(t => ({ t, s:normalizeSelection(sels[d.id][t], d.options && d.options[0] && d.options[0].id) })).filter(x => x.s && x.s.optionIds.length).sort((p, q) => (tm[p.t]||'').localeCompare(tm[q.t]||'', 'tr'));
    const D = { n:ents.length, tot:0, ok:0, wait:0, no:0 };
    ents.forEach(({ t, s }) => {
      const amt = selTotal(d, s), st = payState(s), name = tm[t] || 'Silinmiş öğretmen', k = st === 'ok' ? 'ok' : st === 'wait' ? 'wait' : 'no';
      [D, G].forEach(z => { z.tot += amt; z[k] += amt; }); G.n++;
      const T = perT[t] = perT[t] || { name, n:0, tot:0, ok:0, wait:0, no:0 }; T.n++; T.tot += amt; T[k] += amt;
      if(s.paidByTeacher){ const mk = PAY_LABELS[s.payMethod] ? s.payMethod : 'yok'; meth[mk][0]++; meth[mk][1] += amt; if(st === 'ok') meth[mk][2] += amt; }
      const items = s.optionIds.map(id => { const o = (d.options||[]).find(x => x.id === id); return o ? `${o.name} (${formatPrice(o.price)})` : ''; }).filter(Boolean).join(', ');
      detail.push([UD(d.date), gun(d.date), name, items, amt, PAY_TXT[st], s.paidByTeacher ? methodTxt(s.payMethod) : '', s.paidAt ? new Date(s.paidAt).toLocaleString('tr-TR') : '']);
    });
    (d.options||[]).forEach(o => { const n = ents.filter(x => x.s.optionIds.includes(o.id)).length, p = Number(o.price)||0; if(n) prod.push([UD(d.date), gun(d.date), o.name, p, n, n * p]); });
    perDay.push([UD(d.date), gun(d.date), D.n, D.tot, D.ok, D.wait, D.no]);
  });
  if(!G.n){ alert('Seçilen dönemde sipariş kaydı yok.'); return; }
  const wb = new ExcelJS.Workbook(); wb.creator = SCHOOL_NAME;
  const sheet = (name, widths) => { const w = wb.addWorksheet(name); widths.forEach((x, i) => w.getColumn(i + 1).width = x); return w; };
  const money = '#,##0.00 "₺"';
  // Özet
  const ws = sheet('Özet', [32, 16, 16, 18, 18, 18, 18]);
  ws.addRow(['Kantin Sipariş ve Ödeme Raporu']).font = { bold:true, size:16 };
  ws.addRow([SCHOOL_NAME]);
  ws.addRow(['Dönem: ' + dmy(from) + (to !== from ? ' – ' + dmy(to) : '') + (mode === 'day' ? ' (Günlük)' : ' (Haftalık)')]);
  ws.addRow(['Oluşturulma: ' + new Date().toLocaleString('tr-TR')]);
  const sec = t => { ws.addRow([]); ws.addRow([t]).font = { bold:true, size:12, color:{ argb:'FF28362C' } }; };
  sec('GENEL DURUM');
  const t1 = xlTable(ws, ['Bilgi', 'Değer'], [['Toplam sipariş (öğretmen × gün)', G.n], ['Sipariş veren öğretmen sayısı', Object.keys(perT).length], ['Toplam sipariş tutarı', G.tot], ['Onaylanan ödemeler', G.ok], ['Onay bekleyen (öğretmen bildirdi)', G.wait], ['Ödeme yapılmamış / reddedilen', G.no]]);
  for(let r = t1.f + 2; r <= t1.l; r++) ws.getRow(r).getCell(2).numFmt = money;
  sec('ÖDEME YÖNTEMİNE GÖRE (öğretmen bildirimi)');
  xlTable(ws, ['Yöntem', 'Sipariş sayısı', 'Bildirilen tutar', 'Onaylı tutar'], Object.keys(meth).filter(k => k !== 'yok' || meth.yok[0]).map(k => [k === 'yok' ? 'Yöntem belirtilmemiş' : PAY_LABELS[k], meth[k][0], meth[k][1], meth[k][2]]), { money:[2, 3] });
  sec('GÜNLERE GÖRE');
  xlTable(ws, ['Tarih', 'Gün', 'Sipariş veren', 'Toplam tutar', 'Onaylı ödeme', 'Onay bekleyen', 'Ödenmemiş'], perDay, { date:[0], money:[3, 4, 5, 6], sum:[2, 3, 4, 5, 6] });
  // Siparişler
  const wd = sheet('Siparişler', [14, 14, 26, 48, 14, 28, 16, 22]);
  const td = xlTable(wd, ['Tarih', 'Gün', 'Öğretmen', 'Sipariş (ürün ve fiyat)', 'Tutar', 'Ödeme durumu', 'Ödeme yöntemi', 'Ödeme bildirim zamanı'], detail, { date:[0], money:[4], sum:[4] });
  const fills = { ok:'FFD9EAD3', wait:'FFFFF2CC', rej:'FFF4CCCC', no:'FFFCE5CD' };
  detail.forEach((r, i) => { const k = Object.keys(PAY_TXT).find(x => PAY_TXT[x] === r[5]); wd.getRow(td.f + i).getCell(6).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:fills[k] } }; });
  wd.views = [{ state:'frozen', ySplit:1 }]; wd.autoFilter = { from:'A1', to:'H' + td.l };
  // Ürünler
  const wp = sheet('Ürün Adetleri', [14, 14, 40, 14, 10, 16]);
  xlTable(wp, ['Tarih', 'Gün', 'Ürün', 'Birim fiyat', 'Adet', 'Toplam tutar'], prod, { date:[0], money:[3, 5], sum:[4, 5] });
  wp.views = [{ state:'frozen', ySplit:1 }];
  // Öğretmenler
  const wt = sheet('Öğretmen Özeti', [28, 14, 16, 16, 16, 18]);
  xlTable(wt, ['Öğretmen', 'Sipariş günü', 'Toplam tutar', 'Onaylı ödeme', 'Onay bekleyen', 'Ödenmemiş (kalan)'], Object.values(perT).sort((p, q) => p.name.localeCompare(q.name, 'tr')).map(T => [T.name, T.n, T.tot, T.ok, T.wait, T.no]), { money:[2, 3, 4, 5], sum:[1, 2, 3, 4, 5] });
  wt.views = [{ state:'frozen', ySplit:1 }];
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `kantin_${mode === 'day' ? 'gunluk' : 'haftalik'}_${from}${to !== from ? '_' + to : ''}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportCard(today){
  const card = el('div', { class:'panel-card', style:{ marginBottom:'20px' } });
  card.appendChild(el('div', { text:'📥 Excel raporu', style:{ fontWeight:'700', fontSize:'15px', marginBottom:'4px' } }));
  card.appendChild(el('div', { text:'Siparişler, ödemeler, ürün adetleri ve öğretmen bazlı özet tek dosyada indirilir.', style:{ fontSize:'13px', color:'var(--muted)', marginBottom:'12px' } }));
  const row = el('div', { class:'row', style:{ marginBottom:'12px' } });
  [['day', 'Günlük'], ['week', 'Haftalık']].forEach(([k, t]) => row.appendChild(el('button', { class:'toggle-btn' + (state.exportMode === k ? ' active' : ''), text:t, on:{ click:()=>{ state.exportMode = k; render(); } } })));
  card.appendChild(row);
  const f = el('div', { class:'field' }); f.appendChild(el('label', { text: state.exportMode === 'day' ? 'Tarih' : 'Haftadan herhangi bir gün (Pazartesi–Pazar alınır)' }));
  const i = el('input', { attrs:{ type:'date' } }); i.value = state.exportDate || today;
  i.addEventListener('change', () => { state.exportDate = i.value; render(); });
  f.appendChild(i); card.appendChild(f);
  card.appendChild(el('button', { class:'btn btn-gold', text:"Excel'i indir", on:{ click:()=>exportExcel(state.exportMode, i.value || today) } }));
  return card;
}

/* ---------- kantinci paneli ---------- */
viewCanteenPanel = async function(){
  const c = el('div'), today = todayStr();
  const [menu, sels, teachers, cfg] = await Promise.all([getMenu(), getSelections(), getTeachers(), getConfig()]);
  const tm = {}; teachers.forEach(t => tm[t.id] = t.name);
  const mb = msgBox(); if(mb) c.appendChild(mb);
  const tg = el('div', { class:'panel-card', style:{ marginBottom:'20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' } });
  tg.appendChild(el('div', {}, [ el('div', { text:'Tüm siparişler', style:{ fontWeight:'700', fontSize:'15px' } }), el('div', { text: cfg.ordersOpen ? 'Açık — öğretmenler seçim yapabilir.' : 'Kapalı — hiçbir güne sipariş verilemiyor.', style:{ fontSize:'13px', color:'var(--muted)', marginTop:'2px' } }) ]));
  tg.appendChild(el('button', { class:'btn btn-sm ' + (cfg.ordersOpen ? 'btn-dark' : 'btn-gold'), text: cfg.ordersOpen ? 'Kapat' : 'Aç', style:{ width:'auto' }, on:{ click: async () => { const f = await getConfig(); f.ordersOpen = !f.ordersOpen; await setConfig(f); render(); } } }));
  c.appendChild(tg);
  c.appendChild(exportCard(today));

  c.appendChild(el('div', { class:'section-title' }, [ el('h2', { text:'Haftalık menü' }), el('button', { class:'btn btn-gold btn-sm', text:'+ Gün ekle', on:{ click:()=>{ state.modal = { type:'editDay', dayId:null }; render(); } } }) ]));
  const up = menu.filter(d => d.date >= today);
  if(!up.length) c.appendChild(el('div', { class:'empty-note', text:'Yaklaşan menü yok. "Gün ekle" ile başlayın.' }));
  up.forEach(day => {
    const dc = !!(cfg.closedDays||{})[day.id], card = el('div', { class:'day-card' });
    card.appendChild(el('div', { class:'dc-top' }, [ el('div', { class:'dc-date', text:formatDateTR(day.date) }), dc ? el('div', { text:'🔒 Gün kapalı', style:{ color:'var(--danger)', fontWeight:'700', fontSize:'13px' } }) : null ]));
    const ol = el('div', { class:'dc-items' });
    (day.options||[]).forEach(o => {
      const oc = isOptClosed(cfg, o);
      ol.appendChild(el('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', padding:'3px 0' } }, [
        el('span', { text:`• ${o.name} — ${formatPrice(o.price)}` + (oc ? ' 🔒' : '') }),
        el('button', { class:'btn btn-outline btn-sm', text: oc ? 'Ürünü aç' : 'Ürünü kapat', style:{ padding:'5px 10px' }, on:{ click:()=>setClosed('opt', o.id, !oc) } })
      ]));
    });
    card.appendChild(ol);
    const ac = el('div', { class:'dc-admin-actions' });
    ac.appendChild(el('button', { class:'btn btn-sm ' + (dc ? 'btn-gold' : 'btn-dark'), text: dc ? '🔓 Günü aç' : '🔒 Günü kapat', on:{ click:()=>setClosed('day', day.id, !dc) } }));
    ac.appendChild(el('button', { class:'btn btn-outline btn-sm', text:'Düzenle', on:{ click:()=>{ state.modal = { type:'editDay', dayId:day.id }; render(); } } }));
    ac.appendChild(el('button', { class:'btn btn-danger btn-sm', text:'Sil', on:{ click: async () => {
      if(!confirm('Bu günü silmek istediğinize emin misiniz?')) return;
      await setMenu((await getMenu()).filter(d => d.id !== day.id));
      const f = await getSelections(); delete f[day.id]; await setSelections(f); render();
    } } }));
    card.appendChild(ac); c.appendChild(card);
  });

  c.appendChild(el('div', { class:'section-title' }, [ el('h2', { text:'Siparişler' }) ]));
  if(!up.length) c.appendChild(el('div', { class:'empty-note', text:'Menü eklendiğinde siparişler burada görünecek.' }));
  up.forEach(d => orderRow(c, d, sels, tm));

  const open = menu.filter(d => d.date < today && Object.values(sels[d.id]||{}).some(v => { const s = normalizeSelection(v); return s && s.optionIds.length && !s.paidConfirmed; }));
  if(open.length){
    c.appendChild(el('div', { class:'section-title' }, [ el('h2', { text:'Ödemesi tamamlanmamış geçmiş günler' }) ]));
    open.forEach(d => orderRow(c, d, sels, tm));
  }

  c.appendChild(el('div', { class:'section-title' }, [ el('h2', { text:'Geçmiş siparişler' }) ]));
  const cal = el('div', { class:'panel-card', style:{ marginBottom:'14px' } }), df = el('div', { class:'field', style:{ marginBottom:'0' } });
  df.appendChild(el('label', { text:'Tarih seçin' }));
  const di = el('input', { attrs:{ type:'date', max:today } }); di.value = state.historyDate || '';
  di.addEventListener('change', () => { state.historyDate = di.value; render(); });
  df.appendChild(di); cal.appendChild(df); c.appendChild(cal);
  if(state.historyDate){
    const hd = menu.find(d => d.date === state.historyDate);
    if(!hd) c.appendChild(el('div', { class:'empty-note', text:'Bu tarih için kayıtlı menü bulunamadı.' }));
    else {
      const card = el('div', { class:'day-card' });
      card.appendChild(el('div', { class:'dc-top' }, [ el('div', { class:'dc-date', text:formatDateTR(hd.date) }) ]));
      const ol = el('div', { class:'dc-items' }); (hd.options||[]).forEach(o => ol.appendChild(el('div', { text:`• ${o.name} — ${formatPrice(o.price)}` })));
      card.appendChild(ol); c.appendChild(card);
      orderRow(c, hd, sels, tm);
      c.appendChild(el('button', { class:'btn btn-danger btn-sm', text:'🗑 Bu günün kaydını sil', style:{ width:'auto', marginTop:'4px' }, on:{ click: async () => {
        if(!confirm(formatDateTR(hd.date) + ' tarihine ait menü ve sipariş kaydını tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
        await setMenu((await getMenu()).filter(d => d.id !== hd.id));
        const f = await getSelections(); delete f[hd.id]; await setSelections(f);
        state.historyDate = ''; state.info = 'Geçmiş kayıt silindi.'; render();
      } } }));
    }
  }
  return c;
};

/* ---------- ana sayfa: ana ekrana ekle ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
const _viewHome = viewHome;
viewHome = function(){
  const c = _viewHome();
  if(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return c;
  c.appendChild(el('button', { class:'btn btn-outline', text:'📲 Ana ekrana ekle', style:{ marginTop:'18px' }, on:{ click: async () => {
    if(installEvt){ installEvt.prompt(); installEvt = null; return; }
    alert(/iphone|ipad|ipod/i.test(navigator.userAgent)
      ? 'Safari\'de alttaki Paylaş simgesine dokunun, ardından "Ana Ekrana Ekle"yi seçin.'
      : 'Tarayıcı menüsünü (⋮) açın ve "Ana ekrana ekle" ya da "Uygulamayı yükle"yi seçin.');
  } } }));
  return c;
};

render();
