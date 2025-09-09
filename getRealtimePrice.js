
export async function getRealtimePrice(code, apiToken = "demo") {
  if (typeof code !== "string" || !code.trim()) {
    throw new Error("code must be a non-empty string");
  }
  if (typeof apiToken !== "string" || !apiToken.trim()) {
    throw new Error("apiToken must be a non-empty string");
  }

  const url = `https://eodhd.com/api/real-time/${encodeURIComponent(
    code
  )}?api_token=${encodeURIComponent(apiToken)}&fmt=json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const data = await response.json();

  return {
    ticker: code,
    price: data.close,
    timestamp: data.timestamp,
    change: data.change,
    change_percent: data.change_p,
  };
}
