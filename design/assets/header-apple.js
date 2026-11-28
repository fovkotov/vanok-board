import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export function cloneMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
  });
}

export function fitTopDown(model) {
  const pivot = new THREE.Group();
  pivot.add(model);
  pivot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pivot);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const diam = Math.max(size.x, size.z, 1e-6);
  pivot.scale.setScalar(1 / diam);
  pivot.position.copy(center).multiplyScalar(-1 / diam);
  return pivot;
}

function weldSmoothGeometry(geometry) {
  const source = geometry.clone();
  for (const name of ['normal', 'uv', 'uv1', 'uv2', 'uv3', 'tangent', 'color']) source.deleteAttribute(name);
  const merged = BufferGeometryUtils.mergeVertices(source, 1e-4);
  source.dispose();
  merged.computeVertexNormals();
  return merged;
}

export function applyShadeSmooth(root, smooth) {
  if (!root) return;
  root.traverse((node) => {
    if (!node.isMesh || !node.geometry) return;
    if (!node.userData.flatGeometry) {
      node.userData.flatGeometry = node.geometry;
      node.userData.smoothGeometry = weldSmoothGeometry(node.geometry);
    }
    node.geometry = smooth ? node.userData.smoothGeometry : node.userData.flatGeometry;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of mats) {
      if (!material) continue;
      material.flatShading = !smooth;
      material.needsUpdate = true;
    }
  });
}

const HEADER_APPLE_FILE = 'design/stub/models/apple-corner.glb';
const HEADER_APPLE_GREEN = 0x56ae08;
const HEADER_STEM = 0x8b5a2b;

function prepareHeaderApple(gltf) {
  const model = gltf.scene.clone(true);
  cloneMaterials(model);
  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    if (mats.some((material) => material && /green_apple_2_texture/i.test(material.name || ''))) {
      node.userData.appleStem = true;
    }
  });
  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const prev = Array.isArray(node.material) ? node.material : [node.material];
    if (node.userData.appleStem) {
      const next = prev.map((material) => {
        if (!material) return material;
        const stem = material.clone();
        stem.name = 'stem';
        stem.color.setHex(HEADER_STEM);
        if (stem.emissive) {
          stem.emissive.setHex(0x000000);
          stem.emissiveIntensity = 0;
        }
        stem.map = stem.envMap = stem.normalMap = stem.roughnessMap = stem.metalnessMap = stem.aoMap = stem.emissiveMap = null;
        return stem;
      });
      node.material = Array.isArray(node.material) ? next : next[0];
      for (const old of prev) {
        if (old && !next.includes(old)) old.dispose();
      }
      return;
    }
    let side = THREE.FrontSide;
    for (const material of prev) {
      if (material && material.side === THREE.DoubleSide) side = THREE.DoubleSide;
    }
    const material = new THREE.MeshStandardMaterial({
      name: 'plane',
      color: HEADER_APPLE_GREEN,
      metalness: 0,
      roughness: 0.55,
      emissive: 0x000000,
      emissiveIntensity: 0,
      envMapIntensity: 0,
      side,
      flatShading: false,
    });
    node.material = material;
    for (const old of prev) {
      if (old && old !== material) old.dispose();
    }
  });
  applyShadeSmooth(model, true);
  return fitTopDown(model);
}

