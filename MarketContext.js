import React, { createContext, useContext, useState, useCallback } from 'react';

const MarketContext = createContext(null);

export function MarketProvider({
  children,
  initialSymbol = 'XAUUSD',
  initialTimeframe = '15m'
}) {
  const [symbol, setSymbolState] = useState(initialSymbol);
  const [timeframe, setTimeframeState] = useState(initialTimeframe);

  const setSymbol = useCallback((s) => setSymbolState(s), []);
  const setTimeframe = useCallback((t) => setTimeframeState(t), []);

  const value = { symbol, timeframe, setSymbol, setTimeframe };
  return React.createElement(MarketContext.Provider, { value }, children);
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used within MarketProvider');
  return ctx;
}

export default MarketContext;
