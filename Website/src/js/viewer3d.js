import * as THREE from "three";

import { GLTFLoader } from "../../vendor/three/addons/loaders/GLTFLoader.js";

import { DRACOLoader } from "../../vendor/three/addons/loaders/DRACOLoader.js";

import { OrbitControls } from "../../vendor/three/addons/controls/OrbitControls.js";

THREE.Cache.enabled = true;

export async function createViewer({container: container, floor: floor, route: route, onPosition: onPosition, onStatus: onStatus, isCurrent: isCurrent}) {
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "low-power"
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.localClippingEnabled = true;
    container.append(renderer.domElement);
    const scene = new THREE.Scene;
    scene.background = new THREE.Color("#d9e4eb");
    const ambient = new THREE.HemisphereLight("#ffffff", "#8e9ca5", 2.5);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight("#fff4e2", 2.2);
    sun.position.set(10, 30, 15);
    scene.add(sun);
    const pov = new THREE.PerspectiveCamera(65, 1, .025, 800);
    const top = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 800);
    top.up.set(0, 0, -1);
    const controls = new OrbitControls(top, renderer.domElement);
    controls.enableRotate = false;
    controls.enableDamping = true;
    controls.screenSpacePanning = true;
    controls.minZoom = .65;
    controls.maxZoom = 8;
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    controls.touches.ONE = THREE.TOUCH.PAN;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    const decoder = new DRACOLoader;
    decoder.setDecoderPath("vendor/three/draco/");
    decoder.setDecoderConfig({
        type: "wasm"
    });
    const loader = new GLTFLoader;
    loader.setDRACOLoader(decoder);
    let model;
    function release() {
        model?.traverse(o => {
            o.geometry?.dispose();
            if (o.material) for (const m of [].concat(o.material)) m.dispose();
        });
        controls.dispose();
        decoder.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
    }
    try {
        model = (await loader.loadAsync(floor.model)).scene;
    } catch {
        release();
        throw new Error("The 3D model could not be loaded.");
    }
    if (!isCurrent()) {
        release();
        return {
            dispose() {}
        };
    }
    scene.add(model);
    const paletteURL = floor.model.replace(".glb", "-topdown.json");
    let palette = {};
    try {
        const response = await fetch(paletteURL);
        if (response.ok) palette = await response.json();
    } catch {}
    const overheadMaterials = new Map, originalMaterials = new Map;
    const originalGeometry = new Map, overheadGeometry = new Map;
    model.updateMatrixWorld(true);
    model.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        originalMaterials.set(o, o.material);
        for (const material of [].concat(o.material)) {
            if (overheadMaterials.has(material)) continue;
            const overhead = material.clone();
            if (palette[material.name]) overhead.color.fromArray(palette[material.name]);
            const hsl = overhead.color.getHSL({});
            if (hsl.s > .2) overhead.color.lerp(new THREE.Color("#8a8177"), .18).multiplyScalar(.8);
            overhead.userData.neutralSurface = hsl.s < .18;
            overhead.userData.sourceLightness = hsl.l;
            if (overhead.userData.neutralSurface) {
                overhead.color.set("#ffffff");
                overhead.vertexColors = true;
            }
            overhead.metalness = 0;
            overhead.roughness = 1;
            overheadMaterials.set(material, overhead);
        }
        originalGeometry.set(o, o.geometry);
        const neutral = [].concat(o.material).map(m => overheadMaterials.get(m)).find(m => m.userData.neutralSurface);
        if (neutral) {
            const geometry = o.geometry.clone(), positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
            const colors = new Float32Array(positions.count * 3), point = new THREE.Vector3, normal = new THREE.Vector3;
            const normalMatrix = (new THREE.Matrix3).getNormalMatrix(o.matrixWorld);
            const floorColor = new THREE.Color("#cfc5b3"), wallColor = new THREE.Color("#94adb8");
            const wallCap = new THREE.Color("#708f9e"), seating = new THREE.Color("#465860"), table = new THREE.Color("#bfb5a4");
            for (let i = 0; i < positions.count; i++) {
                point.fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld);
                if (normals) normal.fromBufferAttribute(normals, i).applyNormalMatrix(normalMatrix); else normal.set(0, 1, 0);
                const color = neutral.userData.sourceLightness < .22 ? seating : Math.abs(normal.y) > .7 ? point.y < .18 ? floorColor : point.y > floor.eyeHeight * .9 ? wallCap : table : wallColor;
                color.toArray(colors, i * 3);
            }
            geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
            overheadGeometry.set(o, geometry);
        }
    });
    const bounds = (new THREE.Box3).setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3);
    const size = bounds.getSize(new THREE.Vector3);
    const span = Math.max(size.x, size.z);
    sun.position.set(center.x - span * .45, span * .85, center.z - span * .3);
    sun.target.position.copy(center);
    scene.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
        left: -span * .75,
        right: span * .75,
        top: span * .75,
        bottom: -span * .75,
        near: .1,
        far: span * 4
    });
    sun.shadow.normalBias = .025;
    sun.shadow.bias = -1e-4;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    sun.shadow.intensity = .7;
    const points = (route?.positions || [ floor.nodes[floor.start].pos3d ]).map(p => new THREE.Vector3(...p));
    const lengths = [ 0 ];
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
    const total = lengths.at(-1);
    let distance = 0, playing = Boolean(total), mode = "topdown", disposed = false;
    let speed = 3;
    let yawOffset = 0, pitchOffset = 0, drag = null, last = performance.now(), frame;
    const position = new THREE.Vector3, direction = new THREE.Vector3(0, 0, -1);
    const aim = new THREE.PerspectiveCamera, look = new THREE.Vector3, offset = new THREE.Quaternion;
    const routeLine = new THREE.Line((new THREE.BufferGeometry).setFromPoints(points.map(p => new THREE.Vector3(p.x, .08, p.z))), new THREE.LineBasicMaterial({
        color: "#007f75",
        depthTest: false
    }));
    routeLine.renderOrder = 5;
    scene.add(routeLine);
    const shape = new THREE.Shape;
    shape.moveTo(0, .7);
    shape.lineTo(.34, .04);
    shape.lineTo(.15, .04);
    shape.lineTo(.15, -.48);
    shape.lineTo(-.15, -.48);
    shape.lineTo(-.15, .04);
    shape.lineTo(-.34, .04);
    shape.closePath();
    const arrowGeometry = new THREE.ShapeGeometry(shape);
    arrowGeometry.rotateX(-Math.PI / 2);
    const arrowMaterial = new THREE.MeshBasicMaterial({
        color: "#ef233c",
        side: THREE.DoubleSide,
        depthTest: false
    });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    const arrowScale = Math.max(.7, span / 32);
    arrow.scale.setScalar(arrowScale);
    arrow.renderOrder = 20;
    scene.add(arrow);
    const destination = new THREE.Mesh(new THREE.RingGeometry(.22 * arrowScale, .32 * arrowScale, 32), new THREE.MeshBasicMaterial({
        color: "#ef233c",
        side: THREE.DoubleSide,
        depthTest: false
    }));
    destination.rotation.x = -Math.PI / 2;
    destination.position.set(points.at(-1).x, .06, points.at(-1).z);
    destination.renderOrder = 10;
    destination.visible = Boolean(total);
    scene.add(destination);
    const toolbar = document.createElement("div");
    toolbar.className = "media-controls";
    container.append(toolbar);
    function button(text, action) {
        const b = document.createElement("button");
        b.textContent = text;
        b.onclick = action;
        toolbar.append(b);
        return b;
    }
    const play = button("Pause", () => {
        if (!total) return;
        if (distance >= total) distance = 0;
        playing = !playing;
        updateControls();
        report();
    });
    button("Replay", () => {
        distance = 0;
        playing = Boolean(total);
        updateControls();
        place(0, true);
        report();
    });
    const topButton = button("Top-down", () => setMode("topdown"));
    const povButton = button("POV", () => setMode("pov"));
    const speedButton = button("Speed 3×", () => {
        const speeds = [ 1, 2, 3, 5 ];
        speed = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
        speedButton.textContent = `Speed ${speed}×`;
    });
    button("Fit floor", () => {
        fit();
        setMode("topdown");
    });
    let low = false;
    button("Lower detail", e => {
        low = !low;
        renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, 1.5));
        e.target.textContent = low ? "Standard detail" : "Lower detail";
        resize();
    });
    const hint = document.createElement("span");
    hint.className = "viewer-hint";
    toolbar.append(hint);
    function sample(at) {
        if (points.length === 1) return points[0].clone();
        let i = 1;
        while (i < lengths.length - 1 && lengths[i] < at) i++;
        return (new THREE.Vector3).lerpVectors(points[i - 1], points[i], (at - lengths[i - 1]) / Math.max(1e-4, lengths[i] - lengths[i - 1]));
    }
    function place(dt, immediate = false) {
        position.copy(sample(distance));
        const ahead = sample(Math.min(total, distance + .4));
        if (ahead.distanceToSquared(position) > 1e-6) direction.subVectors(ahead, position).normalize(); else if (total) direction.subVectors(position, sample(Math.max(0, total - .3))).normalize();
        if (direction.lengthSq() < 1e-6) direction.set(0, 0, -1);
        const heading = Math.atan2(direction.x, -direction.z);
        const visibleScale = Math.max(arrowScale, (top.right - top.left) / top.zoom / Math.max(1, container.clientWidth) * 16);
        arrow.scale.setScalar(visibleScale);
        destination.scale.setScalar(visibleScale / arrowScale);
        arrow.position.set(position.x, .1, position.z);
        arrow.rotation.y = -heading;
        pov.position.copy(position);
        aim.position.copy(position);
        aim.lookAt(look.copy(position).add(direction));
        offset.setFromEuler(new THREE.Euler(pitchOffset, yawOffset, 0, "YXZ"));
        aim.quaternion.multiply(offset);
        if (immediate) pov.quaternion.copy(aim.quaternion); else pov.quaternion.slerp(aim.quaternion, Math.min(1, dt * 7));
        if (mode === "pov") {
            const facing = new THREE.Vector3;
            pov.getWorldDirection(facing);
            onPosition(position.toArray(), Math.atan2(facing.x, -facing.z));
        } else onPosition(position.toArray(), heading);
        container.dataset.routeProgress = String(total ? distance / total : 0);
    }
    function updateControls() {
        play.textContent = playing ? "Pause" : distance >= total && total ? "Play again" : "Play route";
        play.disabled = !total;
        topButton.setAttribute("aria-pressed", String(mode === "topdown"));
        povButton.setAttribute("aria-pressed", String(mode === "pov"));
        hint.textContent = mode === "topdown" ? "Red arrow follows the route · drag to pan · scroll to zoom" : "Drag to look around";
    }
    function report() {
        onStatus(total && distance >= total ? "You have reached the checkpoint." : `${floor.label} · ${mode === "topdown" ? "Top-down" : "POV"} · ${total ? playing ? "Following the route" : "Paused" : "Select a destination"}`);
    }
    function setMode(next) {
        mode = next;
        drag = null;
        controls.enabled = mode === "topdown";
        arrow.visible = mode === "topdown";
        routeLine.visible = mode === "topdown";
        destination.visible = mode === "topdown" && Boolean(total);
        model.traverse(o => {
            const original = originalMaterials.get(o);
            if (!original) return;
            o.material = Array.isArray(original) ? original.map(m => overheadMaterials.get(m)) : overheadMaterials.get(original);
            o.geometry = overheadGeometry.get(o) || originalGeometry.get(o);
        });
        renderer.shadowMap.enabled = mode === "topdown";
        renderer.shadowMap.needsUpdate = mode === "topdown";
        renderer.toneMappingExposure = 1;
        ambient.intensity = mode === "topdown" ? 1.2 : 2.5;
        sun.intensity = mode === "topdown" ? 2 : 2.2;
        sun.color.set(mode === "topdown" ? "#ffffff" : "#fff4e2");
        scene.background.set(mode === "topdown" ? "#d4d8db" : "#d9e4eb");
        container.dataset.navigationMode = mode;
        place(0, true);
        updateControls();
        report();
    }
    function fit() {
        top.position.set(center.x, bounds.max.y + span + 10, center.z);
        controls.target.copy(center);
        top.lookAt(center);
        top.zoom = 1;
        top.updateProjectionMatrix();
        controls.update();
    }
    function resize() {
        const w = container.clientWidth, h = container.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        const aspect = w / h;
        const width = Math.max(size.x + 2, (size.z + 2) * aspect), height = width / aspect;
        top.left = -width / 2;
        top.right = width / 2;
        top.top = height / 2;
        top.bottom = -height / 2;
        top.updateProjectionMatrix();
        pov.aspect = aspect;
        pov.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("pointerdown", e => {
        if (mode !== "pov") return;
        drag = {
            x: e.clientX,
            y: e.clientY
        };
        renderer.domElement.setPointerCapture(e.pointerId);
    });
    renderer.domElement.addEventListener("pointermove", e => {
        if (!drag || mode !== "pov") return;
        yawOffset -= (e.clientX - drag.x) * .004;
        pitchOffset = Math.max(-1.2, Math.min(1.2, pitchOffset - (e.clientY - drag.y) * .004));
        drag = {
            x: e.clientX,
            y: e.clientY
        };
    });
    for (const event of [ "pointerup", "pointercancel" ]) renderer.domElement.addEventListener(event, () => drag = null);
    resize();
    fit();
    setMode("topdown");
    function animate(now) {
        if (disposed) return;
        const dt = Math.min(.1, (now - last) / 1e3);
        last = now;
        if (playing) {
            distance = Math.min(total, distance + dt * (floor.eyeHeight < 1 ? 1 : 1.5) * speed);
            if (distance >= total) {
                playing = false;
                updateControls();
                report();
            }
        }
        place(dt);
        if (mode === "topdown") controls.update();
        renderer.render(scene, mode === "topdown" ? top : pov);
        frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return {
        replay() {
            distance = 0;
            playing = Boolean(total);
            place(0, true);
            updateControls();
            report();
        },
        fit() {
            fit();
            setMode("topdown");
        },
        zoom(factor) {
            if (mode === "topdown") {
                top.zoom = Math.max(.65, Math.min(8, top.zoom / factor));
                top.updateProjectionMatrix();
                controls.update();
            } else {
                pov.fov = Math.max(40, Math.min(100, pov.fov * factor));
                pov.updateProjectionMatrix();
            }
        },
        resize: resize,
        dispose() {
            disposed = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
            for (const o of [ routeLine, arrow, destination ]) {
                o.geometry.dispose();
                o.material.dispose();
            }
            for (const [o, material] of originalMaterials) o.material = material;
            for (const [o, geometry] of originalGeometry) o.geometry = geometry;
            for (const geometry of overheadGeometry.values()) geometry.dispose();
            for (const material of overheadMaterials.values()) material.dispose();
            sun.shadow.map?.dispose();
            release();
            toolbar.remove();
            delete container.dataset.routeProgress;
            delete container.dataset.navigationMode;
        }
    };
}
