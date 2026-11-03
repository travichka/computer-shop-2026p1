import { formatPrice } from "@/lib/format";
import type { OrderLine } from "@/lib/orders/types";

/** Lines of an order from the snapshot stored at purchase time. */
export default function OrderLines({ lines }: { lines: OrderLine[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr>
          <th scope="col">Produkt</th>
          <th scope="col">Kod</th>
          <th scope="col">Cena</th>
          <th scope="col">Ilość</th>
          <th scope="col">Wartość</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => (
          <tr key={index}>
            <td className="wrap-anywhere">
              {line.productName}
              {line.productId === null && <span className="block text-xs">(produkt usunięty z katalogu)</span>}
            </td>
            <td>
              <code>{line.productCode}</code>
            </td>
            <td>{formatPrice(line.unitPrice)}</td>
            <td>{line.quantity}</td>
            <td>{formatPrice(line.lineTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
