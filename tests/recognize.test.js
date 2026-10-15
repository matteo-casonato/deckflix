import { describe, expect, it } from 'vitest';
import { confusableNumbers, detectLanguage, nameSimilarity, parseCollectorNumber, parseSetCode, setCodeMatches } from '../src/lib/domain/recognize.js';

describe('parseCollectorNumber', () => {
  it('reads a clean number', () => {
    expect(parseCollectorNumber('MEW IT 025/165')).toMatchObject({ number: 25, total: 165 });
  });

  it('tolerates spaces and OCR letter confusions', () => {
    expect(parseCollectorNumber('G  O25 / 1G5')).toMatchObject({ number: 25, total: 165 });
    expect(parseCollectorNumber('illus. Foo  l2/lO2')).toMatchObject({ number: 12, total: 102 });
  });

  it('accepts secret rares above the set total', () => {
    expect(parseCollectorNumber('199/165')).toMatchObject({ number: 199, total: 165 });
  });

  it('prefers clean matches over fixed ones', () => {
    expect(parseCollectorNumber('S/BB 081/198')).toMatchObject({ number: 81, total: 198 });
  });

  it('returns null without a number', () => {
    expect(parseCollectorNumber('Debolezza Resistenza')).toBeNull();
    expect(parseCollectorNumber('')).toBeNull();
  });
});

describe('detectLanguage', () => {
  it('uses the language code printed next to the number', () => {
    expect(detectLanguage('SVI EN 081/198').lang).toBe('en');
    expect(detectLanguage('PAR DE 012/182').lang).toBe('de');
  });

  it('uses the HP abbreviation', () => {
    expect(detectLanguage('Pikachu PS 60').lang).toBe('it');
    expect(detectLanguage('Pikachu HP 60').lang).toBe('en');
    expect(detectLanguage('Pikachu 60 KP').lang).toBe('de');
    expect(detectLanguage('Pikachu PV 60').lang).toBe('fr');
  });

  it('separates languages that share PS by keywords', () => {
    expect(detectLanguage('PS 60 Debilidad Retirada').lang).toBe('es');
    expect(detectLanguage('PS 60 Fraqueza Recuo').lang).toBe('pt');
    expect(detectLanguage('PS 60 Debolezza Ritirata').lang).toBe('it');
  });

  it('handles accents', () => {
    expect(detectLanguage('Schwäche Rückzug').lang).toBe('de');
  });

  it('returns null without signals', () => {
    expect(detectLanguage('xyz').lang).toBeNull();
  });
});

describe('nameSimilarity', () => {
  it('is 1 when the name is contained', () => {
    expect(nameSimilarity('Pikachu', 'BASE Pikachu PS 60')).toBe(1);
  });

  it('tolerates small OCR errors', () => {
    expect(nameSimilarity('Pikachu', 'Pikachv PS 60')).toBeGreaterThan(0.8);
    expect(nameSimilarity('Miraidon ex', 'Miraid0n ex HP 220')).toBeGreaterThan(0.85);
  });

  it('is low for unrelated text', () => {
    expect(nameSimilarity('Charizard', 'Pikachu PS 60')).toBeLessThan(0.5);
  });
});

describe('confusableNumbers', () => {
  it('swaps one confusable digit at a time', () => {
    const alts = confusableNumbers(195);
    expect(alts).toContain(198);
    expect(alts).toContain(185);
    expect(alts).not.toContain(195);
  });

  it('keeps leading zeros meaningful', () => {
    expect(confusableNumbers(51)).toContain(81);
  });
});

describe('parseSetCode', () => {
  it('reads the code before language and number', () => {
    expect(parseSetCode('Illus. 5ban SVI EN 081/198')).toBe('SVI');
    expect(parseSetCode('MEW IT 025/165')).toBe('MEW');
  });

  it('ignores a bare language code and missing codes', () => {
    expect(parseSetCode('IT 025/165')).toBeNull();
    expect(parseSetCode('018/172')).toBeNull();
  });
});

describe('parseCollectorNumber with known totals', () => {
  it('skips readings whose total is not a set size', () => {
    const totals = new Set([165, 198]);
    expect(parseCollectorNumber('22/25 025/165', totals)).toMatchObject({ number: 25, total: 165 });
    expect(parseCollectorNumber('22/25', totals)).toBeNull();
  });
});

describe('parseCollectorNumber edge cases from real OCR output', () => {
  it('does not join digits across lines', () => {
    expect(parseCollectorNumber('22\n\n/\n\n025/165\n\n02023/')).toMatchObject({ number: 25, total: 165 });
  });

  it('drops one spurious trailing digit after the total', () => {
    expect(parseCollectorNumber('0 050/1820', new Set([182]))).toMatchObject({ number: 50, total: 182 });
  });
});

describe('set codes glued to the language code', () => {
  it('matches "DRIT" with DRI', () => {
    expect(parseSetCode('DRIT\n178/182')).toBe('DRIT');
    expect(setCodeMatches('DRIT', 'DRI')).toBe(true);
    expect(setCodeMatches('DRI', 'DRI')).toBe(true);
    expect(setCodeMatches('DRIT', 'SVI')).toBe(false);
    expect(setCodeMatches('D', 'DRI')).toBe(false);
  });

  it('keeps codes with digits like 30C', () => {
    expect(parseSetCode('J 30C 157/128')).toBe('30C');
  });
});
