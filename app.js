// ============================================================
//  식당 테이블 주문 앱 v4 — 버그 수정 버전
// ============================================================
const SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwUMoWJowguvPOWrJCoSTPT0n28-LMRVsBA5_LRqm1Dk_zdBcvJRtVA6c7sfXcHmOwf4A/exec";
const STORAGE_KEY = "restaurant-v3";
const PIN_CODE    = "1234";

const TABLE_DEFINITIONS = [
  { id:"hall-left-1",    name:"홀 좌측 1",   zone:"hall-left",    group:"홀 좌측" },
  { id:"hall-left-2",    name:"홀 좌측 2",   zone:"hall-left",    group:"홀 좌측" },
  { id:"hall-left-3",    name:"홀 좌측 3",   zone:"hall-left",    group:"홀 좌측" },
  { id:"hall-left-4",    name:"홀 좌측 4",   zone:"hall-left",    group:"홀 좌측" },
  { id:"hall-center-1",  name:"홀 가운데 1", zone:"hall-center",  group:"홀 가운데" },
  { id:"hall-center-2",  name:"홀 가운데 2", zone:"hall-center",  group:"홀 가운데" },
  { id:"hall-center-3",  name:"홀 가운데 3", zone:"hall-center",  group:"홀 가운데" },
  { id:"hall-center-4",  name:"홀 가운데 4", zone:"hall-center",  group:"홀 가운데" },
  { id:"hall-center-5",  name:"홀 가운데 5", zone:"hall-center",  group:"홀 가운데" },
  { id:"hall-right-1",   name:"홀 우측 1",   zone:"hall-right",   group:"홀 우측" },
  { id:"hall-right-2",   name:"홀 우측 2",   zone:"hall-right",   group:"홀 우측" },
  { id:"hall-right-3",   name:"홀 우측 3",   zone:"hall-right",   group:"홀 우측" },
  { id:"hall-right-4",   name:"홀 우측 4",   zone:"hall-right",   group:"홀 우측" },
  { id:"hall-right-5",   name:"홀 우측 5",   zone:"hall-right",   group:"홀 우측" },
  { id:"room-large-1",   name:"큰방 1",      zone:"room-large",   group:"큰방" },
  { id:"room-large-2",   name:"큰방 2",      zone:"room-large",   group:"큰방" },
  { id:"room-large-3",   name:"큰방 3",      zone:"room-large",   group:"큰방" },
  { id:"room-small-1-1", name:"작은방 1-1",  zone:"room-small-1", group:"작은방 1" },
  { id:"room-small-1-2", name:"작은방 1-2",  zone:"room-small-1", group:"작은방 1" },
  { id:"room-small-2-1", name:"작은방 2-1",  zone:"room-small-2", group:"작은방 2" },
];

const DEFAULT_MENUS = [
  { id:"m1", name:"로스구이 한마리", price:70000 },
  { id:"m2", name:"로스구이 반마리", price:50000 },
  { id:"m3", name:"백숙 한마리",    price:80000 },
  { id:"m4", name:"백숙 반마리",    price:50000 },
  { id:"m5", name:"찹쌀밥",         price:4000  },
  { id:"m6", name:"매밥",           price:2000  },
  { id:"m7", name:"소주",           price:5000  },
  { id:"m8", name:"맥주",           price:5000  },
  { id:"m9", name:"음료",           price:2000  },
];

const state = loadState();
let timerInterval = null;
let pinResolve = null;
let openRoomZoneId = null;

function createDefaultState() {
  return {
    activeTableId:    TABLE_DEFINITIONS[0].id,
    selectedTableIds: [TABLE_DEFINITIONS[0].id],
    tables:      TABLE_DEFINITIONS.map(t => ({ ...t, orders:[], mergeGroupId:null, seatedAt:null })),
    mergeGroups: [],
    materials:   [],
    menus:       DEFAULT_MENUS.map(m => ({...m})),
    activeTab:   "orders",
  };
}

