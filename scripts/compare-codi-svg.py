"""Compare SVG renders with original PNG art; asset QA, not a game test suite.

SSIM uses an 11x11 Gaussian window (sigma 1.5), population covariance,
K1=.01/K2=.03 and range 255. Report RGB mean SSIM on white/navy/blue
backgrounds plus alpha SSIM. Acceptance uses the minimum, on a foreground
crop, so transparent margins cannot inflate the score.
"""
import argparse
import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

POSES = ['down', 'up', 'left', 'right', 'failed', 'win']
BACKGROUNDS = {'white': (255, 255, 255), 'navy': (6, 26, 56), 'blue': (31, 117, 255)}

def gaussian_valid(image):
    axis = np.arange(-5, 6, dtype=np.float64)
    kernel = np.exp(-(axis ** 2) / (2 * 1.5 ** 2))
    kernel /= kernel.sum()
    height, width = image.shape[:2]
    horizontal = sum(kernel[i] * image[:, i:i + width - 10] for i in range(11))
    return sum(kernel[i] * horizontal[i:i + height - 10] for i in range(11))

def ssim(left, right):
    left, right = left.astype(np.float64), right.astype(np.float64)
    mu_left, mu_right = gaussian_valid(left), gaussian_valid(right)
    var_left = gaussian_valid(left * left) - mu_left * mu_left
    var_right = gaussian_valid(right * right) - mu_right * mu_right
    covariance = gaussian_valid(left * right) - mu_left * mu_right
    c1, c2 = (.01 * 255) ** 2, (.03 * 255) ** 2
    similarity = ((2 * mu_left * mu_right + c1) * (2 * covariance + c2)) / ((mu_left ** 2 + mu_right ** 2 + c1) * (var_left + var_right + c2))
    return float(similarity.mean())

def composite(array, background):
    alpha = array[:, :, 3:4].astype(np.float64) / 255
    return array[:, :, :3] * alpha + np.array(background) * (1 - alpha)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--renders', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    report = {'method': '11x11 Gaussian SSIM, sigma=1.5, population covariance, RGB mean; foreground crop; minimum of 3 backgrounds and alpha', 'threshold': .98, 'poses': {}}
    sheet = Image.new('RGB', (640, len(POSES) * 170 + 40), '#102858')
    draw = ImageDraw.Draw(sheet)
    draw.text((10, 10), 'Pose       Original PNG       SVG render       Difference (x4)', fill='white')
    for index, pose in enumerate(POSES):
        original_path = Path('app/assets/sprites') / f'codi-{pose}.png'
        svg_path = original_path.with_suffix('.svg')
        rendered_path = args.renders / f'codi-{pose}.png'
        root = ET.fromstring(svg_path.read_text(encoding='utf-8'))
        for element in root.iter():
            if element.tag.split('}')[-1] in {'image', 'feImage', 'foreignObject', 'script'}:
                raise ValueError(f'{svg_path}: expected vector-only art')
            for key, value in element.attrib.items():
                if key.split('}')[-1] == 'href' and not value.startswith('#'):
                    raise ValueError(f'{svg_path}: external/embedded image reference is not allowed')
        original = Image.open(original_path).convert('RGBA')
        rendered = Image.open(rendered_path).convert('RGBA')
        if original.size != (128, 128) or rendered.size != original.size:
            raise ValueError('Compare at the original 128x128 dimensions, without image registration/alignment')
        left, right = np.array(original), np.array(rendered)
        occupied = (left[:, :, 3] > 12) | (right[:, :, 3] > 12)
        yy, xx = np.where(occupied)
        bounds = [max(0, int(xx.min()) - 5), max(0, int(yy.min()) - 5), min(128, int(xx.max()) + 6), min(128, int(yy.max()) + 6)]
        x0, y0, x1, y1 = bounds
        roi_left, roi_right = left[y0:y1, x0:x1], right[y0:y1, x0:x1]
        values = {name: ssim(composite(roi_left, bg), composite(roi_right, bg)) for name, bg in BACKGROUNDS.items()}
        values['alpha'] = ssim(roi_left[:, :, 3], roi_right[:, :, 3])
        score = min(values.values())
        report['poses'][pose] = {'ssim': values, 'minimum': score, 'pass': score >= .98, 'foreground_crop': bounds, 'sha256': {name: hashlib.sha256(file.read_bytes()).hexdigest() for name, file in [('original_png', original_path), ('svg', svg_path), ('rendered_png', rendered_path)]}, 'vector_only': True}
        y = 40 + index * 170
        draw.text((10, y + 40), pose, fill='white')
        draw.text((10, y + 70), f'{score * 100:.2f}%', fill='#ffda53')
        for image, x in [(original, 100), (rendered, 280)]:
            background = Image.new('RGBA', (128, 128), (*BACKGROUNDS['navy'], 255))
            background.alpha_composite(image)
            sheet.paste(background.convert('RGB'), (x, y))
        difference = np.clip(np.abs(composite(left, BACKGROUNDS['navy']) - composite(right, BACKGROUNDS['navy'])) * 4, 0, 255).astype(np.uint8)
        sheet.paste(Image.fromarray(difference), (460, y))
        print(f'{pose}: {score * 100:.4f}% {"PASS" if score >= .98 else "BELOW TARGET"}')
    report['all_pass'] = all(pose['pass'] for pose in report['poses'].values())
    (args.out / 'comparison.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    sheet.save(args.out / 'comparison.png')
    if not report['all_pass']:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
