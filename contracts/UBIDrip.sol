// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title UBIDrip
 * @notice Weekly UBI distribution contract for ETH and ERC20 tokens
 * @dev Admin can manage recipients, set rates, and trigger distributions
 */
contract UBIDrip is Ownable, ReentrancyGuard {
    // Token to distribute (e.g., $owockibot)
    IERC20 public token;
    
    // Weekly rates per recipient
    uint256 public ethPerRecipient;
    uint256 public tokensPerRecipient;
    
    // Recipients list
    address[] public recipients;
    mapping(address => bool) public isRecipient;
    mapping(address => string) public recipientLabels; // Optional labels like "@Mutheu"
    
    // Distribution tracking
    uint256 public lastDistribution;
    uint256 public totalEthDistributed;
    uint256 public totalTokensDistributed;
    uint256 public distributionCount;
    
    // Events
    event RecipientAdded(address indexed recipient, string label);
    event RecipientRemoved(address indexed recipient);
    event RatesUpdated(uint256 ethPerRecipient, uint256 tokensPerRecipient);
    event Distribution(uint256 indexed distributionId, uint256 totalEth, uint256 totalTokens, uint256 recipientCount);
    event TokenUpdated(address indexed newToken);
    
    constructor(address _token, address _admin) Ownable(_admin) {
        token = IERC20(_token);
        lastDistribution = block.timestamp;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Add a recipient to the UBI list
     */
    function addRecipient(address _recipient, string calldata _label) external onlyOwner {
        require(_recipient != address(0), "Invalid address");
        require(!isRecipient[_recipient], "Already a recipient");
        
        recipients.push(_recipient);
        isRecipient[_recipient] = true;
        recipientLabels[_recipient] = _label;
        
        emit RecipientAdded(_recipient, _label);
    }
    
    /**
     * @notice Remove a recipient from the UBI list
     */
    function removeRecipient(address _recipient) external onlyOwner {
        require(isRecipient[_recipient], "Not a recipient");
        
        isRecipient[_recipient] = false;
        recipientLabels[_recipient] = "";
        
        // Remove from array (swap and pop)
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == _recipient) {
                recipients[i] = recipients[recipients.length - 1];
                recipients.pop();
                break;
            }
        }
        
        emit RecipientRemoved(_recipient);
    }
    
    /**
     * @notice Update weekly distribution rates
     */
    function setRates(uint256 _ethPerRecipient, uint256 _tokensPerRecipient) external onlyOwner {
        ethPerRecipient = _ethPerRecipient;
        tokensPerRecipient = _tokensPerRecipient;
        
        emit RatesUpdated(_ethPerRecipient, _tokensPerRecipient);
    }
    
    /**
     * @notice Update the token address
     */
    function setToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid token");
        token = IERC20(_token);
        emit TokenUpdated(_token);
    }
    
    /**
     * @notice Distribute UBI to all recipients
     */
    function distribute() external onlyOwner nonReentrant {
        uint256 recipientCount = recipients.length;
        require(recipientCount > 0, "No recipients");
        
        uint256 totalEthNeeded = ethPerRecipient * recipientCount;
        uint256 totalTokensNeeded = tokensPerRecipient * recipientCount;
        
        require(address(this).balance >= totalEthNeeded, "Insufficient ETH");
        require(token.balanceOf(address(this)) >= totalTokensNeeded, "Insufficient tokens");
        
        distributionCount++;
        
        for (uint256 i = 0; i < recipientCount; i++) {
            address recipient = recipients[i];
            
            // Send ETH
            if (ethPerRecipient > 0) {
                (bool success, ) = recipient.call{value: ethPerRecipient}("");
                require(success, "ETH transfer failed");
            }
            
            // Send tokens
            if (tokensPerRecipient > 0) {
                require(token.transfer(recipient, tokensPerRecipient), "Token transfer failed");
            }
        }
        
        totalEthDistributed += totalEthNeeded;
        totalTokensDistributed += totalTokensNeeded;
        lastDistribution = block.timestamp;
        
        emit Distribution(distributionCount, totalEthNeeded, totalTokensNeeded, recipientCount);
    }
    
    /**
     * @notice Emergency withdraw all funds (admin only)
     */
    function emergencyWithdraw() external onlyOwner {
        // Withdraw ETH
        uint256 ethBalance = address(this).balance;
        if (ethBalance > 0) {
            (bool success, ) = owner().call{value: ethBalance}("");
            require(success, "ETH withdraw failed");
        }
        
        // Withdraw tokens
        uint256 tokenBalance = token.balanceOf(address(this));
        if (tokenBalance > 0) {
            require(token.transfer(owner(), tokenBalance), "Token withdraw failed");
        }
    }
    
    // ============ View Functions ============
    
    function getRecipients() external view returns (address[] memory) {
        return recipients;
    }
    
    function getRecipientCount() external view returns (uint256) {
        return recipients.length;
    }
    
    function getContractBalances() external view returns (uint256 ethBalance, uint256 tokenBalance) {
        return (address(this).balance, token.balanceOf(address(this)));
    }
    
    function getDistributionCost() external view returns (uint256 ethNeeded, uint256 tokensNeeded) {
        uint256 count = recipients.length;
        return (ethPerRecipient * count, tokensPerRecipient * count);
    }
    
    function getRecipientInfo(address _recipient) external view returns (
        bool active,
        string memory label
    ) {
        return (isRecipient[_recipient], recipientLabels[_recipient]);
    }
    
    // ============ Receive ETH ============
    
    receive() external payable {}
}