function loadState() {
  const fb = createDefaultState();
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return fb;
  try {
    const p = JSON.parse(saved);
    if (!p || !Array.isArray(p.tables)) return fb;
    const tables = TABLE_DEFINITIONS.map(def => {
      const s = p.tables.find(t => t.id === def.id);
      return { ...def, orders: Array.isArray(s?.orders) ? s.orders : [], mergeGroupId: s?.mergeGroupId ?? null, seatedAt: s?.seatedAt ?? null };
    });
    const mergeGroups = Array.isArray(p.mergeGroups)
      ? p.mergeGroups.filter(g => typeof g.id==="string" && Array.isArray(g.tableIds) && g.tableIds.length>1) : [];
    const activeTableId = TABLE_DEFINITIONS.some(t=>t.id===p.activeTableId) ? p.activeTableId : fb.activeTableId;
    const sel = Array.isArray(p.selectedTableIds) ? p.selectedTableIds.filter(id=>TABLE_DEFINITIONS.some(t=>t.id===id)) : [activeTableId];
    return {
      activeTableId,
      selectedTableIds: sel.length ? sel : [activeTableId],
      tables, mergeGroups,
      materials: Array.isArray(p.materials) ? p.materials : [],
      menus: Array.isArray(p.menus) && p.menus.length ? p.menus : fb.menus,
      activeTab: p.activeTab || "orders",
    };
  } catch { return fb; }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

const fmt    = v => `${Number(v).toLocaleString("ko-KR")}원`;
const nowISO = () => new Date().toISOString();
const esc    = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function getTableById(id)      { return state.tables.find(t=>t.id===id); }
function getMergeGroupById(id) { return state.mergeGroups.find(g=>g.id===id); }
function getGroupForTable(id)  { const t=getTableById(id); return t?.mergeGroupId ? getMergeGroupById(t.mergeGroupId) : null; }
function getSharedTableIds(id) { const g=getGroupForTable(id); return g ? g.tableIds : [id]; }
function getSharedOrders(id)   { const s=getTableById(getSharedTableIds(id)[0]); return s ? s.orders : []; }
function calcTotal(orders)     { return orders.reduce((s,o)=>s+o.price*o.qty,0); }
function calcTableTotal(id)    { return calcTotal(getSharedOrders(id)); }
function getDisplayName(id)    { const t=getTableById(id),g=getGroupForTable(id); return g?g.name:t?.name??""; }
function getRepTable(id)       { return getTableById(getSharedTableIds(id)[0]); }
function getShortName(id) {
  const t=getTableById(id); if(!t) return "";
  return t.name.replace("홀 좌측 ","좌").replace("홀 가운데 ","중").replace("홀 우측 ","우").replace("작은방 1-","소1-").replace("작은방 2-","소2-");
}
function elapsedStr(iso) {
  if (!iso) return "";
  const mins = Math.floor((Date.now()-new Date(iso).getTime())/60000);
  if (mins < 60) return `${mins}분`;
  return `${Math.floor(mins/60)}시간 ${mins%60}분`;
}

async function sendToSheet(payload) {
  if (!SHEET_WEBHOOK_URL) return;
  try { await fetch(SHEET_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(payload)}); } catch(_){}
}

function setSyncStatus(text,type) {
  const el = document.querySelector("#sync-status");
  if (!el) return;
  el.textContent = text;
  el.className   = `sync-status${type?" sync-status--"+type:""}`;
  el.hidden      = !text;
}

function showPinModal(title="PIN을 입력하세요") {
  return new Promise(resolve => {
    pinResolve = resolve;
    const modal = document.querySelector("#pin-modal");
    document.querySelector("#pin-title").textContent = title;
    document.querySelector("#pin-display").textContent = "· · · ·";
    document.querySelector("#pin-error").textContent = "";
    modal.dataset.input = "";
    modal.hidden = false;
  });
}

function updatePinDisplay(val) {
  document.querySelector("#pin-display").textContent = val.padEnd(4,"·").split("").join(" ");
}

