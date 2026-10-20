"use client";

// Smallest possible client island: receives only one string, never the whole catalogue.
import { useId, useState } from "react";
import styles from "./products.module.css";

export default function DescriptionToggle({ description }: { description: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div>
      <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {open ? "Ukryj opis" : "Pokaż opis"}
      </button>
      <p id={id} hidden={!open} className={styles.description}>
        {description}
      </p>
    </div>
  );
}
