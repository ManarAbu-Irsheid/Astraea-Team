# Update the data on the whole site (competition day)

1. Put the new values in the Excel file, sheet **All_Sites**, using the same column names.
   - Different column names? Edit only the `CONFIG` section at the top of `tools/build-site-data.py`.
   - Arabic names (optional): `data/site-names-ar.json`.
2. Open a terminal in the project folder and run:

```
pip install openpyxl
python tools/build-site-data.py "final data.xlsx"
```

3. Open `index.html`, `finder.html`, `compare.html`, `evidence.html` to check.
4. GitHub Desktop: Commit → Push → Pull Request.

The script rewrites: terratwin-real.js, cells.json, targets.json, earth-analogs.json,
validation.json, planetary-dataset.js, data-store.js. Do not edit those by hand.