document.querySelector("#pin-modal").addEventListener("click", e => {
  const btn = e.target.closest("[data-pin]");
  if (!btn) return;
  const modal = document.querySelector("#pin-modal");
  const key   = btn.dataset.pin;
  if (key === "cancel") {
    modal.hidden = true;
    if (pinResolve) { pinResolve(false); pinResolve = null; }
    return;
  }
  if (key === "del") {
    modal.dataset.input = modal.dataset.input.slice(0,-1);
    updatePinDisplay(modal.dataset.input);
    return;
  }
  modal.dataset.input = (modal.dataset.input+key).slice(0,4);
  updatePinDisplay(modal.dataset.input);
  if (modal.dataset.input.length === 4) {
    if (modal.dataset.input === PIN_CODE) {
      modal.hidden = true;
      if (pinResolve) { pinResolve(true); pinResolve = null; }
    } else {
      document.querySelector("#pin-error").textContent = "PIN이 틀렸습니다";
      modal.dataset.input = "";
      updatePinDisplay("");
    }
  }
});

async function checkoutActiveTable() {
  const orders = getSharedOrders(state.activeTableId);
  if (!orders.length) { alert("주문 내역이 없습니다."); return; }
  const ok = await showPinModal("결제 확인 — PIN 입력");
  if (!ok) return;
  showReceipt(getDisplayName(state.activeTableId), orders, calcTableTotal(state.activeTableId));
}

function showReceipt(tableName, orders, total) {
  const modal   = document.querySelector("#receipt-modal");
  const now     = new Date();
  const dateStr = now.toLocaleDateString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"});
  const timeStr = now.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});
  document.querySelector("#receipt-content").innerHTML = `
    <div class="rc-header">
      <div class="rc-logo">🍗</div><h2>영수증</h2>
      <p>${esc(tableName)} · ${dateStr} ${timeStr}</p>
    </div>
    <table class="rc-table">
      <thead><tr><th>메뉴</th><th class="rc-num">수량</th><th class="rc-num">단가</th><th class="rc-num">금액</th></tr></thead>
      <tbody>${orders.map(o=>`<tr><td>${esc(o.name)}</td><td class="rc-num">${o.qty}</td><td class="rc-num">${fmt(o.price)}</td><td class="rc-num">${fmt(o.price*o.qty)}</td></tr>`).join("")}</tbody>
    </table>
    <div class="rc-total">합계: <strong>${fmt(total)}</strong></div>`;
  modal.hidden            = false;
  modal.dataset.tableName = tableName;
  modal.dataset.total     = total;
  modal.dataset.orders    = JSON.stringify(orders);
}

document.querySelector("#receipt-print").addEventListener("click", () => window.print());
document.querySelector("#receipt-cancel").addEventListener("click", () => { document.querySelector("#receipt-modal").hidden = true; });
document.querySelector("#receipt-confirm").addEventListener("click", async () => {
  const modal     = document.querySelector("#receipt-modal");
  const tableName = modal.dataset.tableName;
  const total     = Number(modal.dataset.total);
  const orders    = JSON.parse(modal.dataset.orders);
  modal.hidden    = true;
  setSyncStatus("전송 중…","pending");
  if (SHEET_WEBHOOK_URL) {
    try {
      const res  = await fetch(SHEET_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify({action:"checkout",tableName,orders,total,checkedOutAt:nowISO()})});
      const data = await res.json();
      setSyncStatus(data.ok?"시트 기록 완료 ✓":`오류: ${data.error}`, data.ok?"ok":"error");
    } catch { setSyncStatus("네트워크 오류","error"); }
  } else { setSyncStatus("URL 미설정","warn"); }
  const holder    = getRepTable(state.activeTableId);
  holder.orders   = [];
  holder.seatedAt = null;
  saveState(); render();
  setTimeout(()=>setSyncStatus("",""),4000);
});

