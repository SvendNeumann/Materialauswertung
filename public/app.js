const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const pct = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 1 });
const sidebarStorageKey = "orisus-material-sidebar-collapsed";
const reloadViewStorageKey = "orisus-material-reload-view";
const supabaseUrl = "https://rxiboswudbunvjqgpnyc.supabase.co";
const supabaseKey = "sb_publishable__KobDxUjq-p0hIBzG62Fbw_OlGngnvY";
const invoiceBucket = "material-invoices";

const state = {
  view: "dashboard",
  role: "admin",
  location: "",
  query: "",
  supplierFilter: "Alle",
  locationFilter: "Alle",
  categoryFilter: "Alle",
  sampleImports: [],
  uploadStatus: "",
  dataLoaded: false,
  dataError: "",
  openNavSection: "overview",
  sidebarCollapsed: localStorage.getItem(sidebarStorageKey) === "true",
  mobileNavOpen: false,
};

const navSections = [
  {
    id: "overview",
    label: "Überblick",
    items: [
      ["dashboard", "Management"],
      ["mobile", "Standortleiter"],
    ],
  },
  {
    id: "masterdata",
    label: "Stammdaten",
    items: [
      ["products", "Artikelstamm"],
      ["suppliers", "Lieferanten"],
    ],
  },
  {
    id: "analytics",
    label: "Analysen",
    items: [
      ["prices", "Preisvergleich"],
      ["yearly", "Jahresvergleich"],
      ["locations", "Standorte"],
      ["basket", "Warenkorb"],
    ],
  },
  {
    id: "actions",
    label: "Steuerung",
    items: [
      ["recommendations", "Empfehlungen"],
      ["reports", "Reports"],
    ],
  },
  {
    id: "import",
    label: "Import & Prüfung",
    items: [
      ["invoices", "Rechnungen"],
      ["review", "Prüfcenter"],
    ],
  },
  {
    id: "admin",
    label: "Administration",
    items: [
      ["settings", "Einstellungen"],
    ],
  },
];

const navItems = navSections.flatMap(section => section.items);

let locations = [];
let suppliers = [];
let products = [];
let supplierPriceIndex = {};
let invoices = [];
let invoiceItems = [];
const historicalPriceFactors = {};
const historicalVolumes = {};

async function supabaseTable(table, query = "select=*") {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`${table}: ${response.status}`);
  }
  return response.json();
}

async function supabaseInsert(table, payload) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`${table}: ${response.status}`);
  }
  return response.json();
}

