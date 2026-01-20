// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract RegisterAgentsScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address registryAddress = vm.envAddress("AGENT_REGISTRY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        AgentRegistry registry = AgentRegistry(registryAddress);

        console.log("Registering agents...");

        // Agent 1: Smart Contract Analyzer
        uint256 agent1 = registry.registerAgent(
            "Smart Contract Analyzer",
            "Analyzes Solidity contracts for vulnerabilities and security issues",
            100000 // 0.10 USDC (6 decimals)
        );
        console.log("Agent 1 registered with ID:", agent1);

        // Agent 2: Market Data Agent
        uint256 agent2 = registry.registerAgent(
            "Market Data Agent",
            "Fetches and analyzes Crypto.com market data and price trends",
            50000 // 0.05 USDC (6 decimals)
        );
        console.log("Agent 2 registered with ID:", agent2);

        // Agent 3: Content Generator
        uint256 agent3 = registry.registerAgent(
            "Content Generator",
            "Creates marketing content for Web3 projects",
            20000 // 0.02 USDC (6 decimals)
        );
        console.log("Agent 3 registered with ID:", agent3);

        // Agent 4: Portfolio Analyzer
        uint256 agent4 = registry.registerAgent(
            "Portfolio Analyzer",
            "Analyzes DeFi portfolios and suggests optimization strategies",
            150000 // 0.15 USDC (6 decimals)
        );
        console.log("Agent 4 registered with ID:", agent4);

        vm.stopBroadcast();

        console.log("All agents registered successfully!");
    }
}
