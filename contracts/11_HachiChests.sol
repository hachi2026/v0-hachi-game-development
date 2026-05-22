// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HachiChests
 * @notice Sistema de cofres gacha con 5 cuotas
 * @dev 5 depositos (1 por dia como tarea), se revela despues de 5 dias
 */
contract HachiChests is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    IERC20 public immutable hachiToken;
    
    // Chest tiers
    struct ChestTier {
        uint256 id;
        string name;
        uint256 totalCost; // Total HACHI cost
        uint256 depositPerDay; // Cost per deposit (totalCost / 5)
        uint256 rarity; // 0=common, 1=rare, 2=epic, 3=legendary
        bool active;
    }
    
    ChestTier[] public chestTiers;
    
    uint256 public constant TOTAL_DEPOSITS = 5;
    uint256 public constant REVEAL_DAYS = 5;
    
    // User's active chest
    struct UserChest {
        uint256 tierId;
        uint256 depositsCompleted;
        uint256 lastDepositTime;
        uint256 startTime;
        uint256 revealTime; // When the chest can be opened
        uint256 totalDeposited;
        bool active;
        bool revealed;
        uint256 rewardType; // Set by oracle after reveal
        uint256 rewardId; // Accessory ID
    }
    
    mapping(address => UserChest[]) public userChests;
    mapping(address => uint256) public activeChestIndex;
    mapping(address => bool) public hasActiveChest;
    
    // Stats
    uint256 public totalChestsStarted;
    uint256 public totalChestsCompleted;
    uint256 public totalHachiCollected;
    
    // Admin wallet for collected HACHI
    address public adminWallet;
    
    // Events
    event ChestStarted(address indexed user, uint256 tierId, uint256 chestIndex);
    event DepositMade(address indexed user, uint256 chestIndex, uint256 depositNumber, uint256 amount);
    event ChestReadyToReveal(address indexed user, uint256 chestIndex);
    event ChestRevealed(address indexed user, uint256 chestIndex, uint256 rewardType, uint256 rewardId);
    event ChestTierAdded(uint256 id, string name, uint256 totalCost);
    
    constructor(address _hachiToken, address _adminWallet) {
        require(_hachiToken != address(0), "Invalid HACHI token");
        require(_adminWallet != address(0), "Invalid admin wallet");
        
        hachiToken = IERC20(_hachiToken);
        adminWallet = _adminWallet;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        
        // Initialize chest tiers
        // Basico: 500 HACHI total, 100 per deposit
        _addChestTier("Cofre Basico", 500 * 10**18, 0);
        
        // Avanzado: 2500 HACHI total, 500 per deposit
        _addChestTier("Cofre Avanzado", 2500 * 10**18, 1);
        
        // Premium: 10000 HACHI total, 2000 per deposit
        _addChestTier("Cofre Premium", 10000 * 10**18, 2);
        
        // Exclusivo: 50000 HACHI total, 10000 per deposit
        _addChestTier("Cofre Exclusivo", 50000 * 10**18, 3);
    }
    
    function _addChestTier(string memory _name, uint256 _totalCost, uint256 _rarity) internal {
        chestTiers.push(ChestTier({
            id: chestTiers.length,
            name: _name,
            totalCost: _totalCost,
            depositPerDay: _totalCost / TOTAL_DEPOSITS,
            rarity: _rarity,
            active: true
        }));
        
        emit ChestTierAdded(chestTiers.length - 1, _name, _totalCost);
    }
    
    /**
     * @notice Iniciar un nuevo cofre
     */
    function startChest(uint256 tierId) external nonReentrant whenNotPaused {
        require(tierId < chestTiers.length, "Invalid tier");
        require(!hasActiveChest[msg.sender], "Already has active chest");
        
        ChestTier memory tier = chestTiers[tierId];
        require(tier.active, "Tier not active");
        
        uint256 chestIndex = userChests[msg.sender].length;
        
        userChests[msg.sender].push(UserChest({
            tierId: tierId,
            depositsCompleted: 0,
            lastDepositTime: 0,
            startTime: block.timestamp,
            revealTime: 0,
            totalDeposited: 0,
            active: true,
            revealed: false,
            rewardType: 0,
            rewardId: 0
        }));
        
        activeChestIndex[msg.sender] = chestIndex;
        hasActiveChest[msg.sender] = true;
        totalChestsStarted++;
        
        emit ChestStarted(msg.sender, tierId, chestIndex);
    }
    
    /**
     * @notice Hacer deposito diario al cofre (tarea diaria)
     */
    function makeDeposit() external nonReentrant whenNotPaused {
        require(hasActiveChest[msg.sender], "No active chest");
        
        uint256 chestIndex = activeChestIndex[msg.sender];
        UserChest storage chest = userChests[msg.sender][chestIndex];
        
        require(chest.active, "Chest not active");
        require(chest.depositsCompleted < TOTAL_DEPOSITS, "All deposits completed");
        
        // Check if can deposit today (1 per day)
        if (chest.depositsCompleted > 0) {
            uint256 today = block.timestamp / 1 days;
            uint256 lastDepositDay = chest.lastDepositTime / 1 days;
            require(today > lastDepositDay, "Already deposited today");
        }
        
        ChestTier memory tier = chestTiers[chest.tierId];
        uint256 depositAmount = tier.depositPerDay;
        
        // Transfer HACHI
        hachiToken.safeTransferFrom(msg.sender, adminWallet, depositAmount);
        
        chest.depositsCompleted++;
        chest.lastDepositTime = block.timestamp;
        chest.totalDeposited += depositAmount;
        totalHachiCollected += depositAmount;
        
        emit DepositMade(msg.sender, chestIndex, chest.depositsCompleted, depositAmount);
        
        // Check if all deposits completed
        if (chest.depositsCompleted == TOTAL_DEPOSITS) {
            chest.revealTime = block.timestamp + (REVEAL_DAYS * 1 days);
            emit ChestReadyToReveal(msg.sender, chestIndex);
        }
    }
    
    /**
     * @notice Check if chest can be revealed
     */
    function canReveal(address user) public view returns (bool) {
        if (!hasActiveChest[user]) return false;
        
        uint256 chestIndex = activeChestIndex[user];
        UserChest memory chest = userChests[user][chestIndex];
        
        return chest.active && 
               chest.depositsCompleted == TOTAL_DEPOSITS && 
               block.timestamp >= chest.revealTime &&
               !chest.revealed;
    }
    
    /**
     * @notice Revelar cofre (llamado por Oracle con resultado aleatorio)
     */
    function revealChest(
        address user, 
        uint256 rewardType, 
        uint256 rewardId
    ) external onlyRole(ORACLE_ROLE) {
        require(hasActiveChest[user], "No active chest");
        
        uint256 chestIndex = activeChestIndex[user];
        UserChest storage chest = userChests[user][chestIndex];
        
        require(chest.active, "Chest not active");
        require(chest.depositsCompleted == TOTAL_DEPOSITS, "Not all deposits");
        require(block.timestamp >= chest.revealTime, "Too early to reveal");
        require(!chest.revealed, "Already revealed");
        
        chest.revealed = true;
        chest.rewardType = rewardType;
        chest.rewardId = rewardId;
        chest.active = false;
        hasActiveChest[user] = false;
        totalChestsCompleted++;
        
        emit ChestRevealed(user, chestIndex, rewardType, rewardId);
    }
    
    /**
     * @notice Usuario solicita revelar (si Oracle tarda)
     */
    function requestReveal() external nonReentrant whenNotPaused {
        require(canReveal(msg.sender), "Cannot reveal yet");
        // Oracle will listen for this and call revealChest
        // This just emits an event for the oracle to pick up
        uint256 chestIndex = activeChestIndex[msg.sender];
        emit ChestReadyToReveal(msg.sender, chestIndex);
    }
    
    /**
     * @notice Obtener info del cofre activo del usuario
     */
    function getActiveChestInfo(address user) external view returns (
        bool hasActive,
        uint256 tierId,
        string memory tierName,
        uint256 depositsCompleted,
        uint256 depositsRemaining,
        uint256 nextDepositAmount,
        bool canDepositToday,
        bool isReadyToReveal,
        uint256 revealTime
    ) {
        if (!hasActiveChest[user]) {
            return (false, 0, "", 0, 0, 0, false, false, 0);
        }
        
        uint256 chestIndex = activeChestIndex[user];
        UserChest memory chest = userChests[user][chestIndex];
        ChestTier memory tier = chestTiers[chest.tierId];
        
        bool canDeposit = false;
        if (chest.depositsCompleted < TOTAL_DEPOSITS) {
            if (chest.depositsCompleted == 0) {
                canDeposit = true;
            } else {
                uint256 today = block.timestamp / 1 days;
                uint256 lastDepositDay = chest.lastDepositTime / 1 days;
                canDeposit = today > lastDepositDay;
            }
        }
        
        return (
            true,
            chest.tierId,
            tier.name,
            chest.depositsCompleted,
            TOTAL_DEPOSITS - chest.depositsCompleted,
            tier.depositPerDay,
            canDeposit,
            canReveal(user),
            chest.revealTime
        );
    }
    
    /**
     * @notice Obtener historial de cofres del usuario
     */
    function getUserChestHistory(address user) external view returns (UserChest[] memory) {
        return userChests[user];
    }
    
    /**
     * @notice Obtener todos los tiers disponibles
     */
    function getAllChestTiers() external view returns (ChestTier[] memory) {
        return chestTiers;
    }
    
    // Admin functions
    function addChestTier(string memory _name, uint256 _totalCost, uint256 _rarity) external onlyRole(ADMIN_ROLE) {
        _addChestTier(_name, _totalCost, _rarity);
    }
    
    function setTierActive(uint256 tierId, bool active) external onlyRole(ADMIN_ROLE) {
        require(tierId < chestTiers.length, "Invalid tier");
        chestTiers[tierId].active = active;
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
