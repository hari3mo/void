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
const CAMERA_RADIUS = 9;
camera.position.set(0, 0, 20);

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
const bump = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));

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

// Planet
const spherePointsCount = 3000;;
const sphereRadius = 2.25;
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

const planetSpin = new THREE.Group();
for (let i = 0; i < charSet.length; i++) {
    const char = charSet[i];
    if (sphereData[char].length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(sphereData[char], 3));
        planetSpin.add(new THREE.Points(geo, materials[char]));
    }
}

const ringSpin = new THREE.Group();
const RING_SPIN = 0.14;

const NAV_RADIUS = 3.6;
const TECH_RAD_1 = 2.9;
const TECH_RAD_2 = 3.2;

const navWords = ["projects", "about", "github", "linkedin", "contact"];
const spacer = "          ";
const ringText = navWords.join(spacer) + spacer;

const navData = {};
for (let i = 0; i < charSet.length; i++) navData[charSet[i]] = [];

for (let i = 0; i < ringText.length; i++) {
    const char = ringText[i];
    if (char === ' ') continue;
    const theta = (i / ringText.length) * Math.PI * 2;

    const x = Math.cos(theta) * NAV_RADIUS;
    const z = Math.sin(theta) * NAV_RADIUS;

    if (navData[char]) navData[char].push(x, 0, z);
}

const navGroup = new THREE.Group();
for (let i = 0; i < charSet.length; i++) {
    const char = charSet[i];
    if (navData[char].length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(navData[char], 3));
        navGroup.add(new THREE.Points(geo, materials[char]));
    }
}
ringSpin.add(navGroup);

const techString1 = "mysql rds elasticbeanstalk health data mads ".repeat(3);
const techString2 = "ucsd cogs109 python syn100 coursewise ".repeat(4);

const techData = {};
for (let i = 0; i < charSet.length; i++) techData[charSet[i]] = [];

const addTechRing = (str, radius) => {
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === ' ') continue;
        const theta = (i / str.length) * Math.PI * 2;

        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;

        if (techData[char]) techData[char].push(x, 0, z);
    }
};

addTechRing(techString1, TECH_RAD_1);
addTechRing(techString2, TECH_RAD_2);

const techGroup = new THREE.Group();
for (let i = 0; i < charSet.length; i++) {
    const char = charSet[i];
    if (techData[char].length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(techData[char], 3));
        techGroup.add(new THREE.Points(geo, materials[char]));
    }
}
ringSpin.add(techGroup);

// Ring
const DUST_COUNT = 4500;
const DUST_INNER = 2.45;
const DUST_OUTER = 3.9;
const dustData = {};
for (let i = 0; i < charSet.length; i++) dustData[charSet[i]] = [];

let placed = 0;
let attempts = 0;
const phase1 = Math.random() * Math.PI * 2;
const phase2 = Math.random() * Math.PI * 2;

while (placed < DUST_COUNT && attempts < DUST_COUNT * 100) {
    attempts++;
    const r = DUST_INNER + Math.random() * (DUST_OUTER - DUST_INNER);
    const u = (r - DUST_INNER) / (DUST_OUTER - DUST_INNER);
    const theta = Math.random() * Math.PI * 2;

    const edge = smoothstep(0.0, 0.15, u) * smoothstep(1.0, 0.85, u);
    const cassini = 1 - 0.85 * bump(u, 0.65, 0.035);
    const encke = 1 - 0.60 * bump(u, 0.88, 0.015);
    const ringlets = 0.5 + 0.5 * Math.sin(u * 80.0);
    let dRad = edge * cassini * encke * ringlets;

    const wave1 = Math.sin(3 * theta + phase1 + u * 10);
    const wave2 = Math.sin(5 * theta + phase2 - u * 5);
    const dAz = 0.65 + 0.35 * (0.6 * wave1 + 0.4 * wave2);

    let density = dRad * dAz;
    const carveNav = bump(r, NAV_RADIUS, 0.08);
    const carveTech1 = bump(r, TECH_RAD_1, 0.06);
    const carveTech2 = bump(r, TECH_RAD_2, 0.06);

    density *= (1 - 0.95 * carveNav);
    density *= (1 - 0.85 * carveTech1);
    density *= (1 - 0.85 * carveTech2);
    density = Math.max(0, density);

    if (Math.random() > density) continue;
    placed++;

    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;

    const thicknessMod = 1.2 - 0.8 * density;
    const planetTaper = smoothstep(0.0, 1.0, u);

    const y = (Math.random() - 0.5) * 0.05 * thicknessMod * planetTaper;

    let baseBright = Math.pow(density, 0.6);
    let noise = (Math.random() + Math.random() + Math.random() - 1.5) * 0.2;
    let b = Math.max(0, Math.min(1, baseBright + noise));

    let bIndex = Math.floor(b * (ringRamp.length - 1));
    const char = ringRamp[bIndex];
    dustData[char].push(x, y, z);
}

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

systemTilt.add(planetSpin);
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

const coordsEl = document.getElementById('cursor-coords');

function dismissHint() {
    if (hintDismissed) return;
    hintDismissed = true;
    document.body.classList.add('hint-dismissed');
}

function setPointer(clientX, clientY) {
    targetPointerX = Math.max(-1, Math.min(1, (clientX - windowHalfX) / windowHalfX));
    targetPointerY = Math.max(-1, Math.min(1, (clientY - windowHalfY) / windowHalfY));

    if (coordsEl) {
        const formatCoord = (val) => (val >= 0 ? '+' : '') + val.toFixed(3);
        coordsEl.textContent = `X: ${formatCoord(targetPointerX)} | Y: ${formatCoord(-targetPointerY)}`;
    }

    dismissHint();
}

document.addEventListener('mousemove', (e) => setPointer(e.clientX, e.clientY));
document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) setPointer(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

const clock = new THREE.Clock();
const MAX_AZIMUTH = 0.30;
const MAX_ELEVATION = 0.22;
const POINTER_EASE = 3.0;
const PLANET_SPIN = 0.10;
let sceneRevealed = false;

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    planetSpin.rotation.y += PLANET_SPIN * dt;
    ringSpin.rotation.y -= RING_SPIN * dt;

    starGroup.rotation.y -= 0.025 * dt;
    starGroup.rotation.x -= 0.010 * dt;

    const pointerK = 1 - Math.exp(-2.5 * dt);
    pointerX += (targetPointerX - pointerX) * pointerK;
    pointerY += (targetPointerY - pointerY) * pointerK;

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
    sceneRevealed = true;
    document.body.classList.add('loaded');
    setTimeout(dismissHint, 6500);
}

animate();
finishLoading();