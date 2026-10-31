import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormCard } from '@familyhub/ui';

// FHS-513: the expanding inline-form shell shared by "Invite an adult"
// and "Add a child" on Manage Members.

describe('<FormCard />', () => {
  it('renders the title, description, and children', () => {
    render(
      <FormCard
        title="Invite an adult"
        description="They'll get a sign-in link."
        onClose={() => {}}
      >
        <p data-testid="form-body">Form fields</p>
      </FormCard>,
    );
    expect(screen.getByText('Invite an adult')).toBeInTheDocument();
    expect(screen.getByText("They'll get a sign-in link.")).toBeInTheDocument();
    expect(screen.getByTestId('form-body')).toBeInTheDocument();
  });

  it('fires onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <FormCard title="Add a child" onClose={onClose}>
        <p>Body</p>
      </FormCard>,
    );
    fireEvent.click(screen.getByLabelText('Close form'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
