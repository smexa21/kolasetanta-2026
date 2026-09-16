import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

let next = document.querySelector('.next')
let prev = document.querySelector('.prev')

next.addEventListener('click', function(){
    let items = document.querySelectorAll('.item')
    document.querySelector('.slide').appendChild(items[0])
})

prev.addEventListener('click', function(){
    let items = document.querySelectorAll('.item')
    document.querySelector('.slide').prepend(items[items.length - 1])
})

// Intro Screen & Three.js Logic
const introScreen = document.getElementById('intro-screen');
const enterBtn = document.getElementById('enter-btn');
const container = document.querySelector('.container');
const particleContainer = document.getElementById('particle-container');

// Create Back button inside container
const backBtn = document.createElement('button');
backBtn.textContent = 'Kembali';
backBtn.className = 'back-btn';
container.appendChild(backBtn);

// Three.js Setup
let scene, camera, renderer, composer, heartSystem, textSystem, fireworks = [], animationId;
const numHeart = 1500;
let heartGeo, heartPos, heartTarget, heartStates, heartSpeeds;
let textGeo, textPositions, numText, tPos;
let fireworkInterval;
let textOrbitAngle = 0;
let particleSprite;

const raycaster = new THREE.Raycaster();
const mouse3D = new THREE.Vector3();

function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
}

function initThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 150;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ReinhardToneMapping;
    
    particleContainer.innerHTML = ''; // clear old canvas if any
    particleContainer.appendChild(renderer.domElement);

    // Post Processing (Bloom)
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.05;
    bloomPass.strength = 1.4; // Intensity of glow
    bloomPass.radius = 0.6;
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    particleSprite = createParticleTexture();

    // -- Heart Particles --
    heartGeo = new THREE.BufferGeometry();
    heartPos = new Float32Array(numHeart * 3);
    heartTarget = new Float32Array(numHeart * 3);
    heartStates = new Float32Array(numHeart); 
    heartSpeeds = new Float32Array(numHeart);

    function outlineHeartPoint(t, scale = 3.5) {
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
        let px = x * scale * 0.98;
        let py = y * scale * 0.9 - 0.8;
        let lower = Math.min(Math.max((-4.0 - py) / 5.6, 0), 1);
        px *= 1 - lower * 0.1;
        py += lower * 0.34;
        const depth = 20 - Math.abs(px) * 0.3;
        const pz = (Math.random() - 0.5) * Math.max(0, depth) * 1.5;
        return {x: px, y: py, z: pz};
    }

    for (let i = 0; i < numHeart; i++) {
        heartPos[i*3] = (Math.random() - 0.5) * 400;
        heartPos[i*3+1] = Math.random() * 200 + 150; 
        heartPos[i*3+2] = (Math.random() - 0.5) * 200;
        
        const t = Math.random() * Math.PI * 2;
        const target = outlineHeartPoint(t, 2.5); 
        heartTarget[i*3] = target.x;
        heartTarget[i*3+1] = target.y + 20;
        heartTarget[i*3+2] = target.z;
        
        heartSpeeds[i] = Math.random() * 0.8 + 0.5;
        heartStates[i] = 0;
    }
    heartGeo.setAttribute('position', new THREE.BufferAttribute(heartPos, 3));
    
    const heartMat = new THREE.PointsMaterial({ 
        color: 0xffa500, 
        size: 2.5, 
        map: particleSprite,
        transparent: true, 
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    heartSystem = new THREE.Points(heartGeo, heartMat);
    scene.add(heartSystem);

    // -- Text Particles (25 Names Orbiting) --
    const textCanvas = document.createElement('canvas');
    const tCtx = textCanvas.getContext('2d', {willReadFrequently: true});
    const cWidth = 5000; // Large canvas for 25 names
    const cHeight = 80;
    textCanvas.width = cWidth; 
    textCanvas.height = cHeight;
    tCtx.fillStyle = 'black';
    tCtx.fillRect(0, 0, cWidth, cHeight);
    
    // Smaller font for particles
    tCtx.font = 'bold 30px sans-serif';
    tCtx.fillStyle = 'white';
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'middle';

    const names = [];
    for(let i=1; i<=25; i++) {
        names.push(`NAMA ${i}`); // User can customize this array later
    }
    const sectionWidth = cWidth / 25;
    for(let i=0; i<25; i++) {
        tCtx.fillText(names[i], i * sectionWidth + (sectionWidth/2), cHeight/2);
    }

    const imgData = tCtx.getImageData(0, 0, cWidth, cHeight).data;
    textPositions = []; // Store base cylindrical coordinates
    const orbitRadius = 60; 

    for(let y=0; y<cHeight; y+=2) { // Step size 2 for performance
        for(let x=0; x<cWidth; x+=2) {
            const index = (y * cWidth + x) * 4;
            if(imgData[index] > 128) { // If pixel is white
                const theta = (x / cWidth) * Math.PI * 2;
                const height = -(y - cHeight/2) * 0.3; 
                textPositions.push({ r: orbitRadius, theta: theta, y: height });
            }
        }
    }

    numText = textPositions.length;
    textGeo = new THREE.BufferGeometry();
    tPos = new Float32Array(numText * 3);
    for(let i=0; i<numText; i++) {
        // Start them scattered randomly
        tPos[i*3] = (Math.random()-0.5)*500;
        tPos[i*3+1] = (Math.random()-0.5)*500;
        tPos[i*3+2] = (Math.random()-0.5)*500;
    }
    textGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    
    const textMat = new THREE.PointsMaterial({ 
        color: 0xff4500, 
        size: 2.5, 
        map: particleSprite,
        transparent: true, 
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false 
    });
    textSystem = new THREE.Points(textGeo, textMat);
    scene.add(textSystem);
    
    fireworks = [];
    if(fireworkInterval) clearInterval(fireworkInterval);
    fireworkInterval = setInterval(createFirework, 1500);
}

// -- Fireworks System --
function createFirework() {
    if(introScreen.style.display === 'none' || !scene) return;
    const fwGeo = new THREE.BufferGeometry();
    const fwCount = 100;
    const fwPos = new Float32Array(fwCount * 3);
    const fwVel = [];
    const color = new THREE.Color().setHSL(Math.random(), 1, 0.5);
    const startX = (Math.random() - 0.5) * 200;
    const startY = (Math.random() - 0.5) * 100 + 50;
    const startZ = (Math.random() - 0.5) * -100 - 50;

    for(let i=0; i<fwCount; i++) {
        fwPos[i*3] = startX;
        fwPos[i*3+1] = startY;
        fwPos[i*3+2] = startZ;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        const u = Math.random() * 2 - 1;
        const r = Math.sqrt(1 - u*u);
        fwVel.push({
            x: r * Math.cos(angle) * speed,
            y: r * Math.sin(angle) * speed,
            z: u * speed
        });
    }
    fwGeo.setAttribute('position', new THREE.BufferAttribute(fwPos, 3));
    const fwMat = new THREE.PointsMaterial({ 
        color: color, 
        size: 3.5, 
        map: particleSprite,
        transparent: true, 
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false 
    });
    const fwSys = new THREE.Points(fwGeo, fwMat);
    scene.add(fwSys);
    fireworks.push({ system: fwSys, velocities: fwVel, life: 1.0 });
}

// -- Mouse Interaction --
const mouse = new THREE.Vector2(-9999, -9999);
let isMouseDown = false;
window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});
window.addEventListener('mousedown', () => isMouseDown = true);
window.addEventListener('mouseup', () => isMouseDown = false);
window.addEventListener('touchstart', (e) => {
    mouse.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
    isMouseDown = true;
});
window.addEventListener('touchend', () => isMouseDown = false);


