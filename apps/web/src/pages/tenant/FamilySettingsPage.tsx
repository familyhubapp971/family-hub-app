import { AdminPanelPage } from './AdminPanelPage';

// FHS-621: "Family settings" holds the things a parent sets once and the two
// they hope never to touch: the currency, downloading your data, and deleting
// the family. They used to sit in a tab next to daily money controls.
//
// For now it renders the existing panel's settings half, so the split lands
// safely. FHS-624 replaces the body with the designed page.
export function FamilySettingsPage() {
  return <AdminPanelPage variant="family-settings" />;
}