function storageObjectUrl(path) {
  return `${supabaseUrl}/storage/v1/object/${invoiceBucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function importRowFromDb(row) {
  return {
    file: row.file,
    document_type: row.document_type || "PDF",
    supplier: row.supplier || "offen",
    location_name: row.location_name || "",
    invoice_no: row.invoice_no || "",
    invoice_date: row.invoice_date || "",
    gross_total: row.gross_total == null ? null : Number(row.gross_total),
    extracted_items: row.extracted_items || 0,
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    sample_items: Array.isArray(row.sample_items) ? row.sample_items : [],
  };
}

async function loadSupabaseData() {
  const [locationRows, supplierRows, productRows, priceRows, invoiceRows, itemRows, importRows] = await Promise.all([
    supabaseTable("locations", "select=id,name,manager,address&order=name.asc"),
    supabaseTable("suppliers", "select=name,skonto,freight_free,terms,contact&order=name.asc"),
    supabaseTable("products", "select=id,name,category,unit,pack,standard,critical,approved&order=id.asc"),
    supabaseTable("supplier_prices", "select=supplier_name,product_id,price"),
    supabaseTable("invoices", "select=id,invoice_no,invoice_date,supplier_name,location_name,status,net,freight,surcharge,discount,skonto_used&order=invoice_date.desc"),
    supabaseTable("invoice_items", "select=invoice_id,product_id,qty,list_price,item_discount,supplier_item_name,match_score&order=id.asc"),
    supabaseTable("sample_imports", "select=file,document_type,supplier,location_name,invoice_no,invoice_date,gross_total,extracted_items,warnings,sample_items&order=created_at.desc"),
  ]);

  if (!locationRows.length && !supplierRows.length && !importRows.length) return false;

  locations = locationRows.map(row => ({
    id: row.id,
    name: row.name,
    manager: row.manager || "",
    address: row.address || "",
  }));
  suppliers = supplierRows.map(row => ({
    name: row.name,
    skonto: Number(row.skonto || 0),
    freightFree: Number(row.freight_free || 0),
    terms: row.terms || "",
    contact: row.contact || "",
  }));
  products = productRows.map(row => ({
    id: row.id,
    name: row.name,
    category: row.category || "",
    unit: row.unit || "",
    pack: Number(row.pack || 1),
    standard: Boolean(row.standard),
    critical: Boolean(row.critical),
    approved: Boolean(row.approved),
  }));
  invoices = invoiceRows.map(row => ({
    id: row.id,
    no: row.invoice_no,
    date: row.invoice_date,
    supplier: row.supplier_name,
    location: row.location_name,
    status: row.status,
    net: Number(row.net || 0),
    freight: Number(row.freight || 0),
    surcharge: Number(row.surcharge || 0),
    discount: Number(row.discount || 0),
    skontoUsed: Boolean(row.skonto_used),
  }));
  invoiceItems = itemRows.map(row => ({
    invoiceId: row.invoice_id,
    productId: row.product_id,
    qty: Number(row.qty || 0),
    listPrice: Number(row.list_price || 0),
    itemDiscount: Number(row.item_discount || 0),
    supplierName: row.supplier_item_name || "",
    match: Number(row.match_score || 0),
  }));
  supplierPriceIndex = suppliers.reduce((index, supplier) => {
    index[supplier.name] = products.map(product => {
      const row = priceRows.find(price => price.supplier_name === supplier.name && price.product_id === product.id);
      return row ? Number(row.price || 0) : 0;
    });
    return index;
  }, {});
  state.sampleImports = importRows.map(importRowFromDb);
  state.dataLoaded = true;
  state.dataError = "";
  return true;
}

async function uploadInvoiceFiles(fileList) {
  const files = Array.from(fileList || []).filter(file => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!files.length) {
    state.uploadStatus = "Bitte PDF-Dateien auswählen.";
    render();
    return;
  }
  const locationName = document.getElementById("uploadLocation")?.value || locations[0]?.name || "";
  const supplierName = document.getElementById("uploadSupplier")?.value || suppliers[0]?.name || "";
  state.uploadStatus = `${files.length} PDF${files.length === 1 ? "" : "s"} werden hochgeladen...`;
  render();

  try {
    for (const file of files) {
      const safeName = file.name.replace(/[^\w. -]+/g, "_");
      const uploadId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const path = `uploads/${new Date().toISOString().slice(0, 10)}/${uploadId}-${safeName}`;
      const uploadResponse = await fetch(storageObjectUrl(path), {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": file.type || "application/pdf",
          "x-upsert": "false",
        },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error(`${file.name}: Upload fehlgeschlagen (${uploadResponse.status})`);
      }
      const [created] = await supabaseInsert("sample_imports", {
        file: file.name,
        document_type: "PDF",
        supplier: supplierName,
        location_name: locationName,
        invoice_no: null,
        invoice_date: null,
        gross_total: null,
        extracted_items: 0,
        warnings: ["Hochgeladen, Auslesung ausstehend"],
        sample_items: [],
      });
      state.sampleImports = [importRowFromDb(created), ...state.sampleImports.filter(row => row.file !== file.name)];
    }
    state.uploadStatus = `${files.length} PDF${files.length === 1 ? "" : "s"} erfolgreich hochgeladen.`;
  } catch (error) {
    state.uploadStatus = error.message || "Upload fehlgeschlagen.";
  }
  render();
}

function invoiceTotalBeforeAdjustments(invoiceId) {
  return invoiceItems.filter(i => i.invoiceId === invoiceId).reduce((sum, i) => sum + i.qty * i.listPrice * (1 - i.itemDiscount), 0);
}

function calcItem(item) {
  const inv = invoices.find(i => i.id === item.invoiceId);
  const product = products.find(p => p.id === item.productId);
  if (!inv || !product) return null;
  const base = item.qty * item.listPrice;
  const afterItemDiscount = base * (1 - item.itemDiscount);
  const invoiceBase = invoiceTotalBeforeAdjustments(inv.id) || 1;
  const share = afterItemDiscount / invoiceBase;
  const invoiceDiscount = inv.discount * share;
  const skonto = inv.skontoUsed ? afterItemDiscount * (suppliers.find(s => s.name === inv.supplier)?.skonto || 0) : 0;
  const freight = inv.freight * share;
  const surcharge = inv.surcharge * share;
  const effectiveNet = afterItemDiscount - invoiceDiscount - skonto + freight + surcharge;
  const comparisonPrice = effectiveNet / (item.qty * product.pack);
  return { ...item, inv, product, base, effectiveNet, comparisonPrice, invoiceDiscount, skonto, freight, surcharge };
}

const calculatedItems = () => invoiceItems.map(calcItem).filter(Boolean);

function bestPrice(productId) {
  const prices = calculatedItems().filter(i => i.productId === productId).map(i => i.comparisonPrice);
  if (!prices.length) return 0;
  return Math.min(...prices);
}

function groupAverage(productId) {
  const prices = calculatedItems().filter(i => i.productId === productId).map(i => i.comparisonPrice);
  if (!prices.length) return 0;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

function locationScopeRows(rows) {
  return state.role === "location" ? rows.filter(row => (row.inv?.location || row.location || row.location_name) === activeLocationName()) : rows;
}

function activeLocationName() {
  return state.location || locations[0]?.name || "";
}

function scopeLabel() {
  return state.role === "location" ? activeLocationName() : "Alle Standorte";
}

function kpis() {
  const rows = locationScopeRows(calculatedItems());
  const importedRows = locationScopeRows(state.sampleImports);
  const scopedInvoices = state.role === "location" ? invoices.filter(i => i.location === activeLocationName()) : invoices;
  const importedGross = importedRows.reduce((sum, row) => sum + Number(row.gross_total || 0), 0);
  const volume = rows.reduce((sum, row) => sum + row.effectiveNet, 0);
  const potential = rows.reduce((sum, row) => sum + Math.max(0, row.comparisonPrice - bestPrice(row.productId)) * row.qty * row.product.pack, 0);
  const avgDeviation = rows.length ? rows.reduce((sum, row) => {
    const average = groupAverage(row.productId);
    return sum + (average ? row.comparisonPrice / average - 1 : 0);
  }, 0) / rows.length : 0;
  const netBase = scopedInvoices.reduce((s, i) => s + i.net, 0);
  return {
    invoices: scopedInvoices.length || importedRows.length,
    products: products.length,
    suppliers: suppliers.length,
    volume: volume || importedGross,
    monthly: potential,
    yearly: potential * 12,
    deviation: avgDeviation,
    skonto: scopedInvoices.length ? scopedInvoices.filter(i => i.skontoUsed).length / scopedInvoices.length : 0,
    freight: netBase ? scopedInvoices.reduce((s, i) => s + i.freight, 0) / netBase : 0,
    aCases: recommendations().filter(r => r.className === "A-Fall").length,
  };
}

function recommendations() {
  return calculatedItems().map(row => {
    const best = bestPrice(row.productId);
    const average = groupAverage(row.productId);
    const saving = Math.max(0, row.comparisonPrice - best) * row.qty * row.product.pack;
    const deviation = average ? row.comparisonPrice / average - 1 : 0;
    const className = saving > 20 && deviation > 0.04 ? "A-Fall" : saving > 8 ? "B-Fall" : "C-Fall";
    const recommendedSupplier = cheapestSupplier(row.productId);
    const recommendedLabel = recommendedSupplier === row.inv.supplier ? `${recommendedSupplier} Rahmenpreis` : recommendedSupplier;
    return { ...row, best, saving, deviation, className, recommendedSupplier, recommendedLabel };
  }).filter(r => r.saving > 1).sort((a, b) => b.saving - a.saving);
}

function cheapestSupplier(productId) {
  const productIndex = products.findIndex(p => p.id === productId);
  const ranked = Object.entries(supplierPriceIndex)
    .map(([supplier, prices]) => [supplier, Number(prices?.[productIndex] || 0)])
    .filter(([, price]) => price > 0)
    .sort((a, b) => a[1] - b[1]);
  return ranked[0]?.[0] || "offen";
}

function supplierStats() {
  return suppliers.map(supplier => {
    const supplierInvoices = invoices.filter(i => i.supplier === supplier.name);
    const rows = calculatedItems().filter(i => i.inv.supplier === supplier.name);
    const volume = rows.reduce((sum, row) => sum + row.effectiveNet, 0);
    const potential = recommendations().filter(r => r.inv.supplier === supplier.name).reduce((sum, r) => sum + r.saving, 0);
    const freight = supplierInvoices.reduce((sum, i) => sum + i.freight, 0);
    return {
      ...supplier,
      volume,
      articleCount: new Set(rows.map(r => r.productId)).size,
      deviation: rows.length ? rows.reduce((s, r) => {
        const average = groupAverage(r.productId);
        return s + (average ? r.comparisonPrice / average - 1 : 0);
      }, 0) / rows.length : 0,
      discountRate: supplierInvoices.reduce((s, i) => s + i.discount, 0) / Math.max(1, supplierInvoices.reduce((s, i) => s + i.net, 0)),
      freightRate: freight / Math.max(1, supplierInvoices.reduce((s, i) => s + i.net, 0)),
      potential,
      stability: Math.max(0, 82 - potential / 8),
    };
  });
}

function locationStats() {
  return locations.map(location => {
    const locInvoices = invoices.filter(i => i.location === location.name);
    const rows = calculatedItems().filter(i => i.inv.location === location.name);
    const volume = rows.reduce((sum, row) => sum + row.effectiveNet, 0);
    return {
      ...location,
      volume,
      supplierMix: new Set(locInvoices.map(i => i.supplier)).size,
      avgOrder: locInvoices.reduce((s, i) => s + i.net, 0) / Math.max(1, locInvoices.length),
      smallOrders: locInvoices.filter(i => i.net < 650).length,
      freightRate: locInvoices.reduce((s, i) => s + i.freight + i.surcharge, 0) / Math.max(1, locInvoices.reduce((s, i) => s + i.net, 0)),
      skonto: locInvoices.filter(i => i.skontoUsed).length / Math.max(1, locInvoices.length),
      potential: recommendations().filter(r => r.inv.location === location.name).reduce((sum, r) => sum + r.saving, 0),
    };
  });
}

function yearlyPriceRows() {
  return products.filter(product => historicalPriceFactors[product.id] && historicalVolumes[product.id]).map(product => {
    const current = groupAverage(product.id);
    const factors = historicalPriceFactors[product.id];
    if (!current) return null;
    const price2024 = current * factors[2024];
    const price2025 = current * factors[2025];
    const price2026 = current * factors[2026];
    const volume2026 = historicalVolumes[product.id][2026];
    const yoy = price2026 / price2025 - 1;
    const since2024 = price2026 / price2024 - 1;
    const annualImpact = Math.max(0, price2026 - price2025) * volume2026;
    const status = annualImpact > 900 || yoy > 0.09 ? "A-Fall" : annualImpact > 350 || yoy > 0.055 ? "B-Fall" : "C-Fall";
    const mainSupplier = cheapestSupplier(product.id);
    return { product, price2024, price2025, price2026, yoy, since2024, volume2026, annualImpact, status, mainSupplier };
  }).filter(Boolean).sort((a, b) => b.annualImpact - a.annualImpact);
}

function yearlySummary() {
  const rows = yearlyPriceRows();
  const weighted2025 = rows.reduce((sum, row) => sum + row.price2025 * row.volume2026, 0);
  const weighted2026 = rows.reduce((sum, row) => sum + row.price2026 * row.volume2026, 0);
  const annualImpact = rows.reduce((sum, row) => sum + row.annualImpact, 0);
  return {
    avgIncrease: weighted2025 ? weighted2026 / weighted2025 - 1 : 0,
    annualImpact,
    aCases: rows.filter(row => row.status === "A-Fall").length,
    strongest: rows[0],
  };
}

function invoiceYears() {
  const years = new Set(invoices.map(invoice => invoice.date.slice(0, 4)));
  state.sampleImports.forEach(invoice => {
    if (invoice.invoice_date) years.add(invoice.invoice_date.slice(-4));
  });
  return Array.from(years).sort();
}

function basketComparison(locationName = state.role === "location" ? activeLocationName() : null) {
  const rows = calculatedItems().filter(i => !locationName || i.inv.location === locationName);
  if (!rows.length) return [];
  return suppliers.map(supplier => {
    let missing = 0;
    const productCost = rows.reduce((sum, row) => {
      const productIndex = products.findIndex(p => p.id === row.productId);
      const supplierPrice = supplierPriceIndex[supplier.name]?.[productIndex] || 0;
      if (!supplierPrice) missing += 1;
      return sum + (supplierPrice || row.listPrice) * row.qty * (1 - row.itemDiscount);
    }, 0);
    const freight = productCost >= supplier.freightFree ? 0 : 24;
    const skonto = productCost * supplier.skonto;
    return { supplier: supplier.name, productCost, freight, skonto, total: productCost + freight - skonto, missing };
  }).sort((a, b) => a.total - b.total);
}

function render() {
  syncShellState();
  renderNav();
  renderBottomNav();
  document.getElementById("viewTitle").textContent = titleFor(state.view);
  document.getElementById("viewEyebrow").textContent = state.role === "location" ? `Standort ${activeLocationName()}` : "Materialpreis-Controlling";
  const view = document.getElementById("view");
  if (!state.dataLoaded) {
    view.innerHTML = `<section class="panel"><h2>Daten werden geladen</h2><p class="muted">Die App verbindet sich mit Supabase und lädt die freigegebenen Rechnungs- und Stammdaten.</p></section>`;
    return;
  }
  if (state.dataError) {
    view.innerHTML = `<section class="panel"><h2>Datenverbindung prüfen</h2><p class="muted">${state.dataError}</p></section>`;
    return;
  }
  view.innerHTML = routes[state.view]();
  bindViewEvents();
}

function renderNav() {
  const nav = document.getElementById("nav");
  if (!state.openNavSection) {
    state.openNavSection = sectionForView(state.view)?.id || "overview";
  }
  nav.innerHTML = navSections.map(section => {
    const open = state.openNavSection === section.id;
    const active = section.items.some(([id]) => id === state.view);
    return `
      <section class="nav-section ${open ? "open" : ""} ${active ? "active" : ""}">
        <button class="nav-section-trigger" data-section="${section.id}" title="${section.label}" aria-expanded="${open}">
          <span class="nav-label">${section.label}</span>
          <span class="nav-chevron">⌄</span>
        </button>
        <div class="nav-subitems">
          ${section.items.map(([id, label]) => `<button class="nav-subitem ${state.view === id ? "active" : ""}" data-view="${id}" title="${label}"><span class="nav-label">${label}</span></button>`).join("")}
        </div>
      </section>
    `;
  }).join("");
  nav.querySelectorAll("[data-section]").forEach(btn => btn.addEventListener("click", () => {
    const nextSection = btn.dataset.section;
    state.openNavSection = state.openNavSection === nextSection ? "" : nextSection;
    render();
  }));
  nav.querySelectorAll("[data-view]").forEach(btn => btn.addEventListener("click", () => {
    goToView(btn.dataset.view);
  }));
}

function renderBottomNav() {
  const bottomNav = document.getElementById("bottomNav");
  const bottomItems = navItems.filter(([id]) => ["dashboard", "invoices", "yearly", "recommendations", "mobile"].includes(id));
  bottomNav.innerHTML = bottomItems.map(([id, label]) => `<button class="${state.view === id ? "active" : ""}" data-view="${id}" title="${label}"><span>${shortNavLabel(label)}</span></button>`).join("");
  bottomNav.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
    goToView(btn.dataset.view);
  }));
}

function sectionForView(viewId) {
  return navSections.find(section => section.items.some(([id]) => id === viewId));
}

function goToView(viewId) {
  state.view = viewId;
  const nextSection = sectionForView(viewId);
  state.openNavSection = nextSection?.id || state.openNavSection;
  closeMobileNav();
  render();
}

function reloadCurrentView() {
  sessionStorage.setItem(reloadViewStorageKey, state.view);
  window.location.reload();
}

function shortNavLabel(label) {
  return ({
    "Dashboard": "Home",
    "Rechnungen": "Import",
    "Preisvergleich": "Preise",
    "Jahresvergleich": "Trend",
    "Empfehlungen": "Tipps",
    "Standortleiter": "Mobil",
  })[label] || label;
}

function syncShellState() {
  document.body.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  document.body.classList.toggle("mobile-nav-open", state.mobileNavOpen);
  const overlay = document.getElementById("sidebarOverlay");
  if (overlay) overlay.hidden = !state.mobileNavOpen;
  const sidebarToggle = document.getElementById("sidebarToggle");
  if (sidebarToggle) {
    sidebarToggle.setAttribute("aria-label", state.sidebarCollapsed ? "Menü ausklappen" : "Menü einklappen");
    sidebarToggle.setAttribute("title", state.sidebarCollapsed ? "Menü ausklappen" : "Menü einklappen");
  }
}

function toggleSidebar() {
  if (window.matchMedia("(max-width: 860px)").matches) {
    state.mobileNavOpen = !state.mobileNavOpen;
  } else {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    localStorage.setItem(sidebarStorageKey, String(state.sidebarCollapsed));
  }
  syncShellState();
}

function openMobileNav() {
  state.mobileNavOpen = true;
  syncShellState();
}

function closeMobileNav() {
  state.mobileNavOpen = false;
  syncShellState();
}

function titleFor(id) {
  return ({
    dashboard: "Management-Dashboard",
    invoices: "Rechnungen & Upload",
    review: "KI-Auslesung & Prüfcenter",
    products: "Artikelstamm & Matching",
    suppliers: "Lieferantenbewertung",
    prices: "Artikelpreisvergleich",
    yearly: "Jahresvergleich & Preissteigerungen",
    locations: "Standortanalyse",
    basket: "Warenkorbanalyse",
    recommendations: "Einkaufsempfehlungen",
    reports: "Report-Center",
    settings: "Zugänge & Rechte",
    mobile: "Mobile Standortleiter-Ansicht",
  })[id];
}

function metric(label, value, sub = "") {
  return `<article class="panel metric modern-kpi-card"><span class="modern-icon-tile">${metricIcon(label)}</span><label>${label}</label><strong>${value}</strong><small>${sub}</small></article>`;
}

function metricIcon(label) {
  if (label.includes("Rechnung")) return "▤";
  if (label.includes("Volumen")) return "€";
  if (label.includes("Potenzial")) return "↗";
  if (label.includes("A-Fälle")) return "!";
  if (label.includes("Artikel")) return "□";
  if (label.includes("Lieferanten")) return "◇";
  if (label.includes("Abweichung")) return "%";
  return "✓";
}

function dashboard() {
  const data = kpis();
  return `
    <div class="grid cols-4">
      ${metric("Analysierte Rechnungen", data.invoices, "inkl. Statusworkflow")}
      ${metric("Gesamtvolumen", eur.format(data.volume), "effektiv netto im Zeitraum")}
      ${metric("Potenzial / Monat", eur.format(data.monthly), `${eur.format(data.yearly)} pro Jahr`)}
      ${metric("A-Fälle", data.aCases, "sofort priorisieren")}
      ${metric("Aktive Artikel", data.products, "Gruppenartikel")}
      ${metric("Aktive Lieferanten", data.suppliers, "mit Konditionen")}
      ${metric("Ø Abweichung", pct.format(data.deviation), "vs. Gruppendurchschnitt")}
      ${metric("Skontonutzung", pct.format(data.skonto), `Versandquote ${pct.format(data.freight)}`)}
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <section class="panel"><h2>Einsparpotenzial je Standort</h2>${barChart(locationStats(), "name", "potential", 150)}</section>
      <section class="panel"><h2>Einkaufsvolumen je Lieferant</h2>${barChart(supplierStats(), "name", "volume", 1300)}</section>
      <section class="panel"><h2>Top-Artikel mit Potenzial</h2>${recommendationTable(recommendations().slice(0, 5))}</section>
      <section class="panel"><h2>Warnungen</h2>${warnings()}</section>
    </div>`;
}

function invoicesView() {
  return `
    <div class="grid cols-2">
      <section class="panel">
        <h2>Rechnungsupload Zentrale</h2>
        <div class="dropzone" id="dropzone">
          <div>
            <strong>PDFs hier ablegen</strong>
            <span class="muted">Dateien werden in Supabase gespeichert und dem Import zugeordnet.</span>
            <button class="btn primary" id="chooseInvoiceFiles" type="button">PDF auswählen</button>
            <input id="invoiceFileInput" type="file" accept="application/pdf,.pdf" multiple hidden>
          </div>
        </div>
        ${state.uploadStatus ? `<p class="upload-status">${state.uploadStatus}</p>` : ""}
        <div class="form-grid" style="margin-top:14px">
          <label>Standort<select id="uploadLocation">${locations.map(l => `<option>${l.name}</option>`)}</select></label>
          <label>Lieferant<select id="uploadSupplier">${suppliers.map(s => `<option>${s.name}</option>`)}</select></label>
        </div>
      </section>
      <section class="panel"><h2>Statusworkflow</h2><div class="workflow">${["Neu", "Ausgelesen", "In Prüfung", "Freigegeben", "Fehlerhaft", "Dublette"].map((s, i) => `<span class="${i < 4 ? "active" : ""}">${s}</span>`).join("")}</div></section>
    </div>
    <section class="panel" style="margin-top:16px">
      <div class="toolbar">
        <h2>Importierte PDFs</h2>
        <span class="tag blue">${state.sampleImports.length || 0} PDFs im Import</span>
      </div>
      ${sampleImportTable(state.sampleImports)}
    </section>
    <section class="panel" style="margin-top:16px"><div class="toolbar"><h2>Rechnungsliste</h2>${filters()}</div>${invoiceTable(invoices)}</section>`;
}

function reviewView() {
  const inv = invoices[2];
  if (!inv) {
    return `<section class="panel"><h2>Prüfcenter</h2><p class="muted">Noch keine vollständig ausgelesene Rechnung mit Positionsdaten vorhanden. Die importierten PDFs liegen im Rechnungsupload bereit.</p></section>`;
  }
  const rows = calculatedItems().filter(i => i.invoiceId === inv.id);
  return `
    <div class="split">
      <section class="pdf-preview" aria-label="PDF-Vorschau">
        <h3>${inv.supplier}</h3><p class="muted">Rechnung ${inv.no} · ${inv.date}</p>
        ${Array.from({ length: 22 }, (_, i) => `<div class="pdf-line ${i % 5 === 0 ? "short" : i % 3 === 0 ? "mid" : ""}"></div>`).join("")}
      </section>
      <section class="panel">
        <h2>Strukturierte Auslesung</h2>
        <div class="form-grid">
          <label>Lieferant<input value="${inv.supplier}"></label>
          <label>Standort<input value="${inv.location}"></label>
          <label>Rechnungsnummer<input value="${inv.no}"></label>
          <label>Skonto<input value="${inv.skontoUsed ? "genutzt" : "nicht genutzt"}"></label>
          <label>Versandkosten<input value="${eur.format(inv.freight)}"></label>
          <label>Mindermengenzuschlag<input value="${eur.format(inv.surcharge)}"></label>
        </div>
        <h2 style="margin-top:18px">Erkannte Positionen</h2>
        ${itemsTable(rows)}
        <div class="toolbar" style="margin-top:14px"><button class="btn">Position hinzufügen</button><button class="btn primary">Rechnung freigeben</button></div>
      </section>
    </div>`;
}

function productsView() {
  return `<section class="panel"><div class="toolbar"><h2>Artikel-Matching</h2>${filters()}</div>${productTable(products)}</section>`;
}

function suppliersView() {
  return `<section class="panel"><h2>Lieferantenvergleich</h2>${supplierTable(supplierStats())}</section>`;
}

function pricesView() {
  return `<section class="panel"><div class="toolbar"><h2>Artikelpreisvergleich</h2>${filters()}</div>${priceTable(locationScopeRows(calculatedItems()))}</section>`;
}

function yearlyView() {
  const rows = yearlyPriceRows();
  const summary = yearlySummary();
  const years = invoiceYears();
  return `
    <div class="grid cols-4">
      ${metric("Ø Preissteigerung", pct.format(summary.avgIncrease), "gewichtet mit 2026-Mengen")}
      ${metric("Jahreseffekt", eur.format(summary.annualImpact), "Mehrkosten vs. Vorjahr")}
      ${metric("A-Fälle Preis", summary.aCases, "sofort verhandeln")}
      ${metric("Importjahre", years.join(", "), "aus Rechnungsdaten erkannt")}
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <section class="panel">
        <h2>Preissteigerung nach Artikel</h2>
        ${barChart(rows.slice(0, 6).map(row => ({ name: row.product.name, potential: row.annualImpact })), "name", "potential", 1200)}
      </section>
      <section class="panel">
        <h2>Jahresentwicklung Top-Artikel</h2>
        ${yearTrendBox(summary.strongest)}
      </section>
    </div>
    <section class="panel" style="margin-top:16px">
      <div class="toolbar">
        <h2>Mehrjahresvergleich je Gruppenartikel</h2>
        <span class="tag blue">aus Rechnungs- und Preisverlauf</span>
      </div>
      ${yearlyTable(rows)}
    </section>
  `;
}

function locationsView() {
  return `<div class="grid cols-2"><section class="panel"><h2>Standort-Benchmark</h2>${locationTable(locationStats())}</section><section class="panel"><h2>Preisabweichung je Standort</h2>${barChart(locationStats(), "name", "potential", 160)}</section></div>`;
}

function basketView() {
  const locationName = state.role === "location" ? activeLocationName() : null;
  const sim = basketComparison(locationName);
  if (!sim.length) {
    return `<section class="panel"><h2>Warenkorb ${scopeLabel()}</h2><p class="muted">Noch keine freigegebenen Artikelpositionen vorhanden. Sobald Rechnungen vollständig ausgelesen sind, erscheint hier der Lieferantenvergleich.</p></section>`;
  }
  return `<div class="grid cols-2"><section class="panel"><h2>Warenkorb ${scopeLabel()}</h2><p class="muted">Vergleich des aktuellen Artikelkorbs über die verfügbaren Lieferanten.</p>${basketTable(sim)}</section><section class="panel"><h2>Realistische Empfehlung</h2><div class="calc-box">${sim.map((s, i) => `<div class="calc-row ${i === 0 ? "total" : ""}"><span>${s.supplier}${i === 0 ? " · bevorzugt" : ""}</span><strong>${eur.format(s.total)}</strong></div>`).join("")}</div><p class="muted">Fehlende Artikel, Mindestbestellwerte, Skonto und Versandkosten werden im Vergleich berücksichtigt.</p></section></div>`;
}

function recommendationsView() {
  return `<section class="panel"><div class="toolbar"><h2>Priorisierte Empfehlungen</h2>${filters()}</div>${recommendationTable(locationScopeRows(recommendations()))}</section>`;
}

function reportsView() {
  const reports = [
    ["Lieferantenreport", "Verhandlungsliste, Rahmenpreis-Vorschlag, Top-Abweichungen"],
    ["Artikel-Abweichungsreport", "Standorte, Lieferanten, Preisentwicklung, Potenzial"],
    ["Standort-Benchmark-Report", "Lieferantenmix, Bestellverhalten, Maßnahmenliste"],
    ["Warenkorb-Report", "Artikelkorb, fehlende Artikel, realistisches Umstellungspotenzial"],
    ["Management-Dashboard-Report", "Top 10 Potenziale, Ranking, Preissteigerungen"],
  ];
  return `<div class="grid cols-3">${reports.map(r => `<article class="panel"><h2>${r[0]}</h2><p class="muted">${r[1]}</p><button class="btn primary export-action">PDF vorbereiten</button> <button class="btn export-action">Excel</button></article>`).join("")}</div>`;
}

function settingsView() {
  return `<section class="panel"><h2>Zugänge & Rechte</h2>${roleTable()}</section>`;
}

function mobileView() {
  const rows = locationScopeRows(recommendations()).slice(0, 6);
  return `<div class="grid"><section class="panel"><h2>${scopeLabel()}: Maßnahmen</h2><p class="muted">Mobile, reduzierte Standortleiter-Sicht ohne fremde Rechnungsdetails.</p></section>${rows.map(r => `<article class="mobile-card"><strong>${r.product.name}</strong><div class="price-row"><span>Standort: ${r.inv.location}</span><strong>${r.inv.supplier}</strong></div><div class="price-row"><span>Aktuell</span><strong>${eur.format(r.comparisonPrice)} / ${r.product.unit}</strong></div><div class="price-row"><span>Empfohlen: ${r.recommendedLabel}</span><strong>${eur.format(r.best)} / ${r.product.unit}</strong></div><span class="tag ${r.className === "A-Fall" ? "red" : "amber"}">${r.className} · ${eur.format(r.saving * 12)} jährlich</span><div><button class="btn primary small">Übernehmen</button> <button class="btn small">Ignorieren</button> <button class="btn small">Begründen</button></div></article>`).join("")}</div>`;
}

const routes = { dashboard, invoices: invoicesView, review: reviewView, products: productsView, suppliers: suppliersView, prices: pricesView, yearly: yearlyView, locations: locationsView, basket: basketView, recommendations: recommendationsView, reports: reportsView, settings: settingsView, mobile: mobileView };

function filters() {
  return `<div class="filters"><input id="search" placeholder="Suchen" value="${state.query}"><select id="locationFilter"><option>Alle</option>${locations.map(l => `<option ${state.locationFilter === l.name ? "selected" : ""}>${l.name}</option>`)}</select><select id="supplierFilter"><option>Alle</option>${suppliers.map(s => `<option ${state.supplierFilter === s.name ? "selected" : ""}>${s.name}</option>`)}</select></div>`;
}

function filtered(rows) {
  const query = state.query.toLowerCase();
  return rows.filter(row => {
    const text = JSON.stringify(row).toLowerCase();
    const location = row.inv?.location || row.location;
    const supplier = row.inv?.supplier || row.supplier;
    return (!query || text.includes(query)) && (state.locationFilter === "Alle" || location === state.locationFilter) && (state.supplierFilter === "Alle" || supplier === state.supplierFilter);
  });
}

function invoiceTable(rows) {
  return table(["Status", "Rechnung", "Datum", "Standort", "Lieferant", "Netto", "Prüfung"], filtered(rows).map(i => [
    status(i.status), i.no, i.date, i.location, i.supplier, eur.format(i.net), duplicateCheck(i)
  ]));
}

function sampleImportTable(rows) {
  if (!rows.length) {
    return `<p class="muted">Noch keine PDFs importiert.</p>`;
  }
  const normalizedRows = rows.map(row => ({
    ...row,
    location_name: row.location_name === "Huettenberg" ? "Hüttenberg" : row.location_name,
  }));
  return table(["Datei", "Typ", "Lieferant", "Standort", "Rechnung", "Datum", "Brutto", "Positionen", "Status"], normalizedRows.map(row => [
    row.file,
    row.document_type,
    row.supplier,
    row.location_name || "offen",
    row.invoice_no || "offen",
    row.invoice_date || "offen",
    row.gross_total == null ? "offen" : eur.format(row.gross_total),
    row.extracted_items || "offen",
    row.warnings?.length ? `<span class="tag amber">${row.warnings.length} Hinweis</span>` : `<span class="tag green">ausgelesen</span>`,
  ]));
}

function itemsTable(rows) {
  return table(["Lieferantenartikel", "Gruppenartikel", "Menge", "Match", "Auffälligkeit"], rows.map(r => [
    r.supplierName, r.product.name, r.qty, matchTag(r.match), r.match < 0.8 ? status("In Prüfung") : status("Freigegeben")
  ]));
}

function productTable(rows) {
  return table(["ID", "Gruppenartikel", "Kategorie", "Packung", "Einheit", "Status", "Mapping"], rows.map(p => [
    p.id, p.name, p.category, p.pack, p.unit, p.approved ? status("Freigegeben") : status("In Prüfung"), p.standard ? "Standardartikel" : "Alternative prüfen"
  ]));
}

function priceTable(rows) {
  return table(["Artikel", "Standort", "Lieferant", "Effektiv", "Bestpreis", "Ø Gruppe", "Abweichung", "Potenzial"], filtered(rows).map(r => [
    r.product.name, r.inv.location, r.inv.supplier, eur.format(r.comparisonPrice), eur.format(bestPrice(r.productId)), eur.format(groupAverage(r.productId)), pct.format(groupAverage(r.productId) ? r.comparisonPrice / groupAverage(r.productId) - 1 : 0), eur.format(Math.max(0, r.comparisonPrice - bestPrice(r.productId)) * r.qty * r.product.pack)
  ]));
}

function yearlyTable(rows) {
  return table(["Priorität", "Gruppenartikel", "Hauptlieferant", "2024", "2025", "2026", "ggü. Vorjahr", "seit 2024", "Menge 2026", "Jahreseffekt"], rows.map(row => [
    `<span class="tag ${row.status === "A-Fall" ? "red" : row.status === "B-Fall" ? "amber" : "blue"}">${row.status}</span>`,
    row.product.name,
    row.mainSupplier,
    eur.format(row.price2024),
    eur.format(row.price2025),
    eur.format(row.price2026),
    pct.format(row.yoy),
    pct.format(row.since2024),
    row.volume2026.toLocaleString("de-DE"),
    eur.format(row.annualImpact),
  ]));
}

function yearTrendBox(row) {
  if (!row) return `<p class="muted">Noch keine Jahresdaten vorhanden.</p>`;
  const max = Math.max(row.price2024, row.price2025, row.price2026);
  const points = [
    ["2024", row.price2024],
    ["2025", row.price2025],
    ["2026", row.price2026],
  ];
  return `
    <h3>${row.product.name}</h3>
    <p class="muted">Stärkster Jahreskosteneffekt: ${eur.format(row.annualImpact)} bei ${row.volume2026.toLocaleString("de-DE")} Vergleichseinheiten.</p>
    <div class="chart-bars">
      ${points.map(([year, value]) => `<div class="bar-row"><strong>${year}</strong><div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, value / max * 100)}%"></div></div><span class="num">${eur.format(value)}</span></div>`).join("")}
    </div>
    <p><span class="tag ${row.status === "A-Fall" ? "red" : "amber"}">${row.status}</span> <span class="muted">Preissteigerung seit 2024: ${pct.format(row.since2024)}</span></p>
  `;
}

function recommendationTable(rows) {
  return table(["Priorität", "Artikel", "Standort", "Aktuell", "Empfohlen", "Abweichung", "Ersparnis/Jahr", "Aktion"], filtered(rows).map(r => [
    `<span class="tag ${r.className === "A-Fall" ? "red" : r.className === "B-Fall" ? "amber" : "blue"}">${r.className}</span>`, r.product.name, r.inv.location, r.inv.supplier, r.recommendedLabel, pct.format(r.deviation), eur.format(r.saving * 12), `<button class="btn small">Übernehmen</button>`
  ]));
}

function supplierTable(rows) {
  return table(["Lieferant", "Volumen", "Artikel", "Ø Abweichung", "Rabattquote", "Versandquote", "Stabilität", "Potenzial"], rows.map(s => [
    s.name, eur.format(s.volume), s.articleCount, pct.format(s.deviation), pct.format(s.discountRate), pct.format(s.freightRate), `${Math.round(s.stability)} / 100`, eur.format(s.potential * 12)
  ]));
}

function locationTable(rows) {
  return table(["Standort", "Volumen", "Lieferanten", "Ø Bestellwert", "Kleinstbestellungen", "Skonto", "Versandquote", "Potenzial/Jahr"], rows.map(l => [
    l.name, eur.format(l.volume), l.supplierMix, eur.format(l.avgOrder), l.smallOrders, pct.format(l.skonto), pct.format(l.freightRate), eur.format(l.potential * 12)
  ]));
}

function basketTable(rows) {
  return table(["Rang", "Lieferant", "Artikelkosten", "Versand", "Skonto", "Gesamt", "Fehlende Artikel"], rows.map((r, i) => [
    i + 1, r.supplier, eur.format(r.productCost), eur.format(r.freight), `-${eur.format(r.skonto)}`, eur.format(r.total), r.missing || "keine"
  ]));
}

function roleTable() {
  return table(["Rolle", "Upload", "Prüfen", "Alle Standorte", "Reports"], [
    ["Superadmin", "ja", "ja", "ja", "ja"],
    ["Admin / Zentrale", "ja", "ja", "ja", "ja"],
    ["Standortleiter", "nein", "nein", "nur eigener", "eingeschränkt"],
  ]);
}

function table(headers, rows) {
  if (!rows.length) {
    return `<p class="muted">Noch keine Daten vorhanden.</p>`;
  }
  return `<div class="table-wrap table-scroll-frame"><table class="data-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td class="${String(cell).startsWith("€") || i > 4 ? "num" : ""}">${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function status(value) {
  const cls = value === "Freigegeben" ? "ok" : value === "Dublette" || value === "Fehlerhaft" ? "bad" : value === "In Prüfung" || value === "Ausgelesen" ? "warn" : "info";
  return `<span class="status ${cls}">${value}</span>`;
}

