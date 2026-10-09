from __future__ import annotations

import struct
from dataclasses import dataclass
from pathlib import Path

import numpy as np

HEADER_PACKETS = 2  # OpusHead, OpusTags


def wrap(loop: np.ndarray, pad: int) -> np.ndarray:
    return np.concatenate([loop[-pad:], loop, loop[:pad]]) if pad else loop


def trim_ogg_opus(path: Path, pad: int, keep: int) -> None:
    pages = _ogg_pages(path.read_bytes())
    pre_skip = _add_pre_skip(pages[0], pad)
    end = pre_skip + keep
    last = _packet_reaching(pages, end)
    pages = pages[:last.page] + [_final_page(pages[last.page], last.segment, end)]
    path.write_bytes(b''.join(pages))


@dataclass(frozen=True)
class _Packet:
    page: int
    segment: int
    data: bytes


def _ogg_pages(data: bytes) -> list[bytearray]:
    pages, i = [], 0
    while i < len(data):
        if data[i:i + 4] != b'OggS':
            raise ValueError('not an Ogg page')
        segments = data[i + 26]
        size = 27 + segments + sum(data[i + 27:i + 27 + segments])
        pages.append(bytearray(data[i:i + size]))
        i += size
    return pages


def _packets(pages: list[bytearray]) -> list[_Packet]:
    packets, data = [], b''
    for p, page in enumerate(pages):
        lacing = page[27:27 + page[26]]
        offset = 27 + len(lacing)
        for s, size in enumerate(lacing):
            data += page[offset:offset + size]
            offset += size
            if size < 255:
                packets.append(_Packet(p, s, data))
                data = b''
    return packets


def _opus_samples(packet: bytes) -> int:
    toc = packet[0]
    config = toc >> 3
    if config < 12:
        frame = (480, 960, 1920, 2880)[config & 3]
    elif config < 16:
        frame = (480, 960)[config & 1]
    else:
        frame = (120, 240, 480, 960)[config & 3]
    frames = {0: 1, 1: 2, 2: 2, 3: packet[1] & 0x3F}[toc & 3]
    return frame * frames


def _granule(page: bytearray) -> int:
    return struct.unpack_from('<q', page, 6)[0]


def _packet_reaching(pages: list[bytearray], end: int) -> _Packet:
    packets = _packets(pages)[HEADER_PACKETS:]
    position = 0
    for i, packet in enumerate(packets):
        position += _opus_samples(packet.data)
        last_on_page = i + 1 == len(packets) or packets[i + 1].page != packet.page
        is_eos = pages[packet.page][5] & 0x04
        if last_on_page and not is_eos and position != _granule(pages[packet.page]):
            raise ValueError('packet durations do not match the granule positions')
        if position >= end:
            return packet
    raise ValueError('the stream is shorter than pre-skip + loop')


def _add_pre_skip(head: bytearray, pad: int) -> int:
    body = 27 + head[26]
    if head[body:body + 8] != b'OpusHead':
        raise ValueError('first page is not OpusHead')
    pre_skip = struct.unpack_from('<H', head, body + 10)[0] + pad
    if pre_skip > 0xFFFF:
        raise ValueError('padding too long for the Opus pre-skip field')
    struct.pack_into('<H', head, body + 10, pre_skip)
    _set_crc(head)
    return pre_skip


def _final_page(page: bytearray, last_segment: int, granule: int) -> bytearray:
    lacing = page[27:27 + page[26]]
    kept = lacing[:last_segment + 1]
    body = 27 + len(lacing)
    final = bytearray(page[:26]) + bytes([len(kept)]) + kept + page[body:body + sum(kept)]
    struct.pack_into('<q', final, 6, granule)
    final[5] |= 0x04
    _set_crc(final)
    return final


def _crc_table() -> list[int]:
    table = []
    for i in range(256):
        r = i << 24
        for _ in range(8):
            r = ((r << 1) ^ 0x04C11DB7) if r & 0x80000000 else r << 1
        table.append(r & 0xFFFFFFFF)
    return table


_CRC = _crc_table()


def _set_crc(page: bytearray) -> None:
    page[22:26] = b'\0\0\0\0'
    crc = 0
    for byte in page:
        crc = ((crc << 8) & 0xFFFFFFFF) ^ _CRC[((crc >> 24) & 0xFF) ^ byte]
    struct.pack_into('<I', page, 22, crc)
