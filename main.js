// Import biblioteki Three.js oraz dodatkowego generatora szumu (do terenu)
import * as THREE from './libs/three.module.js';
import { ImprovedNoise } from './libs/ImprovedNoise.js';

// --- SCENA I RENDERER ---
const scene = new THREE.Scene(); // Tworzenie nowej sceny 3D
scene.fog = new THREE.Fog(0x222222, 15, 40); // Dodanie mgły – kolor i zakres widoczności
scene.background = new THREE.Color(0x101010); // Ustawienie tła sceny


// --- KAMERA GRACZA ---
const playerCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100); // Perspektywiczna kamera (kąt, proporcje, near, far)
const yawPivot = new THREE.Object3D(); // Obiekt pomocniczy do obrotu w osi Y (lewo/prawo)
const pitchPivot = new THREE.Object3D(); // Obiekt pomocniczy do obrotu w osi X (góra/dół)
yawPivot.add(pitchPivot); // pitchPivot zagnieżdżony w yawPivot
pitchPivot.add(playerCamera); // Kamera zagnieżdżona w pitchPivot – umożliwia obrót w dwóch osiach
playerCamera.position.set(0, 0.4, 0); // Ustawienie pozycji kamery względem gracza

// Obiekt reprezentujący gracza (eksploratora)
const explorer = new THREE.Object3D(); 
explorer.position.set(0, 0, 0);
explorer.add(yawPivot); 
scene.add(explorer);


// --- RENDERER ---
const renderer = new THREE.WebGLRenderer({ antialias: true }); // Tworzenie renderera z wygładzaniem krawędzi
renderer.setSize(window.innerWidth, window.innerHeight); // Ustawienie rozmiaru renderera na rozmiar okna
renderer.shadowMap.enabled = true; // Włączenie cieni
document.body.appendChild(renderer.domElement); // Dodanie canvasu do strony


// --- OŚWIETLENIE ---
const sun = new THREE.DirectionalLight(0xfff2aa, 1); // Światło kierunkowe (imitujące słońce)
sun.castShadow = true;
sun.position.set(10, 10, 0); 
scene.add(sun);
scene.add(new THREE.AmbientLight(0x404040));


// --- TEREN ---
// Rozmiar terenu i rozdzielczość (ilość podziałów)
const terrainWidth = 50;
const terrainHeight = 50;
const resolution = 64;

const geom = new THREE.PlaneGeometry(terrainWidth, terrainHeight, resolution, resolution); // Tworzenie siatki płaszczyzny
geom.rotateX(-Math.PI / 2); // Obrót płaszczyzny, by była pozioma
const noise = new ImprovedNoise(); // Generator szumu
const seed = Math.random() * 100; // Losowe ziarno szumu
const positions = geom.attributes.position; // Dostęp do pozycji wierzchołków

// Modyfikacja wysokości wierzchołków za pomocą szumu (tworzenie fal)
for (let i = 0; i < positions.count; i++) {
  const x = positions.getX(i);
  const z = positions.getZ(i);
  positions.setY(i, noise.noise(x / 10, z / 10, seed) * 2);
}
geom.computeVertexNormals(); // Obliczenie normalnych po modyfikacji siatki

const lavaTexture = new THREE.TextureLoader().load('./textures/lava1.avif'); // Załadowanie tekstury lawy
lavaTexture.wrapS = lavaTexture.wrapT = THREE.RepeatWrapping; // Powtarzanie tekstury
lavaTexture.repeat.set(terrainWidth / 4, terrainHeight / 4); // Skalowanie powtarzania

const terrainMat = new THREE.MeshStandardMaterial({ map: lavaTexture }); // Materiał terenu z teksturą


