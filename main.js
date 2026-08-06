// ---------------------------------------------------------------------------
// void — an ascii galaxy spiralling into a black hole.
// three.js r128, no build step. Layers: live accretion disk (newtonian
// infall), photon ring, orbiting planets, nav words woven into the spiral
// arms, dust field, starfield. Every glyph is a canvas-rendered Space Mono
// character, and each layer carries its own colour ramp per theme.
// ---------------------------------------------------------------------------

const NAME = 'haris saif';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SMALL = Math.min(window.innerWidth, window.innerHeight) < 700;

const charSet = 'abcdefghijklmnopqrstuvwxyz0123456789.,-~:;=';
const starCharSet = '.,-~:;=*+';

const starSizes = {
    '.': 0.08, ',': 0.08, ':': 0.10, ';': 0.10,
    '-': 0.12, '~': 0.12, '=': 0.13,
    '+': 0.16, '*': 0.18
};

const GLYPH_FONT = 'bold 24px "Space Mono", "Courier New", Courier, monospace';

// Per-theme grayscale ramps. Stops are [t, gray] where t is the glyph's
// brightness rank (0 = dimmest character, 1 = brightest). Pure monochrome:
// the accretion disk burns from dim gray at the rim to pure white at the
// core; in light mode "hot" flips to dense dark ink so the disk still reads
// intense on paper. No hue anywhere — tone comes from glyph density × gray.
const PALETTES = {
    dark: {
        bg: '#060606', fg: '#f6f6f6',
        muted: '#b8b8b8', quiet: '#8b8b8b',
        hair: 'rgba(184, 184, 184, 0.30)',
        disk: [[0, '#474747'], [0.45, '#909090'], [0.8, '#dcdcdc'], [1, '#ffffff']],
        dust: [[0, '#373737'], [0.5, '#707070'], [1, '#d4d4d4']],
        star: [[0, '#585858'], [1, '#dadada']],
        planet: [[0, '#6e6e6e'], [1, '#ededed']],
        flavor: '#888888',
        nav: '#f0f0f0',
        navHot: '#ffffff',
        streak: '#f3f3f3',
        streakHead: '#bbbbbb',
        streakTail: '#b3b3b3'
    },
    light: {
        bg: '#f3f3f3', fg: '#181818',
        muted: '#555555', quiet: '#6f6f6f',
        hair: 'rgba(49, 49, 49, 0.26)',
        disk: [[0, '#cccccc'], [0.45, '#8c8c8c'], [0.8, '#3a3a3a'], [1, '#0d0d0d']],
        dust: [[0, '#d3d3d3'], [0.5, '#929292'], [1, '#454545']],
        star: [[0, '#c9c9c9'], [1, '#525252']],
        planet: [[0, '#9a9a9a'], [1, '#2a2a2a']],
        flavor: '#9a9a9a',
        nav: '#202020',
        navHot: '#000000',
        streak: '#2a2a2a',
        streakHead: '#6b6b6b',
        streakTail: '#646464'
    }
};

let theme = 'dark';
const palette = () => PALETTES[theme];

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rampColor(stops, t) {
    t = Math.max(0, Math.min(1, t));
    let i = 1;
    while (i < stops.length - 1 && stops[i][0] < t) i++;
    const t0 = stops[i - 1][0], t1 = stops[i][0];
    const a = hexToRgb(stops[i - 1][1]), b = hexToRgb(stops[i][1]);
    const k = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
    const r = Math.round(a[0] + (b[0] - a[0]) * k);
    const g = Math.round(a[1] + (b[1] - a[1]) * k);
    const bl = Math.round(a[2] + (b[2] - a[2]) * k);
    return `rgb(${r}, ${g}, ${bl})`;
}

function applyCssTheme() {
    const p = palette();
    document.body.style.setProperty('--fg', p.fg);
    document.body.style.setProperty('--bg', p.bg);
    document.body.style.setProperty('--muted', p.muted);
    document.body.style.setProperty('--quiet', p.quiet);
    document.body.style.setProperty('--hair', p.hair);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', p.bg);
}
applyCssTheme();

const smoothstep = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
};

// Glyph textures are rasterised from the webfont, so hold scene construction
// until it arrives (with a timeout so an offline visit still renders in the
// fallback courier).
async function waitForFonts() {
    if (!document.fonts || !document.fonts.load) return;
    try {
        await Promise.race([
            Promise.all([
                document.fonts.load('700 24px "Space Mono"'),
                document.fonts.load('400 12px "Space Mono"')
            ]),
            new Promise((resolve) => setTimeout(resolve, 1800))
        ]);
    } catch (e) { /* fall back to courier */ }
}

