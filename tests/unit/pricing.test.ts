import { describe, it, expect } from 'vitest';
import { calculateCost, describeCost, CostMessages } from '@/lib/pricing/cost';

describe('calculateCost', () => {
  it('returns undefined when both tokens are undefined', () => {
    expect(calculateCost({ inputPricePer1M: 5, outputPricePer1M: 15 }, undefined, undefined)).toBeUndefined();
  });

  it('calculates input + output cost correctly', () => {
    const cost = calculateCost(
      { inputPricePer1M: 5, outputPricePer1M: 15 },
      100_000,
      50_000,
    );
    // 100000/1M*5 = 0.5  +  50000/1M*15 = 0.75  => 1.25
    expect(cost).toBeCloseTo(1.25, 6);
  });

  it('returns undefined when prices are missing', () => {
    expect(calculateCost({}, 100, 200)).toBeUndefined();
  });

  it('handles Ollama-style zero prices (free)', () => {
    expect(calculateCost({ inputPricePer1M: 0, outputPricePer1M: 0 }, 1000, 2000)).toBe(0);
  });

  it('handles only input price', () => {
    const cost = calculateCost({ inputPricePer1M: 10 }, 100_000, undefined);
    // 100000/1M*10 = 1.0
    expect(cost).toBeCloseTo(1.0, 6);
  });

  it('rounds to 6 decimals', () => {
    const cost = calculateCost(
      { inputPricePer1M: 1.234567, outputPricePer1M: 0 },
      100_000,
      0,
    );
    // 100000/1M*1.234567 = 0.1234567  -> 0.123457
    expect(cost).toBe(0.123457);
  });
});

describe('describeCost', () => {
  it('shows no-tokens message when tokens are undefined', () => {
    expect(describeCost({})).toBe(CostMessages.noTokens);
  });

  it('shows no-price message when tokens exist but cost is undefined', () => {
    expect(describeCost({ inputTokens: 10, outputTokens: 5 })).toBe(CostMessages.noPrice);
  });

  it('formats a number cost as USD', () => {
    expect(describeCost({ estimatedCost: 0.001234, inputTokens: 100, outputTokens: 50 })).toBe('$0.001234');
  });
});