// Modyfikacja shaderów materiału – animacja falowania terenu
terrainMat.onBeforeCompile = shader => {
  shader.uniforms.time = { value: 0 }; // Dodanie uniformu time (potrzebny do animacji)
  // Dodanie uniformu do vertex shader
  shader.vertexShader = shader.vertexShader.replace(
    'void main() {',
    'uniform float time; void main() {'
  ).replace(
    '#include <begin_vertex>',
    `vec3 transformed = vec3(position);
     float w1 = sin((position.x + time * 2.0) * 0.3) * 0.4;
     float w2 = cos((position.z - time * 1.5) * 0.4) * 0.3;
     float w3 = sin((position.x + position.z + time) * 0.2) * 0.2;
     transformed.y += w1 + w2 + w3;`
  );
  terrainMat.userData.shader = shader; // Zapis shaderów, by móc później zaktualizować time
};

// Tworzenie siatki terenu
const terrain = new THREE.Mesh(geom, terrainMat);
terrain.receiveShadow = true;

scene.add(terrain);


// --- RUINY ---
// Ładowanie tekstury budynków
const buildingTex = new THREE.TextureLoader().load('./textures/skyscraper.jpg');
buildingTex.wrapS = buildingTex.wrapT = THREE.RepeatWrapping;
buildingTex.repeat.set(1, 3);

// Grupa ruin
const ruins = new THREE.Group();

const buildingMat = new THREE.MeshStandardMaterial({ map: buildingTex, bumpMap: buildingTex, bumpScale: 0.1 }); // Materiał z teksturą i efektem wypukłości (bump)

// Generowanie wielu ruin (losowe pozycje, wysokości)
for (let i = 0; i < 80; i++) {
  const height = 4 + Math.random() * 6;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, height, 1.5), buildingMat);
  mesh.position.set(Math.random() * 40 - 20, 0, Math.random() * 40 - 20);

  // Dopasowanie wysokości do terenu
  const tx = Math.floor((mesh.position.x + terrainWidth / 2) / terrainWidth * resolution);
  const tz = Math.floor((mesh.position.z + terrainHeight / 2) / terrainHeight * resolution);
  const y = positions.getY(tz * (resolution + 1) + tx);
  mesh.position.y = y + height / 2;

  mesh.castShadow = mesh.receiveShadow = true; // Cienie
  
  ruins.add(mesh); // Dodanie budynku do grupy
}

scene.add(ruins); // Dodanie ruin do sceny


// --- ŚWIETLIKI ---
// Tablica do przechowywania świetlików
const wisps = [];
const WISP_AREA = 40; // rozmiar obszaru


// Tworzenie 5 świetlików
for (let i = 0; i < 5; i++) {
  // Kula + materiał z przezroczystością
  const wisp = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 12, 12),
    new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8
    })
  );

  // Światło punktowe
  const light = new THREE.PointLight(0x00ffff, 0.6, 4);
  light.castShadow = true;
  wisp.add(light);

  // Rozrzucenie po całej mapie
  const x = Math.random() * WISP_AREA - WISP_AREA / 2;
  const z = Math.random() * WISP_AREA - WISP_AREA / 2;
  const y = 1.5 + Math.random() * 1;
  wisp.position.set(x, y, z);

  // Dane pomocnicze
  wisp.userData = {
    baseX: x,
    baseZ: z,
    phase: Math.random() * Math.PI * 2
  };

  wisps.push(wisp);
  scene.add(wisp);
}


// --- MGŁA ---
// Ładowanie tekstury dymu
const smokeTexture = new THREE.TextureLoader().load('./textures/smoke.png');
const smokeGroup = new THREE.Group();

// Tworzenie wielu półprzezroczystych sprite’ów
for (let i = 0; i < 600; i++) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ 
	map: smokeTexture, 
	transparent: true, 
	opacity: 0.15, 
	depthWrite: false, 
	depthTest: true 
  }));

  // Pozycja
  sprite.position.set(Math.random() * terrainWidth - terrainWidth / 2, Math.random() * 6 + 0.5, Math.random() * terrainHeight - terrainHeight / 2);
  
  // Skalowanie
  const scale = 2 + Math.random();
  sprite.scale.set(scale, scale, 1);

  // Ruch pionowy i kołysanie
  sprite.userData = { riseSpeed: 0.003 + Math.random() * 0.007, swayPhase: Math.random() * Math.PI * 2 };
  
  smokeGroup.add(sprite);
}
scene.add(smokeGroup);


