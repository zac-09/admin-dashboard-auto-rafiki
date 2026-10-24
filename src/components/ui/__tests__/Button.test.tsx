import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from '../Button';

describe('Button', () => {
  it('while loading: busy, disabled, a spinner before the label, and clicks ignored', async () => {
    const onClick = vi.fn();
    const { container, rerender } = render(
      <Button loading onClick={onClick}>
        Saving…
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(container.querySelector('.spinner')).toHaveAttribute('aria-hidden');
    await userEvent.setup().click(button);
    expect(onClick).not.toHaveBeenCalled();

    rerender(<Button onClick={onClick}>Save</Button>);
    const idle = screen.getByRole('button', { name: 'Save' });
    expect(idle).not.toHaveAttribute('aria-busy');
    expect(idle).toBeEnabled();
    expect(container.querySelector('.spinner')).toBeNull();
  });
});