function matchTag(value) {
  const cls = value > 0.9 ? "green" : value > 0.8 ? "amber" : "red";
  return `<span class="tag ${cls}">${Math.round(value * 100)}%</span>`;
}

function duplicateCheck(inv) {
  return inv.status === "Dublette" ? `<span class="tag red">mögliche Dublette</span>` : `<span class="tag green">eindeutig</span>`;
}

function barChart(rows, labelKey, valueKey, fallbackMax) {
  const max = Math.max(fallbackMax, ...rows.map(r => r[valueKey]));
  return `<div class="chart-bars">${rows.map(r => `<div class="bar-row"><strong>${r[labelKey]}</strong><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, r[valueKey] / max * 100)}%"></div></div><span class="num">${eur.format(r[valueKey])}</span></div>`).join("")}</div>`;
}

function warnings() {
  const entries = [];
  const pending = state.sampleImports.filter(row => !row.invoice_no || !row.invoice_date || !row.gross_total);
  const hinted = state.sampleImports.filter(row => row.warnings?.length);
  const duplicates = state.sampleImports.filter((row, index, all) => row.invoice_no && all.findIndex(other => other.invoice_no === row.invoice_no) !== index);
  if (pending.length) entries.push(["Auslesung offen", `${pending.length} PDF${pending.length === 1 ? "" : "s"} warten auf vollständige Rechnungsdaten`, "warn"]);
  if (hinted.length) entries.push(["Importhinweise", `${hinted.length} Import${hinted.length === 1 ? "" : "e"} mit Hinweis im Status`, "info"]);
  if (duplicates.length) entries.push(["Mögliche Dubletten", `${duplicates.length} Rechnungsnummer${duplicates.length === 1 ? "" : "n"} doppelt erkannt`, "bad"]);
  if (!entries.length) return `<p class="muted">Keine offenen Warnungen.</p>`;
  return entries.map(e => `<p><span class="tag ${e[2] === "bad" ? "red" : e[2] === "warn" ? "amber" : "blue"}">${e[0]}</span><br><span class="muted">${e[1]}</span></p>`).join("");
}

