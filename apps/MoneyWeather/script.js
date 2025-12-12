// Money Weather - Vanilla JS Implementation
// API Endpoints (Netlify Functions)
const API_ENDPOINTS = {
  exchange: '/.netlify/functions/get-exchange',
  oil: '/.netlify/functions/get-oil',
  ecos: '/.netlify/functions/get-ecos',
  reb: '/.netlify/functions/get-reb',
  crypto: '/.netlify/functions/get-crypto',
  metal: '/.netlify/functions/get-metal',
  indices: '/.netlify/functions/get-indices',
  feargreed: '/.netlify/functions/get-feargreed'
};

// State
let assets = [];
let cardOrder = [];
let selectedCategory = 'all';
let selectedWeather = 'all';
let isEditMode = false;
let isDark = false;
let generatedAt = null;
let draggedItem = null;

const CARD_ORDER_KEY = 'moneyweather_card_order';

// Weather icons
const weatherIcons = {
  sunny: '☀️',
  cloudy: '☁️',
  rainy: '🌧️',
  thunder: '⚡'
};

// DOM Elements
const elements = {
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  empty: document.getElementById('empty'),
  cardsGrid: document.getElementById('cards-grid'),
  timestamp: document.getElementById('timestamp'),
  summaryMessage: document.getElementById('summary-message'),
  editModeHint: document.getElementById('edit-mode-hint'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  modalWeatherIcon: document.getElementById('modal-weather-icon'),
  modalPrice: document.getElementById('modal-price'),
  modalBuySell: document.getElementById('modal-buy-sell'),
  modalBuyPrice: document.getElementById('modal-buy-price'),
  modalSellPrice: document.getElementById('modal-sell-price'),
  modalChangeBadge: document.getElementById('modal-change-badge'),
  modalChangePointsBadge: document.getElementById('modal-change-points-badge'),
  modalMessage: document.getElementById('modal-message'),
  modalChart: document.getElementById('modal-chart'),
  modalAdvice: document.getElementById('modal-advice'),
  chartCanvas: document.getElementById('chart-canvas'),
  btnTheme: document.getElementById('btn-theme'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnEditMode: document.getElementById('btn-edit-mode'),
  categoryFilters: document.getElementById('category-filters'),
  weatherFilters: document.getElementById('weather-filters')
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
  loadTheme();
  loadCardOrder();
  setupEventListeners();
  fetchAllData();
  startAutoRefresh();
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
}

function loadCardOrder() {
  const saved = localStorage.getItem(CARD_ORDER_KEY);
  if (saved) {
    try {
      cardOrder = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved card order');
    }
  }
}

function setupEventListeners() {
  // Theme toggle
  elements.btnTheme.addEventListener('click', toggleTheme);
  
  // Refresh button
  elements.btnRefresh.addEventListener('click', handleRefresh);
  
  // Edit mode toggle
  elements.btnEditMode.addEventListener('click', toggleEditMode);
  
  // Category filters
  elements.categoryFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (btn) {
      const category = btn.dataset.category;
      setActiveFilter(elements.categoryFilters, btn);
      selectedCategory = category;
      renderCards();
    }
  });
  
  // Weather filters
  elements.weatherFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (btn) {
      const weather = btn.dataset.weather;
      setActiveFilter(elements.weatherFilters, btn);
      selectedWeather = weather;
      renderCards();
    }
  });
  
  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function setActiveFilter(container, activeBtn) {
  container.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  activeBtn.classList.add('active');
}

function toggleTheme() {
  isDark = !isDark;
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function toggleEditMode() {
  isEditMode = !isEditMode;
  elements.btnEditMode.classList.toggle('active', isEditMode);
  elements.editModeHint.classList.toggle('hidden', !isEditMode);
  renderCards();
}

async function handleRefresh() {
  const icon = elements.btnRefresh.querySelector('.icon');
  icon.classList.add('spin');
  await fetchAllData();
  icon.classList.remove('spin');
}

// Data Fetching
async function fetchAllData() {
  showLoading(true);
  
  try {
    const results = await Promise.allSettled([
      fetchExchangeData(),
      fetchMetalData(),
      fetchOilData(),
      fetchEcosData(),
      fetchRebData(),
      fetchCryptoData(),
      fetchIndicesData(),
      fetchFearGreedData()
    ]);
    
    // Combine all asset data
    assets = [];
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        assets.push(...result.value);
      }
    });
    
    if (assets.length === 0) {
      // Use fallback mock data if all APIs fail
      assets = getMockData();
    }
    
    generatedAt = new Date().toISOString();
    
    // Sort by saved order
    sortAssetsByOrder();
    
    showLoading(false);
    renderCards();
    updateTimestamp();
    updateSummary();
    
  } catch (error) {
    console.error('Failed to fetch data:', error);
    showError(true);
    showLoading(false);
  }
}

async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchExchangeData() {
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.exchange);
    if (!response.ok) return null;
    const data = await response.json();
    return parseExchangeData(data);
  } catch (error) {
    console.log('Exchange API error:', error);
    return getExchangeMockData();
  }
}

async function fetchMetalData() {
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.metal);
    if (!response.ok) return null;
    const data = await response.json();
    return parseMetalData(data);
  } catch (error) {
    console.log('Metal API error:', error);
    return getMetalMockData();
  }
}

async function fetchOilData() {
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.oil);
    if (!response.ok) return null;
    const data = await response.json();
    return parseOilData(data);
  } catch (error) {
    console.log('Oil API error:', error);
    return getOilMockData();
  }
}

async function fetchEcosData() {
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.ecos);
    if (!response.ok) return null;
    const data = await response.json();
    return parseEcosData(data);
  } catch (error) {
    console.log('ECOS API error:', error);
    return getEcosMockData();
  }
}

async function fetchRebData() {
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.reb);
    if (!response.ok) return null;
    const data = await response.json();
    return parseRebData(data);
  } catch (error) {
    console.log('REB API error:', error);
    return getRebMockData();
  }
}

async function fetchCryptoData() {
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.crypto);
    if (!response.ok) return getCryptoMockData();
    const data = await response.json();
    return parseCryptoData(data);
  } catch (error) {
    console.log('Crypto API error:', error);
    return getCryptoMockData();
  }
}

async function fetchIndicesData() {
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.indices);
    if (!response.ok) return getIndicesMockData();
    const data = await response.json();
    return parseIndicesData(data);
  } catch (error) {
    console.log('Indices API error:', error);
    return getIndicesMockData();
  }
}

async function fetchFearGreedData() {
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.feargreed);
    if (!response.ok) return getFearGreedMockData();
    const data = await response.json();
    return parseFearGreedData(data);
  } catch (error) {
    console.log('Fear & Greed API error:', error);
    return getFearGreedMockData();
  }
}

