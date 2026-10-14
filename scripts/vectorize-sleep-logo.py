"""Offline logo contour tracing/compaction. Requires bundled Pillow/numpy.

No bitmap embedding, pixel rectangles, external assets or game execution.
The two-stage workflow permits inspection of raw contours before compaction.
"""
import argparse
import re
from pathlib import Path
import numpy as np
from PIL import Image


def contour_paths(mask, level=.5):
    a = np.pad(mask, 1)
    tl, tr, br, bl = a[:-1, :-1], a[:-1, 1:], a[1:, 1:], a[1:, :-1]
    flags = (tl >= level).astype(np.uint8)+2*(tr >= level)+4*(br >= level)+8*(bl >= level)
    yy, xx = np.where((flags != 0) & (flags != 15))
    links = {}
    for y, x in zip(yy.tolist(), xx.tolist()):
        values = [a[y, x], a[y, x+1], a[y+1, x+1], a[y+1, x]]
        positions = [(x-.5, y-.5), (x+.5, y-.5), (x+.5, y+.5), (x-.5, y+.5)]
        points = []
        for j in range(4):
            k = (j+1) % 4
            if (values[j] >= level) != (values[k] >= level):
                t = (level-values[j])/(values[k]-values[j])
                points.append(tuple(round(positions[j][z]+t*(positions[k][z]-positions[j][z]), 4) for z in range(2)))
        for p, q in zip(points[::2], points[1::2]):
            links.setdefault(p, []).append(q)
            links.setdefault(q, []).append(p)
    paths = []
    while links:
        first = next(iter(links))
        p, contour = first, []
        while p in links:
            contour.append(p)
            q = links[p].pop()
            if not links[p]:
                del links[p]
            links[q].remove(p)
            if not links[q]:
                del links[q]
            p = q
            if p == first:
                break
        if len(contour) >= 3:
            ps = np.asarray(contour)
            before, after = ps-np.roll(ps, 1, axis=0), np.roll(ps, -1, axis=0)-ps
            keep = np.abs(before[:, 0]*after[:, 1]-before[:, 1]*after[:, 0]) > .00001
            ps = ps[keep]
            if len(ps) >= 3:
                paths.append('M'+'L'.join(f'{x:.3f},{y:.3f}' for x, y in ps)+'Z')
    return ' '.join(paths)


def simplify_points(ps, tolerance):
    if len(ps) < 3:
        return ps
    v = ps[-1]-ps[0]
    distances = np.linalg.norm(ps-ps[0], axis=1) if np.dot(v, v) == 0 else np.abs(v[0]*(ps[:, 1]-ps[0, 1])-v[1]*(ps[:, 0]-ps[0, 0]))/np.linalg.norm(v)
    index = int(np.argmax(distances))
    if distances[index] <= tolerance:
        return ps[[0, -1]]
    return np.concatenate([simplify_points(ps[:index+1], tolerance)[:-1], simplify_points(ps[index:], tolerance)])


def compact(svg, tolerance):
    def replace(match):
        results = []
        for part in match.group(1).split('Z'):
            if not part.strip():
                continue
            ps = np.asarray([list(map(float, p.split(','))) for p in part.strip()[1:].split('L')])
            split = int(np.argmax(((ps-ps[0])**2).sum(axis=1)))
            if split > 0:
                ps = np.concatenate([simplify_points(ps[:split+1], tolerance)[:-1], simplify_points(np.concatenate([ps[split:], ps[:1]]), tolerance)[:-1]])
            results.append('M'+'L'.join(','.join(f'{c:.2f}'.rstrip('0').rstrip('.') for c in p) for p in ps)+'Z')
        return 'd="'+' '.join(results)+'"'
    return re.sub(r'd="([MLZ\d.,\s-]+)"', replace, svg)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=Path('app/assets/brand/logo-sleep.png'))
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--compact-source', type=Path)
    parser.add_argument('--tolerance', type=float, default=.3)
    parser.add_argument('--step', type=int, default=4)
    args = parser.parse_args()
    if not 1 <= args.step <= 255 or not 0 <= args.tolerance <= 1:
        parser.error('step must be 1..255 and tolerance 0..1 pixels')
    if args.compact_source:
        result = compact(args.compact_source.read_text(encoding='utf-8'), args.tolerance)
    else:
        data = np.asarray(Image.open(args.source).convert('RGBA'))
        h, w = data.shape[:2]
        visible = data[:, :, 3] > 12
        pixels = data[:, :, :3].astype(np.float32)
        outline = contour_paths(data[:, :, 3]/255.)
        svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-labelledby="title">',
               '<title id="title">Debug Master</title>',
               '<!-- Vector luminance contours from the supplied logo; additive RGB layers, no bitmap. -->',
               f'<defs><clipPath id="silhouette"><path fill-rule="evenodd" clip-rule="evenodd" d="{outline}"/></clipPath></defs>',
               '<g clip-path="url(#silhouette)" style="isolation:isolate">']
        levels = list(range(0, 256, args.step))
        if levels[-1] != 255:
            levels.append(255)
        for channel in range(3):
            svg.append('<g style="mix-blend-mode:screen">')
            svg.append(f'<path fill="#000000" fill-rule="evenodd" d="{outline}"/>')
            for index, level in enumerate(levels[1:], 1):
                threshold = (level+levels[index-1])/2
                path = contour_paths(np.where(visible, pixels[:, :, channel], -1), threshold)
                if path:
                    colour = [0, 0, 0]
                    colour[channel] = level
                    svg.append('<path fill="#%02x%02x%02x" fill-rule="evenodd" d="%s"/>' % (*colour, path))
                if index % 16 == 0:
                    print(f'Channel {channel+1}: {index}/{len(levels)-1}', flush=True)
            svg.append('</g>')
        svg.extend(['</g>', '</svg>'])
        result = '\n'.join(svg)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(result, encoding='utf-8')
    print(f'{args.output}: {args.output.stat().st_size:,} bytes', flush=True)


if __name__ == '__main__':
    main()
