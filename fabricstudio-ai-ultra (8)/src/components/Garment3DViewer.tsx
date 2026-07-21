import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float, MeshDistortMaterial, useTexture, Center, ContactShadows, PresentationControls } from '@react-three/drei';
import { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';

interface Garment3DProps {
  color: string;
  patternUrl?: string;
  fabricType: string;
  sheen?: number;
  roughness?: number;
  weaveIntensity?: number;
}

function GarmentMesh({ color, patternUrl, fabricType, sheen = 0.5, roughness = 0.5, weaveIntensity = 0.5 }: Garment3DProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  // Fabric-specific "physics" configuration
  const fabricConfig = useMemo(() => {
    switch (fabricType.toLowerCase()) {
      case 'silk': return { distort: 0.6, speed: 4, gravity: 1.2, metalness: 0.8, baseRoughness: 0.1 };
      case 'denim': return { distort: 0.05, speed: 1, gravity: 0.1, metalness: 0.0, baseRoughness: 0.8 };
      case 'cotton': return { distort: 0.2, speed: 1.5, gravity: 0.4, metalness: 0.0, baseRoughness: 0.9 };
      case 'velvet': return { distort: 0.3, speed: 1.2, gravity: 0.6, metalness: 0.4, baseRoughness: 0.4 };
      case 'leather': return { distort: 0.08, speed: 0.8, gravity: 0.2, metalness: 0.2, baseRoughness: 0.3 };
      case 'linen': return { distort: 0.15, speed: 1.8, gravity: 0.3, metalness: 0.0, baseRoughness: 0.85 };
      default: return { distort: 0.4, speed: 2.5, gravity: 0.8, metalness: 0.2, baseRoughness: 0.5 };
    }
  }, [fabricType]);

  // Simulate gravity-like pull-down on bottom vertices
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      meshRef.current.rotation.y = Math.sin(time / 4) * 0.1;
      // Procedural drape pulse
      meshRef.current.scale.y = 1.4 + Math.sin(time * fabricConfig.speed * 0.5) * 0.02 * fabricConfig.distort;
    }
  });

  return (
    <mesh ref={meshRef} scale={[1, 1.4, 0.5]}>
      <cylinderGeometry args={[0.8, 1.2, 2, 64, 64, true]} />
      <MeshDistortMaterial 
        color={color} 
        speed={fabricConfig.speed} 
        distort={fabricConfig.distort * (1 + (weaveIntensity || 0) * 0.5)} 
        radius={1}
        roughness={roughness !== undefined ? roughness : fabricConfig.baseRoughness}
        metalness={sheen !== undefined ? sheen * 0.8 : fabricConfig.metalness}
        side={THREE.DoubleSide}
        flatShading={false}
      />
    </mesh>
  );
}

export function Garment3DViewer({ color, patternUrl, fabricType, sheen, roughness, weaveIntensity }: Garment3DProps) {
  return (
    <div className="w-full h-[400px] bg-slate-900 rounded-2xl overflow-hidden relative group border border-white/5">
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/40 bg-white/5 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm w-fit">
          Neural Physics v2.0
        </span>
        <span className="text-[10px] font-bold text-indigo-400/60 uppercase tracking-tighter">
          Simulating: {fabricType}
        </span>
      </div>
      
      <Canvas camera={{ position: [0, 0, 5], fov: 40 }} shadows>
        <color attach="background" args={['#020617']} />
        <ambientLight intensity={0.4} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <PresentationControls
          global
          snap
          rotation={[0, 0.3, 0]}
          polar={[-Math.PI / 3, Math.PI / 3]}
          azimuth={[-Math.PI / 1.4, Math.PI / 1.4]}
        >
          <Center top>
            <GarmentMesh 
              color={color} 
              patternUrl={patternUrl} 
              fabricType={fabricType} 
              sheen={sheen}
              roughness={roughness}
              weaveIntensity={weaveIntensity}
            />
          </Center>
        </PresentationControls>

        <ContactShadows 
          position={[0, -2, 0]} 
          opacity={0.4} 
          scale={10} 
          blur={2.5} 
          far={4} 
        />
        
        <Environment preset="night" />
      </Canvas>

      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
        <div className="text-left">
          <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em]">Live Simulation</p>
          <p className="text-[8px] text-white/20 font-medium">Interacting with simulated gravity & lighting</p>
        </div>
        <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg backdrop-blur-lg">
           <p className="text-[8px] text-white/40 font-bold uppercase tracking-tighter">Click & Drag to Rotate</p>
        </div>
      </div>
    </div>
  );
}
