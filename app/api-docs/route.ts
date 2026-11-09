/**
 * GET /api-docs — interactive Swagger UI for the Invento.ai API.
 *
 * Served as a plain HTML route handler (not a React page) so it is independent
 * of the app layout and auth providers. Swagger UI is loaded from a pinned
 * version on jsDelivr and reads the spec from /api/openapi.
 */
const SWAGGER_UI_VERSION = "5.17.14";

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invento.ai API Docs</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css" />
    <style>body { margin: 0; } .topbar { display: none; }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: "/api/openapi",
          dom_id: "#swagger-ui",
          deepLinking: true,
          persistAuthorization: true,
          tryItOutEnabled: true,
          docExpansion: "list",
          defaultModelsExpandDepth: 0,
        });
      };
    </script>
  </body>
</html>`;

export async function GET() {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
