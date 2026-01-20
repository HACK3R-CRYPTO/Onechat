import dotenv from "dotenv";
// Load environment variables FIRST before any other imports
dotenv.config();

import express from "express";
import cors from "cors";
import agentsRouter from "./api/agents";
import executionsRouter from "./api/executions";
import { initializeFacilitator } from "./x402/facilitator";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (req: express.Request, res: express.Response) => {
  res.json({ status: "ok", message: "AgentMarket backend is running" });
});

app.use("/api/agents", agentsRouter);
app.use("/api/executions", executionsRouter);

// Initialize x402 facilitator on server startup
async function startServer() {
  try {
    console.log("Initializing x402 facilitator...");
    await initializeFacilitator();
    console.log("✅ x402 facilitator initialized");
  } catch (error) {
    console.error("⚠️  Failed to initialize x402 facilitator:", error);
    console.error("⚠️  Payment features may not work correctly");
  }

  app.listen(PORT, () => {
    console.log(`AgentMarket backend running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api/agents`);
  });
}

startServer();
