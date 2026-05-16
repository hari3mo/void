const themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let isDarkMode = themeQuery.matches;

function getThemeColors() {
    return {
        bg: isDarkMode ? 0x030305 : 0xffffff,
        fg: isDarkMode ? '#ffffff' : '#000000',
        cssBg: isDarkMode ? '#030305' : '#ffffff',
        blending: isDarkMode ? THREE.AdditiveBlending : THREE.NormalBlending
    };
}
let colors = getThemeColors();
document.body.style.backgroundColor = colors.cssBg;
document.body.style.setProperty('--fg', colors.fg);

const scene = new THREE.Scene();
scene.background = new THREE.Color(colors.bg);
scene.fog = new THREE.FogExp2(colors.bg, 0.022);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const CAMERA_RADIUS = 9;
camera.position.set(0, 0, CAMERA_RADIUS);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const charSet = 'abcdefghijklmnopqrstuvwxyz0123456789.,-~:;=';
const starCharSet = '.,-~:;=*+';

const starSizes = {
    '.': 0.08, ',': 0.08, ':': 0.10, ';': 0.10,
    '-': 0.12, '~': 0.12, '=': 0.13,
    '+': 0.16, '*': 0.16
};

const materials = {};
const starMaterials = {};

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

for (let i = 0; i < charSet.length; i++) {
    const char = charSet[i];
    const tex = createCharTexture(char, colors.fg);
    materials[char] = new THREE.PointsMaterial({
        size: 0.12, map: tex, transparent: true, alphaTest: 0.1,
        blending: colors.blending, depthWrite: false
    });
}
for (let i = 0; i < starCharSet.length; i++) {
    const char = starCharSet[i];
    const tex = createCharTexture(char, colors.fg);
    starMaterials[char] = new THREE.PointsMaterial({
        size: starSizes[char] || 0.10,
        map: tex, transparent: true, opacity: 0.75,
        blending: colors.blending, depthWrite: false
    });
}

const sphereGroup = new THREE.Group();
const ringGroup = new THREE.Group();
const starGroup = new THREE.Group();

const sphereData = {};
const ringData = {};
const starData = {};

for (let i = 0; i < charSet.length; i++) {
    sphereData[charSet[i]] = [];
    ringData[charSet[i]] = [];
}
for (let i = 0; i < starCharSet.length; i++) {
    starData[starCharSet[i]] = [];
}

// Main Sphere
const spherePointsCount = 3000;
const sphereRadius = 3;
for (let i = 0; i < spherePointsCount; i++) {
    const y = 1 - (i / (spherePointsCount - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = 2.399963229728653 * i;
    const x = Math.cos(theta) * radiusAtY * sphereRadius;
    const z = Math.sin(theta) * radiusAtY * sphereRadius;
    const randomChar = charSet[Math.floor(Math.random() * charSet.length)];
    sphereData[randomChar].push(x, y * sphereRadius, z);
}

// Ring
const ringRadius = 4.5;
const ringParticleCount = 1250;
for (let i = 0; i < ringParticleCount; i++) {
    const radiusSpread = ringRadius + (Math.random() - 0.5) * 0.4;
    const theta = Math.random() * Math.PI * 2;
    const x = Math.cos(theta) * radiusSpread;
    const z = Math.sin(theta) * radiusSpread;
    const randomChar = charSet[Math.floor(Math.random() * charSet.length)];
    ringData[randomChar].push(x, 0, z);
}

// Starfield
const starCount = 8000;
const starInnerRadius = 7;
const starOuterRadius = 22;
for (let i = 0; i < starCount; i++) {
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    const r = starInnerRadius + Math.pow(Math.random(), 0.7) * (starOuterRadius - starInnerRadius);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    const randomChar = starCharSet[Math.floor(Math.random() * starCharSet.length)];
    starData[randomChar].push(x, y, z);
}

for (let i = 0; i < charSet.length; i++) {
    const char = charSet[i];
    if (sphereData[char].length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(sphereData[char], 3));
        sphereGroup.add(new THREE.Points(geo, materials[char]));
    }
    if (ringData[char].length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(ringData[char], 3));
        ringGroup.add(new THREE.Points(geo, materials[char]));
    }
}
for (let i = 0; i < starCharSet.length; i++) {
    const char = starCharSet[i];
    if (starData[char].length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(starData[char], 3));
        starGroup.add(new THREE.Points(geo, starMaterials[char]));
    }
}

ringGroup.rotation.x = Math.PI / 6;
scene.add(sphereGroup);
scene.add(ringGroup);
scene.add(starGroup);

let pointerX = 0, pointerY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

function setPointer(clientX, clientY) {
    pointerX = Math.max(-1, Math.min(1, (clientX - windowHalfX) / windowHalfX));
    pointerY = Math.max(-1, Math.min(1, (clientY - windowHalfY) / windowHalfY));
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
    document.body.style.backgroundColor = colors.cssBg;
    document.body.style.setProperty('--fg', colors.fg);

    for (let i = 0; i < charSet.length; i++) {
        const char = charSet[i];
        const oldMap = materials[char].map;
        materials[char].map = createCharTexture(char, colors.fg);
        materials[char].blending = colors.blending;
        materials[char].needsUpdate = true;
        oldMap.dispose();
    }
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

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    sphereGroup.rotation.y += 0.12 * dt;
    sphereGroup.rotation.x += 0.06 * dt;
    ringGroup.rotation.z -= 0.18 * dt;
    starGroup.rotation.y -= 0.03 * dt;
    starGroup.rotation.x -= 0.012 * dt;

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

animate();