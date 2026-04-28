// Cogfall — main entry point.
//
// Phase 1 strategy: this file boots the prototype verbatim via legacy.ts,
// then each commit peels one section out into a typed module. When legacy.ts
// is empty, this file owns the wiring directly.
import './styles/main.css';
import './legacy';
