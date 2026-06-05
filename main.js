const NAME = 'haris saif';

document.getElementById('nametext').textContent = NAME.toLowerCase();

let isDarkMode = true;

function getThemeColors() {
    return {
        bg: isDarkMode ? 0x030305 : 0xffffff,
        fg: isDarkMode ? '#ffffff' : '#000000',
        cssBg: isDarkMode ? '#030305' : '#ffffff'
    };
}
let colors = getThemeColors();

function applyCssTheme() {
    document.body.style.setProperty('--fg', colors.fg);
    document.body.style.setProperty('--bg', colors.cssBg);
}
applyCssTheme();

const scene = new THREE.Scene();
scene.background = new THREE.Color(colors.bg);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const CAMERA_RADIUS = 12;

// Start the camera far away and slightly offset on the X/Y axes 
// to create a subtle panning depth effect on load
camera.position.set(4, 3, 50);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const charSet = 'abcdefghijklmnopqrstuvwxyz0123456789.,-~:;=';
const starCharSet = '.,-~:;=*+';

const starSizes = {
    '.': 0.08, ',': 0.08, ':': 0.10, ';': 0.10,
    '-': 0.12, '~': 0.12, '=': 0.13,
    '+': 0.16, '*': 0.18
};

function createCharTexture(char, textColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 24px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.fillText(char, 16, 16);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
}

const smoothstep = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
};

function buildBrightnessRamp(chars) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 24px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ink = {};
    for (const ch of chars) {
        ctx.clearRect(0, 0, 32, 32);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(ch, 16, 16);
        const px = ctx.getImageData(0, 0, 32, 32).data;
        let sum = 0;
        for (let p = 3; p < px.length; p += 4) sum += px[p];
        ink[ch] = sum;
    }
    return chars.split('').sort((a, b) => ink[a] - ink[b]);
}
const ringRamp = buildBrightnessRamp(charSet);

const materials = {};
for (let i = 0; i < charSet.length; i++) {
    const char = charSet[i];
    materials[char] = new THREE.PointsMaterial({
        size: 0.12, map: createCharTexture(char, colors.fg),
        alphaTest: 0.5
    });
}

const starMaterials = {};
for (let i = 0; i < starCharSet.length; i++) {
    const char = starCharSet[i];
    starMaterials[char] = new THREE.PointsMaterial({
        size: starSizes[char] || 0.10,
        map: createCharTexture(char, colors.fg),
        alphaTest: 0.5
    });
}

function createAsciiSphere(pointsCount, radius) {
    const sphereData = {};
    for (let i = 0; i < charSet.length; i++) sphereData[charSet[i]] = [];

    for (let i = 0; i < pointsCount; i++) {
        const y = 1 - (i / (pointsCount - 1)) * 2;
        const radiusAtY = Math.sqrt(1 - y * y);
        const theta = 2.399963229728653 * i;
        const x = Math.cos(theta) * radiusAtY * radius;
        const z = Math.sin(theta) * radiusAtY * radius;
        const randomChar = charSet[Math.floor(Math.random() * charSet.length)];
        sphereData[randomChar].push(x, y * radius, z);
    }

    const sphereGroup = new THREE.Group();
    for (let i = 0; i < charSet.length; i++) {
        const char = charSet[i];
        if (sphereData[char].length > 0) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(sphereData[char], 3));
            sphereGroup.add(new THREE.Points(geo, materials[char]));
        }
    }
    return sphereGroup;
}

// Disk eccentricity. 1.0 = a circular disk whose on-screen oval comes purely
// from the system tilt; drop below 1 to additionally squash the disk in z.
const ELLIPSE_FACTOR = 1.0;

// --- Spiral arm geometry (shared by the dust field and the typography) ---
const numArms = 2;
const armTightness = 3.4;
const DUST_INNER = 1.5;
const DUST_OUTER = 6.2;
const armSpan = DUST_OUTER - DUST_INNER;

// Arm centerline as a function of radius. Uses the same winding the dust
// density peaks on, so text laid on this curve sits directly on an arm.
function armPoint(r, armIndex) {
    const u = (r - DUST_INNER) / armSpan;
    const theta = u * armTightness * Math.PI + armIndex * (2 * Math.PI / numArms);
    return { x: Math.cos(theta) * r, z: Math.sin(theta) * r * ELLIPSE_FACTOR };
}

// Central Core
const ringSpin = new THREE.Group();
const RING_SPIN = 0.14;

