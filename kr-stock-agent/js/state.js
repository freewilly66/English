export const state = {
  portfolio: { positions: [], trades: [] },
  discoveries: { ultra: [], short: [], long: [], debate: null },
  _CARD_STORE: [],
  scanning: false,
  stopReq: false,
  currentBuyStock: null,
  currentSellPosId: null,
  currentDetailPosId: null,
  sellTypeMode: 'partial',
  selectedGrp: 'ultra',
  dashPeriod: 'monthly',
  dashYear: new Date().getFullYear(),
  dashChart: null,
  dashAllocChart: null,
  currentPrices: {},
  isLoadingPrices: false
};

