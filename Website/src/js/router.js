(function(root) {
    "use strict";
    function route(floor, start, goal) {
        const nodes = floor.nodes;
        if (!nodes[start] || !nodes[goal]) return null;
        const adjacency = new Map(Object.keys(nodes).map(id => [ id, [] ]));
        const distance = (a, b) => Math.hypot(...nodes[a].map.map((v, i) => v - nodes[b].map[i]));
        for (const [a, b] of floor.edges) {
            if (!adjacency.has(a) || !adjacency.has(b)) throw new Error(`Invalid graph edge ${a} → ${b}`);
            const cost = distance(a, b);
            adjacency.get(a).push([ b, cost ]);
            adjacency.get(b).push([ a, cost ]);
        }
        const open = new Set([ start ]), score = new Map([ [ start, 0 ] ]), prev = new Map;
        while (open.size) {
            let current, best = Infinity;
            for (const id of open) {
                const value = score.get(id) + distance(id, goal);
                if (value < best) {
                    best = value;
                    current = id;
                }
            }
            if (current === goal) {
                const ids = [ goal ];
                while (prev.has(ids[0])) ids.unshift(prev.get(ids[0]));
                return {
                    ids: ids,
                    points: ids.map(id => nodes[id].map),
                    positions: ids.map(id => nodes[id].pos3d),
                    distance: score.get(goal)
                };
            }
            open.delete(current);
            for (const [next, cost] of adjacency.get(current)) {
                const candidate = score.get(current) + cost;
                if (candidate < (score.get(next) ?? Infinity)) {
                    prev.set(next, current);
                    score.set(next, candidate);
                    open.add(next);
                }
            }
        }
        return null;
    }
    root.DemoRouter = {
        route: route
    };
    if (typeof module !== "undefined") module.exports = root.DemoRouter;
})(globalThis);
