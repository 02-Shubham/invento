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
