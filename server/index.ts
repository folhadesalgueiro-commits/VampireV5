import { createApp } from "./app";
const port = Number(process.env.PORT || 3001),
  host = process.env.V5_HOST || "127.0.0.1";
const server = createApp().listen(port, host, () =>
  console.log(`Crônica V5 iniciada na porta ${port}.`),
);
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
