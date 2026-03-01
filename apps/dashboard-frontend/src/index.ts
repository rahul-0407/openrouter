import { serve } from "bun";
import index from "./index.html";
import { existsSync } from "fs";
import path from "path";

const publicDir = path.join(process.cwd(), "public");

const server = serve({
  routes: {
    // Serve static files from public directory
    "/assets/*": async (req) => {
      const url = new URL(req.url);
      const assetPath = url.pathname.replace("/assets/", "");
      const filePath = path.join(publicDir, "assets", assetPath);
      if (existsSync(filePath)) {
        const file = Bun.file(filePath);
        return new Response(file);
      }
      return new Response("Not found", { status: 404 });
    },
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async req => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
