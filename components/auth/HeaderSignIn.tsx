"use client";

import { usePathname } from "next/navigation";
import { returnPathForSection } from "@/lib/return-path";
import SignInButton from "./SignInButton";

/** Sign-in in the header: returns to the current section after login (known paths only). */
export default function HeaderSignIn() {
  return <SignInButton returnTo={returnPathForSection(usePathname())} label="Zaloguj" />;
}