document.querySelector("#reset-button").addEventListener("click", async () => {
  const ok = await showPinModal("전체 초기화 — PIN 입력");
  if (!ok) return;
  if (!confirm("모든 테이블 주문을 초기화할까요?")) return;
  const next = createDefaultState();
  Object.assign(state, { activeTableId:next.activeTableId, selectedTableIds:next.selectedTableIds, tables:next.tables, mergeGroups:next.mergeGroups });
  saveState(); render();
});

function renderKDS() {
  const container = document.querySelector("#kds-list");
  if (!container) return;
  container.innerHTML = "";
  const seen = new Set();
  let anyOrder = false;
  state.tables.forEach(t => {
    const key = t.mergeGroupId ?? t.id;
    if (seen.has(key)) return;
    seen.add(key);
    const orders = getSharedOrders(t.id).filter(o=>!o.served);
    if (!orders.length) return;
    anyOrder = true;
    const card = document.createElement("div");
    card.className = "kds-card";
    card.innerHTML = `<div class="kds-table-name">${esc(getDisplayName(t.id))}</div>${orders.map(o=>`<div class="kds-item"><span class="kds-qty">×${o.qty}</span><span class="kds-name">${esc(o.name)}</span>${o.memo?`<span class="kds-memo">${esc(o.memo)}</span>`:""}<button class="kds-done" data-table="${t.id}" data-order="${o.id}">완료</button></div>`).join("")}`;
    container.appendChild(card);
  });
  if (!anyOrder) container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">대기 중인 주문이 없습니다</div>`;
  container.querySelectorAll(".kds-done").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const order = getSharedOrders(btn.dataset.table).find(o=>o.id===btn.dataset.order);
      if (order) { order.served=true; saveState(); render(); }
    });
  });
}

function renderMenuManage() {
  const list = document.querySelector("#menu-manage-list");
  if (!list) return;
  list.innerHTML = "";
  state.menus.forEach(menu=>{
    const li = document.createElement("li");
    li.className = "menu-manage-item";
    li.innerHTML = `<span class="menu-manage-name">${esc(menu.name)}</span><span class="menu-manage-price">${fmt(menu.price)}</span><button class="ghost-button menu-edit-btn" data-id="${menu.id}" type="button">수정</button><button class="ghost-button menu-del-btn" data-id="${menu.id}" type="button">삭제</button>`;
    list.appendChild(li);
  });
  list.querySelectorAll(".menu-del-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      if (!confirm("이 메뉴를 삭제할까요?")) return;
      state.menus = state.menus.filter(m=>m.id!==btn.dataset.id);
      saveState(); renderMenuManage(); syncMenuSelects();
    });
  });
  list.querySelectorAll(".menu-edit-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const menu = state.menus.find(m=>m.id===btn.dataset.id);
      if (!menu) return;
      const newName = prompt("메뉴 이름:", menu.name);
      if (!newName) return;
      const newPrice = parseInt(prompt("가격:", menu.price),10);
      if (isNaN(newPrice)) return;
      menu.name = newName.trim(); menu.price = newPrice;
      saveState(); renderMenuManage(); syncMenuSelects();
    });
  });
}

function syncMenuSelects() {
  const sel = document.querySelector("#menu-select");
  if (!sel) return;
  sel.innerHTML = state.menus.map(m=>`<option value="${esc(m.name)}">${esc(m.name)}</option>`).join("");
  syncPriceWithMenu();
  renderQuickMenu();
}

function renderQuickMenu() {
  const container = document.querySelector(".quick-menu");
  if (!container) return;
  container.innerHTML = state.menus.map(m=>`<button class="chip" data-name="${esc(m.name)}" data-price="${m.price}" type="button">${esc(m.name)}</button>`).join("");
  container.querySelectorAll(".chip").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelector("#menu-select").value = btn.dataset.name;
      document.querySelector("#menu-price").value  = btn.dataset.price;
      document.querySelector("#menu-qty").focus();
    });
  });
}

document.querySelector("#menu-add-form").addEventListener("submit", e=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const name = String(fd.get("newMenuName")).trim();
  const price = parseInt(fd.get("newMenuPrice"),10);
  if (!name || isNaN(price)) return;
  state.menus.push({ id:crypto.randomUUID(), name, price });
  saveState(); renderMenuManage(); syncMenuSelects();
  e.target.reset();
});

