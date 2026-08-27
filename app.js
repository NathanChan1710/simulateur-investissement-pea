/**
 * (NOTHING) PEA STUDIO - SIMULATEUR DCA & COMPARATEUR D'ÉPARGNE
 * =============================================================
 * Moteur client complet :
 * - Gestion multi-actifs (max 5)
 * - Projections d'intérêts composés basées sur l'historique réel
 * - Moteur fiscal PEA (Avant vs Après 5 ans)
 * - Grand comparateur 4 enveloppes : Livret A vs Assurance-Vie vs CTO vs PEA
 * - Graphique prédictif interactif Chart.js avec polices lisses
 * - Mode Jour / Mode Nuit Nothing OS
 */

// ============================================================================
// 1. CATALOGUE DES ACTIFS DISPONIBLES (ÉLIGIBLES PEA)
// ============================================================================
const ASSET_CATALOG = [
  {
    ticker: 'CW8.PA',
    name: 'Amundi MSCI World UCITS ETF',
    cagr: 8.8,
    category: 'etf-monde',
    desc: 'Indice mondial 23 pays développés (~1 500 grandes entreprises).'
  },
  {
    ticker: 'WPEA.PA',
    name: 'iShares MSCI World Swap PEA',
    cagr: 8.8,
    category: 'etf-monde',
    desc: 'ETF MSCI World à frais réduits (0.25%/an).'
  },
  {
    ticker: 'ESE.PA',
    name: 'BNP Paribas Easy S&P 500',
    cagr: 10.5,
    category: 'etf-monde',
    desc: 'Les 500 plus grandes entreprises américaines.'
  },
  {
    ticker: 'UST.PA',
    name: 'Amundi PEA Nasdaq 100',
    cagr: 14.2,
    category: 'etf-monde',
    desc: 'Top 100 des géants de la tech américaine.'
  },
  {
    ticker: 'PAEEM.PA',
    name: 'Amundi PEA MSCI Emerging Markets',
    cagr: 7.2,
    category: 'etf-geo',
    desc: 'Marchés émergents (Chine, Inde, Taïwan, Brésil, etc.).'
  },
  {
    ticker: 'MEU.PA',
    name: 'Amundi Stoxx Europe 600',
    cagr: 7.5,
    category: 'etf-geo',
    desc: '600 principales capitalisations européennes.'
  },
  {
    ticker: 'AI.PA',
    name: 'Air Liquide',
    cagr: 10.8,
    category: 'actions',
    desc: 'Leader mondial des gaz industriels (croissance et dividendes réguliers).'
  },
  {
    ticker: 'MC.PA',
    name: 'LVMH Moët Hennessy',
    cagr: 13.2,
    category: 'actions',
    desc: 'Numéro 1 mondial du luxe.'
  },
  {
    ticker: 'TTE.PA',
    name: 'TotalEnergies',
    cagr: 8.5,
    category: 'actions',
    desc: 'Major énergétique européenne avec dividende élevé.'
  },
  {
    ticker: 'SU.PA',
    name: 'Schneider Electric',
    cagr: 11.8,
    category: 'actions',
    desc: 'Spécialiste mondial de la gestion de l\'énergie et automatisation.'
  },
  {
    ticker: 'RMS.PA',
    name: 'Hermès International',
    cagr: 18.2,
    category: 'actions',
    desc: 'Maison de haute couture et maroquinerie de luxe d\'exception.'
  },
  {
    ticker: 'SAN.PA',
    name: 'Sanofi',
    cagr: 6.8,
    category: 'actions',
    desc: 'Géant pharmaceutique et santé européen.'
  }
];

// ============================================================================
// 2. ÉTAT GLOBAL DE L'APPLICATION
// ============================================================================
const AppState = {
  selectedAssets: [
    { ticker: 'CW8.PA', name: 'Amundi MSCI World (CW8)', monthlyAmount: 450, cagr: 8.8 },
    { ticker: 'PAEEM.PA', name: 'Amundi PEA Emerging Markets (PAEEM)', monthlyAmount: 150, cagr: 7.2 }
  ],
  durationYears: 10,
  selectedComparisonPlan: 'livret_a',
  theme: localStorage.getItem('pea_theme') || 'dark',
  catalogFilter: 'all',
  chartInstance: null
};

