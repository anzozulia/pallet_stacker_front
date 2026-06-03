import { Canvas } from '@react-three/fiber';

export default function ResultPage() {
  return (
    // Explicit height is required: <Canvas> fills its parent, and a zero-height
    // parent yields a 0×0 canvas. 100dvh gives the empty scene a real viewport.
    <div style={{ width: '100%', height: '100dvh' }}>
      <Canvas data-testid="r3f-canvas">
        {/* Empty scene — Phase 6 adds real content. A single light keeps it valid. */}
        <ambientLight intensity={0.5} />
      </Canvas>
    </div>
  );
}
