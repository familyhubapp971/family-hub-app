// Shared tab definitions for the parent dashboard nav.
// Imported by both DashboardPage and AppHeader so the tab list
// stays in one place.
//
// Icons are React nodes — callers must import lucide-react and build
// the list via the factory below, or import the pre-built TABS array.

import { Bell, BookOpen, CalendarDays, CheckSquare, Gift, Home, Utensils } from 'lucide-react';
import { createElement } from 'react';

export interface TabDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  ticket: string;
  description: string;
}

export const TABS: TabDef[] = [
  {
    id: 'home',
    label: 'Family Dashboard',
    icon: createElement(Home, { size: 16, 'aria-hidden': 'true' }),
    ticket: 'FHS-228',
    description: 'Family member grid + today snapshot.',
  },
  {
    id: 'meals',
    label: 'Meals',
    icon: createElement(Utensils, { size: 16, 'aria-hidden': 'true' }),
    ticket: 'FHS-229',
    description: 'Weekly meal planner.',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: createElement(CalendarDays, { size: 16, 'aria-hidden': 'true' }),
    ticket: 'FHS-230',
    description: 'Week view with events.',
  },
  {
    id: 'assignments',
    label: 'Assignments',
    icon: createElement(BookOpen, { size: 16, 'aria-hidden': 'true' }),
    ticket: 'FHS-231',
    description: 'Homework list per child.',
  },
  {
    id: 'noticeboard',
    label: 'Noticeboard',
    icon: createElement(Bell, { size: 16, 'aria-hidden': 'true' }),
    ticket: 'FHS-232',
    description: 'Pinned family notes.',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: createElement(CheckSquare, { size: 16, 'aria-hidden': 'true' }),
    ticket: 'FHS-233',
    description: 'Per-parent to-do list.',
  },
  {
    id: 'reward-requests',
    label: 'Reward Requests',
    icon: createElement(Gift, { size: 16, 'aria-hidden': 'true' }),
    ticket: 'FHS-379',
    description: 'Pending reward requests from kids.',
  },
];

export const DEFAULT_TAB = 'home';
