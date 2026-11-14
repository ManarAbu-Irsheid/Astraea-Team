"""Replaced by tools/build-site-data.py (it updates ALL pages, not only Site Finder).

    python tools/build-site-data.py "final data.xlsx"
"""
import os, runpy, sys
sys.argv = [sys.argv[0]] + sys.argv[1:2]
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "build-site-data.py"), run_name="__main__")
