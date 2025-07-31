import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';

export default function LoginPage() {
  // Earth texture loader for globe
  function EarthGlobe() {
    const earthMap = useLoader(TextureLoader, '/earth_daymap.jpg');
    return (
      <Sphere args={[1, 64, 64]} position={[0, 0, 0]}>
        <meshStandardMaterial map={earthMap} metalness={0.4} roughness={0.7} />
      </Sphere>
    );
  }

  return (
    <div className="absolute inset-0 z-0">
      <Canvas camera={{ position: [0, 0, 3.5], fov: 50 }} style={{ width: '100%', height: '100%' }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={2} />
        <EarthGlobe />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={1.5} enablePan={false} />
      </Canvas>
    </div>
  );
}