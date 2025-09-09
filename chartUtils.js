export function mergeActions(existing = [], incoming = []) {
  const out = [...existing];
  for (const a of incoming) {
    const idx = out.findIndex((b) => b.label === a.label);
    if (idx >= 0) {
      out[idx] = { ...out[idx], ...a };
    } else {
      out.push(a);
    }
  }
  return out;
}
