
async function getTechnicalIndicator(code, func = "rsi", period = 14, apiToken = "demo") {
  const now = new Date();
  const to = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const fromDate = new Date(now.getTime() - (period * 5 * 24 * 60 * 60 * 1000)); // Buffer for enough data
  const from = fromDate.toISOString().slice(0, 10);

  const url = `https://eodhd.com/api/technical-indicators/${encodeURIComponent(code)}?function=${encodeURIComponent(func)}&period=${period}&from=${from}&to=${to}&api_token=${encodeURIComponent(apiToken)}&fmt=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      const latest = data[data.length - 1];
      return {
        ticker: code,
        date: latest.date,
        value: latest[func],
      };
    } else {
      return { error: "No data received", raw: data };
    }
  } catch (error) {
    return { error: error.message };
  }
}

// Example:
getTechnicalIndicator("AAPL.US", "rsi", 14).then(console.log);