// Data Parsers
function parseExchangeData(data) {
  const assets = [];
  
  if (data.usdkrw) {
    assets.push(createAsset({
      id: 'usdkrw',
      name: '미국 달러 (전일 종가)',
      category: 'currency',
      price: data.usdkrw.rate,
      change: data.usdkrw.change || 0,
      priceDisplay: `${Math.round(data.usdkrw.rate).toLocaleString()} KRW`,
      changePointsDisplay: `${data.usdkrw.change >= 0 ? '+' : ''}${data.usdkrw.changePoints?.toFixed(2) || '0.00'}원`,
      status: getUsdStatus(data.usdkrw.rate),
      message: getUsdMessage(data.usdkrw.rate),
      advice: '달러 환율이 오르면 수입 물가가 올라가고, 해외여행 비용도 비싸져요. 반대로 수출 기업은 유리해요.'
    }));
  }
  
  if (data.jpykrw) {
    assets.push(createAsset({
      id: 'jpykrw',
      name: '일본 엔화',
      category: 'currency',
      price: data.jpykrw.rate,
      change: data.jpykrw.change || 0,
      priceDisplay: `${data.jpykrw.rate.toFixed(2)} /100엔`,
      changePointsDisplay: `${data.jpykrw.change >= 0 ? '+' : ''}${data.jpykrw.changePoints?.toFixed(2) || '0.00'}원`,
      status: getJpyStatus(data.jpykrw.rate),
      message: getJpyMessage(data.jpykrw.rate),
      advice: '일본 여행을 계획 중이라면 엔화가 쌀 때 환전해두세요!'
    }));
  }
  
  if (data.cnykrw) {
    assets.push(createAsset({
      id: 'cnykrw',
      name: '중국 위안화',
      category: 'currency',
      price: data.cnykrw.rate,
      change: data.cnykrw.change || 0,
      priceDisplay: `${data.cnykrw.rate.toFixed(2)} KRW`,
      changePointsDisplay: `${data.cnykrw.change >= 0 ? '+' : ''}${data.cnykrw.changePoints?.toFixed(2) || '0.00'}원`,
      status: getCnyStatus(data.cnykrw.rate),
      message: getCnyMessage(data.cnykrw.rate),
      advice: '중국은 우리나라 최대 무역국이에요. 위안화 환율은 수출입 기업에 큰 영향을 줘요.'
    }));
  }
  
  if (data.eurkrw) {
    assets.push(createAsset({
      id: 'eurkrw',
      name: '유로화',
      category: 'currency',
      price: data.eurkrw.rate,
      change: data.eurkrw.change || 0,
      priceDisplay: `${Math.round(data.eurkrw.rate).toLocaleString()} KRW`,
      changePointsDisplay: `${data.eurkrw.change >= 0 ? '+' : ''}${data.eurkrw.changePoints?.toFixed(2) || '0.00'}원`,
      status: getEurStatus(data.eurkrw.rate),
      message: getEurMessage(data.eurkrw.rate),
      advice: '유럽 여행이나 유럽 제품 구매를 계획 중이라면 유로 환율을 주시하세요!'
    }));
  }
  
  return assets;
}

function parseMetalData(data) {
  const assets = [];
  const krwRate = 1420; // Approximate USD/KRW rate
  
  if (data.gold) {
    const goldPricePerDon = data.gold.price * (3.75 / 31.1035) * krwRate;
    const buyPrice = goldPricePerDon * 1.03;
    const sellPrice = goldPricePerDon * 0.97;
    
    assets.push(createAsset({
      id: 'gold',
      name: '금',
      category: 'commodity',
      price: data.gold.price,
      change: data.gold.change || 0,
      priceDisplay: `${Math.round(goldPricePerDon).toLocaleString()}원/돈`,
      changePointsDisplay: `${data.gold.change >= 0 ? '+' : ''}${Math.round(data.gold.changePoints * (3.75 / 31.1035) * krwRate).toLocaleString()}원`,
      buyPrice: buyPrice,
      buyPriceDisplay: `${Math.round(sellPrice).toLocaleString()}원`,
      sellPrice: sellPrice,
      sellPriceDisplay: `${Math.round(buyPrice).toLocaleString()}원`,
      status: getGoldStatus(data.gold.change),
      message: getGoldMessage(data.gold.change),
      advice: '금은 경제가 불안할 때 가치가 오르는 안전자산이에요. 포트폴리오의 10~15%를 금으로 가져가면 안정적이에요. 한 돈은 3.75g이에요.'
    }));
  }
  
  if (data.silver) {
    const silverPricePerDon = data.silver.price * (3.75 / 31.1035) * krwRate;
    const buyPrice = silverPricePerDon * 1.05;
    const sellPrice = silverPricePerDon * 0.95;
    
    assets.push(createAsset({
      id: 'silver',
      name: '은',
      category: 'commodity',
      price: data.silver.price,
      change: data.silver.change || 0,
      priceDisplay: `${Math.round(silverPricePerDon).toLocaleString()}원/돈`,
      changePointsDisplay: `${data.silver.change >= 0 ? '+' : ''}${Math.round(data.silver.changePoints * (3.75 / 31.1035) * krwRate).toLocaleString()}원`,
      buyPrice: buyPrice,
      buyPriceDisplay: `${Math.round(sellPrice).toLocaleString()}원`,
      sellPrice: sellPrice,
      sellPriceDisplay: `${Math.round(buyPrice).toLocaleString()}원`,
      status: getSilverStatus(data.silver.change),
      message: getSilverMessage(data.silver.change),
      advice: '은은 금보다 변동성이 크지만, 산업용으로도 많이 쓰여서 수요가 꾸준해요. 한 돈은 3.75g이에요.'
    }));
  }
  
  return assets;
}

function parseOilData(data) {
  const assets = [];
  
  if (data.gasoline) {
    assets.push(createAsset({
      id: 'gasoline',
      name: '휘발유',
      category: 'commodity',
      price: data.gasoline.price,
      change: 0,
      priceDisplay: `${Math.round(data.gasoline.price).toLocaleString()}원/L`,
      changePointsDisplay: '+0원',
      status: getGasolineStatus(data.gasoline.price),
      message: getGasolineMessage(data.gasoline.price),
      advice: '기름값이 오를 때는 연비 좋은 운전 습관을 들이세요. 급출발, 급가속을 피하면 연비가 10%까지 좋아져요!'
    }));
  }
  
  if (data.diesel) {
    assets.push(createAsset({
      id: 'diesel',
      name: '경유',
      category: 'commodity',
      price: data.diesel.price,
      change: 0,
      priceDisplay: `${Math.round(data.diesel.price).toLocaleString()}원/L`,
      changePointsDisplay: '+0원',
      status: getDieselStatus(data.diesel.price),
      message: getDieselMessage(data.diesel.price),
      advice: '경유차는 장거리 운전에 유리해요. 출퇴근 거리가 길다면 경유차가 유지비를 절약할 수 있어요.'
    }));
  }
  
  return assets;
}

