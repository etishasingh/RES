// PLACEHOLDER: weights to be decided by the team
export const SCORE_WEIGHTS = {
  model: 0.5,
  client: 0.5,
} as const;

export interface ScoreWeights {
  model: number;
  client: number;
}

export interface FinalScoreResult {
  finalScore: number;
  weights: ScoreWeights;
}

export function computeFinalScore(
  modelScore: number,
  clientScore: number,
  weights: ScoreWeights = SCORE_WEIGHTS
): FinalScoreResult {
  const weighted = modelScore * weights.model + clientScore * weights.client;
  const rounded = Math.round(Math.max(0, Math.min(100, weighted)));
  return {
    finalScore: rounded,
    weights: { ...weights },
  };
}
