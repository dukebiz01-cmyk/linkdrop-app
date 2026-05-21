const base = process.env.DROP_BASE ?? "http://127.0.0.1:8080";
const variants = ["info", "coupon", "reservation", "purchase", "lead"];

let failed = 0;
for (const v of variants) {
  const url = `${base}/d/test?variant=${v}`;
  const res = await fetch(url);
  const html = await res.text();
  const needle = `data-variant="${v}"`;
  const ok = res.status === 200 && html.includes(needle);
  console.log(`${v}: ${res.status} ${ok ? "PASS" : "FAIL"} (${needle})`);
  if (!ok) failed += 1;
}
process.exit(failed > 0 ? 1 : 0);
