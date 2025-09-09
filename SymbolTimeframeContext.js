import React, { createContext, useContext, useState, useCallback } from 'react';

const SymbolTimeframeContext = createContext(null);

export function SymbolTimeframeProvider({
  children,
  initialSymbol = 'XAUUSD',
  initialTimeframe = '15m',
  onChange,
}) {
  const [symbol, setSymbolState] = useState(initialSymbol);
  const [timeframe, setTimeframeState] = useState(initialTimeframe);

  const setSymbol = useCallback(
    (sym) => {
      setSymbolState(sym);
      onChange?.({ symbol: sym, timeframe });
    },
    [onChange, timeframe]
  );

  const setTimeframe = useCallback(
    (tf) => {
      setTimeframeState(tf);
      onChange?.({ symbol, timeframe: tf });
    },
    [onChange, symbol]
  );

  const value = { symbol, timeframe, setSymbol, setTimeframe };
  return React.createElement(
    SymbolTimeframeContext.Provider,
    { value },
    children
  );
}

export function useSymbolTimeframe() {
  const ctx = useContext(SymbolTimeframeContext);
  if (!ctx) {
    throw new Error('useSymbolTimeframe must be used within a SymbolTimeframeProvider');
  }
  return ctx;
}

export default SymbolTimeframeContext;
