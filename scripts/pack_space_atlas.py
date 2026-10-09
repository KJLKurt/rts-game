#!/usr/bin/env python3
"""Deterministic runtime packing of preserved, separately authored RGBA sources.

The recipe names 36 source files, SHA256s, measured source-space ground points,
and optional display framing. Originals are never overwritten. Pillow is an
offline authoring dependency only; ordinary game builds use the checked-in atlas.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image


def sha(data):
    return hashlib.sha256(data).hexdigest()


def pack(recipe_path, output):
    recipe = json.loads(recipe_path.read_text())
    entries = recipe['frames']
    if len(entries) != 36 or len({row['id'] for row in entries}) != 36:
        raise ValueError('Exactly 36 unique authored roles are required')
    cell, gutter, image_limit = 200, 4, 192
    atlas = Image.new('RGBA', (cell * 6, cell * 6))
    frames, evidence = {}, []
    for index, row in enumerate(entries):
        source = Path(row['source'])
        if not source.is_absolute():
            source = recipe_path.parent / source
        source_bytes = source.read_bytes()
        if sha(source_bytes) != row['sha256']:
            raise ValueError(f"Source changed: {row['id']}")
        original = Image.open(source)
        if original.mode != 'RGBA':
            raise ValueError(f"Expected true RGBA: {row['id']}")
        packing_size = tuple(row.get('packing_canvas', original.size))
        if (len(packing_size) != 2 or any(type(n) is not int for n in packing_size)
                or packing_size[0] < original.width or packing_size[1] < original.height):
            raise ValueError(f"Packing canvas would crop original source: {row['id']}")
        working = original
        if packing_size != original.size:
            # A declared shared family canvas adds only transparent right/bottom
            # extent. Preserve every original RGBA pixel, including hidden RGB.
            working = Image.new('RGBA', packing_size)
            working.paste(original, (0, 0))
        scale = min(image_limit / working.width, image_limit / working.height, 1)
        size = (round(working.width * scale), round(working.height * scale))
        # Pillow's RGBA resize uses premultiplied alpha, avoiding hidden-RGB halos.
        reduced = working.resize(size, Image.Resampling.LANCZOS)
        sx, sy = reduced.width / working.width, reduced.height / working.height
        source_bounds = row['bounds']
        frame_bounds = row.get('frame_bounds', source_bounds)
        if not (frame_bounds[0] <= source_bounds[0] < source_bounds[2] <= frame_bounds[2]
                and frame_bounds[1] <= source_bounds[1] < source_bounds[3] <= frame_bounds[3]):
            raise ValueError(f"Display frame clips meaningful source bounds: {row['id']}")
        left = math.floor(frame_bounds[0] * sx) - 1
        top = math.floor(frame_bounds[1] * sy) - 1
        right = math.ceil(frame_bounds[2] * sx) + 1
        bottom = math.ceil(frame_bounds[3] * sy) + 1
        # Display padding can fit tall architecture under unchanged HUD overlays.
        # This changes only the frame's transparent margin, never the sprite shape.
        fit = row.get('max_display_height')
        if fit is not None:
            needed = math.ceil(row['display_width'] * (bottom - top) / fit)
            extra = max(0, needed - (right - left))
            left -= extra // 2
            right += extra - extra // 2
        ox = (index % 6) * cell + gutter + (image_limit - reduced.width) // 2
        oy = (index // 6) * cell + gutter + (image_limit - reduced.height) // 2
        fx, fy, fw, fh = ox + left, oy + top, right - left, bottom - top
        if not ((index % 6) * cell <= fx and fx + fw <= (index % 6 + 1) * cell
                and (index // 6) * cell <= fy and fy + fh <= (index // 6 + 1) * cell):
            raise ValueError(f"Frame exceeds its isolated cell: {row['id']}")
        atlas.paste(reduced, (ox, oy))
        gx, gy = row['ground']
        anchor_x, anchor_y = (gx * sx - left) / fw, (gy * sy - top) / fh
        if not (0 <= anchor_x <= 1 and 0 <= anchor_y <= 1):
            raise ValueError(f"Ground point outside frame: {row['id']}")
        frames[row['id']] = {'x': fx, 'y': fy, 'w': fw, 'h': fh,
                             'anchorX': anchor_x, 'anchorY': anchor_y}
        evidence.append({'id': row['id'], 'sourceFile': source.name,
                         'sourceSha256': row['sha256'], 'sourceSize': original.size, 'packingCanvasSize': working.size,
                         'sourceBounds': source_bounds, 'displayFrameBounds': frame_bounds, 'sourceGround': row['ground'],
                         'resampledSize': size, 'frame': frames[row['id']],
                         'packedRgbaSha256': sha(atlas.crop((fx, fy, fx + fw, fy + fh)).tobytes()),
                         'groundMethod': row.get('ground_method', 'reviewed source-space placement'),
                         'maxDisplayHeight': fit})
    output.mkdir(parents=True, exist_ok=True)
    png = output / 'atlas.png'
    atlas.save(png, optimize=True)
    # Verify persisted bytes, not just the pre-encode canvas.
    readback = Image.open(png).convert('RGBA')
    for row in evidence:
        f = row['frame']
        assert sha(readback.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])).tobytes()) == row['packedRgbaSha256']
    data = {'version': 1, 'image': 'atlas.png', 'width': atlas.width,
            'height': atlas.height, 'format': 'RGBA', 'theme': 'space',
            'style': 'toy-3d', 'frames': frames}
    (output / 'atlas.json').write_text(json.dumps(data, indent=2) + '\n')
    report = {'tool': 'image_gen.imagegen', 'packing': 'Whole original RGBA on its declared logical family canvas (transparent right/bottom padding only when specified), uniformly resized with premultiplied-alpha Lanczos; measured frame rectangles and ground anchors. No recoloring, mirroring, silhouette painting or alpha cleanup.',
              'atlasSha256': sha(png.read_bytes()), 'atlasBytes': png.stat().st_size,
              'decodedBytes': atlas.width * atlas.height * 4, 'frames': evidence}
    (output / 'packing-report.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('recipe', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    result = pack(args.recipe.resolve(), args.output.resolve())
    print(json.dumps({k: result[k] for k in ['atlasSha256', 'atlasBytes', 'decodedBytes']}))