function makeTableCard(table, onClick) {
  const tmpl     = document.querySelector("#table-card-template").content.cloneNode(true);
  const btn      = tmpl.firstElementChild;
  const selBtn   = btn.querySelector(".table-select");
  const shOrders = getSharedOrders(table.id);
  const waiting  = shOrders.filter(o=>!o.served).length;
  const group    = getGroupForTable(table.id);
  const repT     = getRepTable(table.id);
  const elapsed  = repT?.seatedAt ? elapsedStr(repT.seatedAt) : "";

  btn.querySelector(".table-card__name").textContent  = table.name;
  btn.querySelector(".table-card__total").textContent = shOrders.length ? fmt(calcTableTotal(table.id)) : "0원";
  btn.querySelector(".table-card__meta").textContent  = shOrders.length===0 ? "빈 테이블" : `${shOrders.length}건 · 대기${waiting}${elapsed?" · "+elapsed:""}`;
  btn.querySelector(".table-card__badge").textContent = group ? "묶음" : "";

  if (shOrders.length > 0) btn.classList.add("is-occupied");
  if (waiting > 0)         btn.classList.add("has-waiting");
  if (table.id===state.activeTableId) btn.classList.add("is-active");
  if (state.selectedTableIds.includes(table.id)) { selBtn.classList.add("is-selected"); selBtn.textContent="✓선택"; }

  btn.addEventListener("click", () => onClick ? onClick(table.id) : selectTable(table.id));
  selBtn.addEventListener("click", e=>{ e.stopPropagation(); toggleSelection(table.id); });
  return btn;
}

function selectTable(tableId) {
  state.activeTableId = tableId;
  if (!state.selectedTableIds.includes(tableId)) state.selectedTableIds = [tableId];
  switchTab("orders");
  saveState(); render();
}

function openRoomPopup(zoneId) {
  const zoneLabels = {"room-large":"큰방","room-small-1":"작은방 1","room-small-2":"작은방 2"};
  openRoomZoneId = zoneId;
  document.querySelector("#room-modal-title").textContent = zoneLabels[zoneId] || zoneId;
  renderRoomModalTables(zoneId);
  document.querySelector("#room-modal").hidden = false;
}

function renderRoomModalTables(zoneId) {
  const container = document.querySelector("#room-modal-tables");
  container.innerHTML = "";
  state.tables.filter(t=>t.zone===zoneId).forEach(table=>{
    container.appendChild(makeTableCard(table, (tableId)=>{
      selectTable(tableId);
      closeRoomModal();
    }));
  });
}

function closeRoomModal() {
  openRoomZoneId = null;
  document.querySelector("#room-modal").hidden = true;
}

document.querySelector("#room-modal-close").addEventListener("click", closeRoomModal);
document.querySelector("#room-modal").addEventListener("click", e=>{
  if (e.target === e.currentTarget) closeRoomModal();
});
document.querySelectorAll(".room-zone-btn").forEach(btn=>{
  btn.addEventListener("click", () => openRoomPopup(btn.dataset.zone));
});

function renderTables() {
  const colMap = {"hall-left":"hall-col-left","hall-center":"hall-col-center","hall-right":"hall-col-right"};
  Object.entries(colMap).forEach(([zoneId, colId])=>{
    const col = document.querySelector(`#${colId}`);
    if (!col) return;
    col.querySelectorAll(".table-card").forEach(el=>el.remove());
    state.tables.filter(t=>t.zone===zoneId).forEach(table=>{ col.appendChild(makeTableCard(table)); });
  });
  ["room-large","room-small-1","room-small-2"].forEach(zoneId=>{
    const meta = document.querySelector(`#meta-${zoneId}`);
    if (!meta) return;
    const tables   = state.tables.filter(t=>t.zone===zoneId);
    const occupied = tables.filter(t=>getSharedOrders(t.id).length>0).length;
    const total    = tables.reduce((s,t)=>s+calcTableTotal(t.id),0);
    const waiting  = tables.some(t=>getSharedOrders(t.id).some(o=>!o.served));
    meta.textContent = occupied ? `${occupied}/${tables.length}석 · ${fmt(total)}` : "비어있음";
    const btn = meta.closest(".room-zone-btn");
    if (btn) { btn.classList.toggle("room-occupied",occupied>0); btn.classList.toggle("room-waiting",waiting); }
  });
  // 방 팝업이 열려있으면 테이블 카드만 갱신 (모달 열림/닫힘은 건드리지 않음)
  if (openRoomZoneId) renderRoomModalTables(openRoomZoneId);
}