function parseEcosData(data) {
  const assets = [];
  
  // 한국 기준금리
  if (data.bokRate) {
    assets.push(createAsset({
      id: 'bokrate',
      name: '한국 기준금리',
      category: 'bonds',
      price: data.bokRate.rate,
      change: data.bokRate.change || 0,
      priceDisplay: `${data.bokRate.rate.toFixed(2)}%`,
      changePointsDisplay: `${data.bokRate.change >= 0 ? '+' : ''}${data.bokRate.change.toFixed(2)}%p`,
      status: getBokRateStatus(data.bokRate.change),
      message: getBokRateMessage(data.bokRate.change),
      advice: '한국은행 기준금리는 대출금리와 예금금리에 영향을 줘요. 금리가 오르면 대출 이자가 늘어나고, 예금 이자도 올라요.'
    }));
  }
  
  // 국고채 3년
  if (data.bond3y) {
    assets.push(createAsset({
      id: 'krbond3y',
      name: '국고채 3년',
      category: 'bonds',
      price: data.bond3y.rate,
      change: data.bond3y.change || 0,
      priceDisplay: `${data.bond3y.rate.toFixed(2)}%`,
      changePointsDisplay: `${data.bond3y.change >= 0 ? '+' : ''}${data.bond3y.change.toFixed(2)}%p`,
      status: getBondStatus(data.bond3y.change),
      message: getBond3yMessage(data.bond3y.change),
      advice: '국고채 3년물은 기업들이 돈을 빌릴 때(회사채) 기준이 되는 금리예요. 단기~중기 경제 상황을 반영해요.'
    }));
  }
  
  // 국고채 10년
  if (data.bond10y) {
    assets.push(createAsset({
      id: 'krbond10y',
      name: '국고채 10년',
      category: 'bonds',
      price: data.bond10y.rate,
      change: data.bond10y.change || 0,
      priceDisplay: `${data.bond10y.rate.toFixed(2)}%`,
      changePointsDisplay: `${data.bond10y.change >= 0 ? '+' : ''}${data.bond10y.change.toFixed(2)}%p`,
      status: getBondStatus(data.bond10y.change),
      message: getBond10yMessage(data.bond10y.change),
      advice: '국고채 10년물은 장기적인 경제 성장 전망을 보여줘요. 주택담보대출 금리와도 연관이 있어요.'
    }));
  }
  
  // 장단기 금리차
  if (data.bond3y && data.bond10y) {
    const spread = data.bond10y.rate - data.bond3y.rate;
    const spreadChange = (data.bond10y.change || 0) - (data.bond3y.change || 0);
    
    assets.push(createAsset({
      id: 'yieldspread',
      name: '장단기 금리차',
      category: 'bonds',
      price: spread,
      change: spreadChange,
      priceDisplay: `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%p`,
      changePointsDisplay: `${spreadChange >= 0 ? '+' : ''}${spreadChange.toFixed(2)}%p`,
      status: getYieldSpreadStatus(spread, spreadChange),
      message: getYieldSpreadMessage(spread, spreadChange),
      advice: '10년물 금리 - 3년물 금리 차이예요. 이 차이가 마이너스가 되면(역전되면) 경기 침체가 올 신호라고 해석해요. 아주 고급진 지표랍니다!'
    }));
  }
  
  // 소비자물가지수(CPI)
  if (data.cpi) {
    assets.push(createAsset({
      id: 'cpi',
      name: '소비자물가',
      category: 'index',
      price: data.cpi.value,
      change: data.cpi.change || 0,
      priceDisplay: data.cpi.value.toFixed(1),
      changePointsDisplay: `${data.cpi.change >= 0 ? '+' : ''}${data.cpi.changePoints?.toFixed(2) || '0.00'}`,
      status: getCpiStatus(data.cpi.change),
      message: getCpiMessage(data.cpi.change),
      advice: '"내 월급 빼고 다 오른다"를 숫자로 확인하는 지표예요. 마트에서 사는 물건 가격의 변동을 나타내는 인플레이션 지표입니다.'
    }));
  }
  
  // 생산자물가지수(PPI)
  if (data.ppi) {
    assets.push(createAsset({
      id: 'ppi',
      name: '생산자물가',
      category: 'index',
      price: data.ppi.value,
      change: data.ppi.change || 0,
      priceDisplay: data.ppi.value.toFixed(1),
      changePointsDisplay: `${data.ppi.change >= 0 ? '+' : ''}${data.ppi.changePoints?.toFixed(2) || '0.00'}`,
      status: getPpiStatus(data.ppi.change),
      message: getPpiMessage(data.ppi.change),
      advice: '공장에서 물건을 만들 때 드는 비용이에요. PPI가 오르면 나중에 소비자물가(CPI)도 따라 오를 수 있어요.'
    }));
  }
  
  // 소비자심리지수(CCSI)
  if (data.ccsi) {
    assets.push(createAsset({
      id: 'ccsi',
      name: '소비자심리',
      category: 'index',
      price: data.ccsi.value,
      change: data.ccsi.change || 0,
      priceDisplay: `${Math.round(data.ccsi.value)}점`,
      changePointsDisplay: `${data.ccsi.change >= 0 ? '+' : ''}${data.ccsi.changePoints?.toFixed(2) || '0.00'}`,
      status: getCcsiStatus(data.ccsi.value, data.ccsi.change),
      message: getCcsiMessage(data.ccsi.value),
      advice: '사람들의 마음(심리)을 숫자로 나타낸 거예요. 100 이상이면 "경기가 좋아질 것 같아 지갑을 열자!", 100 미만이면 "먹고살기 힘들어 지갑 닫자"예요. 주식이나 부동산 시장의 선행 지표로 쓰여요.'
    }));
  }
  
  return assets;
}

function parseRebData(data) {
  if (!data.gangnamApt) return getRebMockData();
  
  const price = data.gangnamApt.price;
  const change = data.gangnamApt.change || 0;
  
  return [createAsset({
    id: 'kbrealestate',
    name: '강남 아파트',
    category: 'commodity',
    price: price,
    change: change,
    priceDisplay: `${price.toFixed(1)}억 (30평)`,
    changePointsDisplay: `${change >= 0 ? '+' : ''}${(change * price * 100).toFixed(0)}만원`,
    status: getRealEstateStatus(change),
    message: getRealEstateMessage(change),
    advice: '강남 30평 아파트 평균 시세예요. 서울 아파트 시장의 바로미터로, 전체 부동산 시장의 방향을 가늠할 수 있어요. 금리 인상기에는 집값이 조정되는 경향이 있어요.'
  })];
}

function parseCryptoData(data) {
  const assets = [];
  
  if (data.bitcoin) {
    const btc = data.bitcoin;
    const price = btc.usd || btc.price;
    const change = btc.usd_24h_change || btc.change || 0;
    
    assets.push(createAsset({
      id: 'bitcoin',
      name: '비트코인',
      category: 'crypto',
      price: price,
      change: parseFloat(change.toFixed(2)),
      priceDisplay: `$${Math.round(price).toLocaleString()}`,
      changePointsDisplay: `${change >= 0 ? '+' : ''}$${Math.round(price * change / 100).toLocaleString()}`,
      status: getCryptoStatus(change),
      message: getBitcoinMessage(change),
      advice: '비트코인은 변동성이 매우 커요. 잃어도 괜찮은 금액만 투자하고, 장기 관점으로 바라보세요.'
    }));
  }
  
  if (data.ethereum) {
    const eth = data.ethereum;
    const price = eth.usd || eth.price;
    const change = eth.usd_24h_change || eth.change || 0;
    
    assets.push(createAsset({
      id: 'ethereum',
      name: '이더리움',
      category: 'crypto',
      price: price,
      change: parseFloat(change.toFixed(2)),
      priceDisplay: `$${Math.round(price).toLocaleString()}`,
      changePointsDisplay: `${change >= 0 ? '+' : ''}$${Math.round(price * change / 100).toLocaleString()}`,
      status: getCryptoStatus(change),
      message: getEthereumMessage(change),
      advice: '이더리움은 스마트 컨트랙트 플랫폼이에요. NFT와 DeFi의 기반이 되는 중요한 코인이에요.'
    }));
  }
  
  return assets;
}