// Formateurs monétaires
const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const compactCurrencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0
});

// ============================================================================
// 3. INITIALISATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(AppState.theme);
  initEventListeners();
  renderSelectedAssets();
  renderCatalogModalItems();
  recalculateAll();
});

// ============================================================================
// 4. ÉCOUTEURS D'ÉVÉNEMENTS
// ============================================================================
function initEventListeners() {
  // Sélecteur de plan comparateur
  const planSelect = document.getElementById('comparator-plan-select');
  if (planSelect) {
    planSelect.addEventListener('change', (e) => {
      AppState.selectedComparisonPlan = e.target.value;
      recalculateAll();
    });
  }

  // Switch Thème Jour / Nuit
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Slider de durée
  const durationSlider = document.getElementById('duration-slider');
  if (durationSlider) {
    durationSlider.addEventListener('input', (e) => {
      AppState.durationYears = parseInt(e.target.value, 10);
      updateDurationUI();
      recalculateAll();
    });
  }

  // Raccourcis de durée
  const quickChips = document.querySelectorAll('.chip-btn');
  quickChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      quickChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const years = parseInt(chip.getAttribute('data-years'), 10);
      AppState.durationYears = years;
      if (durationSlider) durationSlider.value = years;
      updateDurationUI();
      recalculateAll();
    });
  });

  // Modal Catalogue
  const openCatalogBtn = document.getElementById('open-catalog-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const catalogModal = document.getElementById('catalog-modal');

  if (openCatalogBtn && catalogModal) {
    openCatalogBtn.addEventListener('click', () => {
      catalogModal.classList.remove('hidden');
    });
  }

  if (closeModalBtn && catalogModal) {
    closeModalBtn.addEventListener('click', () => {
      catalogModal.classList.add('hidden');
    });
  }

  if (catalogModal) {
    catalogModal.addEventListener('click', (e) => {
      if (e.target === catalogModal) {
        catalogModal.classList.add('hidden');
      }
    });
  }

  // Filtres Catalogue
  const filterChips = document.querySelectorAll('.filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      AppState.catalogFilter = chip.getAttribute('data-cat');
      renderCatalogModalItems();
    });
  });

  // Ajout actif personnalisé
  const addCustomBtn = document.getElementById('add-custom-asset-btn');
  if (addCustomBtn) {
    addCustomBtn.addEventListener('click', handleAddCustomAsset);
  }
}