function renderOrders() {
  const orders    = getSharedOrders(state.activeTableId);
  const orderList = document.querySelector("#order-list");
  document.querySelector("#active-table-title").textContent = getDisplayName(state.activeTableId);
  document.querySelector("#order-count").textContent  = `${orders.length}건`;
  document.querySelector("#table-total").textContent  = fmt(calcTableTotal(state.activeTableId));
  orderList.innerHTML = "";
  const chkBtn = document.querySelector("#checkout-button");
  if (chkBtn) chkBtn.disabled = !orders.length;
  if (!orders.length) { orderList.innerHTML=`<li class="empty-state">아직 주문이 없습니다</li>`; return; }
  orders.forEach(order=>{
    const li = document.createElement("li");
    li.className = "order-item";
    li.innerHTML = `
      <div class="order-item__main">
        <div class="order-item__info">
          <strong class="order-item__name">${esc(order.name)}</strong>
          <div class="order-item__edit">
            <button class="qty-btn" data-delta="-1" data-id="${order.id}" type="button">−</button>
            <span class="qty-val">${order.qty}</span>
            <button class="qty-btn" data-delta="1" data-id="${order.id}" type="button">+</button>
          </div>
          <p class="order-item__meta">${fmt(order.price)} × ${order.qty} = ${fmt(order.price*order.qty)}</p>
          ${order.memo?`<p class="order-item__memo">📝 ${esc(order.memo)}</p>`:""}
        </div>
        <span class="status-badge ${order.served?"is-served":"is-waiting"}">${order.served?"서빙완료":"대기중"}</span>
      </div>
      <div class="order-item__actions">
        <button class="ghost-button order-toggle" type="button">${order.served?"대기로":"서빙완료"}</button>
        <button class="ghost-button order-memo" type="button" data-id="${order.id}">메모</button>
        <button class="ghost-button order-delete" type="button" data-id="${order.id}">삭제</button>
      </div>`;
    orderList.appendChild(li);
    li.querySelectorAll(".qty-btn").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const newQty = order.qty + Number(btn.dataset.delta);
        if (newQty < 1) return;
        order.qty = newQty;
        sendToSheet({action:"orderEdit",tableName:getDisplayName(state.activeTableId),order,timestamp:nowISO()});
        saveState(); render();
      });
    });
    li.querySelector(".order-toggle").addEventListener("click",()=>{ order.served=!order.served; saveState(); render(); });
    li.querySelector(".order-memo").addEventListener("click",()=>{
      const memo = prompt("메모 입력:", order.memo||"");
      if (memo===null) return;
      order.memo = memo.trim(); saveState(); render();
    });
    li.querySelector(".order-delete").addEventListener("click",()=>{
      sendToSheet({action:"orderDelete",tableName:getDisplayName(state.activeTableId),order,timestamp:nowISO()});
      const holder = getRepTable(state.activeTableId);
      holder.orders = holder.orders.filter(i=>i.id!==order.id);
      if (!holder.orders.length) holder.seatedAt = null;
      saveState(); render();
    });
  });
}

