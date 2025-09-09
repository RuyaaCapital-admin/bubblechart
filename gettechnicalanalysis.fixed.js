// deno-lint-ignore-file
// getTechnicalAnalysis.js — Deno (plain JS, no optional chaining / no nullish coalescing)
//
// Data source: EODHD only (no Base44 SDK calls)
//
// - Intraday OHLC: request only 1m/5m/1h; roll up to 15m/30m/4h locally
// - Daily/Weekly/Monthly: use /eod with period=d/w/m
// - Intraday TA: compute RSI/SMA/EMA/MACD locally
// - Daily TA: EODHD technical endpoint (RSI/SMA/EMA/MACD)
// - Real-time quote is used only if its timestamp aligns with the last bar bucket
// - Symbol normalized + best-effort resolved via /search
// - JPY pairs use 3 decimals; other FX 5; gold/indices/crypto 2
// - RR threshold: FX 1.5, XAUUSD 2.0, others 2.0
// - SL/TP sanity clamps within recent range
// - Arabic/English error texts supported

/* ============================== CONFIG ============================== */
const EODHD_API_TOKEN = Deno.env.get("EODHD_API_TOKEN");

/* =============================== CORS =============================== */
function cors(req) {
  var origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
    "Vary": "Origin"
  };
}
function resp(status, body, req) {
  return new Response(JSON.stringify(body), { status: status, headers: cors(req) });
}

/* =========================== TIMEFRAMES ============================ */
function normTf(tf) {
  var t = String(tf || "1h").trim().toLowerCase();
  if (t === "1m" || t === "m1" || t === "01m") return "1m";
  if (t === "5m" || t === "m5" || t === "05m") return "5m";
  if (t === "15m" || t === "m15" || t === "15") return "15m";
  if (t === "30m" || t === "m30" || t === "30") return "30m";
  if (t === "1h" || t === "h1" || t === "60" || t === "60m") return "1h";
  if (t === "4h" || t === "h4" || t === "240" || t === "240m") return "4h";
  if (t === "1d" || t === "d1" || t === "day" || t === "daily") return "1d";
  if (t === "1w" || t === "w1" || t === "week" || t === "weekly") return "1w";
  if (t === "1mth" || t === "1M" || t === "month" || t === "monthly") return "1M";
  return "1h";
}

/* =========================== SYMBOL NORMAL ========================== */
function normalizeSymbolForEODHD(raw) {
  if (!raw) return null;
  var s = String(raw).trim().toUpperCase();
  if (s.indexOf(".") >= 0 || s.endsWith("-USD.CC")) return s;

  var MAP = {
    XAUUSD: "XAUUSD.FOREX", XAGUSD: "XAGUSD.FOREX",
    EURUSD: "EURUSD.FOREX", GBPUSD: "GBPUSD.FOREX", USDJPY: "USDJPY.FOREX",
    USDCHF: "USDCHF.FOREX", AUDUSD: "AUDUSD.FOREX", USDCAD: "USDCAD.FOREX",
    NZDUSD: "NZDUSD.FOREX",

    BTC: "BTC-USD.CC", BTCUSD: "BTC-USD.CC",
    ETH: "ETH-USD.CC", ETHUSD: "ETH-USD.CC",
    XRP: "XRP-USD.CC", XRPUSD: "XRP-USD.CC",

    US30: "DJI.INDX", DJI: "DJI.INDX",
    NAS100: "NDX.INDX", NDX: "NDX.INDX",
    SPX500: "GSPC.INDX", US500: "GSPC.INDX",
    DAX: "GDAXI.INDX", GER40: "GDAXI.INDX",
    UK100: "FTSE.INDX", FTSE: "FTSE.INDX",
    JP225: "N225.INDX", NIKKEI: "N225.INDX",
    DXY: "DXY.INDX",

    USOIL: "CL.F", UKOIL: "BRN.F", COFFEE: "KC.F"
  };
  if (MAP[s]) return MAP[s];

  if (/^[A-Z]{6}$/.test(s) && s.slice(-3) === "USD") return s + ".FOREX";
  var CRYPTO_BASE = { LTC:1, ADA:1, DOT:1, SOL:1, DOGE:1, BNB:1, XLM:1, LINK:1 };
  if (CRYPTO_BASE[s]) return s + "-USD.CC";
  return s;
}

