// ============================================================
//  식당 테이블 주문 앱 — Google Sheets 풀 연동 버전
//  ▼ 아래 URL에 Apps Script 배포 주소를 넣으세요 ▼
// ============================================================
const SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwUMoWJowguvPOWrJCoSTPT0n28-LMRVsBA5_LRqm1Dk_zdBcvJRtVA6c7sfXcHmOwf4A/exec";
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const STORAGE_KEY = "restaurant-table-orders-v2";

const TABLE_DEFINITIONS = [
  { id: "hall-left-1",    name: "홀 좌측 1",    zone: "hall-left",    group: "홀 좌측" },
  { id: "hall-left-2",    name: "홀 좌측 2",    zone: "hall-left",    group: "홀 좌측" },
  { id: "hall-left-3",    name: "홀 좌측 3",    zone: "hall-left",    group: "홀 좌측" },
  { id: "hall-left-4",    name: "홀 좌측 4",    zone: "hall-left",    group: "홀 좌측" },
  { id: "hall-center-1",  name: "홀 가운데 1",  zone: "hall-center",  group: "홀 가운데" },
  { id: "hall-center-2",  name: "홀 가운데 2",  zone: "hall-center",  group: "홀 가운데" },
  { id: "hall-center-3",  name: "홀 가운데 3",  zone: "hall-center",  group: "홀 가운데" },
  { id: "hall-center-4",  name: "홀 가운데 4",  zone: "hall-center",  group: "홀 가운데" },
  { id: "hall-center-5",  name: "홀 가운데 5",  zone: "hall-center",  group: "홀 가운데" },
  { id: "hall-right-1",   name: "홀 우측 1",    zone: "hall-right",   group: "홀 우측" },
  { id: "hall-right-2",   name: "홀 우측 2",    zone: "hall-right",   group: "홀 우측" },
  { id: "hall-right-3",   name: "홀 우측 3",    zone: "hall-right",   group: "홀 우측" },
  { id: "hall-right-4",   name: "홀 우측 4",    zone: "hall-right",   group: "홀 우측" },
  { id: "hall-right-5",   name: "홀 우측 5",    zone: "hall-right",   group: "홀 우측" },
  { id: "room-large-1",   name: "큰방 1",       zone: "room-large",   group: "큰방" },
  { id: "room-large-2",   name: "큰방 2",       zone: "room-large",   group: "큰방" },
  { id: "room-large-3",   name: "큰방 3",       zone: "room-large",   group: "큰방" },
  { id: "room-small-1-1", name: "작은방 1-1",   zone: "room-small-1", group: "작은방 1" },
  { id: "room-small-1-2", name: "작은방 1-2",   zone: "room-small-1", group: "작은방 1" },
  { id: "room-small-2-1", name: "작은방 2-1",   zone: "room-small-2", group: "작은방 2" },
];

const ZONES = [
  { id: "hall-left",    label: "홀 좌측",   description: "4개 테이블" },
  { id: "hall-center",  label: "홀 가운데", description: "5개 테이블" },
  { id: "hall-right",   label: "홀 우측",   description: "5개 테이블" },
  { id: "room-large",   label: "큰방",      description: "3개 테이블" },
  { id: "room-small-1", label: "작은방 1",  description: "2개 테이블" },
  { id: "room-small-2", label: "작은방 2",  description: "1개 테이블" },
];

const MENU_ITEMS = [
  { name: "로스구이 한마리", price: 70000 },
  { name: "로스구이 반마리", price: 50000 },
  { name: "백숙 한마리",    price: 80000 },
  { name: "백숙 반마리",    price: 50000 },
  { name: "찹쌀밥",         price:  4000 },
  { name: "매밥",           price:  2000 },
  { name: "소주",           price:  5000 },
  { name: "맥주",           price:  5000 },
  { name: "음료",           price:  2000 },
];

