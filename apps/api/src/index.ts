import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be a positive integer");
}

const app = createApp();

app.listen(port, "0.0.0.0", () => {
  console.log(`API listening on port ${port}`);
});
