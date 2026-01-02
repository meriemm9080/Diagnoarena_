import React, { useState, useEffect, useRef, Suspense } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, increment } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

// ------------------- Firebase -------------------
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ------------------- Third Person Controller -------------------
function ThirdPersonController({ playerRef, cameraRef }) {
  const keys = useRef({});
  useEffect(() => {
    const down = e => keys.current[e.key.toLowerCase()] = true;
    const up = e => keys.current[e.key.toLowerCase()] = false;
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    }
  }, []);

  useFrame(() => {
    if(!playerRef.current || !cameraRef.current) return;
    const moveSpeed = 0.1;
    if(keys.current['w']) playerRef.current.position.z -= moveSpeed;
    if(keys.current['s']) playerRef.current.position.z += moveSpeed;
    if(keys.current['a']) playerRef.current.position.x -= moveSpeed;
    if(keys.current['d']) playerRef.current.position.x += moveSpeed;
    // Camera follows player
    cameraRef.current.position.lerp(
      {x: playerRef.current.position.x, y: playerRef.current.position.y+3, z: playerRef.current.position.z+6},
      0.1
    );
    cameraRef.current.lookAt(playerRef.current.position);
  });
  return null;
}

// ------------------- 3D Models -------------------
function Model({ path, position=[0,0,0], scale=[1,1,1] }) {
  const gltf = useLoader(GLTFLoader, path);
  return <primitive object={gltf.scene} position={position} scale={scale} />;
}

// ------------------- Screens -------------------
function Login({ onLogin }) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState("");
  return (
    <div>
      <h2>Se connecter</h2>
      <input placeholder="Email" onChange={e=>setEmail(e.target.value)} />
      <input type="password" placeholder="Mot de passe" onChange={e=>setPass(e.target.value)} />
      <button onClick={async ()=>{
        try { await signInWithEmailAndPassword(auth,email,pass); onLogin(); }
        catch(e){ setErr("Email ou mot de passe incorrect"); }
      }}>Se connecter</button>
      {err && <p style={{color:"red"}}>{err}</p>}
    </div>
  );
}

function Register({ onLogin }) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState(""); const [name,setName]=useState(""); const [err,setErr]=useState("");
  return (
    <div>
      <h2>Register</h2>
      <input placeholder="Nom" onChange={e=>setName(e.target.value)} />
      <input placeholder="Email" onChange={e=>setEmail(e.target.value)} />
      <input type="password" placeholder="Mot de passe" onChange={e=>setPass(e.target.value)} />
      <button onClick={async ()=>{
        try {
          const user = await createUserWithEmailAndPassword(auth,email,pass);
          await updateDoc(doc(db,"users",user.user.uid),{name:name, email, points:0, role:"medecin"});
          onLogin();
        } catch(e){ setErr("Erreur lors de l'inscription"); }
      }}>S'inscrire</button>
      {err && <p style={{color:"red"}}>{err}</p>}
    </div>
  );
}

function Dashboard({ user }) {
  const navigate = useNavigate();
  return (
    <div>
      <h2>Bienvenue, {user.email}</h2>
      <button onClick={()=>navigate("/patient")}>Voir Patient</button>
      <button onClick={()=>navigate("/analyses")}>Analyses</button>
      <button onClick={()=>navigate("/diagnostic")}>Diagnostic</button>
      <button onClick={()=>navigate("/specialist")}>Avis Spécialiste</button>
      <button onClick={()=>navigate("/leaderboard")}>Leaderboard</button>
      <button onClick={async ()=>{await signOut(auth); navigate("/");}}>Se déconnecter</button>
    </div>
  );
}

function PatientInfo({ user }) {
  const navigate = useNavigate();
  return (
    <div>
      <h2>Informations du patient</h2>
      <p>Nom: John Doe</p>
      <p>Symptômes: Fièvre, toux</p>
      <button onClick={()=>navigate("/analyses")}>Suivant → Analyses</button>
    </div>
  );
}

