"""
TerraTwin — ONE command that connects the Excel data to EVERY page of the site.

    python tools/build-site-data.py "final data.xlsx"

(needs: pip install openpyxl)

It reads the sheet "All_Sites" and rewrites all the data files the pages read:

    data/terratwin-real.js     -> Site Finder
    data/cells.json            -> Compare + Evidence (Earth sites, scored with TASI)
    data/targets.json          -> Compare (Moon & Mars sites)
    data/earth-analogs.json    -> Compare (raw Excel rows)
    data/validation.json       -> Evidence + Home (KPIs, ranking of known sites, stability test)
    data/planetary-dataset.js  -> Home (twin showcase + 3D globe pins)
    data/data-store.js         -> offline copy of cells / targets / validation

Competition day: put the new data in the same Excel columns, run the command, commit.
If the competition file uses DIFFERENT column names, change only the CONFIG section below.
"""

import json
import math
import os
import random
import sys

try:
    import openpyxl
except ImportError:
    sys.exit("Missing library. Run:  pip install openpyxl")

# =============================================================================
# CONFIG — the only part you should need to edit
# =============================================================================
SHEET = "All_Sites"

# Column names in the Excel sheet (left = what the site uses, right = your column)
COL = {
    "body": "type",                       # Earth / Mars / Moon
    "id": "source_id",
    "name": "location_name",
    "region": "real_place_name",
    "lat": "lat",
    "lon": "lon",
    "terrain": "terrain_type",
    "elevation_m": "elevation_m",
    "slope_deg": "slope_deg",
    "roughness_m": "roughness_m",
    "albedo": "albedo",
    "temp_max_C": "temp_max_C",
    "temp_min_C": "temp_min_C",
    "temp_swing_C": "temp_swing_C",
    "slope_class": "slope_class",
    "official": "is_official_analog",     # 1 = known analog, 0 = new candidate
    "subtype": "analog_subtype",
    "environment": "analog_environment_type",
    "ndvi": "ndvi",
}

# The similarity criteria (TASI). For each one:
#   norm = the already-normalised column (0..1 or 0..100). If it is missing,
#   it is computed from raw, inside each body (Earth / Mars / Moon separately).
CRITERIA = {
    "slope":     {"norm": "slope_percentile",     "raw": "slope_deg",    "method": "percentile"},
    "roughness": {"norm": "roughness_percentile", "raw": "roughness_m",  "method": "percentile"},
    "albedo":    {"norm": "albedo_norm",          "raw": "albedo",       "method": "minmax"},
    "thermal":   {"norm": "temp_swing_norm",      "raw": "temp_swing_C", "method": "minmax"},
}
MOON_SKIP = ["thermal"]            # criteria not used for the Moon (vacuum)

NDVI_GATE = 0.20                   # NDVI above this -> rejected (vegetation)
NEGATIVE_SUBTYPE = "negative_control"   # subtype prefix for negative-control sites
NEW_CANDIDATE_MIN = 90.0           # best score (%) to count as a "new candidate" on Home
RECALL_TOP_SHARE = 0.25            # known site "found" if it ranks in the top 25%

# Famous Moon / Mars sites shown first (Home pairs, globe pins, Finder dropdown).
# Names must match the Excel "location_name". Leave a list empty to use the first 6 rows.
FEATURED = {
    "mars": ["Jezero", "Gale", "Elysium Planitia", "Meridiani Planum", "Olympus Mons", "Valles Marineris"],
    "moon": ["Shackleton", "Mons Mouton", "Mare Tranquillitatis", "Copernicus", "Aristarchus", "Rima Ariadaeus"],
}
FEATURED_DESC = {
    "Jezero": "Perseverance Landing Site / Delta Crater",
    "Gale": "Curiosity Landing Site / Mt. Sharp Base",
    "Elysium Planitia": "InSight Landing Site / Smooth Basaltic Plain",
    "Meridiani Planum": "Opportunity Landing Site / Hematite Plain",
    "Olympus Mons": "Solar System Largest Volcanic Shield",
    "Valles Marineris": "Grand Canyon of Mars / Tectonic Rift",
    "Shackleton": "Moon South Pole / Artemis Base Candidate (Cold Trap)",
    "Mons Mouton": "South Pole Massif / Artemis III Landing Candidate",
    "Mare Tranquillitatis": "Apollo 11 Landing Plain / Basaltic Mare",
    "Copernicus": "Prominent Impact Crater / Central Peak Complex",
    "Aristarchus": "High-Albedo Volcanic Plateau & Impact Crater",
    "Rima Ariadaeus": "Linear Lunar Rille / Graben System",
}

