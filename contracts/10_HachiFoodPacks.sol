// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HachiFoodPacks
 * @notice Sistema de packs de comida que producen KOBAN
 * @dev Formula: (WLD_VALUE * KOBAN_RATE - 20%) / DAYS = KOBAN diario
 *      Agua: 100 HACHI/dia (indispensable para producir)
 */
contract HachiFoodPacks is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    IERC20 public immutable wldToken;
    IERC20 public immutable hachiToken;
    IERC20 public immutable kobanToken;
    
    // Water cost (indispensable)
    uint256 public constant DAILY_WATER_COST = 100 * 10**18; // 100 HACHI
    
    // KOBAN rate per WLD
    uint256 public constant KOBAN_PER_WLD = 1000 * 10**18; // 1000 KOBAN per WLD
    uint256 public constant DISTRIBUTION_PERCENT = 80; // 80% distributed (20% fee)
    
    // Food pack types
    struct FoodPackType {
        uint256 id;
        uint256 days;
        uint256 wldCost;
        uint256 totalKoban; // Total KOBAN value
        uint256 dailyKoban; // Daily KOBAN reward
        bool active;
    }
    
    FoodPackType[] public packTypes;
    
    // User's active food pack
    struct UserFoodPack {
        uint256 packTypeId;
        uint256 startTime;
        uint256 endTime;
        uint256 lastClaimTime;
        uint256 lastWaterTime;
        uint256 totalKobanClaimed;
        bool active;
    }
    
    mapping(address => UserFoodPack) public userPacks;
    
    // Stats
    uint256 public totalPacksSold;
    uint256 public totalWLDCollected;
    uint256 public totalKobanDistributed;
    
    // Wallets
    address public adminWallet;
    
    // KOBAN rewards pool
    uint256 public kobanRewardsPool;
    
    // Events
    event PackPurchased(address indexed user, uint256 packTypeId, uint256 days, uint256 wldPaid);
    event WaterPaid(address indexed user, uint256 hachiPaid);
    event KobanClaimed(address indexed user, uint256 amount);
    event PackExpired(address indexed user);
    event PackTypeAdded(uint256 id, uint256 days, uint256 wldCost, uint256 dailyKoban);
    
    constructor(
        address _wldToken,
        address _hachiToken,
        address _kobanToken,
        address _adminWallet
    ) {
        require(_wldToken != address(0), "Invalid WLD token");
        require(_hachiToken != address(0), "Invalid HACHI token");
        require(_kobanToken != address(0), "Invalid KOBAN token");
        require(_adminWallet != address(0), "Invalid admin wallet");
        
        wldToken = IERC20(_wldToken);
        hachiToken = IERC20(_hachiToken);
        kobanToken = IERC20(_kobanToken);
        adminWallet = _adminWallet;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        
        // Initialize pack types
        // Pack 7 dias: 1 WLD -> 1000 KOBAN * 80% / 7 = 114 KOBAN/dia
        _addPackType(7, 1 * 10**18);
        
        // Pack 30 dias: 3 WLD -> 3000 KOBAN * 80% / 30 = 80 KOBAN/dia
        _addPackType(30, 3 * 10**18);
        
        // Pack 90 dias: 7 WLD -> 7000 KOBAN * 80% / 90 = 62 KOBAN/dia
        _addPackType(90, 7 * 10**18);
    }
    
    function _addPackType(uint256 _days, uint256 _wldCost) internal {
        uint256 totalKoban = (_wldCost * KOBAN_PER_WLD) / 10**18;
        uint256 distributableKoban = (totalKoban * DISTRIBUTION_PERCENT) / 100;
        uint256 dailyKoban = distributableKoban / _days;
        
        packTypes.push(FoodPackType({
            id: packTypes.length,
            days: _days,
            wldCost: _wldCost,
            totalKoban: totalKoban,
            dailyKoban: dailyKoban,
            active: true
        }));
        
        emit PackTypeAdded(packTypes.length - 1, _days, _wldCost, dailyKoban);
    }
    
    /**
     * @notice Comprar pack de comida
     */
    function purchasePack(uint256 packTypeId) external nonReentrant whenNotPaused {
        require(packTypeId < packTypes.length, "Invalid pack type");
        FoodPackType memory packType = packTypes[packTypeId];
        require(packType.active, "Pack type not active");
        
        // Check if user has active pack
        require(!userPacks[msg.sender].active || block.timestamp > userPacks[msg.sender].endTime, 
            "Active pack exists");
        
        // Transfer WLD payment
        wldToken.safeTransferFrom(msg.sender, adminWallet, packType.wldCost);
        
        userPacks[msg.sender] = UserFoodPack({
            packTypeId: packTypeId,
            startTime: block.timestamp,
            endTime: block.timestamp + (packType.days * 1 days),
            lastClaimTime: block.timestamp,
            lastWaterTime: 0, // Must pay water to start
            totalKobanClaimed: 0,
            active: true
        });
        
        totalPacksSold++;
        totalWLDCollected += packType.wldCost;
        
        emit PackPurchased(msg.sender, packTypeId, packType.days, packType.wldCost);
    }
    
    /**
     * @notice Pagar agua diaria (100 HACHI)
     */
    function payWater() external nonReentrant whenNotPaused {
        UserFoodPack storage pack = userPacks[msg.sender];
        require(pack.active, "No active pack");
        require(block.timestamp <= pack.endTime, "Pack expired");
        
        // Check if water already paid today
        uint256 today = block.timestamp / 1 days;
        uint256 lastWaterDay = pack.lastWaterTime / 1 days;
        require(today > lastWaterDay, "Water already paid today");
        
        // Transfer HACHI payment
        hachiToken.safeTransferFrom(msg.sender, adminWallet, DAILY_WATER_COST);
        
        pack.lastWaterTime = block.timestamp;
        
        emit WaterPaid(msg.sender, DAILY_WATER_COST);
    }
    
    /**
     * @notice Calcular KOBAN disponible para reclamar
     */
    function getClaimableKoban(address user) public view returns (uint256) {
        UserFoodPack memory pack = userPacks[user];
        if (!pack.active) return 0;
        
        // Check if water is paid (must be paid today)
        uint256 today = block.timestamp / 1 days;
        uint256 lastWaterDay = pack.lastWaterTime / 1 days;
        if (today > lastWaterDay) return 0; // Water not paid
        
        FoodPackType memory packType = packTypes[pack.packTypeId];
        
        // Calculate days since last claim (max to end time)
        uint256 endTime = pack.endTime < block.timestamp ? pack.endTime : block.timestamp;
        uint256 daysSinceClaim = (endTime - pack.lastClaimTime) / 1 days;
        
        if (daysSinceClaim == 0) return 0;
        
        return daysSinceClaim * packType.dailyKoban;
    }
    
    /**
     * @notice Reclamar KOBAN diario
     */
    function claimKoban() external nonReentrant whenNotPaused {
        UserFoodPack storage pack = userPacks[msg.sender];
        require(pack.active, "No active pack");
        
        uint256 claimable = getClaimableKoban(msg.sender);
        require(claimable > 0, "Nothing to claim (pay water first)");
        require(kobanRewardsPool >= claimable, "Insufficient KOBAN pool");
        
        pack.lastClaimTime = block.timestamp;
        pack.totalKobanClaimed += claimable;
        kobanRewardsPool -= claimable;
        totalKobanDistributed += claimable;
        
        kobanToken.safeTransfer(msg.sender, claimable);
        
        // Check if pack expired
        if (block.timestamp >= pack.endTime) {
            pack.active = false;
            emit PackExpired(msg.sender);
        }
        
        emit KobanClaimed(msg.sender, claimable);
    }
    
    /**
     * @notice Obtener info del pack del usuario
     */
    function getUserPackInfo(address user) external view returns (
        bool active,
        uint256 packTypeId,
        uint256 daysRemaining,
        uint256 dailyKoban,
        bool waterPaidToday,
        uint256 claimableKoban,
        uint256 totalClaimed
    ) {
        UserFoodPack memory pack = userPacks[user];
        
        uint256 remaining = 0;
        uint256 daily = 0;
        bool waterPaid = false;
        
        if (pack.active && block.timestamp < pack.endTime) {
            remaining = (pack.endTime - block.timestamp) / 1 days;
            daily = packTypes[pack.packTypeId].dailyKoban;
            
            uint256 today = block.timestamp / 1 days;
            uint256 lastWaterDay = pack.lastWaterTime / 1 days;
            waterPaid = today == lastWaterDay;
        }
        
        return (
            pack.active && block.timestamp < pack.endTime,
            pack.packTypeId,
            remaining,
            daily,
            waterPaid,
            getClaimableKoban(user),
            pack.totalKobanClaimed
        );
    }
    
    /**
     * @notice Obtener todos los tipos de packs
     */
    function getAllPackTypes() external view returns (FoodPackType[] memory) {
        return packTypes;
    }
    
    /**
     * @notice Fondear pool de KOBAN
     */
    function fundKobanPool(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        kobanToken.safeTransferFrom(msg.sender, address(this), amount);
        kobanRewardsPool += amount;
    }
    
    // Admin functions
    function addPackType(uint256 _days, uint256 _wldCost) external onlyRole(ADMIN_ROLE) {
        _addPackType(_days, _wldCost);
    }
    
    function setPackTypeActive(uint256 packTypeId, bool active) external onlyRole(ADMIN_ROLE) {
        require(packTypeId < packTypes.length, "Invalid pack type");
        packTypes[packTypeId].active = active;
    }
    
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
