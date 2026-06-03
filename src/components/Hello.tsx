// Trivial sample component for the Wave 0 unit-test smoke. It exercises the
// React + Vitest + Testing Library + jest-dom pipeline (and, via its test, the
// `@/` path alias inside Vitest). NOT a real product component — the actual UI
// arrives in later phases. It deliberately imports nothing from three/r3f.
export default function Hello() {
  return <h1>Palletize</h1>;
}
