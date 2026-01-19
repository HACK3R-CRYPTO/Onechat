// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {AgentEscrow} from "../src/AgentEscrow.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Cronos Testnet USDC.e address
        address usdcAddress = 0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0;
        address platformFeeRecipient = deployer; // Change to your platform fee recipient
        uint16 platformFeeBps = 1000; // 10%

        console.log("Deploying AgentRegistry...");
        AgentRegistry registry = new AgentRegistry(
            IERC20(usdcAddress),
            platformFeeRecipient,
            platformFeeBps
        );

        console.log("AgentRegistry deployed at:", address(registry));

        console.log("Deploying AgentEscrow...");
        AgentEscrow escrow = new AgentEscrow(
            IERC20(usdcAddress),
            registry,
            platformFeeRecipient,
            platformFeeBps
        );

        console.log("AgentEscrow deployed at:", address(escrow));

        vm.stopBroadcast();

        console.log("Deployment complete!");
        console.log("Update these addresses in your .env files:");
        console.log("AGENT_REGISTRY_ADDRESS=", address(registry));
        console.log("AGENT_ESCROW_ADDRESS=", address(escrow));
    }
}