// --- DUCHY ---
// Tablica przechowująca duszki w scenie
const ghosts = []; 

function spawnGhost() {
  // Materiał dla ducha — kolor jasnoniebieski, przezroczysty, na początek niewidoczny (opacity 0)
  const mat = new THREE.MeshBasicMaterial({
    color: 0xccccff,
    transparent: true,
    opacity: 0.0, 
    depthWrite: false // brak głębokości, żeby zapobiec błędom renderowania
  });

  // Siatka duszka w kształcie kuli o promieniu 0.5 i wysokiej jakości siatce (16 segmentów)
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16),
    mat
  );

  // Światło punktowe o tym samym kolorze, zasięgu 6 i natężeniu 0.8
  const light = new THREE.PointLight(0xccccff, 0.8, 6);
  mesh.add(light); // światło jest dzieckiem ducha (będzie podążać za nim)

  // Losowa pozycja stratowa ducha
  const x = Math.random() * 40 - 20;
  const z = Math.random() * 40 - 20;
  const y = 2 + Math.random() * 2;
  mesh.position.set(x, y, z);

  // Dodatkowe dane sterujące ruchem ducha w userData
  mesh.userData = {
    baseY: y, // baza pozycji Y (do pływającego bujania)
    floatPhase: Math.random() * Math.PI * 2, // faza sinusoidy dla efektu bujania
    direction: new THREE.Vector3( // kierunek ruchu (losowy, znormalizowany wektor 2D XZ)
      Math.random() - 0.5,
      0,
      Math.random() - 0.5
    ).normalize(),
    speed: 0.02 + Math.random() * 0.03, // prędkość ruchu ducha
    fade: 0, // wartość przezroczystości (będzie animowana)
    fadingIn: true, // czy duch się pojawia (true) czy znika (false)
    timeToTeleport: 3 + Math.random() * 5 // czas do kolejnej teleportacji ducha
  };

  ghosts.push(mesh);
  scene.add(mesh);
}

for (let i = 0; i < 10; i++) spawnGhost(); // 10 duchow od razu na starcie się tworzy


// --- STEROWANIE ---
const keys = {}; // Obiekt do przechowywania aktualnego stanu klawiszy (wciśnięty/nie)

// Nasłuchujemy wciśnięcia klawisza — ustawiamy jego stan na true
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
});

// Nasłuchujemy puszczenia klawisza — ustawiamy jego stan na false
window.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

let yaw = 0; // aktualny kąt obrotu wokół osi Y (obrót lewo/prawo)
let pitch = 0; // aktualny kąt obrotu wokół osi X (obrót góra/dół)

// Prędkości kątowe
let angularVelocityYaw = 0;
let angularVelocityPitch = 0;

// Prędkości liniowe w osiach lokalnych
const velocity = new THREE.Vector3(0, 0, 0);

const maxAngularSpeed = 0.05; // max prędkość obrotu (radiany/frame)
const angularAcceleration = 0.005; // jak szybko zmienia się prędkość obrotu

const maxMoveSpeed = 0.05; // max prędkość ruchu (jednostki/frame)
//const moveAcceleration = 0.01; // przyspieszenie ruchu

