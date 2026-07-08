import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyPage } from '../../../../apps/web/src/pages/marketing/PrivacyPage';

// FHS-435 — public draft privacy policy page. The source markdown
// (documents/legal/privacy-policy.md) is still a draft full of
// «placeholder» markers, so the page must make that obvious via a
// banner, and must let a visitor navigate back to the homepage.

function renderPage() {
  return render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  );
}

describe('<PrivacyPage />', () => {
  it('shows the draft banner so visitors know this is not the final policy', () => {
    renderPage();
    expect(screen.getByTestId('privacy-draft-banner')).toHaveTextContent(
      'Draft privacy policy. This is our beta; the final version is coming soon.',
    );
  });

  it('renders the policy sections with their headings', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Who we are' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '9. Your rights (UK GDPR)' })).toBeInTheDocument();
  });

  it('keeps the «placeholder» markers visible so the draft status shows mid-paragraph', () => {
    renderPage();
    expect(screen.getAllByTestId('privacy-placeholder').length).toBeGreaterThan(0);
  });

  it('has a working link back to the homepage', () => {
    renderPage();
    const backLinks = screen.getAllByRole('link', { name: /back to home/i });
    expect(backLinks.length).toBeGreaterThan(0);
    backLinks.forEach((link) => expect(link).toHaveAttribute('href', '/'));
  });
});
