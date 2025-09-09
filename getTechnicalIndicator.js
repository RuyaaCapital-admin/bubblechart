
export async function getTechnicalIndicator(
  code,
  func = "rsi",
  period = 14,
  apiToken = "demo"
) {
  if (typeof code !== "string" || !code.trim()) {
    throw new Error("code must be a non-empty string");
  }
  if (typeof func !== "string" || !func.trim()) {
    throw new Error("func must be a non-empty string");
  }
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error("period must be a positive integer");
  }
  if (typeof apiToken !== "string" || !apiToken.trim()) {
    throw new Error("apiToken must be a non-empty string");
  }

  const now = new Date();
  const to = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const fromDate = new Date(now.getTime() - period * 5 * 24 * 60 * 60 * 1000); // Buffer for enough data
  const from = fromDate.toISOString().slice(0, 10);

  const url = `https://eodhd.com/api/technical-indicators/${encodeURIComponent(
    code
  )}?function=${encodeURIComponent(func)}&period=${period}&from=${from}&to=${to}&api_token=${encodeURIComponent(
    apiToken
  )}&fmt=json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const data = await response.json();

  if (Array.isArray(data) && data.length > 0) {
    const latest = data[data.length - 1];
    return {
      ticker: code,
      date: latest.date,
      value: latest[func],
    };
  }
  throw new Error("No data received");
}