// DOM refs
const zoneSections          = document.querySelector("#zone-sections");
const orderList             = document.querySelector("#order-list");
const orderForm             = document.querySelector("#order-form");
const activeTableTitle      = document.querySelector("#active-table-title");
const orderCount            = document.querySelector("#order-count");
const tableTotal            = document.querySelector("#table-total");
const openTableCount        = document.querySelector("#open-table-count");
const salesTotal            = document.querySelector("#sales-total");
const selectedTableCount    = document.querySelector("#selected-table-count");
const mergeButton           = document.querySelector("#merge-button");
const unmergeButton         = document.querySelector("#unmerge-button");
const mergeStatus           = document.querySelector("#merge-status");
const resetButton           = document.querySelector("#reset-button");
const checkoutButton        = document.querySelector("#checkout-button");
const tableCardTemplate     = document.querySelector("#table-card-template");
const orderItemTemplate     = document.querySelector("#order-item-template");
const menuSelect            = document.querySelector("#menu-select");
const menuPriceInput        = document.querySelector("#menu-price");
const tableSelectionSummary = document.querySelector("#table-selection-summary");
const appMode               = document.querySelector("#app-mode");
const syncStatus            = document.querySelector("#sync-status");
const tabButtons            = document.querySelectorAll(".tab-button");
const tabPanels             = document.querySelectorAll(".tab-panel");
const materialForm          = document.querySelector("#material-form");
const materialList          = document.querySelector("#material-list");

// State
const state = loadState();

function createDefaultState() {
  return {
    activeTableId:    TABLE_DEFINITIONS[0].id,
    selectedTableIds: [TABLE_DEFINITIONS[0].id],
    tables:      TABLE_DEFINITIONS.map(t => ({ ...t, orders: [], mergeGroupId: null })),
    mergeGroups: [],
    materials:   [],
  };
}

function loadState() {
  const fallback = createDefaultState();
  const saved    = localStorage.getItem(STORAGE_KEY);
  if (!saved) return fallback;
  try {
    const p = JSON.parse(saved);
    if (!p || !Array.isArray(p.tables)) return fallback;

    const tables = TABLE_DEFINITIONS.map(def => {
      const s = p.tables.find(t => t.id === def.id);
      return { ...def, orders: Array.isArray(s?.orders) ? s.orders : [], mergeGroupId: s?.mergeGroupId ?? null };
    });
    const mergeGroups = Array.isArray(p.mergeGroups)
      ? p.mergeGroups.filter(g => typeof g.id === "string" && Array.isArray(g.tableIds) && g.tableIds.length > 1) : [];
    const activeTableId = TABLE_DEFINITIONS.some(t => t.id === p.activeTableId) ? p.activeTableId : fallback.activeTableId;
    const selectedTableIds = (Array.isArray(p.selectedTableIds)
      ? p.selectedTableIds.filter(id => TABLE_DEFINITIONS.some(t => t.id === id)) : [activeTableId]);

    return {
      activeTableId,
      selectedTableIds: selectedTableIds.length ? selectedTableIds : [activeTableId],
      tables, mergeGroups,
      materials: Array.isArray(p.materials) ? p.materials : [],
    };
  } catch { return fallback; }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// Helpers
function formatCurrency(v) { return `${Number(v).toLocaleString("ko-KR")}원`; }
function formatDateShort(iso) { return new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }); }
function nowISO() { return new Date().toISOString(); }
function getTableById(id) { return state.tables.find(t => t.id === id); }
function getMergeGroupById(id) { return state.mergeGroups.find(g => g.id === id); }
function getGroupForTable(id) { const t = getTableById(id); return t?.mergeGroupId ? getMergeGroupById(t.mergeGroupId) : null; }
function getSharedTableIds(id) { const g = getGroupForTable(id); return g ? g.tableIds : [id]; }
function getSharedOrders(id) { const s = getTableById(getSharedTableIds(id)[0]); return s ? s.orders : []; }
function calcOrdersTotal(orders) { return orders.reduce((s, o) => s + o.price * o.qty, 0); }
function calcTableTotal(id) { return calcOrdersTotal(getSharedOrders(id)); }
function getDisplayName(id) { const t = getTableById(id), g = getGroupForTable(id); return g ? g.name : t?.name ?? ""; }
function getRepresentativeTable(id) { return getTableById(getSharedTableIds(id)[0]); }
function getShortTableName(id) {
  const t = getTableById(id); if (!t) return "";
  return t.name.replace("홀 좌측 ","좌").replace("홀 가운데 ","중").replace("홀 우측 ","우")
               .replace("작은방 1-","작은1-").replace("작은방 2-","작은2-");
}

// Sheets API
async function sendToSheet(payload) {
  if (!SHEET_WEBHOOK_URL) return;
  try {
    await fetch(SHEET_WEBHOOK_URL, { method:"POST", headers:{"Content-Type":"text/plain"}, body: JSON.stringify(payload) });
  } catch (_) {}
}

