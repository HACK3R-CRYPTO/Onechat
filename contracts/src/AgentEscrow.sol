// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {AgentRegistry} from "./AgentRegistry.sol";

contract AgentEscrow {
    IERC20 public immutable paymentToken;
    AgentRegistry public immutable registry;
    address public immutable platformFeeRecipient;
    uint16 public platformFeeBps;

    mapping(bytes32 => uint256) public escrowedAmounts;
    mapping(bytes32 => bool) public released;

    event PaymentEscrowed(
        bytes32 indexed paymentHash,
        address indexed payer,
        uint256 amount
    );

    event PaymentReleased(
        bytes32 indexed paymentHash,
        address indexed developer,
        uint256 amount
    );

    event PaymentRefunded(
        bytes32 indexed paymentHash,
        address indexed payer,
        uint256 amount
    );

    constructor(
        IERC20 _paymentToken,
        AgentRegistry _registry,
        address _platformFeeRecipient,
        uint16 _platformFeeBps
    ) {
        require(address(_paymentToken) != address(0), "Invalid token");
        require(address(_registry) != address(0), "Invalid registry");
        require(_platformFeeRecipient != address(0), "Invalid recipient");
        require(_platformFeeBps <= 2000, "Fee too high");

        paymentToken = _paymentToken;
        registry = _registry;
        platformFeeRecipient = _platformFeeRecipient;
        platformFeeBps = _platformFeeBps;
    }

    function escrowPayment(
        bytes32 paymentHash,
        uint256 amount
    ) external {
        require(amount > 0, "Amount must be positive");
        require(escrowedAmounts[paymentHash] == 0, "Already escrowed");

        require(
            paymentToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        escrowedAmounts[paymentHash] = amount;

        emit PaymentEscrowed(paymentHash, msg.sender, amount);
    }

    function releasePayment(
        bytes32 paymentHash,
        uint256 agentId
    ) external {
        require(!released[paymentHash], "Already released");
        require(escrowedAmounts[paymentHash] > 0, "No escrow");

        AgentRegistry.Agent memory agent = registry.getAgent(agentId);
        require(agent.developer != address(0), "Agent not found");

        uint256 amount = escrowedAmounts[paymentHash];
        uint256 platformFee = (amount * platformFeeBps) / 10000;
        uint256 developerAmount = amount - platformFee;

        released[paymentHash] = true;

        if (platformFee > 0) {
            require(
                paymentToken.transfer(platformFeeRecipient, platformFee),
                "Platform fee transfer failed"
            );
        }

        require(
            paymentToken.transfer(agent.developer, developerAmount),
            "Developer transfer failed"
        );

        emit PaymentReleased(paymentHash, agent.developer, developerAmount);
    }

    function refundPayment(bytes32 paymentHash, address payer) external {
        require(!released[paymentHash], "Already released");
        require(escrowedAmounts[paymentHash] > 0, "No escrow");

        uint256 amount = escrowedAmounts[paymentHash];
        released[paymentHash] = true;

        require(
            paymentToken.transfer(payer, amount),
            "Refund transfer failed"
        );

        emit PaymentRefunded(paymentHash, payer, amount);
    }
}