// Supermassive black hole with a live, gravity-driven accretion disk that
// drains the whole galaxy. A large dark event-horizon shadow is ringed by a
// bright photon ring and fed by ASCII matter under Newtonian free-fall: every
// particle glides inward from anywhere across the galactic disk, whirls ever
// faster (angular momentum) and heats up (brighter glyph) as gravity hauls it
// in, then vanishes at the horizon and is re-fed from the rim — so the entire
// galaxy is forever spiralling into the core.
const EVENT_HORIZON = 0.85;  // matter vanishes inside this radius (the shadow)
const DISK_INNER = 1.0;      // hot, bright inner rim of the disk
const SPAWN_OUTER = 6.0;     // matter is vacuumed in from across the whole galaxy
const DISK_SPAN = SPAWN_OUTER - DISK_INNER;
const DISK_COUNT = 5000;
const GM = 2.2;              // gravitational pull — raise to suck harder/faster
const ANG_MOMENTUM = 0.65;   // higher = more spiral winding before the plunge
const INFLOW = 0.2;          // baseline inward glide so the whole disk drains visibly

// Per-particle state (polar position, radial velocity, angular momentum).
const diskR = new Float32Array(DISK_COUNT);
const diskVr = new Float32Array(DISK_COUNT);
const diskTheta = new Float32Array(DISK_COUNT);
const diskL = new Float32Array(DISK_COUNT);
const diskYSeed = new Float32Array(DISK_COUNT);
const diskNoise = new Float32Array(DISK_COUNT);

function spawnDiskParticle(i, atEdge) {
    // Launch radius spread across the whole galactic disk, biased inward for a
    // dense, bright core with matter reaching all the way out to the rim.
    const ra = DISK_INNER + Math.pow(Math.random(), 1.2) * DISK_SPAN;
    const L = ANG_MOMENTUM * Math.sqrt(GM * ra);
    diskL[i] = L;
    diskTheta[i] = Math.random() * Math.PI * 2;
    diskYSeed[i] = Math.random() + Math.random() - 1.0; // triangular, ~[-1, 1]
    diskNoise[i] = (Math.random() - 0.5) * 0.2;

    if (atEdge) {
        // Fresh matter enters at its launch radius already gliding inward.
        diskR[i] = ra;
        diskVr[i] = -INFLOW;
    } else {
        // Initial fill: seed along the infall path so the disk is full at once.
        const E = 0.5 * L * L / (ra * ra) - GM / ra;
        const r = EVENT_HORIZON + Math.random() * (ra - EVENT_HORIZON);
        diskR[i] = r;
        diskVr[i] = -INFLOW - Math.sqrt(Math.max(0, 2 * (E + GM / r) - (L * L) / (r * r)));
    }
}
for (let i = 0; i < DISK_COUNT; i++) spawnDiskParticle(i, false);

// One preallocated position buffer per glyph. Each frame the live particles
// are sorted into these by brightness, and only the used range is uploaded.
const charIndex = {};
for (let i = 0; i < charSet.length; i++) charIndex[charSet[i]] = i;
const rampBucket = ringRamp.map((c) => charIndex[c]);
const RAMP_MAX = ringRamp.length - 1;

