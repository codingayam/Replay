#!/usr/bin/env python3
"""Generate the icon.iconset assets required for Safari Web Push packages.
Writes solid-color PNGs sized for Apple requirements using only the Python stdlib."""

import struct
import zlib
from pathlib import Path

COLOR = (0x3B, 0x82, 0xF6, 0xFF)  # Replay brand blue
ICONSET_DIR = Path('client/push-package/icon.iconset')
SIZES = {
    'icon_16x16': 16,
    'icon_16x16@2x': 32,
    'icon_32x32': 32,
    'icon_32x32@2x': 64,
    'icon_128x128': 128,
    'icon_256x256': 256
}


def _chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack('!I', len(data))
        + tag
        + data
        + struct.pack('!I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def _encode_png(size: int) -> bytes:
    width = height = size
    ihdr = struct.pack('!IIBBBBB', width, height, 8, 6, 0, 0, 0)
    row = bytes(COLOR)
    raw = b''.join(b'\x00' + row * width for _ in range(height))
    idat = zlib.compress(raw, level=9)
    return b''.join([
        b'\x89PNG\r\n\x1a\n',
        _chunk(b'IHDR', ihdr),
        _chunk(b'IDAT', idat),
        _chunk(b'IEND', b'')
    ])


def main():
    ICONSET_DIR.mkdir(parents=True, exist_ok=True)
    for name, size in SIZES.items():
        png_bytes = _encode_png(size)
        output_path = ICONSET_DIR / f'{name}.png'
        output_path.write_bytes(png_bytes)
        print(f'Wrote {output_path} ({size}x{size})')


if __name__ == '__main__':
    main()
