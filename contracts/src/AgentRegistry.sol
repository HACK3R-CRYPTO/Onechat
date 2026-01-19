// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract AgentRegistry {
    struct Agent {
        address developer;
        string name;
        string description;
        uint256 pricePerExecution;
        uint256 totalExecutions;
        uint256 successfulExecutions;
        uint256 reputation;
        bool active;
    }

    struct Execution {
        uint256 agentId;
        address user;
        bytes32 paymentHash;
        string input;
        string output;
        bool verified;
        uint256 timestamp;
    }

    IERC20 public immutable paymentToken;
    address public immutable platformFeeRecipient;
    uint16 public platformFeeBps;

    mapping(uint256 => Agent) public agents;
    mapping(uint256 => Execution) public executions;
    mapping(bytes32 => bool) public usedPayments;

    uint256 public nextAgentId = 1;
    uint256 public nextExecutionId = 1;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed developer,
        string name,
        uint256 pricePerExecution
    );

    event AgentExecuted(
        uint256 indexed executionId,
        uint256 indexed agentId,
        address indexed user,
        bytes32 paymentHash
    );

    event ExecutionVerified(
        uint256 indexed executionId,
        bool success,
        string output
    );

    event ReputationUpdated(
        uint256 indexed agentId,
        uint256 newReputation
    );

    constructor(
        IERC20 _paymentToken,
        address _platformFeeRecipient,
        uint16 _platformFeeBps
    ) {
        require(address(_paymentToken) != address(0), "Invalid token");
        require(_platformFeeRecipient != address(0), "Invalid recipient");
        require(_platformFeeBps <= 2000, "Fee too high");
        paymentToken = _paymentToken;
        platformFeeRecipient = _platformFeeRecipient;
        platformFeeBps = _platformFeeBps;
    }

    function registerAgent(
        string memory name,
        string memory description,
        uint256 pricePerExecution
    ) external returns (uint256 agentId) {
        require(bytes(name).length > 0, "Name required");
        require(pricePerExecution > 0, "Price must be positive");

        agentId = nextAgentId++;
        agents[agentId] = Agent({
            developer: msg.sender,
            name: name,
            description: description,
            pricePerExecution: pricePerExecution,
            totalExecutions: 0,
            successfulExecutions: 0,
            reputation: 500,
            active: true
        });

        emit AgentRegistered(agentId, msg.sender, name, pricePerExecution);
    }

    function executeAgent(
        uint256 agentId,
        bytes32 paymentHash,
        string memory input
    ) external returns (uint256 executionId) {
        Agent storage agent = agents[agentId];
        require(agent.developer != address(0), "Agent not found");
        require(agent.active, "Agent not active");
        require(!usedPayments[paymentHash], "Payment already used");
        require(bytes(input).length > 0, "Input required");

        usedPayments[paymentHash] = true;
        executionId = nextExecutionId++;

        executions[executionId] = Execution({
            agentId: agentId,
            user: msg.sender,
            paymentHash: paymentHash,
            input: input,
            output: "",
            verified: false,
            timestamp: block.timestamp
        });

        agent.totalExecutions++;

        emit AgentExecuted(executionId, agentId, msg.sender, paymentHash);
    }

    function verifyExecution(
        uint256 executionId,
        string memory output,
        bool success
    ) external {
        Execution storage exec = executions[executionId];
        require(exec.agentId != 0, "Execution not found");
        require(!exec.verified, "Already verified");

        exec.output = output;
        exec.verified = true;

        Agent storage agent = agents[exec.agentId];
        if (success) {
            agent.successfulExecutions++;
        }

        if (agent.totalExecutions > 0) {
            agent.reputation =
                (agent.successfulExecutions * 1000) /
                agent.totalExecutions;
        }

        emit ExecutionVerified(executionId, success, output);
        emit ReputationUpdated(exec.agentId, agent.reputation);
    }

    function getAgent(
        uint256 agentId
    ) external view returns (Agent memory) {
        return agents[agentId];
    }

    function getExecution(
        uint256 executionId
    ) external view returns (Execution memory) {
        return executions[executionId];
    }
}
