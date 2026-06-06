// The wood pallet model (block-pallet structure), ground plane, and grid — the static stage
// the boxes sit on. A realistic block pallet: top deck boards running one way, a perpendicular
// stringer-board layer running the other way beneath them, and a centered 3x3 grid of short
// support blocks aligned to the L×W footprint.
//
// CRITICAL INVARIANT (do not break): the TOP DECK top face stays at y = DECK_TOP_Y = 100
// (BLOCK_H 78 + DECK_H 22). Boxes are placed by mapping.ts assuming the deck top = 100
// (centre y = DECK_TOP_Y + z + H/2), so the top-deck boards' centre y MUST be
// BLOCK_H + DECK_H/2 so their top face lands at exactly BLOCK_H + DECK_H = 100. The
// perpendicular layer sits BELOW that; the support blocks sit below everything.
//
// All three/r3f/drei JSX lives here, inside the lazy /result subtree (Pitfall 3).
// Scene-material colours are module constants (NOT @theme tokens) per UI-SPEC.

import { Grid } from '@react-three/drei';

// Pallet model dimensions (mockup-faithful). BLOCK_H + DECK_H must equal DECK_TOP_Y
// in src/lib/mapping.ts (78 + 22 = 100) so boxes rest exactly on the deck.
const DECK_H = 22; // top deck board thickness (y)
const BLOCK_H = 78; // support block height (y)
const STRINGER_H = 20; // perpendicular under-board thickness (y), sits below the top deck

const WOOD_TOP = '#caa06a'; // deck / board top face
const WOOD_SIDE = '#b08a55'; // board sides + support blocks
const GROUND_COLOR = '#0e1320';

// Support-block footprint + how far its centre is inset from each deck edge so corner blocks
// sit AT the deck corners rather than past the edge.
const BLOCK_SIZE = 120; // x/z footprint of each support block (mm)
const BLOCK_INSET = 100; // centre inset from each edge (mm)

export interface PalletProps {
  // Pallet footprint in mm (API L = x extent, W = z extent in three-space).
  length: number; // L -> x
  width: number; // W -> z
}

/** Per-face material order for a deck board: +x,-x,+y(top),-y,+z,-z — top face uses WOOD_TOP. */
function BoardMaterials() {
  return (
    <>
      <meshStandardMaterial attach="material-0" color={WOOD_SIDE} roughness={0.85} />
      <meshStandardMaterial attach="material-1" color={WOOD_SIDE} roughness={0.85} />
      <meshStandardMaterial attach="material-2" color={WOOD_TOP} roughness={0.85} />
      <meshStandardMaterial attach="material-3" color={WOOD_SIDE} roughness={0.85} />
      <meshStandardMaterial attach="material-4" color={WOOD_SIDE} roughness={0.85} />
      <meshStandardMaterial attach="material-5" color={WOOD_SIDE} roughness={0.85} />
    </>
  );
}

export function Pallet({ length: L, width: W }: PalletProps) {
  // Top deck: N boards running ALONG z (long in z, thin in x), spaced across the length/x.
  const topN = 7;
  const topGap = L / topN;
  const topBoardW = topGap * 0.62; // board extent in x
  // Top-deck centre y so its TOP FACE lands at exactly BLOCK_H + DECK_H = DECK_TOP_Y = 100.
  const topY = BLOCK_H + DECK_H / 2;

  // Perpendicular layer: M boards running ALONG x (long in x, thin in z), spaced across width/z,
  // sitting BELOW the top deck (top of this layer at y = BLOCK_H, i.e. just under the top boards).
  const underN = 3;
  const underGap = W / underN;
  const underBoardW = underGap * 0.5; // board extent in z
  const underY = BLOCK_H - STRINGER_H / 2;

  // Support blocks: a centered 3x3 grid at x,z ∈ {−edge+inset, 0, +edge−inset}.
  const blockXs = [-L / 2 + BLOCK_INSET, 0, L / 2 - BLOCK_INSET];
  const blockZs = [-W / 2 + BLOCK_INSET, 0, W / 2 - BLOCK_INSET];

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

      {/* Top deck boards — run along z, spaced across x. Their top face is at DECK_TOP_Y (100). */}
      {Array.from({ length: topN }, (_, i) => (
        <mesh
          key={`top-${i}`}
          position={[-L / 2 + topGap * (i + 0.5), topY, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[topBoardW, DECK_H, W * 0.92]} />
          <BoardMaterials />
        </mesh>
      ))}

      {/* Perpendicular under-layer — run along x, spaced across z, just below the top deck. */}
      {Array.from({ length: underN }, (_, i) => (
        <mesh
          key={`under-${i}`}
          position={[0, underY, -W / 2 + underGap * (i + 0.5)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[L * 0.96, STRINGER_H, underBoardW]} />
          <BoardMaterials />
        </mesh>
      ))}

      {/* Centered 3x3 support-block grid — short blocks under the board intersections. */}
      {blockXs.map((xp, xi) =>
        blockZs.map((zp, zi) => (
          <mesh key={`block-${xi}-${zi}`} position={[xp, BLOCK_H / 2, zp]} castShadow receiveShadow>
            <boxGeometry args={[BLOCK_SIZE, BLOCK_H, BLOCK_SIZE]} />
            <meshStandardMaterial color={WOOD_SIDE} roughness={0.85} />
          </mesh>
        )),
      )}
    </group>
  );
}
