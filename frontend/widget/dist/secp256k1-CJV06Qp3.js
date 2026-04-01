import { H as se, j as ce, k as fe, l as Ut, m as ae, r as ue, n as le, o as de } from "./index-BnNG2YDZ.js";
const Ht = /* @__PURE__ */ BigInt(0), $t = /* @__PURE__ */ BigInt(1), he = /* @__PURE__ */ BigInt(2);
function nt(n) {
  return n instanceof Uint8Array || ArrayBuffer.isView(n) && n.constructor.name === "Uint8Array";
}
function wt(n) {
  if (!nt(n))
    throw new Error("Uint8Array expected");
}
function st(n, e) {
  if (typeof e != "boolean")
    throw new Error(n + " boolean expected, got " + e);
}
const we = /* @__PURE__ */ Array.from({ length: 256 }, (n, e) => e.toString(16).padStart(2, "0"));
function ct(n) {
  wt(n);
  let e = "";
  for (let t = 0; t < n.length; t++)
    e += we[n[t]];
  return e;
}
function lt(n) {
  const e = n.toString(16);
  return e.length & 1 ? "0" + e : e;
}
function zt(n) {
  if (typeof n != "string")
    throw new Error("hex string expected, got " + typeof n);
  return n === "" ? Ht : BigInt("0x" + n);
}
const $ = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function _t(n) {
  if (n >= $._0 && n <= $._9)
    return n - $._0;
  if (n >= $.A && n <= $.F)
    return n - ($.A - 10);
  if (n >= $.a && n <= $.f)
    return n - ($.a - 10);
}
function dt(n) {
  if (typeof n != "string")
    throw new Error("hex string expected, got " + typeof n);
  const e = n.length, t = e / 2;
  if (e % 2)
    throw new Error("hex string expected, got unpadded hex of length " + e);
  const r = new Uint8Array(t);
  for (let i = 0, s = 0; i < t; i++, s += 2) {
    const f = _t(n.charCodeAt(s)), a = _t(n.charCodeAt(s + 1));
    if (f === void 0 || a === void 0) {
      const o = n[s] + n[s + 1];
      throw new Error('hex string expected, got non-hex character "' + o + '" at index ' + s);
    }
    r[i] = f * 16 + a;
  }
  return r;
}
function tt(n) {
  return zt(ct(n));
}
function Tt(n) {
  return wt(n), zt(ct(Uint8Array.from(n).reverse()));
}
function ft(n, e) {
  return dt(n.toString(16).padStart(e * 2, "0"));
}
function kt(n, e) {
  return ft(n, e).reverse();
}
function P(n, e, t) {
  let r;
  if (typeof e == "string")
    try {
      r = dt(e);
    } catch (s) {
      throw new Error(n + " must be hex string or Uint8Array, cause: " + s);
    }
  else if (nt(e))
    r = Uint8Array.from(e);
  else
    throw new Error(n + " must be hex string or Uint8Array");
  const i = r.length;
  if (typeof t == "number" && i !== t)
    throw new Error(n + " of length " + t + " expected, got " + i);
  return r;
}
function ht(...n) {
  let e = 0;
  for (let r = 0; r < n.length; r++) {
    const i = n[r];
    wt(i), e += i.length;
  }
  const t = new Uint8Array(e);
  for (let r = 0, i = 0; r < n.length; r++) {
    const s = n[r];
    t.set(s, i), i += s.length;
  }
  return t;
}
const Et = (n) => typeof n == "bigint" && Ht <= n;
function yt(n, e, t) {
  return Et(n) && Et(e) && Et(t) && e <= n && n < t;
}
function et(n, e, t, r) {
  if (!yt(e, t, r))
    throw new Error("expected valid " + n + ": " + t + " <= n < " + r + ", got " + e);
}
function Gt(n) {
  let e;
  for (e = 0; n > Ht; n >>= $t, e += 1)
    ;
  return e;
}
const Zt = (n) => (he << BigInt(n - 1)) - $t, Bt = (n) => new Uint8Array(n), Ct = (n) => Uint8Array.from(n);
function Wt(n, e, t) {
  if (typeof n != "number" || n < 2)
    throw new Error("hashLen must be a number");
  if (typeof e != "number" || e < 2)
    throw new Error("qByteLen must be a number");
  if (typeof t != "function")
    throw new Error("hmacFn must be a function");
  let r = Bt(n), i = Bt(n), s = 0;
  const f = () => {
    r.fill(1), i.fill(0), s = 0;
  }, a = (...I) => t(i, r, ...I), o = (I = Bt()) => {
    i = a(Ct([0]), I), r = a(), I.length !== 0 && (i = a(Ct([1]), I), r = a());
  }, u = () => {
    if (s++ >= 1e3)
      throw new Error("drbg: tried 1000 values");
    let I = 0;
    const d = [];
    for (; I < e; ) {
      r = a();
      const v = r.slice();
      d.push(v), I += r.length;
    }
    return ht(...d);
  };
  return (I, d) => {
    f(), o(I);
    let v;
    for (; !(v = d(u())); )
      o();
    return f(), v;
  };
}
const ge = {
  bigint: (n) => typeof n == "bigint",
  function: (n) => typeof n == "function",
  boolean: (n) => typeof n == "boolean",
  string: (n) => typeof n == "string",
  stringOrUint8Array: (n) => typeof n == "string" || nt(n),
  isSafeInteger: (n) => Number.isSafeInteger(n),
  array: (n) => Array.isArray(n),
  field: (n, e) => e.Fp.isValid(n),
  hash: (n) => typeof n == "function" && Number.isSafeInteger(n.outputLen)
};
function gt(n, e, t = {}) {
  const r = (i, s, f) => {
    const a = ge[s];
    if (typeof a != "function")
      throw new Error("invalid validator function");
    const o = n[i];
    if (!(f && o === void 0) && !a(o, n))
      throw new Error("param " + String(i) + " is invalid. Expected " + s + ", got " + o);
  };
  for (const [i, s] of Object.entries(e))
    r(i, s, !1);
  for (const [i, s] of Object.entries(t))
    r(i, s, !0);
  return n;
}
function It(n) {
  const e = /* @__PURE__ */ new WeakMap();
  return (t, ...r) => {
    const i = e.get(t);
    if (i !== void 0)
      return i;
    const s = n(t, ...r);
    return e.set(t, s), s;
  };
}
const pe = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  aInRange: et,
  abool: st,
  abytes: wt,
  bitLen: Gt,
  bitMask: Zt,
  bytesToHex: ct,
  bytesToNumberBE: tt,
  bytesToNumberLE: Tt,
  concatBytes: ht,
  createHmacDrbg: Wt,
  ensureBytes: P,
  hexToBytes: dt,
  hexToNumber: zt,
  inRange: yt,
  isBytes: nt,
  memoized: It,
  numberToBytesBE: ft,
  numberToBytesLE: kt,
  numberToHexUnpadded: lt,
  validateObject: gt
}, Symbol.toStringTag, { value: "Module" }));
class Xt extends se {
  constructor(e, t) {
    super(), this.finished = !1, this.destroyed = !1, ce(e);
    const r = fe(t);
    if (this.iHash = e.create(), typeof this.iHash.update != "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen, this.outputLen = this.iHash.outputLen;
    const i = this.blockLen, s = new Uint8Array(i);
    s.set(r.length > i ? e.create().update(r).digest() : r);
    for (let f = 0; f < s.length; f++)
      s[f] ^= 54;
    this.iHash.update(s), this.oHash = e.create();
    for (let f = 0; f < s.length; f++)
      s[f] ^= 106;
    this.oHash.update(s), s.fill(0);
  }
  update(e) {
    return Ut(this), this.iHash.update(e), this;
  }
  digestInto(e) {
    Ut(this), ae(e, this.outputLen), this.finished = !0, this.iHash.digestInto(e), this.oHash.update(e), this.oHash.digestInto(e), this.destroy();
  }
  digest() {
    const e = new Uint8Array(this.oHash.outputLen);
    return this.digestInto(e), e;
  }
  _cloneInto(e) {
    e || (e = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash: t, iHash: r, finished: i, destroyed: s, blockLen: f, outputLen: a } = this;
    return e = e, e.finished = i, e.destroyed = s, e.blockLen = f, e.outputLen = a, e.oHash = t._cloneInto(e.oHash), e.iHash = r._cloneInto(e.iHash), e;
  }
  destroy() {
    this.destroyed = !0, this.oHash.destroy(), this.iHash.destroy();
  }
}
const Dt = (n, e, t) => new Xt(n, e).update(t).digest();
Dt.create = (n, e) => new Xt(n, e);
const R = BigInt(0), T = BigInt(1), J = /* @__PURE__ */ BigInt(2), ye = /* @__PURE__ */ BigInt(3), Nt = /* @__PURE__ */ BigInt(4), Mt = /* @__PURE__ */ BigInt(5), jt = /* @__PURE__ */ BigInt(8);
function j(n, e) {
  const t = n % e;
  return t >= R ? t : e + t;
}
function me(n, e, t) {
  if (e < R)
    throw new Error("invalid exponent, negatives unsupported");
  if (t <= R)
    throw new Error("invalid modulus");
  if (t === T)
    return R;
  let r = T;
  for (; e > R; )
    e & T && (r = r * n % t), n = n * n % t, e >>= T;
  return r;
}
function Y(n, e, t) {
  let r = n;
  for (; e-- > R; )
    r *= r, r %= t;
  return r;
}
function qt(n, e) {
  if (n === R)
    throw new Error("invert: expected non-zero number");
  if (e <= R)
    throw new Error("invert: expected positive modulus, got " + e);
  let t = j(n, e), r = e, i = R, s = T;
  for (; t !== R; ) {
    const a = r / t, o = r % t, u = i - s * a;
    r = t, t = o, i = s, s = u;
  }
  if (r !== T)
    throw new Error("invert: does not exist");
  return j(i, e);
}
function be(n) {
  const e = (n - T) / J;
  let t, r, i;
  for (t = n - T, r = 0; t % J === R; t /= J, r++)
    ;
  for (i = J; i < n && me(i, e, n) !== n - T; i++)
    if (i > 1e3)
      throw new Error("Cannot find square root: likely non-prime P");
  if (r === 1) {
    const f = (n + T) / Nt;
    return function(o, u) {
      const E = o.pow(u, f);
      if (!o.eql(o.sqr(E), u))
        throw new Error("Cannot find square root");
      return E;
    };
  }
  const s = (t + T) / J;
  return function(a, o) {
    if (a.pow(o, e) === a.neg(a.ONE))
      throw new Error("Cannot find square root");
    let u = r, E = a.pow(a.mul(a.ONE, i), t), I = a.pow(o, s), d = a.pow(o, t);
    for (; !a.eql(d, a.ONE); ) {
      if (a.eql(d, a.ZERO))
        return a.ZERO;
      let v = 1;
      for (let p = a.sqr(d); v < u && !a.eql(p, a.ONE); v++)
        p = a.sqr(p);
      const q = a.pow(E, T << BigInt(u - v - 1));
      E = a.sqr(q), I = a.mul(I, q), d = a.mul(d, E), u = v;
    }
    return I;
  };
}
function Ee(n) {
  if (n % Nt === ye) {
    const e = (n + T) / Nt;
    return function(r, i) {
      const s = r.pow(i, e);
      if (!r.eql(r.sqr(s), i))
        throw new Error("Cannot find square root");
      return s;
    };
  }
  if (n % jt === Mt) {
    const e = (n - Mt) / jt;
    return function(r, i) {
      const s = r.mul(i, J), f = r.pow(s, e), a = r.mul(i, f), o = r.mul(r.mul(a, J), f), u = r.mul(a, r.sub(o, r.ONE));
      if (!r.eql(r.sqr(u), i))
        throw new Error("Cannot find square root");
      return u;
    };
  }
  return be(n);
}
const Be = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function ve(n) {
  const e = {
    ORDER: "bigint",
    MASK: "bigint",
    BYTES: "isSafeInteger",
    BITS: "isSafeInteger"
  }, t = Be.reduce((r, i) => (r[i] = "function", r), e);
  return gt(n, t);
}
function xe(n, e, t) {
  if (t < R)
    throw new Error("invalid exponent, negatives unsupported");
  if (t === R)
    return n.ONE;
  if (t === T)
    return e;
  let r = n.ONE, i = e;
  for (; t > R; )
    t & T && (r = n.mul(r, i)), i = n.sqr(i), t >>= T;
  return r;
}
function Se(n, e) {
  const t = new Array(e.length), r = e.reduce((s, f, a) => n.is0(f) ? s : (t[a] = s, n.mul(s, f)), n.ONE), i = n.inv(r);
  return e.reduceRight((s, f, a) => n.is0(f) ? s : (t[a] = n.mul(s, t[a]), n.mul(s, f)), i), t;
}
function Qt(n, e) {
  const t = e !== void 0 ? e : n.toString(2).length, r = Math.ceil(t / 8);
  return { nBitLength: t, nByteLength: r };
}
function Jt(n, e, t = !1, r = {}) {
  if (n <= R)
    throw new Error("invalid field: expected ORDER > 0, got " + n);
  const { nBitLength: i, nByteLength: s } = Qt(n, e);
  if (s > 2048)
    throw new Error("invalid field: expected ORDER of <= 2048 bytes");
  let f;
  const a = Object.freeze({
    ORDER: n,
    isLE: t,
    BITS: i,
    BYTES: s,
    MASK: Zt(i),
    ZERO: R,
    ONE: T,
    create: (o) => j(o, n),
    isValid: (o) => {
      if (typeof o != "bigint")
        throw new Error("invalid field element: expected bigint, got " + typeof o);
      return R <= o && o < n;
    },
    is0: (o) => o === R,
    isOdd: (o) => (o & T) === T,
    neg: (o) => j(-o, n),
    eql: (o, u) => o === u,
    sqr: (o) => j(o * o, n),
    add: (o, u) => j(o + u, n),
    sub: (o, u) => j(o - u, n),
    mul: (o, u) => j(o * u, n),
    pow: (o, u) => xe(a, o, u),
    div: (o, u) => j(o * qt(u, n), n),
    // Same as above, but doesn't normalize
    sqrN: (o) => o * o,
    addN: (o, u) => o + u,
    subN: (o, u) => o - u,
    mulN: (o, u) => o * u,
    inv: (o) => qt(o, n),
    sqrt: r.sqrt || ((o) => (f || (f = Ee(n)), f(a, o))),
    invertBatch: (o) => Se(a, o),
    // TODO: do we really need constant cmov?
    // We don't have const-time bigints anyway, so probably will be not very useful
    cmov: (o, u, E) => E ? u : o,
    toBytes: (o) => t ? kt(o, s) : ft(o, s),
    fromBytes: (o) => {
      if (o.length !== s)
        throw new Error("Field.fromBytes: expected " + s + " bytes, got " + o.length);
      return t ? Tt(o) : tt(o);
    }
  });
  return Object.freeze(a);
}
function te(n) {
  if (typeof n != "bigint")
    throw new Error("field order must be bigint");
  const e = n.toString(2).length;
  return Math.ceil(e / 8);
}
function ee(n) {
  const e = te(n);
  return e + Math.ceil(e / 2);
}
function Ae(n, e, t = !1) {
  const r = n.length, i = te(e), s = ee(e);
  if (r < 16 || r < s || r > 1024)
    throw new Error("expected " + s + "-1024 bytes of input, got " + r);
  const f = t ? Tt(n) : tt(n), a = j(f, e - T) + T;
  return t ? kt(a, i) : ft(a, i);
}
const Vt = BigInt(0), pt = BigInt(1);
function vt(n, e) {
  const t = e.negate();
  return n ? t : e;
}
function ne(n, e) {
  if (!Number.isSafeInteger(n) || n <= 0 || n > e)
    throw new Error("invalid window size, expected [1.." + e + "], got W=" + n);
}
function xt(n, e) {
  ne(n, e);
  const t = Math.ceil(e / n) + 1, r = 2 ** (n - 1);
  return { windows: t, windowSize: r };
}
function Ie(n, e) {
  if (!Array.isArray(n))
    throw new Error("array expected");
  n.forEach((t, r) => {
    if (!(t instanceof e))
      throw new Error("invalid point at index " + r);
  });
}
function Ne(n, e) {
  if (!Array.isArray(n))
    throw new Error("array of scalars expected");
  n.forEach((t, r) => {
    if (!e.isValid(t))
      throw new Error("invalid scalar at index " + r);
  });
}
const St = /* @__PURE__ */ new WeakMap(), re = /* @__PURE__ */ new WeakMap();
function At(n) {
  return re.get(n) || 1;
}
function qe(n, e) {
  return {
    constTimeNegate: vt,
    hasPrecomputes(t) {
      return At(t) !== 1;
    },
    // non-const time multiplication ladder
    unsafeLadder(t, r, i = n.ZERO) {
      let s = t;
      for (; r > Vt; )
        r & pt && (i = i.add(s)), s = s.double(), r >>= pt;
      return i;
    },
    /**
     * Creates a wNAF precomputation window. Used for caching.
     * Default window size is set by `utils.precompute()` and is equal to 8.
     * Number of precomputed points depends on the curve size:
     * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
     * - 𝑊 is the window size
     * - 𝑛 is the bitlength of the curve order.
     * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
     * @param elm Point instance
     * @param W window size
     * @returns precomputed point tables flattened to a single array
     */
    precomputeWindow(t, r) {
      const { windows: i, windowSize: s } = xt(r, e), f = [];
      let a = t, o = a;
      for (let u = 0; u < i; u++) {
        o = a, f.push(o);
        for (let E = 1; E < s; E++)
          o = o.add(a), f.push(o);
        a = o.double();
      }
      return f;
    },
    /**
     * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
     * @param W window size
     * @param precomputes precomputed tables
     * @param n scalar (we don't check here, but should be less than curve order)
     * @returns real and fake (for const-time) points
     */
    wNAF(t, r, i) {
      const { windows: s, windowSize: f } = xt(t, e);
      let a = n.ZERO, o = n.BASE;
      const u = BigInt(2 ** t - 1), E = 2 ** t, I = BigInt(t);
      for (let d = 0; d < s; d++) {
        const v = d * f;
        let q = Number(i & u);
        i >>= I, q > f && (q -= E, i += pt);
        const p = v, c = v + Math.abs(q) - 1, h = d % 2 !== 0, y = q < 0;
        q === 0 ? o = o.add(vt(h, r[p])) : a = a.add(vt(y, r[c]));
      }
      return { p: a, f: o };
    },
    /**
     * Implements ec unsafe (non const-time) multiplication using precomputed tables and w-ary non-adjacent form.
     * @param W window size
     * @param precomputes precomputed tables
     * @param n scalar (we don't check here, but should be less than curve order)
     * @param acc accumulator point to add result of multiplication
     * @returns point
     */
    wNAFUnsafe(t, r, i, s = n.ZERO) {
      const { windows: f, windowSize: a } = xt(t, e), o = BigInt(2 ** t - 1), u = 2 ** t, E = BigInt(t);
      for (let I = 0; I < f; I++) {
        const d = I * a;
        if (i === Vt)
          break;
        let v = Number(i & o);
        if (i >>= E, v > a && (v -= u, i += pt), v === 0)
          continue;
        let q = r[d + Math.abs(v) - 1];
        v < 0 && (q = q.negate()), s = s.add(q);
      }
      return s;
    },
    getPrecomputes(t, r, i) {
      let s = St.get(r);
      return s || (s = this.precomputeWindow(r, t), t !== 1 && St.set(r, i(s))), s;
    },
    wNAFCached(t, r, i) {
      const s = At(t);
      return this.wNAF(s, this.getPrecomputes(s, t, i), r);
    },
    wNAFCachedUnsafe(t, r, i, s) {
      const f = At(t);
      return f === 1 ? this.unsafeLadder(t, r, s) : this.wNAFUnsafe(f, this.getPrecomputes(f, t, i), r, s);
    },
    // We calculate precomputes for elliptic curve point multiplication
    // using windowed method. This specifies window size and
    // stores precomputed values. Usually only base point would be precomputed.
    setWindowSize(t, r) {
      ne(r, e), re.set(t, r), St.delete(t);
    }
  };
}
function Oe(n, e, t, r) {
  if (Ie(t, n), Ne(r, e), t.length !== r.length)
    throw new Error("arrays of points and scalars must have equal length");
  const i = n.ZERO, s = Gt(BigInt(t.length)), f = s > 12 ? s - 3 : s > 4 ? s - 2 : s ? 2 : 1, a = (1 << f) - 1, o = new Array(a + 1).fill(i), u = Math.floor((e.BITS - 1) / f) * f;
  let E = i;
  for (let I = u; I >= 0; I -= f) {
    o.fill(i);
    for (let v = 0; v < r.length; v++) {
      const q = r[v], p = Number(q >> BigInt(I) & BigInt(a));
      o[p] = o[p].add(t[v]);
    }
    let d = i;
    for (let v = o.length - 1, q = i; v > 0; v--)
      q = q.add(o[v]), d = d.add(q);
    if (E = E.add(d), I !== 0)
      for (let v = 0; v < f; v++)
        E = E.double();
  }
  return E;
}
function oe(n) {
  return ve(n.Fp), gt(n, {
    n: "bigint",
    h: "bigint",
    Gx: "field",
    Gy: "field"
  }, {
    nBitLength: "isSafeInteger",
    nByteLength: "isSafeInteger"
  }), Object.freeze({
    ...Qt(n.n, n.nBitLength),
    ...n,
    p: n.Fp.ORDER
  });
}
function Yt(n) {
  n.lowS !== void 0 && st("lowS", n.lowS), n.prehash !== void 0 && st("prehash", n.prehash);
}
function Le(n) {
  const e = oe(n);
  gt(e, {
    a: "field",
    b: "field"
  }, {
    allowedPrivateKeyLengths: "array",
    wrapPrivateKey: "boolean",
    isTorsionFree: "function",
    clearCofactor: "function",
    allowInfinityPoint: "boolean",
    fromBytes: "function",
    toBytes: "function"
  });
  const { endo: t, Fp: r, a: i } = e;
  if (t) {
    if (!r.eql(i, r.ZERO))
      throw new Error("invalid endomorphism, can only be defined for Koblitz curves that have a=0");
    if (typeof t != "object" || typeof t.beta != "bigint" || typeof t.splitScalar != "function")
      throw new Error("invalid endomorphism, expected beta: bigint and splitScalar: function");
  }
  return Object.freeze({ ...e });
}
const { bytesToNumberBE: He, hexToBytes: ze } = pe;
class Te extends Error {
  constructor(e = "") {
    super(e);
  }
}
const G = {
  // asn.1 DER encoding utils
  Err: Te,
  // Basic building block is TLV (Tag-Length-Value)
  _tlv: {
    encode: (n, e) => {
      const { Err: t } = G;
      if (n < 0 || n > 256)
        throw new t("tlv.encode: wrong tag");
      if (e.length & 1)
        throw new t("tlv.encode: unpadded data");
      const r = e.length / 2, i = lt(r);
      if (i.length / 2 & 128)
        throw new t("tlv.encode: long form length too big");
      const s = r > 127 ? lt(i.length / 2 | 128) : "";
      return lt(n) + s + i + e;
    },
    // v - value, l - left bytes (unparsed)
    decode(n, e) {
      const { Err: t } = G;
      let r = 0;
      if (n < 0 || n > 256)
        throw new t("tlv.encode: wrong tag");
      if (e.length < 2 || e[r++] !== n)
        throw new t("tlv.decode: wrong tlv");
      const i = e[r++], s = !!(i & 128);
      let f = 0;
      if (!s)
        f = i;
      else {
        const o = i & 127;
        if (!o)
          throw new t("tlv.decode(long): indefinite length not supported");
        if (o > 4)
          throw new t("tlv.decode(long): byte length is too big");
        const u = e.subarray(r, r + o);
        if (u.length !== o)
          throw new t("tlv.decode: length bytes not complete");
        if (u[0] === 0)
          throw new t("tlv.decode(long): zero leftmost byte");
        for (const E of u)
          f = f << 8 | E;
        if (r += o, f < 128)
          throw new t("tlv.decode(long): not minimal encoding");
      }
      const a = e.subarray(r, r + f);
      if (a.length !== f)
        throw new t("tlv.decode: wrong value length");
      return { v: a, l: e.subarray(r + f) };
    }
  },
  // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
  // since we always use positive integers here. It must always be empty:
  // - add zero byte if exists
  // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
  _int: {
    encode(n) {
      const { Err: e } = G;
      if (n < W)
        throw new e("integer: negative integers are not allowed");
      let t = lt(n);
      if (Number.parseInt(t[0], 16) & 8 && (t = "00" + t), t.length & 1)
        throw new e("unexpected DER parsing assertion: unpadded hex");
      return t;
    },
    decode(n) {
      const { Err: e } = G;
      if (n[0] & 128)
        throw new e("invalid signature integer: negative");
      if (n[0] === 0 && !(n[1] & 128))
        throw new e("invalid signature integer: unnecessary leading zero");
      return He(n);
    }
  },
  toSig(n) {
    const { Err: e, _int: t, _tlv: r } = G, i = typeof n == "string" ? ze(n) : n;
    wt(i);
    const { v: s, l: f } = r.decode(48, i);
    if (f.length)
      throw new e("invalid signature: left bytes after parsing");
    const { v: a, l: o } = r.decode(2, s), { v: u, l: E } = r.decode(2, o);
    if (E.length)
      throw new e("invalid signature: left bytes after parsing");
    return { r: t.decode(a), s: t.decode(u) };
  },
  hexFromSig(n) {
    const { _tlv: e, _int: t } = G, r = e.encode(2, t.encode(n.r)), i = e.encode(2, t.encode(n.s)), s = r + i;
    return e.encode(48, s);
  }
}, W = BigInt(0), Z = BigInt(1);
BigInt(2);
const Kt = BigInt(3);
BigInt(4);
function ke(n) {
  const e = Le(n), { Fp: t } = e, r = Jt(e.n, e.nBitLength), i = e.toBytes || ((p, c, h) => {
    const y = c.toAffine();
    return ht(Uint8Array.from([4]), t.toBytes(y.x), t.toBytes(y.y));
  }), s = e.fromBytes || ((p) => {
    const c = p.subarray(1), h = t.fromBytes(c.subarray(0, t.BYTES)), y = t.fromBytes(c.subarray(t.BYTES, 2 * t.BYTES));
    return { x: h, y };
  });
  function f(p) {
    const { a: c, b: h } = e, y = t.sqr(p), m = t.mul(y, p);
    return t.add(t.add(m, t.mul(p, c)), h);
  }
  if (!t.eql(t.sqr(e.Gy), f(e.Gx)))
    throw new Error("bad generator point: equation left != right");
  function a(p) {
    return yt(p, Z, e.n);
  }
  function o(p) {
    const { allowedPrivateKeyLengths: c, nByteLength: h, wrapPrivateKey: y, n: m } = e;
    if (c && typeof p != "bigint") {
      if (nt(p) && (p = ct(p)), typeof p != "string" || !c.includes(p.length))
        throw new Error("invalid private key");
      p = p.padStart(h * 2, "0");
    }
    let N;
    try {
      N = typeof p == "bigint" ? p : tt(P("private key", p, h));
    } catch {
      throw new Error("invalid private key, expected hex or " + h + " bytes, got " + typeof p);
    }
    return y && (N = j(N, m)), et("private key", N, Z, m), N;
  }
  function u(p) {
    if (!(p instanceof d))
      throw new Error("ProjectivePoint expected");
  }
  const E = It((p, c) => {
    const { px: h, py: y, pz: m } = p;
    if (t.eql(m, t.ONE))
      return { x: h, y };
    const N = p.is0();
    c == null && (c = N ? t.ONE : t.inv(m));
    const L = t.mul(h, c), A = t.mul(y, c), b = t.mul(m, c);
    if (N)
      return { x: t.ZERO, y: t.ZERO };
    if (!t.eql(b, t.ONE))
      throw new Error("invZ was invalid");
    return { x: L, y: A };
  }), I = It((p) => {
    if (p.is0()) {
      if (e.allowInfinityPoint && !t.is0(p.py))
        return;
      throw new Error("bad point: ZERO");
    }
    const { x: c, y: h } = p.toAffine();
    if (!t.isValid(c) || !t.isValid(h))
      throw new Error("bad point: x or y not FE");
    const y = t.sqr(h), m = f(c);
    if (!t.eql(y, m))
      throw new Error("bad point: equation left != right");
    if (!p.isTorsionFree())
      throw new Error("bad point: not in prime-order subgroup");
    return !0;
  });
  class d {
    constructor(c, h, y) {
      if (this.px = c, this.py = h, this.pz = y, c == null || !t.isValid(c))
        throw new Error("x required");
      if (h == null || !t.isValid(h))
        throw new Error("y required");
      if (y == null || !t.isValid(y))
        throw new Error("z required");
      Object.freeze(this);
    }
    // Does not validate if the point is on-curve.
    // Use fromHex instead, or call assertValidity() later.
    static fromAffine(c) {
      const { x: h, y } = c || {};
      if (!c || !t.isValid(h) || !t.isValid(y))
        throw new Error("invalid affine point");
      if (c instanceof d)
        throw new Error("projective point not allowed");
      const m = (N) => t.eql(N, t.ZERO);
      return m(h) && m(y) ? d.ZERO : new d(h, y, t.ONE);
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     * Takes a bunch of Projective Points but executes only one
     * inversion on all of them. Inversion is very slow operation,
     * so this improves performance massively.
     * Optimization: converts a list of projective points to a list of identical points with Z=1.
     */
    static normalizeZ(c) {
      const h = t.invertBatch(c.map((y) => y.pz));
      return c.map((y, m) => y.toAffine(h[m])).map(d.fromAffine);
    }
    /**
     * Converts hash string or Uint8Array to Point.
     * @param hex short/long ECDSA hex
     */
    static fromHex(c) {
      const h = d.fromAffine(s(P("pointHex", c)));
      return h.assertValidity(), h;
    }
    // Multiplies generator point by privateKey.
    static fromPrivateKey(c) {
      return d.BASE.multiply(o(c));
    }
    // Multiscalar Multiplication
    static msm(c, h) {
      return Oe(d, r, c, h);
    }
    // "Private method", don't use it directly
    _setWindowSize(c) {
      q.setWindowSize(this, c);
    }
    // A point on curve is valid if it conforms to equation.
    assertValidity() {
      I(this);
    }
    hasEvenY() {
      const { y: c } = this.toAffine();
      if (t.isOdd)
        return !t.isOdd(c);
      throw new Error("Field doesn't support isOdd");
    }
    /**
     * Compare one point to another.
     */
    equals(c) {
      u(c);
      const { px: h, py: y, pz: m } = this, { px: N, py: L, pz: A } = c, b = t.eql(t.mul(h, A), t.mul(N, m)), S = t.eql(t.mul(y, A), t.mul(L, m));
      return b && S;
    }
    /**
     * Flips point to one corresponding to (x, -y) in Affine coordinates.
     */
    negate() {
      return new d(this.px, t.neg(this.py), this.pz);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a: c, b: h } = e, y = t.mul(h, Kt), { px: m, py: N, pz: L } = this;
      let A = t.ZERO, b = t.ZERO, S = t.ZERO, B = t.mul(m, m), U = t.mul(N, N), z = t.mul(L, L), H = t.mul(m, N);
      return H = t.add(H, H), S = t.mul(m, L), S = t.add(S, S), A = t.mul(c, S), b = t.mul(y, z), b = t.add(A, b), A = t.sub(U, b), b = t.add(U, b), b = t.mul(A, b), A = t.mul(H, A), S = t.mul(y, S), z = t.mul(c, z), H = t.sub(B, z), H = t.mul(c, H), H = t.add(H, S), S = t.add(B, B), B = t.add(S, B), B = t.add(B, z), B = t.mul(B, H), b = t.add(b, B), z = t.mul(N, L), z = t.add(z, z), B = t.mul(z, H), A = t.sub(A, B), S = t.mul(z, U), S = t.add(S, S), S = t.add(S, S), new d(A, b, S);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(c) {
      u(c);
      const { px: h, py: y, pz: m } = this, { px: N, py: L, pz: A } = c;
      let b = t.ZERO, S = t.ZERO, B = t.ZERO;
      const U = e.a, z = t.mul(e.b, Kt);
      let H = t.mul(h, N), V = t.mul(y, L), l = t.mul(m, A), w = t.add(h, y), g = t.add(N, L);
      w = t.mul(w, g), g = t.add(H, V), w = t.sub(w, g), g = t.add(h, m);
      let x = t.add(N, A);
      return g = t.mul(g, x), x = t.add(H, l), g = t.sub(g, x), x = t.add(y, m), b = t.add(L, A), x = t.mul(x, b), b = t.add(V, l), x = t.sub(x, b), B = t.mul(U, g), b = t.mul(z, l), B = t.add(b, B), b = t.sub(V, B), B = t.add(V, B), S = t.mul(b, B), V = t.add(H, H), V = t.add(V, H), l = t.mul(U, l), g = t.mul(z, g), V = t.add(V, l), l = t.sub(H, l), l = t.mul(U, l), g = t.add(g, l), H = t.mul(V, g), S = t.add(S, H), H = t.mul(x, g), b = t.mul(w, b), b = t.sub(b, H), H = t.mul(w, V), B = t.mul(x, B), B = t.add(B, H), new d(b, S, B);
    }
    subtract(c) {
      return this.add(c.negate());
    }
    is0() {
      return this.equals(d.ZERO);
    }
    wNAF(c) {
      return q.wNAFCached(this, c, d.normalizeZ);
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed private key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(c) {
      const { endo: h, n: y } = e;
      et("scalar", c, W, y);
      const m = d.ZERO;
      if (c === W)
        return m;
      if (this.is0() || c === Z)
        return this;
      if (!h || q.hasPrecomputes(this))
        return q.wNAFCachedUnsafe(this, c, d.normalizeZ);
      let { k1neg: N, k1: L, k2neg: A, k2: b } = h.splitScalar(c), S = m, B = m, U = this;
      for (; L > W || b > W; )
        L & Z && (S = S.add(U)), b & Z && (B = B.add(U)), U = U.double(), L >>= Z, b >>= Z;
      return N && (S = S.negate()), A && (B = B.negate()), B = new d(t.mul(B.px, h.beta), B.py, B.pz), S.add(B);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar by which the point would be multiplied
     * @returns New point
     */
    multiply(c) {
      const { endo: h, n: y } = e;
      et("scalar", c, Z, y);
      let m, N;
      if (h) {
        const { k1neg: L, k1: A, k2neg: b, k2: S } = h.splitScalar(c);
        let { p: B, f: U } = this.wNAF(A), { p: z, f: H } = this.wNAF(S);
        B = q.constTimeNegate(L, B), z = q.constTimeNegate(b, z), z = new d(t.mul(z.px, h.beta), z.py, z.pz), m = B.add(z), N = U.add(H);
      } else {
        const { p: L, f: A } = this.wNAF(c);
        m = L, N = A;
      }
      return d.normalizeZ([m, N])[0];
    }
    /**
     * Efficiently calculate `aP + bQ`. Unsafe, can expose private key, if used incorrectly.
     * Not using Strauss-Shamir trick: precomputation tables are faster.
     * The trick could be useful if both P and Q are not G (not in our case).
     * @returns non-zero affine point
     */
    multiplyAndAddUnsafe(c, h, y) {
      const m = d.BASE, N = (A, b) => b === W || b === Z || !A.equals(m) ? A.multiplyUnsafe(b) : A.multiply(b), L = N(this, h).add(N(c, y));
      return L.is0() ? void 0 : L;
    }
    // Converts Projective point to affine (x, y) coordinates.
    // Can accept precomputed Z^-1 - for example, from invertBatch.
    // (x, y, z) ∋ (x=x/z, y=y/z)
    toAffine(c) {
      return E(this, c);
    }
    isTorsionFree() {
      const { h: c, isTorsionFree: h } = e;
      if (c === Z)
        return !0;
      if (h)
        return h(d, this);
      throw new Error("isTorsionFree() has not been declared for the elliptic curve");
    }
    clearCofactor() {
      const { h: c, clearCofactor: h } = e;
      return c === Z ? this : h ? h(d, this) : this.multiplyUnsafe(e.h);
    }
    toRawBytes(c = !0) {
      return st("isCompressed", c), this.assertValidity(), i(d, this, c);
    }
    toHex(c = !0) {
      return st("isCompressed", c), ct(this.toRawBytes(c));
    }
  }
  d.BASE = new d(e.Gx, e.Gy, t.ONE), d.ZERO = new d(t.ZERO, t.ONE, t.ZERO);
  const v = e.nBitLength, q = qe(d, e.endo ? Math.ceil(v / 2) : v);
  return {
    CURVE: e,
    ProjectivePoint: d,
    normPrivateKeyToScalar: o,
    weierstrassEquation: f,
    isWithinCurveOrder: a
  };
}
function Ze(n) {
  const e = oe(n);
  return gt(e, {
    hash: "hash",
    hmac: "function",
    randomBytes: "function"
  }, {
    bits2int: "function",
    bits2int_modN: "function",
    lowS: "boolean"
  }), Object.freeze({ lowS: !0, ...e });
}
function Re(n) {
  const e = Ze(n), { Fp: t, n: r } = e, i = t.BYTES + 1, s = 2 * t.BYTES + 1;
  function f(l) {
    return j(l, r);
  }
  function a(l) {
    return qt(l, r);
  }
  const { ProjectivePoint: o, normPrivateKeyToScalar: u, weierstrassEquation: E, isWithinCurveOrder: I } = ke({
    ...e,
    toBytes(l, w, g) {
      const x = w.toAffine(), O = t.toBytes(x.x), k = ht;
      return st("isCompressed", g), g ? k(Uint8Array.from([w.hasEvenY() ? 2 : 3]), O) : k(Uint8Array.from([4]), O, t.toBytes(x.y));
    },
    fromBytes(l) {
      const w = l.length, g = l[0], x = l.subarray(1);
      if (w === i && (g === 2 || g === 3)) {
        const O = tt(x);
        if (!yt(O, Z, t.ORDER))
          throw new Error("Point is not on curve");
        const k = E(O);
        let C;
        try {
          C = t.sqrt(k);
        } catch (K) {
          const M = K instanceof Error ? ": " + K.message : "";
          throw new Error("Point is not on curve" + M);
        }
        const _ = (C & Z) === Z;
        return (g & 1) === 1 !== _ && (C = t.neg(C)), { x: O, y: C };
      } else if (w === s && g === 4) {
        const O = t.fromBytes(x.subarray(0, t.BYTES)), k = t.fromBytes(x.subarray(t.BYTES, 2 * t.BYTES));
        return { x: O, y: k };
      } else {
        const O = i, k = s;
        throw new Error("invalid Point, expected length of " + O + ", or uncompressed " + k + ", got " + w);
      }
    }
  }), d = (l) => ct(ft(l, e.nByteLength));
  function v(l) {
    const w = r >> Z;
    return l > w;
  }
  function q(l) {
    return v(l) ? f(-l) : l;
  }
  const p = (l, w, g) => tt(l.slice(w, g));
  class c {
    constructor(w, g, x) {
      this.r = w, this.s = g, this.recovery = x, this.assertValidity();
    }
    // pair (bytes of r, bytes of s)
    static fromCompact(w) {
      const g = e.nByteLength;
      return w = P("compactSignature", w, g * 2), new c(p(w, 0, g), p(w, g, 2 * g));
    }
    // DER encoded ECDSA signature
    // https://bitcoin.stackexchange.com/questions/57644/what-are-the-parts-of-a-bitcoin-transaction-input-script
    static fromDER(w) {
      const { r: g, s: x } = G.toSig(P("DER", w));
      return new c(g, x);
    }
    assertValidity() {
      et("r", this.r, Z, r), et("s", this.s, Z, r);
    }
    addRecoveryBit(w) {
      return new c(this.r, this.s, w);
    }
    recoverPublicKey(w) {
      const { r: g, s: x, recovery: O } = this, k = A(P("msgHash", w));
      if (O == null || ![0, 1, 2, 3].includes(O))
        throw new Error("recovery id invalid");
      const C = O === 2 || O === 3 ? g + e.n : g;
      if (C >= t.ORDER)
        throw new Error("recovery id 2 or 3 invalid");
      const _ = (O & 1) === 0 ? "02" : "03", F = o.fromHex(_ + d(C)), K = a(C), M = f(-k * K), rt = f(x * K), X = o.BASE.multiplyAndAddUnsafe(F, M, rt);
      if (!X)
        throw new Error("point at infinify");
      return X.assertValidity(), X;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return v(this.s);
    }
    normalizeS() {
      return this.hasHighS() ? new c(this.r, f(-this.s), this.recovery) : this;
    }
    // DER-encoded
    toDERRawBytes() {
      return dt(this.toDERHex());
    }
    toDERHex() {
      return G.hexFromSig({ r: this.r, s: this.s });
    }
    // padded bytes of r, then padded bytes of s
    toCompactRawBytes() {
      return dt(this.toCompactHex());
    }
    toCompactHex() {
      return d(this.r) + d(this.s);
    }
  }
  const h = {
    isValidPrivateKey(l) {
      try {
        return u(l), !0;
      } catch {
        return !1;
      }
    },
    normPrivateKeyToScalar: u,
    /**
     * Produces cryptographically secure private key from random of size
     * (groupLen + ceil(groupLen / 2)) with modulo bias being negligible.
     */
    randomPrivateKey: () => {
      const l = ee(e.n);
      return Ae(e.randomBytes(l), e.n);
    },
    /**
     * Creates precompute table for an arbitrary EC point. Makes point "cached".
     * Allows to massively speed-up `point.multiply(scalar)`.
     * @returns cached point
     * @example
     * const fast = utils.precompute(8, ProjectivePoint.fromHex(someonesPubKey));
     * fast.multiply(privKey); // much faster ECDH now
     */
    precompute(l = 8, w = o.BASE) {
      return w._setWindowSize(l), w.multiply(BigInt(3)), w;
    }
  };
  function y(l, w = !0) {
    return o.fromPrivateKey(l).toRawBytes(w);
  }
  function m(l) {
    const w = nt(l), g = typeof l == "string", x = (w || g) && l.length;
    return w ? x === i || x === s : g ? x === 2 * i || x === 2 * s : l instanceof o;
  }
  function N(l, w, g = !0) {
    if (m(l))
      throw new Error("first arg must be private key");
    if (!m(w))
      throw new Error("second arg must be public key");
    return o.fromHex(w).multiply(u(l)).toRawBytes(g);
  }
  const L = e.bits2int || function(l) {
    if (l.length > 8192)
      throw new Error("input is too large");
    const w = tt(l), g = l.length * 8 - e.nBitLength;
    return g > 0 ? w >> BigInt(g) : w;
  }, A = e.bits2int_modN || function(l) {
    return f(L(l));
  }, b = Zt(e.nBitLength);
  function S(l) {
    return et("num < 2^" + e.nBitLength, l, W, b), ft(l, e.nByteLength);
  }
  function B(l, w, g = U) {
    if (["recovered", "canonical"].some((D) => D in g))
      throw new Error("sign() legacy options not supported");
    const { hash: x, randomBytes: O } = e;
    let { lowS: k, prehash: C, extraEntropy: _ } = g;
    k == null && (k = !0), l = P("msgHash", l), Yt(g), C && (l = P("prehashed msgHash", x(l)));
    const F = A(l), K = u(w), M = [S(K), S(F)];
    if (_ != null && _ !== !1) {
      const D = _ === !0 ? O(t.BYTES) : _;
      M.push(P("extraEntropy", D));
    }
    const rt = ht(...M), X = F;
    function mt(D) {
      const ot = L(D);
      if (!I(ot))
        return;
      const bt = a(ot), at = o.BASE.multiply(ot).toAffine(), Q = f(at.x);
      if (Q === W)
        return;
      const ut = f(bt * f(X + Q * K));
      if (ut === W)
        return;
      let it = (at.x === Q ? 0 : 2) | Number(at.y & Z), Rt = ut;
      return k && v(ut) && (Rt = q(ut), it ^= 1), new c(Q, Rt, it);
    }
    return { seed: rt, k2sig: mt };
  }
  const U = { lowS: e.lowS, prehash: !1 }, z = { lowS: e.lowS, prehash: !1 };
  function H(l, w, g = U) {
    const { seed: x, k2sig: O } = B(l, w, g), k = e;
    return Wt(k.hash.outputLen, k.nByteLength, k.hmac)(x, O);
  }
  o.BASE._setWindowSize(8);
  function V(l, w, g, x = z) {
    const O = l;
    w = P("msgHash", w), g = P("publicKey", g);
    const { lowS: k, prehash: C, format: _ } = x;
    if (Yt(x), "strict" in x)
      throw new Error("options.strict was renamed to lowS");
    if (_ !== void 0 && _ !== "compact" && _ !== "der")
      throw new Error("format must be compact or der");
    const F = typeof O == "string" || nt(O), K = !F && !_ && typeof O == "object" && O !== null && typeof O.r == "bigint" && typeof O.s == "bigint";
    if (!F && !K)
      throw new Error("invalid signature, expected Uint8Array, hex string or Signature instance");
    let M, rt;
    try {
      if (K && (M = new c(O.r, O.s)), F) {
        try {
          _ !== "compact" && (M = c.fromDER(O));
        } catch (it) {
          if (!(it instanceof G.Err))
            throw it;
        }
        !M && _ !== "der" && (M = c.fromCompact(O));
      }
      rt = o.fromHex(g);
    } catch {
      return !1;
    }
    if (!M || k && M.hasHighS())
      return !1;
    C && (w = e.hash(w));
    const { r: X, s: mt } = M, D = A(w), ot = a(mt), bt = f(D * ot), at = f(X * ot), Q = o.BASE.multiplyAndAddUnsafe(rt, bt, at)?.toAffine();
    return Q ? f(Q.x) === X : !1;
  }
  return {
    CURVE: e,
    getPublicKey: y,
    getSharedSecret: N,
    sign: H,
    verify: V,
    ProjectivePoint: o,
    Signature: c,
    utils: h
  };
}
function Ue(n) {
  return {
    hash: n,
    hmac: (e, ...t) => Dt(n, e, le(...t)),
    randomBytes: ue
  };
}
function _e(n, e) {
  const t = (r) => Re({ ...n, ...Ue(r) });
  return { ...t(e), create: t };
}
const ie = BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"), Pt = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"), Ce = BigInt(1), Ot = BigInt(2), Ft = (n, e) => (n + e / Ot) / e;
function Me(n) {
  const e = ie, t = BigInt(3), r = BigInt(6), i = BigInt(11), s = BigInt(22), f = BigInt(23), a = BigInt(44), o = BigInt(88), u = n * n * n % e, E = u * u * n % e, I = Y(E, t, e) * E % e, d = Y(I, t, e) * E % e, v = Y(d, Ot, e) * u % e, q = Y(v, i, e) * v % e, p = Y(q, s, e) * q % e, c = Y(p, a, e) * p % e, h = Y(c, o, e) * c % e, y = Y(h, a, e) * p % e, m = Y(y, t, e) * E % e, N = Y(m, f, e) * q % e, L = Y(N, r, e) * u % e, A = Y(L, Ot, e);
  if (!Lt.eql(Lt.sqr(A), n))
    throw new Error("Cannot find square root");
  return A;
}
const Lt = Jt(ie, void 0, void 0, { sqrt: Me }), je = _e({
  a: BigInt(0),
  // equation params: a, b
  b: BigInt(7),
  Fp: Lt,
  // Field's prime: 2n**256n - 2n**32n - 2n**9n - 2n**8n - 2n**7n - 2n**6n - 2n**4n - 1n
  n: Pt,
  // Curve order, total count of valid points in the field
  // Base point (x, y) aka generator point
  Gx: BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"),
  Gy: BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424"),
  h: BigInt(1),
  // Cofactor
  lowS: !0,
  // Allow only low-S signatures by default in sign() and verify()
  endo: {
    // Endomorphism, see above
    beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
    splitScalar: (n) => {
      const e = Pt, t = BigInt("0x3086d221a7d46bcde86c90e49284eb15"), r = -Ce * BigInt("0xe4437ed6010e88286f547fa90abfe4c3"), i = BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), s = t, f = BigInt("0x100000000000000000000000000000000"), a = Ft(s * n, e), o = Ft(-r * n, e);
      let u = j(n - a * t - o * i, e), E = j(-a * r - o * s, e);
      const I = u > f, d = E > f;
      if (I && (u = e - u), d && (E = e - E), u > f || E > f)
        throw new Error("splitScalar: Endomorphism failed, k=" + n);
      return { k1neg: I, k1: u, k2neg: d, k2: E };
    }
  }
}, de);
BigInt(0);
je.ProjectivePoint;
export {
  je as secp256k1
};
//# sourceMappingURL=secp256k1-CJV06Qp3.js.map
