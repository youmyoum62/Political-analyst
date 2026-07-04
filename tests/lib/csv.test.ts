import { describe, it, expect } from 'vitest';
import {
  escapeCsvField,
  buildCsvRow,
  politicianToCsvRow,
  buildPoliticiansCsv,
  POLITICIAN_CSV_HEADERS,
  CSV_BOM,
} from '@/lib/csv';
import type { Politician } from '@/lib/types';

describe('escapeCsvField', () => {
  it('カンマ・ダブルクォート・改行を含まない値はそのまま返す', () => {
    expect(escapeCsvField('通常のテキスト')).toBe('通常のテキスト');
    expect(escapeCsvField(42)).toBe('42');
  });

  it('null・undefined は空文字にする', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('カンマを含む値は " で囲む', () => {
    expect(escapeCsvField('山田,太郎')).toBe('"山田,太郎"');
  });

  it('ダブルクォートを含む値は "" にエスケープしたうえで全体を " で囲む', () => {
    expect(escapeCsvField('"議員"と呼ばれる')).toBe('"""議員""と呼ばれる"');
    expect(escapeCsvField('a"b')).toBe('"a""b"');
  });

  it('改行(\\n, \\r)を含む値は " で囲む', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });
});

describe('buildCsvRow', () => {
  it('フィールドをカンマ区切りで連結する', () => {
    expect(buildCsvRow([1, '山田太郎', '自民党'])).toBe('1,山田太郎,自民党');
  });

  it('特殊文字を含むフィールドを含む行も正しくエスケープする', () => {
    expect(buildCsvRow([1, '山田,太郎', 'a"b'])).toBe('1,"山田,太郎","a""b"');
  });
});

function makePolitician(overrides: Partial<Politician> = {}): Politician {
  return {
    id: 1,
    name: '山田太郎',
    party: '自民党',
    age: 55,
    gender: 'Male',
    district: '東京1区',
    house: 'representatives',
    roleProfile: 'ruling',
    score: 78.5,
    rank: 1,
    trend: 0,
    topQuestion: '',
    keyAchievement: '',
    summary: '',
    metrics: {
      participation: 80,
      questionQuality: 70,
      legislation: 60,
      policyImpact: 75,
      influence: 90,
    },
    isInactive: false,
    ...overrides,
  };
}

describe('politicianToCsvRow', () => {
  it('議員の主要フィールドを日本語ラベルの院名とともに CSV 行へ変換する', () => {
    const row = politicianToCsvRow(makePolitician());
    expect(row).toBe('1,山田太郎,自民党,衆議院,東京1区,78.5,80,70,60,75,90');
  });

  it('house councillors は参議院と表示する', () => {
    const row = politicianToCsvRow(makePolitician({ house: 'councillors' }));
    expect(row).toContain(',参議院,');
  });

  it('氏名や党派に特殊文字が含まれる場合もエスケープされる', () => {
    const row = politicianToCsvRow(makePolitician({ name: '山田,太郎', party: 'a"b党' }));
    expect(row).toContain('"山田,太郎"');
    expect(row).toContain('"a""b党"');
  });
});

describe('buildPoliticiansCsv', () => {
  it('BOM で始まり、ヘッダー行と議員データ行を含む', () => {
    const csv = buildPoliticiansCsv([makePolitician()]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const withoutBom = csv.slice(CSV_BOM.length);
    const lines = withoutBom.split('\r\n').filter((l) => l.length > 0);
    expect(lines[0]).toBe(POLITICIAN_CSV_HEADERS.join(','));
    expect(lines[1]).toBe('1,山田太郎,自民党,衆議院,東京1区,78.5,80,70,60,75,90');
  });

  it('議員配列が空でもヘッダー行のみの CSV を返す（例外を投げない）', () => {
    const csv = buildPoliticiansCsv([]);
    const withoutBom = csv.slice(CSV_BOM.length);
    const lines = withoutBom.split('\r\n').filter((l) => l.length > 0);
    expect(lines).toEqual([POLITICIAN_CSV_HEADERS.join(',')]);
  });

  it('comment を渡すと # 始まりの注記行が先頭に付与される', () => {
    const csv = buildPoliticiansCsv([], { comment: '出典: example\n暫定値です' });
    const withoutBom = csv.slice(CSV_BOM.length);
    const lines = withoutBom.split('\r\n').filter((l) => l.length > 0);
    expect(lines[0]).toBe('# 出典: example');
    expect(lines[1]).toBe('# 暫定値です');
    expect(lines[2]).toBe(POLITICIAN_CSV_HEADERS.join(','));
  });
});
