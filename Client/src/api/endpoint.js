const API_BASE_URL = "http://127.0.0.1:5000";

export const API = {
  account: {
    base: `${API_BASE_URL}/api/account`,
    summary: `${API_BASE_URL}/api/account/summary`,
    currency: `${API_BASE_URL}/api/account/currency`,
  },
  positions: `${API_BASE_URL}/api/positions`,
  assets: `${API_BASE_URL}/api/assets`,
  trackedAssets: `${API_BASE_URL}/api/assets/tracked`,
  toggleAsset: `${API_BASE_URL}/api/assets/toggle`,
  openTrade: `${API_BASE_URL}/api/trade/open`,
  calcTrade: `${API_BASE_URL}/api/trade/calc`,
  portfolio: `${API_BASE_URL}/api/portfolio`,
  news: `${API_BASE_URL}/api/news`,
  history: `${API_BASE_URL}/api/history`,
  closePosition: `${API_BASE_URL}/api/positions/close`,
  closeAllPositions: `${API_BASE_URL}/api/positions/close-all`,
};

export default API;