function parseIndicesData(data) {
  const assets = [];
  
  if (data.kospi) {
    assets.push(createAsset({
      id: 'kospi',
      name: 'KOSPI',
      category: 'index',
      price: data.kospi.price,
      change: data.kospi.change || 0,
      priceDisplay: `${data.kospi.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} pt`,
      changePointsDisplay: `${data.kospi.change >= 0 ? '+' : ''}${data.kospi.changePoints?.toFixed(2) || '0.00'}pt`,
      status: getIndexStatus(data.kospi.change),
      message: getKospiMessage(data.kospi.change),
      advice: '코스피는 우리나라 대표 주가지수예요. 삼성전자, 현대차 등 대형주가 포함되어 있어요.'
    }));
  }
  
  if (data.kosdaq) {
    assets.push(createAsset({
      id: 'kosdaq',
      name: 'KOSDAQ',
      category: 'index',
      price: data.kosdaq.price,
      change: data.kosdaq.change || 0,
      priceDisplay: `${data.kosdaq.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} pt`,
      changePointsDisplay: `${data.kosdaq.change >= 0 ? '+' : ''}${data.kosdaq.changePoints?.toFixed(2) || '0.00'}pt`,
      status: getIndexStatus(data.kosdaq.change),
      message: getKosdaqMessage(data.kosdaq.change),
      advice: '코스닥은 IT, 바이오 등 성장주가 많은 시장이에요. 변동성이 코스피보다 큰 편이에요.'
    }));
  }
  
  if (data.nasdaq) {
    assets.push(createAsset({
      id: 'nasdaq',
      name: 'NASDAQ',
      category: 'index',
      price: data.nasdaq.price,
      change: data.nasdaq.change || 0,
      priceDisplay: `${data.nasdaq.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} pt`,
      changePointsDisplay: `${data.nasdaq.change >= 0 ? '+' : ''}${data.nasdaq.changePoints?.toFixed(2) || '0.00'}pt`,
      status: getIndexStatus(data.nasdaq.change),
      message: getNasdaqMessage(data.nasdaq.change),
      advice: '나스닥은 미국 기술주 중심 지수예요. 애플, 테슬라, 엔비디아 등이 포함되어 있어요.'
    }));
  }
  
  if (data.sp500) {
    assets.push(createAsset({
      id: 'sp500',
      name: 'S&P 500',
      category: 'index',
      price: data.sp500.price,
      change: data.sp500.change || 0,
      priceDisplay: `${data.sp500.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} pt`,
      changePointsDisplay: `${data.sp500.change >= 0 ? '+' : ''}${data.sp500.changePoints?.toFixed(2) || '0.00'}pt`,
      status: getIndexStatus(data.sp500.change),
      message: getSp500Message(data.sp500.change),
      advice: 'S&P 500은 미국 대형주 500개 기업의 지수예요. 미국 경제를 가장 잘 대표하는 지수예요.'
    }));
  }
  
  if (data.dowjones) {
    assets.push(createAsset({
      id: 'dowjones',
      name: '다우존스',
      category: 'index',
      price: data.dowjones.price,
      change: data.dowjones.change || 0,
      priceDisplay: `${data.dowjones.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} pt`,
      changePointsDisplay: `${data.dowjones.change >= 0 ? '+' : ''}${data.dowjones.changePoints?.toFixed(2) || '0.00'}pt`,
      status: getIndexStatus(data.dowjones.change),
      message: getDowjonesMessage(data.dowjones.change),
      advice: '다우존스는 미국 대표 30개 우량 기업의 지수예요. 역사가 가장 오래된 주가지수예요.'
    }));
  }
  
  if (data.bonds10y) {
    assets.push(createAsset({
      id: 'bonds',
      name: '미국 10년물 국채',
      category: 'bonds',
      price: data.bonds10y.yield,
      change: data.bonds10y.change || 0,
      priceDisplay: `${data.bonds10y.yield.toFixed(2)}%`,
      changePointsDisplay: `${data.bonds10y.change >= 0 ? '+' : ''}${data.bonds10y.change.toFixed(2)}%p`,
      status: getBondStatus(data.bonds10y.change),
      message: getUsBond10yMessage(data.bonds10y.change),
      advice: '미국 10년물 국채 금리는 전 세계 금리의 기준이에요. 금리가 높을 때는 예금과 적금이 유리해요.'
    }));
  }
  
  if (data.bonds2y) {
    assets.push(createAsset({
      id: 'bonds2y',
      name: '미국 2년물 국채',
      category: 'bonds',
      price: data.bonds2y.yield,
      change: data.bonds2y.change || 0,
      priceDisplay: `${data.bonds2y.yield.toFixed(2)}%`,
      changePointsDisplay: `${data.bonds2y.change >= 0 ? '+' : ''}${data.bonds2y.change.toFixed(2)}%p`,
      status: getBondStatus(data.bonds2y.change),
      message: getUsBond2yMessage(data.bonds2y.change),
      advice: '2년물 국채 금리는 연준의 금리 정책 기대를 반영해요. 단기 금리 방향을 알 수 있어요.'
    }));
  }
  
  return assets;
}

function parseFearGreedData(data) {
  if (!data || !data.value) return getFearGreedMockData();
  
  const value = data.value;
  const change = data.change || 0;
  const label = getFearGreedLabel(value);
  
  return [createAsset({
    id: 'feargreed',
    name: '공포탐욕지수',
    category: 'index',
    price: value,
    change: change,
    priceDisplay: `${value}점 (${label})`,
    changePointsDisplay: `${change >= 0 ? '+' : ''}${change}pt`,
    status: getFearGreedStatus(value, change),
    message: getFearGreedMessage(value),
    advice: '0~100 사이 점수로, 25 이하면 극도의 공포, 75 이상이면 극도의 탐욕을 나타내요. 워런 버핏의 "남들이 두려워할 때 탐욕스러워라"를 떠올려보세요!'
  })];
}

function getFearGreedLabel(value) {
  if (value <= 25) return '극도의 공포';
  if (value <= 45) return '공포';
  if (value <= 55) return '중립';
  if (value <= 75) return '탐욕';
  return '극도의 탐욕';
}

function getKospiMessage(change) {
  if (Math.abs(change) > 2) return 'KOSPI 롤러코스터!';
  if (change > 0.5) return 'KOSPI가 상승세입니다!';
  if (change < -0.5) return 'KOSPI가 하락세입니다.';
  return 'KOSPI가 쉬어가는 중이에요.';
}

function getKosdaqMessage(change) {
  if (Math.abs(change) > 2) return 'KOSDAQ 롤러코스터!';
  if (change > 0.5) return 'KOSDAQ이 상승세입니다!';
  if (change < -0.5) return 'KOSDAQ이 하락세입니다.';
  return 'KOSDAQ이 쉬어가는 중이에요.';
}

function getNasdaqMessage(change) {
  if (Math.abs(change) > 2) return 'NASDAQ 롤러코스터!';
  if (change > 0.5) return 'NASDAQ이 상승세입니다!';
  if (change < -0.5) return 'NASDAQ이 하락세입니다.';
  return 'NASDAQ이 쉬어가는 중이에요.';
}

function getSp500Message(change) {
  if (Math.abs(change) > 2) return 'S&P 500 롤러코스터!';
  if (change > 0.5) return 'S&P 500이 상승세입니다!';
  if (change < -0.5) return 'S&P 500이 하락세입니다.';
  return 'S&P 500이 안정적이에요.';
}

function getDowjonesMessage(change) {
  if (Math.abs(change) > 2) return '다우존스 롤러코스터!';
  if (change > 0.5) return '다우존스가 상승세입니다!';
  if (change < -0.5) return '다우존스가 하락세입니다.';
  return '다우존스가 안정적이에요.';
}

function getUsBond10yMessage(change) {
  if (change > 0.1) return '10년물 금리가 올랐어요.';
  if (change < -0.1) return '10년물 금리가 내렸어요.';
  return '10년물 금리가 안정적이에요.';
}

function getUsBond2yMessage(change) {
  if (change > 0.1) return '2년물 금리가 올랐어요.';
  if (change < -0.1) return '2년물 금리가 내렸어요.';
  return '2년물 금리가 안정적이에요.';
}

function getFearGreedMessage(value) {
  if (value <= 25) return '시장이 극도로 두려워하고 있어요!';
  if (value <= 45) return '시장이 불안해하고 있어요.';
  if (value <= 55) return '시장이 중립적이에요.';
  if (value <= 75) return '시장이 탐욕적이에요.';
  return '시장이 극도로 탐욕적이에요!';
}

// Status determination functions
function getUsdStatus(rate) {
  if (rate < 1350) return 'sunny';
  if (rate > 1400) return 'rainy';
  return 'cloudy';
}

function getJpyStatus(rate) {
  if (rate < 900) return 'sunny';
  if (rate > 950) return 'rainy';
  return 'cloudy';
}

function getCnyStatus(rate) {
  if (rate < 200) return 'sunny';
  if (rate > 220) return 'rainy';
  return 'cloudy';
}

function getEurStatus(rate) {
  if (rate < 1550) return 'sunny';
  if (rate > 1700) return 'rainy';
  return 'cloudy';
}

function getGoldStatus(change) {
  if (change > 1) return 'sunny';
  if (change < -1) return 'rainy';
  return 'cloudy';
}

function getSilverStatus(change) {
  if (change > 1.5) return 'sunny';
  if (change < -1.5) return 'rainy';
  return 'cloudy';
}

function getGasolineStatus(price) {
  if (price < 1600) return 'sunny';
  if (price > 1750) return 'rainy';
  return 'cloudy';
}

function getDieselStatus(price) {
  if (price < 1500) return 'sunny';
  if (price > 1650) return 'rainy';
  return 'cloudy';
}

function getBokRateStatus(change) {
  if (Math.abs(change) >= 0.25) return 'thunder';
  if (change > 0) return 'sunny';
  if (change < 0) return 'rainy';
  return 'cloudy';
}

function getBondStatus(change) {
  if (change > 0.1) return 'sunny';
  if (change < -0.1) return 'rainy';
  return 'cloudy';
}

