import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from '@/components/FilterBar';
import { checkA11y } from '../fixtures';

type FilterBarProps = Parameters<typeof FilterBar>[0];

function setup(overrides: Partial<FilterBarProps> = {}) {
  const props: FilterBarProps = {
    ageGroup: 'All',
    party: 'All',
    gender: 'All',
    house: 'All',
    query: '',
    parties: ['All', '自民党', '立憲'],
    showInactive: false,
    inactiveCount: 5,
    onAgeGroupChange: vi.fn(),
    onPartyChange: vi.fn(),
    onGenderChange: vi.fn(),
    onHouseChange: vi.fn(),
    onQueryChange: vi.fn(),
    onShowInactiveChange: vi.fn(),
    ...overrides,
  };
  render(<FilterBar {...props} />);
  return props;
}

describe('FilterBar', () => {
  it('各コントロールにアクセシブルなラベルが付いている', () => {
    setup();
    expect(screen.getByLabelText('名前・政党・選挙区で検索')).toBeInTheDocument();
    expect(screen.getByLabelText('院で絞り込む')).toBeInTheDocument();
    expect(screen.getByLabelText('年代で絞り込む')).toBeInTheDocument();
    expect(screen.getByLabelText('党派で絞り込む')).toBeInTheDocument();
    expect(screen.getByLabelText('性別で絞り込む')).toBeInTheDocument();
  });

  it('検索入力で onQueryChange を呼ぶ', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.type(screen.getByLabelText('名前・政党・選挙区で検索'), '山');
    expect(props.onQueryChange).toHaveBeenCalledWith('山');
  });

  it('院セグメントの切り替えで onHouseChange を呼ぶ', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole('radio', { name: '衆議院' }));
    expect(props.onHouseChange).toHaveBeenCalledWith('representatives');
  });

  it('院セグメントは選択状態を aria-checked で示す', () => {
    setup({ house: 'councillors' });
    expect(screen.getByRole('radio', { name: '参議院' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '衆議院' })).toHaveAttribute('aria-checked', 'false');
  });

  it('発言データなしボタンで onShowInactiveChange をトグルする', async () => {
    const user = userEvent.setup();
    const props = setup({ showInactive: false });
    await user.click(screen.getByRole('button', { name: /発言データなし/ }));
    expect(props.onShowInactiveChange).toHaveBeenCalledWith(true);
  });

  it('フィルター未適用時はリセットボタンを表示しない', () => {
    setup();
    expect(screen.queryByRole('button', { name: /リセット/ })).toBeNull();
  });

  it('フィルター適用時はリセットボタンを表示し、全条件を初期化する', async () => {
    const user = userEvent.setup();
    const props = setup({ query: '山田', party: '自民党' });
    await user.click(screen.getByRole('button', { name: /リセット/ }));
    expect(props.onAgeGroupChange).toHaveBeenCalledWith('All');
    expect(props.onPartyChange).toHaveBeenCalledWith('All');
    expect(props.onGenderChange).toHaveBeenCalledWith('All');
    expect(props.onHouseChange).toHaveBeenCalledWith('All');
    expect(props.onQueryChange).toHaveBeenCalledWith('');
    // 発言データなし表示はリセット対象外（巻き込まれないことを固定する）。
    expect(props.onShowInactiveChange).not.toHaveBeenCalled();
  });

  it('キーボード操作（Tab→Enter）で発言データなしボタンを起動できる', async () => {
    const user = userEvent.setup();
    const props = setup();
    const toggle = screen.getByRole('button', { name: /発言データなし/ });
    toggle.focus();
    expect(toggle).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(props.onShowInactiveChange).toHaveBeenCalledWith(true);
  });

  it('a11y 違反がない', async () => {
    const { container } = render(
      <FilterBar
        ageGroup="All"
        party="All"
        gender="All"
        house="All"
        query=""
        parties={['All', '自民党']}
        showInactive={false}
        inactiveCount={3}
        onAgeGroupChange={vi.fn()}
        onPartyChange={vi.fn()}
        onGenderChange={vi.fn()}
        onHouseChange={vi.fn()}
        onQueryChange={vi.fn()}
        onShowInactiveChange={vi.fn()}
      />,
    );
    expect(await checkA11y(container)).toHaveNoViolations();
  });
});
