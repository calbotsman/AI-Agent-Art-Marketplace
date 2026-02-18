"use client";

import { Text } from "@react-three/drei";

type Props = {
  label: string;
  color: string;
  position: [number, number, number];
};

export function Workstation({ label, color, position }: Props) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.6, 1.6]} />
        <meshStandardMaterial color="#14141f" roughness={0.6} metalness={0.1} />
      </mesh>

      <mesh position={[0, 0.55, -0.25]} castShadow>
        <boxGeometry args={[1.1, 0.75, 0.08]} />
        <meshStandardMaterial color="#0b0b14" emissive={color} emissiveIntensity={0.22} />
      </mesh>

      <mesh position={[0, 0.52, 0.65]} castShadow>
        <boxGeometry args={[1.6, 0.18, 0.55]} />
        <meshStandardMaterial color="#0f0f1c" roughness={0.8} />
      </mesh>

      <mesh position={[0, 0.22, 0.65]} castShadow>
        <boxGeometry args={[0.38, 0.1, 0.24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>

      <Text
        position={[0, 0.95, -0.8]}
        fontSize={0.22}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

