export const SITE = {
  name: "Computer Shop 2026",
  description: "Sklep komputerowy — projekt laboratoryjny z Programowania BackEnd (Next.js, App Router).",
  author: "Anastasiia Muzyka",
  course: "Programowanie BackEnd, Katedra Informatyki Stosowanej M-7, Politechnika Krakowska",
} as const;

export const NAV_LINKS = [
  { href: "/", label: "Start" },
  { href: "/product-list", label: "Katalog" },
  { href: "/catalog", label: "Kategorie" },
  { href: "/basket", label: "Koszyk" },
  { href: "/order-history", label: "Historia zamówień" },
  { href: "/about", label: "O sklepie" },
] as const;
