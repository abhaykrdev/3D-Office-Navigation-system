"use strict";

const $ = id => document.getElementById(id);

const SVG = "http://www.w3.org/2000/svg";

let floorKey = "first", selected = null, activeRoute = null, activeView = "map", media = null, mediaVersion = 0;

let box = [ 45, 315, 1310, 780 ], dragging = null;

const floor = () => NAV_DATA[floorKey];

function svg(tag, attrs = {}, parent) {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent && parent.append(e);
    return e;
}

function textElement(tag, text, className) {
    const e = document.createElement(tag);
    e.textContent = text;
    className && (e.className = className);
    return e;
}

function setStatus(text) {
    $("statusText").textContent = text;
}

function safeTheme() {
    try {
        return localStorage.getItem("navigation-demo-theme") || "dark";
    } catch {
        return "dark";
    }
}

function theme(value) {
    document.documentElement.dataset.theme = value;
    $("themeToggle").textContent = value === "dark" ? "Light mode" : "Dark mode";
    $("themeToggle").setAttribute("aria-label", `Switch to ${value === "dark" ? "light" : "dark"} theme`);
    try {
        localStorage.setItem("navigation-demo-theme", value);
    } catch {}
}

theme(safeTheme());

$("themeToggle").onclick = () => theme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");

function entries(key) {
    return NAV_DATA[key].locations;
}

function fitMap() {
    const f = floor();
    if (!f) return;
    if (f.mapBounds) {
        box = [ ...f.mapBounds ];
        applyBox();
        return;
    }
    const m = f.calibration, span = m.span, [cx, cy] = m.center;
    const [minx, miny] = m.bounds_min, [maxx, maxy] = m.bounds_max;
    const x = 1400 * (.5 + (minx - cx) / span) - 35, y = 1400 * (.5 - (maxy - cy) / span) - 35;
    box = [ x, y, (maxx - minx) / span * 1400 + 70, (maxy - miny) / span * 1400 + 70 ];
    applyBox();
}

function applyBox() {
    $("floorMap").setAttribute("viewBox", box.join(" "));
}

function zoom(factor) {
    const [x, y, w, h] = box;
    const nw = Math.max(220, Math.min(2200, w * factor)), nh = nw * h / w;
    box = [ x + (w - nw) / 2, y + (h - nh) / 2, nw, nh ];
    applyBox();
}

$("zoomIn").onclick = () => activeView === "3d" && media?.zoom ? media.zoom(.8) : zoom(.8);

$("zoomOut").onclick = () => activeView === "3d" && media?.zoom ? media.zoom(1.25) : zoom(1.25);

$("fitMap").onclick = () => activeView === "3d" && media?.fit ? media.fit() : fitMap();

$("floorMap").addEventListener("wheel", e => {
    e.preventDefault();
    zoom(e.deltaY > 0 ? 1.1 : .9);
}, {
    passive: false
});

$("floorMap").addEventListener("pointerdown", e => {
    if (e.target.closest(".map-marker")) return;
    dragging = {
        x: e.clientX,
        y: e.clientY,
        box: [ ...box ]
    };
    $("floorMap").setPointerCapture(e.pointerId);
});

$("floorMap").addEventListener("pointermove", e => {
    if (!dragging) return;
    const rect = $("floorMap").getBoundingClientRect();
    const scale = Math.max(box[2] / rect.width, box[3] / rect.height);
    box = [ dragging.box[0] - (e.clientX - dragging.x) * scale, dragging.box[1] - (e.clientY - dragging.y) * scale, box[2], box[3] ];
    applyBox();
});

for (const event of [ "pointerup", "pointercancel" ]) $("floorMap").addEventListener(event, () => dragging = null);

function buildDirectory() {
    const locations = entries(floorKey), container = $("directoryList");
    container.replaceChildren();
    const groups = [ ...new Set(locations.map(l => l.department || "Rooms")) ];
    for (const dept of groups) {
        container.append(textElement("div", dept, "directory-group"));
        for (const l of locations.filter(l => (l.department || "Rooms") === dept)) {
            const b = document.createElement("button");
            b.className = "location-item";
            b.dataset.id = l.id;
            b.setAttribute("aria-current", String(selected?.id === l.id));
            b.append(textElement("span", l.room ? String(l.room) : "↗", "room-chip"));
            const detail = document.createElement("span");
            detail.append(document.createTextNode(l.name));
            detail.append(textElement("small", l.designation || dept));
            b.append(detail);
            b.onclick = () => selectLocation(l.id);
            container.append(b);
        }
    }
    $("directoryCount").textContent = `${locations.length} destinations`;
}

