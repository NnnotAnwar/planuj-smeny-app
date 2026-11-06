import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react';
import { Button } from './Button';
import { Input, Textarea } from './Input';
import { FormError } from './FormError';
import { Select } from './Select';

describe('<Button>', () => {
    it('is the primary md button by default and fires onClick', async () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Save</Button>);
        const btn = screen.getByRole('button', { name: 'Save' });
        expect(btn.className).toContain('from-emerald-600'); // primary
        expect(btn.className).toContain('min-h-11'); // md: 44px touch target on phones
        await userEvent.click(btn);
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('loading: blocks taps, marks aria-busy and swaps the icon for a spinner', async () => {
        const onClick = vi.fn();
        const { container } = render(
            <Button loading icon={PlusIcon} onClick={onClick}>
                Add
            </Button>,
        );
        const btn = screen.getByRole('button', { name: 'Add' });
        expect(btn).toBeDisabled();
        expect(btn).toHaveAttribute('aria-busy', 'true');
        expect(container.querySelectorAll('svg')).toHaveLength(1);
        expect(container.querySelector('svg')?.getAttribute('class')).toContain('animate-spin');
        await userEvent.click(btn);
        expect(onClick).not.toHaveBeenCalled();
    });

    it('disabled stays disabled without a spinner; variants and fullWidth apply', () => {
        const { container } = render(
            <Button disabled variant="danger" size="sm" fullWidth icon={PlusIcon}>
                Delete
            </Button>,
        );
        const btn = screen.getByRole('button', { name: 'Delete' });
        expect(btn).toBeDisabled();
        expect(btn).not.toHaveAttribute('aria-busy');
        expect(btn.className).toContain('from-rose-600');
        expect(btn.className).toContain('w-full');
        expect(container.querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin');
    });
});

describe('<Input> / <Textarea>', () => {
    it('a plain field renders just the input', () => {
        const { container } = render(<Input aria-label="Name" />);
        expect(container.firstElementChild?.tagName).toBe('INPUT');
        expect(screen.getByLabelText('Name').className).toContain('pl-3');
    });

    it('an icon wraps the field and pads it; a trailing slot pads the right', () => {
        render(<Input aria-label="Search" icon={MagnifyingGlassIcon} trailing={<button type="button">x</button>} />);
        const input = screen.getByLabelText('Search');
        expect(input.className).toContain('pl-9');
        expect(input.className).toContain('pr-10');
        expect(screen.getByRole('button', { name: 'x' })).toBeInTheDocument();
    });

    it('invalid paints the border red', () => {
        render(
            <>
                <Input aria-label="Email" invalid />
                <Textarea aria-label="Note" invalid />
            </>,
        );
        expect(screen.getByLabelText('Email').className).toContain('border-red-400');
        expect(screen.getByLabelText('Note').className).toContain('border-red-400');
    });
});

describe('<FormError>', () => {
    it('renders nothing without a message', () => {
        const { container } = render(<FormError message={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('announces the message as an alert', () => {
        render(<FormError message="Wrong password" />);
        expect(screen.getByRole('alert')).toHaveTextContent('Wrong password');
    });
});

describe('<Select>', () => {
    function Harness({ onChange, disabled }: { onChange?: (v: string) => void; disabled?: boolean }) {
        const [v, setV] = useState('b');
        return (
            <Select
                aria-label="Fruit"
                value={v}
                disabled={disabled}
                onChange={(e) => {
                    setV(e.target.value);
                    onChange?.(e.target.value);
                }}
            >
                <option value="a">Apple</option>
                <option value="b">Banana</option>
                <option value="c" disabled>
                    Cherry
                </option>
                <option value="d">Date</option>
            </Select>
        );
    }

    it('shows the selected label and picks an option by click', async () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        const trigger = screen.getByRole('button', { name: 'Fruit' });
        expect(trigger).toHaveTextContent('Banana');
        await userEvent.click(trigger);
        expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute('aria-selected', 'true');
        await userEvent.click(screen.getByRole('option', { name: 'Apple' }));
        expect(onChange).toHaveBeenCalledWith('a');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(trigger).toHaveTextContent('Apple');
    });

    it('keyboard: arrows skip disabled options, Enter picks, Escape closes', async () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        const trigger = screen.getByRole('button', { name: 'Fruit' });
        trigger.focus();
        await userEvent.keyboard('{ArrowDown}'); // opens on Banana
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        await userEvent.keyboard('{ArrowDown}{Enter}'); // Cherry is disabled → Date
        expect(onChange).toHaveBeenLastCalledWith('d');

        await userEvent.keyboard('{Enter}'); // reopen
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('a disabled option and a disabled select do nothing', async () => {
        const onChange = vi.fn();
        const { unmount } = render(<Harness onChange={onChange} />);
        await userEvent.click(screen.getByRole('button', { name: 'Fruit' }));
        await userEvent.click(screen.getByRole('option', { name: 'Cherry' }));
        expect(onChange).not.toHaveBeenCalled();
        unmount();

        render(<Harness onChange={onChange} disabled />);
        await userEvent.click(screen.getByRole('button', { name: 'Fruit' }));
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
});