function setSyncStatus(text, type) {
  if (!syncStatus) return;
  syncStatus.textContent = text;
  syncStatus.className   = `sync-status${type ? " sync-status--"+type : ""}`;
  syncStatus.hidden      = !text;
}

// 결제 완료
async function checkoutActiveTable() {
  const orders = getSharedOrders(state.activeTableId);
  if (!orders.length) { alert("주문 내역이 없습니다."); return; }
  const tableName = getDisplayName(state.activeTableId);
  const total     = calcTableTotal(state.activeTableId);
  if (!confirm(`${tableName}\n합계: ${formatCurrency(total)}\n\n결제 완료 처리할까요?\n(주문 내역이 초기화됩니다)`)) return;

  setSyncStatus("전송 중…", "pending");
  if (SHEET_WEBHOOK_URL) {
    try {
      const res  = await fetch(SHEET_WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "checkout", tableName, orders, total, checkedOutAt: nowISO() }),
      });
      const data = await res.json();
      setSyncStatus(data.ok ? "시트 기록 완료 ✓" : `오류: ${data.error}`, data.ok ? "ok" : "error");
    } catch { setSyncStatus("네트워크 오류", "error"); }
  } else {
    setSyncStatus("URL 미설정 — 로컬만 저장", "warn");
  }
  getRepresentativeTable(state.activeTableId).orders = [];
  saveState(); render();
  setTimeout(() => setSyncStatus("", ""), 4000);
}

// Render — Tables
function renderTables() {
  zoneSections.innerHTML = "";
  ZONES.forEach(zone => {
    const section = document.createElement("section");
    section.className = "zone-block";
    section.innerHTML = `<div class="zone-header"><p class="section-label">${zone.label}</p><h3>${zone.description}</h3></div>`;
    const grid = document.createElement("div");
    grid.className = "tables-grid";
    state.tables.filter(t => t.zone === zone.id).forEach(table => {
      const frag     = tableCardTemplate.content.cloneNode(true);
      const btn      = frag.querySelector(".table-card");
      const selBtn   = frag.querySelector(".table-select");
      const shOrders = getSharedOrders(table.id);
      const waiting  = shOrders.filter(o => !o.served).length;
      const group    = getGroupForTable(table.id);
      frag.querySelector(".table-card__name").textContent  = table.name;
      frag.querySelector(".table-card__total").textContent = formatCurrency(calcTableTotal(table.id));
      frag.querySelector(".table-card__meta").textContent  =
        shOrders.length === 0 ? "주문 없음" : `총 ${shOrders.length}건 · 대기 ${waiting}건`;
      frag.querySelector(".table-card__merge").textContent = group ? `묶음: ${group.name}` : "개별 사용";
      if (table.id === state.activeTableId) btn.classList.add("is-active");
      if (state.selectedTableIds.includes(table.id)) { selBtn.classList.add("is-selected"); selBtn.textContent = "선택됨"; }
      btn.addEventListener("click", () => {
        state.activeTableId = table.id;
        if (!state.selectedTableIds.includes(table.id)) state.selectedTableIds = [table.id];
        saveState(); render();
      });
      selBtn.addEventListener("click", e => { e.stopPropagation(); toggleSelection(table.id); });
      grid.appendChild(frag);
    });
    section.appendChild(grid);
    zoneSections.appendChild(section);
  });
}

// Render — Orders
function renderOrders() {
  const orders = getSharedOrders(state.activeTableId);
  activeTableTitle.textContent = getDisplayName(state.activeTableId);
  orderCount.textContent       = `${orders.length}건`;
  tableTotal.textContent       = formatCurrency(calcTableTotal(state.activeTableId));
  orderList.innerHTML          = "";
  if (checkoutButton) checkoutButton.disabled = !orders.length;
  if (!orders.length) {
    const li = document.createElement("li"); li.className = "empty-state"; li.textContent = "아직 주문이 없습니다.";
    orderList.appendChild(li); return;
  }
  orders.forEach(order => {
    const frag   = orderItemTemplate.content.cloneNode(true);
    const badge  = frag.querySelector(".status-badge");
    const toggle = frag.querySelector(".order-toggle");
    const del    = frag.querySelector(".order-delete");
    frag.querySelector(".order-item__name").textContent = order.name;
    frag.querySelector(".order-item__meta").textContent =
      `${formatCurrency(order.price)} · ${order.qty}개 · ${formatCurrency(order.price * order.qty)}`;
    badge.textContent  = order.served ? "서빙완료" : "대기중";
    badge.className    = `status-badge ${order.served ? "is-served" : "is-waiting"}`;
    toggle.textContent = order.served ? "대기로 변경" : "서빙완료";
    toggle.addEventListener("click", () => { order.served = !order.served; saveState(); render(); });
    del.addEventListener("click", () => {
      sendToSheet({ action:"orderDelete", tableName: getDisplayName(state.activeTableId), order, timestamp: nowISO() });
      const holder = getRepresentativeTable(state.activeTableId);
      holder.orders = holder.orders.filter(i => i.id !== order.id);
      saveState(); render();
    });
    orderList.appendChild(frag);
  });
}