function drawMap(target = $("floorMap"), mini = false) {
    const f = floor();
    if (!f) return;
    target.replaceChildren();
    svg("image", {
        href: f.map,
        x: 0,
        y: 0,
        width: 1400,
        height: 1400,
        class: "floor-image"
    }, target);
    if ($("debugGraph").checked && !mini) {
        const group = svg("g", {
            "aria-hidden": "true"
        }, target);
        for (const [a, b] of f.edges) {
            const p = f.nodes[a].map, q = f.nodes[b].map;
            svg("line", {
                x1: p[0],
                y1: p[1],
                x2: q[0],
                y2: q[1],
                class: "graph-line"
            }, group);
        }
    }
    if (activeRoute) {
        const points = activeRoute.points.map(p => p.join(",")).join(" ");
        svg("polyline", {
            points: points,
            class: "route-outline"
        }, target);
        svg("polyline", {
            points: points,
            class: "route-line"
        }, target);
    }
    const start = f.nodes[f.start].map;
    svg("circle", {
        cx: start[0],
        cy: start[1],
        r: 14,
        class: "start-marker"
    }, target);
    const startLabel = svg("text", {
        x: start[0],
        y: start[1] + 34,
        "text-anchor": "middle",
        fill: "#10344e",
        "font-size": 16,
        "font-weight": 700
    }, target);
    startLabel.textContent = "START";
    const seen = new Set;
    for (const l of f.locations) {
        const [x, y] = f.nodes[l.node].map, pointKey = `${x},${y}`;
        if (seen.has(pointKey)) continue;
        seen.add(pointKey);
        const sharing = f.locations.filter(other => f.nodes[other.node].map.join(",") === pointKey);
        const numbers = [ ...new Set(sharing.map(other => other.room).filter(Boolean)) ];
        const label = numbers.length ? numbers.join("/") : l.name;
        const isSelected = sharing.some(other => other.id === selected?.id);
        const group = svg("g", {
            class: "map-marker" + (isSelected ? " selected" : ""),
            tabindex: mini ? -1 : 0,
            role: "button",
            "aria-label": sharing.map(other => other.name + (other.room ? ", Room " + other.room : "")).join("; "),
            transform: `translate(${x} ${y})`,
            "data-location": l.id
        }, target);
        svg("circle", {
            r: isSelected || numbers.length > 1 ? 22 : 16
        }, group);
        svg("text", {
            style: `font-size:${label.length > 6 ? 8 : label.length > 3 ? 10 : 12}px`
        }, group).textContent = label;
        svg("title", {}, group).textContent = sharing.map(other => other.name).join(" / ");
        if (!mini) {
            group.addEventListener("click", () => selectLocation(l.id));
            group.addEventListener("keydown", e => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectLocation(l.id);
                }
            });
        }
    }
    if (mini) {
        target.setAttribute("viewBox", $("floorMap").getAttribute("viewBox"));
        svg("line", {
            id: "cameraHeading",
            class: "camera-heading"
        }, target);
        svg("circle", {
            id: "cameraPosition",
            r: 14,
            class: "camera-position"
        }, target);
    }
}

function updateMinimap(position, heading = 0) {
    const f = floor();
    if (!f || !position) return;
    const {center: [cx, cy], span: span} = f.calibration;
    let x = 1400 * (.5 + (position[0] - cx) / span), y = 1400 * (.5 + (position[2] + cy) / span);
    if (f.planProjection) {
        const p = f.planProjection;
        const inverse = (v, knots) => {
            for (let i = 1; i < knots.length; i++) {
                const [a, b] = knots[i - 1], [c, d] = knots[i];
                if (v <= d) return a + (v - b) / (d - b) * (c - a);
            }
            return knots.at(-1)[0];
        };
        x = p.offset[0] + (inverse(x, p.xKnots) - 35) * p.scale[0];
        y = p.offset[1] + (inverse(y, p.yKnots) - 510) * p.scale[1];
    }
    const dot = $("cameraPosition"), line = $("cameraHeading");
    if (dot) {
        dot.setAttribute("cx", x);
        dot.setAttribute("cy", y);
    }
    if (line) {
        line.setAttribute("x1", x);
        line.setAttribute("y1", y);
        line.setAttribute("x2", x + Math.sin(heading) * 40);
        line.setAttribute("y2", y - Math.cos(heading) * 40);
    }
}