const diskBuffers = [];
const diskGeometries = [];
const diskGroup = new THREE.Group();
for (let i = 0; i < charSet.length; i++) {
    const arr = new Float32Array(DISK_COUNT * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.setDrawRange(0, 0);
    diskBuffers.push(arr);
    diskGeometries.push(geo);
    diskGroup.add(new THREE.Points(geo, materials[charSet[i]]));
}
ringSpin.add(diskGroup);

const diskCounts = new Int32Array(charSet.length);

function updateAccretionDisk(dt) {
    diskCounts.fill(0);

    for (let i = 0; i < DISK_COUNT; i++) {
        let r = diskR[i];

        // Newtonian free-fall: gravity accelerates matter inward while angular
        // momentum makes it whirl ever faster — slow at the rim, a violent
        // plunge at the horizon.
        const vr = diskVr[i] - (GM / (r * r)) * dt;
        r += vr * dt;
        const theta = diskTheta[i] - (diskL[i] / (r * r)) * dt;

        if (r <= EVENT_HORIZON) {
            spawnDiskParticle(i, true); // consumed — re-fed from the rim
            continue;
        }
        diskR[i] = r;
        diskVr[i] = vr;
        diskTheta[i] = theta;

        const u = Math.max(0, Math.min(1, (r - DISK_INNER) / DISK_SPAN));
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r * ELLIPSE_FACTOR;

        // Thin galactic disk, a touch puffier toward the rim — matter draining
        // across the whole plane, settling thinner as it nears the hole.
        const thickness = 0.05 + 0.10 * u;
        const y = diskYSeed[i] * thickness;

        // Hottest at the inner rim, fading out across the disk, with one side
        // Doppler-beamed brighter.
        const beaming = 0.6 + 0.4 * Math.cos(theta);
        let b = Math.pow(1 - u, 0.7) * beaming + diskNoise[i];
        b = Math.max(0, Math.min(1, b));

        const bucket = rampBucket[Math.floor(b * RAMP_MAX)];
        const n = diskCounts[bucket]++;
        const arr = diskBuffers[bucket];
        arr[n * 3] = x;
        arr[n * 3 + 1] = y;
        arr[n * 3 + 2] = z;
    }

    for (let i = 0; i < charSet.length; i++) {
        const used = diskCounts[i];
        const pos = diskGeometries[i].attributes.position;
        pos.updateRange.offset = 0;
        pos.updateRange.count = used * 3;
        if (used > 0) pos.needsUpdate = true;
        diskGeometries[i].setDrawRange(0, used);
    }
}
updateAccretionDisk(0);

// Photon ring: a thin, bright, persistent ring hugging the shadow's edge —
// the black hole's defining silhouette, steady beneath the churning disk.
function createPhotonRing(count) {
    const data = {};
    for (let i = 0; i < charSet.length; i++) data[charSet[i]] = [];
    for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const r = EVENT_HORIZON + 0.05 + (Math.random() - 0.5) * 0.05;
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r * ELLIPSE_FACTOR;
        const y = (Math.random() - 0.5) * 0.03;
        const char = ringRamp[RAMP_MAX - Math.floor(Math.random() * 4)];
        data[char].push(x, y, z);
    }
    const group = new THREE.Group();
    for (let i = 0; i < charSet.length; i++) {
        const char = charSet[i];
        if (data[char].length > 0) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(data[char], 3));
            group.add(new THREE.Points(geo, materials[char]));
        }
    }
    return group;
}
ringSpin.add(createPhotonRing(420));

// Orbiting bodies — irregular radii, phases, heights and sizes so the
// orbital layer reads as a natural system rather than a flat square.
const PLANET_DEFS = [
    { angle: 0.35, radius: 3.6, height: 0.45, size: 0.30 },
    { angle: 2.05, radius: 4.7, height: -0.30, size: 0.18 },
    { angle: 3.50, radius: 4.2, height: 0.15, size: 0.34 },
    { angle: 5.10, radius: 5.2, height: -0.55, size: 0.22 }
];

const orbitingPlanets = [];
PLANET_DEFS.forEach(({ angle, radius, height, size }) => {
    const pointsCount = Math.round(350 * (size / 0.22) ** 2);
    const planet = createAsciiSphere(pointsCount, size);
    planet.position.set(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius * ELLIPSE_FACTOR
    );
    ringSpin.add(planet);
    orbitingPlanets.push(planet);
});

// --- Typography woven into the spiral arms ---
// Each arm carries a strand of words (skills inner, nav outer). Letters are
// distributed by equal arc length so both arms span the same radial band.
const TEXT_INNER = 2.0;
const TEXT_OUTER = 6.0;

const armWords = [
    "mysql rds elasticbeanstalk health   projects   about   github",
    "ucsd cogs109 python syn100 coursewise   linkedin   contact"
];

const textData = {};
for (let i = 0; i < charSet.length; i++) textData[charSet[i]] = [];

function layTextAlongArm(str, armIndex) {
    const samples = [];
    let arc = 0;
    let prev = armPoint(TEXT_INNER, armIndex);
    for (let r = TEXT_INNER; r <= TEXT_OUTER; r += 0.01) {
        const p = armPoint(r, armIndex);
        arc += Math.hypot(p.x - prev.x, p.z - prev.z);
        samples.push({ arc, x: p.x, z: p.z });
        prev = p;
    }
    const totalArc = arc;

    let si = 0;
    for (let k = 0; k < str.length; k++) {
        const target = str.length > 1 ? (k / (str.length - 1)) * totalArc : 0;
        while (si < samples.length - 1 && samples[si].arc < target) si++;
        const ch = str[k];
        if (ch !== ' ' && textData[ch]) textData[ch].push(samples[si].x, 0, samples[si].z);
    }
}