function getYieldSpreadStatus(spread, change) {
  if (spread < 0) return 'thunder';
  if (spread < 0.2) return 'rainy';
  if (change > 0.05) return 'sunny';
  return 'cloudy';
}

function getCpiStatus(change) {
  if (change <= 0) return 'sunny';
  if (change > 0.5) return 'rainy';
  return 'cloudy';
}

function getPpiStatus(change) {
  if (change <= 0) return 'sunny';
  if (change > 0.5) return 'rainy';
  return 'cloudy';
}

function getCcsiStatus(value, change) {
  if (value < 80) return 'thunder';
  if (value >= 100) return 'sunny';
  if (value < 90) return 'rainy';
  return 'cloudy';
}

function getCryptoStatus(change) {
  if (Math.abs(change) > 3) return 'thunder';
  if (change > 1) return 'sunny';
  if (change < -1) return 'rainy';
  return 'cloudy';
}

function getRealEstateStatus(change) {
  if (change > 0.5) return 'sunny';
  if (change < -0.5) return 'rainy';
  return 'cloudy';
}

function getIndexStatus(change) {
  if (Math.abs(change) > 2) return 'thunder';
  if (change > 0.5) return 'sunny';
  if (change < -0.5) return 'rainy';
  return 'cloudy';
}

function getFearGreedStatus(value, change) {
  if (Math.abs(change) >= 15 || value < 30) return 'thunder';
  if (value >= 70) return 'sunny';
  if (value < 50) return 'rainy';
  return 'cloudy';
}

// Message functions
function getUsdMessage(rate) {
  if (rate < 1350) return '달러가 저렴해요! 환전 찬스!';
  if (rate > 1400) return '달러가 비싸요. 해외직구 조심!';
  return '달러가 평균이에요.';
}

function getJpyMessage(rate) {
  if (rate < 900) return '엔화가 저렴해요! 일본 여행 찬스!';
  if (rate > 950) return '엔화가 비싸요.';
  return '엔화가 평균이에요.';
}

function getCnyMessage(rate) {
  if (rate < 200) return '위안화가 저렴해요!';
  if (rate > 220) return '위안화가 비싸요.';
  return '위안화가 평균이에요.';
}

function getEurMessage(rate) {
  if (rate < 1550) return '유로가 저렴해요! 유럽 여행 찬스!';
  if (rate > 1700) return '유로가 비싸요.';
  return '유로가 평균이에요.';
}

function getGoldMessage(change) {
  if (change > 1) return '금값이 올랐어요! 안전자산 인기 상승!';
  if (change < -1) return '금값이 떨어졌어요.';
  return '금값이 안정적이에요.';
}

function getSilverMessage(change) {
  if (change > 1.5) return '은값이 올랐어요!';
  if (change < -1.5) return '은값이 떨어졌어요.';
  return '은값이 안정적이에요.';
}

function getGasolineMessage(price) {
  if (price < 1600) return '휘발유가 저렴해요! 주유 찬스!';
  if (price > 1750) return '휘발유가 비싸요. 대중교통 이용 추천!';
  return '휘발유 가격이 평균이에요.';
}

function getDieselMessage(price) {
  if (price < 1500) return '경유가 저렴해요!';
  if (price > 1650) return '경유가 비싸요.';
  return '경유 가격이 평균이에요.';
}

function getBokRateMessage(change) {
  if (change > 0) return '기준금리가 올랐어요!';
  if (change < 0) return '기준금리가 내렸어요!';
  return '기준금리가 동결됐어요.';
}

function getBond3yMessage(change) {
  if (change > 0.1) return '3년물 금리가 올랐어요.';
  if (change < -0.1) return '3년물 금리가 내렸어요.';
  return '3년물 금리가 안정적이에요.';
}

function getBond10yMessage(change) {
  if (change > 0.1) return '10년물 금리가 올랐어요.';
  if (change < -0.1) return '10년물 금리가 내렸어요.';
  return '10년물 금리가 안정적이에요.';
}

function getYieldSpreadMessage(spread, change) {
  if (spread < 0) return '금리 역전! 경기침체 신호!';
  if (spread < 0.2) return '금리차가 축소되고 있어요.';
  if (change > 0.05) return '금리차가 확대되고 있어요.';
  return '금리차가 안정적이에요.';
}

function getCpiMessage(change) {
  if (change <= 0) return '물가가 안정되고 있어요!';
  if (change > 0.5) return '물가가 오르고 있어요.';
  return '물가가 안정적이에요.';
}

function getPpiMessage(change) {
  if (change <= 0) return '생산 비용이 안정되고 있어요!';
  if (change > 0.5) return '생산 비용이 오르고 있어요.';
  return '생산 비용이 안정적이에요.';
}

function getCcsiMessage(value) {
  if (value >= 100) return '소비자들이 낙관적이에요! 지갑을 열 준비!';
  if (value < 80) return '소비자들이 매우 불안해해요!';
  if (value < 90) return '소비자들이 조심스러워요.';
  return '소비자 심리가 중립적이에요.';
}

function getBitcoinMessage(change) {
  if (Math.abs(change) > 3) return '비트코인 롤러코스터!';
  if (change > 1) return '비트코인이 상승세입니다!';
  if (change < -1) return '비트코인이 하락세입니다.';
  return '비트코인이 조용하네요.';
}

function getEthereumMessage(change) {
  if (Math.abs(change) > 3) return '이더리움 롤러코스터!';
  if (change > 1) return '이더리움이 상승세입니다!';
  if (change < -1) return '이더리움이 하락세입니다.';
  return '이더리움이 조용하네요.';
}

function getRealEstateMessage(change) {
  if (change > 0.5) return '강남 집값이 오르고 있어요!';
  if (change < -0.5) return '강남 집값이 조정 중이에요.';
  return '강남 집값이 안정적이에요.';
}

// Asset helper
function createAsset(data) {
  return {
    id: data.id,
    name: data.name,
    category: data.category,
    price: data.price,
    change: data.change,
    changePoints: data.changePoints || data.price * data.change / 100,
    priceDisplay: data.priceDisplay,
    changePointsDisplay: data.changePointsDisplay,
    buyPrice: data.buyPrice,
    buyPriceDisplay: data.buyPriceDisplay,
    sellPrice: data.sellPrice,
    sellPriceDisplay: data.sellPriceDisplay,
    status: data.status,
    message: data.message,
    advice: data.advice,
    chartData: data.chartData || []
  };
}

// Mock data functions
function getMockData() {
  return [
    ...getExchangeMockData(),
    ...getMetalMockData(),
    ...getOilMockData(),
    ...getEcosMockData(),
    ...getRebMockData(),
    ...getCryptoMockData(),
    ...getIndicesMockData()
  ];
}

function getExchangeMockData() {
  return [
    createAsset({
      id: 'usdkrw', name: '미국 달러 (전일 종가)', category: 'currency',
      price: 1420, change: 0.5, priceDisplay: '1,420 KRW', changePointsDisplay: '+7.10원',
      status: 'cloudy', message: '달러가 평균이에요.',
      advice: '달러 환율이 오르면 수입 물가가 올라가고, 해외여행 비용도 비싸져요.'
    }),
    createAsset({
      id: 'jpykrw', name: '일본 엔화', category: 'currency',
      price: 920, change: -0.3, priceDisplay: '920.00 /100엔', changePointsDisplay: '-2.76원',
      status: 'cloudy', message: '엔화가 평균이에요.',
      advice: '일본 여행을 계획 중이라면 엔화가 쌀 때 환전해두세요!'
    }),
    createAsset({
      id: 'cnykrw', name: '중국 위안화', category: 'currency',
      price: 195, change: 0.2, priceDisplay: '195.00 KRW', changePointsDisplay: '+0.39원',
      status: 'sunny', message: '위안화가 저렴해요!',
      advice: '중국은 우리나라 최대 무역국이에요.'
    }),
    createAsset({
      id: 'eurkrw', name: '유로화', category: 'currency',
      price: 1520, change: -0.1, priceDisplay: '1,520 KRW', changePointsDisplay: '-1.52원',
      status: 'sunny', message: '유로가 저렴해요!',
      advice: '유럽 여행이나 유럽 제품 구매를 계획 중이라면 유로 환율을 주시하세요!'
    })
  ];
}