function refreshMinimap() {
    $("minimap").replaceChildren();
    if (activeView === "map" || false) {
        $("minimap").hidden = true;
        return;
    }
    const map = svg("svg", {}, $("minimap"));
    drawMap(map, true);
    $("minimap").hidden = false;
}

function selectLocation(id) {
    selected = entries(floorKey).find(l => l.id === id) || null;
    if (!selected) return;
    activeRoute = DemoRouter.route(floor(), floor().start, selected.node);
    $("selectionCard").hidden = false;
    $("selectionDept").textContent = `${floor().label} · ${selected.department || "Rooms"}`;
    $("selectionName").textContent = selected.name;
    $("selectionRole").textContent = selected.designation || selected.department || "";
    const notes = [];
    selected.needsReview && notes.push("Position follows the supplied reference; on-site confirmation is pending.");
    selected.note && notes.push(selected.note);
    (true, activeRoute) || notes.push("A connected entrance is not yet verified. Route unavailable.");
    $("selectionNote").textContent = notes.join(" ");
    $("routeSteps").replaceChildren();
    if (activeRoute) {
        for (const t of [ "Floor entrance", selected.room ? `Room ${selected.room}` : selected.department, selected.name ]) $("routeSteps").append(textElement("span", t));
        setStatus(`Route from the floor entrance to ${selected.name}.`);
    } else setStatus(`${selected.name} · entrance verification required`);
    $("replayRoute").disabled = (true, !activeRoute);
    $("mapNote").textContent = activeRoute ? `Entrance → ${selected.name}` : "This destination’s entrance needs verification.";
    buildDirectory();
    true;
    drawMap();
    refreshMinimap();
    false;
    activeView !== "map" && showMedia();
    const hash = new URLSearchParams({
        floor: floorKey,
        location: id,
        view: activeView
    });
    history.replaceState(null, "", "#" + hash);
}

function clearSelection() {
    selected = null;
    activeRoute = null;
    $("selectionCard").hidden = true;
    disposeMedia();
    false;
    drawMap();
    $("mapNote").textContent = "Select a room on the map or search for a destination.";
    setStatus(`${floor().locations.length} destinations · routes start at the marked entrance`);
    buildDirectory();
    refreshMinimap();
    activeView !== "map" && showMedia();
    history.replaceState(null, "", "#" + new URLSearchParams({
        floor: floorKey,
        view: activeView
    }));
}

