// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CrypTip is Ownable, ReentrancyGuard {

    uint256 public platformFeePercentage = 5;

    mapping(address => uint256) public balances;
    mapping(address => uint256) public totalEarned;
    mapping(address => uint256) public totalTipped;

    event NewTip(
        address indexed from, 
        address indexed to, 
        uint256 timestamp, 
        string name, 
        string message, 
        uint256 amount, 
        uint256 fee
    );
    
    event Withdrawn(address indexed streamer, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function sendTip(address _streamer, string memory _name, string memory _message) external payable nonReentrant {
        require(msg.value > 0, "Value tip must be greater than zero");
        require(_streamer != address(0), "Address is not valid");

        uint256 feeAmount = (msg.value * platformFeePercentage) / 100;
        uint256 streamerAmount = msg.value - feeAmount;

        balances[_streamer] += streamerAmount;
        balances[owner()] += feeAmount; 

        totalEarned[_streamer] += streamerAmount;
        totalTipped[msg.sender] += msg.value; 

        emit NewTip(msg.sender, _streamer, block.timestamp, _name, _message, streamerAmount, feeAmount);
    }

    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No Balances to Withdraw");

        balances[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdraw Failed!");

        emit Withdrawn(msg.sender, amount);
    }

    function setFeePercentage(uint256 _newFee) external onlyOwner {
        require(_newFee <= 20, "Maximum is 20%");
        platformFeePercentage = _newFee;
    }

    function getStreamerStats(address _streamer) external view returns (
        uint256 currentBalance,
        uint256 lifetimeEarned,
        uint256 lifetimeTipped
    ) {
        return (
            balances[_streamer],
            totalEarned[_streamer],
            totalTipped[_streamer]
        );
    }
}
