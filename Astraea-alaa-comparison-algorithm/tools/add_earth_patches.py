"""Add the Earth terrain patches (earth-<n>.png in data/patches/) to data/patches/index.json.
Run from the site folder:   python tools/add_earth_patches.py
"""
import glob, json, os, re, time

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
p = "data/patches/index.json"
ix = json.load(open(p, encoding="utf-8"))
n = 0
for f in sorted(glob.glob("data/patches/earth-*.png")):
    name = os.path.basename(f)
    ix["patches"][re.sub(r"\.png$", "", name)] = name
    n += 1
ix["version"] = "earth-regions-" + time.strftime("%Y%m%d%H%M")
ix["source"] = ("Mars: MGS MOLA 463m; Moon: LRO LOLA 118m; "
                "Earth: NASADEM 30m (60N-56S) / USGS GMTED2010 (north of 60N). "
                "Shaded relief, azimuth 315, altitude 45.")
ix.pop("note", None)
json.dump(ix, open(p, "w", encoding="utf-8"), indent=1)
print(f"{n} Earth patches added. Total patches: {len(ix['patches'])}")
