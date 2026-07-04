const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const pct = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 1 });
const sidebarStorageKey = "orisus-material-sidebar-collapsed";

const state = {
  view: "dashboard",
  role: "admin",
  location: "Kehl",
  query: "",
  supplierFilter: "Alle",
  locationFilter: "Alle",
  categoryFilter: "Alle",
  sampleImports: [],
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
    id: "import",
    label: "Import & Prüfung",
    items: [
      ["invoices", "Rechnungen"],
      ["review", "Prüfcenter"],
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
    id: "admin",
    label: "Administration",
    items: [
      ["settings", "Einstellungen"],
    ],
  },
];

const navItems = navSections.flatMap(section => section.items);

const locations = [
  { id: "kehl", name: "Kehl", manager: "M. Schneider", invoices: 42, address: "Hauptstr. 18, Kehl" },
  { id: "essen-zollverein", name: "Essen Zollverein", manager: "T. Wagner", invoices: 31, address: "Viktoriastraße 41a, 45327 Essen" },
  { id: "huettenberg", name: "Hüttenberg", manager: "S. Hofmann", invoices: 18, address: "Langgönser Str. 29, 35625 Hüttenberg" },
  { id: "essen", name: "Essen", manager: "T. Wagner", invoices: 39, address: "Rüttenscheider Str. 91, Essen" },
  { id: "kirchberg", name: "Kirchberg", manager: "A. Roth", invoices: 28, address: "Markt 4, Kirchberg" },
  { id: "ulmet", name: "Ulmet", manager: "J. Keller", invoices: 22, address: "Praxisweg 2, Ulmet" },
  { id: "kassel", name: "Kassel", manager: "N. Bauer", invoices: 35, address: "Wilhelmshöher Allee 76, Kassel" },
];

const suppliers = [
  { name: "Henry Schein", skonto: 0.02, freightFree: 350, terms: "14 Tage 2%, 30 Tage netto", contact: "meyer@henryschein.example" },
  { name: "Plandent", skonto: 0.00, freightFree: 400, terms: "Zahlung ohne Abzug", contact: "essen@plandent.example" },
  { name: "GERL", skonto: 0.00, freightFree: 300, terms: "Bankeinzug nach Monatsrechnung", contact: "material@gerl.example" },
  { name: "Pluradent", skonto: 0.015, freightFree: 400, terms: "10 Tage 1,5%, 30 Tage netto", contact: "team@pluradent.example" },
  { name: "Dental-Union", skonto: 0.02, freightFree: 300, terms: "8 Tage 2%, 21 Tage netto", contact: "vertrieb@dental-union.example" },
  { name: "Dentaurum", skonto: 0.01, freightFree: 500, terms: "14 Tage 1%, 30 Tage netto", contact: "service@dentaurum.example" },
];

const products = [
  { id: "P-100", name: "Nitrilhandschuhe M, blau", category: "Praxisbedarf", unit: "Stück", pack: 100, standard: true, critical: false, approved: true },
  { id: "P-110", name: "Mundschutz Typ II", category: "Hygiene", unit: "Stück", pack: 50, standard: true, critical: false, approved: true },
  { id: "P-120", name: "Absaugkanülen 16 mm", category: "Verbrauchsmaterial", unit: "Stück", pack: 100, standard: true, critical: false, approved: true },
  { id: "P-130", name: "Flächendesinfektion 1 Liter", category: "Hygiene", unit: "Liter", pack: 1, standard: true, critical: true, approved: true },
  { id: "P-140", name: "Komposit Universal A2", category: "Füllung", unit: "g", pack: 4, standard: true, critical: true, approved: true },
  { id: "P-150", name: "Bonding 5 ml", category: "Füllung", unit: "ml", pack: 5, standard: true, critical: true, approved: true },
  { id: "P-160", name: "Abformmaterial Heavy Body", category: "Prothetik", unit: "ml", pack: 380, standard: false, critical: false, approved: false },
  { id: "P-170", name: "Prophylaxepaste Mint", category: "Prophylaxe", unit: "g", pack: 100, standard: true, critical: false, approved: true },
];

