<div align="center">

# 3D Office Navigation System

**Pick a floor, pick a person or room, and see exactly how to get there.**

Interactive indoor navigation built on real 3D models of an office building.
Runs entirely in the browser, with no backend and no installation for end users.

</div>

---

## Overview

This project helps employees, visitors and new joiners find any cabin, meeting room or common area in a multi-floor office. Each floor is a 3D model created in Blender and exported for the web. When a destination is selected, the app calculates the shortest walking route with A* and shows it on a floor map, in a top-down 3D view or from a first-person (POV) camera.

It replaces an earlier version that played one pre-rendered video per destination. Routes are now computed live from a connected graph, so adding a person or room no longer means rendering a new video.

> **Note on data:** employee names, department names and directory labels in this repository are placeholders (Employee1, Dep1, Room1 and so on). Annotated reference plans, original employee records, videos and historical documents are intentionally excluded.

## Features

| Feature | Description |
| --- | --- |
| Floor maps | Top-down renders of each floor, generated from the 3D models |
| Automatic routing | A* search over a connected corridor graph finds the shortest route from the start point |
| Top-down and POV playback | Follow the route from above or walk it from eye level in 3D |
| Moving route arrow | An animated arrow travels along the path so the direction is always clear |
| Minimap | A live map shows the current position while the 3D view plays |
| Info panel | Name, designation and department details for the selected destination |
| Light and dark theme | Preference is saved in the browser |

## Quick start

You need Python 3 only to serve the files locally. No build step is required.

```sh
git clone https://github.com/abhaykrdev/3D-Office-Navigation-system.git
cd 3D-Office-Navigation-system
python -m http.server 8080 --bind 127.0.0.1 --directory Website
```

On macOS or Linux, use `python3` instead of `python`. Then open <http://127.0.0.1:8080>.

The page must be served over HTTP. Opening `index.html` directly from disk will not work, because browsers block loading the `.glb` models from `file://`.

## Project structure

```
.
├── Website/
│   ├── index.html        Entry point
│   ├── src/              Interface, router and 3D viewer
│   ├── data/             Placeholder directory and model-aligned routes
│   ├── maps/             Floor map renders of the 3D models
│   ├── models/           Exported GLB models and material palettes
│   ├── tests/            Route and browser checks
│   ├── tools/            Floor map rendering utility
│   └── vendor/           Bundled dependencies and licence notices
└── 3D Models/
    ├── source/           Original Blender scenes
    ├── derived/          Web-optimised Blender scenes
    └── scripts/          Blender authoring and export utilities
```

## How it works

1. **Model.** Each floor is modelled in Blender and exported as a `.glb` file together with a top-down map render.
2. **Graph.** Every floor has a set of nodes (corridor points and room doors) and edges between them, stored with the floor's locations in `Website/data/`.
3. **Route.** When a destination is chosen, `router.js` runs A* from the floor's start node to the destination node.
4. **Display.** The route is drawn on the map and followed by the camera in the 3D viewer, with a moving arrow and a minimap.

## Tests

```sh
cd Website
npm ci
npm test
npm run test:browser
```

Start the local server before running the browser checks. The browser tests use an installed Google Chrome, or the path set in `CHROME_EXECUTABLE_PATH`.

## Built with

- [Blender](https://www.blender.org/) for the 3D office models and top-down renders
- [three.js](https://threejs.org/) for the in-browser 3D viewer (bundled in `Website/vendor/`)
- Vanilla HTML, CSS and JavaScript for the interface and routing
- [Playwright](https://playwright.dev/) for browser checks

## A note on the Blender scripts

The scripts in `3D Models/scripts/` belong to the original authoring pipeline. Some of them read private directory sources that are excluded from this repository, so they are provided for reference and will not run unchanged.

## Contributors

Abhay Kumar, Suraj Kumar, Shubham Chouhan and MD Alam.

## Third-party software

three.js is distributed under the MIT licence. Its licence notice is kept in `Website/vendor/three/LICENSE`.