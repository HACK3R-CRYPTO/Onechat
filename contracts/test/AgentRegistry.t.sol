// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;
    address public usdc = address(0x1234); // Mock USDC
    address public platformFeeRecipient = address(0x5678);
    address public developer = address(0x9ABC);
    address public user = address(0xDEF0);

    function setUp() public {
        vm.prank(developer);
        registry = new AgentRegistry(
            IERC20(usdc),
            platformFeeRecipient,
            1000 // 10% fee
        );
    }

    function testRegisterAgent() public {
        vm.prank(developer);
        uint256 agentId = registry.registerAgent(
            "Test Agent",
            "Test Description",
            1000000 // 1 USDC (6 decimals)
        );

        assertEq(agentId, 1);
        AgentRegistry.Agent memory agent = registry.getAgent(agentId);
        assertEq(agent.developer, developer);
        assertEq(agent.name, "Test Agent");
        assertEq(agent.pricePerExecution, 1000000);
        assertEq(agent.reputation, 500);
        assertTrue(agent.active);
    }

    function testExecuteAgent() public {
        vm.prank(developer);
        uint256 agentId = registry.registerAgent(
            "Test Agent",
            "Test Description",
            1000000
        );

        bytes32 paymentHash = keccak256("test-payment");
        vm.prank(user);
        uint256 executionId = registry.executeAgent(
            agentId,
            paymentHash,
            "test input"
        );

        assertEq(executionId, 1);
        AgentRegistry.Execution memory exec = registry.getExecution(executionId);
        assertEq(exec.agentId, agentId);
        assertEq(exec.user, user);
        assertEq(exec.paymentHash, paymentHash);
        assertEq(exec.input, "test input");
        assertFalse(exec.verified);
    }

    function testVerifyExecution() public {
        vm.prank(developer);
        uint256 agentId = registry.registerAgent(
            "Test Agent",
            "Test Description",
            1000000
        );

        bytes32 paymentHash = keccak256("test-payment");
        vm.prank(user);
        uint256 executionId = registry.executeAgent(
            agentId,
            paymentHash,
            "test input"
        );

        vm.prank(platformFeeRecipient);
        registry.verifyExecution(executionId, "test output", true);

        AgentRegistry.Execution memory exec = registry.getExecution(executionId);
        assertTrue(exec.verified);
        assertEq(exec.output, "test output");

        AgentRegistry.Agent memory agent = registry.getAgent(agentId);
        assertEq(agent.successfulExecutions, 1);
        assertEq(agent.reputation, 1000);
    }
}