armWords.forEach((str, armIndex) => layTextAlongArm(str, armIndex));

const textGroup = new THREE.Group();
for (let i = 0; i < charSet.length; i++) {
    const char = charSet[i];
    if (textData[char].length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(textData[char], 3));
        textGroup.add(new THREE.Points(geo, materials[char]));
    }
}
ringSpin.add(textGroup);

// --- Pronounced Scattered Elliptical Galaxy Block ---
const DUST_COUNT = 5500;
const dustData = {};
for (let i = 0; i < charSet.length; i++) dustData[charSet[i]] = [];

let placed = 0;
let attempts = 0;

while (placed < DUST_COUNT && attempts < DUST_COUNT * 100) {
    attempts++;

    // Area-proportional sampling prevents center crowding artifacts
    const r2_min = DUST_INNER * DUST_INNER;
    const r2_max = DUST_OUTER * DUST_OUTER;
    const r = Math.sqrt(r2_min + Math.random() * (r2_max - r2_min));

    const u = (r - DUST_INNER) / (DUST_OUTER - DUST_INNER);
    const theta = Math.random() * Math.PI * 2;

    // 1. Minimal Core Glow
    const bulgeDensity = Math.exp(-3.5 * u) * 0.25;

    // 2. Highly Pronounced Spiral Arms
    const spiralWinding = theta - u * armTightness * Math.PI;
    const turbulence = 0.15 * Math.sin(r * 4.0 + theta);
    const armBase = (Math.cos(numArms * spiralWinding + turbulence) + 1) / 2;

    const armProfile = Math.pow(armBase, 5.5);
    const armClumps = 0.7 + 0.3 * Math.sin(u * 15.0 + theta * 2.0);
    const armDensity = armProfile * armClumps * 1.3 * (1.0 - u * 0.2);

    // 3. Clean Inter-arm Voids
    const ambientDensity = 0.02 * (1.0 - u);

    let density = bulgeDensity + armDensity + ambientDensity;
    density *= smoothstep(1.0, 0.85, u);

    density = Math.max(0, density);

    if (Math.random() > density) continue;
    placed++;

    let x = Math.cos(theta) * r;
    let z = Math.sin(theta) * r;

    // 4. Snug Position Jittering
    const jitterStrength = 0.07 + u * 0.12;
    x += (Math.random() - 0.5) * jitterStrength;
    z += (Math.random() - 0.5) * jitterStrength;

    // Apply Ellipse compression factor to match system eccentric paths
    z *= ELLIPSE_FACTOR;

    // 5. 3D Thickness Envelope
    const bulgeHeight = 0.30 * Math.exp(-4.0 * u);
    const armHeight = 0.05 + u * 0.08;
    const verticalSpread = Math.max(armHeight, bulgeHeight) * (Math.random() + Math.random() - 1.0) * 0.5;
    const y = verticalSpread;

    let baseBright = Math.pow(density, 0.5);
    let noise = (Math.random() + Math.random() + Math.random() - 1.5) * 0.15;
    let b = Math.max(0, Math.min(1, baseBright + noise));

    let bIndex = Math.floor(b * (ringRamp.length - 1));
    const char = ringRamp[bIndex];
    dustData[char].push(x, y, z);
}
// --- End Galaxy Block ---

const dustGroup = new THREE.Group();
for (let i = 0; i < charSet.length; i++) {
    const char = charSet[i];
    if (dustData[char].length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(dustData[char], 3));
        dustGroup.add(new THREE.Points(geo, materials[char]));
    }
}
ringSpin.add(dustGroup);

const systemTilt = new THREE.Group();
systemTilt.rotation.x = Math.PI / 5.5;
systemTilt.rotation.z = -Math.PI / 12;
systemTilt.rotation.y = 0.1;

systemTilt.add(ringSpin);
scene.add(systemTilt);

// Starfield
const starCount = 2500;
const starInnerRadius = 7;
const starOuterRadius = 22;
const starData = {};
for (const ch of starCharSet) starData[ch] = [];

for (let i = 0; i < starCount; i++) {
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    const r = starInnerRadius + Math.pow(Math.random(), 0.7) * (starOuterRadius - starInnerRadius);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    const ch = starCharSet[Math.floor(Math.random() * starCharSet.length)];
    starData[ch].push(x, y, z);
}

const starGroup = new THREE.Group();
for (const ch of starCharSet) {
    if (starData[ch].length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(starData[ch], 3));
        starGroup.add(new THREE.Points(geo, starMaterials[ch]));
    }
}
scene.add(starGroup);

