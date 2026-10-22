#!/usr/bin/env python3
"""Batch pixelize: drop folder (route A) or explicit job list (route C), then check + contact sheet.

Route A (MiniMax finals):
  put  assets_src/minimax/<asset_id>.png  (or .jpg / .webp), ids from docs/art/pixel_pipeline/asset_catalog.json
  run  python scripts/pixel_pipeline/run_all.py
  out  assets_src/pixel_out/<asset_id>.png + .json, check_report.json, contact_sheet.png  (never writes assets/)

Route C (interim, legacy sprites):
  python scripts/pixel_pipeline/run_all.py --jobs jobs.json --out <dir>
  jobs.json = {"jobs": [{"id": "...", "src": "assets/...png", "class": "enemy_1x1",
                         "src_rect": [x, y, w, h], "key_color": null, "collision": [w, h],
                         "params": {"despeckle": true, ...}}]}

Per-asset optional protect mask: <src_dir>/<asset_id>.protect.png (white = keep).
Exit code: 0 = all present assets pass machine checks (WARN allowed), 1 = any FAIL, 2 = nothing to do.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check  # noqa: E402
import contact_sheet  # noqa: E402
import pixelize  # noqa: E402
import pp_common as pc  # noqa: E402

DEFAULT_CATALOG = pc.REPO_ROOT / "docs" / "art" / "pixel_pipeline" / "asset_catalog.json"
DEFAULT_SRC = pc.REPO_ROOT / "assets_src" / "minimax"
DEFAULT_OUT = pc.REPO_ROOT / "assets_src" / "pixel_out"
EXTS = (".png", ".jpg", ".jpeg", ".webp")


def default_opts(overrides=None):
    ns = pixelize.add_transform_args(argparse.ArgumentParser()).parse_args([])
    for k, v in (overrides or {}).items():
        k = k.replace("-", "_")
        if not hasattr(ns, k):
            raise SystemExit(f"unknown pixelize param {k!r}")
        if k in ("src_rect", "key_tol", "collision") and v is not None:
            v = tuple(v)
        setattr(ns, k, v)
    return ns


def find_src(src_dir: Path, aid: str):
    for ext in EXTS:
        p = src_dir / f"{aid}{ext}"
        if p.exists():
            return p
    return None


def jobs_from_catalog(catalog_path: Path, src_dir: Path, only=None):
    cat = json.loads(catalog_path.read_text(encoding="utf-8"))
    jobs, missing = [], []
    for a in cat["assets"]:
        if only and a["id"] not in only:
            continue
        src = find_src(src_dir, a["id"])
        if src is None:
            missing.append(a["id"])
            continue
        params = {"key_color": a.get("key_color")}
        if a.get("collision"):
            params["collision"] = a["collision"]
        prot = src_dir / f"{a['id']}.protect.png"
        if prot.exists():
            params["protect"] = str(prot)
        jobs.append({"id": a["id"], "src": str(src), "class": a["class"], "params": params})
    known = {a["id"] for a in cat["assets"]}
    unknown = sorted(p.stem for p in src_dir.glob("*") if p.suffix.lower() in EXTS
                     and not p.stem.endswith(".protect") and p.stem not in known) if src_dir.exists() else []
    return jobs, missing, unknown


def jobs_from_file(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    jobs = []
    for j in data["jobs"]:
        params = dict(j.get("params", {}))
        for k in ("src_rect", "key_color", "collision", "protect"):
            if j.get(k) is not None:
                params[k] = j[k]
        src = Path(j["src"])
        if not src.is_absolute():
            src = pc.REPO_ROOT / src
        jobs.append({"id": j["id"], "src": str(src), "class": j["class"], "params": params})
    return jobs


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--catalog", default=str(DEFAULT_CATALOG))
    ap.add_argument("--src", default=str(DEFAULT_SRC), help="drop folder (route A)")
    ap.add_argument("--jobs", help="explicit job list JSON (route C); overrides --src/--catalog")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--only", help="comma separated asset ids")
    ap.add_argument("--param", action="append", default=[],
                    help="global pixelize override key=value (e.g. despeckle=true, pre_contrast=1.2)")
    ap.add_argument("--palette", default=str(pc.DEFAULT_PALETTE))
    ap.add_argument("--no-sheet", action="store_true")
    args = ap.parse_args(argv)

    out = Path(args.out)
    if out.resolve() == (pc.REPO_ROOT / "assets").resolve() or (pc.REPO_ROOT / "assets").resolve() in out.resolve().parents:
        raise SystemExit("refusing to write into assets/: promote reviewed files manually (see README)")
    palette = pc.Palette(Path(args.palette))
    only = set(args.only.split(",")) if args.only else None

    missing, unknown = [], []
    if args.jobs:
        jobs = jobs_from_file(Path(args.jobs))
        if only:
            jobs = [j for j in jobs if j["id"] in only]
    else:
        jobs, missing, unknown = jobs_from_catalog(Path(args.catalog), Path(args.src), only)

    glob_over = {}
    for kv in args.param:
        k, _, v = kv.partition("=")
        glob_over[k] = json.loads(v) if v and v[0] in "[{0123456789.-tfn\"" else v

    if not jobs:
        print(f"[run_all] nothing to do (missing {len(missing)} of catalog). Drop files into {args.src}")
        return 2

    errors = []
    for j in jobs:
        params = dict(glob_over)
        params.update(j["params"])
        try:
            opts = default_opts(params)
            cls = pc.parse_class(j["class"])
            pixelize.run_one(Path(j["src"]), out, cls, palette, opts, asset_id=j["id"])
        except SystemExit as exc:
            errors.append({"id": j["id"], "error": str(exc)})
            print(f"  ERROR {j['id']}: {exc}")

    pngs = [out / f"{j['id']}.png" for j in jobs if (out / f"{j['id']}.png").exists()]
    rep = check.run(pngs, palette)
    rep["pixelize_errors"] = errors
    rep["catalog_missing"] = missing
    rep["unknown_files"] = unknown
    pc.write_json(out / "check_report.json", rep)
    check.print_report(rep)
    if not args.no_sheet and pngs:
        contact_sheet.build(out, out / "contact_sheet.png", report=out / "check_report.json")
        print(f"[run_all] contact sheet {pc.rel_to_repo(out / 'contact_sheet.png')}")
    if missing:
        print(f"[run_all] {len(missing)} catalog ids have no source yet (see check_report.json catalog_missing)")
    if unknown:
        print(f"[run_all] WARNING files not in catalog (ignored): {unknown}")
    return 1 if (rep["summary"]["fail"] or errors) else 0


if __name__ == "__main__":
    sys.exit(main())
