// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TreeRegistry.sol";

/**
 * @title CarbonCredit
 * @dev Production-ready carbon credit ledger with oracle-controlled issuance.
 * 
 * Design principles:
 * - All credit calculations happen OFF-CHAIN (cron jobs, MRV system)
 * - This contract is a LEDGER only: mint, transfer, burn
 * - Only the issuerOracle (backend) can mint new credits
 * - Anyone can transfer their own credits
 * - Anyone can retire (burn) their own credits
 * - Admin can slash credits for dead trees / fraud
 * - Contract can be paused for emergencies
 * 
 * 1 credit = 1 kg CO2 absorbed
 */
contract CarbonCredit {
    // ============ State Variables ============
    
    TreeRegistry public immutable treeRegistry;
    
    address public owner;
    address public issuerOracle;
    bool public paused;
    
    uint256 public totalCreditsIssued;
    uint256 public totalCreditsRetired;
    uint256 public totalCreditsSlashed;
    
    mapping(address => uint256) public creditBalance;
    mapping(uint256 => uint256) public creditsIssuedForTree;
    
    // ============ Records ============
    
    struct IssuanceRecord {
        uint256 treeId;
        address recipient;
        uint256 amount;
        uint256 timestamp;
        bytes32 batchId;
    }
    IssuanceRecord[] public issuances;
    
    struct RetirementRecord {
        address retiree;
        uint256 amount;
        uint256 timestamp;
        string reason;
        bytes32 certificateHash;
    }
    RetirementRecord[] public retirements;
    
    struct SlashRecord {
        uint256 treeId;
        address from;
        uint256 amount;
        uint256 timestamp;
        string reason;
    }
    SlashRecord[] public slashes;
    
    // ============ Events ============
    
    event CreditsIssued(
        uint256 indexed treeId,
        address indexed recipient,
        uint256 amount,
        bytes32 batchId,
        uint256 timestamp
    );
    
    event CreditsTransferred(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );
    
    event CreditsRetired(
        address indexed retiree,
        uint256 amount,
        string reason,
        bytes32 certificateHash,
        uint256 retirementId,
        uint256 timestamp
    );
    
    event CreditsSlashed(
        uint256 indexed treeId,
        address indexed from,
        uint256 amount,
        string reason,
        uint256 timestamp
    );
    
    event Paused(address by);
    event Unpaused(address by);
    event IssuerOracleChanged(address oldIssuer, address newIssuer);
    event OwnerChanged(address oldOwner, address newOwner);
    
    // ============ Errors ============
    
    error NotOwner();
    error NotIssuerOracle();
    error ContractPaused();
    error InsufficientCredits(uint256 requested, uint256 available);
    error InvalidAmount();
    error ZeroAddress();
    error InvalidTreeId();
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    
    modifier onlyIssuer() {
        if (msg.sender != issuerOracle) revert NotIssuerOracle();
        _;
    }
    
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _treeRegistry, address _issuerOracle) {
        require(_treeRegistry != address(0), "Invalid TreeRegistry");
        require(_issuerOracle != address(0), "Invalid issuer");
        treeRegistry = TreeRegistry(_treeRegistry);
        owner = msg.sender;
        issuerOracle = _issuerOracle;
        paused = false;
    }
    
    // ============ Admin Functions ============
    
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }
    
    function setIssuerOracle(address _issuerOracle) external onlyOwner {
        if (_issuerOracle == address(0)) revert ZeroAddress();
        address old = issuerOracle;
        issuerOracle = _issuerOracle;
        emit IssuerOracleChanged(old, _issuerOracle);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address old = owner;
        owner = newOwner;
        emit OwnerChanged(old, newOwner);
    }
    
    // ============ Issuer Functions (Backend/Oracle) ============
    
    /**
     * @notice Mint credits to a tree owner. Called by backend cron job.
     * @param treeId On-chain tree ID
     * @param recipient Address to receive credits (tree owner)
     * @param amount Credits to mint (kg CO2)
     * @param batchId Off-chain batch reference for audit trail
     */
    function issueCredits(
        uint256 treeId,
        address recipient,
        uint256 amount,
        bytes32 batchId
    ) external onlyIssuer whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert ZeroAddress();
        
        address treeOwner = treeRegistry.ownerOf(treeId);
        if (treeOwner == address(0)) revert InvalidTreeId();
        
        creditsIssuedForTree[treeId] += amount;
        creditBalance[recipient] += amount;
        totalCreditsIssued += amount;
        
        issuances.push(IssuanceRecord({
            treeId: treeId,
            recipient: recipient,
            amount: amount,
            timestamp: block.timestamp,
            batchId: batchId
        }));
        
        emit CreditsIssued(treeId, recipient, amount, batchId, block.timestamp);
    }
    
    /**
     * @notice Slash (burn) credits due to tree death or fraud.
     * @param treeId Tree that died
     * @param from Address to slash credits from
     * @param amount Credits to slash
     * @param reason Explanation
     */
    function slashCredits(
        uint256 treeId,
        address from,
        uint256 amount,
        string calldata reason
    ) external onlyIssuer whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        if (creditBalance[from] < amount) {
            revert InsufficientCredits(amount, creditBalance[from]);
        }
        
        creditBalance[from] -= amount;
        totalCreditsSlashed += amount;
        
        slashes.push(SlashRecord({
            treeId: treeId,
            from: from,
            amount: amount,
            timestamp: block.timestamp,
            reason: reason
        }));
        
        emit CreditsSlashed(treeId, from, amount, reason, block.timestamp);
    }
    
    // ============ User Functions ============
    
    function transferCredits(address to, uint256 amount) external whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (creditBalance[msg.sender] < amount) {
            revert InsufficientCredits(amount, creditBalance[msg.sender]);
        }
        
        creditBalance[msg.sender] -= amount;
        creditBalance[to] += amount;
        
        emit CreditsTransferred(msg.sender, to, amount, block.timestamp);
    }
    
    function retireCredits(
        uint256 amount,
        string calldata reason,
        bytes32 certificateHash
    ) external whenNotPaused returns (uint256 retirementId) {
        if (amount == 0) revert InvalidAmount();
        if (creditBalance[msg.sender] < amount) {
            revert InsufficientCredits(amount, creditBalance[msg.sender]);
        }
        
        creditBalance[msg.sender] -= amount;
        totalCreditsRetired += amount;
        
        retirementId = retirements.length;
        retirements.push(RetirementRecord({
            retiree: msg.sender,
            amount: amount,
            timestamp: block.timestamp,
            reason: reason,
            certificateHash: certificateHash
        }));
        
        emit CreditsRetired(
            msg.sender,
            amount,
            reason,
            certificateHash,
            retirementId,
            block.timestamp
        );
    }
    
    // ============ View Functions ============
    
    function balanceOf(address account) external view returns (uint256) {
        return creditBalance[account];
    }
    
    function totalSupply() external view returns (uint256) {
        return totalCreditsIssued - totalCreditsRetired - totalCreditsSlashed;
    }
    
    function getIssuanceCount() external view returns (uint256) {
        return issuances.length;
    }
    
    function getRetirementCount() external view returns (uint256) {
        return retirements.length;
    }
    
    function getSlashCount() external view returns (uint256) {
        return slashes.length;
    }
    
    function getRetirement(uint256 id) external view returns (
        address retiree,
        uint256 amount,
        uint256 timestamp,
        string memory reason,
        bytes32 certificateHash
    ) {
        require(id < retirements.length, "Invalid ID");
        RetirementRecord storage r = retirements[id];
        return (r.retiree, r.amount, r.timestamp, r.reason, r.certificateHash);
    }
    
    function getSlash(uint256 id) external view returns (
        uint256 treeId,
        address from,
        uint256 amount,
        uint256 timestamp,
        string memory reason
    ) {
        require(id < slashes.length, "Invalid ID");
        SlashRecord storage s = slashes[id];
        return (s.treeId, s.from, s.amount, s.timestamp, s.reason);
    }
}
