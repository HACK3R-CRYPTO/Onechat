import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import agentsRouter from "./api/agents";
import executionsRouter from "./api/executions";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (req: express.Request, res: express.Response) => {
  res.json({ status: "ok", message: "AgentMarket backend is running" });
});

app.use("/api/agents", agentsRouter);
app.use("/api/executions", executionsRouter);

app.listen(PORT, () => {
  console.log(`AgentMarket backend running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api/agents`);
});