function animate() {
    animationId = requestAnimationFrame(animate);
    if (!scene) return;
    
    // Heart
    const hPos = heartGeo.attributes.position.array;
    for (let i = 0; i < numHeart; i++) {
        if (heartStates[i] === 0) { 
            hPos[i*3+1] -= heartSpeeds[i];
            if (hPos[i*3+1] < -80 || Math.random() < 0.005) heartStates[i] = 1;
        } else {
            hPos[i*3] += (heartTarget[i*3] - hPos[i*3]) * 0.05;
            hPos[i*3+1] += (heartTarget[i*3+1] - hPos[i*3+1]) * 0.05;
            hPos[i*3+2] += (heartTarget[i*3+2] - hPos[i*3+2]) * 0.05;
        }
    }
    heartGeo.attributes.position.needsUpdate = true;
    heartSystem.rotation.y += 0.005;

    // Orbit Text Ring Angle
    textOrbitAngle -= 0.003; 

    // Text Raycaster
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), mouse3D);
    
    const txPos = textGeo.attributes.position.array;
    for(let i=0; i<numText; i++) {
        const tx = textPositions[i];
        
        // Calculate dynamic base position based on orbit angle
        const currentTheta = tx.theta + textOrbitAngle;
        const bx = tx.r * Math.cos(currentTheta);
        const by = tx.y; // Centered on Y axis vertically
        const bz = tx.r * Math.sin(currentTheta);
        
        const px = txPos[i*3], py = txPos[i*3+1], pz = txPos[i*3+2];
        const dx = mouse3D.x - px;
        const dy = mouse3D.y - py;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        const threshold = isMouseDown ? 50 : 20;
        if (dist < threshold) {
            // Scatter
            const force = (isMouseDown ? 8 : 3) / Math.max(dist, 1);
            txPos[i*3] -= dx * force;
            txPos[i*3+1] -= dy * force;
            txPos[i*3+2] += (Math.random()-0.5) * force * 15;
        } else {
            // Return to dynamic orbit position
            txPos[i*3] += (bx - px) * 0.08;
            txPos[i*3+1] += (by - py) * 0.08;
            txPos[i*3+2] += (bz - pz) * 0.08;
        }
    }
    textGeo.attributes.position.needsUpdate = true;

    // Fireworks
    for(let i=fireworks.length-1; i>=0; i--) {
        const fw = fireworks[i];
        fw.life -= 0.015;
        if(fw.life <= 0) {
            scene.remove(fw.system);
            fw.system.geometry.dispose();
            fw.system.material.dispose();
            fireworks.splice(i, 1);
            continue;
        }
        const fPos = fw.system.geometry.attributes.position.array;
        for(let j=0; j<fPos.length/3; j++) {
            fPos[j*3] += fw.velocities[j].x;
            fPos[j*3+1] += fw.velocities[j].y;
            fPos[j*3+2] += fw.velocities[j].z;
            fw.velocities[j].y -= 0.05; // Gravity
        }
        fw.system.geometry.attributes.position.needsUpdate = true;
        fw.system.material.opacity = fw.life;
    }

    if (composer) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

window.addEventListener('resize', () => {
    if(!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if(composer) composer.setSize(window.innerWidth, window.innerHeight);
});

// Initialization
initThreeJS();
animate();

        enterBtn.addEventListener('click', () => {
            const bgMusic = document.getElementById('bg-music');
            if (bgMusic && bgMusic.paused) {
                bgMusic.play().catch(e => console.log("Audio play failed:", e));
            }

            introScreen.style.opacity = '0';
            setTimeout(() => {
        introScreen.style.display = 'none';
        container.style.display = 'block';
        cancelAnimationFrame(animationId);
        clearInterval(fireworkInterval);
        
        // Clean up composer and renderer properly to avoid memory leaks
        renderer.dispose();
        scene = null;
        composer = null;
    }, 1000);
});

backBtn.addEventListener('click', () => {
    container.style.display = 'none';
    introScreen.style.display = 'flex';
    introScreen.style.opacity = '1';
    initThreeJS();
    animate();
});
