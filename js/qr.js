// A QR encoder, just large enough for a URL.
//
// Byte mode, error-correction level M, versions 1–10 (up to 216 bytes) —
// which covers any address this app will ever show. Written out rather than
// pulled from a library so the page keeps its no-dependency, no-build-step
// shape, and verified by comparing its output matrix against a reference
// implementation.
//
// encode(text) returns a square array of booleans: true is a dark module.

// Per version, for level M: [eccPerBlock, blocksInGroup1, dataPerBlock1,
// blocksInGroup2, dataPerBlock2]
const ECC_M = [
  null,
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
];

const ALIGNMENT = [
  null, [], [6, 18], [6, 22], [6, 26], [6, 30],
  [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

/* ── Galois field arithmetic, for Reed–Solomon ───────────────────────────
   GF(256) with the QR primitive polynomial 0x11d. Multiplication becomes
   addition of logarithms, which is what makes the ECC tractable.          */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

function mul(a, b) {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

/** The generator polynomial for `degree` error-correction codewords. */
function generator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function remainder(data, degree) {
  const gen = generator(degree);
  const out = new Array(degree).fill(0);

  for (const byte of data) {
    const factor = byte ^ out[0];
    out.shift();
    out.push(0);
    for (let i = 0; i < degree; i++) out[i] ^= mul(gen[i + 1], factor);
  }
  return out;
}

/* ── Bit stream ──────────────────────────────────────────────────────── */

function bitstream() {
  const bits = [];
  return {
    bits,
    push(value, length) {
      for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
    },
  };
}

/* ── Encoding ────────────────────────────────────────────────────────── */

/** Byte mode: 8 bits of character count below version 10, 16 bits from 10. */
function countBits(version) {
  return version < 10 ? 8 : 16;
}

function pickVersion(byteLength) {
  for (let version = 1; version <= 10; version++) {
    const [, b1, d1, b2, d2] = ECC_M[version];
    const capacityBits = (b1 * d1 + b2 * d2) * 8;
    if (4 + countBits(version) + byteLength * 8 <= capacityBits) return version;
  }
  throw new Error("Text is too long for this encoder");
}

function dataCodewords(bytes, version) {
  const [, b1, d1, b2, d2] = ECC_M[version];
  const capacity = b1 * d1 + b2 * d2;

  const stream = bitstream();
  stream.push(0b0100, 4); // byte mode
  stream.push(bytes.length, countBits(version));
  for (const byte of bytes) stream.push(byte, 8);

  // terminator, then pad to a whole byte
  const terminator = Math.min(4, capacity * 8 - stream.bits.length);
  stream.push(0, terminator);
  while (stream.bits.length % 8) stream.bits.push(0);

  const words = [];
  for (let i = 0; i < stream.bits.length; i += 8) {
    words.push(parseInt(stream.bits.slice(i, i + 8).join(""), 2));
  }
  // the spec's alternating pad bytes
  for (let i = 0; words.length < capacity; i++) {
    words.push(i % 2 === 0 ? 0xec : 0x11);
  }
  return words;
}

/** Splits into blocks, adds correction to each, then interleaves both. */
function interleave(words, version) {
  const [eccLen, b1, d1, b2, d2] = ECC_M[version];

  const blocks = [];
  let at = 0;
  for (let i = 0; i < b1; i++) blocks.push(words.slice(at, (at += d1)));
  for (let i = 0; i < b2; i++) blocks.push(words.slice(at, (at += d2)));

  const ecc = blocks.map((block) => remainder(block, eccLen));

  const out = [];
  for (let i = 0; i < Math.max(d1, d2); i++) {
    for (const block of blocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < eccLen; i++) {
    for (const block of ecc) out.push(block[i]);
  }
  return out;
}

/* ── Matrix ──────────────────────────────────────────────────────────── */

function blankMatrix(size) {
  return Array.from({ length: size }, () => new Array(size).fill(null));
}

function placeFinder(m, row, col) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const y = row + r;
      const x = col + c;
      if (y < 0 || x < 0 || y >= m.length || x >= m.length) continue;
      // -1 and 7 are the separator ring: always light, and not part of the
      // pattern's own edge even though they share a row or column with it.
      const inPattern = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const edge = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      m[y][x] = inPattern && (edge || core);
    }
  }
}

function reserveFormat(m) {
  const size = m.length;
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = false;
    if (m[i][8] === null) m[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = false;
    if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = false;
  }
}

function formatBits(mask) {
  // level M is 0b00; BCH(15,5) with generator 0x537, masked by 0x5412
  const data = (0b00 << 3) | mask;
  let rest = data << 10;
  for (let i = 4; i >= 0; i--) {
    if ((rest >> (i + 10)) & 1) rest ^= 0x537 << i;
  }
  return ((data << 10) | rest) ^ 0x5412;
}

function versionBits(version) {
  let rest = version << 12;
  for (let i = 5; i >= 0; i--) {
    if ((rest >> (i + 12)) & 1) rest ^= 0x1f25 << i;
  }
  return (version << 12) | rest;
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** The spec's four penalty rules, used to choose between the eight masks. */
function penalty(m) {
  const size = m.length;
  let score = 0;

  const runScore = (line) => {
    let total = 0;
    let run = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) {
        run++;
      } else {
        if (run >= 5) total += run - 2;
        run = 1;
      }
    }
    if (run >= 5) total += run - 2;
    return total;
  };

  for (let i = 0; i < size; i++) {
    score += runScore(m[i]);
    score += runScore(m.map((row) => row[i]));
  }

  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  const shapes = [
    [true, false, true, true, true, false, true, false, false, false, false],
    [false, false, false, false, true, false, true, true, true, false, true],
  ];
  const countShapes = (line) => {
    let found = 0;
    for (let at = 0; at + 11 <= line.length; at++) {
      for (const shape of shapes) {
        if (shape.every((v, i) => line[at + i] === v)) found++;
      }
    }
    return found;
  };
  for (let i = 0; i < size; i++) {
    score += 40 * countShapes(m[i]);
    score += 40 * countShapes(m.map((row) => row[i]));
  }

  const dark = m.flat().filter(Boolean).length;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

export function encode(text, forceMask = null) {
  const bytes = [...new TextEncoder().encode(text)];
  const version = pickVersion(bytes.length);
  const size = version * 4 + 17;
  const words = interleave(dataCodewords(bytes, version), version);

  const m = blankMatrix(size);

  placeFinder(m, 0, 0);
  placeFinder(m, 0, size - 7);
  placeFinder(m, size - 7, 0);

  for (const row of ALIGNMENT[version]) {
    for (const col of ALIGNMENT[version]) {
      if (m[row][col] !== null) continue; // skips the finder corners
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          m[row + r][col + c] =
            Math.max(Math.abs(r), Math.abs(c)) !== 1;
        }
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    m[6][i] = i % 2 === 0;
    m[i][6] = i % 2 === 0;
  }

  m[size - 8][8] = true; // the always-dark module
  reserveFormat(m);

  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >> i) & 1) === 1;
      m[Math.floor(i / 3)][size - 11 + (i % 3)] = bit;
      m[size - 11 + (i % 3)][Math.floor(i / 3)] = bit;
    }
  }

  // data, snaking upward in two-column strips, skipping the timing column
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (m[row][col] !== null) continue;
        const byte = words[bitIndex >> 3] ?? 0;
        m[row][col] = ((byte >> (7 - (bitIndex % 8))) & 1) === 1;
        bitIndex++;
      }
    }
    upward = !upward;
  }

  // Everything placed above is reserved; the mask must leave it alone.
  const reserved = blankMatrix(size);
  {
    const probe = blankMatrix(size);
    placeFinder(probe, 0, 0);
    placeFinder(probe, 0, size - 7);
    placeFinder(probe, size - 7, 0);
    for (const row of ALIGNMENT[version]) {
      for (const col of ALIGNMENT[version]) {
        if (probe[row][col] !== null) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) probe[row + r][col + c] = true;
        }
      }
    }
    for (let i = 8; i < size - 8; i++) {
      probe[6][i] = true;
      probe[i][6] = true;
    }
    probe[size - 8][8] = true;
    reserveFormat(probe);
    if (version >= 7) {
      for (let i = 0; i < 18; i++) {
        probe[Math.floor(i / 3)][size - 11 + (i % 3)] = true;
        probe[size - 11 + (i % 3)][Math.floor(i / 3)] = true;
      }
    }
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) reserved[r][c] = probe[r][c] !== null;
    }
  }

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask !== null && mask !== forceMask) continue;
    const candidate = m.map((row) => row.slice());
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && MASKS[mask](r, c)) candidate[r][c] = !candidate[r][c];
      }
    }

    const bits = formatBits(mask);
    for (let i = 0; i < 15; i++) {
      const bit = ((bits >> i) & 1) === 1;
      if (i < 6) candidate[i][8] = bit;
      else if (i < 8) candidate[i + 1][8] = bit;
      else if (i === 8) candidate[8][7] = bit;
      else candidate[8][14 - i] = bit;

      if (i < 8) candidate[8][size - 1 - i] = bit;
      else candidate[size - 15 + i][8] = bit;
    }
    candidate[size - 8][8] = true;

    const score = penalty(candidate);
    if (!best || score < best.score) best = { score, matrix: candidate };
  }

  return best.matrix;
}
