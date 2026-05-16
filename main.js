const NAME = 'haris saif';

document.getElementById('nametext').textContent = NAME.toLowerCase();

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionScale = reduceMotion ? 0 : 1;

const themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let isDarkMode = themeQuery.matches;

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
const CAMERA_RADIUS = 9;
camera.position.set(0, 0, reduceMotion ? CAMERA_RADIUS : 20);  // start zoomed out

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

const materials = {};
for (let i = 0; i < charSet.length; i++) {
    const char = charSet[i];
    materials[char] = new THREE.PointsMaterial({
        size: 0.12, map: createCharTexture(char, colors.fg),
        alphaTest: 0.5
    });
}

// Starfield materials
const starMaterials = {};
for (let i = 0; i < starCharSet.length; i++) {
    const char = starCharSet[i];
    starMaterials[char] = new THREE.PointsMaterial({
        size: starSizes[char] || 0.10,
        map: createCharTexture(char, colors.fg),
        alphaTest: 0.5
    });
}

const SYSTEM_TILT = Math.PI / 6; // planet's spin axis and the ring plane use the same angle

// Planet
const spherePointsCount = 3000;
const sphereRadius = 2.7; // Reduced from 3
const sphereData = {};
for (let i = 0; i < charSet.length; i++) sphereData[charSet[i]] = [];

for (let i = 0; i < spherePointsCount; i++) {
    const y = 1 - (i / (spherePointsCount - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = 2.399963229728653 * i;
    const x = Math.cos(theta) * radiusAtY * sphereRadius;
    const z = Math.sin(theta) * radiusAtY * sphereRadius;
    const randomChar = charSet[Math.floor(Math.random() * charSet.length)];
    sphereData[randomChar].push(x, y * sphereRadius, z);
}

// planetSpin rotates; planetTilt holds it at the system tilt
const planetSpin = new THREE.Group();
for (let i = 0; i < charSet.length; i++) {
    const char = charSet[i];
    if (sphereData[char].length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(sphereData[char], 3));
        planetSpin.add(new THREE.Points(geo, materials[char]));
    }
}
const planetTilt = new THREE.Group();
planetTilt.rotation.x = SYSTEM_TILT;
planetTilt.add(planetSpin);
scene.add(planetTilt);

// Ring
const RING_INNER = 3.75;
const RING_OUTER = 4.85;
const RING_COUNT = 2000;
const RING_THICKNESS = 0.075; // vertical scatter
const RING_SPIN = 0.14; // rad/s

const smoothstep = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
};
const bump = (x, c, w) => {
    const d = (x - c) / w;
    return Math.exp(-d * d);
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

const ringPhase = Math.random() * Math.PI * 2;
const azPhaseA = Math.random() * Math.PI * 2;
const azPhaseB = Math.random() * Math.PI * 2;

function ringRadialDensity(u) {
    const edge = smoothstep(0.0, 0.09, u) * smoothstep(1.0, 0.88, u);
    const cassini = 1 - 0.95 * bump(u, 0.62, 0.030);
    const encke = 1 - 0.80 * bump(u, 0.82, 0.013);
    const innerGap = 1 - 0.50 * bump(u, 0.28, 0.025);
    const brightBand = 1 + 0.40 * bump(u, 0.46, 0.13);
    const r1 = 0.5 + 0.5 * Math.sin(u * 41.0 + ringPhase);
    const r2 = 0.5 + 0.5 * Math.sin(u * 23.3 + ringPhase * 1.7);
    const r3 = 0.5 + 0.5 * Math.sin(u * 13.7 + ringPhase * 0.4);
    const ringlets = 0.62 + 0.38 * (0.50 * r1 + 0.32 * r2 + 0.18 * r3);
    return Math.min(1, Math.max(0,
        edge * cassini * encke * innerGap * brightBand * ringlets));
}

function ringAzimuthalDensity(theta) {
    const w = 0.5 + 0.5 * (0.6 * Math.sin(2 * theta + azPhaseA) +
        0.4 * Math.sin(3 * theta + azPhaseB));
    return 0.82 + 0.18 * Math.min(1, Math.max(0, w));
}

const ringData = {};
for (let i = 0; i < charSet.length; i++) ringData[charSet[i]] = [];

const ringR2in = RING_INNER * RING_INNER;
const ringR2out = RING_OUTER * RING_OUTER;
let ringPlaced = 0, ringGuard = 0;
while (ringPlaced < RING_COUNT && ringGuard < RING_COUNT * 90) {
    ringGuard++;
    const r = Math.sqrt(ringR2in + Math.random() * (ringR2out - ringR2in));
    const u = (r - RING_INNER) / (RING_OUTER - RING_INNER);
    const theta = Math.random() * Math.PI * 2;
    const dRad = ringRadialDensity(u);
    const dAz = ringAzimuthalDensity(theta);
    if (Math.random() > dRad * dAz) continue;
    ringPlaced++;

    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const y = (Math.random() - 0.5) * RING_THICKNESS * (1.2 - 0.45 * dRad);

    let b = dRad * (0.5 + 0.5 * dAz);
    b = Math.min(1, Math.max(0, b * (0.78 + Math.random() * 0.44)));
    const gi = Math.min(ringRamp.length - 1,
        Math.floor(Math.pow(b, 1.1) * ringRamp.length));
    ringData[ringRamp[gi]].push(x, y, z);
}

// ringSpin rotates flat in-plane; ringTilt holds the system tilt
const ringSpin = new THREE.Group();
for (let i = 0; i < charSet.length; i++) {
    const char = charSet[i];
    if (ringData[char].length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(ringData[char], 3));
        ringSpin.add(new THREE.Points(geo, materials[char]));
    }
}
const ringTilt = new THREE.Group();
ringTilt.rotation.x = SYSTEM_TILT;
ringTilt.add(ringSpin);
scene.add(ringTilt);

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

