import { CrewHome } from '@/components/crews/crew-home';
import { useSession } from '@/hooks/use-session';

/** Chat-Tab: Crew-Liste -> Chat einer Crew (Anmeldung übernimmt das Root-Layout) */
export default function ChatTab() {
  const { session, showLinkHint, openAccount, onUnauthorized } = useSession();
  return (
    <CrewHome
      session={session}
      showLinkHint={showLinkHint}
      onOpenAccount={openAccount}
      onUnauthorized={onUnauthorized}
    />
  );
}
