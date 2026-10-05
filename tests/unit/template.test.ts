import { describe, it, expect } from 'vitest';
import { extractVariables, substituteVariables } from '@/lib/utils/template';

describe('extractVariables', () => {
  it('extracts simple variables', () => {
    expect(extractVariables('Hello {{name}}')).toEqual(['name']);
  });

  it('extracts multiple unique variables', () => {
    const vars = extractVariables('{{a}} and {{b}} and {{a}}');
    expect(vars.sort()).toEqual(['a', 'b']);
  });

  it('handles spaces in variable syntax', () => {
    expect(extractVariables('{{  produto  }}')).toEqual(['produto']);
  });

  it('supports dotted names', () => {
    expect(extractVariables('{{user.name}}')).toEqual(['user.name']);
  });

  it('returns empty for no variables', () => {
    expect(extractVariables('No variables here')).toEqual([]);
  });
});

describe('substituteVariables', () => {
  it('substitutes known variables', () => {
    const out = substituteVariables('Hello {{name}}', { name: 'Isaque' });
    expect(out).toEqual({ result: 'Hello Isaque', missing: [] });
  });

  it('flags missing variables and keeps placeholder', () => {
    const out = substituteVariables('Hello {{name}}', {});
    expect(out.result).toBe('Hello {{name}}');
    expect(out.missing).toEqual(['name']);
  });

  it('treats empty string value as missing', () => {
    const out = substituteVariables('{{a}}', { a: '   ' });
    expect(out.missing).toEqual(['a']);
  });

  it('substitutes multiple instances', () => {
    const out = substituteVariables('{{x}} - {{x}}', { x: '1' });
    expect(out.result).toBe('1 - 1');
  });
});