function getMetalMockData() {
  return [
    createAsset({
      id: 'gold', name: '금', category: 'commodity',
      price: 2650, change: 0.8, priceDisplay: '470,000원/돈', changePointsDisplay: '+3,760원',
      buyPrice: 484100, buyPriceDisplay: '455,900원',
      sellPrice: 455900, sellPriceDisplay: '484,100원',
      status: 'cloudy', message: '금값이 안정적이에요.',
      advice: '금은 경제가 불안할 때 가치가 오르는 안전자산이에요.'
    }),
    createAsset({
      id: 'silver', name: '은', category: 'commodity',
      price: 31, change: 1.2, priceDisplay: '5,500원/돈', changePointsDisplay: '+66원',
      buyPrice: 5775, buyPriceDisplay: '5,225원',
      sellPrice: 5225, sellPriceDisplay: '5,775원',
      status: 'cloudy', message: '은값이 안정적이에요.',
      advice: '은은 금보다 변동성이 크지만, 산업용으로도 많이 쓰여요.'
    })
  ];
}

function getOilMockData() {
  return [
    createAsset({
      id: 'gasoline', name: '휘발유', category: 'commodity',
      price: 1680, change: 0, priceDisplay: '1,680원/L', changePointsDisplay: '+0원',
      status: 'cloudy', message: '휘발유 가격이 평균이에요.',
      advice: '기름값이 오를 때는 연비 좋은 운전 습관을 들이세요.'
    }),
    createAsset({
      id: 'diesel', name: '경유', category: 'commodity',
      price: 1580, change: 0, priceDisplay: '1,580원/L', changePointsDisplay: '+0원',
      status: 'cloudy', message: '경유 가격이 평균이에요.',
      advice: '경유차는 장거리 운전에 유리해요.'
    })
  ];
}

function getEcosMockData() {
  return [
    createAsset({
      id: 'bokrate', name: '한국 기준금리', category: 'bonds',
      price: 3.5, change: 0, priceDisplay: '3.50%', changePointsDisplay: '+0.00%p',
      status: 'cloudy', message: '기준금리가 동결됐어요.',
      advice: '한국은행 기준금리는 대출금리와 예금금리에 영향을 줘요.'
    }),
    createAsset({
      id: 'krbond3y', name: '국고채 3년', category: 'bonds',
      price: 3.2, change: 0.02, priceDisplay: '3.20%', changePointsDisplay: '+0.02%p',
      status: 'cloudy', message: '3년물 금리가 안정적이에요.',
      advice: '국고채 3년물은 기업들이 돈을 빌릴 때 기준이 되는 금리예요.'
    }),
    createAsset({
      id: 'krbond10y', name: '국고채 10년', category: 'bonds',
      price: 3.5, change: 0.03, priceDisplay: '3.50%', changePointsDisplay: '+0.03%p',
      status: 'cloudy', message: '10년물 금리가 안정적이에요.',
      advice: '국고채 10년물은 장기적인 경제 성장 전망을 보여줘요.'
    }),
    createAsset({
      id: 'yieldspread', name: '장단기 금리차', category: 'bonds',
      price: 0.3, change: 0.01, priceDisplay: '+0.30%p', changePointsDisplay: '+0.01%p',
      status: 'cloudy', message: '금리차가 안정적이에요.',
      advice: '10년물 금리 - 3년물 금리 차이예요. 마이너스가 되면 경기 침체 신호!'
    }),
    createAsset({
      id: 'cpi', name: '소비자물가', category: 'index',
      price: 117.2, change: 0.3, priceDisplay: '117.2', changePointsDisplay: '+0.30',
      status: 'cloudy', message: '물가가 안정적이에요.',
      advice: '"내 월급 빼고 다 오른다"를 숫자로 확인하는 지표예요.'
    }),
    createAsset({
      id: 'ppi', name: '생산자물가', category: 'index',
      price: 115.5, change: -0.2, priceDisplay: '115.5', changePointsDisplay: '-0.20',
      status: 'sunny', message: '생산 비용이 안정되고 있어요!',
      advice: '공장에서 물건을 만들 때 드는 비용이에요.'
    }),
    createAsset({
      id: 'ccsi', name: '소비자심리', category: 'index',
      price: 102, change: 1.5, priceDisplay: '102점', changePointsDisplay: '+1.50',
      status: 'sunny', message: '소비자들이 낙관적이에요!',
      advice: '100 이상이면 경기가 좋아질 것 같다는 의미예요.'
    })
  ];
}

function getRebMockData() {
  return [
    createAsset({
      id: 'kbrealestate', name: '강남 아파트', category: 'commodity',
      price: 25, change: 0.2, priceDisplay: '25.0억 (30평)', changePointsDisplay: '+500만원',
      status: 'cloudy', message: '강남 집값이 안정적이에요.',
      advice: '강남 30평 아파트 평균 시세예요.'
    })
  ];
}

function getCryptoMockData() {
  return [
    createAsset({
      id: 'bitcoin', name: '비트코인', category: 'crypto',
      price: 97500, change: 2.1, priceDisplay: '$97,500', changePointsDisplay: '+$2,048',
      status: 'sunny', message: '비트코인이 상승세입니다!',
      advice: '비트코인은 변동성이 매우 커요.'
    }),
    createAsset({
      id: 'ethereum', name: '이더리움', category: 'crypto',
      price: 3400, change: -1.5, priceDisplay: '$3,400', changePointsDisplay: '-$51',
      status: 'rainy', message: '이더리움이 하락세입니다.',
      advice: '이더리움은 스마트 컨트랙트 플랫폼이에요.'
    })
  ];
}

function getIndicesMockData() {
  return [
    createAsset({
      id: 'kospi', name: 'KOSPI', category: 'index',
      price: 2550, change: 0.8, priceDisplay: '2,550.00 pt', changePointsDisplay: '+20.40pt',
      status: 'sunny', message: 'KOSPI가 상승세입니다!',
      advice: '코스피는 우리나라 대표 주가지수예요.'
    }),
    createAsset({
      id: 'kosdaq', name: 'KOSDAQ', category: 'index',
      price: 780, change: -0.3, priceDisplay: '780.00 pt', changePointsDisplay: '-2.34pt',
      status: 'cloudy', message: 'KOSDAQ이 쉬어가는 중이에요.',
      advice: '코스닥은 IT, 바이오 등 성장주가 많은 시장이에요.'
    }),
    createAsset({
      id: 'nasdaq', name: 'NASDAQ', category: 'index',
      price: 19200, change: 1.2, priceDisplay: '19,200.00 pt', changePointsDisplay: '+230.40pt',
      status: 'sunny', message: 'NASDAQ이 상승세입니다!',
      advice: '나스닥은 미국 기술주 중심 지수예요.'
    }),
    createAsset({
      id: 'sp500', name: 'S&P 500', category: 'index',
      price: 5950, change: 0.6, priceDisplay: '5,950.00 pt', changePointsDisplay: '+35.70pt',
      status: 'sunny', message: 'S&P 500이 상승세입니다!',
      advice: 'S&P 500은 미국 대형주 500개 기업의 지수예요.'
    }),
    createAsset({
      id: 'dowjones', name: '다우존스', category: 'index',
      price: 43500, change: 0.4, priceDisplay: '43,500.00 pt', changePointsDisplay: '+174.00pt',
      status: 'cloudy', message: '다우존스가 안정적이에요.',
      advice: '다우존스는 미국 대표 30개 우량 기업의 지수예요.'
    }),
    createAsset({
      id: 'bonds', name: '미국 10년물 국채', category: 'bonds',
      price: 4.25, change: 0.02, priceDisplay: '4.25%', changePointsDisplay: '+0.02%p',
      status: 'cloudy', message: '금리가 안정적이에요.',
      advice: '금리가 높을 때는 예금과 적금이 유리해요.'
    }),
    createAsset({
      id: 'bonds2y', name: '미국 2년물 국채', category: 'bonds',
      price: 4.15, change: -0.01, priceDisplay: '4.15%', changePointsDisplay: '-0.01%p',
      status: 'cloudy', message: '단기 금리가 안정적이에요.',
      advice: '2년물 국채 금리는 연준의 금리 정책 기대를 반영해요.'
    })
  ];
}

