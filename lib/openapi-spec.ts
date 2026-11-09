/**
 * OpenAPI 3.0 description of the Invento.ai HTTP API.
 *
 * Served as JSON at   GET /api/openapi
 * Rendered (Swagger UI) at   GET /api-docs
 *
 * Keep this in sync with app/api/**. Request/response shapes come from
 * types/ai-tools.ts and each route handler.
 */

const bearer = [{ bearerAuth: [] }];

const errorRef = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

/** Standard error responses shared by the tool endpoints. */
const stdErrors = {
  "401": { $ref: "#/components/responses/Unauthorized" },
  "500": { $ref: "#/components/responses/ServerError" },
};

/** Wraps a data schema in the standard `{ success, data, message? }` envelope. */
const envelope = (data: object, example?: unknown) => ({
  type: "object",
  required: ["success"],
  properties: {
    success: { type: "boolean", example: true },
    data,
    message: { type: "string", nullable: true },
  },
  ...(example !== undefined ? { example } : {}),
});

const ok = (description: string, data: object, example?: unknown) => ({
  description,
  content: { "application/json": { schema: envelope(data, example) } },
});

const jsonBody = (schema: object, example?: unknown) => ({
  required: true,
  content: { "application/json": { schema, ...(example !== undefined ? { example } : {}) } },
});

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Invento.ai API",
    version: "1.0.0",
    description: [
      "HTTP API for **Invento.ai**, an inventory and invoicing app for small businesses with an AI assistant.",
      "",
      "## Authentication",
      "Every endpoint requires a Firebase **ID token**:",
      "",
      "```",
      "Authorization: Bearer <Firebase ID token>",
      "```",
      "",
      "The token is verified on the server; the user is identified **only** by the verified token, never by anything in the request body. All data is scoped to that user (multi-tenant).",
      "",
      "**Getting a token (email/password users):**",
      "```bash",
      "curl -s -X POST 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<NEXT_PUBLIC_FIREBASE_API_KEY>' \\",
      "  -H 'Content-Type: application/json' \\",
      "  -d '{\"email\":\"you@example.com\",\"password\":\"...\",\"returnSecureToken\":true}'",
      "```",
      "Copy `idToken` from the response, click **Authorize** above, and paste it. Tokens expire after 1 hour.",
      "",
      "## Response conventions",
      "Tool endpoints return `{ \"success\": true, \"data\": ... }` on success and `{ \"success\": false, \"error\": \"...\" }` on failure.",
      "Some *business-rule* failures (for example insufficient stock) return **HTTP 200 with `success: false`** so that AI callers can read the reason. Always check `success`, not just the status code.",
      "",
      "## Two groups of endpoints",
      "- **AI** (`/api/ai/*`): the chat agent (streaming) and the voice-command parser. They call a language model.",
      "- **Tools** (`/api/ai-tools/*`): plain business operations (search, invoice, payment, reports). Note: the chat agent currently runs its own set of 8 tools internally (see `/api/ai/chat`); these REST endpoints are standalone.",
    ].join("\n"),
  },
  servers: [{ url: "/", description: "This server" }],
  tags: [
    { name: "AI", description: "LLM-backed endpoints" },
    { name: "Products & Stock", description: "Search products, check and add stock" },
    { name: "Customers", description: "Search and create customers" },
    { name: "Invoices & Payments", description: "Create invoices, record payments, look up invoices" },
    { name: "Reports", description: "Outstanding balances, low stock, sales summary" },
  ],
  security: bearer,
  paths: {
    // ───────────────────────── AI ─────────────────────────
    "/api/ai/chat": {
      post: {
        tags: ["AI"],
        summary: "Chat with the business assistant (streaming)",
        description: [
          "Sends a message to the AI assistant. The assistant may call tools (up to 5 rounds) and then streams its answer.",
          "",
          "**Response is `text/event-stream`**. Each event is a line `data: <json>` followed by a blank line:",
          "",
          "| Event payload | Meaning |",
          "|---|---|",
          "| `{\"step\": {\"tool\": \"search_products\", \"status\": \"running\"}}` | A tool started |",
          "| `{\"step\": {\"tool\": \"search_products\", \"status\": \"done\", \"summary\": \"Found 3 products\"}}` | A tool finished |",
          "| `{\"token\": \"Hello\"}` | A piece of the answer text |",
          "| `{\"done\": true, \"toolsUsed\": [...], \"toolResults\": {...}}` | Stream finished (final event) |",
          "| `{\"error\": \"...\"}` | Failure after the stream started |",
          "",
          "**Tools the assistant can use:** `search_products`, `search_customers`, `get_customers_with_pending_payments`, `create_invoice`, `adjust_stock`, `get_revenue_report`, `get_low_stock_products`, `add_product`.",
          "",
          "⚠️ Write tools (`create_invoice`, `adjust_stock`, `add_product`) execute immediately; there is no confirmation step yet.",
          "",
          "The AI provider is chosen from the user's settings (default: Groq, model from `GROQ_MODEL`).",
          "",
          "_Swagger UI cannot display a live event stream; use `curl -N` or a client with SSE support to try it._",
        ].join("\n"),
        requestBody: jsonBody(
          {
            type: "object",
            required: ["message"],
            properties: {
              message: { type: "string", description: "The user's new message", example: "How many wireless mice do we have?" },
              conversationHistory: {
                type: "array",
                description: "Earlier turns, oldest first",
                items: { $ref: "#/components/schemas/ChatTurn" },
              },
            },
          },
          { message: "Show customers who owe me money", conversationHistory: [] }
        ),
        responses: {
          "200": {
            description: "Server-sent event stream",
            content: {
              "text/event-stream": {
                schema: { type: "string" },
                example:
                  'data: {"step":{"tool":"get_customers_with_pending_payments","status":"running"}}\n\n' +
                  'data: {"step":{"tool":"get_customers_with_pending_payments","status":"done","summary":"Found 2 outstanding accounts"}}\n\n' +
                  'data: {"token":"You "}\n\n' +
                  'data: {"token":"have 2 customers with dues."}\n\n' +
                  'data: {"done":true,"toolsUsed":["get_customers_with_pending_payments"],"toolResults":{}}\n\n',
              },
            },
          },
          "400": errorRef("Invalid JSON body, or `message` missing"),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/ai/voice": {
      post: {
        tags: ["AI"],
        summary: "Parse a voice command into an app action",
        description:
          "Turns transcribed speech into a structured action the UI can perform (navigate, search, start an invoice, show a report, or answer a question). Does **not** execute business operations itself.\n\nMulti-turn: if required details are missing, `is_complete` is `false` and `reply_prompt` holds the follow-up question.",
        requestBody: jsonBody(
          {
            type: "object",
            required: ["text"],
            properties: {
              text: { type: "string", example: "go to inventory" },
              conversationHistory: { type: "array", items: { $ref: "#/components/schemas/ChatTurn" } },
            },
          },
          { text: "create an invoice for Ramesh", conversationHistory: [] }
        ),
        responses: {
          "200": ok(
            "Parsed action",
            { type: "object", properties: { action: { $ref: "#/components/schemas/VoiceAction" } } },
            {
              success: true,
              data: {
                action: {
                  intent: "CREATE_INVOICE",
                  is_complete: false,
                  missing_fields: ["invoice_items"],
                  reply_prompt: "What items should I add for Ramesh?",
                  customer_name: "Ramesh",
                },
              },
            }
          ),
          "400": {
            description: "`text` missing, or no AI key configured for this user",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/Error" },
                    {
                      type: "object",
                      properties: {
                        success: { type: "boolean", example: false },
                        error: { type: "string", example: "API key not configured" },
                        message: { type: "string" },
                        settingsUrl: { type: "string", example: "/settings" },
                      },
                    },
                  ],
                },
              },
            },
          },
          ...stdErrors,
        },
      },
    },

    // ───────────────────── Products & Stock ─────────────────────
    "/api/ai-tools/search-products": {
      post: {
        tags: ["Products & Stock"],
        summary: "Search products by name or SKU",
        description: "Case-insensitive substring match on name or SKU.",
        requestBody: jsonBody(
          {
            type: "object",
            required: ["query"],
            properties: {
              query: { type: "string", example: "mouse" },
              limit: { type: "integer", default: 10, minimum: 1 },
            },
          },
          { query: "mouse", limit: 5 }
        ),
        responses: {
          "200": ok("Matching products (may be empty)", { type: "array", items: { $ref: "#/components/schemas/ProductResult" } }),
          "400": errorRef("`query` is required"),
          ...stdErrors,
        },
      },
    },

    "/api/ai-tools/check-stock": {
      post: {
        tags: ["Products & Stock"],
        summary: "Check whether enough stock is available",
        description:
          "Returns `success: true` when stock covers the quantity. If it does not, returns **HTTP 200 with `success: false`**, `error: \"Insufficient stock\"` and the same `data` object (including `shortfall`).",
        requestBody: jsonBody(
          {
            type: "object",
            required: ["productId", "quantityNeeded"],
            properties: {
              productId: { type: "string" },
              quantityNeeded: { type: "number", minimum: 0, exclusiveMinimum: true },
            },
          },
          { productId: "abc123", quantityNeeded: 5 }
        ),
        responses: {
          "200": {
            description: "Stock check result (inspect `success`)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    error: { type: "string", example: "Insufficient stock" },
                    data: { $ref: "#/components/schemas/StockCheckResult" },
                  },
                },
              },
            },
          },
          "400": errorRef("Missing productId, or quantityNeeded not > 0"),
          "404": errorRef("Product not found (or belongs to another user)"),
          ...stdErrors,
        },
      },
    },

    "/api/ai-tools/add-stock": {
      post: {
        tags: ["Products & Stock"],
        summary: "Add stock to a product",
        description: [
          "Adds stock to a product in one atomic transaction:",
          "- increases `stockQuantity`;",
          "- if `unitCost` is given, recalculates the weighted-average cost (`averageCost`), `lastCost` and `totalValue`;",
          "- writes an `inventory_transactions` record (before/after stock, notes) and returns its real id as `transactionId`.",
          "",
          "The product's **selling price is never changed**.",
          "",
          "`source` maps to the ledger type: `production` → production, `return` → customer return, `adjustment` (default) → adjustment.",
        ].join("\n"),
        requestBody: jsonBody(
          {
            type: "object",
            required: ["productId", "quantity"],
            properties: {
              productId: { type: "string" },
              quantity: { type: "number", minimum: 0, exclusiveMinimum: true },
              source: { type: "string", enum: ["production", "adjustment", "return"] },
              unitCost: { type: "number", minimum: 0 },
              notes: { type: "string" },
            },
          },
          { productId: "abc123", quantity: 20, source: "production" }
        ),
        responses: {
          "200": ok("Stock updated", { $ref: "#/components/schemas/AddStockResult" }),
          "400": errorRef("Missing productId, quantity not positive, or invalid unitCost"),
          "404": errorRef("Product not found"),
          ...stdErrors,
        },
      },
    },

    // ───────────────────────── Customers ─────────────────────────
    "/api/ai-tools/search-customers": {
      post: {
        tags: ["Customers"],
        summary: "Search customers by name, email or phone",
        requestBody: jsonBody(
          {
            type: "object",
            required: ["query"],
            properties: {
              query: { type: "string", example: "ramesh" },
              limit: { type: "integer", default: 10, minimum: 1 },
            },
          },
          { query: "ramesh" }
        ),
        responses: {
          "200": ok("Matching customers (may be empty)", { type: "array", items: { $ref: "#/components/schemas/CustomerResult" } }),
          "400": errorRef("`query` is required"),
          ...stdErrors,
        },
      },
    },

    "/api/ai-tools/create-customer": {
      post: {
        tags: ["Customers"],
        summary: "Create a customer",
        description:
          "Idempotent by phone/email: if a customer with the same phone (or same email, case-insensitive) already exists, that customer is returned with `message: \"Customer already exists\"` and nothing is created.",
        requestBody: jsonBody(
          {
            type: "object",
            required: ["name", "phone"],
            properties: {
              name: { type: "string", example: "Ramesh Traders" },
              phone: { type: "string", example: "9876543210" },
              email: { type: "string", format: "email" },
              address: { type: "string" },
            },
          },
          { name: "Ramesh Traders", phone: "9876543210", address: "Andheri, Mumbai" }
        ),
        responses: {
          "200": ok("Customer created, or existing customer returned", { $ref: "#/components/schemas/CreateCustomerResult" }),
          "400": errorRef("Name or phone missing, or invalid email"),
          ...stdErrors,
        },
      },
    },

    // ─────────────────── Invoices & Payments ───────────────────
    "/api/ai-tools/create-invoice": {
      post: {
        tags: ["Invoices & Payments"],
        summary: "Create an invoice and deduct stock",
        description: [
          "Creates an invoice for a customer using each product's current selling price, deducts stock and logs inventory transactions **in one atomic transaction**.",
          "",
          "Defaults: due in 30 days, tax `0`, status `unpaid`, number `INV-<6 digits>`.",
          "",
          "**Insufficient stock** is reported as HTTP 200 with `success: false`. Unknown customer/product returns HTTP 400.",
        ].join("\n"),
        requestBody: jsonBody(
          {
            type: "object",
            required: ["customerId", "items"],
            properties: {
              customerId: { type: "string" },
              items: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  required: ["productId", "quantity"],
                  properties: { productId: { type: "string" }, quantity: { type: "number", minimum: 0, exclusiveMinimum: true } },
                },
              },
              notes: { type: "string" },
            },
          },
          { customerId: "cust1", items: [{ productId: "abc123", quantity: 2 }], notes: "Deliver Monday" }
        ),
        responses: {
          "200": {
            description: "Invoice created (`success: true`) or rejected for stock (`success: false`)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    error: { type: "string", example: "Insufficient stock for Wireless Mouse. Available: 1, Needed: 2" },
                    data: { $ref: "#/components/schemas/InvoiceResult" },
                  },
                },
              },
            },
          },
          "400": errorRef("Missing fields, customer not found, or product not found"),
          ...stdErrors,
        },
      },
    },

    "/api/ai-tools/get-invoice": {
      post: {
        tags: ["Invoices & Payments"],
        summary: "Get one invoice",
        requestBody: jsonBody(
          { type: "object", required: ["invoiceId"], properties: { invoiceId: { type: "string" } } },
          { invoiceId: "inv123" }
        ),
        responses: {
          "200": ok("Invoice details", { $ref: "#/components/schemas/InvoiceDetails" }),
          "400": errorRef("`invoiceId` is required"),
          "404": errorRef("Invoice not found"),
          ...stdErrors,
        },
      },
    },

    "/api/ai-tools/record-payment": {
      post: {
        tags: ["Invoices & Payments"],
        summary: "Record a customer payment",
        description:
          "Records a payment and, when `autoApply` is true (default), spreads it across the customer's unpaid invoices **oldest due date first**. Pass `invoiceIds` to restrict which invoices are eligible. Any amount not applied is stored as unapplied credit.\n\nNote: `appliedTo[].remainingBalance` is currently always `0` (placeholder).",
        requestBody: jsonBody(
          {
            type: "object",
            required: ["customerId", "amount", "paymentMethod"],
            properties: {
              customerId: { type: "string" },
              amount: { type: "number", minimum: 0, exclusiveMinimum: true, example: 5000 },
              paymentMethod: { type: "string", enum: ["cash", "bank_transfer", "cheque", "upi", "card", "other"] },
              invoiceIds: { type: "array", items: { type: "string" }, description: "Optional: only apply to these invoices" },
              autoApply: { type: "boolean", default: true },
            },
          },
          { customerId: "cust1", amount: 5000, paymentMethod: "upi" }
        ),
        responses: {
          "200": ok("Payment recorded", { $ref: "#/components/schemas/RecordPaymentResult" }),
          "400": errorRef("Missing customerId, or amount not positive"),
          "404": errorRef("Customer not found"),
          ...stdErrors,
        },
      },
    },

    // ───────────────────────── Reports ─────────────────────────
    "/api/ai-tools/get-customers-pending-payments": {
      post: {
        tags: ["Reports"],
        summary: "Customers who owe money",
        description:
          "Groups unpaid / partially paid / overdue invoices by customer, largest balance first. `totalCustomersWithPendingPayments` is the number of customers **returned** (after `limit`).",
        requestBody: jsonBody(
          { type: "object", properties: { limit: { type: "integer", default: 10, minimum: 1 } } },
          { limit: 5 }
        ),
        responses: {
          "200": ok("Customers with outstanding balances", { $ref: "#/components/schemas/PendingPaymentsResult" }),
          ...stdErrors,
        },
      },
    },

    "/api/ai-tools/get-customer-outstanding": {
      post: {
        tags: ["Reports"],
        summary: "Outstanding invoices for one customer",
        requestBody: jsonBody(
          { type: "object", required: ["customerId"], properties: { customerId: { type: "string" } } },
          { customerId: "cust1" }
        ),
        responses: {
          "200": ok("Outstanding balance and unpaid invoices, most overdue first", { $ref: "#/components/schemas/CustomerOutstandingResult" }),
          "400": errorRef("`customerId` is required"),
          "404": errorRef("Customer not found"),
          ...stdErrors,
        },
      },
    },

    "/api/ai-tools/get-low-stock": {
      post: {
        tags: ["Reports"],
        summary: "Products below a stock threshold",
        description: "Products with `stockQuantity < threshold`, lowest stock first.",
        requestBody: jsonBody(
          { type: "object", properties: { threshold: { type: "number", default: 10 } } },
          { threshold: 10 }
        ),
        responses: {
          "200": ok("Low-stock products (may be empty)", { type: "array", items: { $ref: "#/components/schemas/LowStockProduct" } }),
          ...stdErrors,
        },
      },
    },

    "/api/ai-tools/get-sales-summary": {
      post: {
        tags: ["Reports"],
        summary: "Sales summary for a period",
        description: "Defaults to the last 30 days. Dates are ISO strings (`2026-06-01`). Invoices are selected by creation date.",
        requestBody: jsonBody(
          {
            type: "object",
            properties: {
              startDate: { type: "string", format: "date", example: "2026-06-01" },
              endDate: { type: "string", format: "date", example: "2026-06-30" },
            },
          },
          { startDate: "2026-06-01", endDate: "2026-06-30" }
        ),
        responses: {
          "200": ok("Summary", { $ref: "#/components/schemas/SalesSummaryResult" }),
          ...stdErrors,
        },
      },
    },
  },

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Firebase ID token",
        description: "A Firebase Auth **ID token** (not a refresh token or API key). Expires after 1 hour.",
      },
    },
    responses: {
      Unauthorized: errorRef("Missing, invalid or expired ID token"),
      ServerError: errorRef("Unexpected server error (`details` holds the message)"),
    },
    schemas: {
      Error: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string", example: "Unauthorized" },
          details: { description: "Extra detail, mainly on 500s" },
        },
      },
      ChatTurn: {
        type: "object",
        required: ["role", "content"],
        properties: {
          role: { type: "string", enum: ["user", "assistant"] },
          content: { type: "string" },
        },
      },
      VoiceAction: {
        type: "object",
        required: ["intent", "is_complete", "missing_fields"],
        properties: {
          intent: { type: "string", enum: ["NAVIGATE", "SEARCH_PRODUCT", "CREATE_INVOICE", "VIEW_REPORT", "QUERY", "UNKNOWN"] },
          is_complete: { type: "boolean" },
          missing_fields: { type: "array", items: { type: "string" } },
          reply_prompt: { type: "string", description: "Follow-up question when information is missing" },
          target_screen: { type: "string", enum: ["dashboard", "inventory", "invoices", "customers", "payments", "purchase", "settings"] },
          search_query: { type: "string" },
          product_name: { type: "string" },
          customer_name: { type: "string" },
          invoice_items: { type: "string" },
          report_type: { type: "string", enum: ["revenue", "inventory", "customers"] },
          report_period: { type: "string", example: "this month" },
          answer: { type: "string", description: "Answer text for QUERY intents" },
        },
      },
      ProductResult: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          sku: { type: "string" },
          sellingPrice: { type: "number" },
          stockQuantity: { type: "number" },
          canBePurchased: { type: "boolean", description: "Currently always true" },
          canBeProduced: { type: "boolean", description: "Currently always false" },
        },
      },
      CustomerResult: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          totalOutstanding: { type: "number" },
        },
      },
      StockCheckResult: {
        type: "object",
        properties: {
          available: { type: "boolean" },
          currentStock: { type: "number" },
          quantityNeeded: { type: "number" },
          shortfall: { type: "number", description: "Only present when not available" },
          productName: { type: "string" },
        },
      },
      AddStockResult: {
        type: "object",
        properties: {
          productName: { type: "string" },
          quantityAdded: { type: "number" },
          newStockLevel: { type: "number" },
          transactionId: { type: "string", description: "Id of the inventory_transactions record" },
        },
      },
      CreateCustomerResult: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          phone: { type: "string" },
          message: { type: "string", example: "Customer created successfully" },
        },
      },
      InvoiceResult: {
        type: "object",
        properties: {
          invoiceId: { type: "string" },
          invoiceNumber: { type: "string", example: "INV-482913" },
          customerName: { type: "string" },
          totalAmount: { type: "number" },
          balanceAmount: { type: "number" },
          itemsCount: { type: "integer" },
          stockUpdated: { type: "boolean" },
          pdfUrl: { type: "string", description: "Placeholder; this route does not exist yet" },
        },
      },
      InvoiceDetails: {
        type: "object",
        properties: {
          invoiceNumber: { type: "string" },
          customerName: { type: "string" },
          items: { type: "array", items: { type: "object", additionalProperties: true } },
          totalAmount: { type: "number" },
          paidAmount: { type: "number" },
          balanceAmount: { type: "number" },
          status: { type: "string", enum: ["paid", "pending", "partially_paid", "overdue", "unpaid", "draft"] },
          invoiceDate: { type: "string", format: "date-time" },
          dueDate: { type: "string", format: "date-time" },
        },
      },
      RecordPaymentResult: {
        type: "object",
        properties: {
          paymentId: { type: "string" },
          paymentNumber: { type: "string", example: "PAY-48291377" },
          amount: { type: "number" },
          appliedTo: {
            type: "array",
            items: {
              type: "object",
              properties: {
                invoiceNumber: { type: "string" },
                amountApplied: { type: "number" },
                remainingBalance: { type: "number", description: "Currently always 0 (placeholder)" },
              },
            },
          },
          customerOutstanding: { type: "number" },
        },
      },
      PendingPaymentsResult: {
        type: "object",
        properties: {
          customers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                customerId: { type: "string" },
                customerName: { type: "string" },
                customerEmail: { type: "string" },
                totalOutstanding: { type: "number" },
                invoiceCount: { type: "integer" },
                oldestInvoiceDate: { type: "string", format: "date-time" },
              },
            },
          },
          totalCustomersWithPendingPayments: { type: "integer" },
        },
      },
      CustomerOutstandingResult: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          customerName: { type: "string" },
          totalOutstanding: { type: "number" },
          invoices: {
            type: "array",
            items: {
              type: "object",
              properties: {
                invoiceNumber: { type: "string" },
                totalAmount: { type: "number" },
                paidAmount: { type: "number" },
                balanceAmount: { type: "number" },
                dueDate: { type: "string", format: "date-time" },
                daysOverdue: { type: "integer", minimum: 0 },
              },
            },
          },
        },
      },
      LowStockProduct: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          currentStock: { type: "number" },
          reorderLevel: { type: "number", description: "Echoes the threshold used" },
          shortfall: { type: "number" },
        },
      },
      SalesSummaryResult: {
        type: "object",
        properties: {
          period: { type: "string", example: "10/10/2026 - 9/11/2026" },
          totalRevenue: { type: "number" },
          totalInvoices: { type: "integer" },
          averageOrderValue: { type: "number" },
          topProducts: {
            type: "array",
            description: "Top 5 by revenue",
            items: {
              type: "object",
              properties: { name: { type: "string" }, quantitySold: { type: "number" }, revenue: { type: "number" } },
            },
          },
          paymentStatus: {
            type: "object",
            properties: { collected: { type: "number" }, outstanding: { type: "number" } },
          },
        },
      },
    },
  },
};
