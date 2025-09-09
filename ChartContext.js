import React, { createContext, useContext, useState } from "react";
import { mergeActions } from "./chartUtils";

export const ChartContext = createContext({ actions: [], setActions: () => {} });

export function ChartProvider({ children }) {
  const [actions, setActions] = useState([]);
  return (
    <ChartContext.Provider value={{ actions, setActions }}>
      {children}
    </ChartContext.Provider>
  );
}

export function useChart() {
  return useContext(ChartContext);
}

export { mergeActions };
