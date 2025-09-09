
// ==============================
// components/LightweightPriceChart.js
// Client-only chart. Fetches /functions/getBars for history,
// then live-updates the running candle every few seconds.
// Keeps AI overlays + "Reset View" button.
// ==============================

"use client";
import React, { useEffect, useMemo, useRef } from "react";

/* ---------- Browser-safe history fetch ---------- */
async function getBarsClient({ symbol, timeframe, debug }) {
  const payload = { symbol, timeframe, debug };
  const endpoints = ["/functions/getBars", "/api/functions/getBars"];
  try {
    const metaId = document.querySelector('meta[name="x-base44-app-id"]')?.content;
    const appId = window.__B44_APP_ID__ || metaId;
    if (appId) endpoints.push(`/api/apps/${appId}/functions/getBars`);
  } catch {}
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) continue;
      const j = await r.json().catch(() => null);
      if (j) return j;
    } catch {}
  }
  return { success: false, error: "Unable to reach /functions/getBars" };
}

/* ---------- Optional live last-candle endpoint ---------- */
async function fetchLastCandleClient({ symbol, timeframe }) {
  try {
    const r = await fetch("/functions/fetchLastCandle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, timeframe }),
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j?.candle || null; // { time, open, high, low, close }
  } catch {
    return null;
  }
}

/* ---------- Fallback: your existing price-only endpoint ---------- */
async function fetchLastPriceFallback(symbol) {
  try {
    const r = await fetch("/functions/updatePriceData", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: [String(symbol).toUpperCase()] }),
    });
    const j = await r.json();
    const p = Number(j?.data?.prices?.[0]?.price ?? j?.prices?.[0]?.price);
    return Number.isFinite(p) ? p : null;
  } catch {
    return null;
  }
}

const DEFAULT_WATERMARK = "";

/* ---------- Load Lightweight-Charts (browser) ---------- */
function loadLW() {
  return new Promise((resolve, reject) => {
    if (window.LightweightCharts) return resolve();
    const s = document.createElement("script");
    s.src =
      "https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("LightweightCharts load failed"));
    document.head.appendChild(s);
  });
}

/* ---------- (stub) Trading sessions overlay (keep API) ---------- */
function addTradingSessionsOverlay() {
  return { dispose() {} };
}

/* ---------- i18n & helpers (unchanged) ---------- */
const hasArabic = (s) => /[\u0600-\u06FF]/.test(String(s || ""));
const detectLocale = () => {
  const lang = (document.documentElement.lang || "").toLowerCase();
  if (lang.startsWith("ar") || document.documentElement.dir === "rtl") return "ar";
  return "en";
};
const i18n = (kind, locale) => {
  if (locale === "ar") {
    switch (kind) {
      case "ENTRY":
        return "الدخول";
      case "SL":
        return "وقف الخسارة";
      case "TP":
        return "الهدف";
      case "TP1":
        return "الهدف 1";
      case "TP2":
        return "الهدف 2";
      case "RESISTANCE":
        return "مقاومة";
      case "SUPPORT":
        return "دعم";
    }
  }
  return kind;
};
const COLORS = {
  ENTRY: "#3b82f6",
  TP: "#22c55e",
  TP1: "#22c55e",
  TP2: "#22c55e",
  SL: "#ef4444",
  RESISTANCE: "#a5b4fc",
  SUPPORT: "#94a3b8",
};
function canonKind(labelRaw) {
  const L = String(labelRaw || "").toUpperCase();
  if (L.includes("SL") || L.includes("STOP")) return "SL";
  if (L.includes("TP2")) return "TP2";
  if (L.includes("TP1")) return "TP1";
  if (L.includes("TP")) return "TP";
  if (L.includes("ENTRY")) return "ENTRY";
  if (L.includes("RES")) return "RESISTANCE";
  if (L.includes("SUP")) return "SUPPORT";
  const raw = String(labelRaw || "");
  if (hasArabic(raw)) {
    if (/وقف/.test(raw)) return "SL";
    if (/هدف\s*2/.test(raw)) return "TP2";
    if (/هدف\s*1/.test(raw)) return "TP1";
    if (/هدف/.test(raw)) return "TP";
    if (/دخول/.test(raw)) return "ENTRY";
    if (/مقاوم/.test(raw)) return "RESISTANCE";
    if (/دعم/.test(raw)) return "SUPPORT";
  }
  return "ENTRY";
}