function renderSummary() {
  const seen = new Set(); let seats=0, total=0;
  state.tables.forEach(t=>{
    const key=t.mergeGroupId??t.id;
    if(seen.has(key))return; seen.add(key);
    const orders=getSharedOrders(t.id);
    if(orders.length)seats++;
    total+=calcTotal(orders);
  });
  document.querySelector("#open-table-count").textContent=`${seats}개 테이블 사용 중`;
  document.querySelector("#sales-total").textContent=`총 ${fmt(total)}`;
}

function renderMergeControls() {
  document.querySelector("#selected-table-count").textContent=`${state.selectedTableIds.length}개 선택`;
  document.querySelector("#table-selection-summary").textContent=
    state.selectedTableIds.map(id=>getTableById(id)?.name).filter(Boolean).join(", ")||"테이블을 선택하면 단체석으로 묶을 수 있습니다.";
  const ag=getGroupForTable(state.activeTableId);
  document.querySelector("#merge-status").textContent=ag
    ?`${ag.name} · ${ag.tableIds.map(id=>getTableById(id)?.name).filter(Boolean).join(", ")}`
    :"현재 선택한 테이블은 개별 사용 중입니다.";
  document.querySelector("#unmerge-button").disabled=!ag;
  document.querySelector("#merge-button").disabled=state.selectedTableIds.length<2;
}

function renderMaterials() {
  const list=document.querySelector("#material-list");
  if(!list)return;
  list.innerHTML="";
  if(!state.materials.length){list.innerHTML=`<li class="empty-state">입력된 원재료가 없습니다</li>`;return;}
  const totalCost=state.materials.reduce((s,m)=>s+(Number(m.price)||0),0);
  const summary=document.createElement("div");
  summary.className="material-summary";
  summary.innerHTML=`<span>총 원재료비</span><strong>${fmt(totalCost)}</strong>`;
  list.appendChild(summary);
  [...state.materials].reverse().forEach(mat=>{
    const li=document.createElement("li");
    li.className="order-item";
    const d=new Date(mat.date).toLocaleDateString("ko-KR",{month:"2-digit",day:"2-digit"});
    li.innerHTML=`<div class="order-item__main"><div><strong class="order-item__name">${esc(mat.name)}</strong><p class="order-item__meta">${d} · ${esc(mat.qty)}${esc(mat.unit||"")} · ${fmt(mat.price)}${mat.memo?" · "+esc(mat.memo):""}</p></div></div><div class="order-item__actions"><button class="ghost-button mat-delete" type="button" data-id="${mat.id}">삭제</button></div>`;
    list.appendChild(li);
  });
  list.querySelectorAll(".mat-delete").forEach(btn=>{
    btn.addEventListener("click",()=>{ state.materials=state.materials.filter(m=>m.id!==btn.dataset.id); saveState(); renderMaterials(); });
  });
}

function render() {
  renderTables(); renderOrders(); renderSummary(); renderMergeControls();
  renderMaterials(); renderKDS(); renderMenuManage();
}

function switchTab(tabName) {
  state.activeTab=tabName;
  document.querySelectorAll(".tab-button").forEach(b=>b.classList.toggle("is-active",b.dataset.tab===tabName));
  document.querySelectorAll(".tab-panel").forEach(p=>{p.hidden=p.id!==`tab-${tabName}`;});
}
document.querySelectorAll(".tab-button").forEach(btn=>{ btn.addEventListener("click",()=>switchTab(btn.dataset.tab)); });