document.getElementById('theme-toggle').addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    colors = getThemeColors();
    scene.background.setHex(colors.bg);
    applyCssTheme();

    if (isDarkMode) {
        document.getElementById('icon-sun').style.display = 'block';
        document.getElementById('icon-moon').style.display = 'none';
    } else {
        document.getElementById('icon-sun').style.display = 'none';
        document.getElementById('icon-moon').style.display = 'block';
    }

    for (let i = 0; i < charSet.length; i++) {
        const char = charSet[i];
        const oldMap = materials[char].map;
        materials[char].map = createCharTexture(char, colors.fg);
        materials[char].needsUpdate = true;
        oldMap.dispose();
    }

    for (let i = 0; i < starCharSet.length; i++) {
        const char = starCharSet[i];
        const oldMap = starMaterials[char].map;
        starMaterials[char].map = createCharTexture(char, colors.fg);
        starMaterials[char].needsUpdate = true;
        oldMap.dispose();
    }
});

let targetPointerX = 0, targetPointerY = 0;
let pointerX = 0, pointerY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;
let hintDismissed = false;

// Variables to lock relative coordinate offsets after interaction initialization
let firstMoveRecorded = false;
let anchorX = 0, anchorY = 0;

const coordsEl = document.getElementById('cursor-coords');

function dismissHint() {
    if (hintDismissed) return;
    hintDismissed = true;
    document.body.classList.add('hint-dismissed');
}

function setPointer(clientX, clientY) {
    if (!sceneRevealed) return;

    if (!firstMoveRecorded) {
        anchorX = clientX;
        anchorY = clientY;
        firstMoveRecorded = true;
    }

    const deltaX = clientX - anchorX;
    const deltaY = clientY - anchorY;

    targetPointerX = Math.max(-1, Math.min(1, deltaX / windowHalfX));
    targetPointerY = Math.max(-1, Math.min(1, deltaY / windowHalfY));

    if (coordsEl) {
        const formatCoord = (val) => (val >= 0 ? '+' : '') + val.toFixed(3);
        coordsEl.textContent = `X: ${formatCoord(targetPointerX)} | Y: ${formatCoord(-targetPointerY)}`;
    }
}

document.addEventListener('mousemove', (e) => setPointer(e.clientX, e.clientY));
document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) setPointer(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

document.addEventListener('click', () => {
    if (!sceneRevealed) {
        sceneRevealed = true;
        dismissHint();
    }
});

const clock = new THREE.Clock();
const MAX_AZIMUTH = 0.30;
const MAX_ELEVATION = 0.22;
const POINTER_EASE = 3.0;
let sceneRevealed = false;

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    ringSpin.rotation.y -= RING_SPIN * dt;

    updateAccretionDisk(dt);

    // Spin each placeholder planet on its individual local axis
    orbitingPlanets.forEach((planet, index) => {
        planet.rotation.y += (0.2 + index * 0.05) * dt;
    });

    starGroup.rotation.y -= 0.025 * dt;
    starGroup.rotation.x -= 0.010 * dt;

    if (sceneRevealed) {
        const pointerK = 1 - Math.exp(-2.5 * dt);
        pointerX += (targetPointerX - pointerX) * pointerK;
        pointerY += (targetPointerY - pointerY) * pointerK;

        const azimuth = pointerX * MAX_AZIMUTH;
        const elevation = -pointerY * MAX_ELEVATION;

        const cosE = Math.cos(elevation);
        const desiredX = CAMERA_RADIUS * Math.sin(azimuth) * cosE;
        const desiredY = CAMERA_RADIUS * Math.sin(elevation);
        const desiredZ = CAMERA_RADIUS * Math.cos(azimuth) * cosE;

        const k = 1 - Math.exp(-POINTER_EASE * dt);
        camera.position.x += (desiredX - camera.position.x) * k;
        camera.position.y += (desiredY - camera.position.y) * k;
        camera.position.z += (desiredZ - camera.position.z) * k;
    } else {
        // Snappy visual intro zoom effect
        const introSpeed = 5;
        const k = 1 - Math.exp(-introSpeed * dt);

        camera.position.x += (0 - camera.position.x) * k;
        camera.position.y += (0 - camera.position.y) * k;
        camera.position.z += (CAMERA_RADIUS - camera.position.z) * k;
    }
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;
});

function finishLoading() {
    document.body.classList.add('loaded');
}

animate();
finishLoading();