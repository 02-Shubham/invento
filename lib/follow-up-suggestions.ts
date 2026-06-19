/**
 * Returns contextual follow-up prompts based on the tools utilized by the AI in the last turn.
 */
export function getFollowUpSuggestions(toolsUsed: string[]): string[] {
  if (!toolsUsed || toolsUsed.length === 0) {
    return [
      "What products are low on stock?",
      "Show me this month's revenue",
      "Who owes me money?",
    ];
  }
  
  if (toolsUsed.includes("create_invoice")) {
    return [
      "Send invoice via email",
      "Create another invoice",
      "Check customer balance",
    ];
  }
  
  if (toolsUsed.includes("get_low_stock_products") || toolsUsed.includes("adjust_stock")) {
    return [
      "Reorder all low-stock items",
      "Adjust stock for one item",
      "Show revenue this month",
    ];
  }
  
  if (toolsUsed.includes("get_revenue_report")) {
    return [
      "Show top customers",
      "Compare last month",
      "List unpaid invoices",
    ];
  }

  if (toolsUsed.includes("get_customers_with_pending_payments")) {
    return [
      "Show this month's revenue",
      "Record a new payment",
      "Check customer balance",
    ];
  }
  
  return [
    "What products are low on stock?",
    "Show me this month's revenue",
    "Who owes me money?",
  ];
}
