import { B as d, s as h, a as y, A as k, t as L, f as R, b as x, d as P, i as b, I as w, c as A, e as S, g as $, h as v } from "./index-CcJ2yQOY.js";
const m = (a) => a;
class g extends d {
  constructor({ body: t, cause: r, details: o, headers: n, status: e, url: s }) {
    super("HTTP request failed.", {
      cause: r,
      details: o,
      metaMessages: [
        e && `Status: ${e}`,
        `URL: ${m(s)}`,
        t && `Request body: ${h(t)}`
      ].filter(Boolean),
      name: "HttpRequestError"
    }), Object.defineProperty(this, "body", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "headers", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "status", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "url", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.body = t, this.headers = n, this.status = e, this.url = s;
  }
}
const M = {
  inputs: [
    {
      name: "message",
      type: "string"
    }
  ],
  name: "Error",
  type: "error"
}, q = {
  inputs: [
    {
      name: "reason",
      type: "uint256"
    }
  ],
  name: "Panic",
  type: "error"
};
function T(a) {
  const { abi: t, data: r } = a, o = y(r, 0, 4);
  if (o === "0x")
    throw new k();
  const e = [...t || [], M, q].find((s) => s.type === "error" && o === L(R(s)));
  if (!e)
    throw new x(o, {
      docsPath: "/docs/contract/decodeErrorResult"
    });
  return {
    abiItem: e,
    args: "inputs" in e && e.inputs && e.inputs.length > 0 ? P(e.inputs, y(r, 4)) : void 0,
    errorName: e.name
  };
}
function j(a, t) {
  if (!b(a, { strict: !1 }))
    throw new w({ address: a });
  if (!b(t, { strict: !1 }))
    throw new w({ address: t });
  return a.toLowerCase() === t.toLowerCase();
}
class C extends d {
  constructor({ callbackSelector: t, cause: r, data: o, extraData: n, sender: e, urls: s }) {
    super(r.shortMessage || "An error occurred while fetching for an offchain result.", {
      cause: r,
      metaMessages: [
        ...r.metaMessages || [],
        r.metaMessages?.length ? "" : [],
        "Offchain Gateway Call:",
        s && [
          "  Gateway URL(s):",
          ...s.map((u) => `    ${m(u)}`)
        ],
        `  Sender: ${e}`,
        `  Data: ${o}`,
        `  Callback selector: ${t}`,
        `  Extra data: ${n}`
      ].flat(),
      name: "OffchainLookupError"
    });
  }
}
class D extends d {
  constructor({ result: t, url: r }) {
    super("Offchain gateway response is malformed. Response data must be a hex value.", {
      metaMessages: [
        `Gateway URL: ${m(r)}`,
        `Response: ${h(t)}`
      ],
      name: "OffchainLookupResponseMalformedError"
    });
  }
}
class I extends d {
  constructor({ sender: t, to: r }) {
    super("Reverted sender address does not match target contract address (`to`).", {
      metaMessages: [
        `Contract address: ${r}`,
        `OffchainLookup sender address: ${t}`
      ],
      name: "OffchainLookupSenderMismatchError"
    });
  }
}
const _ = "0x556f1830", G = {
  name: "OffchainLookup",
  type: "error",
  inputs: [
    {
      name: "sender",
      type: "address"
    },
    {
      name: "urls",
      type: "string[]"
    },
    {
      name: "callData",
      type: "bytes"
    },
    {
      name: "callbackFunction",
      type: "bytes4"
    },
    {
      name: "extraData",
      type: "bytes"
    }
  ]
};
async function B(a, { blockNumber: t, blockTag: r, data: o, to: n }) {
  const { args: e } = T({
    data: o,
    abi: [G]
  }), [s, u, l, i, c] = e, { ccipRead: f } = a, E = f && typeof f?.request == "function" ? f.request : H;
  try {
    if (!j(n, s))
      throw new I({ sender: s, to: n });
    const p = await E({ data: l, sender: s, urls: u }), { data: O } = await A(a, {
      blockNumber: t,
      blockTag: r,
      data: S([
        i,
        $([{ type: "bytes" }, { type: "bytes" }], [p, c])
      ]),
      to: n
    });
    return O;
  } catch (p) {
    throw new C({
      callbackSelector: i,
      cause: p,
      data: o,
      extraData: c,
      sender: s,
      urls: u
    });
  }
}
async function H({ data: a, sender: t, urls: r }) {
  let o = new Error("An unknown error occurred.");
  for (let n = 0; n < r.length; n++) {
    const e = r[n], s = e.includes("{data}") ? "GET" : "POST", u = s === "POST" ? { data: a, sender: t } : void 0, l = s === "POST" ? { "Content-Type": "application/json" } : {};
    try {
      const i = await fetch(e.replace("{sender}", t).replace("{data}", a), {
        body: JSON.stringify(u),
        headers: l,
        method: s
      });
      let c;
      if (i.headers.get("Content-Type")?.startsWith("application/json") ? c = (await i.json()).data : c = await i.text(), !i.ok) {
        o = new g({
          body: u,
          details: c?.error ? h(c.error) : i.statusText,
          headers: i.headers,
          status: i.status,
          url: e
        });
        continue;
      }
      if (!v(c)) {
        o = new D({
          result: c,
          url: e
        });
        continue;
      }
      return c;
    } catch (i) {
      o = new g({
        body: u,
        details: i.message,
        url: e
      });
    }
  }
  throw o;
}
export {
  H as ccipRequest,
  B as offchainLookup,
  G as offchainLookupAbiItem,
  _ as offchainLookupSignature
};
