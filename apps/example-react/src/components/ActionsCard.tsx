import { useState } from "react";
import type { EventProps } from "@beacon/sdk";

interface ActionsCardProps {
  onTrackEvent: (eventName: string, props: EventProps) => void;
}

const actions = [
  {
    id: "add-cart",
    label: "Add to Cart",
    code: 'track("product_added_to_cart", { product_id, price, currency })',
    getProps: () => ({
      product_id: `prod_${Math.random().toString(36).slice(2, 6)}`,
      price: 29.99,
      currency: "USD",
    }),
    eventName: "product_added_to_cart",
  },
  {
    id: "checkout",
    label: "Start Checkout",
    code: 'track("checkout_started", { cart_value, item_count })',
    getProps: () => ({
      cart_value: 59.98,
      item_count: 2,
    }),
    eventName: "checkout_started",
  },
  {
    id: "upgrade",
    label: "View Pricing",
    code: 'track("pricing_page_viewed", { source, current_plan })',
    getProps: () => ({
      source: "header_cta",
      current_plan: "free",
    }),
    eventName: "pricing_page_viewed",
  },
];

export default function ActionsCard({ onTrackEvent }: ActionsCardProps) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  return (
    <section className="card">
      <h2>Track Events</h2>
      <p className="card-description">
        Click buttons to simulate user interactions and watch events flow to
        Beacon.
      </p>
      <div className="action-buttons">
        {actions.map((action) => (
          <button
            key={action.id}
            className="action-btn"
            onMouseEnter={() => setHoveredCode(action.code)}
            onMouseLeave={() => setHoveredCode(null)}
            onClick={() => onTrackEvent(action.eventName, action.getProps())}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="code-preview">
        {hoveredCode ? (
          <code>{hoveredCode}</code>
        ) : (
          <span className="code-preview-label">
            Hover a button to see the code
          </span>
        )}
      </div>
    </section>
  );
}
