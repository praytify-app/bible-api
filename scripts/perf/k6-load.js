// k6 load scenarios behind docs/PERFORMANCE.md.
//
//   SCENARIO = hot | cold | refs | versions | search | download_mix
//   TARGET   = gateway | engine (engine requests carry GATEWAY_TOKEN)
//   VUS, DURATION, DL_VUS   closed-model concurrency (defaults 50, 45s, 4)
//   RATE / READ_RATE        fixed arrivals per second for the main or read scenario
//   API_KEY                 bearer key for keyed routes (search, download)
//   BASE                    override the base URL
//
// /scripts/targets.json comes from scripts/perf/targets.sql, run against the
// database under test. Prints one JSON summary line.
import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { SharedArray } from "k6/data";

const SCENARIO = __ENV.SCENARIO || "hot";
const TARGET = __ENV.TARGET || "gateway";
const VUS = parseInt(__ENV.VUS || "50", 10);
const DURATION = __ENV.DURATION || "45s";
const DL_VUS = parseInt(__ENV.DL_VUS || "4", 10);

const BASE = __ENV.BASE || (TARGET === "gateway" ? "http://pbperf-gateway:3200/v1" : "http://pbperf-engine:3100/api/v1");
const HEADERS = { "Accept-Encoding": "gzip, deflate, br" };
if (TARGET === "engine") HEADERS["x-gateway-token"] = __ENV.GATEWAY_TOKEN;
if (__ENV.API_KEY) HEADERS["Authorization"] = `Bearer ${__ENV.API_KEY}`;

// One SharedArray per list: indexing a SharedArray parses only that element,
// so a single array holding the whole object would re-parse 2 MB per request.
const lists = {};
for (const key of ["hot", "cold", "refs", "languages", "downloads"]) {
  lists[key] = new SharedArray(key, () => JSON.parse(open("/scripts/targets.json"))[key]);
}