// ============================================================================
// 5. THÈME SOMBRE / CLAIR
// ============================================================================
function toggleTheme() {
  AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('pea_theme', AppState.theme);
  applyTheme(AppState.theme);
  if (AppState.chartInstance) {
    recalculateAll();
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeLabel = document.getElementById('theme-label');
  if (themeLabel) {
    themeLabel.textContent = theme === 'dark' ? 'MODE JOUR' : 'MODE NUIT';
  }
}

// ============================================================================
// 6. GESTION DES ACTIFS SÉLECTIONNÉS (MAX 5)
// ============================================================================
function renderSelectedAssets() {
  const container = document.getElementById('selected-assets-list');
  const countBadge = document.getElementById('asset-count-badge');
  const openCatalogBtn = document.getElementById('open-catalog-btn');

  if (!container) return;
  container.innerHTML = '';

  const totalAssets = AppState.selectedAssets.length;
  if (countBadge) countBadge.textContent = `${totalAssets} / 5 ACTIFS SÉLECTIONNÉS`;

  if (openCatalogBtn) {
    if (totalAssets >= 5) {
      openCatalogBtn.disabled = true;
      openCatalogBtn.style.opacity = '0.5';
      openCatalogBtn.title = 'Maximum de 5 actifs atteint';
    } else {
      openCatalogBtn.disabled = false;
      openCatalogBtn.style.opacity = '1';
      openCatalogBtn.title = 'Ajouter un actif (max 5)';
    }
  }

  const totalMonthly = AppState.selectedAssets.reduce((sum, a) => sum + (parseFloat(a.monthlyAmount) || 0), 0);

  AppState.selectedAssets.forEach((asset, index) => {
    const card = document.createElement('div');
    card.className = 'asset-config-card widget';

    const sharePct = totalMonthly > 0 ? ((asset.monthlyAmount / totalMonthly) * 100).toFixed(1) : '0.0';

    card.innerHTML = `
      <div class="asset-config-header">
        <div>
          <span class="asset-ticker-badge font-display">${asset.ticker}</span>
          <span class="asset-name-sub font-sans">${asset.name}</span>
        </div>
        ${totalAssets > 1 ? `<button class="asset-remove-btn font-mono" data-index="${index}" title="Supprimer cet actif">✕</button>` : ''}
      </div>

      <div class="asset-input-group">
        <label class="input-label font-mono">VERSEMENT MENSUEL :</label>
        <div class="amount-input-wrapper">
          <input type="number" class="amount-input asset-amount-field font-display" data-index="${index}" value="${asset.monthlyAmount}" min="0" step="10" />
          <span class="amount-unit font-mono">€/mois</span>
        </div>
      </div>

      <div class="asset-card-footer font-mono">
        <span class="cagr-badge font-display">+${asset.cagr}%/an</span>
        <span class="alloc-share-pill">${sharePct}% du total</span>
      </div>
    `;

    container.appendChild(card);
  });

  // Événements modification des montants
  const amountInputs = container.querySelectorAll('.asset-amount-field');
  amountInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      const val = Math.max(0, parseFloat(e.target.value) || 0);
      AppState.selectedAssets[idx].monthlyAmount = val;
      recalculateAll();
      updateAllocationPills();
    });
  });

  // Événements suppression
  const removeButtons = container.querySelectorAll('.asset-remove-btn');
  removeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      AppState.selectedAssets.splice(idx, 1);
      renderSelectedAssets();
      recalculateAll();
    });
  });
}

function updateAllocationPills() {
  const totalMonthly = AppState.selectedAssets.reduce((sum, a) => sum + (parseFloat(a.monthlyAmount) || 0), 0);
  const pills = document.querySelectorAll('.alloc-share-pill');
  pills.forEach((pill, idx) => {
    if (AppState.selectedAssets[idx]) {
      const sharePct = totalMonthly > 0 ? ((AppState.selectedAssets[idx].monthlyAmount / totalMonthly) * 100).toFixed(1) : '0.0';
      pill.textContent = `${sharePct}% du total`;
    }
  });
}

// ============================================================================
// 7. CATALOGUE & AJOUT D'ACTIF
// ============================================================================
function renderCatalogModalItems() {
  const listEl = document.getElementById('catalog-items-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const filtered = ASSET_CATALOG.filter(item => {
    if (AppState.catalogFilter === 'all') return true;
    return item.category === AppState.catalogFilter;
  });

  filtered.forEach(item => {
    const isAlreadySelected = AppState.selectedAssets.some(a => a.ticker === item.ticker);

    const row = document.createElement('div');
    row.className = 'catalog-item-row';

    row.innerHTML = `
      <div class="catalog-item-left">
        <strong class="cat-item-ticker font-display">${item.ticker}</strong>
        <span class="cat-item-name font-sans">${item.name}</span>
      </div>
      <div class="catalog-item-right font-mono">
        <span class="cat-item-cagr font-display">+${item.cagr}%/an</span>
        <button class="btn-add-asset ${isAlreadySelected ? 'disabled' : ''}" data-ticker="${item.ticker}" ${isAlreadySelected || AppState.selectedAssets.length >= 5 ? 'disabled' : ''}>
          ${isAlreadySelected ? 'DÉJÀ SÉLECTIONNÉ' : '+ SÉLECTIONNER'}
        </button>
      </div>
    `;

    listEl.appendChild(row);
  });

  const addBtns = listEl.querySelectorAll('.btn-add-asset:not([disabled])');
  addBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const ticker = e.target.getAttribute('data-ticker');
      const item = ASSET_CATALOG.find(a => a.ticker === ticker);
      if (item && AppState.selectedAssets.length < 5) {
        AppState.selectedAssets.push({
          ticker: item.ticker,
          name: item.name,
          monthlyAmount: 100,
          cagr: item.cagr
        });
        document.getElementById('catalog-modal').classList.add('hidden');
        renderSelectedAssets();
        recalculateAll();
      }
    });
  });
}

