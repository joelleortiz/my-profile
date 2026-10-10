import { deflateSync } from 'node:zlib';

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