// Weighted toward English stemmed search, the vectorized majority; other
// languages and the trigram path are each represented. "@xyz" searches a
// whole language.
lists.search = [
  ["KJV", "love"],
  ["KJV", "lord"],
  ["KJV", "god"],
  ["KJV", "shepherd"],
  ["KJV", "faith"],
  ["KJV", "grace"],
  ["KJV", "mercy"],
  ["KJV", "Melchizedek"],
  ["KJV", "Bethlehem"],
  ["KJV", "living water"],
  ["KJV", "bread of life"],
  ["KJV", "in the beginning"],
  ["KJV", "light"],
  ["KJV", "peace"],
  ["KJV", "Jerusalem"],
  ["KJV", "forgive"],
  ["KJV", "love"],
  ["KJV", "lord"],
  ["KJV", "god"],
  ["KJV", "shepherd"],
  ["KJV", "faith"],
  ["KJV", "grace"],
  ["KJV", "mercy"],
  ["KJV", "Melchizedek"],
  ["KJV", "Bethlehem"],
  ["KJV", "living water"],
  ["KJV", "bread of life"],
  ["KJV", "in the beginning"],
  ["KJV", "light"],
  ["KJV", "peace"],
  ["KJV", "Jerusalem"],
  ["KJV", "forgive"],
  ["KJV", "love"],
  ["KJV", "lord"],
  ["KJV", "god"],
  ["KJV", "shepherd"],
  ["KJV", "faith"],
  ["KJV", "grace"],
  ["KJV", "mercy"],
  ["KJV", "Melchizedek"],
  ["KJV", "Bethlehem"],
  ["KJV", "living water"],
  ["KJV", "bread of life"],
  ["KJV", "in the beginning"],
  ["KJV", "light"],
  ["KJV", "peace"],
  ["KJV", "Jerusalem"],
  ["KJV", "forgive"],
  ["WEB", "love"],
  ["WEB", "lord"],
  ["WEB", "god"],
  ["WEB", "shepherd"],
  ["WEB", "faith"],
  ["WEB", "grace"],
  ["WEB", "mercy"],
  ["WEB", "Melchizedek"],
  ["WEB", "Bethlehem"],
  ["WEB", "living water"],
  ["WEB", "bread of life"],
  ["WEB", "in the beginning"],
  ["WEB", "light"],
  ["WEB", "peace"],
  ["WEB", "Jerusalem"],
  ["WEB", "forgive"],
  ["WEB", "love"],
  ["WEB", "lord"],
  ["WEB", "god"],
  ["WEB", "shepherd"],
  ["WEB", "faith"],
  ["WEB", "grace"],
  ["WEB", "mercy"],
  ["WEB", "Melchizedek"],
  ["WEB", "Bethlehem"],
  ["WEB", "living water"],
  ["WEB", "bread of life"],
  ["WEB", "in the beginning"],
  ["WEB", "light"],
  ["WEB", "peace"],
  ["WEB", "Jerusalem"],
  ["WEB", "forgive"],
  ["WEB", "love"],
  ["WEB", "lord"],
  ["WEB", "god"],
  ["WEB", "shepherd"],
  ["WEB", "faith"],
  ["WEB", "grace"],
  ["WEB", "mercy"],
  ["WEB", "Melchizedek"],
  ["WEB", "Bethlehem"],
  ["WEB", "living water"],
  ["WEB", "bread of life"],
  ["WEB", "in the beginning"],
  ["WEB", "light"],
  ["WEB", "peace"],
  ["WEB", "Jerusalem"],
  ["WEB", "forgive"],
  ["ELBBK", "Liebe"],
  ["ELBBK", "Gott"],
  ["ELBBK", "Hirte"],
  ["ELBBK", "Glaube"],
  ["ELBBK", "Gnade"],
  ["NCL", "amour"],
  ["NCL", "Dieu"],
  ["NCL", "berger"],
  ["NCL", "foi"],
  ["NCL", "grâce"],
  ["ONBV", "amor"],
  ["ONBV", "Deus"],
  ["ONBV", "pastor"],
  ["ONBV", "graça"],
  ["SYN", "любовь"],
  ["SYN", "Бог"],
  ["SYN", "пастырь"],
  ["SYN", "вера"],
  ["RVG", "amor"],
  ["RVG", "Dios"],
  ["RVG", "pastor"],
  ["RVG", "gracia"],
  ["RVG", "fe"],
  ["ONEN", "Mungu"],
  ["ONEN", "upendo"],
  ["ONEN", "mchungaji"],
  ["AYT", "Allah"],
  ["AYT", "kasih"],
  ["AYT", "gembala"],
  ["TGLULB", "Diyos"],
  ["TGLULB", "pastol"],
  ["SA", "Allah"],
  ["Vietnamese Bible 1923", "yêu thương"],
  ["VD", "الله"],
  ["VD", "محبة"],
  ["Korean Bible 1910", "하나님"],
  ["Korean Bible 1910", "사랑"],
  ["SWCB", "耶稣"],
  ["SWCB", "爱"],
  ["Hindi Indian Revised Version Bible", "परमेश्वर"],
  ["ONEN", "Mungu"],
  ["ONEN", "upendo"],
  ["ONEN", "mchungaji"],
  ["AYT", "Allah"],
  ["AYT", "kasih"],
  ["AYT", "gembala"],
  ["TGLULB", "Diyos"],
  ["TGLULB", "pastol"],
  ["SA", "Allah"],
  ["Vietnamese Bible 1923", "yêu thương"],
  ["VD", "الله"],
  ["VD", "محبة"],
  ["Korean Bible 1910", "하나님"],
  ["Korean Bible 1910", "사랑"],
  ["SWCB", "耶稣"],
  ["SWCB", "爱"],
  ["Hindi Indian Revised Version Bible", "परमेश्वर"],
  ["@eng", "love"],
  ["@eng", "shepherd"],
  ["@swh", "mchungaji"],
  ["@cmn", "耶稣"],
  ["@spa", "amor"],
  ["@yor", "love"],
  ["@deu", "Liebe"],
];

const xHit = new Counter("xcache_hit");
const xMiss = new Counter("xcache_miss");
const xStale = new Counter("xcache_stale");
const xOther = new Counter("xcache_other");
const non2xx = new Counter("non2xx");

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function get(path, tag) {
  const res = http.get(`${BASE}${path}`, {
    headers: HEADERS,
    tags: { name: tag },
    timeout: "180s",
  });
  const xc = res.headers["X-Cache"] || res.headers["x-cache"];
  if (xc === "HIT") xHit.add(1);
  else if (xc === "MISS") xMiss.add(1);
  else if (xc && xc.startsWith("STALE")) xStale.add(1);
  else xOther.add(1);
  if (res.status < 200 || res.status >= 300) {
    non2xx.add(1, { status: String(res.status) });
    if (__ENV.LOG_ERR) console.warn(`ERR ${res.status} ${path}`);
  }
  check(res, { "2xx": (r) => r.status >= 200 && r.status < 300 });
  return res;
}

