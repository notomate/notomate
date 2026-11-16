import { WhiteboardEdgeData, ConnectionPointType } from '../../../../types/view';
import { Point } from '../tools/types';

type EdgeShape = Pick<WhiteboardEdgeData, 'startPoint' | 'endPoint' | 'curveType' | 'roundness'> & {
    startConnectionPoint?: ConnectionPointType | null;
    endConnectionPoint?: ConnectionPointType | null;
};

/** Outward direction of a connection point (pointing away from the shape). */
const SIDE_DIR: Record<ConnectionPointType, Point> = {
    top: { x: 0, y: -1 },
    bottom: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
};

/** Minimum straight run out of (and into) an attached side before the elbow turns. */
const ELBOW_STUB = 48;

const sign = (v: number) => (Math.abs(v) < 1e-6 ? 0 : Math.sign(v));
const segDir = (a: Point, b: Point): Point => ({ x: sign(b.x - a.x), y: sign(b.y - a.y) });

/** Drop zero-length segments and merge collinear runs. */
const simplify = (pts: Point[]): Point[] => {
    const out: Point[] = [];
    for (const p of pts) {
        const last = out[out.length - 1];
        if (last && Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) continue;
        if (out.length >= 2) {
            const a = out[out.length - 2];
            const d1 = segDir(a, last);
            const d2 = segDir(last, p);
            if (d1.x === d2.x && d1.y === d2.y) {
                out[out.length - 1] = p;
                continue;
            }
        }
        out.push(p);
    }
    return out;
};

const pathLength = (pts: Point[]) =>
    pts.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - pts[i].x) + Math.abs(p.y - pts[i].y), 0);

/**
 * Orthogonal route for an elbow edge. An end attached to a side leaves / enters
 * perpendicular to that side (through a short stub), and the route never doubles
 * back into a stub. Free ends have no constraint.
 */
const routeElbow = (d: EdgeShape): Point[] => {
    const s = d.startPoint;
    const e = d.endPoint;
    const ds = d.startConnectionPoint ? SIDE_DIR[d.startConnectionPoint] : null;
    const de = d.endConnectionPoint ? SIDE_DIR[d.endConnectionPoint] : null;

    // Both ends free: classic three-segment elbow along the dominant axis
    if (!ds && !de) {
        if (Math.abs(e.y - s.y) > Math.abs(e.x - s.x)) {
            const midY = (s.y + e.y) / 2;
            return [s, { x: s.x, y: midY }, { x: e.x, y: midY }, e];
        }
        const midX = (s.x + e.x) / 2;
        return [s, { x: midX, y: s.y }, { x: midX, y: e.y }, e];
    }

    // Axis each end must run along (taken from the other end when one is free)
    const axisOf = (dir: Point | null) => (dir ? (dir.x !== 0 ? 'h' : 'v') : null);
    const axS = axisOf(ds) ?? axisOf(de)!;
    const axE = axisOf(de) ?? axisOf(ds)!;

    const s1 = ds ? { x: s.x + ds.x * ELBOW_STUB, y: s.y + ds.y * ELBOW_STUB } : s;
    const e1 = de ? { x: e.x + de.x * ELBOW_STUB, y: e.y + de.y * ELBOW_STUB } : e;

    // Candidates in order of preference. The first one that leaves/enters
    // perpendicular to its sides without doubling back wins.
    const preferred: Point[][] = [];
    if (axS === 'h' && axE === 'h') {
        // Bend exactly halfway between the two ends
        const mx = (s.x + e.x) / 2;
        preferred.push([s, { x: mx, y: s.y }, { x: mx, y: e.y }, e]);
    } else if (axS === 'v' && axE === 'v') {
        const my = (s.y + e.y) / 2;
        preferred.push([s, { x: s.x, y: my }, { x: e.x, y: my }, e]);
    } else if (axS === 'h') {
        preferred.push([s, { x: e.x, y: s.y }, e]);   // single corner
    } else {
        preferred.push([s, { x: s.x, y: e.y }, e]);
    }

    // Fallbacks through the stubs, then detours around both ends
    const mx1 = (s1.x + e1.x) / 2;
    const my1 = (s1.y + e1.y) / 2;
    const fallbacks: Point[][] = [
        [s, s1, { x: mx1, y: s1.y }, { x: mx1, y: e1.y }, e1, e],
        [s, s1, { x: s1.x, y: my1 }, { x: e1.x, y: my1 }, e1, e],
        [s, s1, { x: e1.x, y: s1.y }, e1, e],
        [s, s1, { x: s1.x, y: e1.y }, e1, e],
    ];
    const pad = ELBOW_STUB * 2;
    for (const x of [Math.max(s1.x, e1.x) + pad, Math.min(s1.x, e1.x) - pad]) {
        fallbacks.push([s, s1, { x, y: s1.y }, { x, y: e1.y }, e1, e]);
    }
    for (const y of [Math.max(s1.y, e1.y) + pad, Math.min(s1.y, e1.y) - pad]) {
        fallbacks.push([s, s1, { x: s1.x, y }, { x: e1.x, y }, e1, e]);
    }

    /** 0 when the route respects both sides and never U-turns; otherwise a penalty. */
    const violations = (pts: Point[]): number => {
        if (pts.length < 2) return 1;
        let v = 0;
        for (let i = 1; i < pts.length - 1; i++) {
            const a = segDir(pts[i - 1], pts[i]);
            const b = segDir(pts[i], pts[i + 1]);
            if (a.x === -b.x && a.y === -b.y) v++;
        }
        const segLen = (a: Point, b: Point) => Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
        const bends = pts.length > 2;
        if (ds) {
            const first = segDir(pts[0], pts[1]);
            if (first.x !== ds.x || first.y !== ds.y) v++;
            // Don't turn right next to the side
            if (bends && segLen(pts[0], pts[1]) < ELBOW_STUB - 0.5) v++;
        }
        if (de) {
            const n = pts.length;
            const last = segDir(pts[n - 2], pts[n - 1]);
            if (last.x !== -de.x || last.y !== -de.y) v++;
            if (bends && segLen(pts[n - 2], pts[n - 1]) < ELBOW_STUB - 0.5) v++;
        }
        return v;
    };

    for (const c of preferred) {
        const pts = simplify(c);
        if (violations(pts) === 0) return pts;
    }

    let best: Point[] | null = null;
    let bestScore = Infinity;
    for (const c of fallbacks) {
        const pts = simplify(c);
        const score = violations(pts) * 100000 + pathLength(pts) + (pts.length - 2) * 8;
        if (score < bestScore) {
            bestScore = score;
            best = pts;
        }
    }
    return best ?? [s, e];
};

