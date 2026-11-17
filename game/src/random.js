// random.js — deterministic seeded RNG so screenshots reproduce exactly.
export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
export class Rng {
  constructor(seed) { this.next = makeRng(seed); }
  float(a = 0, b = 1) { return a + this.next() * (b - a); }
  int(a, b) { return Math.floor(this.float(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  angle() { return this.next() * Math.PI * 2; }
}