function getFearGreedMockData() {
  return [
    createAsset({
      id: 'feargreed', name: '공포탐욕지수', category: 'index',
      price: 65, change: 5, priceDisplay: '65점 (탐욕)', changePointsDisplay: '+5pt',
      status: 'cloudy', message: '시장이 탐욕적이에요.',
      advice: '0~100 사이 점수로, 25 이하면 극도의 공포, 75 이상이면 극도의 탐욕을 나타내요.'
    })
  ];
}

// Sorting
function sortAssetsByOrder() {
  if (cardOrder.length === 0) return;
  
  const orderMap = new Map(cardOrder.map((id, index) => [id, index]));
  assets.sort((a, b) => {
    const orderA = orderMap.get(a.id) ?? 999;
    const orderB = orderMap.get(b.id) ?? 999;
    return orderA - orderB;
  });
}

// UI Rendering
function showLoading(show) {
  elements.loading.classList.toggle('hidden', !show);
  elements.cardsGrid.classList.toggle('hidden', show);
}

function showError(show) {
  elements.error.classList.toggle('hidden', !show);
}

function showEmpty(show) {
  elements.empty.classList.toggle('hidden', !show);
}

function renderCards() {
  const filtered = filterAssets();
  
  if (filtered.length === 0) {
    elements.cardsGrid.classList.add('hidden');
    showEmpty(true);
    return;
  }
  
  showEmpty(false);
  elements.cardsGrid.classList.remove('hidden');
  elements.cardsGrid.innerHTML = '';
  
  filtered.forEach(asset => {
    const card = createCardElement(asset);
    elements.cardsGrid.appendChild(card);
  });
  
  if (isEditMode) {
    setupDragAndDrop();
  }
}

function filterAssets() {
  return assets.filter(asset => {
    const categoryMatch = selectedCategory === 'all' || asset.category === selectedCategory;
    const weatherMatch = selectedWeather === 'all' || asset.status === selectedWeather;
    return categoryMatch && weatherMatch;
  });
}

function createCardElement(asset) {
  const card = document.createElement('div');
  card.className = `weather-card ${asset.status}`;
  card.dataset.id = asset.id;
  card.dataset.testid = `card-asset-${asset.id}`;
  card.draggable = isEditMode;
  
  const isPositive = asset.change >= 0;
  const trendIcon = isPositive ? '↑' : '↓';
  
  let buySellHtml = '';
  if (asset.buyPriceDisplay && asset.sellPriceDisplay) {
    buySellHtml = `
      <div class="card-buy-sell">
        <span>살 때 <span class="buy-price">${asset.sellPriceDisplay}</span></span>
        <span>팔 때 <span class="sell-price">${asset.buyPriceDisplay}</span></span>
      </div>
    `;
  }
  
  let marketStatusHtml = '';
  const marketStatus = getMarketStatusForAsset(asset.id);
  if (marketStatus) {
    const dotHtml = marketStatus.status === 'open' ? '<span class="status-dot"></span>' : '';
    marketStatusHtml = `
      <span class="market-status-badge" style="background-color: ${marketStatus.bgColor}; color: ${marketStatus.textColor};">
        ${dotHtml}${marketStatus.label}
      </span>
    `;
    if (marketStatus.nextOpenIn) {
      marketStatusHtml += `
        <div class="market-countdown">
          <span class="icon-clock">⏰</span>
          ${marketStatus.nextOpenIn}
        </div>
      `;
    }
  }
  
  card.innerHTML = `
    <div class="card-header">
      <div class="card-info">
        <div class="card-name-row">
          <span class="card-name" data-testid="text-asset-name-${asset.id}">${asset.name}</span>
          ${marketStatusHtml}
        </div>
        <div class="card-price" data-testid="text-asset-price-${asset.id}">${asset.priceDisplay}</div>
        ${buySellHtml}
      </div>
      <div class="card-icon">${weatherIcons[asset.status]}</div>
    </div>
    <p class="card-message" data-testid="text-asset-message-${asset.id}">${asset.message}</p>
    <div class="card-badges">
      <span class="badge ${isPositive ? 'positive' : 'negative'}" data-testid="badge-change-${asset.id}">
        ${trendIcon} ${isPositive ? '+' : ''}${asset.change}%
      </span>
      <span class="badge badge-outline ${isPositive ? 'positive' : 'negative'}" data-testid="badge-change-points-${asset.id}">
        ${asset.changePointsDisplay}
      </span>
    </div>
  `;
  
  card.addEventListener('click', () => openModal(asset));
  
  return card;
}

// Market Status
function getMarketStatusForAsset(assetId) {
  if (assetId === 'kospi' || assetId === 'kosdaq') {
    return getKoreanMarketStatus();
  } else if (assetId === 'sp500' || assetId === 'nasdaq' || assetId === 'dowjones') {
    return getUSMarketStatus();
  }
  return null;
}

function getKoreanMarketStatus() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kstDate = new Date(utc + (9 * 3600000));
  
  const day = kstDate.getDay();
  const hours = kstDate.getHours();
  const minutes = kstDate.getMinutes();
  const currentTime = hours * 60 + minutes;
  
  const isWeekend = day === 0 || day === 6;
  const preMarketStart = 8 * 60;
  const marketOpen = 9 * 60;
  const marketClose = 15 * 60 + 30;
  
  if (!isWeekend && currentTime >= marketOpen && currentTime < marketClose) {
    return {
      status: 'open',
      label: '장 중',
      bgColor: 'var(--green-bg)',
      textColor: 'var(--green-color)'
    };
  }
  
  if (!isWeekend && currentTime >= preMarketStart && currentTime < marketOpen) {
    const msUntilOpen = (marketOpen - currentTime) * 60 * 1000;
    return {
      status: 'premarket',
      label: '장 전',
      nextOpenIn: formatTimeRemaining(msUntilOpen),
      bgColor: '#fef3c7',
      textColor: '#92400e'
    };
  }
  
  // Calculate next open
  let nextOpen = new Date(kstDate);
  if (!isWeekend && currentTime >= marketClose) {
    nextOpen.setDate(nextOpen.getDate() + 1);
  }
  nextOpen.setHours(9, 0, 0, 0);
  
  while (nextOpen.getDay() === 0 || nextOpen.getDay() === 6) {
    nextOpen.setDate(nextOpen.getDate() + 1);
  }
  
  const msUntilOpen = nextOpen.getTime() - kstDate.getTime();
  
  return {
    status: 'closed',
    label: '장 마감',
    nextOpenIn: formatTimeRemaining(msUntilOpen),
    bgColor: 'var(--muted)',
    textColor: 'var(--muted-foreground)'
  };
}

