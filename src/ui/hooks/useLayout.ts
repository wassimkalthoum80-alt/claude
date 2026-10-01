import { useSyncExternalStore } from 'react';
import { useUi } from './UiContext';

/** Phones in portrait (narrow) or landscape (short and not wide). Tablets and desktops keep the desktop layout. */
const PHONE_QUERY = '(max-width: 700px), (max-height: 500px) and (max-width: 1000px)';

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

const isPhoneScreen = () => window.matchMedia(PHONE_QUERY).matches;

/** true when the phone layout should be shown (automatic by screen size, or forced in the menu). */
export function usePhoneLayout(): boolean {
  const { ui } = useUi();
  const phone = useSyncExternalStore(subscribe, isPhoneScreen, () => false);
  return ui.layout === 'mobile' || (ui.layout === 'auto' && phone);
}
