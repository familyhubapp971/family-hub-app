import type { Page } from '@playwright/test';

// Page object for the Learning Insights dashboard tab (FHS-385).
// Locators mirror the data-testid attributes in LearningInsightsTabPanel.tsx.
export class LearningInsightsPage {
  constructor(private readonly page: Page) {}

  panel() {
    return this.page.getByTestId('learning-insights-panel');
  }

  childSwitcher() {
    return this.page.getByTestId('child-switcher');
  }

  childPills() {
    return this.page.locator('[data-testid^="child-pill-"]');
  }

  subjectCardsGrid() {
    return this.page.getByTestId('subject-cards-grid');
  }

  subjectCards() {
    return this.page.locator('[data-testid^="subject-card-"]');
  }

  needsHelpChips() {
    return this.page.locator('[data-testid^="needs-help-chip-"]');
  }

  weakestPanel() {
    return this.page.getByTestId('weakest-panel');
  }

  weakestTip() {
    return this.page.getByTestId('weakest-tip');
  }

  emptyState() {
    return this.page.getByTestId('learning-insights-empty');
  }

  loadingIndicator() {
    return this.page.getByTestId('learning-insights-loading');
  }
}