// Funkcja aktualizująca obroty kamery na podstawie wciśniętych klawiszy
function updateRotationFromKeys() {
  // Obrót YAW (lewo/prawo)
  if (keys['arrowleft']) {
    angularVelocityYaw += angularAcceleration; // zwiększamy prędkość obrotu w lewo
  } else if (keys['arrowright']) {
    angularVelocityYaw -= angularAcceleration; // zwiększamy prędkość obrotu w prawo
  } else {
    // stopniowe wyhamowanie
    angularVelocityYaw *= 0.8;
    if (Math.abs(angularVelocityYaw) < 0.001) angularVelocityYaw = 0; //zerujemy, gdy prędkość bliska 0
  }

  // Obrót PITCH (góra/dół)
  if (keys['arrowup']) {
    angularVelocityPitch += angularAcceleration; // zwiększamy prędkość obrotu w górę
  } else if (keys['arrowdown']) {
    angularVelocityPitch -= angularAcceleration; // zwiększamy prędkość obrotu w dół
  } else {
	// stopniowe wyhamowanie
    angularVelocityPitch *= 0.8;
    if (Math.abs(angularVelocityPitch) < 0.001) angularVelocityPitch = 0;
  }

  // Ograniczamy prędkość obrotu do maksymalnych wartości
  angularVelocityYaw = THREE.MathUtils.clamp(angularVelocityYaw, -maxAngularSpeed, maxAngularSpeed);
  angularVelocityPitch = THREE.MathUtils.clamp(angularVelocityPitch, -maxAngularSpeed, maxAngularSpeed);

  // Aktualizujemy kąty yaw i pitch o prędkości obrotu
  yaw += angularVelocityYaw;
  pitch += angularVelocityPitch;

  // Ograniczamy pitch, żeby nie przekręcić kamery za bardzo
  pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2, Math.PI / 2);

  // Ustawiamy obrót elementów pivot kamery (yawPivot obraca wokół Y, pitchPivot wokół X)
  yawPivot.rotation.y = yaw;
  pitchPivot.rotation.x = pitch;
}

// Funkcja aktualizująca ruch kamery na podstawie wciśniętych klawiszy
function updateMovementFromKeys() {
  // Tworzymy wektor celu prędkości ruchu (0,0,0) na start
  let targetVelocity = new THREE.Vector3(0, 0, 0);

  // Ustawiamy cel prędkości na podstawie klawiszy WSAD oraz QE (ruch w 3D)
  if (keys['w']) targetVelocity.z -= maxMoveSpeed;
  if (keys['s']) targetVelocity.z += maxMoveSpeed;
  if (keys['a']) targetVelocity.x -= maxMoveSpeed;
  if (keys['d']) targetVelocity.x += maxMoveSpeed;
  if (keys['q']) targetVelocity.y += maxMoveSpeed;
  if (keys['e']) targetVelocity.y -= maxMoveSpeed;

  // Interpolujemy velocity aby płynnie przyspieszał i hamował
  velocity.x += (targetVelocity.x - velocity.x) * 0.2;
  velocity.y += (targetVelocity.y - velocity.y) * 0.2;
  velocity.z += (targetVelocity.z - velocity.z) * 0.2;

  // Przemieszczamy explorer zgodnie z prędkością i aktualnym obrotem yaw
  const moveDir = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
  moveDir.applyEuler(yawPivot.rotation);

  // Przesuwamy eksploratora o obliczony wektor ruchu
  explorer.position.add(moveDir);
}


// --- ROZMIAR OKNA ---
// Obsługa zmiany rozmiaru okna - aktualizuje rozmiar renderera i proporcje kamery
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height); // rozmiar rendera
  playerCamera.aspect = width / height; // aktualizacja proporcji kamery
  playerCamera.updateProjectionMatrix(); //macierz projekcji kamery
});














// --- ANIMACJA ---
let time = 0;  // licznik czasu animacji