export function mountHeaderApple(getIntroScrollProgress) {
  const pose = {
    xPx: 1513,
    topPx: 5,
    rotX: 69.7,
    rotY: -172.9,
    rotZ: -33.2,
    size: 1.54,
    azimuth: -90,
    elevation: 52,
    distance: 6.5422,
    intensity: 4.45,
    ambient: 0.72,
    shadowDark: 0.09,
    shadowRadius: 11,
  };
  const TURN_Y = -11;
  const TURN_SCALE = 1.248;
  const GROUND = -0.7;
  const isMobile = () => document.body.dataset.layout === 'mobile';
  const mobileUnit = () => Math.min(innerWidth / 375, innerHeight / 560);
  const headerHeight = () => 306 * (isMobile() ? mobileUnit() : innerWidth / 1440);
  function restingPosition() {
    if (isMobile()) {
      const unit = mobileUnit();
      return { x: innerWidth * .5 + 40 * unit, y: innerHeight * .5 - 84 * unit, unit };
    }
    const unit = innerWidth / 1440;
    return { x: innerWidth * (794 / 1440), y: innerHeight * .5 - 43 * unit, unit };
  }
  function applyAppleLayout() {
    const rest = restingPosition();
    pose.xPx = rest.x;
    pose.topPx = rest.y - (rest.y + 50 * rest.unit) * getIntroScrollProgress();
    pose.size = isMobile() ? 2.05 * .7 : 2.35;
  }

  const host = document.createElement('div');
  host.className = 'apple-view header-apple';
  host.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile() ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.pointerEvents = 'none';
  host.appendChild(renderer.domElement);
  document.body.appendChild(host);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 40);
  camera.position.set(0, 8, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0;
  const fill = new THREE.AmbientLight(0xffffff, pose.ambient);
  scene.add(fill);
  const key = new THREE.DirectionalLight(0xfff7f2, pose.intensity);
  key.castShadow = true;
  const shadowSizePx = isMobile() ? 768 : 2048;
  key.shadow.mapSize.set(shadowSizePx, shadowSizePx);
  key.shadow.bias = -0.00015;
  key.shadow.normalBias = 0.004;
  key.shadow.radius = pose.shadowRadius;
  scene.add(key, key.target);
  const groundMat = new THREE.ShadowMaterial({ color: 0x000000, opacity: pose.shadowDark });
  groundMat.depthWrite = false;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.renderOrder = 1;
  scene.add(ground);

  const tilt = new THREE.Group();
  tilt.rotation.order = 'XYZ';
  scene.add(tilt);
  const turn = new THREE.Group();
  turn.name = 'apple-turn';
  turn.rotation.order = 'XYZ';
  turn.rotation.y = TURN_Y * Math.PI / 180;
  turn.scale.setScalar(TURN_SCALE);
  tilt.add(turn);

  let alive = true;
  let appleModel = null;
  const shadowBox = new THREE.Box3();
  const shadowSize = new THREE.Vector3();
  const shadowCenter = new THREE.Vector3();
  const lightDir = new THREE.Vector3();
  const gaze = { x: 0, y: 0, sx: 0, sy: 0 };
  const gazeBase = new THREE.Quaternion();
  const gazeEuler = new THREE.Euler(0, 0, 0, 'XYZ');
  const gazePitch = new THREE.Quaternion();
  const gazeYaw = new THREE.Quaternion();
  const rollQuat = new THREE.Quaternion();
  const rollAxis = new THREE.Vector3();
  const axisX = new THREE.Vector3(1, 0, 0);
  const axisUp = new THREE.Vector3(0, 0, -1);
  const GAZE = 8 * Math.PI / 180;
  const DRAG_LIMIT = 18 * Math.PI / 180;
  const DRAG_PX = 120;
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const drag = { active: false, pointerId: -1, x0: 0, y0: 0, yaw0: 0, pitch0: 0, yaw: 0, pitch: 0 };
  let dragClock = performance.now();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const APPLE_ENTER_MS = 2200;
  const easeAppleEntry = cubicBezierEase(.22, .18, .32, 1);
  const APPLE_ROLL_MS = 6200;
  const APPLE_ROLL_STEPS = 480;
  let appleEnter = null;
  let appleRoll = null;
  let repeatRoll = false;

  function cubicBezierEase(x1, y1, x2, y2) {
    const calc = (t, a1, a2) => t * (3 * (1 - t) * ((1 - t) * a1 + t * a2) + t * t);
    return (x) => {
      let lower = 0;
      let upper = 1;
      let t = x;
      for (let i = 0; ; i++) {
        if (!(t >= lower && t <= upper)) t = (lower + upper) / 2;
        const currentX = calc(t, x1, x2) - x;
        if (currentX * currentX < 1e-28 || i === 40) break;
        if (currentX > 0) upper = t;
        else lower = t;
        t -= (currentX * 1e-7) / (calc(t + 1e-7, x1, x2) - x - currentX);
      }
      return calc(t, y1, y2);
    };
  }
  const easeSlow = cubicBezierEase(0.16, 1, 0.3, 1);
  const easeMobileRoll = cubicBezierEase(.18, .24, .42, 1);
  function appleEnterEase() {
    if (reduced || !appleEnter) return appleEnter ? 1 : 0;
    return easeAppleEntry(Math.min(1, Math.max(0, (performance.now() - appleEnter.start) / APPLE_ENTER_MS)));
  }
  function appleOffscreen() {
    const restingY = restingPosition().y;
    return -restingY - appleScreenRadius() * 1.4;
  }
  function appleEntryPosition(progress = appleEnterEase()) {
    const remaining = reduced ? 0 : 1 - progress;
    const arcWidth = Math.min(innerWidth * .32, innerHeight * .5);
    return {
      x: -arcWidth * remaining * (.38 + .62 * (1 - remaining)),
      y: appleOffscreen() * remaining,
    };
  }
  function appleEnterRot() {
    return { x: pose.rotX, y: pose.rotY, z: pose.rotZ };
  }
  function appleScreenRadius() {
    const h = Math.max(innerHeight, 2);
    const headerH = headerHeight();
    const viewH = 2.4 * (h / Math.max(headerH, 1));
    const poseSize = pose.size;
    return Math.max(12, 0.39 * poseSize * (h / viewH));
  }
  function appleRollMargin() {
    const h = Math.max(innerHeight, 2);
    const headerH = headerHeight();
    const viewH = 2.4 * (h / Math.max(headerH, 1));
    const px = h / Math.max(viewH, 1e-6);
    if (!shadowBox.isEmpty() && Number.isFinite(shadowBox.max.x) && Number.isFinite(shadowBox.max.z)) {
      const half = 0.5 * Math.max(
        shadowBox.max.x - shadowBox.min.x,
        shadowBox.max.z - shadowBox.min.z,
      ) * px;
      if (half > 8) return half;
    }
    return appleScreenRadius() * TURN_SCALE;
  }
  function appleRollSpec() {
    const h = Math.max(innerHeight, 1);
    return { radius: h * 0.21, theta0: -160 * Math.PI / 180, dir: -1 };
  }
  function appleRollEaseInverse(u) {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) * 0.5;
      if (easeSlow(mid) < u) lo = mid;
      else hi = mid;
    }
    return (lo + hi) * 0.5;
  }
  function appleRollClock(spec) {
    const steps = APPLE_ROLL_STEPS;
    const times = new Float64Array(steps + 1);
    const easeAt = new Float64Array(steps + 1);
    const layout = {
      ox: pose.xPx,
      oy: pose.topPx + appleEntryPosition().y,
      w: Math.max(innerWidth, 1),
      h: Math.max(innerHeight, 1),
      margin: appleRollMargin(),
      c0: Math.cos(spec.theta0),
      s0: Math.sin(spec.theta0),
    };
    for (let i = 0; i < steps; i++) {
      const u1 = (i + 1) / steps;
      const ease = i + 1 === steps ? 1 : appleRollEaseInverse(u1);
      const theta = spec.theta0 + spec.dir * Math.PI * 2 * ((i + 0.5) / steps);
      const x = layout.ox + spec.radius * (Math.cos(theta) - layout.c0);
      const y = layout.oy + spec.radius * (Math.sin(theta) - layout.s0);
      const off = x < -layout.margin || y < -layout.margin || x > layout.w + layout.margin || y > layout.h + layout.margin;
      const dtOld = Math.max(0, (ease - easeAt[i]) * APPLE_ROLL_MS);
      times[i + 1] = times[i] + dtOld / (off ? 2 : 1);
      easeAt[i + 1] = ease;
    }
    return { times, easeAt, steps, duration: times[steps] };
  }
  function appleRolling() {
    return !!(appleRoll && (performance.now() - appleRoll.start) < appleRoll.clock.duration);
  }
  function appleRollParam(clock, elapsed) {
    if (elapsed <= 0) return 0;
    if (elapsed >= clock.duration) return 1;
    let lo = 1;
    let hi = clock.steps;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (clock.times[mid] < elapsed) lo = mid + 1;
      else hi = mid;
    }
    const t0 = clock.times[lo - 1];
    const t1 = clock.times[lo];
    const f = t1 > t0 ? (elapsed - t0) / (t1 - t0) : 0;
    const ease = clock.easeAt[lo - 1] + (clock.easeAt[lo] - clock.easeAt[lo - 1]) * f;
    return easeSlow(Math.min(1, Math.max(0, ease)));
  }
  function appleRollSample() {
    if (!appleRoll) return null;
    const elapsed = performance.now() - appleRoll.start;
    if (appleRoll.sample) {
      const progress = elapsed / appleRoll.clock.duration;
      return progress < 1 ? appleRoll.sample(easeMobileRoll(Math.max(0, progress))) : null;
    }
    const u = appleRollParam(appleRoll.clock, elapsed);
    if (!(u > 0) || u >= 1) return null;
    const spec = appleRoll.spec;
    const theta = spec.theta0 + spec.dir * Math.PI * 2 * u;
    const turns = Math.max(1, Math.round(spec.radius / appleScreenRadius()));
    return {
      dx: spec.radius * (Math.cos(theta) - Math.cos(spec.theta0)),
      dy: spec.radius * (Math.sin(theta) - Math.sin(spec.theta0)),
      tx: spec.dir * -Math.sin(theta),
      ty: spec.dir * Math.cos(theta),
      angle: Math.PI * 2 * turns * u,
    };
  }
  function startAppleRoll() {
    const spec = appleRollSpec();
    appleRoll = { start: performance.now(), spec, clock: appleRollClock(spec) };
  }
  function startMobileRoll() {
    const unit = mobileUnit();
    const point = (x, y) => new THREE.Vector2(x * unit, y * unit);
    const path = new THREE.CurvePath();
    // Roll out of view to the right, loop above the resting spot, then descend.
    path.add(new THREE.CubicBezierCurve(point(0, 0), point(76, 58), point(179, 98), point(254, 31)));
    path.add(new THREE.CubicBezierCurve(point(254, 31), point(298, -8), point(294, -70), point(294, -106)));
    path.add(new THREE.CubicBezierCurve(point(294, -106), point(294, -175), point(185, -216), point(91, -215)));
    path.add(new THREE.CubicBezierCurve(point(91, -215), point(-12, -214), point(0, -83), point(0, 0)));

    const steps = 96;
    const radius = appleScreenRadius();
    const offscreenX = innerWidth + appleRollMargin() - pose.xPx;
    const times = [0];
    const orientations = [new THREE.Quaternion()];
    const orientation = new THREE.Quaternion();
    let previous = path.getPoint(0);
    for (let i = 1; i <= steps; i++) {
      const next = path.getPoint(i / steps);
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const distance = Math.hypot(dx, dy);
      if (distance) {
        rollAxis.set(dy / distance, 0, -dx / distance);
        rollQuat.setFromAxisAngle(rollAxis, distance / radius);
        orientation.premultiply(rollQuat).normalize();
      }
      // Spend less of the loop completely out of view.
      const visible = (next.x + previous.x) / 2 <= offscreenX;
      times.push(times[i - 1] + (visible ? 1 : .38));
      orientations.push(orientation.clone());
      previous = next;
    }
    const at = new THREE.Vector2();
    const tilt = new THREE.Quaternion();
    const restingTilt = new THREE.Quaternion();
    appleRoll = {
      start: performance.now(),
      clock: {duration: 2350},
      sample(progress) {
        const time = progress * times[steps];
        const index = Math.max(0, times.findIndex(t => t >= time) - 1);
        const fraction = (time - times[index]) / (times[index + 1] - times[index]);
        const position = (index + fraction) / steps;
        path.getPoint(position, at);
        tilt.slerpQuaternions(orientations[index], orientations[index + 1], fraction);
        const landing = Math.max(0, (position - .86) / .14);
        tilt.slerp(restingTilt, landing * landing * (3 - 2 * landing));
        return {dx: at.x, dy: at.y, orientation: tilt};
      },
    };
  }
  function requestAppleRoll() {
    if (reduced) return;
    if (appleRolling()) {
      repeatRoll = true;
      return;
    }
    repeatRoll = false;
    if (isMobile()) startMobileRoll();
    else startAppleRoll();
  }
  function clampDrag(angle) {
    return Math.max(-DRAG_LIMIT, Math.min(DRAG_LIMIT, angle));
  }
  function followPointer(entryProgress, roll) {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - dragClock) / 1000));
    dragClock = now;
    if (!drag.active) {
      const k = 1 - Math.exp(-dt * 8);
      drag.yaw += -drag.yaw * k;
      drag.pitch += -drag.pitch * k;
    }
    const gazeBlend = 1 - Math.exp(-dt * 2.5);
    gaze.sx += (gaze.x - gaze.sx) * gazeBlend;
    gaze.sy += (gaze.y - gaze.sy) * gazeBlend;
    const enterRot = appleEnterRot();
    gazeEuler.set(enterRot.x * Math.PI / 180, enterRot.y * Math.PI / 180, enterRot.z * Math.PI / 180);
    gazeBase.setFromEuler(gazeEuler);
    const radius = appleScreenRadius();
    // Work backwards from the resting pose, rolling along each segment of the arc.
    let point = appleEntryPosition(1);
    for (let segment = 1; segment <= 16 && entryProgress < 1 && !reduced; segment++) {
      const previous = appleEntryPosition(1 - (1 - entryProgress) * segment / 16);
      const dx = previous.x - point.x;
      const dy = previous.y - point.y;
      const distance = Math.hypot(dx, dy);
      if (distance) {
        rollAxis.set(dy / distance, 0, -dx / distance);
        rollQuat.setFromAxisAngle(rollAxis, distance / radius);
        gazeBase.premultiply(rollQuat);
      }
      point = previous;
    }
    const scrollDistance = getIntroScrollProgress() * (innerHeight * .5 + 7 * restingPosition().unit);
    rollQuat.setFromAxisAngle(axisX, -scrollDistance / radius);
    gazeBase.premultiply(rollQuat);
    if (roll?.orientation) {
      gazeBase.premultiply(roll.orientation);
    } else if (roll) {
      const len = Math.hypot(roll.tx, roll.ty) || 1;
      rollAxis.set(roll.ty / len, 0, -roll.tx / len);
      rollQuat.setFromAxisAngle(rollAxis, roll.angle);
      gazeBase.premultiply(rollQuat);
    }
    gazePitch.setFromAxisAngle(axisX, gaze.sy * GAZE + drag.pitch);
    gazeYaw.setFromAxisAngle(axisUp, gaze.sx * GAZE + drag.yaw);
    gazeYaw.multiply(gazePitch);
    tilt.quaternion.copy(gazeYaw).multiply(gazeBase);
    tilt.updateMatrixWorld(true);
    shadowBox.setFromObject(tilt);
    if (!shadowBox.isEmpty() && Number.isFinite(shadowBox.min.y)) {
      tilt.position.y += GROUND - shadowBox.min.y;
    }
  }
  let appleFrameDirty = true;
  function placeApple() {
    if (!alive) return;
    appleFrameDirty = true;
    applyAppleLayout();
    const w = Math.max(innerWidth, 2);
    const h = Math.max(innerHeight, 2);
    const headerH = headerHeight();
    const viewH = 2.4 * (h / headerH);
    const viewW = viewH * (w / h);
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.left = -viewW / 2;
    camera.right = viewW / 2;
    camera.updateProjectionMatrix();
    if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio()) ||
        renderer.domElement.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
    }
    const poseSize = pose.size;
    if (appleModel) appleModel.scale.setScalar(0.78 * poseSize);
    const roll = appleRollSample();
    const entryProgress = appleEnterEase();
    const entry = appleEntryPosition(entryProgress);
    const enterY = entry.y + (roll ? roll.dy : 0);
    const enterX = entry.x + (roll ? roll.dx : 0);
    tilt.position.set(
      ((pose.xPx + enterX) / w) * viewW - viewW / 2,
      0,
      ((pose.topPx + enterY) / h) * viewH - viewH / 2,
    );
    followPointer(entryProgress, roll);
    tilt.updateMatrixWorld(true);
    shadowBox.setFromObject(tilt);
    const az = pose.azimuth * Math.PI / 180;
    const el = Math.max(pose.elevation * Math.PI / 180, 0.087);
    let reach = 1.4;
    let focusX = tilt.position.x;
    let focusZ = tilt.position.z;
    if (!shadowBox.isEmpty() && Number.isFinite(shadowBox.min.y)) {
      tilt.position.y = -shadowBox.min.y + GROUND;
      tilt.updateMatrixWorld(true);
      shadowBox.setFromObject(tilt);
      shadowBox.getSize(shadowSize);
      shadowBox.getCenter(shadowCenter);
      reach = Math.min(8, (shadowSize.y + 0.04) / Math.tan(el));
      focusX = shadowCenter.x - Math.sin(az) * reach * 0.5;
      focusZ = shadowCenter.z - Math.cos(az) * reach * 0.5;
      const extent = Math.max(shadowSize.x, shadowSize.z) * 0.9 + reach * 0.7 + 0.45;
      const cam = key.shadow.camera;
      cam.left = -extent;
      cam.right = extent;
      cam.top = extent;
      cam.bottom = -extent;
      cam.near = 0.15;
      cam.far = pose.distance + reach + shadowSize.y + 6;
      cam.updateProjectionMatrix();
    }
    lightDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    key.target.position.set(focusX, 0.02, focusZ);
    key.position.copy(key.target.position).addScaledVector(lightDir, pose.distance);
    key.intensity = pose.intensity;
    fill.intensity = pose.ambient;
    key.shadow.radius = pose.shadowRadius;
    groundMat.opacity = Math.min(1, pose.shadowDark * (pose.intensity / 2.5));
    key.target.updateMatrixWorld();
    ground.position.set(0, 0, 0);
    ground.scale.set(viewW * 1.4, viewH * 1.4, 1);
  }

  function hitsApple(event) {
    if (!appleModel || !host.classList.contains('apple-shown')) return false;
    const w = Math.max(innerWidth, 1);
    const h = Math.max(innerHeight, 1);
    pointerNdc.x = (event.clientX / w) * 2 - 1;
    pointerNdc.y = -((event.clientY / h) * 2 - 1);
    raycaster.setFromCamera(pointerNdc, camera);
    tilt.updateMatrixWorld(true);
    return raycaster.intersectObject(appleModel, true).length > 0;
  }
  function uiOwnsPointer(event) {
    const el = event.target;
    return !!(el && el.closest && el.closest('.crosshair, .stamp-panel, .sig-modal, .catalog-entry, .ig-link, .site-credits, .soon, .case-cover-caption, [data-preview], [data-preview-group], a, button, input, select, textarea, label'));
  }
  function onPointerMove(event) {
    if (isMobile()) return;
    const w = Math.max(innerWidth, 1);
    const h = Math.max(innerHeight, 1);
    gaze.x = (event.clientX / w) * 2 - 1;
    gaze.y = (event.clientY / h) * 2 - 1;
    document.body.classList.toggle('apple-hover', !uiOwnsPointer(event) && hitsApple(event));
  }
  function onPointerLeave() {
    document.body.classList.remove('apple-hover');
    gaze.x = 0;
    gaze.y = 0;
  }
  function onApplePointerDown(event) {
    if (!alive || drag.active || event.button !== 0 || isMobile()) return;
    if (uiOwnsPointer(event) || !hitsApple(event)) return;
    requestAppleRoll();
    drag.active = true;
    drag.pointerId = event.pointerId;
    drag.x0 = event.clientX;
    drag.y0 = event.clientY;
    drag.yaw0 = drag.yaw;
    drag.pitch0 = drag.pitch;
    if (event.cancelable) event.preventDefault();
  }
  function onApplePointerMove(event) {
    if (!drag.active || event.pointerId !== drag.pointerId) return;
    if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) {
      drag.active = false;
      return;
    }
    drag.yaw = clampDrag(drag.yaw0 + ((event.clientX - drag.x0) / DRAG_PX) * DRAG_LIMIT);
    drag.pitch = clampDrag(drag.pitch0 + ((event.clientY - drag.y0) / DRAG_PX) * DRAG_LIMIT);
  }
  function onApplePointerUp(event) {
    if (!drag.active || event.pointerId !== drag.pointerId) return;
    drag.active = false;
  }
  addEventListener('click', event => {
    if (isMobile() && !uiOwnsPointer(event) && hitsApple(event)) requestAppleRoll();
  });
  addEventListener('pointermove', onPointerMove);
  addEventListener('pointerleave', onPointerLeave);
  addEventListener('pointerdown', onApplePointerDown, { capture: true });
  addEventListener('pointermove', onApplePointerMove);
  addEventListener('pointerup', onApplePointerUp);
  addEventListener('pointercancel', onApplePointerUp);
  addEventListener('resize', () => {
    if (isMobile()) {
      appleRoll = null;
      repeatRoll = false;
      drag.active = false;
      drag.yaw = drag.pitch = 0;
      onPointerLeave();
      gaze.sx = gaze.sy = 0;
    }
    placeApple();
  });

  new GLTFLoader().load(HEADER_APPLE_FILE, (gltf) => {
    if (!alive) return;
    const fitted = prepareHeaderApple(gltf);
    fitted.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = false;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of mats) if (material) material.shadowSide = THREE.DoubleSide;
    });
    appleModel = new THREE.Group();
    appleModel.add(fitted);
    turn.add(appleModel);
    appleEnter = reduced ? { start: performance.now() - APPLE_ENTER_MS } : { start: performance.now() };
    host.classList.add('apple-shown');
    placeApple();
  });

  applyAppleLayout();
  placeApple();
  let lastIntroProgress = -1;
  let wasFlying = false;
  renderer.setAnimationLoop(() => {
    if (!alive || document.hidden) return;
    const flying = appleEnter && performance.now() - appleEnter.start < APPLE_ENTER_MS;
    const progress = getIntroScrollProgress();
    const introChanged = progress !== lastIntroProgress;
    lastIntroProgress = progress;
    if (progress > 1.5 && !introChanged) return;
    if (repeatRoll && !appleRolling()) requestAppleRoll();
    const landed = wasFlying && !flying;
    wasFlying = flying;
    if (introChanged || !appleModel || flying || landed || appleRolling() || drag.active || Math.abs(drag.yaw) > 0.0004 || Math.abs(drag.pitch) > 0.0004 || Math.abs(gaze.x - gaze.sx) > 0.002 || Math.abs(gaze.y - gaze.sy) > 0.002) {
      placeApple();
    } else if (appleRoll && !appleRolling()) {
      appleRoll = null;
      placeApple();
    }
    if (appleFrameDirty) {
      renderer.render(scene, camera);
      appleFrameDirty = false;
    }
  });
}
