// The wood pallet model (slats + blocks), ground plane, and grid — the static
// stage the boxes sit on. Geometry/material recipe ported from design/result.html
// (lines ~296-317) as VISUAL intent; the deck top sits at DECK_TOP_Y so it lines
// up with mapping.ts (which places box centres at DECK_TOP_Y + z + H/2).
//
// All three/r3f/drei JSX lives here, inside the lazy /result subtree (Pitfall 3).
// Scene-material colours are module constants (NOT @theme tokens) per UI-SPEC.

import { Grid } from '@react-three/drei';

// Pallet model dimensions (mockup-faithful). blockH + deckH must equal DECK_TOP_Y
// in src/lib/mapping.ts (78 + 22 = 100) so boxes rest exactly on the deck.
const DECK_H = 22;
const BLOCK_H = 78;

const WOOD_TOP = '#caa06a'; // deck / slat top face
const WOOD_SIDE = '#b08a55'; // slat sides + support blocks
const GROUND_COLOR = '#0e1320';

export interface PalletProps {
  // Pallet footprint in mm (API L = x extent, W = z extent in three-space).
  length: number; // L -> x
  width: number; // W -> z
}

export function Pallet({ length: L, width: W }: PalletProps) {
  const slatN = 6;
  const slatGap = W / slatN;

  return (
    <group>
      {/* Ground plane (receives the soft shadows) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[L * 9, W * 9]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
      </mesh>

      {/* Reference grid */}
      <Grid
        position={[0, -1, 0]}
        args={[L * 9, W * 9]}
        cellColor="#19202f"
        sectionColor="#243049"
        cellSize={L / 10}
        sectionSize={L}
        fadeDistance={L * 6}
        fadeStrength={1}
        infiniteGrid={false}
      />

      {/* Deck slats (top face uses the lighter wood tone) */}
      {Array.from({ length: slatN }, (_, i) => (
        <mesh
          key={`slat-${i}`}
          position={[0, BLOCK_H + DECK_H / 2, -W / 2 + slatGap * (i + 0.5)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[L, DECK_H, slatGap * 0.72]} />
          {/* Box face material order: +x,-x,+y(top),-y,+z,-z */}
          <meshStandardMaterial attach="material-0" color={WOOD_SIDE} roughness={0.85} />
          <meshStandardMaterial attach="material-1" color={WOOD_SIDE} roughness={0.85} />
          <meshStandardMaterial attach="material-2" color={WOOD_TOP} roughness={0.85} />
          <meshStandardMaterial attach="material-3" color={WOOD_SIDE} roughness={0.85} />
          <meshStandardMaterial attach="material-4" color={WOOD_SIDE} roughness={0.85} />
          <meshStandardMaterial attach="material-5" color={WOOD_SIDE} roughness={0.85} />
        </mesh>
      ))}

      {/* Three support blocks under the deck */}
      {[-W / 2 + 90, 0, W / 2 - 90].map((zp, i) => (
        <mesh key={`block-${i}`} position={[0, BLOCK_H / 2, zp]} castShadow receiveShadow>
          <boxGeometry args={[L, BLOCK_H, 90]} />
          <meshStandardMaterial color={WOOD_SIDE} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}