const supplierPriceIndex = {
  "Henry Schein": [5.9, 4.3, 8.4, 9.7, 31.8, 58.5, 94.0, 12.5],
  Plandent: [5.7, 4.5, 8.1, 9.4, 32.6, 56.8, 92.4, 12.2],
  GERL: [6.0, 4.2, 8.6, 9.2, 31.2, 57.9, 90.6, 12.0],
  Pluradent: [6.4, 4.1, 7.9, 10.3, 33.2, 55.8, 89.5, 13.1],
  "Dental-Union": [5.5, 4.6, 8.2, 9.1, 30.9, 57.4, 91.2, 11.7],
  Dentaurum: [6.1, 4.8, 8.8, 9.9, 29.6, 53.9, 96.8, 12.8],
};

const invoices = [
  { id: "INV-24091", no: "HS-883102", date: "2026-06-03", supplier: "Henry Schein", location: "Kehl", status: "Freigegeben", net: 1486, freight: 18, surcharge: 0, discount: 52, skontoUsed: true },
  { id: "INV-24107", no: "DU-553901", date: "2026-06-05", supplier: "Dental-Union", location: "Essen", status: "In Prüfung", net: 964, freight: 0, surcharge: 0, discount: 24, skontoUsed: true },
  { id: "INV-24118", no: "PL-190442", date: "2026-06-09", supplier: "Pluradent", location: "Kirchberg", status: "Ausgelesen", net: 612, freight: 24, surcharge: 9, discount: 0, skontoUsed: false },
  { id: "INV-24131", no: "DT-774201", date: "2026-06-12", supplier: "Dentaurum", location: "Ulmet", status: "Neu", net: 458, freight: 29, surcharge: 12, discount: 0, skontoUsed: false },
  { id: "INV-24143", no: "HS-883255", date: "2026-06-18", supplier: "Henry Schein", location: "Kassel", status: "Dublette", net: 1192, freight: 18, surcharge: 0, discount: 18, skontoUsed: true },
  { id: "INV-24158", no: "DU-554108", date: "2026-06-24", supplier: "Dental-Union", location: "Kehl", status: "Freigegeben", net: 1320, freight: 0, surcharge: 0, discount: 39, skontoUsed: true },
];

const invoiceItems = [
  ["INV-24091", "P-100", 18, 5.9, 0.04, "Nitrile Gloves Medium Blue", 0.93],
  ["INV-24091", "P-130", 22, 9.7, 0.02, "FD 312 Flächendesinfektion 1L", 0.88],
  ["INV-24091", "P-150", 8, 58.5, 0.05, "Bond Universal 5ml", 0.91],
  ["INV-24107", "P-100", 14, 5.5, 0.03, "Einmalhandschuhe Nitril Gr. M", 0.96],
  ["INV-24107", "P-120", 22, 8.2, 0.04, "Absaugkanülen 16 mm blau", 0.97],
  ["INV-24107", "P-170", 12, 11.7, 0.02, "Prophy Paste Mint 100g", 0.86],
  ["INV-24118", "P-110", 28, 4.1, 0.00, "Mundschutz Typ II blau", 0.92],
  ["INV-24118", "P-160", 5, 89.5, 0.02, "Abformmat. Heavy Body 380ml", 0.68],
  ["INV-24131", "P-140", 6, 29.6, 0.00, "Komposit Universal A2 4g", 0.94],
  ["INV-24131", "P-150", 4, 53.9, 0.00, "Bonding Primer 5 ml", 0.79],
  ["INV-24143", "P-100", 20, 6.1, 0.02, "Nitrilhandschuhe blau M", 0.98],
  ["INV-24143", "P-130", 18, 9.9, 0.00, "Flächendesinfektion 1 Liter", 0.93],
  ["INV-24158", "P-120", 31, 8.2, 0.06, "Absaugkanülen 16mm", 0.99],
  ["INV-24158", "P-140", 12, 30.9, 0.04, "Universal Komposit A2", 0.95],
  ["INV-24158", "P-170", 16, 11.7, 0.03, "Prophylaxe Paste Mint", 0.91],
].map(([invoiceId, productId, qty, listPrice, itemDiscount, supplierName, match]) => ({
  invoiceId, productId, qty, listPrice, itemDiscount, supplierName, match
}));

