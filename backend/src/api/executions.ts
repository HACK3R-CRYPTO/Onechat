import { Router, Request, Response } from "express";

const router = Router();

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const executionId = req.params.id;
    // TODO: Fetch execution from contract or database
    const execution = {
      id: executionId,
      agentId: 1,
      user: "0x...",
      input: "Sample input",
      output: "Sample output",
      success: true,
      timestamp: Date.now(),
    };

    res.json({ execution });
  } catch (error) {
    console.error("Error fetching execution:", error);
    res.status(500).json({ error: "Failed to fetch execution" });
  }
});

export default router;