/* ---------- timeframe → seconds ---------- */
function tfToSec(tf) {
  const t = String(tf || "").toLowerCase();
  if (t === "1m") return 60;
  if (t === "5m") return 300;
  if (t === "15m") return 900;
  if (t === "1h") return 3600;
  if (t === "4h") return 14400;
  if (t === "1d") return 86400;
  // legacy support
  if (t === "15min" || t === "15") return 900;
  return 3600; // default 1h
}

export default function LightweightPriceChart({
  symbol = "BTCUSD",
  timeframe = "1h", // "1m" | "5m" | "15m" | "1h" | "4h" | "1d"
  actions = [], // [{type:'hline', price, label}]
  onPriceUpdate,
  watermarkSrc = DEFAULT_WATERMARK,
  locale = "auto",
  showResetViewButton = true,
  decimals = 2,           // <<--- NEW
  apiKey = process.env.NEXT_PUBLIC_EODHD_API_KEY,
}) {

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const barsRef = useRef([]);
  const hlinesRef = useRef([]);
  const tagLayerRef = useRef(null);
  const priceLabelRef = useRef(null);
  const inFlightRef = useRef(false);
  const refreshTimerRef = useRef(null);
  const tickTimerRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const sessionsOverlayRef = useRef(null);
  const initializedRef = useRef(false);

  const defaultBarSpacingRef = useRef(9);
  const defaultRightOffsetRef = useRef(6);

  // refresh full history every ~4.5 min; tick every 2.5s
  const REFRESH_MS = 4 * 60 * 1000 + 30 * 1000;
  const TICK_MS = 2500;

  function broadcast(type, payload) {
    try {
      window.dispatchEvent(new CustomEvent("chart:" + type, { detail: payload }));
    } catch {}
  }

  function mergeTick(price, epochSec) {
    const list = barsRef.current.slice();
    const tail = list[list.length - 1];
    const step = tfToSec(timeframe);
    const bucket = Math.floor(epochSec / step) * step;
    if (!tail || tail.time < bucket) {
      list.push({ time: bucket, open: price, high: price, low: price, close: price, volume: 0 });
    } else {
      const b = { ...tail };
      b.high = Math.max(b.high, price);
      b.low = Math.min(b.low, price);
      b.close = price;
      list[list.length - 1] = b;
    }
    barsRef.current = list;
    seriesRef.current?.setData(list);
    renderTags();
    if (priceLabelRef.current) priceLabelRef.current.textContent = price.toFixed(decimals);
    onPriceUpdate?.(price);
  }

  function connectWS() {
    if (wsRef.current || !apiKey || typeof WebSocket === "undefined") {
      startPolling();
      return;
    }
    const feed = symbol.includes(".") ? "us" : "forex";
    const url = `wss://ws.eodhistoricaldata.com/ws/${feed}?api_token=${encodeURIComponent(apiKey)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      stopPolling();
      try {
        ws.send(JSON.stringify({ action: "subscribe", symbols: symbol }));
      } catch {}
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        const price = Number(data.p ?? data.price ?? data.close);
        const ts = Number(data.t ?? data.timestamp ?? Date.now() / 1000);
        if (!Number.isFinite(price)) return;
        mergeTick(price, Math.floor(ts));
        broadcast("tick", { symbol, price, time: ts });
      } catch {}
    };

    const onDead = () => {
      wsRef.current = null;
      startPolling();
      if (initializedRef.current) scheduleReconnect();
    };
    ws.onclose = onDead;
    ws.onerror = onDead;
  }

  function scheduleReconnect() {
    const attempt = (reconnectAttemptsRef.current += 1);
    const delay = Math.min(30000, 1000 * 2 ** (attempt - 1));
    reconnectTimerRef.current = setTimeout(connectWS, delay);
  }

  function stopWS() {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  }

  function startPolling() {
    if (!tickTimerRef.current) {
      tickTimerRef.current = setInterval(patchWithTick, TICK_MS);
    }
  }

  function stopPolling() {
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }

  const palette = useMemo(
    () => ({
      up: "#16a34a",
      down: "#ef4444",
      wick: "rgba(200,205,210,.45)",
      grid: "rgba(255,255,255,0.06)",
      text: "#e5e7eb",
      bg: "#111111",
    }),
    []
  );

  /* --------- Init chart --------- */
  useEffect(() => {
    let disposed = false;
    (async () => {
      await loadLW();
      if (disposed) return;
      const { createChart, CrosshairMode } = window.LightweightCharts;

      const chart = createChart(containerRef.current, {
        autoSize: true,
        layout: {
          background: { color: palette.bg },
          textColor: palette.text,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: palette.grid },
          horzLines: { color: palette.grid },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: palette.grid },
        timeScale: {
          rightOffset: defaultRightOffsetRef.current,
          borderColor: palette.grid,
          barSpacing: defaultBarSpacingRef.current,
        },
      });

      const series = chart.addCandlestickSeries({
        upColor: palette.up,
        downColor: palette.down,
        borderUpColor: palette.up,
        borderDownColor: palette.down,
        wickUpColor: palette.wick,
        wickDownColor: palette.wick,
      });

      const tagLayer = document.createElement("div");
      Object.assign(tagLayer.style, {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
      });
      containerRef.current.appendChild(tagLayer);
      tagLayerRef.current = tagLayer;

      sessionsOverlayRef.current = addTradingSessionsOverlay(chart, containerRef.current);
      chartRef.current = chart;
      seriesRef.current = series;
      initializedRef.current = true;

      try {
        await fullRefresh();
      } catch {}
      startLoops();
    })().catch((e) => console.error("Chart init error:", e));

    return () => {
      disposed = true;
      initializedRef.current = false;
      stopLoops();
      try {
        sessionsOverlayRef.current?.dispose?.();
      } catch {}
      try {
        chartRef.current?.remove?.();
      } catch {}
      if (tagLayerRef.current && containerRef.current?.contains(tagLayerRef.current)) {
        try {
          containerRef.current.removeChild(tagLayerRef.current);
        } catch {}
      }
      chartRef.current = null;
      seriesRef.current = null;
      barsRef.current = [];
      hlinesRef.current = [];
      tagLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initializedRef.current) {
      fullRefresh().catch(() => {});
      restartLoops();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe]);

  useEffect(() => {
    if (initializedRef.current) applyActions(actions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(actions)]);

  function startLoops() {
    stopLoops();
    if (initializedRef.current) {
      refreshTimerRef.current = setInterval(() => fullRefresh().catch(() => {}), REFRESH_MS);
      connectWS();
      startPolling(); // fallback until WS connects
    }
  }
  function stopLoops() {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    stopPolling();
    stopWS();
  }
  function restartLoops() {
    stopLoops();
    startLoops();
  }

  /* --------- Helpers --------- */
  function sanitize(bars) {
    const ok = [],
      seen = new Set();
    for (const b of Array.isArray(bars) ? bars : []) {
      const { time, open, high, low, close } = b || {};
      if (![time, open, high, low, close].every(Number.isFinite)) continue;
      if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue;
      if (high < Math.max(open, close)) continue;
      if (low > Math.min(open, close)) continue;
      if (seen.has(time)) continue;
      seen.add(time);
      ok.push(b);
    }
    return ok;
  }

  /* --------- Load full history --------- */
  async function fullRefresh() {
    if (!chartRef.current || !seriesRef.current || !symbol || !initializedRef.current) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const r = await getBarsClient({ symbol, timeframe });
      const ok = !!(r && r.success !== false);
      const raw = ok
        ? Array.isArray(r?.data?.bars)
          ? r.data.bars
          : Array.isArray(r?.bars)
          ? r.bars
          : Array.isArray(r?.data)
          ? r.data
          : []
        : [];
      const data = sanitize(raw);
      if (data.length && seriesRef.current) {
        barsRef.current = data;
        seriesRef.current.setData(data);
        snapToLast();
        const last = data[data.length - 1];
        if (Number.isFinite(last?.close)) {
          onPriceUpdate?.(+last.close);
if (priceLabelRef.current) priceLabelRef.current.textContent = (+last.close).toFixed(decimals);
        }
      } else {
        barsRef.current = [];
        try {
          seriesRef.current?.setData([]);
        } catch {}
      }
      applyActions(actions);
    } finally {
      inFlightRef.current = false;
      renderTags();
    }
  }

  /* --------- Live tick merge (bar-level or price fallback) --------- */
  async function patchWithTick() {
    if (!seriesRef.current || !barsRef.current.length || !initializedRef.current) return;

    // 1) Prefer a last-candle API (open/high/low/close)
    const lastBar = await fetchLastCandleClient({ symbol, timeframe });

    if (lastBar && [lastBar.open, lastBar.high, lastBar.low, lastBar.close, lastBar.time].every(Number.isFinite)) {
      const tfSec = tfToSec(timeframe);
      const list = barsRef.current.slice();
      const tail = list[list.length - 1];

      const lastBucket = Math.floor(Number(tail.time) / tfSec);
      const incBucket = Math.floor(Number(lastBar.time) / tfSec);

      if (!tail || incBucket > lastBucket) {
        // new bar
        list.push({
          time: Number(lastBar.time),
          open: +lastBar.open,
          high: +lastBar.high,
          low: +lastBar.low,
          close: +lastBar.close,
          volume: 0,
        });
      } else {
        // update running bar
        const b = { ...tail };
        b.high = Math.max(b.high, +lastBar.high);
        b.low = Math.min(b.low, +lastBar.low);
        b.close = +lastBar.close;
        list[list.length - 1] = b;
      }
      barsRef.current = list;
      seriesRef.current.setData(list);
      renderTags();
      onPriceUpdate?.(+lastBar.close);
if (priceLabelRef.current) priceLabelRef.current.textContent = (+lastBar.close).toFixed(decimals);
      broadcast("tick", { symbol, price: +lastBar.close, time: Number(lastBar.time) });
      return;
    }

    // 2) Fallback to your price-only endpoint (kept from your original file)
    try {
      const price = await fetchLastPriceFallback(symbol);
      if (!Number.isFinite(price)) return;

      const list = barsRef.current.slice();
      const tail = list[list.length - 1];
      if (!tail || !Number.isFinite(tail.close)) return;

      // safety check (ignore crazy spikes)
      if (Math.abs(price / tail.close - 1) > 0.1) return;

      const step = tfToSec(timeframe);
      const now = Math.floor(Date.now() / 1000);
      const bucket = Math.floor(now / step) * step;

      if (!tail || tail.time < bucket) {
        list.push({ time: bucket, open: price, high: price, low: price, close: price, volume: 0 });
      } else {
        const b = { ...tail };
        b.high = Math.max(b.high, price);
        b.low = Math.min(b.low, price);
        b.close = price;
        list[list.length - 1] = b;
      }

      barsRef.current = list;
      seriesRef.current?.setData(list);
      renderTags();
if (priceLabelRef.current) priceLabelRef.current.textContent = price.toFixed(decimals);
      onPriceUpdate?.(price);
      broadcast("tick", { symbol, price, time: now });
    } catch {}
  }

  /* --------- Overlays & tags (unchanged) --------- */
  function clearH() {
    if (!chartRef.current) return;
    for (const s of hlinesRef.current) {
      try {
        chartRef.current.removeSeries(s.series);
      } catch {}
    }
    hlinesRef.current = [];
    if (tagLayerRef.current) tagLayerRef.current.innerHTML = "";
  }

  function pill(text, color, rtl) {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = [
      "position:absolute",
      "right:8px",
      "transform:translateY(-50%)",
      "padding:2px 6px",
      "border-radius:999px",
      "font:10px/1 system-ui",
      "background:rgba(17,24,39,.92)",
      "border:1px solid rgba(255,255,255,.10)",
      "color:#e5e7eb",
      "box-shadow:0 1px 2px rgba(0,0,0,.35)",
      "white-space:nowrap",
      "z-index:6",
    ].join(";");
    if (color) el.style.borderColor = color;
    el.style.direction = rtl ? "rtl" : "ltr";
    const connector = document.createElement("span");
    Object.assign(connector.style, {
      position: "absolute",
      right: "100%",
      top: "50%",
      width: "12px",
      height: "1.5px",
      background: color || "#94a3b8",
      transform: "translateY(-50%)",
      opacity: 0.95,
      borderRadius: "1px",
    });
    el.appendChild(connector);
    return el;
  }

  function renderTags() {
    if (!chartRef.current || !seriesRef.current || !tagLayerRef.current || !initializedRef.current) return;
    tagLayerRef.current.innerHTML = "";
    const rtl = (locale === "auto" ? detectLocale() : locale) === "ar";
    const priceToY = (p) => seriesRef.current.priceToCoordinate(p);
    for (const h of hlinesRef.current) {
      const y = priceToY(h.price);
      if (y == null) continue;
      const label = i18n(h.kind, rtl ? "ar" : "en");
      const el = pill(label, h.color, rtl);
      el.style.top = `${y}px`;
      tagLayerRef.current.appendChild(el);
    }
  }

  function applyActions(list) {
    if (!chartRef.current || !Array.isArray(list) || !barsRef.current.length || !initializedRef.current) return;
    clearH();
    const firstT = barsRef.current[0]?.time;
    const lastT = barsRef.current[barsRef.current.length - 1]?.time;
    if (!firstT || !lastT) return;

    const LW = window.LightweightCharts;
    const Dashed = LW?.LineStyle?.Dashed ?? 2;
    const Solid = LW?.LineStyle?.Solid ?? 0;

    for (const a of list) {
      try {
        if (a?.type !== "hline" || !Number(a?.price)) continue;
        const price = Number(a.price);
        if (!isFinite(price)) continue;
        const kind = canonKind(a.label);
        let color = COLORS[kind] || "#3b82f6";
        let style = kind === "SL" ? Dashed : Solid;
        const ls = chartRef.current.addLineSeries({
          color,
          lineWidth: 1.8,
          lineStyle: style,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        ls.setData([
          { time: firstT, value: price },
          { time: lastT, value: price },
        ]);
        hlinesRef.current.push({ series: ls, price, kind, color });
      } catch {}
    }
    renderTags();
    broadcast("draw", list);

    if (chartRef.current) {
      const rerender = () => renderTags();
      chartRef.current.timeScale().subscribeVisibleTimeRangeChange(rerender);
      const ro = new ResizeObserver(rerender);
      ro.observe(containerRef.current);
    }
  }

  /* --------- Reset View --------- */
  function snapToLast() {
    if (!chartRef.current || !barsRef.current.length || !initializedRef.current) return;
    
    try {
      const ts = chartRef.current.timeScale();
      if (!ts) return; // Guard against null timeScale
      
      ts.applyOptions({
        rightOffset: defaultRightOffsetRef.current,
        barSpacing: defaultBarSpacingRef.current,
      });

      const list = barsRef.current;
      const N = 180; // last ~180 candles
      
      if (list.length > N) {
        const lastBar = list[list.length - 1];
        const fromBar = list[list.length - N];
        
        // Ensure we have valid time values
        if (lastBar?.time && fromBar?.time && Number.isFinite(lastBar.time) && Number.isFinite(fromBar.time)) {
          ts.setVisibleRange({ from: fromBar.time, to: lastBar.time });
        } else {
          ts.fitContent();
        }
      } else {
        ts.fitContent();
      }
      
      // Only call scrollToRealTime if we have data
      if (list.length > 0) {
        ts.scrollToRealTime();
      }
    } catch (error) {
      console.warn('snapToLast error (non-critical):', error);
      // Fallback: just try fitContent
      try {
        const ts = chartRef.current?.timeScale();
        if (ts) ts.fitContent();
      } catch {}
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="relative min-h-[420px] neumorphic rounded-2xl overflow-hidden">
        {showResetViewButton && (
          <button
            type="button"
            onClick={snapToLast}
            className="absolute z-10 top-2 right-2 px-2 py-1 text-[11px] rounded-md bg-stone-800/80 border border-white/10 hover:bg-stone-700/80 backdrop-blur-sm"
          >
            Reset View
          </button>
        )}
        <div ref={containerRef} className="bg-stone-950 absolute inset-0" />
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {String(symbol)} • {timeframe} • Live
        </span>
        <span ref={priceLabelRef}>—</span>
      </div>
    </div>
  );
}