const historicalPriceFactors = {
  "P-100": { 2024: 0.88, 2025: 0.94, 2026: 1.00 },
  "P-110": { 2024: 0.91, 2025: 0.96, 2026: 1.00 },
  "P-120": { 2024: 0.87, 2025: 0.93, 2026: 1.00 },
  "P-130": { 2024: 0.82, 2025: 0.91, 2026: 1.00 },
  "P-140": { 2024: 0.78, 2025: 0.89, 2026: 1.00 },
  "P-150": { 2024: 0.84, 2025: 0.92, 2026: 1.00 },
  "P-160": { 2024: 0.89, 2025: 0.95, 2026: 1.00 },
  "P-170": { 2024: 0.92, 2025: 0.97, 2026: 1.00 },
};

const historicalVolumes = {
  "P-100": { 2024: 11600, 2025: 13900, 2026: 16200 },
  "P-110": { 2024: 8200, 2025: 9300, 2026: 10400 },
  "P-120": { 2024: 7100, 2025: 8600, 2026: 9900 },
  "P-130": { 2024: 520, 2025: 610, 2026: 740 },
  "P-140": { 2024: 410, 2025: 470, 2026: 540 },
  "P-150": { 2024: 290, 2025: 330, 2026: 390 },
  "P-160": { 2024: 130, 2025: 165, 2026: 180 },
  "P-170": { 2024: 680, 2025: 720, 2026: 810 },
};

function invoiceTotalBeforeAdjustments(invoiceId) {
  return invoiceItems.filter(i => i.invoiceId === invoiceId).reduce((sum, i) => sum + i.qty * i.listPrice * (1 - i.itemDiscount), 0);
}

