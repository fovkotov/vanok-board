#!/usr/bin/env python3
"""Organic apple GLBs for the material playground.

The body is a squashed sphere with low-frequency lobes, a stem cavity, and a
blossom dimple — not a surface of revolution. Stem is a curved tube; the half
is that apple cut on a vertical plane facing the default camera.
"""

import json
import struct
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "models"

PHI_SEG = 176
THETA_SEG = 112
STEM_SEG = 36
STEM_SIDES = 14
LEAF_U = 22
LEAF_V = 9

# Default camera in design/playground/index.html looks from this point.
CAMERA = np.array([2.25, 1.35, 2.85], dtype=np.float64)
TARGET = np.array([0.0, 0.05, 0.0], dtype=np.float64)


def srgb_to_linear(hex_color):
    rgb = [((hex_color >> shift) & 255) / 255.0 for shift in (16, 8, 0)]
    out = []
    for channel in rgb:
        if channel <= 0.04045:
            out.append(channel / 12.92)
        else:
            out.append(((channel + 0.055) / 1.055) ** 2.4)
    return out + [1.0]


def smoothstep(edge0, edge1, value):
    span = edge1 - edge0
    t = np.clip((value - edge0) / span, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def normalize(vector):
    length = np.linalg.norm(vector)
    if length < 1e-12:
        raise ValueError("zero vector")
    return vector / length


def camera_horizontal():
    view = CAMERA - TARGET
    flat = np.array([view[0], 0.0, view[2]], dtype=np.float64)
    return normalize(flat)


def apple_surface(phi_seg, theta_seg):
    """Squashed sphere, lumpy equator, stem bowl, blossom dimple."""
    phi = np.linspace(0.0, 2.0 * np.pi, phi_seg, endpoint=False)
    theta = np.linspace(0.0, np.pi, theta_seg)
    theta_grid, phi_grid = np.meshgrid(theta, phi, indexing="ij")
    sin_t = np.sin(theta_grid)
    cos_t = np.cos(theta_grid)
    cos_p = np.cos(phi_grid)
    sin_p = np.sin(phi_grid)

    # Wider than tall, slightly oval, shoulders a touch above the equator.
    profile = 1.0 + 0.055 * np.cos(theta_grid - 0.62) * sin_t
    # 4 ribs plus a 3-fold term so the equator is lumpy rather than round.
    # Phase puts a rib toward the default camera, which squares the silhouette.
    lobe = sin_t ** 0.9 * (
        0.105 * np.cos(4.0 * phi_grid - 0.55)
        + 0.062 * np.cos(3.0 * phi_grid + 0.40)
        + 0.028 * np.cos(5.0 * phi_grid - 1.20)
    )
    radial = profile * (1.0 + lobe)
    x = 1.01 * radial * sin_t * cos_p
    z = 0.96 * radial * sin_t * sin_p
    y = 0.86 * cos_t
    y = y + 0.018 * sin_t * np.sin(3.0 * phi_grid + 0.4)

    rho = np.sqrt(x * x + z * z)
    cavity = np.exp(-((rho / 0.40) ** 2)) * smoothstep(0.08, 0.58, y)
    y = y - 0.42 * cavity
    pinch = 1.0 - 0.18 * cavity
    x = x * pinch
    z = z * pinch

    rho = np.sqrt(x * x + z * z)
    blossom = np.exp(-((rho / 0.20) ** 2)) * smoothstep(0.15, 0.55, -y)
    y = y + 0.11 * blossom
    blossom_pinch = 1.0 - 0.06 * blossom
    x = x * blossom_pinch
    z = z * blossom_pinch

    positions = np.stack([x, y, z], axis=-1).reshape(-1, 3)
    faces = []
    for row in range(theta_seg - 1):
        for col in range(phi_seg):
            nxt = (col + 1) % phi_seg
            a = row * phi_seg + col
            b = row * phi_seg + nxt
            c = (row + 1) * phi_seg + col
            d = (row + 1) * phi_seg + nxt
            # (next phi) × (next theta) points outward on this parameterization.
            faces.append((a, b, c))
            faces.append((b, d, c))
    return positions, np.asarray(faces, dtype=np.int64)


def weld(positions, faces, tol=1e-5):
    positions = np.ascontiguousarray(positions, dtype=np.float64)
    quant = np.round(positions / tol).astype(np.int64)
    order = np.lexsort((quant[:, 2], quant[:, 1], quant[:, 0]))
    sorted_q = quant[order]
    if len(sorted_q) == 0:
        return positions, faces[:0]
    change = np.any(np.diff(sorted_q, axis=0) != 0, axis=1)
    group = np.empty(len(sorted_q), dtype=np.int64)
    group[0] = 0
    if len(change):
        group[1:] = np.cumsum(change)
    inverse = np.empty(len(sorted_q), dtype=np.int64)
    inverse[order] = group
    unique_index = order[np.concatenate([np.array([True]), change])]
    welded = positions[unique_index]
    remapped = inverse[faces]
    distinct = (
        (remapped[:, 0] != remapped[:, 1])
        & (remapped[:, 1] != remapped[:, 2])
        & (remapped[:, 0] != remapped[:, 2])
    )
    remapped = remapped[distinct]
    v0 = welded[remapped[:, 0]]
    v1 = welded[remapped[:, 1]]
    v2 = welded[remapped[:, 2]]
    area = np.linalg.norm(np.cross(v1 - v0, v2 - v0), axis=1)
    remapped = remapped[area > 1e-10]
    return welded, remapped


def smooth_normals(positions, faces):
    normals = np.zeros_like(positions)
    v0 = positions[faces[:, 0]]
    v1 = positions[faces[:, 1]]
    v2 = positions[faces[:, 2]]
    face_normals = np.cross(v1 - v0, v2 - v0)
    np.add.at(normals, faces[:, 0], face_normals)
    np.add.at(normals, faces[:, 1], face_normals)
    np.add.at(normals, faces[:, 2], face_normals)
    length = np.linalg.norm(normals, axis=1, keepdims=True)
    if np.any(length < 1e-12):
        raise RuntimeError("vertex with zero normal")
    return normals / length


def compact(positions, faces):
    used = np.unique(faces.reshape(-1))
    remap = np.full(len(positions), -1, dtype=np.int64)
    remap[used] = np.arange(len(used))
    return positions[used], remap[faces]


def prepare(positions, faces):
    positions, faces = compact(positions, faces)
    positions, faces = weld(positions, faces)
    normals = smooth_normals(positions, faces)
    return positions, normals, faces


def triangle_count(faces):
    return int(len(faces))


def rodrigues(vector, axis, angle):
    cos_a = np.cos(angle)
    sin_a = np.sin(angle)
    return vector * cos_a + np.cross(axis, vector) * sin_a + axis * np.dot(axis, vector) * (1.0 - cos_a)


def curve_frames(curve):
    tangent = np.gradient(curve, axis=0)
    tangent /= np.maximum(np.linalg.norm(tangent, axis=1, keepdims=True), 1e-12)
    normals = np.zeros_like(curve)
    binormals = np.zeros_like(curve)
    reference = np.array([1.0, 0.0, 0.0]) if abs(tangent[0, 0]) < 0.85 else np.array([0.0, 0.0, 1.0])
    normal = normalize(np.cross(tangent[0], reference))
    binormal = np.cross(tangent[0], normal)
    normals[0] = normal
    binormals[0] = binormal
    for index in range(1, len(curve)):
        axis = np.cross(tangent[index - 1], tangent[index])
        sine = np.linalg.norm(axis)
        cosine = float(np.clip(np.dot(tangent[index - 1], tangent[index]), -1.0, 1.0))
        if sine < 1e-8:
            normal = normals[index - 1]
        else:
            normal = rodrigues(normals[index - 1], axis / sine, np.arctan2(sine, cosine))
        normal = normal - tangent[index] * np.dot(normal, tangent[index])
        length = np.linalg.norm(normal)
        if length < 1e-8:
            reference = np.array([1.0, 0.0, 0.0]) if abs(tangent[index, 0]) < 0.85 else np.array([0.0, 0.0, 1.0])
            normal = np.cross(tangent[index], reference)
            length = np.linalg.norm(normal)
        normal = normal / length
        binormal = np.cross(tangent[index], normal)
        normals[index] = normal
        binormals[index] = binormal
    return tangent, normals, binormals


def cubic_bezier(p0, p1, p2, p3, count):
    t = np.linspace(0.0, 1.0, count)[:, None]
    inv = 1.0 - t
    return inv ** 3 * p0 + 3 * inv ** 2 * t * p1 + 3 * inv * t ** 2 * p2 + t ** 3 * p3


def stem_curve(bend, side, count=STEM_SEG):
    """Hooked stalk: rises out of the cavity, then bends over."""
    bend = normalize(np.asarray(bend, dtype=np.float64))
    side = np.asarray(side, dtype=np.float64)
    side = normalize(side - bend * np.dot(side, bend))
    up = np.array([0.0, 1.0, 0.0])
    p0 = up * 0.66 + bend * 0.08
    p1 = up * 1.02 + bend * 0.06 + side * 0.01
    p2 = up * 1.22 + bend * 0.24 + side * 0.16
    p3 = up * 1.14 + bend * 0.42 + side * 0.22
    return cubic_bezier(p0, p1, p2, p3, count)


def tube_mesh(curve, radius_start, radius_end, sides):
    tangent, normals, binormals = curve_frames(curve)
    count = len(curve)
    angles = np.linspace(0.0, 2.0 * np.pi, sides, endpoint=False)
    cos_a = np.cos(angles)
    sin_a = np.sin(angles)
    radii = np.linspace(radius_start, radius_end, count)
    rings = []
    for index in range(count):
        ring = (
            curve[index]
            + radii[index] * cos_a[:, None] * normals[index]
            + radii[index] * sin_a[:, None] * binormals[index]
        )
        rings.append(ring)
    verts = np.concatenate(rings, axis=0)
    faces = []
    for index in range(count - 1):
        for side in range(sides):
            nxt = (side + 1) % sides
            a = index * sides + side
            b = index * sides + nxt
            c = (index + 1) * sides + side
            d = (index + 1) * sides + nxt
            # Outward: angular direction × tangent, matching the frame.
            faces.append((a, b, c))
            faces.append((b, d, c))
    base = len(verts)
    start_center = len(verts)
    verts = np.vstack([verts, curve[0], curve[-1]])
    tip_center = start_center + 1
    for side in range(sides):
        nxt = (side + 1) % sides
        # Start cap faces -tangent.
        faces.append((start_center, nxt, side))
        last = (count - 1) * sides
        faces.append((tip_center, last + side, last + nxt))
    return verts, np.asarray(faces, dtype=np.int64)


def leaf_mesh(curve, bend, side):
    """Thin solid leaf stuck into the side of the stem."""
    attach = 7
    origin = curve[attach]
    tangent = normalize(curve[attach + 1] - curve[attach - 1])
    length_dir = normalize(bend * 0.25 + side * 0.82 + np.array([0.0, 0.48, 0.0]))
    length_dir = normalize(length_dir - tangent * np.dot(length_dir, tangent))
    width_dir = normalize(np.cross(length_dir, np.array([0.0, 1.0, 0.0]) + bend * 0.15))
    up_dir = normalize(np.cross(length_dir, width_dir))
    if up_dir[1] < 0.0:
        width_dir = -width_dir
        up_dir = -up_dir
    origin = origin - length_dir * 0.03

    u = np.linspace(0.0, 1.0, LEAF_U)
    v = np.linspace(-1.0, 1.0, LEAF_V)
    uu, vv = np.meshgrid(u, v, indexing="ij")
    width = (np.sin(np.pi * uu) ** 0.72) * 0.085 * (1.0 - 0.25 * uu)
    lift = 0.016 * np.sin(np.pi * uu) * (1.0 - vv ** 2)
    curl = -0.012 * (vv ** 2) * np.sin(np.pi * uu)
    thickness = 0.0035 * (0.35 + 0.65 * np.sin(np.pi * uu)) * (1.0 - 0.45 * np.abs(vv))
    center = (
        origin
        + length_dir * (0.46 * uu)[..., None]
        + width_dir * (width * vv)[..., None]
        + up_dir * (lift + curl)[..., None]
    )
    top = center + up_dir * thickness[..., None]
    bottom = center - up_dir * thickness[..., None]
    top_flat = top.reshape(-1, 3)
    bottom_flat = bottom.reshape(-1, 3)
    verts = np.vstack([top_flat, bottom_flat])
    nu, nv = LEAF_U, LEAF_V
    faces = []

    def cell(i, j, flip):
        a = i * nv + j
        b = a + 1
        c = a + nv
        d = c + 1
        if not flip:
            return [(a, c, b), (b, c, d)]
        return [(a, b, c), (b, d, c)]

    for i in range(nu - 1):
        for j in range(nv - 1):
            faces.extend(cell(i, j, flip=False))
            faces.extend([(f[0] + nu * nv, f[2] + nu * nv, f[1] + nu * nv) for f in cell(i, j, flip=False)])

    centroid = verts.mean(axis=0)
    offset = nu * nv

    def stitch(index_top):
        for s in range(len(index_top) - 1):
            t0, t1 = index_top[s], index_top[s + 1]
            b0, b1 = t0 + offset, t1 + offset
            mid = (verts[t0] + verts[t1] + verts[b0]) / 3.0
            outward = np.cross(verts[b0] - verts[t0], verts[t1] - verts[t0])
            if np.dot(outward, mid - centroid) >= 0.0:
                faces.append((t0, b0, t1))
                faces.append((t1, b0, b1))
            else:
                faces.append((t0, t1, b0))
                faces.append((t1, b1, b0))

    stitch([i * nv for i in range(nu)])
    stitch([i * nv + (nv - 1) for i in range(nu)])
    stitch([j for j in range(nv)])
    stitch([(nu - 1) * nv + j for j in range(nv)])
    return verts, np.asarray(faces, dtype=np.int64)


def chord_deviation(curve):
    start, end = curve[0], curve[-1]
    axis = normalize(end - start)
    rel = curve - start
    closest = start + (rel @ axis)[:, None] * axis
    return float(np.linalg.norm(curve - closest, axis=1).max())


def assert_organic(positions, normals):
    rho = np.sqrt(positions[:, 0] ** 2 + positions[:, 2] ** 2)
    y = positions[:, 1]
    top = y > 0.25
    axis = top & (rho < 0.04)
    shoulder = top & (rho > 0.22) & (rho < 0.62)
    cavity_depth = float(y[shoulder].max() - y[axis].mean())
    if cavity_depth < 0.10:
        raise RuntimeError(f"stem cavity too shallow: {cavity_depth:.3f}")
    bottom = y < -0.25
    axis_b = bottom & (rho < 0.04)
    around = bottom & (rho > 0.16) & (rho < 0.50)
    dimple = float(y[axis_b].mean() - y[around].min())
    if dimple < 0.035:
        raise RuntimeError(f"blossom dimple too shallow: {dimple:.3f}")
    equator = np.abs(y) < 0.06
    lump = float(rho[equator].max() - rho[equator].min())
    if lump < 0.08:
        raise RuntimeError(f"equator not lumpy enough: {lump:.3f}")
    direction = positions / np.maximum(np.linalg.norm(positions, axis=1, keepdims=True), 1e-8)
    facing = np.sum(normals * direction, axis=1)
    if float(np.percentile(facing, 2)) < 0.15:
        raise RuntimeError(f"surface folded, normal alignment {float(facing.min()):.3f}")
    return {"cavity": cavity_depth, "dimple": dimple, "equator_lump": lump}


def clip_mesh(positions, faces, normal):
    """Keep the half-space dot(p, normal) <= 0. Boundary lies on the plane."""
    pos = np.asarray(positions, dtype=np.float64)
    n = normalize(np.asarray(normal, dtype=np.float64))
    if not np.isfinite(pos).all():
        raise RuntimeError("apple positions are not finite before the cut")
    with np.errstate(divide="ignore", over="ignore", invalid="ignore"):
        dist = pos @ n
    if not np.isfinite(dist).all():
        raise RuntimeError("cut plane distances are not finite")
    inside = dist <= 1e-7
    out_pos = []
    out_faces = []
    segments = []
    orig_map = {}
    edge_cache = {}

    def emit_orig(index):
        found = orig_map.get(index)
        if found is None:
            point = pos[index].copy()
            if abs(dist[index]) <= 1e-5:
                point = point - n * dist[index]
            found = len(out_pos)
            out_pos.append(point)
            orig_map[index] = found
        return found

    def intersect(i, j):
        key = (i, j) if i < j else (j, i)
        found = edge_cache.get(key)
        if found is None:
            di = float(dist[i])
            dj = float(dist[j])
            denom = di - dj
            t = 0.0 if abs(denom) < 1e-12 else di / denom
            t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
            point = pos[i] * (1.0 - t) + pos[j] * t
            point = point - n * float(np.dot(point, n))
            found = len(out_pos)
            out_pos.append(point)
            edge_cache[key] = found
        return found

    for tri in faces:
        i0, i1, i2 = int(tri[0]), int(tri[1]), int(tri[2])
        flags = (bool(inside[i0]), bool(inside[i1]), bool(inside[i2]))
        kept = flags[0] + flags[1] + flags[2]
        if kept == 0:
            continue
        if kept == 3:
            out_faces.append((emit_orig(i0), emit_orig(i1), emit_orig(i2)))
            continue
        idx = (i0, i1, i2)
        poly = []
        crosses = []
        for a in range(3):
            b = (a + 1) % 3
            ia, ib = idx[a], idx[b]
            ina, inb = flags[a], flags[b]
            if ina and inb:
                poly.append(emit_orig(ib))
            elif ina and not inb:
                point = intersect(ia, ib)
                poly.append(point)
                crosses.append(point)
            elif (not ina) and inb:
                point = intersect(ia, ib)
                poly.append(point)
                poly.append(emit_orig(ib))
                crosses.append(point)
        if len(poly) < 3:
            continue
        if len(crosses) == 2 and crosses[0] != crosses[1]:
            segments.append((crosses[0], crosses[1]))
        anchor = poly[0]
        for k in range(1, len(poly) - 1):
            aa, bb = poly[k], poly[k + 1]
            if anchor != aa and aa != bb and anchor != bb:
                out_faces.append((anchor, aa, bb))
    return np.asarray(out_pos, dtype=np.float64), np.asarray(out_faces, dtype=np.int64), segments, n


def chain_loop(segments):
    adjacency = {}
    for a, b in segments:
        a, b = int(a), int(b)
        if a == b:
            continue
        adjacency.setdefault(a, [])
        adjacency.setdefault(b, [])
        if b not in adjacency[a]:
            adjacency[a].append(b)
        if a not in adjacency[b]:
            adjacency[b].append(a)
    odd = [key for key, nbrs in adjacency.items() if len(nbrs) != 2]
    if odd:
        degrees = sorted(len(nbrs) for nbrs in adjacency.values())
        raise RuntimeError(f"cut boundary is not one loop ({len(odd)} odd vertices, degrees {degrees[:12]}…)")
    start = next(iter(adjacency))
    loop = [start]
    prev = None
    cur = start
    for _ in range(len(adjacency) + 2):
        nbrs = adjacency[cur]
        nxt = nbrs[0] if nbrs[0] != prev else nbrs[1]
        if nxt == start:
            break
        loop.append(nxt)
        prev, cur = cur, nxt
    else:
        raise RuntimeError("cut boundary did not close")
    if len(loop) != len(adjacency):
        raise RuntimeError(f"boundary split into multiple loops ({len(loop)} of {len(adjacency)})")
    return loop


def orient_loop(points, loop, normal):
    poly = points[loop]
    center = poly.mean(axis=0)
    signed = 0.0
    for index in range(len(poly)):
        a = poly[index] - center
        b = poly[(index + 1) % len(poly)] - center
        signed += float(np.dot(np.cross(a, b), normal))
    if signed < 0.0:
        loop = list(reversed(loop))
    return loop


def flesh_disc(boundary, normal, rings=14):
    """Concentric cap from the apple center out to the cut outline."""
    center = np.zeros(3, dtype=np.float64)
    center = center - normal * float(np.dot(center, normal))
    count = len(boundary)
    radii = np.linalg.norm(boundary - center, axis=1)
    if float(radii.min()) < 0.42:
        raise RuntimeError(f"cut outline passes too close to the core ({float(radii.min()):.3f})")
    verts = [center]
    for ring in range(1, rings + 1):
        t = ring / rings
        verts.append(center * (1.0 - t) + boundary * t)
    positions = np.concatenate([np.asarray(v, dtype=np.float64).reshape(-1, 3) for v in verts], axis=0)
    # Push a shallow circular groove so the core reads in the flesh itself.
    radial = np.linalg.norm(positions - center, axis=1)
    groove = np.exp(-(((radial - 0.33) / 0.018) ** 2))
    positions = positions - normal * (0.006 * groove)[:, None]
    faces = []
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((0, 1 + index, 1 + nxt))
    for ring in range(1, rings):
        base = 1 + (ring - 1) * count
        nxt_base = base + count
        for index in range(count):
            nxt = (index + 1) % count
            a = base + index
            b = base + nxt
            c = nxt_base + index
            d = nxt_base + nxt
            faces.append((a, c, b))
            faces.append((b, c, d))
    return positions, np.asarray(faces, dtype=np.int64)


def torus_mesh(center, normal, u_axis, v_axis, major, minor, n_major, n_minor):
    center = center + normal * minor
    verts = []
    for i in range(n_major):
        angle = 2.0 * np.pi * i / n_major
        arm = np.cos(angle) * u_axis + np.sin(angle) * v_axis
        spine = center + major * arm
        for j in range(n_minor):
            beta = 2.0 * np.pi * j / n_minor
            verts.append(spine + minor * (np.cos(beta) * arm + np.sin(beta) * normal))
    positions = np.asarray(verts, dtype=np.float64)
    faces = []
    for i in range(n_major):
        ni = (i + 1) % n_major
        for j in range(n_minor):
            nj = (j + 1) % n_minor
            a = i * n_minor + j
            b = i * n_minor + nj
            c = ni * n_minor + j
            d = ni * n_minor + nj
            faces.append((a, c, b))
            faces.append((b, c, d))
    return positions, np.asarray(faces, dtype=np.int64)


def seed_prototype(seg=12, rings=8):
    theta = np.linspace(0.0, np.pi, rings)
    phi = np.linspace(0.0, 2.0 * np.pi, seg, endpoint=False)
    theta_grid, phi_grid = np.meshgrid(theta, phi, indexing="ij")
    # Teardrop: fuller at -X (inner), tapered toward +X (outer tip).
    taper = 0.55 + 0.45 * (0.5 - 0.5 * np.cos(theta_grid))
    # Use phi around X by rebuilding from a sphere then stretching.
    x = np.cos(theta_grid)
    y = np.sin(theta_grid) * np.cos(phi_grid)
    z = np.sin(theta_grid) * np.sin(phi_grid)
    bulge = 1.0 - 0.35 * np.clip(x, 0.0, 1.0)
    x = x * (0.85 + 0.25 * np.clip(-x, 0.0, 1.0))
    y = y * bulge
    z = z * bulge
    positions = np.stack([x, y, z], axis=-1).reshape(-1, 3)
    positions = positions * np.array([0.062, 0.016, 0.030])
    faces = []
    for row in range(rings - 1):
        for col in range(seg):
            nxt = (col + 1) % seg
            a = row * seg + col
            b = row * seg + nxt
            c = (row + 1) * seg + col
            d = (row + 1) * seg + nxt
            faces.append((a, c, b))
            faces.append((b, c, d))
    positions, faces = weld(positions, np.asarray(faces, dtype=np.int64), tol=1e-6)
    _ = taper
    return positions, faces


def place_seeds(normal, u_axis, v_axis):
    local_pos, local_faces = seed_prototype()
    groups = []
    faces = []
    center = normal * 0.010
    for index in range(5):
        angle = np.pi / 2.0 + index * (2.0 * np.pi / 5.0)
        radial = np.cos(angle) * u_axis + np.sin(angle) * v_axis
        radial = normalize(radial)
        side = normalize(np.cross(normal, radial))
        rotation = np.column_stack([radial, normal, side])
        placed = local_pos @ rotation.T + center + radial * 0.175
        base = sum(len(g) for g in groups)
        groups.append(placed)
        faces.append(local_faces + base)
    return np.vstack(groups), np.concatenate(faces, axis=0)


def plane_basis(normal):
    up = np.array([0.0, 1.0, 0.0])
    u_axis = np.cross(up, normal)
    if np.linalg.norm(u_axis) < 1e-6:
        u_axis = np.cross(np.array([1.0, 0.0, 0.0]), normal)
    u_axis = normalize(u_axis)
    v_axis = normalize(np.cross(normal, u_axis))
    return u_axis, v_axis


class Glb:
    def __init__(self):
        self.blobs = []
        self.offset = 0
        self.buffer_views = []
        self.accessors = []
        self.materials = []
        self.meshes = []
        self.nodes = []

    def _align(self):
        pad = (4 - self.offset % 4) % 4
        if pad:
            self.blobs.append(b"\x00" * pad)
            self.offset += pad

    def add_view(self, array, target):
        data = np.ascontiguousarray(array).tobytes()
        self._align()
        view = len(self.buffer_views)
        self.buffer_views.append({
            "buffer": 0,
            "byteOffset": self.offset,
            "byteLength": len(data),
            "target": target,
        })
        self.blobs.append(data)
        self.offset += len(data)
        return view

    def add_material(self, name, hex_color, roughness):
        index = len(self.materials)
        self.materials.append({
            "name": name,
            "doubleSided": name == "DarkGreen",
            "pbrMetallicRoughness": {
                "baseColorFactor": [float(v) for v in srgb_to_linear(hex_color)],
                "metallicFactor": 0.0,
                "roughnessFactor": float(roughness),
            },
        })
        return index

    def add_mesh(self, name, positions, normals, faces, material):
        positions = np.ascontiguousarray(positions, dtype=np.float32)
        normals = np.ascontiguousarray(normals, dtype=np.float32)
        indices = np.ascontiguousarray(faces.reshape(-1), dtype=np.uint32)
        pos_view = self.add_view(positions, 34962)
        nrm_view = self.add_view(normals, 34962)
        idx_view = self.add_view(indices, 34963)
        pos_acc = len(self.accessors)
        self.accessors.append({
            "bufferView": pos_view,
            "componentType": 5126,
            "count": int(len(positions)),
            "type": "VEC3",
            "min": [float(v) for v in positions.min(axis=0)],
            "max": [float(v) for v in positions.max(axis=0)],
        })
        self.accessors.append({
            "bufferView": nrm_view,
            "componentType": 5126,
            "count": int(len(normals)),
            "type": "VEC3",
        })
        self.accessors.append({
            "bufferView": idx_view,
            "componentType": 5125,
            "count": int(indices.size),
            "type": "SCALAR",
        })
        mesh_index = len(self.meshes)
        self.meshes.append({
            "name": name,
            "primitives": [{
                "attributes": {"POSITION": pos_acc, "NORMAL": pos_acc + 1},
                "indices": pos_acc + 2,
                "material": material,
            }],
        })
        node_index = len(self.nodes)
        self.nodes.append({"name": name, "mesh": mesh_index})
        return node_index

    def pack(self, root_name):
        children = list(range(len(self.nodes)))
        root = len(self.nodes)
        self.nodes.append({"name": root_name, "children": children})
        payload = b"".join(self.blobs)
        description = {
            "asset": {"version": "2.0", "generator": "make_apple_real.py"},
            "scene": 0,
            "scenes": [{"nodes": [root], "name": root_name}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.buffer_views,
            "buffers": [{"byteLength": len(payload)}],
        }
        json_bytes = json.dumps(description, separators=(",", ":")).encode("utf-8")
        while len(json_bytes) % 4:
            json_bytes += b" "
        while len(payload) % 4:
            payload += b"\x00"
        total = 12 + 8 + len(json_bytes) + 8 + len(payload)
        header = struct.pack("<III", 0x46546C67, 2, total)
        json_chunk = struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes
        bin_chunk = struct.pack("<II", len(payload), 0x004E4942) + payload
        blob = header + json_chunk + bin_chunk
        if len(blob) != total:
            raise RuntimeError("glb length mismatch")
        return blob


def part_count(faces):
    return int(len(faces))


def build_whole(skin_pos, skin_faces, bend, side):
    curve = stem_curve(bend, side)
    if chord_deviation(curve) < 0.08:
        raise RuntimeError("stem is too straight")
    stem_pos, stem_faces = tube_mesh(curve, 0.040, 0.016, STEM_SIDES)
    leaf_pos, leaf_faces = leaf_mesh(curve, bend, side)
    skin_pos, skin_nrm, skin_faces = prepare(skin_pos, skin_faces)
    stem_pos, stem_nrm, stem_faces = prepare(stem_pos, stem_faces)
    leaf_pos, leaf_nrm, leaf_faces = prepare(leaf_pos, leaf_faces)
    glb = Glb()
    skin_mat = glb.add_material("green", 0x67C514, 0.42)
    stem_mat = glb.add_material("brown", 0x7A4E28, 0.64)
    leaf_mat = glb.add_material("DarkGreen", 0x2F861F, 0.52)
    glb.add_mesh("Skin", skin_pos, skin_nrm, skin_faces, skin_mat)
    glb.add_mesh("Stem", stem_pos, stem_nrm, stem_faces, stem_mat)
    glb.add_mesh("Leaf", leaf_pos, leaf_nrm, leaf_faces, leaf_mat)
    counts = {
        "skin": part_count(skin_faces),
        "stem": part_count(stem_faces),
        "leaf": part_count(leaf_faces),
    }
    counts["total"] = sum(counts.values())
    return glb.pack("AppleWhole"), counts, curve


def build_half(skin_pos, skin_faces, bend, side, cut_normal):
    clipped_pos, clipped_faces, segments, normal = clip_mesh(skin_pos, skin_faces, cut_normal)
    loop = orient_loop(clipped_pos, chain_loop(segments), normal)
    boundary = clipped_pos[np.asarray(loop, dtype=np.int64)]
    disc_pos, disc_faces = flesh_disc(boundary, normal)
    u_axis, v_axis = plane_basis(normal)
    core_pos, core_faces = torus_mesh(
        np.zeros(3), normal, u_axis, v_axis, major=0.33, minor=0.012, n_major=72, n_minor=8,
    )
    seed_pos, seed_faces = place_seeds(normal, u_axis, v_axis)
    curve = stem_curve(bend, side)
    if chord_deviation(curve) < 0.08:
        raise RuntimeError("half stem is too straight")
    # Keep the stalk on the fruit side of the cut.
    stem_side = float(np.max(curve @ normal))
    if stem_side > -0.01:
        raise RuntimeError(f"stem crosses the cut (max {stem_side:.3f})")
    stem_pos, stem_faces = tube_mesh(curve, 0.040, 0.016, STEM_SIDES)
    leaf_pos, leaf_faces = leaf_mesh(curve, bend, side)
    parts = {
        "skin": prepare(clipped_pos, clipped_faces),
        "flesh": prepare(disc_pos, disc_faces),
        "core": prepare(core_pos, core_faces),
        "seeds": prepare(seed_pos, seed_faces),
        "stem": prepare(stem_pos, stem_faces),
        "leaf": prepare(leaf_pos, leaf_faces),
    }
    glb = Glb()
    materials = {
        "skin": glb.add_material("green", 0x67C514, 0.42),
        "flesh": glb.add_material("brownLight", 0xF6E0B8, 0.62),
        "core": glb.add_material("core", 0xA56B3C, 0.55),
        "seeds": glb.add_material("brownDark", 0x6B3A22, 0.50),
        "stem": glb.add_material("brown", 0x7A4E28, 0.64),
        "leaf": glb.add_material("DarkGreen", 0x2F861F, 0.52),
    }
    for name in ("skin", "flesh", "core", "seeds", "stem", "leaf"):
        pos, nrm, faces = parts[name]
        glb.add_mesh(name[:1].upper() + name[1:], pos, nrm, faces, materials[name])
    counts = {name: part_count(parts[name][2]) for name in parts}
    counts["total"] = sum(counts.values())
    counts["seeds_groups"] = 5
    counts["cut_normal"] = [float(v) for v in normal]
    return glb.pack("AppleHalf"), counts


def require_range(label, count):
    if not (20000 <= count <= 60000):
        raise RuntimeError(f"{label} triangle count {count} outside 20k–60k")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    raw_pos, raw_faces = apple_surface(PHI_SEG, THETA_SEG)
    skin_pos, skin_faces = weld(raw_pos, raw_faces)
    skin_normals = smooth_normals(skin_pos, skin_faces)
    shape = assert_organic(skin_pos, skin_normals)

    toward = camera_horizontal()
    side = normalize(np.cross(np.array([0.0, 1.0, 0.0]), toward))
    whole_blob, whole_counts, _curve = build_whole(skin_pos, skin_faces, bend=toward * 0.15 + side, side=side)
    # Half keeps the body behind the cut and leans the stem onto that half.
    half_blob, half_counts = build_half(
        skin_pos, skin_faces, bend=-toward, side=side, cut_normal=toward,
    )
    require_range("whole", whole_counts["total"])
    require_range("half", half_counts["total"])

    whole_path = OUT_DIR / "apple_whole_real.glb"
    half_path = OUT_DIR / "apple_half_real.glb"
    whole_path.write_bytes(whole_blob)
    half_path.write_bytes(half_blob)
    report = {
        "shape": shape,
        "whole": whole_counts,
        "whole_bytes": whole_path.stat().st_size,
        "half": half_counts,
        "half_bytes": half_path.stat().st_size,
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