/** Corner radius for rounded elbow edges (shrunk on short segments). */
const ELBOW_RADIUS = 16;

/**
 * Splits an orthogonal route into straight runs and rounded corners: for every
 * interior vertex, the points where the curve leaves the incoming segment and
 * joins the outgoing one. The vertex itself is the quadratic control point.
 */
const roundedCorners = (pts: Point[]): { from: Point; corner: Point; to: Point }[] => {
    const out: { from: Point; corner: Point; to: Point }[] = [];
    for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i - 1];
        const c = pts[i];
        const b = pts[i + 1];
        const lenIn = Math.hypot(c.x - a.x, c.y - a.y);
        const lenOut = Math.hypot(b.x - c.x, b.y - c.y);
        if (lenIn < 1e-6 || lenOut < 1e-6) continue;
        // Interior segments are shared by two corners, so each gets at most half
        const maxIn = i === 1 ? lenIn : lenIn / 2;
        const maxOut = i === pts.length - 2 ? lenOut : lenOut / 2;
        const r = Math.min(ELBOW_RADIUS, maxIn, maxOut);
        out.push({
            from: { x: c.x + ((a.x - c.x) / lenIn) * r, y: c.y + ((a.y - c.y) / lenIn) * r },
            corner: c,
            to: { x: c.x + ((b.x - c.x) / lenOut) * r, y: c.y + ((b.y - c.y) / lenOut) * r },
        });
    }
    return out;
};

const quad = (p0: Point, c: Point, p1: Point, steps: number): Point[] => {
    const pts: Point[] = [];
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        pts.push({
            x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
            y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
        });
    }
    return pts;
};

/** The edge as a polyline (bezier edges are sampled). Used for drawing, arrowheads and hit-testing. */
export const getEdgePolyline = (d: EdgeShape): Point[] => {
    const s = d.startPoint;
    const e = d.endPoint;

    if (d.curveType === 'elbow') {
        const pts = routeElbow(d);
        if (d.roundness !== 'round') return pts;
        const out: Point[] = [pts[0]];
        for (const { from, corner, to } of roundedCorners(pts)) {
            out.push(from, ...quad(from, corner, to, 6));
        }
        out.push(pts[pts.length - 1]);
        return out;
    }

    if (d.curveType === 'bezier') {
        const mid = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
        return [
            s,
            ...quad(s, { x: mid.x, y: s.y }, mid, 12),
            ...quad(mid, { x: mid.x, y: e.y }, e, 12),
        ];
    }

    return [s, e];
};

/** SVG path data for the edge. */
export const getEdgePath = (d: EdgeShape): string => {
    const s = d.startPoint;
    const e = d.endPoint;
    if (d.curveType === 'bezier') {
        const midX = (s.x + e.x) / 2;
        const midY = (s.y + e.y) / 2;
        return `M ${s.x} ${s.y} Q ${midX} ${s.y} ${midX} ${midY} Q ${midX} ${e.y} ${e.x} ${e.y}`;
    }
    if (d.curveType === 'elbow' && d.roundness === 'round') {
        const pts = routeElbow(d);
        const parts = [`M ${pts[0].x} ${pts[0].y}`];
        for (const { from, corner, to } of roundedCorners(pts)) {
            parts.push(`L ${from.x} ${from.y}`, `Q ${corner.x} ${corner.y} ${to.x} ${to.y}`);
        }
        const last = pts[pts.length - 1];
        parts.push(`L ${last.x} ${last.y}`);
        return parts.join(' ');
    }
    return getEdgePolyline(d)
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ');
};

/**
 * Arrowhead angles: `startAngle` points outward from the start, `endAngle` points
 * outward from the end (i.e. along the direction of travel).
 */
export const getEdgeArrowAngles = (d: EdgeShape): { startAngle: number; endAngle: number } => {
    const pts = getEdgePolyline(d);
    const first = pts[0];
    const last = pts[pts.length - 1];
    const EPS = 0.01;
    // Skip zero-length segments (e.g. an elbow whose ends are aligned)
    const afterFirst = pts.find((p) => Math.hypot(p.x - first.x, p.y - first.y) > EPS) ?? last;
    const beforeLast = [...pts].reverse().find((p) => Math.hypot(p.x - last.x, p.y - last.y) > EPS) ?? first;
    return {
        startAngle: Math.atan2(first.y - afterFirst.y, first.x - afterFirst.x),
        endAngle: Math.atan2(last.y - beforeLast.y, last.x - beforeLast.x),
    };
};

const distToSegment = (p: Point, a: Point, b: Point): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

/** Shortest distance from a point to the drawn edge. */
export const distanceToEdge = (p: Point, d: EdgeShape): number => {
    const pts = getEdgePolyline(d);
    let min = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
        min = Math.min(min, distToSegment(p, pts[i], pts[i + 1]));
    }
    return min;
};