// Render — Summary
function renderSummary() {
  const seen = new Set(); let seats = 0, total = 0;
  state.tables.forEach(t => {
    const key = t.mergeGroupId ?? t.id;
    if (seen.has(key)) return; seen.add(key);
    const orders = getSharedOrders(t.id);
    if (orders.length) seats++;
    total += calcOrdersTotal(orders);
  });
  openTableCount.textContent = `${seats}개 좌석 그룹 사용 중`;
  salesTotal.textContent     = `총 주문 금액 ${formatCurrency(total)}`;
}

// Render — Merge controls
function renderMergeControls() {
  selectedTableCount.textContent = `${state.selectedTableIds.length}개 선택`;
  tableSelectionSummary.textContent =
    state.selectedTableIds.map(id => getTableById(id)?.name).filter(Boolean).join(", ")
    || "테이블을 선택하면 단체석으로 묶을 수 있습니다.";
  const ag = getGroupForTable(state.activeTableId);
  mergeStatus.textContent = ag
    ? `${ag.name} 사용 중 · ${ag.tableIds.map(id => getTableById(id)?.name).filter(Boolean).join(", ")}`
    : "현재 선택한 테이블은 개별 사용 중입니다.";
  unmergeButton.disabled = !ag;
  mergeButton.disabled   = state.selectedTableIds.length < 2;
}

// Render — Materials
function renderMaterials() {
  if (!materialList) return;
  materialList.innerHTML = "";
  if (!state.materials.length) {
    materialList.innerHTML = `<li class="empty-state">입력된 원재료가 없습니다.</li>`; return;
  }
  const totalCost = state.materials.reduce((s, m) => s + (Number(m.price)||0), 0);
  const summary   = document.createElement("div");
  summary.className = "material-summary";
  summary.innerHTML = `<span>총 원재료비</span><strong>${formatCurrency(totalCost)}</strong>`;
  materialList.appendChild(summary);
  [...state.materials].reverse().forEach(mat => {
    const li = document.createElement("li");
    li.className = "order-item";
    li.innerHTML = `
      <div class="order-item__main">
        <div>
          <strong class="order-item__name">${mat.name}</strong>
          <p class="order-item__meta">${formatDateShort(mat.date)} · ${mat.qty}${mat.unit||""} · ${formatCurrency(mat.price)}${mat.memo ? " · "+mat.memo : ""}</p>
        </div>
      </div>
      <div class="order-item__actions">
        <button class="ghost-button mat-delete" type="button" data-id="${mat.id}">삭제</button>
      </div>`;
    materialList.appendChild(li);
  });
  materialList.querySelectorAll(".mat-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      state.materials = state.materials.filter(m => m.id !== btn.dataset.id);
      saveState(); renderMaterials();
    });
  });
}

function render() { renderTables(); renderOrders(); renderSummary(); renderMergeControls(); renderMaterials(); }