function switchFloor(key, location) {
    NAV_DATA[key] || (key = "first");
    disposeMedia();
    floorKey = key;
    selected = null;
    activeRoute = null;
    activeView = "map";
    $("floorSelect").value = key;
    $("selectionCard").hidden = true;
    $("floorTitle").textContent = floor().label;
    document.querySelectorAll("[data-floor]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.floor === key)));
    document.querySelectorAll("[data-view]").forEach(b => {
        b.disabled = false;
        b.setAttribute("aria-pressed", String(b.dataset.view === "map"));
    });
    $("floorMap").toggleAttribute("hidden", false);
    $("mapNote").hidden = false;
    $("minimap").hidden = true;
    for (const id of [ "zoomIn", "zoomOut", "fitMap", "debugGraph" ]) $(id).disabled = false;
    $("employeeNotice").textContent = "Employee and department details use placeholders.";
    true;
    fitMap();
    drawMap();
    buildDirectory();
    clearSelection();
    location && selectLocation(location);
    false;
}

function disposeMedia() {
    mediaVersion++;
    media?.dispose && media.dispose();
    media = null;
    $("mediaContainer").replaceChildren();
    $("mediaContainer").hidden = true;
}

async function showMedia() {
    disposeMedia();
    if (activeView === "map") return;
    const version = mediaVersion;
    $("mediaContainer").hidden = false;
    $("minimap").hidden = false;
    if (!activeRoute && selected) {
        $("mediaContainer").append(textElement("div", "This destination needs entrance verification. Use the floor map to inspect its position.", "media-error"));
        return;
    }
    const f = floor();
    setStatus("Loading 3D model…");
    const message = textElement("div", "Loading floor assets…", "media-error");
    $("mediaContainer").append(message);
    try {
        const module = await (import("./viewer3d.js?v=dcf87484b9e2"));
        if (version !== mediaVersion) return;
        const instance = await module.createViewer({
            container: $("mediaContainer"),
            floor: f,
            route: activeRoute,
            onPosition: updateMinimap,
            onStatus: setStatus,
            isCurrent: () => version === mediaVersion,
            onError: message => {
                if (version === mediaVersion) {
                    setView("map");
                    setStatus(message);
                }
            }
        });
        if (version !== mediaVersion) {
            instance?.dispose?.();
            return;
        }
        media = instance;
        message.remove();
    } catch (error) {
        if (version !== mediaVersion) return;
        setView("map");
        setStatus((activeView === "3d" ? "Live 3D" : "Media view") + " is unavailable on this device. Showing the floor map.");
    }
}

function setView(view) {
    if (false, ![ "map", "3d" ].includes(view)) return;
    activeView = view;
    document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    $("floorMap").toggleAttribute("hidden", view !== "map");
    $("mapNote").hidden = view !== "map";
    if (view === "map") {
        disposeMedia();
        setStatus(activeRoute ? `Route to ${selected.name}` : "Select a destination on the floor map.");
    } else showMedia();
    refreshMinimap();
    history.replaceState(null, "", "#" + new URLSearchParams({
        floor: floorKey,
        ...selected ? {
            location: selected.id
        } : {},
        view: view
    }));
}

for (const b of document.querySelectorAll("[data-floor]")) b.onclick = () => switchFloor(b.dataset.floor);

for (const b of document.querySelectorAll("[data-view]")) b.onclick = () => setView(b.dataset.view);

$("floorSelect").onchange = e => switchFloor(e.target.value);

$("debugGraph").onchange = () => drawMap();

$("clearSelection").onclick = clearSelection;

$("replayRoute").onclick = () => {
    false;
    if (activeView === "map") {
        drawMap();
        setStatus(`Route replayed to ${selected.name}.`);
    } else media?.replay?.();
};

$("fullscreen").onclick = async () => {
    try {
        document.fullscreenElement ? await document.exitFullscreen() : await $("mapCard").requestFullscreen();
    } catch {
        setStatus("Fullscreen is unavailable in this browser.");
    }
};

document.addEventListener("fullscreenchange", () => {
    $("fullscreen").textContent = document.fullscreenElement ? "Exit fullscreen" : "Expand";
    media?.resize?.();
});

$("directoryToggle").onclick = () => {
    const list = $("directoryList");
    list.hidden = !list.hidden;
    $("directoryToggle").textContent = list.hidden ? "Show list" : "Hide list";
    $("directoryToggle").setAttribute("aria-expanded", String(!list.hidden));
};

function closeSearch() {
    $("searchResults").hidden = true;
    $("globalSearch").setAttribute("aria-expanded", "false");
}

$("globalSearch").addEventListener("input", () => {
    const q = $("globalSearch").value.trim().toLocaleLowerCase();
    const list = $("searchResults");
    list.replaceChildren();
    if (!q) {
        closeSearch();
        return;
    }
    let count = 0;
    for (const key of Object.keys(NAV_DATA)) for (const l of entries(key)) {
        if (![ l.name, l.department, l.designation, l.room ? `room ${l.room}` : "" ].join(" ").toLocaleLowerCase().includes(q)) continue;
        if (count++ >= 40) continue;
        const b = textElement("button", l.name);
        b.append(textElement("small", `${NAV_DATA[key].label} · ${l.department || "Room"}${l.room ? " · Room " + l.room : ""}`));
        b.onclick = () => {
            switchFloor(key, l.id);
            $("globalSearch").value = "";
            closeSearch();
            $("selectionName").scrollIntoView({
                block: "nearest",
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"
            });
        };
        list.append(b);
    }
    count || list.append(textElement("p", "No matching people or rooms."));
    list.hidden = false;
    $("globalSearch").setAttribute("aria-expanded", "true");
});

$("globalSearch").addEventListener("keydown", e => {
    e.key === "Escape" && closeSearch();
    if (e.key === "ArrowDown") {
        $("searchResults").querySelector("button")?.focus();
        e.preventDefault();
    }
});

$("searchResults").addEventListener("keydown", e => {
    const buttons = [ ...$("searchResults").querySelectorAll("button") ], i = buttons.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
        buttons[(i + 1) % buttons.length]?.focus();
        e.preventDefault();
    }
    if (e.key === "ArrowUp") {
        buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
        e.preventDefault();
    }
    if (e.key === "Escape") {
        $("globalSearch").focus();
        closeSearch();
    }
});

document.addEventListener("click", e => {
    e.target.closest(".search-box") || closeSearch();
});

document.addEventListener("keydown", e => {
    e.key !== "Escape" || document.fullscreenElement || e.target.tagName === "INPUT" || clearSelection();
});

const params = new URLSearchParams(location.hash.slice(1));

switchFloor(NAV_DATA[params.get("floor")] ? params.get("floor") : "first", params.get("location"));

params.get("view") === "3d" && true && setView(params.get("view"));