function Analyses({ user }) {
  const navigate = useNavigate();
  const handleAnalyses = async ()=>{alert("Analyses demandées"); navigate("/diagnostic");};
  return (
    <div>
      <h2>Analyses nécessaires</h2>
      <button onClick={handleAnalyses}>Valider Analyses</button>
    </div>
  );
}

function Diagnostic({ user }) {
  const navigate = useNavigate();
  const handleDiag = async ()=>{
    alert("Diagnostic réussi! +10 points");
    const userRef = doc(db,"users",user.uid);
    await updateDoc(userRef,{points:increment(10)});
    navigate("/specialist");
  };
  return (
    <div>
      <h2>Diagnostic</h2>
      <button onClick={handleDiag}>Confirmer Diagnostic</button>
    </div>
  );
}

function Specialist({ user }) {
  const navigate = useNavigate();
  const handleSpec = async ()=>{
    alert("Avis du spécialiste ajouté! +5 points");
    const userRef = doc(db,"users",user.uid);
    await updateDoc(userRef,{points:increment(5)});
    navigate("/leaderboard");
  };
  return (
    <div>
      <h2>Avis du spécialiste</h2>
      <button onClick={handleSpec}>Ajouter Avis</button>
    </div>
  );
}

function Leaderboard() {
  const [users,setUsers] = useState([]);
  useEffect(()=>{
    const fetchUsers = async ()=>{
      const snapshot = await getDocs(collection(db,"users"));
      setUsers(snapshot.docs.map(d=>d.data()).sort((a,b)=>b.points-a.points));
    }
    fetchUsers();
  },[]);
  return (
    <div>
      <h2>Leaderboard</h2>
      <ol>{users.map((u,i)=><li key={i}>{u.name||u.email}: {u.points} pts</li>)}</ol>
    </div>
  );
}

// ------------------- 3D Hospital Scene -------------------
function HospitalScene() {
  const playerRef = useRef();
  const cameraRef = useRef();
  return (
    <Canvas shadows camera={{position:[0,3,6], fov:75}}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10,10,10]} intensity={1} castShadow/>
      <Suspense fallback={null}>
        <Model path="/models/hospital_room.glb" />
        <Model path="/models/patient.glb" position={[0,0,-2]} scale={[1,1,1]} />
        <Model path="/models/stethoscope.glb" position={[1,0,0]} scale={[0.5,0.5,0.5]} />
        <Model path="/models/thermometer.glb" position={[-1,0,0]} scale={[0.5,0.5,0.5]} />
        <mesh ref={playerRef} position={[0,0,5]}>
          <boxGeometry args={[0.5,1.8,0.5]} />
          <meshStandardMaterial color="blue"/>
        </mesh>
      </Suspense>
      <ThirdPersonController playerRef={playerRef} cameraRef={cameraRef} />
      <perspectiveCamera ref={cameraRef} position={[0,3,6]} />
    </Canvas>
  );
}

// ------------------- Main App -------------------
export default function App() {
  const [user,setUser] = useState(null);

  useEffect(()=>onAuthStateChanged(auth,u=>{
    if(u)setUser({email:u.email,uid:u.uid});
    else setUser(null);
  }),[]);

  if(!user) return (
    <Router>
      <Routes>
        <Route path="/" element={<Login onLogin={()=>setUser(auth.currentUser)}/>} />
        <Route path="/register" element={<Register onLogin={()=>setUser(auth.currentUser)}/>} />
      </Routes>
    </Router>
  );

  return (
    <Router>
      <div style={{position:"absolute", width:"100%", height:"100%", zIndex:1}}>
        <Routes>
          <Route path="/" element={<Dashboard user={user}/>} />
          <Route path="/patient" element={<PatientInfo user={user}/>} />
          <Route path="/analyses" element={<Analyses user={user}/>} />
          <Route path="/diagnostic" element={<Diagnostic user={user}/>} />
          <Route path="/specialist" element={<Specialist user={user}/>} />
          <Route path="/leaderboard" element={<Leaderboard/>} />
        </Routes>
      </div>
      <HospitalScene/>
    </Router>
  );
}
