
async function getRealtimePrice(code, apiToken = "demo") {
  const url = `https://eodhd.com/api/real-time/${encodeURIComponent(code)}?api_token=${encodeURIComponent(apiToken)}&fmt=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    return {
      ticker: code,
      price: data.close,
      timestamp: data.timestamp,
      change: data.change,
      change_percent: data.change_p,
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Example:
getRealtimePrice("AAPL.US").then(console.log);
