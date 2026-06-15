export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export const AI_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search for products in the inventory by name, SKU, or partial match. Use this when the user wants to find products, check what's available, or needs product information before creating orders or invoices.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search term - can be product name, SKU, or partial text. Examples: 'bag', 'leather', 'LAP-001'"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return. Default is 10.",
            default: 10
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_customers",
      description: "Search for customers in the database by name, email, or phone. Use this when the user asks about 'customers', wants to find a specific person, or needs customer contact info.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search term - can be customer name, email, or phone number. Leave empty to list recent customers."
          },
          limit: {
            type: "number",
            description: "Maximum results to return",
            default: 5
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_customers_with_pending_payments",
      description: "Get a list of customers who have pending/unpaid invoices or outstanding payments. Use this when the user asks about customers with outstanding balances, unpaid invoices, overdue payments, or who owes money. Returns customer details with total outstanding amounts.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of customers to return. Default is 10.",
            default: 10
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_invoice",
      description: "Create a new invoice for a customer. Expects the customer's ID and list of items (each with productId and quantity). Use this when the user asks to bill a customer, create an invoice, or make a bill.",
      parameters: {
        type: "object",
        properties: {
          customerId: {
            type: "string",
            description: "The unique ID of the customer. Use search_customers first to find the ID if only a name is given."
          },
          items: {
            type: "array",
            description: "List of items to include in the invoice",
            items: {
              type: "object",
              properties: {
                productId: {
                  type: "string",
                  description: "The unique ID of the product. Use search_products first to find the ID if only a name is given."
                },
                quantity: {
                  type: "number",
                  description: "The quantity of the product to purchase (must be greater than 0)."
                }
              },
              required: ["productId", "quantity"]
            }
          },
          notes: {
            type: "string",
            description: "Optional notes for the invoice."
          }
        },
        required: ["customerId", "items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "adjust_stock",
      description: "Adjust the stock level for a product. Can add positive stock (inflow/production) or negative stock (outflow/wastage/adjustment). Use this when the user wants to add stock, reduce stock, or correct stock levels.",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "The unique ID of the product. Use search_products first to find the ID if only a name is given."
          },
          quantity: {
            type: "number",
            description: "The amount of stock to adjust. Positive numbers add stock, negative numbers subtract stock."
          },
          notes: {
            type: "string",
            description: "Optional reason/notes for the adjustment (e.g. 'damaged', 'weekly stock audit', 'new batch received')."
          }
        },
        required: ["productId", "quantity"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_revenue_report",
      description: "Retrieve a sales and revenue summary for a given time period. Use this when the user asks about revenue, sales, earnings, top selling products, or financial performance.",
      parameters: {
        type: "object",
        properties: {
          startDate: {
            type: "string",
            description: "ISO date string for the start of the report period (e.g., '2026-06-01'). Defaults to 30 days ago."
          },
          endDate: {
            type: "string",
            description: "ISO date string for the end of the report period (e.g., '2026-06-30'). Defaults to today."
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_low_stock_products",
      description: "Retrieve a list of products that have stock levels below a given threshold. Use this when the user asks for low stock items, items running out, or reorder alerts.",
      parameters: {
        type: "object",
        properties: {
          threshold: {
            type: "number",
            description: "The stock level threshold below which a product is considered low. Default is 10."
          }
        },
        required: []
      }
    }
  }
];

// Helper to get single tool
export function getToolByName(name: string): ToolDefinition | undefined {
  return AI_TOOLS.find(tool => tool.function.name === name);
}

// Get all tool names
export function getToolNames(): string[] {
  return AI_TOOLS.map(tool => tool.function.name);
}
