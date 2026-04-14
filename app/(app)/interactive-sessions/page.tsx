/**
 * Legacy Interactive Sessions Route
 *
 * Redirects to /events.
 */

import { permanentRedirect } from 'next/navigation';

export default function LegacyInteractiveSessionsPage() {
  permanentRedirect('/events');
}
