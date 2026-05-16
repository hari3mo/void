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
        cssBg: isDarkMode ? '#030305' : '#ffffff',
        vignette: isDarkMode ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)',
        blending: isDarkMode ? THREE.AdditiveBlending : THREE.NormalBlending
    };
}
let colors = getThemeColors();

function applyCssTheme() {
    document.body.style.setProperty('--fg', colors.fg);
    document.body.style.setProperty('--bg', colors.cssBg);
    document.body.style.setProperty('--vignette', colors.vignette);
}
applyCssTheme();

const scene = new THREE.Scene();
scene.background = new THREE.Color(colors.bg);
scene.fog = new THREE.FogExp2(colors.bg, 0.022);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const CAMERA_RADIUS = 9;
// Start wide for the intro dolly
camera.position.set(0, 0, reduceMotion ? CAMERA_RADIUS : 14);

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

// Planet + ring share this full char set
const materials = {};
for (let i = 0; i < charSet.length; i++) {
    const char = charSet[i];
    materials[char] = new THREE.PointsMaterial({
        size: 0.12, map: createCharTexture(char, colors.fg),
        transparent: true, alphaTest: 0.1,
        blending: colors.blending, depthWrite: false
    });
}

// Starfield materials
const starMaterials = {};
for (let i = 0; i < starCharSet.length; i++) {
    const char = starCharSet[i];
    starMaterials[char] = new THREE.PointsMaterial({
        size: starSizes[char] || 0.10,
        map: createCharTexture(char, colors.fg),
        transparent: true, opacity: 0.75,
        blending: colors.blending, depthWrite: false
    });
}

const SYSTEM_TILT = Math.PI / 6; // planet's spin axis and the ring plane use the same angle

// Planet
const spherePointsCount = 3000;
const sphereRadius = 3;
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

// planetSpin rotates; planetTilt holds it at the system tilt — nested groups
// give a clean single-axis spin instead of a tumble.
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
const RING_INNER = 4.25;
const RING_OUTER = 4.85;
const RING_COUNT = 2000;
const RING_THICKNESS = 0.08; // slight vertical scatter
const RING_SPIN = 0.14; // rad/s

const ringAmp = 0.18;
const ringPhase = Math.random() * Math.PI * 2;
const ringDMax = 1 + ringAmp;
const ringDensity = (t) => 1 + ringAmp * Math.sin(2 * t + ringPhase);

const ringData = {};
for (let i = 0; i < charSet.length; i++) ringData[charSet[i]] = [];

const ringR2in = RING_INNER * RING_INNER;
const ringR2out = RING_OUTER * RING_OUTER;
for (let i = 0; i < RING_COUNT; i++) {
    const r = Math.sqrt(ringR2in + Math.random() * (ringR2out - ringR2in));
    let theta;
    do {
        theta = Math.random() * Math.PI * 2;
    } while (Math.random() > ringDensity(theta) / ringDMax);
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const y = (Math.random() - 0.5) * RING_THICKNESS;
    const ch = charSet[Math.floor(Math.random() * charSet.length)];
    ringData[ch].push(x, y, z);
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
const starCount = 8500;
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
    scene.fog.color.setHex(colors.bg);
    applyCssTheme();

    // Planet + ring materials
    for (let i = 0; i < charSet.length; i++) {
        const char = charSet[i];
        const oldMap = materials[char].map;
        materials[char].map = createCharTexture(char, colors.fg);
        materials[char].blending = colors.blending;
        materials[char].needsUpdate = true;
        oldMap.dispose();
    }
    // Starfield materials
    for (let i = 0; i < starCharSet.length; i++) {
        const char = starCharSet[i];
        const oldMap = starMaterials[char].map;
        starMaterials[char].map = createCharTexture(char, colors.fg);
        starMaterials[char].blending = colors.blending;
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

    // Planet — spin around its tilted axis
    planetSpin.rotation.y += PLANET_SPIN * dt * motionScale;

    // Ring — spins flat in its own plane
    ringSpin.rotation.y += RING_SPIN * dt * motionScale;

    // Starfield — slow ambient drift
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

const BAR_LEN = 22;
const loaderBar = document.getElementById('loader-bar');
let loadProgress = 0;

function tickLoader() {
    loadProgress += 0.018; // ~0.9s fill at 60fps
    const filled = Math.min(BAR_LEN, Math.round(loadProgress * BAR_LEN));
    loaderBar.textContent = '█'.repeat(filled) + '░'.repeat(BAR_LEN - filled);
    if (loadProgress < 1) {
        requestAnimationFrame(tickLoader);
    } else {
        finishLoading();
    }
}

function finishLoading() {
    sceneRevealed = true; // releases camera dolly + parallax
    document.body.classList.add('loaded');
    setTimeout(dismissHint, 6500);
    setTimeout(() => {
        const l = document.getElementById('loader');
        if (l) l.remove();
    }, 900);
}

animate();
requestAnimationFrame(tickLoader);