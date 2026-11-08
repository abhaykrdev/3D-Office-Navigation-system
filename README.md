# Navigation Demo

Office navigation using the original user-created 3D models. Employee names, department names and directory labels use placeholders such as Employee1, Dep1 and Room1. Annotated reference plans, original employee records, videos and historical documents are excluded. Floor maps are model renders.

## Run

```sh
python -m http.server 8080 --bind 127.0.0.1 --directory Website
```

Open http://127.0.0.1:8080. The app supports floor maps, Top-down/POV playback, a moving route arrow and a minimap. Routes use A* over a connected graph.

## Files

- `Website/src/`: interface, router and 3D viewer.
- `Website/data/`: placeholder directory and model-aligned routes.
- `Website/maps/`: renders of the user-created models.
- `Website/models/`: original exported GLBs and material palettes.
- `Website/tests/`: route and browser checks.
- `Website/vendor/`: bundled dependencies and licence notices.
- `3D Models/source/`: original Blender scenes.
- `3D Models/derived/`: web-model scenes.
- `3D Models/scripts/`: original Blender authoring utilities. These reference the original authoring pipeline; the private directory sources are excluded from this version.

## Checks

```sh
cd Website
npm ci
npm test
npm run test:browser
```

Start the server before browser checks. Tests use installed Google Chrome or `CHROME_EXECUTABLE_PATH`. No backend is required. The .gitignore retains source scenes and runtime models while excluding private directory sources, annotated plans, caches, backups and generated output. Third-party licence notices remain with dependencies.