function animate() {
  requestAnimationFrame(animate); // wywołujemy ponownie animate w następnej klatce

  time += 0.01; // zwiększamy czas animacji 


  // --- MGŁA ---
  // Animujemy mgłę - zmieniamy parametry near i far mgły sinusoidalnie
  scene.fog.near = 15 + Math.sin(time * 0.5) * 2;
  scene.fog.far = 40 + Math.sin(time * 0.3) * 4;

  // --- SŁOŃCE ---
  // Pozycja słońca krąży po okręgu na wysokości 10 jednostek (x,y zmieniają się wg funkcji cos i sin)
  sun.position.set(Math.cos(time) * 10, Math.sin(time) * 10, 0);
  // Natężenie światła słońca zmienia się od 0.2 do 1 zgodnie z sinusoidą
  sun.intensity = Math.max(0.2, Math.sin(time));

  // --- ŚWIETLIKI ---
  wisps.forEach(w => {
    const t = time + w.userData.phase;  // faza czasu uwzględniająca przesunięcie każdego świetlika
    w.position.set(
      w.userData.baseX + Math.sin(t * 0.5) * 0.5, // ruch w osi X wg sinusoidy
      1.5 + Math.sin(t * 2) * 0.3, // ruch w osi Y wg szybszej sinusoidy
      w.userData.baseZ + Math.cos(t * 0.5) * 0.5 // ruch w osi Z wg cosinusa
    );
  });

  // --- DYM ---
  smokeGroup.children.forEach(s => {
    s.position.y += s.userData.riseSpeed; // dym unosi się do góry
    s.position.x += Math.sin(time + s.userData.swayPhase) * 0.002; // lekko się kołysze na boki
    if (s.position.y > 10) s.position.y = 0.5; // reset pozycji dymu, gdy za wysoko
  });

  // --- DUCHY ---
  ghosts.forEach(g => {
    const u = g.userData;  // ułatwiamy dostęp do danych ducha

    // Animacja pojawiania i znikania (fade in/out)
    if (u.fadingIn) {
      u.fade += 0.01; // zwiększamy przezroczystość
      if (u.fade >= 1) { // gdy duch jest całkiem widoczny
        u.fade = 1;
        u.fadingIn = false; // zmieniamy tryb na znikanie
      }
    } else {
      u.fade -= 0.002; // zmniejszamy przezroczystość powoli
      if (u.fade <= 0) { // gdy duch jest całkiem niewidoczny
        u.fade = 0;
        u.fadingIn = true; // zmieniamy tryb na pojawianie się
        // teleportujemy ducha w losowe miejsce na mapie
        g.position.set(
          Math.random() * 40 - 20,
          2 + Math.random() * 2,
          Math.random() * 40 - 20
        );
        // losujemy nowy kierunek ruchu
        u.direction = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        // resetujemy czas do następnej teleportacji
        u.timeToTeleport = 3 + Math.random() * 5;
      }
    }

    // Ustawiamy aktualną przezroczystość materiału ducha (z maksymalną wartością 0.6)
    g.material.opacity = u.fade * 0.6;

    // Pływające bujanie ducha w osi Y wg sinusoidy (na bazie baseY i fazy)
    g.position.y = u.baseY + Math.sin(time * 2 + u.floatPhase) * 0.3;

    // Ruch ducha po mapie — przesuwamy go o wektor kierunku razy prędkość
    const move = u.direction.clone().multiplyScalar(u.speed);
    g.position.add(move);

	// Zmiana kierunku co jakiś czas
	u.timeToTeleport -= 0.016; // Zmniejszamy licznik czasu (zakładamy ~60 FPS)
	if (u.timeToTeleport < 0) {
	  u.direction = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();// Losujemy nowy kierunek ruchu na płaszczyźnie XZ
	  u.timeToTeleport = 3 + Math.random() * 5; 	// Resetujemy czas do następnej zmiany kierunku (od 3 do 8 sekund)
	}

	// Odbicie od krawędzi mapy
	const b = 22; // Granice mapy w osi X i Z
	if (g.position.x < -b || g.position.x > b) u.direction.x *= -1; // Odbijamy kierunek X
	if (g.position.z < -b || g.position.z > b) u.direction.z *= -1; // Odbijamy kierunek Z
	});


	// --- KAMERA ---
	updateRotationFromKeys(); // Aktualizacja rotacji kamery lub gracza na podstawie klawiszy
	updateMovementFromKeys(); // Aktualizacja pozycji gracza na podstawie klawiszy

    // --- RENDER ---
	// Jeśli materiał terenu ma przypisany shader, przekazujemy do niego aktualny czas
	if (terrainMat.userData.shader) {
	terrainMat.userData.shader.uniforms.time.value = time;
	}

	// Renderowanie sceny z kamerą gracza
	renderer.render(scene, playerCamera);
}


animate();


