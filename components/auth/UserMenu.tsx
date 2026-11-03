import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import HeaderSignIn from "./HeaderSignIn";
import SignOutButton from "./SignOutButton";

/**
 * Current user in the header, read from the server session of this request. Only the display name
 * reaches the browser — no session token, no OAuth tokens, no whole auth records.
 */
export default async function UserMenu() {
  const session = await getCurrentSession();

  if (!session) {
    return (
      <div className="user-menu">
        <HeaderSignIn />
      </div>
    );
  }

  return (
    <div className="user-menu">
      <span>
        Zalogowano: <Link href="/account">{session.user.name || session.user.email}</Link>
      </span>
      <SignOutButton />
    </div>
  );
}