function toggleSelection(tableId) {
  state.selectedTableIds=state.selectedTableIds.includes(tableId)
    ?state.selectedTableIds.filter(id=>id!==tableId):[...state.selectedTableIds,tableId];
  if(!state.selectedTableIds.length)state.selectedTableIds=[state.activeTableId];
  saveState(); render();
}
function mergeSelectedTables() {
  if(state.selectedTableIds.length<2)return;
  const cg=new Set(state.selectedTableIds.map(id=>getTableById(id)?.mergeGroupId).filter(Boolean));
  state.mergeGroups=state.mergeGroups.filter(g=>!cg.has(g.id));
  state.tables.forEach(t=>{if(cg.has(t.mergeGroupId))t.mergeGroupId=null;});
  const repId=state.selectedTableIds[0],repT=getTableById(repId);
  const combined=[];
  state.selectedTableIds.forEach((id,i)=>{const t=getTableById(id);if(!t)return;combined.push(...t.orders);if(i>0)t.orders=[];});
  repT.orders=combined;
  const groupId=crypto.randomUUID();
  state.mergeGroups.unshift({id:groupId,name:`단체석 ${state.selectedTableIds.map(getShortName).filter(Boolean).join("+")}`,tableIds:[...state.selectedTableIds]});
  state.selectedTableIds.forEach(id=>{const t=getTableById(id);if(t)t.mergeGroupId=groupId;});
  state.activeTableId=repId; state.selectedTableIds=[repId];
  saveState(); render();
}
function unmergeActiveTable() {
  const ag=getGroupForTable(state.activeTableId); if(!ag)return;
  ag.tableIds.forEach(id=>{const t=getTableById(id);if(t)t.mergeGroupId=null;});
  state.mergeGroups=state.mergeGroups.filter(g=>g.id!==ag.id);
  state.selectedTableIds=[state.activeTableId];
  saveState(); render();
}
document.querySelector("#merge-button").addEventListener("click",mergeSelectedTables);
document.querySelector("#unmerge-button").addEventListener("click",unmergeActiveTable);

function syncPriceWithMenu() {
  const sel=document.querySelector("#menu-select");
  const menu=state.menus.find(m=>m.name===sel?.value);
  const priceEl=document.querySelector("#menu-price");
  if(priceEl)priceEl.value=menu?menu.price:"";
}
document.querySelector("#menu-select")?.addEventListener("change",syncPriceWithMenu);

document.querySelector("#order-form").addEventListener("submit",e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  const name=String(fd.get("menuName")).trim(),price=Number(fd.get("menuPrice")),qty=Number(fd.get("menuQty")),memo=String(fd.get("menuMemo")||"").trim();
  if(!name||price<0||qty<1)return;
  const order={id:crypto.randomUUID(),name,price,qty,served:false,memo};
  const holder=getRepTable(state.activeTableId);
  if(!holder.seatedAt)holder.seatedAt=nowISO();
  holder.orders.unshift(order);
  sendToSheet({action:"orderAdd",tableName:getDisplayName(state.activeTableId),order,timestamp:nowISO()});
  e.target.reset();
  document.querySelector("#menu-qty").value=1;
  syncMenuSelects();
  saveState(); render();
});

const matDateInput=document.querySelector("#mat-date");
if(matDateInput)matDateInput.value=new Date().toISOString().slice(0,10);
document.querySelector("#material-form")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  const mat={id:crypto.randomUUID(),date:String(fd.get("matDate")),name:String(fd.get("matName")).trim(),qty:String(fd.get("matQty")),unit:String(fd.get("matUnit")||""),price:Number(fd.get("matPrice")),memo:String(fd.get("matMemo")||"")};
  if(!mat.name||mat.price<0)return;
  state.materials.push(mat);
  saveState(); renderMaterials();
  e.target.reset();
  if(matDateInput)matDateInput.value=new Date().toISOString().slice(0,10);
  sendToSheet({action:"materialAdd",...mat});
  setSyncStatus("원재료 기록 ✓","ok");
  setTimeout(()=>setSyncStatus("",""),3000);
});

document.querySelector("#checkout-button")?.addEventListener("click",checkoutActiveTable);

function startTimer() {
  if(timerInterval)clearInterval(timerInterval);
  timerInterval=setInterval(()=>{renderTables();},60000);
}

function updateAppMode() {
  const sa=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
  document.body.classList.toggle("tablet-app",sa);
  const el=document.querySelector("#app-mode");
  if(el)el.textContent=sa?"앱 모드":"브라우저";
}
function registerSW() {
  if(!("serviceWorker" in navigator)||location.protocol==="file:")return;
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

syncMenuSelects();
switchTab(state.activeTab);
updateAppMode();
registerSW();
startTimer();
render();