function getUSMarketStatus() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const estOffset = -5 * 3600000;
  const estDate = new Date(utc + estOffset);
  
  const estDay = estDate.getDay();
  const estHours = estDate.getHours();
  const estMinutes = estDate.getMinutes();
  const estTime = estHours * 60 + estMinutes;
  
  const preMarketStart = 4 * 60;
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  const afterHoursEnd = 20 * 60;
  
  const isWeekend = estDay === 0 || estDay === 6;
  
  if (isWeekend) {
    const daysUntilMonday = estDay === 0 ? 1 : 2;
    const nextOpen = new Date(estDate);
    nextOpen.setDate(nextOpen.getDate() + daysUntilMonday);
    nextOpen.setHours(9, 30, 0, 0);
    
    const msUntilOpen = nextOpen.getTime() - estDate.getTime();
    
    return {
      status: 'closed',
      label: '장 마감',
      nextOpenIn: formatTimeRemaining(msUntilOpen),
      bgColor: 'var(--muted)',
      textColor: 'var(--muted-foreground)'
    };
  }
  
  if (estTime >= marketOpen && estTime < marketClose) {
    return {
      status: 'open',
      label: '장 중',
      bgColor: 'var(--green-bg)',
      textColor: 'var(--green-color)'
    };
  }
  
  if (estTime >= marketClose && estTime < afterHoursEnd) {
    return {
      status: 'afterhours',
      label: '애프터마켓',
      bgColor: '#dbeafe',
      textColor: '#1e40af'
    };
  }
  
  if (estTime >= preMarketStart && estTime < marketOpen) {
    const msUntilOpen = (marketOpen - estTime) * 60 * 1000;
    return {
      status: 'premarket',
      label: '프리마켓',
      nextOpenIn: formatTimeRemaining(msUntilOpen),
      bgColor: '#fef3c7',
      textColor: '#92400e'
    };
  }
  
  const nextOpen = new Date(estDate);
  if (estTime >= afterHoursEnd) {
    nextOpen.setDate(nextOpen.getDate() + 1);
  }
  
  if (nextOpen.getDay() === 6) {
    nextOpen.setDate(nextOpen.getDate() + 2);
  } else if (nextOpen.getDay() === 0) {
    nextOpen.setDate(nextOpen.getDate() + 1);
  }
  
  nextOpen.setHours(9, 30, 0, 0);
  const msUntilOpen = nextOpen.getTime() - estDate.getTime();
  
  return {
    status: 'closed',
    label: '장 마감',
    nextOpenIn: formatTimeRemaining(msUntilOpen),
    bgColor: 'var(--muted)',
    textColor: 'var(--muted-foreground)'
  };
}

function formatTimeRemaining(ms) {
  if (ms <= 0) return '';
  
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}시간 ${minutes}분 후 개장`;
  }
  return `${minutes}분 후 개장`;
}

// Timestamp
function updateTimestamp() {
  if (!generatedAt) return;
  
  const time = formatTime(generatedAt);
  const ago = formatTimeAgo(generatedAt);
  
  elements.timestamp.innerHTML = `
    <span class="icon-clock">⏰</span>
    <span>${time} 기준 (${ago})</span>
  `;
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  });
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 10) return '방금 전';
  if (diffSec < 60) return `${diffSec}초 전`;
  
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  
  return date.toLocaleDateString('ko-KR');
}

// Summary
function updateSummary() {
  if (assets.length === 0) {
    elements.summaryMessage.textContent = '';
    return;
  }
  
  const sunnyCount = assets.filter(a => a.status === 'sunny').length;
  const thunderCount = assets.filter(a => a.status === 'thunder').length;
  
  let message = '';
  if (thunderCount >= 2) {
    message = '오늘은 시장이 불안정해요. 신중하게 결정하세요!';
  } else if (sunnyCount >= 3) {
    message = '오늘은 좋은 날이에요! 투자하기 괜찮은 분위기네요.';
  } else if (sunnyCount === 0) {
    message = '오늘은 조용히 관망하는 게 좋겠어요.';
  } else {
    message = '시장이 혼조세예요. 관심 있는 자산을 살펴보세요!';
  }
  
  elements.summaryMessage.textContent = message;
}

// Modal
function openModal(asset) {
  elements.modalTitle.textContent = asset.name;
  elements.modalWeatherIcon.textContent = weatherIcons[asset.status];
  elements.modalPrice.textContent = asset.priceDisplay;
  elements.modalMessage.textContent = asset.message;
  elements.modalAdvice.textContent = asset.advice;
  
  const isPositive = asset.change >= 0;
  const trendIcon = isPositive ? '↑' : '↓';
  
  elements.modalChangeBadge.textContent = `${trendIcon} ${isPositive ? '+' : ''}${asset.change}%`;
  elements.modalChangeBadge.className = `badge ${isPositive ? 'positive' : 'negative'}`;
  
  elements.modalChangePointsBadge.textContent = asset.changePointsDisplay;
  elements.modalChangePointsBadge.className = `badge badge-outline ${isPositive ? 'positive' : 'negative'}`;
  
  // Buy/Sell prices
  if (asset.buyPriceDisplay && asset.sellPriceDisplay) {
    elements.modalBuySell.classList.remove('hidden');
    elements.modalBuyPrice.innerHTML = `살 때 <span class="buy-price">${asset.sellPriceDisplay}</span>`;
    elements.modalSellPrice.innerHTML = `팔 때 <span class="sell-price">${asset.buyPriceDisplay}</span>`;
  } else {
    elements.modalBuySell.classList.add('hidden');
  }
  
  // Chart
  if (asset.chartData && asset.chartData.length > 0) {
    elements.modalChart.classList.remove('hidden');
    renderChart(asset.chartData, isPositive);
  } else {
    elements.modalChart.classList.add('hidden');
  }
  
  elements.modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  elements.modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function renderChart(data, isPositive) {
  const canvas = elements.chartCanvas;
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = 160;
  
  const padding = { top: 10, right: 10, bottom: 30, left: 60 };
  const width = canvas.width - padding.left - padding.right;
  const height = canvas.height - padding.top - padding.bottom;
  
  // Get min/max values
  const prices = data.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw line
  ctx.beginPath();
  ctx.strokeStyle = isPositive ? '#22c55e' : '#ef4444';
  ctx.lineWidth = 2;
  
  data.forEach((point, index) => {
    const x = padding.left + (index / (data.length - 1)) * width;
    const y = padding.top + height - ((point.price - minPrice) / priceRange) * height;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  
  // Draw Y-axis labels
  ctx.fillStyle = isDark ? '#a3a3a3' : '#737373';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  
  const yLabels = 5;
  for (let i = 0; i <= yLabels; i++) {
    const value = minPrice + (priceRange * i / yLabels);
    const y = padding.top + height - (i / yLabels * height);
    ctx.fillText(value.toLocaleString(undefined, { maximumFractionDigits: 2 }), padding.left - 5, y + 3);
  }
  
  // Draw X-axis labels (first and last)
  ctx.textAlign = 'center';
  if (data.length > 0) {
    ctx.fillText(data[0].time, padding.left, canvas.height - 5);
    ctx.fillText(data[data.length - 1].time, canvas.width - padding.right, canvas.height - 5);
  }
}

// Drag and Drop
function setupDragAndDrop() {
  const cards = elements.cardsGrid.querySelectorAll('.weather-card');
  
  cards.forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragenter', handleDragEnter);
    card.addEventListener('dragleave', handleDragLeave);
  });
}

function handleDragStart(e) {
  draggedItem = e.target;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', e.target.dataset.id);
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  elements.cardsGrid.querySelectorAll('.weather-card').forEach(card => {
    card.classList.remove('drag-over');
  });
  draggedItem = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  if (e.target.classList.contains('weather-card') && e.target !== draggedItem) {
    e.target.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  e.target.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  e.target.classList.remove('drag-over');
  
  const dropTarget = e.target.closest('.weather-card');
  if (!dropTarget || dropTarget === draggedItem) return;
  
  const draggedId = draggedItem.dataset.id;
  const droppedId = dropTarget.dataset.id;
  
  const draggedIndex = assets.findIndex(a => a.id === draggedId);
  const droppedIndex = assets.findIndex(a => a.id === droppedId);
  
  if (draggedIndex !== -1 && droppedIndex !== -1) {
    // Swap positions
    const [removed] = assets.splice(draggedIndex, 1);
    assets.splice(droppedIndex, 0, removed);
    
    // Update card order
    cardOrder = assets.map(a => a.id);
    localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(cardOrder));
    
    // Re-render
    renderCards();
  }
}

// Auto Refresh
function startAutoRefresh() {
  // Update timestamp every second
  setInterval(() => {
    updateTimestamp();
  }, 1000);
  
  // Refresh data every 30 seconds (unless in edit mode)
  setInterval(() => {
    if (!isEditMode) {
      fetchAllData();
    }
  }, 30000);
}
