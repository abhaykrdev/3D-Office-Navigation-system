# Bundled browser dependencies

Three.js 0.187.0, GLTFLoader, DRACOLoader, OrbitControls, BufferGeometryUtils,
SkeletonUtils and the Draco WebAssembly decoder are bundled locally.
License: `three/LICENSE`. The former panorama dependency is removed.

Versions are locked in `package-lock.json`. When upgrading, copy browser modules
and their imported helpers together, then rerun the media tests.
