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
