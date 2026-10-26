"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./products.module.css";

/**
 * Modal for the intercepted /product-list/<id>/image route. Closing goes back in history, so the
 * URL returns to the page that opened it and Forward reopens the modal. The native <dialog> with
 * showModal() keeps keyboard focus inside and turns Escape into a "cancel" event.
 */
export default function ImageModal({
  title,
  productHref,
  children,
}: {
  title: string;
  productHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    // The element that opened the modal (the clicked image link) gets focus back on close.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.modal}
      aria-labelledby="image-modal-title"
      onCancel={(event) => {
        event.preventDefault();
        router.back();
      }}
      onClick={(event) => {
        // A click on the backdrop targets the <dialog> element itself.
        if (event.target === dialogRef.current) router.back();
      }}
    >
      <h2 id="image-modal-title">{title}</h2>
      {children}
      <div className={styles.modalActions}>
        <button type="button" onClick={() => router.back()} autoFocus>
          Zamknij
        </button>
        <Link href={productHref}>Szczegóły produktu</Link>
      </div>
    </dialog>
  );
}