function calcItem(item) {
  const inv = invoices.find(i => i.id === item.invoiceId);
  const product = products.find(p => p.id === item.productId);
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

const calculatedItems = () => invoiceItems.map(calcItem);

function bestPrice(productId) {
  const prices = calculatedItems().filter(i => i.productId === productId).map(i => i.comparisonPrice);
  return Math.min(...prices);
}

function groupAverage(productId) {
  const prices = calculatedItems().filter(i => i.productId === productId).map(i => i.comparisonPrice);
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

function locationScopeRows(rows) {
  return state.role === "location" ? rows.filter(row => (row.inv?.location || row.location) === state.location) : rows;
}

function kpis() {
  const rows = locationScopeRows(calculatedItems());
  const volume = rows.reduce((sum, row) => sum + row.effectiveNet, 0);
  const potential = rows.reduce((sum, row) => sum + Math.max(0, row.comparisonPrice - bestPrice(row.productId)) * row.qty * row.product.pack, 0);
  const avgDeviation = rows.reduce((sum, row) => sum + ((row.comparisonPrice / groupAverage(row.productId)) - 1), 0) / rows.length;
  const scopedInvoices = state.role === "location" ? invoices.filter(i => i.location === state.location) : invoices;
  return {
    invoices: scopedInvoices.length,
    products: products.length,
    suppliers: suppliers.length,
    volume,
    monthly: potential,
    yearly: potential * 12,
    deviation: avgDeviation,
    skonto: scopedInvoices.filter(i => i.skontoUsed).length / scopedInvoices.length,
    freight: scopedInvoices.reduce((s, i) => s + i.freight, 0) / scopedInvoices.reduce((s, i) => s + i.net, 0),
    aCases: recommendations().filter(r => r.className === "A-Fall").length,
  };
}

function recommendations() {
  return calculatedItems().map(row => {
    const best = bestPrice(row.productId);
    const saving = Math.max(0, row.comparisonPrice - best) * row.qty * row.product.pack;
    const deviation = row.comparisonPrice / groupAverage(row.productId) - 1;
    const className = saving > 20 && deviation > 0.04 ? "A-Fall" : saving > 8 ? "B-Fall" : "C-Fall";
    const recommendedSupplier = cheapestSupplier(row.productId);
    const recommendedLabel = recommendedSupplier === row.inv.supplier ? `${recommendedSupplier} Rahmenpreis` : recommendedSupplier;
    return { ...row, best, saving, deviation, className, recommendedSupplier, recommendedLabel };
  }).filter(r => r.saving > 1).sort((a, b) => b.saving - a.saving);
}

function cheapestSupplier(productId) {
  const productIndex = products.findIndex(p => p.id === productId);
  return Object.entries(supplierPriceIndex).sort((a, b) => a[1][productIndex] - b[1][productIndex])[0][0];
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
      deviation: rows.reduce((s, r) => s + (r.comparisonPrice / groupAverage(r.productId) - 1), 0) / rows.length,
      discountRate: supplierInvoices.reduce((s, i) => s + i.discount, 0) / Math.max(1, supplierInvoices.reduce((s, i) => s + i.net, 0)),
      freightRate: freight / Math.max(1, supplierInvoices.reduce((s, i) => s + i.net, 0)),
      potential,
      stability: 82 - potential / 8,
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
  return products.map(product => {
    const current = groupAverage(product.id);
    const factors = historicalPriceFactors[product.id];
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
  }).sort((a, b) => b.annualImpact - a.annualImpact);
}

function yearlySummary() {
  const rows = yearlyPriceRows();
  const weighted2025 = rows.reduce((sum, row) => sum + row.price2025 * row.volume2026, 0);
  const weighted2026 = rows.reduce((sum, row) => sum + row.price2026 * row.volume2026, 0);
  const annualImpact = rows.reduce((sum, row) => sum + row.annualImpact, 0);
  return {
    avgIncrease: weighted2026 / weighted2025 - 1,
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

function basketSimulation(locationName = state.location) {
  const rows = calculatedItems().filter(i => i.inv.location === locationName);
  return suppliers.map(supplier => {
    let missing = 0;
    const productCost = rows.reduce((sum, row) => {
      const productIndex = products.findIndex(p => p.id === row.productId);
      const supplierPrice = supplierPriceIndex[supplier.name][productIndex];
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
  document.getElementById("viewEyebrow").textContent = state.role === "location" ? `Standort ${state.location}` : "Materialpreis-Controlling";
  const view = document.getElementById("view");
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
          <div><strong>PDFs hier ablegen</strong><span class="muted">Mehrfachupload, OCR-Simulation und Dublettenprüfung vorbereitet</span></div>
        </div>
        <div class="form-grid" style="margin-top:14px">
          <label>Standort<select>${locations.map(l => `<option>${l.name}</option>`)}</select></label>
          <label>Lieferant<select>${suppliers.map(s => `<option>${s.name}</option>`)}</select></label>
        </div>
      </section>
      <section class="panel"><h2>Statusworkflow</h2><div class="workflow">${["Neu", "Ausgelesen", "In Prüfung", "Freigegeben", "Fehlerhaft", "Dublette"].map((s, i) => `<span class="${i < 4 ? "active" : ""}">${s}</span>`).join("")}</div></section>
    </div>
    <section class="panel" style="margin-top:16px">
      <div class="toolbar">
        <h2>Erkannte Beispielimporte</h2>
        <span class="tag blue">${state.sampleImports.length || 0} PDFs analysiert</span>
      </div>
      ${sampleImportTable(state.sampleImports)}
    </section>
    <section class="panel" style="margin-top:16px"><div class="toolbar"><h2>Rechnungsliste</h2>${filters()}</div>${invoiceTable(invoices)}</section>`;
}

function reviewView() {
  const inv = invoices[2];
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
        <span class="tag blue">2024 bis 2026 vorbereitet</span>
      </div>
      ${yearlyTable(rows)}
    </section>
  `;
}

function locationsView() {
  return `<div class="grid cols-2"><section class="panel"><h2>Standort-Benchmark</h2>${locationTable(locationStats())}</section><section class="panel"><h2>Preisabweichung je Standort</h2>${barChart(locationStats(), "name", "potential", 160)}</section></div>`;
}

function basketView() {
  const sim = basketSimulation();
  return `<div class="grid cols-2"><section class="panel"><h2>Warenkorb ${state.location}</h2><p class="muted">Simulation: Was hätte derselbe Artikelkorb bei Lieferant A, B, C gekostet?</p>${basketTable(sim)}</section><section class="panel"><h2>Realistische Empfehlung</h2><div class="calc-box">${sim.map((s, i) => `<div class="calc-row ${i === 0 ? "total" : ""}"><span>${s.supplier}${i === 0 ? " · bevorzugt" : ""}</span><strong>${eur.format(s.total)}</strong></div>`).join("")}</div><p class="muted">Fehlende Artikel, Mindestbestellwerte, Skonto und Versandkosten sind in der Simulation markiert.</p></section></div>`;
}

function recommendationsView() {
  return `<section class="panel"><div class="toolbar"><h2>Priorisierte Empfehlungen</h2>${filters()}</div>${recommendationTable(locationScopeRows(recommendations()))}</section>`;
}

function reportsView() {
  const reports = [
    ["Lieferantenreport", "Verhandlungsliste, Rahmenpreis-Vorschlag, Top-Abweichungen"],
    ["Artikel-Abweichungsreport", "Standorte, Lieferanten, Preisentwicklung, Potenzial"],
    ["Standort-Benchmark-Report", "Lieferantenmix, Bestellverhalten, Maßnahmenliste"],
    ["Warenkorb-Report", "Simulation, fehlende Artikel, realistisches Umstellungspotenzial"],
    ["Management-Dashboard-Report", "Top 10 Potenziale, Ranking, Preissteigerungen"],
  ];
  return `<div class="grid cols-3">${reports.map(r => `<article class="panel"><h2>${r[0]}</h2><p class="muted">${r[1]}</p><button class="btn primary export-action">PDF vorbereiten</button> <button class="btn export-action">Excel</button></article>`).join("")}</div>`;
}

function settingsView() {
  return `<section class="panel"><h2>Zugänge & Rechte</h2>${roleTable()}</section>`;
}

function mobileView() {
  const rows = locationScopeRows(recommendations()).slice(0, 6);
  return `<div class="grid"><section class="panel"><h2>${state.location}: Maßnahmen</h2><p class="muted">Mobile, reduzierte Standortleiter-Sicht ohne fremde Rechnungsdetails.</p></section>${rows.map(r => `<article class="mobile-card"><strong>${r.product.name}</strong><div class="price-row"><span>Aktuell: ${r.inv.supplier}</span><strong>${eur.format(r.comparisonPrice)} / ${r.product.unit}</strong></div><div class="price-row"><span>Empfohlen: ${r.recommendedLabel}</span><strong>${eur.format(r.best)} / ${r.product.unit}</strong></div><span class="tag ${r.className === "A-Fall" ? "red" : "amber"}">${r.className} · ${eur.format(r.saving * 12)} jährlich</span><div><button class="btn primary small">Übernehmen</button> <button class="btn small">Ignorieren</button> <button class="btn small">Begründen</button></div></article>`).join("")}</div>`;
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
    return `<p class="muted">Beispielimporte werden geladen.</p>`;
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
    row.extracted_items,
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
    r.product.name, r.inv.location, r.inv.supplier, eur.format(r.comparisonPrice), eur.format(bestPrice(r.productId)), eur.format(groupAverage(r.productId)), pct.format(r.comparisonPrice / groupAverage(r.productId) - 1), eur.format(Math.max(0, r.comparisonPrice - bestPrice(r.productId)) * r.qty * r.product.pack)
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
  const entries = [
    ["Preissteigerung über Schwelle", "Komposit Universal A2 bei Kassel +11,8%", "bad"],
    ["Skonto nicht genutzt", "Kirchberg und Ulmet mit offenem Potenzial", "warn"],
    ["Neue Artikel ohne sicheres Matching", "Abformmaterial Heavy Body 68%", "warn"],
    ["Kleinstbestellungen", "Ulmet unterschreitet Mindestbestellwert", "info"],
  ];
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
}

function init() {
  const sidebarToggle = document.getElementById("sidebarToggle");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const sidebarClose = document.getElementById("sidebarClose");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  sidebarToggle.addEventListener("click", toggleSidebar);
  mobileMenuBtn.addEventListener("click", openMobileNav);
  sidebarClose.addEventListener("click", closeMobileNav);
  sidebarOverlay.addEventListener("click", closeMobileNav);
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMobileNav();
  });
  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 860px)").matches && state.mobileNavOpen) {
      closeMobileNav();
    }
  });
  render();
  fetch("./sample-invoice-imports.json")
    .then(response => response.ok ? response.json() : [])
    .then(imports => {
      state.sampleImports = imports;
      render();
    })
    .catch(() => {
      state.sampleImports = [];
    });
}

init();