# Arabic names (optional). File: data/site-names-ar.json  {"Earth|Wadi Rum": {"name_ar": "..."}}
NAMES_AR_FILE = "data/site-names-ar.json"

COUNTRY_AR = {
    "Jordan": "الأردن", "Saudi Arabia": "السعودية", "Oman": "عُمان", "Iran": "إيران", "Egypt": "مصر",
    "Libya": "ليبيا", "Algeria": "الجزائر", "Ethiopia": "إثيوبيا", "Namibia": "ناميبيا",
    "Botswana": "بوتسوانا", "Australia": "أستراليا", "Chile": "تشيلي", "Argentina": "الأرجنتين",
    "Brazil": "البرازيل", "United States": "الولايات المتحدة", "Canada": "كندا", "Iceland": "آيسلندا",
    "Norway": "النرويج", "Russia": "روسيا", "China": "الصين", "Mongolia": "منغوليا",
    "Turkmenistan": "تركمانستان", "Spain": "إسبانيا", "Japan": "اليابان", "DR Congo": "الكونغو",
}
# =============================================================================


def num(x):
    try:
        return None if x is None or x == "" else float(x)
    except (TypeError, ValueError):
        return None


def r(x, n=3):
    return None if x is None else round(float(x), n)


def load_rows(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    if SHEET not in wb.sheetnames:
        sys.exit(f'Sheet "{SHEET}" not found. Sheets: {wb.sheetnames}')
    rows = list(wb[SHEET].iter_rows(values_only=True))
    header = [str(h).strip() if h is not None else "" for h in rows[0]]
    data = [dict(zip(header, row)) for row in rows[1:] if any(v is not None for v in row)]
    missing = [v for k, v in COL.items() if v not in header and k in ("body", "name", "lat", "lon")]
    if missing:
        sys.exit(f"Required columns missing in the Excel: {missing}. Edit COL in this script.")
    return header, data


def normalise(rows, header):
    """Fill row['f'] = {criterion: 0..1} for every row, per body."""
    for key, c in CRITERIA.items():
        if c["norm"] in header:
            vals = [num(rw.get(c["norm"])) for rw in rows]
            scale = 100.0 if max([v for v in vals if v is not None] or [0]) > 1.5 else 1.0
            for rw, v in zip(rows, vals):
                rw.setdefault("f", {})[key] = None if v is None else round(v / scale, 4)
            continue
        if c["raw"] not in header:
            print(f"  ! criterion '{key}' skipped: neither {c['norm']} nor {c['raw']} in the Excel")
            continue
        for body in {str(rw.get(COL['body'])) for rw in rows}:
            group = [rw for rw in rows if str(rw.get(COL["body"])) == body]
            vals = [num(rw.get(c["raw"])) for rw in group]
            clean = sorted(v for v in vals if v is not None)
            for rw, v in zip(group, vals):
                if v is None or not clean:
                    out = None
                elif c["method"] == "percentile":
                    out = sum(1 for x in clean if x <= v) / len(clean)
                else:
                    lo, hi = clean[0], clean[-1]
                    out = 0.0 if hi == lo else (v - lo) / (hi - lo)
                rw.setdefault("f", {})[key] = None if out is None else round(out, 4)


def keys_for(body):
    return [k for k in CRITERIA if not (body == "moon" and k in MOON_SKIP)]


def tasi(ef, tf, body, weights=None):
    """Same formula as js/profile.js calculateTASI."""
    keys = [k for k in keys_for(body) if ef.get(k) is not None and tf.get(k) is not None]
    if not keys:
        return 0.0, {}
    w = weights or {}
    sw = ss = 0.0
    per = {}
    for k in keys:
        d = abs(ef[k] - tf[k])
        per[k] = (1 - d) * 100
        wk = w.get(k, 0.25)
        sw += wk
        ss += wk * d * d
    return max(0.0, (1 - math.sqrt(ss / sw)) * 100) if sw else 0.0, per


def main():
    if len(sys.argv) < 2:
        sys.exit('Usage: python tools/build-site-data.py "final data.xlsx"')
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)
    header, rows = load_rows(sys.argv[1])
    normalise(rows, header)
    names_ar = {}
    if os.path.exists(NAMES_AR_FILE):
        names_ar = json.load(open(NAMES_AR_FILE, encoding="utf-8"))

    def g(rw, k):
        return rw.get(COL[k]) if COL.get(k) in rw else None

    def region_ar(region):
        if not region:
            return ""
        parts = [p.strip() for p in str(region).split(",")]
        parts[-1] = COUNTRY_AR.get(parts[-1], parts[-1])
        return "، ".join(parts)

    sites = []
    for i, rw in enumerate(rows):
        body = str(g(rw, "body") or "").strip().lower()
        if body not in ("earth", "mars", "moon"):
            continue
        sid = g(rw, "id") if g(rw, "id") is not None else i + 1
        name = str(g(rw, "name") or f"Site {sid}")
        ar = names_ar.get(f"{body.capitalize()}|{name}", {})
        region = str(g(rw, "region") or "")
        swing = num(g(rw, "temp_swing_C"))
        if swing is None and num(g(rw, "temp_max_C")) is not None and num(g(rw, "temp_min_C")) is not None:
            swing = num(g(rw, "temp_max_C")) - num(g(rw, "temp_min_C"))
        s = {
            "id": f"{body}-{int(sid) if isinstance(sid, (int, float)) else sid}",
            "body": body,
            "name": name,
            "name_ar": ar.get("name_ar", name),
            "region": region,
            "region_ar": ar.get("country_ar") or region_ar(region),
            "lat": r(num(g(rw, "lat")), 5), "lon": r(num(g(rw, "lon")), 5),
            "terrain": str(g(rw, "terrain") or ""),
            "elevation_m": r(num(g(rw, "elevation_m")), 1),
            "slope_deg": r(num(g(rw, "slope_deg")), 2),
            "roughness_m": r(num(g(rw, "roughness_m")), 2),
            "albedo": r(num(g(rw, "albedo")), 3),
            "temp_max_C": r(num(g(rw, "temp_max_C")), 1),
            "temp_min_C": r(num(g(rw, "temp_min_C")), 1),
            "temp_swing_C": r(swing, 1),
            "slope_class": g(rw, "slope_class") or "",
            "subtype": str(g(rw, "subtype") or ""),
            "environment": str(g(rw, "environment") or ""),
            "environment_ar": ar.get("env_type_ar", str(g(rw, "environment") or "")),
            "ndvi": r(num(g(rw, "ndvi")), 3) if body == "earth" else 0.0,
            "f": rw.get("f", {}),
            "_raw": {k: (v if not isinstance(v, float) else round(v, 6)) for k, v in rw.items() if k != "f"},
        }
        if body == "earth":
            s["is_official"] = bool(num(g(rw, "official")) or 0)
            ndvi = s["ndvi"] or 0
            s["passed"] = ndvi <= NDVI_GATE and not s["subtype"].startswith(NEGATIVE_SUBTYPE)
            s["is_negative"] = s["subtype"].startswith(NEGATIVE_SUBTYPE)
        sites.append(s)

    earth = [s for s in sites if s["body"] == "earth"]
    targets = {b: [s for s in sites if s["body"] == b] for b in ("mars", "moon")}
    for b, lst in targets.items():
        fav = FEATURED.get(b) or [t["name"] for t in lst[:6]]
        for t in lst:
            t["featured"] = t["name"] in fav
            t["order"] = fav.index(t["name"]) if t["name"] in fav else 100
            t["description"] = FEATURED_DESC.get(t["name"]) or t["environment"] or t["terrain"]
        lst.sort(key=lambda t: (t["order"], t["name"]))
    all_targets = targets["mars"] + targets["moon"]

    # ---- scoring -----------------------------------------------------------
    def best_for_earth(e, pool=None):
        best = None
        for t in (pool or all_targets):
            sc, per = tasi(e["f"], t["f"], t["body"])
            if best is None or sc > best[0]:
                best = (sc, t, per)
        return best

    for e in earth:
        sc, t, per = best_for_earth(e)
        e["best"] = {"score": sc if e["passed"] else 0.0, "raw": sc, "target": t, "per": per}
        for b in ("mars", "moon"):
            bs = best_for_earth(e, targets[b])
            e["best_" + b] = (bs[0], bs[1]) if bs else (0, None)

    def rank_earth(weights=None):
        out = []
        for e in earth:
            if not e["passed"]:
                out.append((e, 0.0))
                continue
            best = max((tasi(e["f"], t["f"], t["body"], weights)[0] for t in all_targets), default=0)
            out.append((e, best))
        out.sort(key=lambda x: -x[1])
        return out

    ranked = rank_earth()
    order = [e["id"] for e, _ in ranked]
    n = len(ranked)
    known = [e for e in earth if e["is_official"]]
    top_n = max(1, math.ceil(n * RECALL_TOP_SHARE))
    top10 = max(1, math.ceil(n * 0.10))
    found = [e for e in known if order.index(e["id"]) < top_n]
    found10 = [e for e in known if order.index(e["id"]) < top10]
    new_cands = [e for e, sc in ranked if e["passed"] and not e["is_official"] and sc >= NEW_CANDIDATE_MIN]

    # ROC-AUC: known analogs (positive) vs negative controls (negative)
    pos = [e["best"]["score"] for e in known]
    neg = [e["best"]["score"] for e in earth if e["is_negative"]]
    if pos and neg:
        wins = sum(1.0 if p > q else 0.5 if p == q else 0.0 for p in pos for q in neg)
        roc = wins / (len(pos) * len(neg))
    else:
        roc = None

    # ---- 1) Site Finder ------------------------------------------------------
    def finder_site(s):
        keep = {k: v for k, v in s.items() if not k.startswith("_") and k not in ("best", "best_mars", "best_moon", "passed", "is_negative", "region_ar", "environment_ar")}
        if s["body"] == "earth":
            keep["is_official"] = s["is_official"]
        return keep

    finder = {
        "earth": [finder_site(e) for e in earth if e["passed"]],
        "rejected": [finder_site(e) for e in earth if not e["passed"]],
        "targets": {b: [finder_site(t) for t in targets[b]] for b in targets},
        "meta": {"source": os.path.basename(sys.argv[1]), "ndvi_gate": NDVI_GATE,
                 "criteria": list(CRITERIA.keys()), "moon_skip": MOON_SKIP,
                 "method": "TASI = 100 * (1 - weighted RMS of criterion differences)"},
    }
    with open("data/terratwin-real.js", "w", encoding="utf-8") as fh:
        fh.write("/* GENERATED by tools/build-site-data.py — do not edit by hand. */\n")
        fh.write("window.TERRATWIN_REAL = " + json.dumps(finder, ensure_ascii=False, indent=1) + ";\n")

    # ---- 2) Compare + Evidence: cells / targets / earth-analogs ---------------
    def why(e):
        t = e["best"]["target"]
        m_en, m_ar, n_en, n_ar = [], [], [], []
        names = {"slope": ("Slope", "الانحدار"), "roughness": ("Roughness", "الخشونة"),
                 "albedo": ("Albedo", "السطوع"), "thermal": ("Thermal swing", "فرق الحرارة")}
        for k, v in sorted(e["best"]["per"].items(), key=lambda kv: -kv[1]):
            en, ar = names.get(k, (k, k))
            if v >= 80:
                m_en.append(f"{en}: {v:.0f}% match with {t['name']}.")
                m_ar.append(f"{ar}: تطابق {v:.0f}% مع {t['name_ar']}.")
            else:
                n_en.append(f"{en}: only {v:.0f}% match with {t['name']}.")
                n_ar.append(f"{ar}: تطابق {v:.0f}% فقط مع {t['name_ar']}.")
        if not e["passed"]:
            n_en.insert(0, f"Rejected by the NDVI gate (NDVI {e['ndvi']} > {NDVI_GATE}).")
            n_ar.insert(0, f"مستبعد بفحص الغطاء النباتي (NDVI {e['ndvi']} > {NDVI_GATE}).")
        return m_en, m_ar, n_en, n_ar

    cells = []
    for e in earth:
        t = e["best"]["target"]
        m_en, m_ar, n_en, n_ar = why(e)
        rank = order.index(e["id"]) + 1
        conf = "High" if rank <= top_n else "Medium" if rank <= n // 2 else "Low"
        conf_ar = {"High": "عالية", "Medium": "متوسطة", "Low": "منخفضة"}[conf]
        cells.append({
            "id": e["id"], "name": e["name"], "name_ar": e["name_ar"],
            "country": e["region"], "country_ar": e["region_ar"],
            "lat": e["lat"], "lon": e["lon"],
            "is_candidate": not e["is_official"],
            "target_affinity": t["body"] if t else None,
            "target_id": t["id"] if t else None,
            "terrain_type": e["terrain"],
            "similarity_score": r(e["best"]["score"], 1),
            "uncertainty": "—",
            "confidence": conf, "confidence_ar": conf_ar,
            "passed_ndvi_gate": e["passed"],
            "f": e["f"],
            "radar_parameters": {k: r(v * 100, 1) for k, v in e["f"].items() if v is not None},
            "profile_scores": {},
            "why_matches": m_en, "why_matches_ar": m_ar, "why_not": n_en, "why_not_ar": n_ar,
            "physical_metrics": {k: e[k] for k in ("slope_deg", "roughness_m", "elevation_m", "albedo", "temp_max_C", "temp_min_C")},
            "analog_workbook": e["_raw"],
        })
    cells_json = {"cells": cells}

    def fmt_coord(lat, lon):
        if lat is None or lon is None:
            return ""
        return f"{abs(lat):.2f}° {'N' if lat >= 0 else 'S'}, {abs(lon):.2f}° {'E' if lon >= 0 else 'W'}"

    targets_json = {"targets": [{
        "id": t["id"], "body": t["body"], "name": t["name"], "name_ar": t["name_ar"],
        "featured": t["featured"], "description": t["description"],
        "coordinates": fmt_coord(t["lat"], t["lon"]),
        "elevation": f"{t['elevation_m']:.0f} m" if t["elevation_m"] is not None else "",
        "geology": f"{t['terrain']} terrain. Slope {t['slope_deg']}°; roughness {t['roughness_m']} m.",
        "geology_ar": f"تضاريس {t['terrain']}. الانحدار {t['slope_deg']}°؛ الخشونة {t['roughness_m']} م.",
        "environment": t["environment"] or t["terrain"], "environment_ar": t["environment_ar"] or t["terrain"],
        "terrain_type": t["terrain"], "elevation_m": t["elevation_m"], "slope_deg": t["slope_deg"],
        "roughness_m": t["roughness_m"], "albedo": t["albedo"], "temp_swing_C": t["temp_swing_C"],
        "f": t["f"], "primary_challenges": [], "primary_challenges_ar": [],
    } for t in all_targets]}

    json.dump(cells_json, open("data/cells.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(targets_json, open("data/targets.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump({"all_sites": [s["_raw"] for s in sites]}, open("data/earth-analogs.json", "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"), default=str)

    # ---- 3) validation.json (Evidence + Home KPIs) --------------------------
    old = {}
    if os.path.exists("data/validation.json"):
        old = json.load(open("data/validation.json", encoding="utf-8"))

    def pct(x):
        return f"{x:.1f}%"

    kpis = {
        "cells_scanned": len(earth), "cells_scanned_formatted": f"{len(earth):,}",
        "recall_rate": r(100 * len(found) / len(known), 1) if known else 0,
        "new_candidates": len(new_cands), "new_candidates_formatted": str(len(new_cands)),
        "roc_auc": r(roc, 3) if roc is not None else None,
        "roc_auc_formatted": f"{roc:.3f}" if roc is not None else "—",
        "known_validated": len(found), "known_total": len(known),
        "known_validated_formatted": f"{len(found)} / {len(known)}",
        "recall_at_10": r(100 * len(found10) / len(known), 1) if known else 0,
        "rejected_by_ndvi": sum(1 for e in earth if not e["passed"]),
        "rule_found": f"known site ranks in the top {int(RECALL_TOP_SHARE * 100)}% of all Earth sites",
        "rule_new_candidate": f"not a known analog, passed NDVI, best TASI ≥ {NEW_CANDIDATE_MIN:.0f}%",
    }
    kpis["recall_rate_formatted"] = pct(kpis["recall_rate"])
    kpis["recall_at_10_formatted"] = pct(kpis["recall_at_10"])

    rankings = []
    for e in known:
        rank = order.index(e["id"]) + 1
        t = e["best"]["target"]
        ok = rank <= top_n
        rankings.append({
            "rank": rank, "site_id": e["id"], "name": e["name"], "name_ar": e["name_ar"],
            "score": r(e["best"]["score"], 1),
            "status": "validated" if ok else "failure_case",
            "flag": f"Rank {rank} of {n} · best match {t['name']}" if t else f"Rank {rank} of {n}",
            "flag_ar": f"المرتبة {rank} من {n} · الأقرب {t['name_ar']}" if t else f"المرتبة {rank} من {n}",
            "notes": (f"Known analog found in the top {int(RECALL_TOP_SHARE*100)}%." if ok else
                      f"Known analog NOT in the top {int(RECALL_TOP_SHARE*100)}% — the 4 physical criteria miss what makes it famous (e.g. chemistry, caves)."),
            "notes_ar": (f"موقع معروف ظهر ضمن أعلى {int(RECALL_TOP_SHARE*100)}%." if ok else
                         f"موقع معروف لم يظهر ضمن أعلى {int(RECALL_TOP_SHARE*100)}% — المعايير الفيزيائية الأربعة لا تقيس سبب شهرته (مثل الكيمياء أو الكهوف)."),
        })
    for e in new_cands[:3]:
        t = e["best"]["target"]
        rankings.append({
            "rank": order.index(e["id"]) + 1, "site_id": e["id"], "name": e["name"], "name_ar": e["name_ar"],
            "score": r(e["best"]["score"], 1), "status": "new_candidate",
            "flag": f"New candidate · best match {t['name']}", "flag_ar": f"مرشح جديد · الأقرب {t['name_ar']}",
            "notes": "Not a known analog, but scores like one.", "notes_ar": "ليس موقعاً معروفاً، لكن نسبته مثل المواقع المعروفة.",
        })
    rankings.sort(key=lambda x: x["rank"])

    # stability: change each weight by ±25% and see how the top-10 changes
    base_top = set(order[:10])
    labels = {"slope": ("Slope", "الانحدار"), "roughness": ("Roughness", "الخشونة"),
              "albedo": ("Albedo (brightness)", "السطوع"), "thermal": ("Thermal swing", "فرق الحرارة")}
    params = []
    for k in CRITERIA:
        shifts, keeps = {}, []
        for f in (1.25, 0.75):
            w = {kk: 0.25 for kk in CRITERIA}
            w[k] = 0.25 * f
            rk = [e["id"] for e, _ in rank_earth(w)]
            keeps.append(len(base_top & set(rk[:10])) / 10)
            moves = [abs(rk.index(e["id"]) - order.index(e["id"])) for e in known]
            shifts[f] = sum(moves) / len(moves) if moves else 0
        stab = 100 * sum(keeps) / len(keeps)
        params.append({
            "parameter": labels.get(k, (k, k))[0], "parameter_ar": labels.get(k, (k, k))[1],
            "base_weight": 0.25,
            "plus_25_rank_shift": f"±{shifts[1.25]:.1f} ranks (known sites)",
            "minus_25_rank_shift": f"±{shifts[0.75]:.1f} ranks (known sites)",
            "stability_index": f"{stab:.0f}%",
            "rating": "High Stability" if stab >= 90 else "Moderate Stability" if stab >= 70 else "Low Stability",
        })

    validation = dict(old)
    validation["kpis"] = kpis
    validation["validation_rankings"] = rankings
    validation["sensitivity_matrix"] = {
        "formula": "TASI = 100 × (1 − √( Σ wₖ (eₖ − tₖ)² / Σ wₖ ))",
        "description": ("Two stages. 1) NDVI gate: Earth sites with NDVI > %.2f are rejected (vegetation). "
                        "2) TASI: each criterion is normalised inside its own world (percentile or min–max), "
                        "then the weighted root-mean-square difference between the Earth site and the Moon/Mars site "
                        "is turned into a 0–100%% similarity. The Moon skips the thermal criterion (vacuum). "
                        "Stability = share of the top-10 that stays in the top-10 when one weight changes by ±25%%.") % NDVI_GATE,
        "description_ar": ("مرحلتان: 1) فحص الغطاء النباتي: يُستبعد أي موقع على الأرض قيمة NDVI له أكبر من %.2f. "
                           "2) مؤشر TASI: يُحوَّل كل معيار إلى مستواه النسبي داخل كوكبه، ثم يُحسب فرق الجذر التربيعي الموزون "
                           "بين موقع الأرض والموقع على القمر أو المريخ ويُحوَّل إلى نسبة تشابه من 0 إلى 100%%. "
                           "القمر لا يستخدم معيار الحرارة لعدم وجود غلاف جوي. الثبات = نسبة أعلى 10 مواقع التي تبقى ضمن أعلى 10 عند تغيير أي وزن ±25%%.") % NDVI_GATE,
        "parameters": params,
    }
    json.dump(validation, open("data/validation.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # ---- 4) Home: twin showcase + globe pins -------------------------------
    def env_short(s):
        return (s["environment"] or s["terrain"]).split("/")[0].strip()

    db = {}
    def home_entry(s, twin, twin_score):
        e = {
            "id": s["id"], "body": s["body"], "name": s["name"], "name_ar": s["name_ar"],
            "country": s["region"] or s["body"].capitalize(), "country_ar": s["region_ar"] or s["name_ar"],
            "region": s["region"], "coords": fmt_coord(s["lat"], s["lon"]), "lat": s["lat"], "lon": s["lon"],
            "elevation": f"{s['elevation_m']:.0f} m" if s["elevation_m"] is not None else "—",
            "slope": f"{s['slope_deg']}° ({s['slope_class'] or ''})".replace(" ()", ""),
            "roughness": f"{s['roughness_m']} m", "albedo": f"{s['albedo']}",
            "temp_swing": f"Δ{s['temp_swing_C']}°C" if s["temp_swing_C"] is not None else "—",
            "ndvi": f"{s['ndvi']}", "ndvi_gate": "PASSED" if s["body"] != "earth" or s.get("passed") else "REJECTED",
            "env_type": s["environment"] or s["terrain"], "env_type_ar": s["environment_ar"] or s["terrain"],
            "sensor": "TASI · final data.xlsx",
        }
        if twin:
            per = tasi(s["f"] if s["body"] == "earth" else twin["f"],
                       twin["f"] if s["body"] == "earth" else s["f"],
                       twin["body"] if s["body"] == "earth" else s["body"])[1]
            best_k = max(per, key=per.get) if per else None
            lbl = {"slope": ("slope", "الانحدار"), "roughness": ("roughness", "الخشونة"),
                   "albedo": ("albedo", "السطوع"), "thermal": ("thermal swing", "فرق الحرارة")}
            tier = "STRONG" if twin_score >= 90 else "MODERATE" if twin_score >= 80 else "WEAK"
            tier_ar = {"STRONG": "تشابه قوي", "MODERATE": "تشابه متوسط", "WEAK": "تشابه ضعيف"}[tier]
            e["best_twin"] = {
                "target_id": twin["id"],
                "target_name": f"{twin['name']}, {twin['region'] or twin['body'].capitalize()}",
                "target_name_ar": twin["name_ar"], "target_body": twin["body"],
                "match_score": r(twin_score, 2),
                "confidence": f"{tier} MATCH (TASI)", "confidence_ar": f"{tier_ar} (TASI)",
                "insight": (f"Closest match by TASI: {twin_score:.1f}%. Strongest criterion: {lbl[best_k][0]} ({per[best_k]:.0f}%)."
                            if best_k else f"Closest match by TASI: {twin_score:.1f}%."),
                "insight_ar": (f"الأقرب حسب مؤشر TASI بنسبة {twin_score:.1f}%. أقوى معيار: {lbl[best_k][1]} ({per[best_k]:.0f}%)."
                               if best_k else f"الأقرب حسب مؤشر TASI بنسبة {twin_score:.1f}%."),
            }
        db[s["id"]] = e

    passed_earth = [e for e in earth if e["passed"]]
    featured = [t for t in all_targets if t["featured"]]
    pairs = []
    for t in featured:
        scored = sorted(((tasi(e["f"], t["f"], t["body"])[0], e) for e in passed_earth), key=lambda x: -x[0])
        if not scored:
            continue
        sc, e = scored[0]
        home_entry(t, e, sc)
        t["_top"] = scored[:3]
        pairs.append({"siteAId": t["id"], "siteBId": e["id"]})
    pin_earth = [e for e in passed_earth if e["is_official"]] + [e for e, _ in ranked if e["passed"] and not e["is_official"]][:3]
    for e in {x["id"]: x for x in pin_earth + [db_e for db_e in passed_earth if db_e["id"] in {p["siteBId"] for p in pairs}]}.values():
        home_entry(e, e["best"]["target"], e["best"]["score"])

    def median(vals):
        v = sorted(x for x in vals if x is not None)
        return v[len(v) // 2] if v else None

    def body_stats(lst, body):
        sl, ro, al, sw = (median([s[k] for s in lst]) for k in ("slope_deg", "roughness_m", "albedo", "temp_swing_C"))
        return {
            "slope": f"{sl}° median", "slope_ar": f"{sl}° وسيط",
            "roughness": f"{ro} m median", "roughness_ar": f"{ro} م وسيط",
            "albedo": f"{al} median", "albedo_ar": f"{al} وسيط",
            "temp_swing": f"Δ{sw}°C median", "temp_swing_ar": f"Δ{sw}° وسيط",
            "catalog_sites": f"{len(lst)} sites in the dataset", "catalog_sites_ar": f"{len(lst)} موقعاً في البيانات",
        }

    globe = {}
    e_pins = []
    for e in {x["id"]: x for x in pin_earth}.values():
        bm, bn = e["best_mars"], e["best_moon"]
        e_pins.append({"id": e["id"], "name": e["name"], "name_ar": e["name_ar"], "lat": e["lat"], "lon": e["lon"],
                       "target": f"{env_short(e)} | Match: {bm[1]['name']} {bm[0]:.1f}% / {bn[1]['name']} {bn[0]:.1f}%",
                       "target_ar": f"{e['environment_ar'] or env_short(e)} | {bm[1]['name_ar']} {bm[0]:.1f}% / {bn[1]['name_ar']} {bn[0]:.1f}%"})
    globe["earth"] = {**body_stats(earth, "earth"), "sites": e_pins,
                      "ndvi_gate": f"{sum(1 for e in earth if e['passed'])} passed / {sum(1 for e in earth if not e['passed'])} rejected (NDVI > {NDVI_GATE})",
                      "ndvi_gate_ar": f"{sum(1 for e in earth if e['passed'])} مجتاز / {sum(1 for e in earth if not e['passed'])} مستبعد (NDVI > {NDVI_GATE})"}
    for b in ("mars", "moon"):
        pins = []
        for t in [x for x in targets[b] if x["featured"]]:
            top = t.get("_top", [])
            best_txt = ", ".join(f"{e['name']} {sc:.1f}%" for sc, e in top[:2])
            best_txt_ar = "، ".join(f"{e['name_ar']} {sc:.1f}%" for sc, e in top[:2])
            pins.append({"id": t["id"], "name": t["name"], "name_ar": t["name_ar"], "lat": t["lat"], "lon": t["lon"],
                         "target": f"{t['description']} | Best Analog: {best_txt}",
                         "target_ar": f"{t['name_ar']} | أفضل شبيه: {best_txt_ar}"})
        globe[b] = {**body_stats(targets[b], b), "sites": pins}

    planetary = {"sites": db, "pairs": pairs, "globe": globe}
    with open("data/planetary-dataset.js", "w", encoding="utf-8") as fh:
        fh.write("/* GENERATED by tools/build-site-data.py — do not edit by hand. */\n")
        fh.write("window.PLANETARY_DATABASE = " + json.dumps(planetary, ensure_ascii=False, indent=1) + ";\n")

    # ---- 5) offline copy (data/data-store.js) -------------------------------
    if os.path.exists("data/data-store.js"):
        txt = open("data/data-store.js", encoding="utf-8").read().strip()
        store = json.loads(txt[txt.index("=") + 1:].rstrip(";").strip())
        store["cells"], store["targets"], store["validation"] = cells_json, targets_json, validation
        if os.path.exists("data/locales.json"):
            store["locales"] = json.load(open("data/locales.json", encoding="utf-8"))
        with open("data/data-store.js", "w", encoding="utf-8") as fh:
            fh.write("window.__TERRATWIN_DATA__ = " + json.dumps(store, ensure_ascii=False, indent=2) + ";\n")

    # ---- summary -------------------------------------------------------------
    print("Done. All pages now use:", os.path.basename(sys.argv[1]))
    print(f"  Earth sites: {len(earth)}  (passed NDVI: {len(passed_earth)}, rejected: {len(earth) - len(passed_earth)})")
    print(f"  Mars sites: {len(targets['mars'])}   Moon sites: {len(targets['moon'])}")
    print(f"  Known analogs found (top {int(RECALL_TOP_SHARE*100)}%): {len(found)} / {len(known)}  = {kpis['recall_rate_formatted']}")
    print(f"  New candidates (>= {NEW_CANDIDATE_MIN:.0f}%): {len(new_cands)}")
    print(f"  ROC-AUC (known vs negative controls): {kpis['roc_auc_formatted']}")


if __name__ == "__main__":
    main()
