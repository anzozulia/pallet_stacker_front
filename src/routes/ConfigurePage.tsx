// The eager `/` route (D-04): renders the full Configure screen. Imports ONLY ConfigForm
// (and its three-free dependency tree) — never three/r3f/drei — so the entry chunk stays
// free of the 3D engine and the code-split gate (C-05) holds.
import ConfigForm from '@/features/config/ConfigForm';

export default function ConfigurePage() {
  return <ConfigForm />;
}
