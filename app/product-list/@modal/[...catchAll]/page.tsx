// Empty slot for every other /product-list/… route (e.g. product details). During client
// navigation a slot keeps its previous content when nothing matches, so default.tsx alone
// would leave the modal open after following a link out of it.
export default function ModalCatchAll() {
  return null;
}
