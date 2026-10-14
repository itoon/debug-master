"""Native-resolution vector/logo SSIM and visual comparison; asset QA only."""
import argparse
import hashlib
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from importlib.util import spec_from_file_location, module_from_spec

sys.dont_write_bytecode = True
spec = spec_from_file_location('codi_comparison', Path(__file__).with_name('compare-codi-svg.py'))
qa = module_from_spec(spec)
spec.loader.exec_module(qa)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--svg', type=Path, required=True)
    parser.add_argument('--render', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    source = Path('app/assets/brand/logo-sleep.png')
    original = Image.open(source).convert('RGBA')
    rendered = Image.open(args.render).convert('RGBA')
    if original.size != rendered.size:
        raise ValueError(f'Native-size comparison required: {original.size} != {rendered.size}')
    root = ET.fromstring(args.svg.read_text(encoding='utf-8'))
    paths = 0
    for element in root.iter():
        tag = element.tag.split('}')[-1]
        if tag in {'image', 'feImage', 'foreignObject', 'script', 'rect'}:
            raise ValueError(f'Expected vector contours, found {tag}')
        paths += tag == 'path'
        for key, value in element.attrib.items():
            if key.split('}')[-1] == 'href' and not value.startswith('#'):
                raise ValueError('Embedded or external reference is forbidden')
    left, right = np.array(original), np.array(rendered)
    yy, xx = np.where((left[:, :, 3] > 12) | (right[:, :, 3] > 12))
    w, h = original.size
    bounds = [max(0, int(xx.min())-5), max(0, int(yy.min())-5), min(w, int(xx.max())+6), min(h, int(yy.max())+6)]
    x0, y0, x1, y1 = bounds
    roi_left, roi_right = left[y0:y1, x0:x1], right[y0:y1, x0:x1]
    values = {}
    for name, bg in qa.BACKGROUNDS.items():
        a, b = qa.composite(roi_left, bg), qa.composite(roi_right, bg)
        values[name] = float(np.mean([qa.ssim(a[:, :, c], b[:, :, c]) for c in range(3)]))
        print(f'{name}: {values[name]*100:.5f}%', flush=True)
    values['alpha'] = qa.ssim(roi_left[:, :, 3], roi_right[:, :, 3])
    score = min(values.values())
    report = {'method': '11x11 Gaussian SSIM, sigma=1.5, population covariance; RGB channel mean; foreground crop; minimum of white/navy/blue/alpha',
              'native_size': list(original.size), 'foreground_crop': bounds, 'threshold': .98,
              'ssim': values, 'minimum': score, 'pass': score >= .98, 'vector_only': True, 'path_elements': paths,
              'sha256': {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in [('original_png', source), ('svg', args.svg), ('rendered_png', args.render)]}}
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out/'comparison.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    # Only the presentation sheet is resized. The metric above is native-size.
    sheet = Image.new('RGB', (1200, 860), '#061a38')
    draw = ImageDraw.Draw(sheet)
    for img, x, label in [(original, 0, 'Original PNG'), (rendered, 600, 'Vector SVG render')]:
        bg = Image.new('RGBA', original.size, (*qa.BACKGROUNDS['navy'], 255))
        bg.alpha_composite(img)
        bg.thumbnail((590, 410), Image.Resampling.LANCZOS)
        sheet.paste(bg.convert('RGB'), (x+5, 25))
        draw.text((x+10, 6), label, fill='white')
    difference = np.clip(np.abs(qa.composite(left, qa.BACKGROUNDS['navy'])-qa.composite(right, qa.BACKGROUNDS['navy']))*4, 0, 255).astype(np.uint8)
    diff = Image.fromarray(difference)
    diff.thumbnail((590, 410), Image.Resampling.LANCZOS)
    sheet.paste(diff, (5, 445))
    draw.text((10, 425), 'Difference x4 (presentation only)', fill='white')
    draw.text((620, 480), f'Minimum native-size SSIM: {score*100:.5f}%', fill='#ffda53')
    draw.text((620, 520), f'Vector region paths: {paths}', fill='white')
    sheet.save(args.out/'comparison.png')
    print(f'Minimum: {score*100:.5f}% {"PASS" if report["pass"] else "BELOW TARGET"}', flush=True)
    if not report['pass']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