function chapterPath([v, b, c]) {
  return `/chapters/${encodeURIComponent(v)}/${b}/${c}/verses`;
}

export function hot() {
  get(chapterPath(pick(lists.hot)), "chapter");
}

export function cold() {
  get(chapterPath(pick(lists.cold)), "chapter");
}

export function refs() {
  const [v, ref] = pick(lists.refs);
  get(`/verses?ref=${encodeURIComponent(ref)}&version=${encodeURIComponent(v)}`, "ref");
}

export function versionsList() {
  const r = Math.random();
  if (r < 0.6) get(`/versions?limit=2000`, "versions");
  else if (r < 0.85) get(`/versions?limit=2000&language=${pick(lists.languages)}`, "versions_lang");
  else get(`/versions?limit=2000&search=${pick(["web", "king", "bible", "new", "santa", "bibel"])}`, "versions_search");
}

export function search() {
  const [v, q] = pick(lists.search);
  // "@xyz" targets a whole language instead of one version.
  const scope = v.startsWith("@") ? `language=${v.slice(1)}` : `version=${encodeURIComponent(v)}`;
  get(`/search?q=${encodeURIComponent(q)}&${scope}&limit=20`, "search");
}

export function download() {
  get(`/versions/${encodeURIComponent(pick(lists.downloads))}/download`, "download");
}

const execs = { hot, cold, refs, versions: versionsList, search };

const scenarios =
  SCENARIO === "download_mix"
    ? {
        // READ_RATE switches reads to an open model (fixed arrivals per second),
        // so download pressure shows up as read latency instead of fewer reads.
        reads: __ENV.READ_RATE
          ? { executor: "constant-arrival-rate", rate: parseInt(__ENV.READ_RATE, 10), timeUnit: "1s", duration: DURATION, preAllocatedVUs: 200, maxVUs: 400, exec: "cold" }
          : { executor: "constant-vus", vus: VUS, duration: DURATION, exec: "cold" },
        downloads: { executor: "constant-vus", vus: DL_VUS, duration: DURATION, exec: "download" },
      }
    : {
        main: __ENV.RATE
          ? { executor: "constant-arrival-rate", rate: parseInt(__ENV.RATE, 10), timeUnit: "1s", duration: DURATION, preAllocatedVUs: 200, maxVUs: 400, exec: SCENARIO === "versions" ? "versionsList" : SCENARIO }
          : { executor: "constant-vus", vus: VUS, duration: DURATION, exec: SCENARIO === "versions" ? "versionsList" : SCENARIO },
      };

// Thresholds that always pass, declared only so per-scenario submetrics
// show up in the summary.
const thresholds = {};
for (const name of Object.keys(scenarios)) {
  thresholds[`http_req_duration{scenario:${name}}`] = ["max>=0"];
  thresholds[`http_reqs{scenario:${name}}`] = ["count>=0"];
  thresholds[`http_req_failed{scenario:${name}}`] = ["rate>=0"];
}

export const options = {
  scenarios,
  thresholds,
  discardResponseBodies: true,
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"],
  noConnectionReuse: false,
};

export function handleSummary(d) {
  const m = d.metrics;
  const secs = d.state.testRunDurationMs / 1000;
  const out = { scenario: SCENARIO, target: TARGET, vus: VUS, secs: +secs.toFixed(1) };
  for (const name of Object.keys(scenarios)) {
    const dur = m[`http_req_duration{scenario:${name}}`].values;
    const reqs = m[`http_reqs{scenario:${name}}`].values.count;
    out[name] = {
      reqs,
      rps: +(reqs / secs).toFixed(1),
      p50: +dur.med.toFixed(1),
      p95: +dur["p(95)"].toFixed(1),
      p99: +dur["p(99)"].toFixed(1),
      max: +dur.max.toFixed(1),
      err: +(m[`http_req_failed{scenario:${name}}`].values.rate * 100).toFixed(2),
    };
  }
  const c = (k) => (m[k] ? m[k].values.count : 0);
  out.xcache = { hit: c("xcache_hit"), miss: c("xcache_miss"), stale: c("xcache_stale"), other: c("xcache_other") };
  out.non2xx = c("non2xx");
  out.dropped = c("dropped_iterations");
  return { stdout: JSON.stringify(out) + "\n" };
}
