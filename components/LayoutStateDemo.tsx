"use client";

// Layout experiment (extension): local state kept in a component of the root layout.
// Navigation through <Link> keeps the layout mounted, so the counter survives;
// a full page reload creates a new React tree and the counter starts from 0.
import { useState } from "react";

export default function LayoutStateDemo() {
  const [count, setCount] = useState(0);

  return (
    <p className="layout-demo">
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Licznik w layoucie: <span aria-live="polite">{count}</span>
      </button>
    </p>
  );
}