// Merge / Unmerge
function toggleSelection(tableId) {
  state.selectedTableIds = state.selectedTableIds.includes(tableId)
    ? state.selectedTableIds.filter(id => id !== tableId) : [...state.selectedTableIds, tableId];
  if (!state.selectedTableIds.length) state.selectedTableIds = [state.activeTableId];
  saveState(); render();
}
function mergeSelectedTables() {
  if (state.selectedTableIds.length < 2) return;
  const cg = new Set(state.selectedTableIds.map(id => getTableById(id)?.mergeGroupId).filter(Boolean));
  state.mergeGroups = state.mergeGroups.filter(g => !cg.has(g.id));
  state.tables.forEach(t => { if (cg.has(t.mergeGroupId)) t.mergeGroupId = null; });
  const repId = state.selectedTableIds[0], repTable = getTableById(repId);
  const combined = [];
  state.selectedTableIds.forEach((id, i) => { const t = getTableById(id); if (!t) return; combined.push(...t.orders); if (i>0) t.orders=[]; });
  repTable.orders = combined;
  const groupId = crypto.randomUUID();
  state.mergeGroups.unshift({ id: groupId, name: `단체석 ${state.selectedTableIds.map(getShortTableName).filter(Boolean).join(" + ")}`, tableIds: [...state.selectedTableIds] });
  state.selectedTableIds.forEach(id => { const t = getTableById(id); if (t) t.mergeGroupId = groupId; });
  state.activeTableId = repId; state.selectedTableIds = [repId];
  saveState(); render();
}
function unmergeActiveTable() {
  const ag = getGroupForTable(state.activeTableId); if (!ag) return;
  ag.tableIds.forEach(id => { const t = getTableById(id); if (t) t.mergeGroupId = null; });
  state.mergeGroups = state.mergeGroups.filter(g => g.id !== ag.id);
  state.selectedTableIds = [state.activeTableId];
  saveState(); render();
}

// Tab switching
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("is-active"));
    tabPanels.forEach(p => p.hidden = true);
    btn.classList.add("is-active");
    document.querySelector(`#tab-${btn.dataset.tab}`).hidden = false;
  });
});

// Order form
function syncPriceWithMenu() {
  const f = MENU_ITEMS.find(i => i.name === menuSelect.value);
  menuPriceInput.value = f ? f.price : "";
}
orderForm.addEventListener("submit", e => {
  e.preventDefault();
  const fd = new FormData(orderForm);
  const name = String(fd.get("menuName")).trim(), price = Number(fd.get("menuPrice")), qty = Number(fd.get("menuQty"));
  if (!name || price < 0 || qty < 1) return;
  const order = { id: crypto.randomUUID(), name, price, qty, served: false };
  getRepresentativeTable(state.activeTableId).orders.unshift(order);
  sendToSheet({ action:"orderAdd", tableName: getDisplayName(state.activeTableId), order, timestamp: nowISO() });
  orderForm.reset();
  document.querySelector("#menu-qty").value = 1;
  syncPriceWithMenu(); saveState(); render();
});
menuSelect.addEventListener("change", syncPriceWithMenu);
document.querySelectorAll(".chip").forEach(btn => {
  btn.addEventListener("click", () => {
    menuSelect.value = btn.dataset.name; menuPriceInput.value = btn.dataset.price;
    document.querySelector("#menu-qty").focus();
  });
});

// Material form
if (materialForm) {
  const matDateInput = materialForm.querySelector("#mat-date");
  if (matDateInput) matDateInput.value = new Date().toISOString().slice(0,10);

  materialForm.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(materialForm);
    const mat = {
      id: crypto.randomUUID(),
      date:  String(fd.get("matDate")),
      name:  String(fd.get("matName")).trim(),
      qty:   String(fd.get("matQty")),
      unit:  String(fd.get("matUnit") || ""),
      price: Number(fd.get("matPrice")),
      memo:  String(fd.get("matMemo") || ""),
    };
    if (!mat.name || mat.price < 0) return;
    state.materials.push(mat);
    saveState(); renderMaterials();
    materialForm.reset();
    if (matDateInput) matDateInput.value = new Date().toISOString().slice(0,10);
    sendToSheet({ action:"materialAdd", ...mat });
    setSyncStatus("원재료 시트 기록 ✓", "ok");
    setTimeout(() => setSyncStatus("",""), 3000);
  });
}

// Checkout & Reset
if (checkoutButton) checkoutButton.addEventListener("click", checkoutActiveTable);
mergeButton.addEventListener("click", mergeSelectedTables);
unmergeButton.addEventListener("click", unmergeActiveTable);
resetButton.addEventListener("click", () => {
  const next = createDefaultState();
  Object.assign(state, { activeTableId: next.activeTableId, selectedTableIds: next.selectedTableIds, tables: next.tables, mergeGroups: next.mergeGroups });
  saveState(); render();
});

function updateAppMode() {
  const sa = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  document.body.classList.toggle("tablet-app", sa);
  appMode.textContent = sa ? "태블릿 앱 모드" : "브라우저 모드";
}
function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("./sw.js").catch(() => { appMode.textContent = "캐시 미등록"; });
}

syncPriceWithMenu();
updateAppMode();
registerServiceWorker();
render();
