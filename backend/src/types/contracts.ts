/**
 * Contract ABIs for backend
 */

export const AGENT_REGISTRY_ABI = [
  "function registerAgent(string memory name, string memory description, uint256 pricePerExecution) external returns (uint256 agentId)",
  "function executeAgent(uint256 agentId, bytes32 paymentHash, string memory input) external returns (uint256 executionId)",
  "function verifyExecution(uint256 executionId, string memory output, bool success) external",
  "function getAgent(uint256 agentId) external view returns (tuple(address developer, string name, string description, uint256 pricePerExecution, uint256 totalExecutions, uint256 successfulExecutions, uint256 reputation, bool active))",
  "function getExecution(uint256 executionId) external view returns (tuple(uint256 agentId, address user, bytes32 paymentHash, string input, string output, bool verified, uint256 timestamp))",
  "function nextAgentId() external view returns (uint256)",
  "function nextExecutionId() external view returns (uint256)",
  "event AgentRegistered(uint256 indexed agentId, address indexed developer, string name, uint256 pricePerExecution)",
  "event AgentExecuted(uint256 indexed executionId, uint256 indexed agentId, address indexed user, bytes32 paymentHash)",
  "event ExecutionVerified(uint256 indexed executionId, bool success, string output)",
  "event ReputationUpdated(uint256 indexed agentId, uint256 newReputation)",
] as const;