function handleAddCustomAsset() {
  const tickerInput = document.getElementById('custom-ticker');
  const nameInput = document.getElementById('custom-name');
  const cagrInput = document.getElementById('custom-cagr');

  const ticker = (tickerInput?.value || '').trim().toUpperCase();
  const name = (nameInput?.value || '').trim() || ticker;
  const cagr = parseFloat(cagrInput?.value) || 8.0;

  if (!ticker) {
    alert('Veuillez renseigner le symbole ou le nom de l\'actif.');
    return;
  }

  if (AppState.selectedAssets.length >= 5) {
    alert('Vous avez déjà atteint la limite de 5 actifs.');
    return;
  }

  AppState.selectedAssets.push({
    ticker: ticker,
    name: name,
    monthlyAmount: 100,
    cagr: cagr
  });

  tickerInput.value = '';
  nameInput.value = '';
  cagrInput.value = '';

  document.getElementById('catalog-modal').classList.add('hidden');
  renderSelectedAssets();
  recalculateAll();
}

// ============================================================================
// 8. INTERFACE & DURÉE
// ============================================================================
function updateDurationUI() {
  const yearsValEl = document.getElementById('duration-years-val');
  const maturityTag = document.getElementById('pea-maturity-tag');
  const compPeriodBadge = document.getElementById('comp-period-badge');

  if (yearsValEl) yearsValEl.textContent = `${AppState.durationYears} AN${AppState.durationYears > 1 ? 'S' : ''}`;
  if (compPeriodBadge) compPeriodBadge.textContent = `SIMULATION COMPARATIVE SUR ${AppState.durationYears} AN${AppState.durationYears > 1 ? 'S' : ''}`;

  if (maturityTag) {
    if (AppState.durationYears >= 5) {
      maturityTag.textContent = '[PEA MATURE - 0% IMPÔT SUR LE REVENU]';
      maturityTag.style.color = 'var(--color-profit-light)';
    } else {
      maturityTag.textContent = '[AVANT 5 ANS - FLAT TAX 30% & CLÔTURE OBLIGATOIRE]';
      maturityTag.style.color = 'var(--color-warning)';
    }
  }

  const chips = document.querySelectorAll('.chip-btn');
  chips.forEach(c => {
    const y = parseInt(c.getAttribute('data-years'), 10);
    if (y === AppState.durationYears) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
}

// ============================================================================
// 9. MOTEUR DE CALCULS : INTÉRÊTS COMPOSÉS & COMPARATIF ÉPARGNE
// ============================================================================
function recalculateAll() {
  const years = AppState.durationYears;
  const totalMonths = years * 12;

  const totalMonthly = AppState.selectedAssets.reduce((sum, a) => sum + (parseFloat(a.monthlyAmount) || 0), 0);
  const totalAnnual = totalMonthly * 12;

  // Calcul du CAGR moyen pondéré du portefeuille
  let weightedCAGR = 0.0;
  if (totalMonthly > 0) {
    weightedCAGR = AppState.selectedAssets.reduce((sum, a) => {
      return sum + ((a.monthlyAmount / totalMonthly) * a.cagr);
    }, 0);
  }

  const totalInvested = totalMonthly * totalMonths;
  let totalGrossValue = 0.0;

  // Projection année par année pour le graphique
  const yearlyData = [];
  yearlyData.push({ year: 0, invested: 0, gross: 0, net: 0 });

  for (let y = 1; y <= years; y++) {
    let yearGross = 0.0;
    const monthsUpToYear = y * 12;
    const yearInvested = totalMonthly * monthsUpToYear;

    AppState.selectedAssets.forEach(asset => {
      const rMonthly = Math.pow(1 + (asset.cagr / 100), 1 / 12) - 1;
      let assetFutureValue = 0.0;
      if (rMonthly > 0) {
        assetFutureValue = asset.monthlyAmount * ((Math.pow(1 + rMonthly, monthsUpToYear) - 1) / rMonthly);
      } else {
        assetFutureValue = asset.monthlyAmount * monthsUpToYear;
      }
      yearGross += assetFutureValue;
    });

    const yearGain = Math.max(0, yearGross - yearInvested);
    let yearTaxes = 0.0;
    if (y < 5) {
      yearTaxes = yearGain * 0.30;
    } else {
      yearTaxes = yearGain * 0.172;
    }
    const yearNet = yearInvested + (yearGain - yearTaxes);

    yearlyData.push({
      year: y,
      invested: Math.round(yearInvested),
      gross: Math.round(yearGross),
      net: Math.round(yearNet)
    });

    if (y === years) {
      totalGrossValue = yearGross;
    }
  }

  // Calculs fiscaux du PEA au terme
  const grossGain = Math.max(0, totalGrossValue - totalInvested);
  const isMature = years >= 5;
  const taxRate = isMature ? 0.172 : 0.30;
  const taxesAmount = grossGain * taxRate;
  const netPayout = totalInvested + (grossGain - taxesAmount);

  const ctoTaxes = grossGain * 0.30;
  const taxSavingsVsCTO = Math.max(0, ctoTaxes - (grossGain * 0.172));

  // ==========================================================================
  // CALCULS DÉTAILLÉS POUR LE COMPARATEUR 4 PLANS D'ÉPARGNE
  // ==========================================================================
  
  // 1. Livret A / LDDS (~3.0% net / an)
  // Formule d'épargne mensuelle avec taux 3.0% net
  const rLivretMonthly = Math.pow(1 + 0.030, 1 / 12) - 1;
  const valLivretA = totalMonthly * ((Math.pow(1 + rLivretMonthly, totalMonths) - 1) / rLivretMonthly);
  const gainLivretA = Math.max(0, valLivretA - totalInvested);

  // 2. Assurance-Vie (Gestion profilée / UC : ~5.5% brut - 0.7% frais = ~4.8% net)
  const rAVMonthly = Math.pow(1 + 0.048, 1 / 12) - 1;
  const valAVGross = totalMonthly * ((Math.pow(1 + rAVMonthly, totalMonths) - 1) / rAVMonthly);
  const gainAVGross = Math.max(0, valAVGross - totalInvested);
  // Fiscalité AV : si >= 8 ans, abattement 4600€/an puis 24.7%, sinon 30%
  let avTaxes = 0.0;
  if (years >= 8) {
    const taxableGain = Math.max(0, gainAVGross - 4600);
    avTaxes = (taxableGain * 0.247) + (Math.min(gainAVGross, 4600) * 0.172);
  } else {
    avTaxes = gainAVGross * 0.30;
  }
  const valAVNet = valAVGross - avTaxes;
  const gainAVNet = Math.max(0, valAVNet - totalInvested);

  // 3. Compte-Titres (CTO) : Rendement actions identique - 30% Flat Tax
  const valCTONet = totalInvested + (grossGain * 0.70);
  const gainCTONet = grossGain * 0.70;

  // 4. PEA Net (Le gagnant)
  const valPEANet = netPayout;
  const gainPEANet = grossGain - taxesAmount;

  // Mise à jour de l'interface
  updateHeaderWidgets(totalMonthly, totalAnnual, weightedCAGR);
  updateResultCards({
    totalInvested,
    grossGain,
    totalGrossValue,
    taxesAmount,
    netPayout,
    isMature,
    taxSavingsVsCTO
  });

  updateSavingsComparator({
    valLivretA,
    gainLivretA,
    valAVNet,
    gainAVNet,
    valCTONet,
    gainCTONet,
    valPEANet,
    gainPEANet,
    weightedCAGR,
    years
  });

  renderPredictionChart(yearlyData);
}

function updateHeaderWidgets(totalMonthly, totalAnnual, weightedCAGR) {
  const totalMonthlyEl = document.getElementById('total-monthly-amount');
  const totalAnnualEl = document.getElementById('total-annual-amount');
  const cagrDisplayEl = document.getElementById('weighted-cagr-display');

  if (totalMonthlyEl) totalMonthlyEl.innerHTML = `${currencyFormatter.format(totalMonthly)}<span class="month-unit font-sans">/mois</span>`;
  if (totalAnnualEl) totalAnnualEl.textContent = `soit ${currencyFormatter.format(totalAnnual)} par an`;
  if (cagrDisplayEl) cagrDisplayEl.innerHTML = `+${weightedCAGR.toFixed(2)} %<span class="year-unit font-sans">/an</span>`;
}

function updateResultCards(res) {
  const totalInvestedEl = document.getElementById('res-total-invested');
  if (totalInvestedEl) totalInvestedEl.textContent = currencyFormatter.format(res.totalInvested);

  const grossGainEl = document.getElementById('res-gross-gain');
  const grossTotalEl = document.getElementById('res-gross-total');
  const gainMultiplierEl = document.getElementById('res-gain-multiplier');

  if (grossGainEl) grossGainEl.textContent = `+${currencyFormatter.format(res.grossGain)}`;
  if (grossTotalEl) grossTotalEl.textContent = currencyFormatter.format(res.totalGrossValue);
  
  const gainPct = res.totalInvested > 0 ? (res.grossGain / res.totalInvested) * 100 : 0;
  if (gainMultiplierEl) gainMultiplierEl.textContent = `+${gainPct.toFixed(1)}% de performance totale`;

  const taxStatusIndicator = document.getElementById('tax-status-indicator');
  const taxStatusText = document.getElementById('tax-status-text');
  const taxSubLabel = document.getElementById('tax-sub-label');
  const taxesAmountEl = document.getElementById('res-taxes-amount');
  const taxExplanationEl = document.getElementById('res-tax-explanation');
  const taxEcoText = document.getElementById('tax-eco-text');
  const taxTagMode = document.getElementById('tax-tag-mode');

  if (res.isMature) {
    if (taxStatusIndicator) taxStatusIndicator.className = 'tax-status-pill font-mono status-mature';
    if (taxStatusText) taxStatusText.textContent = `RETRAIT APRÈS 5 ANS : 0% D'IMPÔT SUR LE REVENU`;
    if (taxTagMode) taxTagMode.textContent = '[17.2% PS SEUL]';
    if (taxSubLabel) taxSubLabel.textContent = `PRÉLÈVEMENTS SOCIAUX (17.2%)`;
    if (taxesAmountEl) taxesAmountEl.textContent = `-${currencyFormatter.format(res.taxesAmount)}`;
    if (taxExplanationEl) taxExplanationEl.textContent = `0% d'impôt sur le revenu (Exonération légale PEA)`;
    if (taxEcoText) taxEcoText.innerHTML = `Économie vs Compte-Titres : <strong>+${currencyFormatter.format(res.taxSavingsVsCTO)}</strong>`;
  } else {
    if (taxStatusIndicator) taxStatusIndicator.className = 'tax-status-pill font-mono status-immature';
    if (taxStatusText) taxStatusText.textContent = `RETRAIT AVANT 5 ANS : FLAT TAX 30% & CLÔTURE OBLIGATOIRE DU PLAN`;
    if (taxTagMode) taxTagMode.textContent = '[30.0% PFU]';
    if (taxSubLabel) taxSubLabel.textContent = `FLAT TAX PFU (30.0%)`;
    if (taxesAmountEl) taxesAmountEl.textContent = `-${currencyFormatter.format(res.taxesAmount)}`;
    if (taxExplanationEl) taxExplanationEl.textContent = `12.8% Impôt IR + 17.2% Prélèvements sociaux`;
    if (taxEcoText) taxEcoText.innerHTML = `Perte des avantages fiscaux du PEA`;
  }

  const netPayoutEl = document.getElementById('res-net-payout');
  const netGainOnlyEl = document.getElementById('res-net-gain-only');
  const netGain = res.grossGain - res.taxesAmount;

  if (netPayoutEl) netPayoutEl.textContent = currencyFormatter.format(res.netPayout);
  if (netGainOnlyEl) {
    netGainOnlyEl.innerHTML = `dont <strong>+${currencyFormatter.format(netGain)}</strong> de gains nets en poche`;
  }
}

function updateSavingsComparator(comp) {
  // Update PEA side (already displayed statically)
  const valPEAEl = document.getElementById('duel-val-pea');
  const gainPEAEl = document.getElementById('duel-gain-pea');
  const cagrPEAEl = document.getElementById('duel-cagr-pea');
  if (valPEAEl) valPEAEl.textContent = currencyFormatter.format(comp.valPEANet);
  if (gainPEAEl) gainPEAEl.textContent = `dont +${currencyFormatter.format(comp.gainPEANet)} de gains nets`;
  if (cagrPEAEl) cagrPEAEl.textContent = `+${comp.weightedCAGR.toFixed(2)} %/an`;

  // Determine which competitor plan is selected
  const planKey = AppState.selectedComparisonPlan || 'livret_a';
  let compName = '';
  let compCagr = '';
  let compVal = 0;
  let compGain = 0;

  switch (planKey) {
    case 'livret_a':
      compName = 'Livret A / LDDS';
      compCagr = '~3.00 %/an';
      compVal = comp.valLivretA;
      compGain = comp.gainLivretA;
      break;
    case 'assurance_vie':
      compName = 'Assurance-Vie UC';
      compCagr = '~4.80 %/an';
      compVal = comp.valAVNet;
      compGain = comp.gainAVNet;
      break;
    case 'cto':
      compName = 'Compte-Titres Ordinaire (CTO)';
      compCagr = '~8.0 %/an (similaire au PEA)';
      compVal = comp.valCTONet;
      compGain = comp.gainCTONet;
      break;
    case 'lep':
      // LEP not previously computed; approximate using same Livret A rate (4.0% net) – placeholder
      compName = "Livret d'Épargne Populaire (LEP)";
      compCagr = '~4.00 %/an';
      // For simplicity, reuse Livret A calculation but with higher rate (4%). Compute on the fly.
      const rLEP = Math.pow(1 + 0.04, 1 / 12) - 1;
      const totalMonths = AppState.durationYears * 12;
      const totalMonthly = AppState.selectedAssets.reduce((s, a) => s + (parseFloat(a.monthlyAmount) || 0), 0);
      const valLEP = totalMonthly * ((Math.pow(1 + rLEP, totalMonths) - 1) / rLEP);
      const gainLEP = Math.max(0, valLEP - totalMonthly * totalMonths);
      compVal = valLEP;
      compGain = gainLEP;
      break;
    case 'per':
      // PER calculation placeholder – assume same net rate 6.5% (no tax on gains)
      compName = 'Plan d’Épargne Retraite (PER)';
      compCagr = '~6.50 %/an';
      const rPER = Math.pow(1 + 0.065, 1 / 12) - 1;
      const totalMonthsPER = AppState.durationYears * 12;
      const totalMonthlyPER = AppState.selectedAssets.reduce((s, a) => s + (parseFloat(a.monthlyAmount) || 0), 0);
      const valPER = totalMonthlyPER * ((Math.pow(1 + rPER, totalMonthsPER) - 1) / rPER);
      const gainPER = Math.max(0, valPER - totalMonthlyPER * totalMonthsPER);
      compVal = valPER;
      compGain = gainPER;
      break;
    default:
      compName = 'Plan inconnu';
      compCagr = '';
      compVal = 0;
      compGain = 0;
  }

  // Update competitor side
  const competitorNameEl = document.getElementById('competitor-name');
  const competitorCagrEl = document.getElementById('competitor-cagr');
  const competitorValEl = document.getElementById('competitor-val');
  const competitorGainEl = document.getElementById('competitor-gain');

  if (competitorNameEl) competitorNameEl.textContent = compName;
  if (competitorCagrEl) competitorCagrEl.textContent = compCagr;
  if (competitorValEl) competitorValEl.textContent = currencyFormatter.format(compVal);
  if (competitorGainEl) competitorGainEl.textContent = `dont +${currencyFormatter.format(compGain)} de gains nets`;

  // Update common details (versements, plafond, fiscalité etc.) – they remain static for now
  const competitorInvestedEl = document.getElementById('competitor-invested');
  const competitorCeilingEl = document.getElementById('competitor-ceiling');
  const competitorTaxEl = document.getElementById('competitor-tax');
  const competitorFeesEl = document.getElementById('competitor-fees');
  const competitorLimitEl = document.getElementById('competitor-limit');
  const totalMonthly = AppState.selectedAssets.reduce((s, a) => s + (parseFloat(a.monthlyAmount) || 0), 0);
  const totalInvested = totalMonthly * AppState.durationYears * 12;
  if (competitorInvestedEl) competitorInvestedEl.textContent = `${currencyFormatter.format(totalMonthly)}/mois (${currencyFormatter.format(totalInvested)} total)`;
  // Keep existing static texts for ceiling, tax, fees, limit – they can be adjusted later per plan if needed.
}

// ============================================================================
// 10. GRAPHIQUE PRÉDICTIF MULTI-COURBES (CHART.JS)
// ============================================================================
function renderPredictionChart(yearlyData) {
  const canvas = document.getElementById('predictionChart');
  if (!canvas) return;

  const labels = yearlyData.map(d => `An ${d.year}`);
  const investedArr = yearlyData.map(d => d.invested);
  const grossArr = yearlyData.map(d => d.gross);
  const netArr = yearlyData.map(d => d.net);

  const isDark = AppState.theme === 'dark';

  const colorInvested = isDark ? '#666666' : '#999999';
  const colorGross = isDark ? '#ffffff' : '#0a0a0a';
  const colorNet = isDark ? '#4ade80' : '#16a34a';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  const textColor = isDark ? '#888888' : '#555555';

  if (AppState.chartInstance) {
    AppState.chartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');

  AppState.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Valeur Brute Totale',
          data: grossArr,
          borderColor: colorGross,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
          borderWidth: 2.5,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: colorGross,
          fill: true
        },
        {
          label: 'Net en Poche (Après taxes)',
          data: netArr,
          borderColor: colorNet,
          backgroundColor: isDark ? 'rgba(74, 222, 128, 0.06)' : 'rgba(22, 163, 74, 0.05)',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: colorNet,
          fill: true
        },
        {
          label: 'Capital Versé (Épargne)',
          data: investedArr,
          borderColor: colorInvested,
          borderDash: [5, 5],
          borderWidth: 1.5,
          tension: 0,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
          titleColor: isDark ? '#ffffff' : '#000000',
          bodyColor: isDark ? '#cccccc' : '#333333',
          borderColor: isDark ? '#333333' : '#d0d0d0',
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          titleFont: { family: "'Space Grotesk', sans-serif", size: 12, weight: 'bold' },
          bodyFont: { family: "'Inter', sans-serif", size: 11 },
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const val = context.parsed.y || 0;
              return ` ${label}: ${currencyFormatter.format(val)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: gridColor,
            drawTicks: false
          },
          ticks: {
            color: textColor,
            font: { family: "'Space Mono', monospace", size: 10 }
          },
          border: {
            color: isDark ? '#262626' : '#dfdfd6'
          }
        },
        y: {
          grid: {
            color: gridColor,
            drawTicks: false
          },
          ticks: {
            color: textColor,
            font: { family: "'Space Mono', monospace", size: 10 },
            callback: function(val) {
              return val >= 1000 ? (val / 1000).toLocaleString('fr-FR') + ' k€' : val + ' €';
            }
          },
          border: {
            color: isDark ? '#262626' : '#dfdfd6'
          }
        }
      }
    }
  });
}