(async function init() {
    await waitForFonts();

    // ------------------------------------------------- scene & camera ----
    const scene = new THREE.Scene();
    const sceneBg = new THREE.Color(palette().bg);
    scene.background = sceneBg;

    const FOV = 75;
    const BASE_RADIUS = 12;
    const FIT_RADIUS = 7.0; // half-extent of the galaxy plus margin

    // Pull the camera back on narrow (portrait) viewports so the whole disk
    // stays inside the horizontal field of view.
    function cameraDistance() {
        const aspect = window.innerWidth / window.innerHeight;
        const halfV = Math.tan((FOV * Math.PI) / 360);
        return Math.max(BASE_RADIUS, FIT_RADIUS / (halfV * aspect));
    }
    let camDist = cameraDistance();

    const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Start the camera far away and slightly offset on the X/Y axes
    // to create a subtle panning depth effect on load
    camera.position.set(4, 3, 50);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // -------------------------------------------- glyphs & materials ----
    function createCharTexture(char, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.font = GLYPH_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(char, 16, 16);
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        return texture;
    }

    function buildBrightnessRamp(chars) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.font = GLYPH_FONT;
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
    const RAMP_MAX = ringRamp.length - 1;

    // Brightness rank per character (0 dimmest .. 1 brightest) — the colour
    // ramps key off this, so dense glyphs also read hotter/brighter.
    const rankOf = {};
    ringRamp.forEach((ch, i) => { rankOf[ch] = i / RAMP_MAX; });

    // Every layer owns a material per character; on theme change the whole
    // registry is retinted in place.
    const materialSets = [];

    function makeMaterialSet(chars, colorFor, sizeFor, opts = {}) {
        const mats = {};
        for (const ch of chars) {
            mats[ch] = new THREE.PointsMaterial({
                size: sizeFor(ch),
                map: createCharTexture(ch, colorFor(ch)),
                alphaTest: 0.5,
                transparent: !!opts.transparent
            });
        }
        materialSets.push({ mats, chars, colorFor });
        return mats;
    }

    function retintMaterials() {
        for (const set of materialSets) {
            for (const ch of set.chars) {
                const old = set.mats[ch].map;
                set.mats[ch].map = createCharTexture(ch, set.colorFor(ch));
                set.mats[ch].needsUpdate = true;
                if (old) old.dispose();
            }
        }
    }

    const diskMats = makeMaterialSet(charSet,
        (ch) => rampColor(palette().disk, rankOf[ch]),
        (ch) => 0.10 + 0.05 * rankOf[ch]);

    const dustMats = makeMaterialSet(charSet,
        (ch) => rampColor(palette().dust, rankOf[ch]),
        (ch) => 0.10 + 0.025 * rankOf[ch]);

    const planetMats = makeMaterialSet(charSet,
        (ch) => rampColor(palette().planet, rankOf[ch]),
        () => SMALL ? 0.17 : 0.15);

    const starMats = makeMaterialSet(starCharSet,
        (ch) => rampColor(palette().star, starCharSet.indexOf(ch) / (starCharSet.length - 1)),
        (ch) => starSizes[ch] || 0.10,
        { transparent: true });

    const flavorMats = makeMaterialSet(charSet, () => palette().flavor, () => 0.12);
    const navMats = makeMaterialSet(charSet, () => palette().nav, () => SMALL ? 0.38 : 0.32);
    const navHotMats = makeMaterialSet(charSet, () => palette().navHot, () => SMALL ? 0.46 : 0.40);
    const galaxyDimMaterials = [
        ...Object.values(diskMats),
        ...Object.values(dustMats),
        ...Object.values(flavorMats),
        ...Object.values(navMats)
    ];
    const GALAXY_HOVER_BRIGHTNESS = 0.24;
    const GALAXY_HOVER_EASE = 7;
    let galaxyBrightness = 1;

    function applyGalaxyBrightness(value) {
        for (const material of galaxyDimMaterials) {
            material.color.setRGB(value, value, value);
        }
    }

    function createAsciiSphere(pointsCount, radius, mats) {
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
                sphereGroup.add(new THREE.Points(geo, mats[char]));
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
    const RING_SPIN = 0.2;

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
    const DISK_COUNT = SMALL ? 2800 : 5000;
    const GM = 2.2;              // gravitational pull — raise to suck harder/faster
    const ANG_MOMENTUM = 0.65;   // higher = more spiral winding before the plunge
    const INFLOW = 0.2;          // baseline inward glide so the whole disk drains visibly

    // Press-and-hold anywhere to feed the black hole: gravity ramps up and
    // the whole disk visibly plunges. Eases back to rest on release.
    let feedScale = 1;
    let feedTarget = 1;

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
        diskGroup.add(new THREE.Points(geo, diskMats[charSet[i]]));
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
            const vr = diskVr[i] - (GM * feedScale / (r * r)) * dt;
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

            // Hottest at the inner rim, fading out across the disk, with the
            // approaching side Doppler-beamed brighter. Beaming is anchored in
            // world space (theta minus the group's spin) so the hot side holds
            // steady relative to the viewer instead of orbiting with the disk.
            const beaming = 0.6 + 0.4 * Math.cos(theta - ringSpin.rotation.y);
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
                group.add(new THREE.Points(geo, diskMats[char]));
            }
        }
        return group;
    }
    const photonRing = createPhotonRing(480);
    ringSpin.add(photonRing);

    // Orbiting bodies — irregular radii, phases, heights and sizes so the
    // orbital layer reads as a natural system rather than a flat square.
    const PLANET_DEFS = [
        { word: 'projects', angle: 0.35, radius: 3.6, height: 0.45, size: 0.30 },
        { word: 'about', angle: 1.55, radius: 4.6, height: -0.30, size: 0.24 },
        { word: 'github', angle: 2.80, radius: 4.2, height: 0.15, size: 0.34 },
        // { word: 'linkedin', angle: 3.45, radius: 5.7, height: 0.35, size: 0.25 },
        { word: 'resume', angle: 4.05, radius: 5.2, height: -0.50, size: 0.27 },
        { word: 'email', angle: 5.30, radius: 4.0, height: 0.30, size: 0.22 }
    ];

    const orbitingPlanets = [];
    PLANET_DEFS.forEach(({ word, angle, radius, height, size }) => {
        const pointsCount = Math.round(350 * (size / 0.22) ** 2 * (SMALL ? 0.75 : 1));
        const planet = createAsciiSphere(pointsCount, size, planetMats);
        planet.position.set(
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius * ELLIPSE_FACTOR
        );
        ringSpin.add(planet);
        orbitingPlanets.push({ group: planet, word, size });
    });

    // --- Typography woven into the spiral arms ---
    // Each arm carries a strand of words laid along the arm centerline:
    // ambient résumé fragments on the inner reach, nav words on the outer
    // reach where they're easiest to read and click. Letters are placed at a
    // fixed arc pitch so words read as words, not scattered constellations.
    const TEXT_INNER = 2.0;
    const TEXT_OUTER = 6.0;
    const CHAR_ARC = 0.28;  // arc length between letters within a word
    const WORD_GAP = 1.35;  // arc length between words
    const NAV_LIFT = 0.12;  // nav words float just above the dust plane

    const NAV_WORDS = new Set(['projects', 'about', 'github', 'resume', 'email']);
    const ARM_WORDS = [
        ['mysql', 'rds', 'elasticbeanstalk', 'health'],
        ['ucsd', 'cogs109', 'python', 'syn100', 'coursewise']
    ];

    const flavorData = {};
    for (let i = 0; i < charSet.length; i++) flavorData[charSet[i]] = [];

    const navGroup = new THREE.Group();
    const navPickList = []; // arm-word letter Points burned white on hover

    function layWordsAlongArm(words, armIndex) {
        const samples = [];
        let arc = 0;
        let prev = armPoint(TEXT_INNER, armIndex);
        for (let r = TEXT_INNER; r <= TEXT_OUTER; r += 0.005) {
            const p = armPoint(r, armIndex);
            arc += Math.hypot(p.x - prev.x, p.z - prev.z);
            samples.push({ arc, x: p.x, z: p.z });
            prev = p;
        }
        const totalArc = arc;

        let charArc = CHAR_ARC, wordGap = WORD_GAP;
        let needed = words.reduce((s, w) => s + (w.length - 1) * charArc, 0) + (words.length - 1) * wordGap;
        if (needed > totalArc * 0.94) {
            const scale = (totalArc * 0.94) / needed;
            charArc *= scale;
            wordGap *= scale;
            needed = totalArc * 0.94;
        }

        let cursor = (totalArc - needed) / 2;
        let si = 0;
        const posAt = (target) => {
            while (si < samples.length - 1 && samples[si].arc < target) si++;
            return samples[si];
        };

        for (const word of words) {
            const isNav = NAV_WORDS.has(word);
            const perChar = {};
            for (let k = 0; k < word.length; k++) {
                const p = posAt(cursor + k * charArc);
                const ch = word[k];
                if (isNav) {
                    (perChar[ch] = perChar[ch] || []).push(p.x, NAV_LIFT, p.z);
                } else if (flavorData[ch]) {
                    flavorData[ch].push(p.x, 0, p.z);
                }
            }
            if (isNav) {
                for (const ch in perChar) {
                    const geo = new THREE.BufferGeometry();
                    geo.setAttribute('position', new THREE.Float32BufferAttribute(perChar[ch], 3));
                    const points = new THREE.Points(geo, navMats[ch]);
                    points.userData = { word, ch };
                    navGroup.add(points);
                    navPickList.push(points);
                }
            }
            cursor += (word.length - 1) * charArc + wordGap;
        }
    }

    ARM_WORDS.forEach((words, armIndex) => layWordsAlongArm(words, armIndex));

    // Each planet's title wraps along its own orbit, starting just to the
    // planet's other side (decreasing angle) so the label reads left-to-right
    // and curves with the spiral. Same arc pitch as arm words.
    function layPlanetLabel({ word, angle, radius, height, size }) {
        const startArc = size + 0.22;  // clear the sphere before the first letter
        const perChar = {};
        for (let k = 0; k < word.length; k++) {
            const a = angle - (startArc + k * CHAR_ARC) / radius;
            const ch = word[k];
            (perChar[ch] = perChar[ch] || []).push(
                Math.cos(a) * radius,
                height,
                Math.sin(a) * radius * ELLIPSE_FACTOR
            );
        }
        for (const ch in perChar) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(perChar[ch], 3));
            const points = new THREE.Points(geo, navMats[ch]);
            points.userData = { word, ch };
            navGroup.add(points);
            navPickList.push(points);
        }
    }
    PLANET_DEFS.forEach(layPlanetLabel);

    ringSpin.add(navGroup);

    const flavorGroup = new THREE.Group();
    for (let i = 0; i < charSet.length; i++) {
        const char = charSet[i];
        if (flavorData[char].length > 0) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(flavorData[char], 3));
            flavorGroup.add(new THREE.Points(geo, flavorMats[char]));
        }
    }
    ringSpin.add(flavorGroup);

    // --- Pronounced Scattered Elliptical Galaxy Block ---
    const DUST_COUNT = SMALL ? 3200 : 5500;
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
            dustGroup.add(new THREE.Points(geo, dustMats[char]));
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
    const starCount = SMALL ? 1400 : 2500;
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
            starGroup.add(new THREE.Points(geo, starMats[ch]));
        }
    }
    scene.add(starGroup);

    // One ambient shooting star and one user meteor share a fixed ASCII trail
    // pool, so transient sky events do not allocate while animating.
    function createSkyEvents() {
        const trailPattern = ['*', '+', '+', '=', '-', '-', '-', ':', '.', '.', '.', '.'];
        const trailChars = Array.from(new Set(trailPattern));
        const trailLength = trailPattern.length;
        const maxEvents = 2;
        const perEventCounts = {};
        for (const ch of trailChars) perEventCounts[ch] = 0;
        for (const ch of trailPattern) perEventCounts[ch]++;

        const streakBuckets = {};
        for (const ch of trailChars) {
            const count = perEventCounts[ch] * maxEvents;
            const positions = new Float32Array(count * 3);
            const colors = new Float32Array(count * 3);
            positions.fill(10000);
            const posAttr = new THREE.BufferAttribute(positions, 3);
            const colorAttr = new THREE.BufferAttribute(colors, 3);
            posAttr.setUsage(THREE.DynamicDrawUsage);
            colorAttr.setUsage(THREE.DynamicDrawUsage);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', posAttr);
            geometry.setAttribute('color', colorAttr);
            const material = new THREE.PointsMaterial({
                size: ch === '*' ? (SMALL ? 0.36 : 0.32) :
                    ch === '+' ? 0.24 : ch === '=' ? 0.20 : ch === '-' ? 0.16 : 0.11,
                map: createCharTexture(ch, '#ffffff'),
                vertexColors: true,
                alphaTest: 0.02,
                transparent: true,
                depthWrite: false
            });
            const points = new THREE.Points(geometry, material);
            points.frustumCulled = false;
            points.visible = false;
            streakBuckets[ch] = { positions, colors, posAttr, colorAttr, points };
            scene.add(points);
        }

        const slotRefs = Array.from({ length: maxEvents }, () => []);
        for (let eventIndex = 0; eventIndex < maxEvents; eventIndex++) {
            const occurrence = {};
            for (const ch of trailChars) occurrence[ch] = 0;
            for (let trailIndex = 0; trailIndex < trailLength; trailIndex++) {
                const ch = trailPattern[trailIndex];
                slotRefs[eventIndex][trailIndex] = {
                    ch,
                    pointIndex: eventIndex * perEventCounts[ch] + occurrence[ch]++
                };
            }
        }

        const events = Array.from({ length: maxEvents }, () => ({
            active: false,
            type: 'shooting',
            age: 0,
            duration: 0,
            startRadius: 0,
            x: 0, y: 0, z: 0,
            vx: 0, vy: 0, vz: 0,
            historyClock: 0,
            history: new Float32Array(trailLength * 3)
        }));
        const shootColor = new THREE.Color();
        const headColor = new THREE.Color();
        const tailColor = new THREE.Color();

        function retint() {
            shootColor.set(palette().streak);
            headColor.set(palette().streakHead);
            tailColor.set(palette().streakTail);
        }
        retint();

        function resetHistory(event) {
            for (let i = 0; i < trailLength; i++) {
                event.history[i * 3] = event.x;
                event.history[i * 3 + 1] = event.y;
                event.history[i * 3 + 2] = event.z;
            }
            event.historyClock = 0;
        }

        function spawnShootingStar() {
            const event = events[0];
            if (event.active) return false;
            const side = Math.random() < 0.5 ? -1 : 1;
            const skyReach = SMALL ? 6.4 : 14.5;
            event.active = true;
            event.type = 'shooting';
            event.age = 0;
            event.duration = 2.4;
            event.x = side * skyReach;
            event.y = (2.8 + Math.random() * (SMALL ? 3.5 : 4.5)) * (Math.random() < 0.84 ? 1 : -1);
            event.z = -2.5 + Math.random() * 4;
            event.vx = -side * (SMALL ? 7.2 + Math.random() * 1.5 : 13 + Math.random() * 2.5);
            event.vy = -Math.sign(event.y) * (0.9 + Math.random() * 1.25);
            event.vz = (Math.random() - 0.5) * 0.18;
            resetHistory(event);
            return true;
        }

        const castPoint = new THREE.Vector3();
        const castDirection = new THREE.Vector3();
        function castFromScreen(clientX, clientY, activeCamera) {
            if (REDUCED) return false;
            const event = events[1];
            if (event.active) return false;

            castPoint.set(
                (clientX / window.innerWidth) * 2 - 1,
                -(clientY / window.innerHeight) * 2 + 1,
                0.2
            ).unproject(activeCamera);
            castDirection.copy(castPoint).sub(activeCamera.position).normalize();
            const distance = -activeCamera.position.z / castDirection.z;
            castPoint.copy(activeCamera.position).add(castDirection.multiplyScalar(distance));

            let radius = Math.hypot(castPoint.x, castPoint.y, castPoint.z);
            if (radius < 3.2) {
                const angle = radius > 0.05
                    ? Math.atan2(castPoint.y, castPoint.x)
                    : Math.random() * Math.PI * 2;
                castPoint.set(Math.cos(angle) * 3.2, Math.sin(angle) * 3.2, 0);
                radius = 3.2;
            } else if (radius > 13) {
                castPoint.multiplyScalar(13 / radius);
                radius = 13;
            }

            const nx = castPoint.x / radius;
            const ny = castPoint.y / radius;
            const nz = castPoint.z / radius;
            const orbitDirection = Math.random() < 0.5 ? -1 : 1;
            event.active = true;
            event.type = 'meteor';
            event.age = 0;
            event.duration = 2;
            event.startRadius = radius;
            event.x = castPoint.x;
            event.y = castPoint.y;
            event.z = castPoint.z;
            event.vx = -nx * 0.95 + (-ny) * 1.25 * orbitDirection;
            event.vy = -ny * 0.95 + nx * 1.25 * orbitDirection;
            event.vz = -nz * 0.72;
            resetHistory(event);
            return true;
        }

        function shiftHistory(event, x, y, z) {
            for (let i = trailLength - 1; i > 0; i--) {
                event.history[i * 3] = event.history[(i - 1) * 3];
                event.history[i * 3 + 1] = event.history[(i - 1) * 3 + 1];
                event.history[i * 3 + 2] = event.history[(i - 1) * 3 + 2];
            }
            event.history[0] = x;
            event.history[1] = y;
            event.history[2] = z;
        }

        function updateEvent(event, dt, gravity) {
            const previousX = event.x;
            const previousY = event.y;
            const previousZ = event.z;
            const radiusSquared = event.x * event.x + event.y * event.y + event.z * event.z;
            const radius = Math.sqrt(radiusSquared);
            const pull = event.type === 'meteor'
                ? (7 + gravity * 5.5) / Math.max(radiusSquared, 1.2)
                : (0.45 + gravity * 1.4) / Math.max(radiusSquared, 5);
            const invRadius = 1 / Math.max(radius, 0.001);
            event.vx -= event.x * invRadius * pull * dt;
            event.vy -= event.y * invRadius * pull * dt;
            event.vz -= event.z * invRadius * pull * dt;

            if (event.type === 'meteor') {
                const drag = Math.exp(-(0.05 + gravity * 0.025) * dt);
                event.vx *= drag;
                event.vy *= drag;
                event.vz *= drag;
            }

            event.x += event.vx * dt;
            event.y += event.vy * dt;
            event.z += event.vz * dt;
            event.age += dt;

            // Keep the orbiting angle from the velocity, but guarantee a cast
            // reaches the horizon before its two-second trail expires.
            if (event.type === 'meteor') {
                const captureRadius = EVENT_HORIZON + 0.1;
                const progress = Math.min(1, event.age / event.duration);
                const targetRadius = captureRadius +
                    (event.startRadius - captureRadius) * Math.pow(1 - progress, 1.35);
                const rawRadius = Math.hypot(event.x, event.y, event.z);
                if (rawRadius > 0.0001) {
                    const scale = targetRadius / rawRadius;
                    event.x *= scale;
                    event.y *= scale;
                    event.z *= scale;
                }
            }

            const historyStep = event.type === 'meteor' ? 0.06 : 0.022;
            let sampleAt = historyStep - event.historyClock;
            while (sampleAt <= dt + 0.000001) {
                const sampleT = Math.min(1, sampleAt / dt);
                shiftHistory(
                    event,
                    previousX + (event.x - previousX) * sampleT,
                    previousY + (event.y - previousY) * sampleT,
                    previousZ + (event.z - previousZ) * sampleT
                );
                sampleAt += historyStep;
            }
            event.historyClock = (event.historyClock + dt) % historyStep;

            const nextRadius = Math.hypot(event.x, event.y, event.z);
            if (nextRadius <= EVENT_HORIZON + 0.18) {
                event.active = false;
            } else if (
                event.age >= event.duration ||
                Math.abs(event.x) > 24 || Math.abs(event.y) > 18 || Math.abs(event.z) > 18
            ) event.active = false;
        }

        function writeStreakBuffers() {
            for (const ch of trailChars) {
                streakBuckets[ch].positions.fill(10000);
                streakBuckets[ch].colors.fill(0);
            }
            events.forEach((event, eventIndex) => {
                if (!event.active) return;
                for (let trailIndex = 0; trailIndex < trailLength; trailIndex++) {
                    const ref = slotRefs[eventIndex][trailIndex];
                    const bucket = streakBuckets[ref.ch];
                    const offset = ref.pointIndex * 3;
                    const historyOffset = trailIndex * 3;
                    bucket.positions[offset] = event.history[historyOffset];
                    bucket.positions[offset + 1] = event.history[historyOffset + 1];
                    bucket.positions[offset + 2] = event.history[historyOffset + 2];
                    const tailT = trailIndex / (trailLength - 1);
                    const brightness = 1 - tailT * 0.78;
                    if (event.type === 'meteor') {
                        const mix = tailT * 0.82;
                        bucket.colors[offset] = (headColor.r * (1 - mix) + tailColor.r * mix) * brightness;
                        bucket.colors[offset + 1] = (headColor.g * (1 - mix) + tailColor.g * mix) * brightness;
                        bucket.colors[offset + 2] = (headColor.b * (1 - mix) + tailColor.b * mix) * brightness;
                    } else {
                        bucket.colors[offset] = shootColor.r * brightness;
                        bucket.colors[offset + 1] = shootColor.g * brightness;
                        bucket.colors[offset + 2] = shootColor.b * brightness;
                    }
                }
            });
            for (const ch of trailChars) {
                streakBuckets[ch].posAttr.needsUpdate = true;
                streakBuckets[ch].colorAttr.needsUpdate = true;
                streakBuckets[ch].points.visible = true;
            }
        }

        let nextShooting = 3.5;
        function update(dt, gravity) {
            if (REDUCED) return;
            nextShooting -= dt;
            if (nextShooting <= 0) {
                if (spawnShootingStar()) nextShooting = 4 + Math.random() * 4;
                else nextShooting = 1.5;
            }
            for (const event of events) {
                if (event.active) updateEvent(event, dt, gravity);
            }
            if (events.some((event) => event.active)) {
                writeStreakBuffers();
            } else {
                for (const ch of trailChars) streakBuckets[ch].points.visible = false;
            }
        }

        return { update, retint, castFromScreen };
    }

    const skyEvents = createSkyEvents();

    // ---------------------------------------------------------- theme ----
    // Toggled by clicking the black hole's core (see the canvas click handler).
    function toggleTheme() {
        theme = theme === 'dark' ? 'light' : 'dark';
        applyCssTheme();
        sceneBg.set(palette().bg);
        retintMaterials();
        skyEvents.retint();
    }

    // --------------------------------------------------------- panels ----
    const panels = {
        about: document.getElementById('panel-about'),
        projects: document.getElementById('panel-projects'),
        resume: document.getElementById('panel-resume'),
        github: document.getElementById('panel-github'),
        linkedin: document.getElementById('panel-linkedin'),
        email: document.getElementById('panel-email')
    };
    let lastFocus = null;
    let panelOpen = false;

    function openPanel(name) {
        if (!panels[name]) return;
        lastFocus = document.activeElement;
        document.body.classList.add('panel-open');
        for (const key in panels) {
            const open = key === name;
            panels[key].classList.toggle('open', open);
            panels[key].setAttribute('aria-hidden', String(!open));
        }
        document.querySelectorAll('[data-panel]').forEach((button) => {
            button.setAttribute('aria-expanded', String(button.dataset.panel === name));
        });
        panels[name].querySelector('.panel-close').focus({ preventScroll: true });
        panelOpen = true;
    }

    function closePanels() {
        let wasOpen = false;
        for (const key in panels) {
            if (panels[key].classList.contains('open')) wasOpen = true;
            panels[key].classList.remove('open');
            panels[key].setAttribute('aria-hidden', 'true');
        }
        document.querySelectorAll('[data-panel]').forEach((button) => {
            button.setAttribute('aria-expanded', 'false');
        });
        document.body.classList.remove('panel-open');
        panelOpen = false;
        if (wasOpen && lastFocus && document.contains(lastFocus)) {
            lastFocus.focus({ preventScroll: true });
        }
    }

    document.querySelectorAll('[data-panel]').forEach((btn) => {
        btn.addEventListener('click', () => openPanel(btn.dataset.panel));
    });
    document.querySelectorAll('.panel-close').forEach((btn) => {
        btn.addEventListener('click', closePanels);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closePanels(); return; }
        if (panelOpen) return;  // let the open panel keep the keyboard

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            kbIndex = (kbIndex + 1) % orbitingPlanets.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            kbIndex = (kbIndex - 1 + orbitingPlanets.length) % orbitingPlanets.length;
        } else if ((e.key === 'Enter' || e.key === ' ') && hoveredWord) {
            e.preventDefault();
            navActivate(hoveredWord);
            return;
        } else {
            return;
        }
        e.preventDefault();
        keyboardNav = true;
        document.body.classList.add('on-canvas');  // reveal the reticle/label
        setHoveredWord(orbitingPlanets[kbIndex].word);
    });
    document.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('.panel') && !e.target.closest('.links')) closePanels();
    });

    // -------------------------------------------- pointer & galaxy nav ----
    let targetPointerX = 0, targetPointerY = 0;
    let pointerX = 0, pointerY = 0;
    let pointerPxX = -100, pointerPxY = -100;
    let pointerSeen = false;
    let pointerDown = false;
    let keyboardNav = false;  // arrow-key planet focus; mouse movement reclaims hover
    let kbIndex = -1;

    function setPointer(clientX, clientY) {
        targetPointerX = Math.max(-1, Math.min(1, (clientX - window.innerWidth / 2) / (window.innerWidth / 2)));
        targetPointerY = Math.max(-1, Math.min(1, (clientY - window.innerHeight / 2) / (window.innerHeight / 2)));
        pointerPxX = clientX;
        pointerPxY = clientY;
        pointerSeen = true;
    }

    document.addEventListener('mousemove', (e) => {
        keyboardNav = false;  // pointer reclaims hover control
        setPointer(e.clientX, e.clientY);
        // The reticle only lives over the void itself; chrome keeps the
        // native cursor.
        document.body.classList.toggle('on-canvas', e.target === renderer.domElement);
    });
    document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) setPointer(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    // Press and hold the void to engage: the camera parallax follows the
    // pointer and gravity surges, feeding the black hole. Release to let the
    // view glide back to center and the disk settle into its slow drain.
    renderer.domElement.addEventListener('pointerdown', (e) => {
        pointerDown = true;
        feedTarget = 3.6;
        document.body.classList.add('dragged');
        setPointer(e.clientX, e.clientY);
    });
    function releasePointer() { pointerDown = false; feedTarget = 1; }
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);
    window.addEventListener('blur', releasePointer);

    // Scroll to dolly toward / away from the horizon.
    let dolly = 1, dollyTarget = 1;
    window.addEventListener('wheel', (e) => {
        dollyTarget = Math.max(0.78, Math.min(1.35, dollyTarget + e.deltaY * 0.0009));
    }, { passive: true });

    // Picking happens in screen space: each planet's centre is projected to
    // pixels and the nearest planet within reach (minus its on-screen radius)
    // wins. Pixel-based reach stays accurate at any dolly distance, and the
    // release radius is wider than the grab radius so a hovered planet doesn't
    // flicker as the spinning ring drifts under the cursor.
    const PICK_RADIUS = SMALL ? 40 : 28;
    const PICK_RELEASE = SMALL ? 64 : 52;
    const pickV = new THREE.Vector3();
    let hoveredWord = null;
    let hoveredCore = false;

    // The black hole's shadow projected to screen — used both to highlight the
    // core on hover and to toggle the theme on click. Origin is the system
    // centre, and the camera always looks at it, so depth is just its distance.
    function overCore(px, py) {
        const halfV = Math.tan((FOV * Math.PI) / 360);
        const depth = camera.position.length();
        const screenR = (EVENT_HORIZON / (2 * depth * halfV)) * window.innerHeight;
        pickV.set(0, 0, 0).project(camera);
        const dx = (pickV.x + 1) * window.innerWidth / 2 - px;
        const dy = (1 - pickV.y) * window.innerHeight / 2 - py;
        return Math.hypot(dx, dy) <= screenR;
    }

    function pickWord(px, py) {
        let bestWord = null, bestD = Infinity;
        const halfV = Math.tan((FOV * Math.PI) / 360);
        for (const p of orbitingPlanets) {
            pickV.setFromMatrixPosition(p.group.matrixWorld);
            const depth = camera.position.distanceTo(pickV);
            const screenR = (p.size / (2 * depth * halfV)) * window.innerHeight;
            pickV.project(camera);
            if (pickV.z > 1) continue; // behind the camera
            const dx = (pickV.x + 1) * window.innerWidth / 2 - px;
            const dy = (1 - pickV.y) * window.innerHeight / 2 - py;
            const d = Math.max(0, Math.hypot(dx, dy) - screenR);
            if (d < bestD) { bestD = d; bestWord = p.word; }
        }
        const reach = bestWord && bestWord === hoveredWord ? PICK_RELEASE : PICK_RADIUS;
        return bestD <= reach ? bestWord : null;
    }

    // Hovering a nav word burns it to full white, swells it slightly, eases
    // the galaxy's spin down so it holds still, and flags the body so the
    // reticle can react and the terminal label can name the destination.
    const reticleEl = document.querySelector('.reticle');
    const labelEl = document.getElementById('reticle-label');
    let reticleX = -100, reticleY = -100;

    function setHoveredWord(word) {
        if (word === hoveredWord) return;
        hoveredWord = word;
        for (const points of navPickList) {
            const hot = points.userData.word === word;
            points.material = (hot ? navHotMats : navMats)[points.userData.ch];
        }
        document.body.classList.toggle('nav-hover', !!word);
        if (labelEl) labelEl.textContent = word ? '> ' + word : '';
    }

    // Hovering the core swells the photon ring the same way a planet swells
    // (see the animate loop) — no label, just the pulse.
    function setHoveredCore(on) {
        hoveredCore = on;
    }

    function navActivate(word) {
        const destination = document.querySelector(`[data-sky-destination="${word}"]`);
        if (destination) destination.click();
    }

    renderer.domElement.addEventListener('click', (e) => {
        const word = pickWord(e.clientX, e.clientY);
        if (word) { navActivate(word); return; }
        if (overCore(e.clientX, e.clientY)) { toggleTheme(); return; }
        skyEvents.castFromScreen(e.clientX, e.clientY, camera);
    });

    document.getElementById('nametext').textContent = NAME.toLowerCase();

    // -------------------------------------------------------- animate ----
    const clock = new THREE.Clock();
    const MAX_AZIMUTH = 0.30;
    const MAX_ELEVATION = 0.22;
    const POINTER_EASE = 3.0;
    const motionK = REDUCED ? 0.3 : 1;
    let spinScale = REDUCED ? 0 : 1;
    let introDone = REDUCED;
    let elapsed = 0;

    if (REDUCED) camera.position.set(0, 0, camDist);

    let rafId = null;
    function animate() {
        rafId = requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.1);
        elapsed += dt;

        const galaxyBrightnessTarget = hoveredWord && !panelOpen
            ? GALAXY_HOVER_BRIGHTNESS
            : 1;
        galaxyBrightness = REDUCED ? galaxyBrightnessTarget :
            galaxyBrightness + (galaxyBrightnessTarget - galaxyBrightness) *
                (1 - Math.exp(-GALAXY_HOVER_EASE * dt));
        applyGalaxyBrightness(galaxyBrightness);

        const spinTarget = REDUCED ? 0 : (hoveredWord || panelOpen ? 0.18 : 1);
        spinScale += (spinTarget - spinScale) * (1 - Math.exp(-4 * dt));
        ringSpin.rotation.y -= RING_SPIN * spinScale * dt;

        feedScale += (feedTarget - feedScale) * (1 - Math.exp(-3.5 * dt));
        dolly += (dollyTarget - dolly) * (1 - Math.exp(-3 * dt));

        updateAccretionDisk(dt * Math.max(motionK, 0.3));
        skyEvents.update(dt, Math.max(0, feedScale - 1));

        // Spin each planet on its local axis; the hovered one swells a touch.
        orbitingPlanets.forEach((p, index) => {
            const spinBoost = hoveredWord === p.word ? 1.6 : 1;
            p.group.rotation.y += (0.2 + index * 0.05) * spinBoost * dt * motionK;
            const scaleTarget = hoveredWord === p.word ? 1.18 : 1;
            const s = p.group.scale.x + (scaleTarget - p.group.scale.x) * (1 - Math.exp(-6 * dt));
            p.group.scale.setScalar(s);
        });

        // The core pulses the same way a planet does when hovered.
        const coreTarget = hoveredCore ? 1.18 : 1;
        const cs = photonRing.scale.x + (coreTarget - photonRing.scale.x) * (1 - Math.exp(-6 * dt));
        photonRing.scale.setScalar(cs);

        starGroup.rotation.y -= 0.025 * dt * motionK;
        starGroup.rotation.x -= 0.010 * dt * motionK;

        // Gentle starlight shimmer, staggered per glyph bucket.
        if (!REDUCED) {
            for (let i = 0; i < starCharSet.length; i++) {
                starMats[starCharSet[i]].opacity = 0.82 + 0.18 * Math.sin(elapsed * 1.1 + i * 1.9);
            }
        }

        if (introDone) {
            if (!REDUCED) {
                // Parallax only while the pointer is held; on release the
                // view eases back to dead center.
                const wantX = pointerDown ? targetPointerX : 0;
                const wantY = pointerDown ? targetPointerY : 0;
                const pointerK = 1 - Math.exp(-2.5 * dt);
                pointerX += (wantX - pointerX) * pointerK;
                pointerY += (wantY - pointerY) * pointerK;
            }

            const azimuth = pointerX * MAX_AZIMUTH;
            const elevation = -pointerY * MAX_ELEVATION;
            const dist = camDist * dolly;

            const cosE = Math.cos(elevation);
            const desiredX = dist * Math.sin(azimuth) * cosE;
            const desiredY = dist * Math.sin(elevation);
            const desiredZ = dist * Math.cos(azimuth) * cosE;

            const k = 1 - Math.exp(-POINTER_EASE * dt);
            camera.position.x += (desiredX - camera.position.x) * k;
            camera.position.y += (desiredY - camera.position.y) * k;
            camera.position.z += (desiredZ - camera.position.z) * k;

            if (keyboardNav && hoveredWord) {
                // Park the reticle on the keyboard-focused planet.
                const kp = orbitingPlanets.find((p) => p.word === hoveredWord);
                if (kp) {
                    pickV.setFromMatrixPosition(kp.group.matrixWorld);
                    pickV.project(camera);
                    pointerPxX = (pickV.x + 1) * window.innerWidth / 2;
                    pointerPxY = (1 - pickV.y) * window.innerHeight / 2;
                }
            } else if (pointerSeen) {
                const w = pickWord(pointerPxX, pointerPxY);
                setHoveredWord(w);
                setHoveredCore(!w && overCore(pointerPxX, pointerPxY));
            }
        } else {
            // Snappy visual intro zoom effect
            const introSpeed = 5;
            const k = 1 - Math.exp(-introSpeed * dt);

            camera.position.x += (0 - camera.position.x) * k;
            camera.position.y += (0 - camera.position.y) * k;
            camera.position.z += (camDist - camera.position.z) * k;

            if (Math.abs(camera.position.z - camDist) < 0.35) introDone = true;
        }
        camera.lookAt(scene.position);

        // Reticle trails the pointer with a touch of lag — instrument-like.
        if (reticleEl) {
            const rk = 1 - Math.exp(-22 * dt);
            reticleX += (pointerPxX - reticleX) * rk;
            reticleY += (pointerPxY - reticleY) * rk;
            reticleEl.style.transform = `translate3d(${reticleX}px, ${reticleY}px, 0)`;
        }

        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        camDist = cameraDistance();
    });

    // Stop the loop while the tab is backgrounded; resume cleanly without a
    // delta-time jump.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        } else if (rafId === null) {
            clock.getDelta();  // discard the gap so dt stays small
            animate();
        }
    });

    animate();
    document.body.classList.add('loaded');
})();
