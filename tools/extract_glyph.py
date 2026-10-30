"""Extract the exact Microsoft YaHei Regular U+66FC outline and its two halves.

Run from any directory with the bundled Python. Dependency, installed locally:
    python -m pip install --target tools/_vendor fonttools
No font file is copied into the distributable. Both characters use this one path.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent / "_vendor"))

from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.basePen import BasePen
from PIL import Image, ImageChops, ImageDraw, ImageFont


class FlattenPen(BasePen):
    """Only for the raster QA contact sheet; game assets keep exact curves."""
    def __init__(self, glyph_set):
        super().__init__(glyph_set)
        self.contours = []
        self.current = []

    def _moveTo(self, p):
        self.current = [p]

    def _lineTo(self, p):
        self.current.append(p)

    def _qCurveToOne(self, control, end):
        start = self._getCurrentPoint()
        count = max(8, math.ceil((math.dist(start, control) + math.dist(control, end)) / 5))
        for i in range(1, count + 1):
            t = i / count
            self.current.append(tuple((1-t)**2*start[k] + 2*(1-t)*t*control[k] + t*t*end[k] for k in (0, 1)))

    def _curveToOne(self, c1, c2, end):
        start = self._getCurrentPoint()
        count = max(12, math.ceil((math.dist(start, c1) + math.dist(c1, c2) + math.dist(c2, end)) / 5))
        for i in range(1, count + 1):
            t = i / count
            self.current.append(tuple((1-t)**3*start[k] + 3*(1-t)**2*t*c1[k] + 3*(1-t)*t*t*c2[k] + t**3*end[k] for k in (0, 1)))

    def _closePath(self):
        self.contours.append(self.current)
        self.current = []

    def _endPath(self):
        self._closePath()


def raster_outline(contours, width, height, scale=2):
    """Even/odd contour fill. Used identically for full and split QA masks."""
    result = Image.new("1", (width*scale, height*scale), 0)
    for points in contours:
        contour = Image.new("1", result.size, 0)
        ImageDraw.Draw(contour).polygon([(round(x*scale), round(y*scale)) for x,y in points], fill=1)
        result = ImageChops.logical_xor(result, contour)
    return result.convert("L")


def svg_text(width, height, content):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img">{content}</svg>\n'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--font", default="C:/Windows/Fonts/msyh.ttc")
    parser.add_argument("--out", default=str(ROOT / "dist" / "assets"))
    args = parser.parse_args()
    output = Path(args.out)
    output.mkdir(parents=True, exist_ok=True)
    font = TTFont(args.font, fontNumber=0)
    family = font["name"].getDebugName(1)
    style = font["name"].getDebugName(2)
    assert family == "Microsoft YaHei" and style == "Regular", (family, style)
    glyph_set = font.getGlyphSet()
    glyph_name = font.getBestCmap()[0x66FC]
    glyph = glyph_set[glyph_name]
    bounds = BoundsPen(glyph_set)
    glyph.draw(bounds)
    min_x, min_y, max_x, max_y = bounds.bounds
    width, height = int(max_x-min_x), int(max_y-min_y)
    split = width / 2
    transform = (1, 0, 0, -1, -min_x, max_y)
    svg_pen = SVGPathPen(glyph_set)
    glyph.draw(TransformPen(svg_pen, transform))
    outline = svg_pen.getCommands()
    flatten = FlattenPen(glyph_set)
    glyph.draw(TransformPen(flatten, transform))

    # Rotation signs use Canvas/SVG y-down coordinates: negative means CCW.
    halves = []
    # Both preserve the original top-to-bottom stroke sequence as left-to-right.
    # YaHei is asymmetric: the right reads most clearly as MAN; no mirroring or
    # stroke editing is introduced to make the two literal halves identical.
    for side, x, rotation in [("left", 0, -math.pi/2), ("right", split, -math.pi/2)]:
        halves.append({
            "side": side, "clip": [x, 0, split, height],
            "pivot": [x+split/2, height/2], "rotation": rotation,
            "bbox": [-height/2, -split/2, height, split],
        })
    data = {
        "character": "曼", "fontFamily": family, "fontStyle": style,
        "fontSource": "C:/Windows/Fonts/msyh.ttc#fontNumber=0",
        "fontSha256": hashlib.sha256(Path(args.font).read_bytes()).hexdigest(),
        "glyphName": glyph_name, "unitsPerEm": font["head"].unitsPerEm,
        "width": width, "height": height, "path": outline, "splitX": split,
        "halves": halves,
        "coordinates": "top-left origin, y down; radians positive clockwise; bbox is relative to rotated pivot",
    }
    (output / "glyph.json").write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (output / "glyph.svg").write_text(svg_text(width, height, f'<path fill="#292b30" d="{outline}"/>'), encoding="utf-8")

    gap, padding = 160, 80
    sheet_width, sheet_height = 2*height+gap+2*padding, split+2*padding
    defs = '<defs>'+''.join(f'<clipPath id="{h["side"]}"><rect x="{h["clip"][0]}" y="0" width="{split}" height="{height}"/></clipPath>' for h in halves)+'</defs>'
    groups = []
    for i, half in enumerate(halves):
        px, py = half["pivot"]
        tx, ty = padding+height/2+i*(height+gap), padding+split/2
        groups.append(f'<g transform="translate({tx} {ty}) rotate({math.degrees(half["rotation"])}) translate({-px} {-py})"><path clip-path="url(#{half["side"]})" fill="#292b30" d="{outline}"/></g>')
        single = f'<g transform="translate({height/2} {split/2}) rotate({math.degrees(half["rotation"])}) translate({-px} {-py})"><path clip-path="url(#{half["side"]})" fill="#292b30" d="{outline}"/></g>'
        (output / f'glyph-half-{half["side"]}.svg').write_text(svg_text(height, split, defs+single), encoding="utf-8")
    (output / "glyph-halves.svg").write_text(svg_text(sheet_width, sheet_height, defs+''.join(groups)), encoding="utf-8")

    scale = 2
    mask = raster_outline(flatten.contours, width, height, scale)
    cut = int(split*scale)
    source_halves = [mask.crop((0,0,cut,height*scale)), mask.crop((cut,0,width*scale,height*scale))]
    # Exact 90-degree image transposes introduce no interpolation. Inverse
    # transposes reconstruct every source pixel and the split has no gap/overlap.
    assembled = Image.new("L", mask.size, 0)
    for i, (source, half) in enumerate(zip(source_halves, halves)):
        forward = Image.Transpose.ROTATE_270 if half["rotation"] > 0 else Image.Transpose.ROTATE_90
        inverse = Image.Transpose.ROTATE_90 if half["rotation"] > 0 else Image.Transpose.ROTATE_270
        restored = source.transpose(forward).transpose(inverse)
        assembled.paste(restored, (i*cut, 0))
    difference = ImageChops.difference(mask, assembled)
    differing = sum(difference.histogram()[1:])
    assert differing == 0, differing

    face = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 21)
    canvas = Image.new("RGB", (1600, 1030), "#f6f7f9")
    draw = ImageDraw.Draw(canvas)
    draw.text((36,20), "Exact Microsoft YaHei Regular U+66FC outline", font=face, fill="#292b30")
    thumb = mask.resize((430,430), Image.Resampling.LANCZOS)
    canvas.paste("#292b30", (585,70), thumb)
    draw.text((588,515), f"Full: {width} x {height}; vertical split: {split:g}", font=face, fill="#292b30")
    for i, (side, source) in enumerate(zip(("left","right"), source_halves)):
        for j, (tag, transpose) in enumerate((("-90 CCW",Image.Transpose.ROTATE_90),("+90 CW",Image.Transpose.ROTATE_270))):
            x, y = 35+i*800, 600+j*200
            rotated = source.transpose(transpose)
            rotated.thumbnail((715,145), Image.Resampling.LANCZOS)
            canvas.paste("#292b30", (x,y+30), rotated)
            draw.text((x,y), f"{side}: {tag}", font=face, fill="#292b30")
    canvas.save(output / "glyph-orientation-preview.png")
    result = {
        "font": f"{family} {style}", "size": [width,height], "splitX": split,
        "rotationDegrees": {h["side"]: math.degrees(h["rotation"]) for h in halves},
        "reconstructionDifferingPixels": differing, "qaRasterSize": list(mask.size),
        "geometryProof": "[0, splitX] union [splitX, width] covers the same one outline; interiors disjoint; inverse 90-degree rotation restores each clipped half without changing strokes.",
    }
    (output / "glyph-validation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