let pointerX = 0, pointerY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;
let hintDismissed = false;

function dismissHint() {
    if (hintDismissed) return;
    hintDismissed = true;
    document.body.classList.add('hint-dismissed');
}

function setPointer(clientX, clientY) {
    pointerX = Math.max(-1, Math.min(1, (clientX - windowHalfX) / windowHalfX));
    pointerY = Math.max(-1, Math.min(1, (clientY - windowHalfY) / windowHalfY));
    dismissHint();
}

document.addEventListener('mousemove', (e) => setPointer(e.clientX, e.clientY));
document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) setPointer(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

themeQuery.addEventListener('change', (e) => {
    isDarkMode = e.matches;
    colors = getThemeColors();
    scene.background.setHex(colors.bg);
    applyCssTheme();

    // Planet + ring materials (the ring shares these)
    for (let i = 0; i < charSet.length; i++) {
        const char = charSet[i];
        const oldMap = materials[char].map;
        materials[char].map = createCharTexture(char, colors.fg);
        materials[char].needsUpdate = true;
        oldMap.dispose();
    }
    // Starfield materials
    for (let i = 0; i < starCharSet.length; i++) {
        const char = starCharSet[i];
        const oldMap = starMaterials[char].map;
        starMaterials[char].map = createCharTexture(char, colors.fg);
        starMaterials[char].needsUpdate = true;
        oldMap.dispose();
    }
});

const clock = new THREE.Clock();
const MAX_AZIMUTH = 0.30;
const MAX_ELEVATION = 0.22;
const POINTER_EASE = 3.0;
const PLANET_SPIN = 0.10;
let sceneRevealed = false;

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    // Spin around its tilted axis
    planetSpin.rotation.y += PLANET_SPIN * dt * motionScale;

    // Spins flat in its own plane
    ringSpin.rotation.y += RING_SPIN * dt * motionScale;

    // Slow ambient drift
    starGroup.rotation.y -= 0.025 * dt * motionScale;
    starGroup.rotation.x -= 0.010 * dt * motionScale;

    // Camera easing
    if (sceneRevealed) {
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
    sceneRevealed = true; // releases camera dolly + parallax
    document.body.classList.add('loaded');
    setTimeout(dismissHint, 6500);
}

animate();
finishLoading();