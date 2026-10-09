import { deflateSync, inflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array): number {
	let c = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	out.write(type, 4, 'ascii');
	Buffer.from(data).copy(out, 8);
	out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
	return out;
}

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function ihdr(w: number, h: number, colorType: number): Buffer {
	const b = Buffer.alloc(13);
	b.writeUInt32BE(w, 0);
	b.writeUInt32BE(h, 4);
	b[8] = 8; // bit depth
	b[9] = colorType;
	return chunk('IHDR', b);
}

export function encodeIndexed(
	w: number,
	h: number,
	indices: Uint8Array,
	palette: [number, number, number][],
	alpha: number[] = [0]
): Buffer {
	const raw = Buffer.alloc((w + 1) * h);
	for (let y = 0; y < h; y++) {
		raw[y * (w + 1)] = 0;
		raw.set(indices.subarray(y * w, y * w + w), y * (w + 1) + 1);
	}
	const plte = Buffer.alloc(palette.length * 3);
	palette.forEach(([r, g, b], i) => plte.set([r, g, b], i * 3));
	return Buffer.concat([
		SIGNATURE,
		ihdr(w, h, 3),
		chunk('PLTE', plte),
		chunk('tRNS', Uint8Array.from(alpha)),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', new Uint8Array(0))
	]);
}

export function encodeRgba(w: number, h: number, rgba: Uint8Array): Buffer {
	const stride = w * 4;
	const raw = Buffer.alloc((stride + 1) * h);
	for (let y = 0; y < h; y++) {
		raw[y * (stride + 1)] = 0;
		raw.set(rgba.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
	}
	return Buffer.concat([
		SIGNATURE,
		ihdr(w, h, 6),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', new Uint8Array(0))
	]);
}

export interface DecodedPng {
	width: number;
	height: number;
	data: Uint8Array;
}

function paeth(a: number, b: number, c: number): number {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodePng(file: Uint8Array): DecodedPng {
	const buf = Buffer.from(file);
	if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('Not a PNG');
	let pos = 8;
	let width = 0;
	let height = 0;
	let depth = 8;
	let colorType = 6;
	let palette: Uint8Array = new Uint8Array(0);
	let trns: Uint8Array = new Uint8Array(0);
	const idat: Buffer[] = [];
	while (pos < buf.length) {
		const len = buf.readUInt32BE(pos);
		const type = buf.toString('ascii', pos + 4, pos + 8);
		const data = buf.subarray(pos + 8, pos + 8 + len);
		if (type === 'IHDR') {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			depth = data[8];
			colorType = data[9];
			if (data[12] !== 0) throw new Error('Interlaced PNGs are not supported');
		} else if (type === 'PLTE') palette = data;
		else if (type === 'tRNS') trns = data;
		else if (type === 'IDAT') idat.push(data);
		pos += 12 + len;
	}
	const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
	if (!channels) throw new Error(`Unsupported colour type ${colorType}`);
	const bpp = Math.max(1, (channels * depth) >> 3);
	const stride = Math.ceil((width * channels * depth) / 8);
	const raw = inflateSync(Buffer.concat(idat));
	const pixels = new Uint8Array(stride * height);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)];
		const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		const out = pixels.subarray(y * stride, (y + 1) * stride);
		const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
		for (let i = 0; i < stride; i++) {
			const a = i >= bpp ? out[i - bpp] : 0;
			const b = prev ? prev[i] : 0;
			const c = prev && i >= bpp ? prev[i - bpp] : 0;
			const x = line[i];
			out[i] =
				filter === 0
					? x
					: filter === 1
						? x + a
						: filter === 2
							? x + b
							: filter === 3
								? x + ((a + b) >> 1)
								: x + paeth(a, b, c);
		}
	}
	const data = new Uint8Array(width * height * 4);
	const sample = (row: Uint8Array, i: number): number => {
		if (depth === 8) return row[i];
		const per = 8 / depth;
		const byte = row[Math.floor(i / per)];
		const shift = 8 - depth * ((i % per) + 1);
		return (byte >> shift) & ((1 << depth) - 1);
	};
	for (let y = 0; y < height; y++) {
		const row = pixels.subarray(y * stride, (y + 1) * stride);
		for (let x = 0; x < width; x++) {
			const o = (y * width + x) * 4;
			if (colorType === 3) {
				const idx = sample(row, x);
				data[o] = palette[idx * 3];
				data[o + 1] = palette[idx * 3 + 1];
				data[o + 2] = palette[idx * 3 + 2];
				data[o + 3] = idx < trns.length ? trns[idx] : 255;
			} else if (colorType === 0) {
				const v = depth === 8 ? row[x] : (sample(row, x) * 255) / ((1 << depth) - 1);
				data.set([v, v, v, 255], o);
			} else if (colorType === 4) {
				data.set([row[x * 2], row[x * 2], row[x * 2], row[x * 2 + 1]], o);
			} else if (colorType === 2) {
				data.set([row[x * 3], row[x * 3 + 1], row[x * 3 + 2], 255], o);
			} else {
				data.set(row.subarray(x * 4, x * 4 + 4), o);
			}
		}
	}
	return { width, height, data };
}
