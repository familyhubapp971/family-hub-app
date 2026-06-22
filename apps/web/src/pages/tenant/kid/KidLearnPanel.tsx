import { LearnTab } from '../child/LearnTab';

// FHS-367 — kid Learn tab. Reuses LearnTab in kid mode: lesson subjects
// (Maths/Science/Logic) + the reading log, talking to the token-scoped
// /api/kid/learn + /api/kid/reading-log endpoints. World Flags is kid-scoped
// separately (FHS-373) and is hidden here until then.
export function KidLearnPanel({ kidToken }: { kidToken: string | null }) {
  if (!kidToken) return null;
  return <LearnTab kidToken={kidToken} />;
}