// Resolve to canonical symbol via EODHD /search
async function resolveCanonicalSymbol(input) {
  var s = String(input || "").trim().toUpperCase();
  if (!s) return null;
  if (s.indexOf(".") >= 0 || s.endsWith("-USD.CC")) return s;

  var type = "", exchange = "";
  if (/^[A-Z]{6}$/.test(s)) { type = "all"; exchange = "FOREX"; }
  else if (/^(GSPC|NDX|DJI|GDAXI|FTSE|N225|DXY)$/.test(s)) { type = "index"; }
  else if (/-USD$/.test(s)) { type = "crypto"; }
  else { type = "stock"; }

  var url = "https://eodhd.com/api/search/" + encodeURIComponent(s) +
            "?api_token=" + EODHD_API_TOKEN + "&fmt=json" +
            (type ? "&type=" + type : "") +
            (exchange ? "&exchange=" + exchange : "") +
            "&limit=5";
  try {
    var r = await fetch(url, { headers: { "User-Agent": "Liirat-App/1.0", "Accept": "application/json" }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    var arr = await r.json().catch(function(){ return null; });
    if (!(arr && arr.length)) return null;

    var i, best = null;
    for (i = 0; i < arr.length; i++) {
      if (String(arr[i].Code || "").toUpperCase() === s) { best = arr[i]; break; }
    }
    if (!best) {
      for (i = 0; i < arr.length; i++) { if (arr[i].isPrimary) { best = arr[i]; break; } }
    }
    if (!best) best = arr[0];
    if (!best || !best.Code || !best.Exchange) return null;

    var US_EX = { NYSE:1, NASDAQ:1, BATS:1, OTCQB:1, OTCQX:1, PINK:1, OTCMKTS:1, NMFQS:1, "NYSE MKT":1, US:1 };
    var ex = (US_EX[String(best.Exchange).toUpperCase()] && type === "stock") ? "US" : String(best.Exchange).toUpperCase();
    return String(best.Code).toUpperCase() + "." + ex;
  } catch(e) {
    return null;
  }
}

/* ============================ DATE WINDOW =========================== */
function getAnalysisDateRange(tf) {
  var t = normTf(tf);
  var now = new Date();
  var daysBack;
  if (t === "1m") daysBack = 1;
  else if (t === "5m") daysBack = 2;
  else if (t === "15m") daysBack = 5;
  else if (t === "30m") daysBack = 7;
  else if (t === "1h") daysBack = 10;
  else if (t === "4h") daysBack = 30;
  else if (t === "1d") daysBack = 365 * 2;
  else if (t === "1w") daysBack = 365 * 5;
  else if (t === "1M") daysBack = 365 * 10;
  else daysBack = 240;

  var from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return {
    tf: t,
    fromISO: from.toISOString().slice(0, 10),
    toISO: now.toISOString().slice(0, 10),
    fromTs: Math.floor(from.getTime() / 1000),
    toTs: Math.floor(now.getTime() / 1000)
  };
}

/* =============================== HELPERS ============================ */
function toUnixUtc(dt) {
  if (!dt) return NaN;
  if (typeof dt === "number") return Math.floor(dt);
  var s = String(dt).replace(" ", "T");
  if (s.slice(-1) !== "Z") s += "Z";
  var t = Date.parse(s);
  return isFinite(t) ? Math.floor(t / 1000) : NaN;
}

function normalizeBars(raw) {
  var out = [];
  if (!(raw && raw.length)) return out;
  var seen = {};
  for (var i = 0; i < raw.length; i++) {
    var it = raw[i];
    var t = isFinite(it && it.timestamp) ? Number(it.timestamp) : toUnixUtc((it && it.datetime) || (it && it.date));
    var o = Number(it && it.open), h = Number(it && it.high), l = Number(it && it.low), c = Number(it && it.close), v = Number((it && it.volume) || 0);
    if (!(isFinite(t) && isFinite(o) && isFinite(h) && isFinite(l) && isFinite(c) && o > 0 && h > 0 && l > 0 && c > 0)) continue;
    if (seen[t]) continue;
    seen[t] = 1;
    out.push({ time: t, open: o, high: h, low: l, close: c, volume: v });
  }
  out.sort(function(a,b){ return a.time - b.time; });
  return out;
}

function rollup(bars, bucketSec) {
  if (!(bars && bars.length)) return [];
  var out = [], cur = null;
  for (var i = 0; i < bars.length; i++) {
    var b = bars[i];
    var bucketStart = Math.floor(b.time / bucketSec) * bucketSec;
    if (!cur || bucketStart !== cur.time) {
      if (cur) out.push(cur);
      cur = { time: bucketStart, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
    } else {
      if (b.high > cur.high) cur.high = b.high;
      if (b.low < cur.low) cur.low = b.low;
      cur.close = b.close;
      cur.volume += b.volume;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/* =============================== FETCH ============================== */
async function fetchHistoricalData(symbol, tf) {
  var rng = getAnalysisDateRange(tf);
  var t = rng.tf, fromISO = rng.fromISO, toISO = rng.toISO, fromTs = rng.fromTs, toTs = rng.toTs;
  var enc = encodeURIComponent(symbol);

  async function fetchIntraday(interval) {
    var url = "https://eodhd.com/api/intraday/" + enc + "?interval=" + interval + "&from=" + fromTs + "&to=" + toTs + "&api_token=" + EODHD_API_TOKEN + "&fmt=json";
    var res = await fetch(url, { headers: { "User-Agent": "Liirat-App/1.0", "Accept": "application/json" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    var data = await res.json().catch(function(){ return null; });
    return (data && data.length) ? data : null;
  }
  async function fetchEod(period) {
    var url = "https://eodhd.com/api/eod/" + enc + "?from=" + fromISO + "&to=" + toISO + "&period=" + period + "&api_token=" + EODHD_API_TOKEN + "&fmt=json";
    var res = await fetch(url, { headers: { "User-Agent": "Liirat-App/1.0", "Accept": "application/json" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    var data = await res.json().catch(function(){ return null; });
    return (data && data.length) ? data : null;
  }

  var raw = null, base5m = null, base1h = null;

  if (t === "1d" || t === "1w" || t === "1M") {
    var period = (t === "1w") ? "w" : (t === "1M" ? "m" : "d");
    raw = await fetchEod(period);
  } else if (t === "1m") {
    raw = await fetchIntraday("1m");
  } else if (t === "5m") {
    raw = await fetchIntraday("5m");
  } else if (t === "1h") {
    raw = (await fetchIntraday("1h")) || (base5m = await fetchIntraday("5m"));
  } else if (t === "15m" || t === "30m") {
    base5m = (await fetchIntraday("5m")) || (await fetchIntraday("1m"));
  } else if (t === "4h") {
    base1h = await fetchIntraday("1h");
    if (!base1h) base5m = await fetchIntraday("5m");
  }

  if (!raw && !base5m && !base1h) throw new Error("No historical data available");

  var bars5m = base5m ? normalizeBars(base5m) : null;
  var bars1h = base1h ? normalizeBars(base1h) : null;

  if (t === "15m" && bars5m) raw = rollup(bars5m, 900);
  if (t === "30m" && bars5m) raw = rollup(bars5m, 1800);
  if (t === "1h" && bars5m && !raw) raw = rollup(bars5m, 3600);
  if (t === "4h") {
    if (bars1h) raw = rollup(bars1h, 14400);
    else if (bars5m) raw = rollup(bars5m, 14400);
  }

  var ohlc = normalizeBars(raw);
  if (!ohlc.length) throw new Error("No valid historical data after normalization");

  return { tf: t, fromISO: fromISO, toISO: toISO, data: ohlc };
}

async function fetchRealTimePrice(symbol) {
  var enc = encodeURIComponent(symbol);
  var url = "https://eodhd.com/api/real-time/" + enc + "?api_token=" + EODHD_API_TOKEN + "&fmt=json";
  try {
    var res = await fetch(url, { headers: { "User-Agent": "Liirat-App/1.0", "Accept": "application/json" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    var data = await res.json().catch(function(){ return null; });
    return data || null;
  } catch(e) {
    return null;
  }
}

/* ============== DAILY TECHNICAL INDICATORS (EODHD API) ============== */
async function fetchTechnicalIndicatorsDaily(symbol, fromISO, toISO) {
  var base = "https://eodhd.com/api/technical/" + encodeURIComponent(symbol) + "?from=" + fromISO + "&to=" + toISO + "&order=d&api_token=" + EODHD_API_TOKEN + "&fmt=json";
  var cfgs = [
    { k: "rsi",   url: base + "&function=rsi&period=14&filter=last_rsi" },
    { k: "sma20", url: base + "&function=sma&period=20&filter=last_sma" },
    { k: "sma50", url: base + "&function=sma&period=50&filter=last_sma" },
    { k: "ema20", url: base + "&function=ema&period=20&filter=last_ema" },
    { k: "macd",  url: base + "&function=macd&fast_period=12&slow_period=26&signal_period=9" }
  ];
  var out = {};
  await Promise.all(cfgs.map(async function (item) {
    try {
      var r = await fetch(item.url, { headers: { "User-Agent": "Liirat-App/1.0", "Accept": "application/json" }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) { out[item.k] = null; return; }
      var j = await r.json().catch(function(){ return null; });
      if (j && j.technical && j.technical.length) out[item.k] = j.technical;
      else if (j && j.length) out[item.k] = j;
      else out[item.k] = j || null;
    } catch(e) {
      out[item.k] = null;
    }
  }));
  return out;
}

/* ============================ LOCAL INDICATORS ====================== */
function sma(arr, p) {
  if (arr.length < p) return null;
  var s = 0;
  for (var i = arr.length - p; i < arr.length; i++) s += arr[i];
  return s / p;
}
function ema(arr, p) {
  if (arr.length < p) return null;
  var k = 2 / (p + 1);
  var e = sma(arr.slice(0, p), p);
  for (var i = p; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
  return e;
}
function rsi(close, p) {
  p = p || 14;
  if (close.length < p + 1) return null;
  var up = 0, down = 0;
  for (var i = close.length - p; i < close.length; i++) {
    var ch = close[i] - close[i - 1];
    if (ch > 0) up += ch; else down -= ch;
  }
  if (down === 0) return 100;
  var RS = (up / p) / (down / p);
  return 100 - (100 / (1 + RS));
}
function macdLocal(close, f, s, sig) {
  f = f || 12; s = s || 26; sig = sig || 9;
  if (close.length < s + sig) return null;
  var kf = 2 / (f + 1), ks = 2 / (s + 1), ks2 = 2 / (sig + 1);
  var eFast = null, eSlow = null, eSig = null;
  var macdLine = [];
  for (var i = 0; i < close.length; i++) {
    var px = close[i];
    eFast = (eFast == null) ? px : px * kf + eFast * (1 - kf);
    eSlow = (eSlow == null) ? px : px * ks + eSlow * (1 - ks);
    macdLine.push(eFast - eSlow);
  }
  for (var j = 0; j < macdLine.length; j++) {
    var v = macdLine[j];
    eSig = (eSig == null) ? v : v * ks2 + eSig * (1 - ks2);
  }
  var m = macdLine[macdLine.length - 1];
  var signal = eSig;
  var histogram = (signal == null) ? null : (m - signal);
  return { macd: m, signal: signal, histogram: histogram };
}
function computeIntradayIndicators(ohlc) {
  var close = ohlc.map(function(b){ return b.close; });
  return {
    RSI: rsi(close, 14),
    SMA20: sma(close, 20),
    SMA50: sma(close, 50),
    EMA20: ema(close, 20),
    MACD: macdLocal(close, 12, 26, 9)
  };
}

/* ============================ ANALYTICS ============================= */
function findPivots(ohlc, left, right) {
  left = left || 5; right = right || 5;
  var highs = [], lows = [];
  for (var i = left; i < ohlc.length - right; i++) {
    var ph = true, pl = true, k;
    for (k = i - left; k < i; k++) { if (!(ohlc[k].high < ohlc[i].high)) { ph = false; break; } }
    for (k = i + 1; k <= i + right; k++) { if (!(ohlc[k].high < ohlc[i].high)) { ph = false; break; } }
    for (k = i - left; k < i; k++) { if (!(ohlc[k].low > ohlc[i].low)) { pl = false; break; } }
    for (k = i + 1; k <= i + right; k++) { if (!(ohlc[k].low > ohlc[i].low)) { pl = false; break; } }
    if (ph) highs.push({ price: ohlc[i].high, index: i, time: ohlc[i].time });
    if (pl) lows.push({ price: ohlc[i].low,  index: i, time: ohlc[i].time });
  }
  if (highs.length > 10) highs = highs.slice(-10);
  if (lows.length > 10)  lows  = lows.slice(-10);
  return { highs: highs, lows: lows };
}

function calcSR(ohlc) {
  if (!(ohlc && ohlc.length >= 10)) return { support: null, resistance: null };
  var piv = findPivots(ohlc, 4, 4);
  var current = ohlc[ohlc.length - 1].close;

  var supp = null, res = null, dMinS = Infinity, dMinR = Infinity, i, p;
  for (i = 0; i < piv.lows.length; i++) {
    p = piv.lows[i].price;
    if (p < current) {
      var d = current - p;
      if (d < dMinS) { dMinS = d; supp = p; }
    }
  }
  for (i = 0; i < piv.highs.length; i++) {
    p = piv.highs[i].price;
    if (p > current) {
      var d2 = p - current;
      if (d2 < dMinR) { dMinR = d2; res = p; }
    }
  }

  var look = Math.min(50, ohlc.length);
  var lo = Infinity, hi = -Infinity;
  for (i = ohlc.length - look; i < ohlc.length; i++) {
    if (ohlc[i].low < lo) lo = ohlc[i].low;
    if (ohlc[i].high > hi) hi = ohlc[i].high;
  }
  if (supp == null && isFinite(lo)) supp = lo;
  if (res == null && isFinite(hi)) res = hi;

  return { support: supp, resistance: res };
}

function extractIndicatorValuesDaily(ind) {
  var v = {};
  function lastOf(arr, key) {
    if (arr && arr.length) {
      var obj = arr[arr.length - 1];
      return (obj && isFinite(obj[key])) ? +obj[key] : null;
    }
    return null;
  }
  v.RSI = lastOf(ind && ind.rsi, "rsi");
  if (v.RSI == null && ind && ind.rsi && isFinite(ind.rsi.rsi)) v.RSI = +ind.rsi.rsi;

  v.SMA20 = lastOf(ind && ind.sma20, "sma");
  if (v.SMA20 == null && ind && ind.sma20 && isFinite(ind.sma20.sma)) v.SMA20 = +ind.sma20.sma;

  v.SMA50 = lastOf(ind && ind.sma50, "sma");
  if (v.SMA50 == null && ind && ind.sma50 && isFinite(ind.sma50.sma)) v.SMA50 = +ind.sma50.sma;

  v.EMA20 = lastOf(ind && ind.ema20, "ema");
  if (v.EMA20 == null && ind && ind.ema20 && isFinite(ind.ema20.ema)) v.EMA20 = +ind.ema20.ema;

  if (ind && ind.macd) {
    if (ind.macd.length) {
      var m = ind.macd[ind.macd.length - 1];
      v.MACD = {
        macd: (m && isFinite(m.macd)) ? +m.macd : null,
        signal: (m && isFinite(m.signal)) ? +m.signal : null,
        histogram: (m && isFinite(m.histogram)) ? +m.histogram : null
      };
    } else if (typeof ind.macd === "object") {
      v.MACD = {
        macd: isFinite(ind.macd.macd) ? +ind.macd.macd : null,
        signal: isFinite(ind.macd.signal) ? +ind.macd.signal : null,
        histogram: isFinite(ind.macd.histogram) ? +ind.macd.histogram : null
      };
    }
  }
  return v;
}

function analyzeTrendAndSignals(ohlc, iv, currentPrice) {
  if (!(ohlc && ohlc.length)) {
    return { trend: "neutral", recommendation: "hold", confidence: 0, reason: "Insufficient data", currentPrice: null };
  }
  var price = isFinite(currentPrice) ? currentPrice : +ohlc[ohlc.length - 1].close;

  var bull = 0, bear = 0, reasons = [];

  if (isFinite(iv && iv.RSI)) {
    var r = Number(iv.RSI);
    if (r < 30) { bull++; reasons.push("RSI oversold"); }
    else if (r > 70) { bear++; reasons.push("RSI overbought"); }
    else if (r >= 60) { reasons.push("RSI elevated (" + r.toFixed(1) + ")"); }
    else if (r <= 40) { reasons.push("RSI depressed (" + r.toFixed(1) + ")"); }
    else { reasons.push("RSI neutral (" + r.toFixed(1) + ")"); }
  }

  if (isFinite(iv && iv.SMA20) && isFinite(iv && iv.SMA50)) {
    if (price > iv.SMA20 && iv.SMA20 > iv.SMA50) { bull++; reasons.push("Price > SMA20 > SMA50"); }
    else if (price < iv.SMA20 && iv.SMA20 < iv.SMA50) { bear++; reasons.push("Price < SMA20 < SMA50"); }
  } else if (isFinite(iv && iv.SMA20)) {
    if (price > iv.SMA20) { bull++; reasons.push("Price > SMA20"); }
    else { bear++; reasons.push("Price < SMA20"); }
  }

  if (iv && iv.MACD && isFinite(iv.MACD.macd) && isFinite(iv.MACD.signal)) {
    if (iv.MACD.macd > iv.MACD.signal) { bull++; reasons.push("MACD bullish"); }
    else { bear++; reasons.push("MACD bearish"); }
  }

  var trend = "neutral", recommendation = "hold";
  if (bull > bear) { trend = "bullish"; recommendation = "buy"; }
  else if (bear > bull) { trend = "bearish"; recommendation = "sell"; }

  var total = bull + bear;
  var conf = total ? Math.round((Math.max(bull, bear) / total) * 100) : 50;
  if (total >= 2 && iv && iv.MACD && isFinite(iv.MACD.macd) && isFinite(iv.MACD.signal)) conf += 5;
  var confidence = Math.min(conf, 85);

  return { trend: trend, recommendation: recommendation, confidence: confidence, reason: reasons.slice(0, 3).join(", "), currentPrice: price };
}

/* ============== ATR / Pivots / Precision / RR helpers ============== */
function atr(ohlc, period) {
  period = period || 14;
  if (!(ohlc && ohlc.length >= period + 1)) return null;
  var trs = [];
  for (var i = 1; i < ohlc.length; i++) {
    var h = ohlc[i].high, l = ohlc[i].low, pc = ohlc[i - 1].close;
    var tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    trs.push(tr);
  }
  if (trs.length < period) return null;
  var sum = 0;
  for (var j = trs.length - period; j < trs.length; j++) sum += trs[j];
  return sum / period;
}

function fxIsJpyPair(symbol) {
  var s = String(symbol || "").toUpperCase();
  return /JPY\.FOREX$/.test(s) || /(USDJPY|EURJPY|GBPJPY|AUDJPY|CADJPY|NZDJPY)$/.test(s);
}
function priceDecimals(symbol) {
  var s = String(symbol || "").toUpperCase();
  if (s.indexOf("XAUUSD") >= 0) return 2;
  if (fxIsJpyPair(s)) return 3;
  if (s.indexOf(".FOREX") >= 0) return 5;
  if (s.indexOf(".CC") >= 0) return 2;
  return 2;
}
function pxToFixed(symbol, value) {
  var dec = priceDecimals(symbol);
  return +( (+value).toFixed(dec) );
}
function rrThreshold(symbol) {
  var s = String(symbol || "").toUpperCase();
  if (s.indexOf("XAUUSD") >= 0) return 2.0;
  if (s.indexOf(".FOREX") >= 0) return 1.5;
  return 2.0;
}
function clamp(v, lo, hi) {
  if (lo != null && v < lo) return lo;
  if (hi != null && v > hi) return hi;
  return v;
}

/* ========================= Trade setup builder ====================== */
function generateTradeSetup(ohlc, support, resistance, recommendation, confidence, currentPrice, symbol) {
  if (!(ohlc && ohlc.length >= 20)) return null;

  var price = isFinite(currentPrice) ? currentPrice : +ohlc[ohlc.length - 1].close;
  var last = ohlc[ohlc.length - 1];

  var lastAtr = atr(ohlc, 14);
  if (lastAtr == null) lastAtr = Math.abs(last.high - last.low);
  if (!(isFinite(lastAtr) && lastAtr > 0)) return null;

  var rrMin = rrThreshold(symbol);

  var look = Math.min(50, ohlc.length);
  var minLow = Infinity, maxHigh = -Infinity, i;
  for (i = ohlc.length - look; i < ohlc.length; i++) {
    if (ohlc[i].low < minLow) minLow = ohlc[i].low;
    if (ohlc[i].high > maxHigh) maxHigh = ohlc[i].high;
  }
  var rangePad = 0.2 * lastAtr;

  var S = isFinite(support) ? support : null;
  var R = isFinite(resistance) ? resistance : null;

  var farFromS = (S != null) ? (price - S) > 1.5 * lastAtr : false;
  var farFromR = (R != null) ? (R - price) > 1.5 * lastAtr : false;

  var scenarios = [];

  // LONG
  if (S != null) {
    var entryL = Math.max(price, S + 0.25 * lastAtr);
    var slL    = farFromS ? (entryL - 1.0 * lastAtr) : Math.min(entryL - 0.5 * lastAtr, S - 0.5 * lastAtr);
    var tpL    = entryL + Math.max(rrMin * (entryL - slL), 2.0 * lastAtr);

    slL = clamp(slL, minLow - rangePad, entryL - 0.2 * lastAtr);
    tpL = clamp(tpL, entryL + 0.2 * lastAtr, maxHigh + rangePad);

    var riskL = entryL - slL;
    var rrL   = (tpL - entryL) / (riskL > 0 ? riskL : 1e-9);
    scenarios.push({ direction: "Buy", entry: entryL, stopLoss: slL, takeProfit: tpL, rr: rrL, basis: "ATR + S/R (clamped)" });
  }

  // SHORT
  if (R != null) {
    var entryS = Math.min(price, R - 0.25 * lastAtr);
    var slS    = farFromR ? (entryS + 1.0 * lastAtr) : Math.max(entryS + 0.5 * lastAtr, R + 0.5 * lastAtr);
    var tpS    = entryS - Math.max(rrMin * (slS - entryS), 2.0 * lastAtr);

    slS = clamp(slS, entryS + 0.2 * lastAtr, maxHigh + rangePad);
    tpS = clamp(tpS, minLow - rangePad, entryS - 0.2 * lastAtr);

    var riskS = slS - entryS;
    var rrS   = (entryS - tpS) / (riskS > 0 ? riskS : 1e-9);
    scenarios.push({ direction: "Sell", entry: entryS, stopLoss: slS, takeProfit: tpS, rr: rrS, basis: "ATR + S/R (clamped)" });
  }

  var pref = (recommendation === "buy") ? "Buy" : ((recommendation === "sell") ? "Sell" : null);
  var pick = null;

  for (i = 0; i < scenarios.length; i++) {
    var s1 = scenarios[i];
    if (pref && s1.direction === pref && s1.rr >= rrMin) {
      if (!pick || s1.rr > pick.rr) pick = s1;
    }
  }
  if (!pick) {
    for (i = 0; i < scenarios.length; i++) {
      var s2 = scenarios[i];
      if (s2.rr >= rrMin) {
        if (!pick || s2.rr > pick.rr) pick = s2;
      }
    }
  }
  if (!pick) return null;

  return {
    direction:  pick.direction,
    entry:      pxToFixed(symbol, pick.entry),
    stopLoss:   pxToFixed(symbol, pick.stopLoss),
    takeProfit: pxToFixed(symbol, pick.takeProfit),
    riskReward: (+pick.rr).toFixed(2),
    basis:      pick.basis,
    confidence: confidence,
    currentPrice: pxToFixed(symbol, price),
    atr14: pxToFixed(symbol, lastAtr)
  };
}

/* ======================= QUOTE ALIGNMENT CHECK ====================== */
function isQuoteAligned(lastBarTs, quoteTs, tf) {
  if (!(isFinite(lastBarTs) && isFinite(quoteTs))) return false;
  var bucket = (tf === "1m") ? 60 :
               (tf === "5m") ? 300 :
               (tf === "15m") ? 900 :
               (tf === "30m") ? 1800 :
               (tf === "1h") ? 3600 :
               (tf === "4h") ? 14400 :
               (tf === "1d") ? 86400 :
               (tf === "1w") ? 604800 :
               (tf === "1M") ? 2592000 : 86400;
  return Math.abs(quoteTs - lastBarTs) <= bucket;
}
function extractRealTimePrice(rt) {
  if (!rt) return { price: null, ts: null };
  var price = Number((rt && rt.close) != null ? rt.close :
                     (rt && rt.price) != null ? rt.price :
                     (rt && rt.ask) != null ? rt.ask :
                     (rt && rt.bid) != null ? rt.bid : NaN);
  var ts = isFinite(rt && rt.timestamp) ? Number(rt.timestamp) : toUnixUtc(rt && rt.last_trade_time);
  return { price: isFinite(price) ? price : null, ts: isFinite(ts) ? ts : null };
}

/* =============================== SERVER ============================= */
Deno.serve(async function (req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors(req) });
  if (req.method !== "POST") return resp(405, { success: false, error: "Use POST." }, req);

  var lang = "en";
  try {
    if (!EODHD_API_TOKEN) return resp(500, { success: false, error: "EODHD API token not configured" }, req);

    var body = await req.json().catch(function(){ return {}; });
    var rawSymbol = body && body.symbol;
    var timeframe = (body && body.timeframe) || "1h";
    var includeTradeSetup = !!(body && body.includeTradeSetup);
    lang = (body && body.language) || "en";

    if (!rawSymbol) {
      return resp(400, { success: false, error: (lang === "ar" ? "يجب تحديد الرمز" : "Symbol is required") }, req);
    }

    var symbol = normalizeSymbolForEODHD(rawSymbol);
    var resolved = await resolveCanonicalSymbol(symbol);
    if (resolved) symbol = resolved;

    if (!symbol) {
      return resp(400, { success: false, error: (lang === "ar" ? "رمز غير صالح" : "Invalid symbol") }, req);
    }

    var hist = await fetchHistoricalData(symbol, timeframe);
    var tf = hist.tf, fromISO = hist.fromISO, toISO = hist.toISO, ohlc = hist.data;

    var rt = await fetchRealTimePrice(symbol);
    var extracted = extractRealTimePrice(rt);
    var lastBar = ohlc[ohlc.length - 1];
    var currentPrice = (extracted.price != null && isQuoteAligned(lastBar.time, extracted.ts, tf)) ? extracted.price : null;

    var iv;
    if (tf === "1d") {
      var indDaily = await fetchTechnicalIndicatorsDaily(symbol, fromISO, toISO);
      iv = extractIndicatorValuesDaily(indDaily);
    } else {
      iv = computeIntradayIndicators(ohlc);
    }

    var sr = calcSR(ohlc);
    var analysis = analyzeTrendAndSignals(ohlc, iv, currentPrice);
    var setup = null;
    if (includeTradeSetup) {
      setup = generateTradeSetup(
        ohlc,
        sr.support,
        sr.resistance,
        analysis.recommendation,
        analysis.confidence,
        currentPrice,
        symbol
      );
    }

    var dp = priceDecimals(symbol);
    var showPrice = analysis.currentPrice != null ? analysis.currentPrice : lastBar.close;
    var displayPrice = +(showPrice.toFixed(dp));

    var now = new Date();

    // indicators formatting
    var outMACD = null;
    if (iv && iv.MACD && (isFinite(iv.MACD.macd) || isFinite(iv.MACD.signal) || isFinite(iv.MACD.histogram))) {
      outMACD = {
        macd: isFinite(iv.MACD.macd) ? +iv.MACD.macd.toFixed(5) : null,
        signal: isFinite(iv.MACD.signal) ? +iv.MACD.signal.toFixed(5) : null,
        histogram: isFinite(iv.MACD.histogram) ? +iv.MACD.histogram.toFixed(5) : null
      };
    }

    return resp(200, {
      success: true,
      symbol: symbol,
      timeframe: tf,
      currentPrice: showPrice,
      displayPrice: displayPrice,
      trend: analysis.trend,
      support: sr.support != null ? +sr.support.toFixed(5) : null,
      resistance: sr.resistance != null ? +sr.resistance.toFixed(5) : null,
      indicators: {
        RSI: (iv && isFinite(iv.RSI)) ? +iv.RSI.toFixed(2) : null,
        SMA20: (iv && isFinite(iv.SMA20)) ? +iv.SMA20.toFixed(5) : null,
        SMA50: (iv && isFinite(iv.SMA50)) ? +iv.SMA50.toFixed(5) : null,
        EMA20: (iv && isFinite(iv.EMA20)) ? +iv.EMA20.toFixed(5) : null,
        MACD: outMACD
      },
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      reason: analysis.reason,
      tradeSetup: setup,
      dataPoints: ohlc.length,
      lastBar: { time: lastBar.time, open: lastBar.open, high: lastBar.high, low: lastBar.low, close: lastBar.close },
      timestamp: now.toISOString(),
      dateTime: now.toLocaleString(),
      isRealTime: !!(analysis.currentPrice != null && analysis.currentPrice === currentPrice)
    }, req);

  } catch (e) {
    return resp(400, {
      success: false,
      error: (lang === "ar" ? "فشل في جلب البيانات أو التحليل" : "Failed to fetch/analyze data"),
      details: String((e && e.message) || e)
    }, req);
  }
});