function bindViewEvents() {
  document.querySelectorAll("#search, #locationFilter, #supplierFilter").forEach(el => {
    el.addEventListener("input", event => {
      state[event.target.id] = event.target.value;
      render();
    });
  });
  document.querySelectorAll(".export-action").forEach(btn => btn.addEventListener("click", () => alert("Report wurde als Exportpaket vorgemerkt.")));
  const fileInput = document.getElementById("invoiceFileInput");
  const chooseFiles = document.getElementById("chooseInvoiceFiles");
  const dropzone = document.getElementById("dropzone");
  if (fileInput && chooseFiles && dropzone) {
    chooseFiles.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", event => uploadInvoiceFiles(event.target.files));
    dropzone.addEventListener("dragover", event => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
    dropzone.addEventListener("drop", event => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
      uploadInvoiceFiles(event.dataTransfer.files);
    });
  }
}

function init() {
  const sidebarToggle = document.getElementById("sidebarToggle");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const sidebarClose = document.getElementById("sidebarClose");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const reloadAppBtn = document.getElementById("reloadAppBtn");
  const reloadView = sessionStorage.getItem(reloadViewStorageKey);
  if (reloadView && routes[reloadView]) {
    state.view = reloadView;
    state.openNavSection = sectionForView(reloadView)?.id || state.openNavSection;
  }
  sessionStorage.removeItem(reloadViewStorageKey);
  sidebarToggle.addEventListener("click", toggleSidebar);
  mobileMenuBtn.addEventListener("click", openMobileNav);
  sidebarClose.addEventListener("click", closeMobileNav);
  sidebarOverlay.addEventListener("click", closeMobileNav);
  reloadAppBtn.addEventListener("click", reloadCurrentView);
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMobileNav();
  });
  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 860px)").matches && state.mobileNavOpen) {
      closeMobileNav();
    }
  });
  render();
  loadSupabaseData()
    .then(loaded => {
      state.dataLoaded = true;
      state.dataError = loaded ? "" : "Es wurden noch keine freigegebenen Supabase-Daten gefunden.";
      render();
    })
    .catch(error => {
      console.warn("Supabase-Daten konnten nicht geladen werden.", error);
      state.dataLoaded = true;
      state.dataError = "Supabase konnte nicht geladen werden. Bitte Verbindung und Projektfreigaben prüfen.";
      render();
    });
}

init();
