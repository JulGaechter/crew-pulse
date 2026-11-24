import { AuthGate } from '@/components/auth/auth-gate';
import { CrewHome } from '@/components/crews/crew-home';

/** Chat-Tab: Anmeldung -> Crew-Liste -> Chat einer Crew */
export default function ChatTab() {
  return (
    <AuthGate>
      {({ session, showLinkHint, openAccount, onUnauthorized }) => (
        <CrewHome
          session={session}
          showLinkHint={showLinkHint}
          onOpenAccount={openAccount}
          onUnauthorized={onUnauthorized}
        />
      )}
    </AuthGate>
  );
}
