import { AdminPanelPage } from './AdminPanelPage';

// FHS-621: "Kids money" is where a child's money lives: what they have, what
// you can do with it, and what happened each week. It replaces the old Admin
// Panel's Balance, Savings and History tabs, which were three look-alike views
// of one thing, plus the reward shop.
//
// For now it renders the existing panel restricted to those tabs, so the split
// lands without moving two thousand lines at once. FHS-622 replaces the body
// with the designed page.
export function KidsMoneyPage() {
  return <AdminPanelPage variant="money" />;
}
