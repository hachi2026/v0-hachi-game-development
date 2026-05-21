// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HachiCatUpgrades
 * @notice Manejo de mejoras de gatos pagando WLD
 * @dev Tokenomics de mejoras:
 *   - 70% WLD -> Recompra KOBAN inmediata
 *   - 20% WLD -> Reserva para fin de temporada
 *   - 10% WLD -> Administracion
 */
contract HachiCatUpgrades is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    IERC20 public immutable wldToken;
    IERC20 public immutable kobanToken;
    
    // Distribucion de ingresos (en basis points, 10000 = 100%)
    uint256 public constant KOBAN_BUYBACK_SHARE = 7000;    // 70%
    uint256 public constant SEASON_RESERVE_SHARE = 2000;   // 20%
    uint256 public constant ADMIN_SHARE = 1000;            // 10%
    
    // Wallets
    address public kobanBuybackWallet;
    address public seasonReserveWallet;
    address public adminWallet;
    
    // Costos de mejora por nivel (en WLD, 18 decimales)
    mapping(uint256 => uint256) public upgradeCosts;
    
    // Tracking de upgrades
    mapping(address => uint256) public userCatLevel;
    mapping(address => uint256) public totalUpgradesPaid;
    
    // Temporadas
    uint256 public currentSeason;
    mapping(uint256 => uint256) public seasonReserves;
    
    // Estadisticas
    uint256 public totalWldCollected;
    uint256 public totalUpgrades;
    
    // Eventos
    event CatUpgraded(address indexed user, uint256 fromLevel, uint256 toLevel, uint256 wldPaid);
    event RevenueDistributed(uint256 toBuyback, uint256 toReserve, uint256 toAdmin);
    event UpgradeCostUpdated(uint256 level, uint256 cost);
    event SeasonStarted(uint256 seasonId);
    event SeasonReserveDistributed(uint256 seasonId, uint256 amount);
    
    constructor(
        address _wldToken,
        address _kobanToken,
        address _kobanBuybackWallet,
        address _seasonReserveWallet,
        address _adminWallet
    ) {
        require(_wldToken != address(0), "Invalid WLD token");
        require(_kobanToken != address(0), "Invalid KOBAN token");
        require(_kobanBuybackWallet != address(0), "Invalid buyback wallet");
        require(_seasonReserveWallet != address(0), "Invalid reserve wallet");
        require(_adminWallet != address(0), "Invalid admin wallet");
        
        wldToken = IERC20(_wldToken);
        kobanToken = IERC20(_kobanToken);
        kobanBuybackWallet = _kobanBuybackWallet;
        seasonReserveWallet = _seasonReserveWallet;
        adminWallet = _adminWallet;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        currentSeason = 1;
        
        // Inicializar costos de mejora (20 niveles)
        // Niveles 1-10: Common (2 WLD cada uno)
        for (uint256 i = 1; i <= 10; i++) {
            upgradeCosts[i] = 2 * 10**18;
        }
        // Niveles 11-15: Rare (5 WLD cada uno)
        for (uint256 i = 11; i <= 15; i++) {
            upgradeCosts[i] = 5 * 10**18;
        }
        // Niveles 16-18: Epic (7 WLD cada uno)
        for (uint256 i = 16; i <= 18; i++) {
            upgradeCosts[i] = 7 * 10**18;
        }
        // Niveles 19-20: Legendary (10 WLD cada uno)
        upgradeCosts[19] = 10 * 10**18;
        upgradeCosts[20] = 10 * 10**18;
    }
    
    /**
     * @notice Mejorar gato al siguiente nivel
     */
    function upgradeCat() external nonReentrant whenNotPaused {
        uint256 currentLevel = userCatLevel[msg.sender];
        if (currentLevel == 0) currentLevel = 1; // Nivel inicial
        
        require(currentLevel < 20, "Max level reached");
        
        uint256 nextLevel = currentLevel + 1;
        uint256 cost = upgradeCosts[nextLevel];
        require(cost > 0, "Invalid upgrade cost");
        
        // Cobrar WLD
        wldToken.safeTransferFrom(msg.sender, address(this), cost);
        
        // Distribuir ingresos
        uint256 toBuyback = (cost * KOBAN_BUYBACK_SHARE) / 10000;
        uint256 toReserve = (cost * SEASON_RESERVE_SHARE) / 10000;
        uint256 toAdmin = cost - toBuyback - toReserve;
        
        wldToken.safeTransfer(kobanBuybackWallet, toBuyback);
        wldToken.safeTransfer(seasonReserveWallet, toReserve);
        wldToken.safeTransfer(adminWallet, toAdmin);
        
        // Actualizar estadisticas
        totalWldCollected += cost;
        seasonReserves[currentSeason] += toReserve;
        totalUpgradesPaid[msg.sender] += cost;
        totalUpgrades++;
        
        // Actualizar nivel
        userCatLevel[msg.sender] = nextLevel;
        
        emit RevenueDistributed(toBuyback, toReserve, toAdmin);
        emit CatUpgraded(msg.sender, currentLevel, nextLevel, cost);
    }
    
    /**
     * @notice Mejorar gato multiples niveles a la vez
     */
    function upgradeCatMultiple(uint256 levels) external nonReentrant whenNotPaused {
        require(levels > 0, "Must upgrade at least 1 level");
        
        uint256 currentLevel = userCatLevel[msg.sender];
        if (currentLevel == 0) currentLevel = 1;
        
        uint256 targetLevel = currentLevel + levels;
        require(targetLevel <= 20, "Exceeds max level");
        
        // Calcular costo total
        uint256 totalCost = 0;
        for (uint256 i = currentLevel + 1; i <= targetLevel; i++) {
            totalCost += upgradeCosts[i];
        }
        
        // Cobrar WLD
        wldToken.safeTransferFrom(msg.sender, address(this), totalCost);
        
        // Distribuir ingresos
        uint256 toBuyback = (totalCost * KOBAN_BUYBACK_SHARE) / 10000;
        uint256 toReserve = (totalCost * SEASON_RESERVE_SHARE) / 10000;
        uint256 toAdmin = totalCost - toBuyback - toReserve;
        
        wldToken.safeTransfer(kobanBuybackWallet, toBuyback);
        wldToken.safeTransfer(seasonReserveWallet, toReserve);
        wldToken.safeTransfer(adminWallet, toAdmin);
        
        // Actualizar estadisticas
        totalWldCollected += totalCost;
        seasonReserves[currentSeason] += toReserve;
        totalUpgradesPaid[msg.sender] += totalCost;
        totalUpgrades += levels;
        
        // Actualizar nivel
        userCatLevel[msg.sender] = targetLevel;
        
        emit RevenueDistributed(toBuyback, toReserve, toAdmin);
        emit CatUpgraded(msg.sender, currentLevel, targetLevel, totalCost);
    }
    
    /**
     * @notice Calcular costo para subir a un nivel especifico
     */
    function calculateUpgradeCost(address user, uint256 targetLevel) external view returns (uint256) {
        uint256 currentLevel = userCatLevel[user];
        if (currentLevel == 0) currentLevel = 1;
        
        require(targetLevel > currentLevel && targetLevel <= 20, "Invalid target level");
        
        uint256 totalCost = 0;
        for (uint256 i = currentLevel + 1; i <= targetLevel; i++) {
            totalCost += upgradeCosts[i];
        }
        return totalCost;
    }
    
    /**
     * @notice Obtener nivel actual del gato del usuario
     */
    function getCatLevel(address user) external view returns (uint256) {
        uint256 level = userCatLevel[user];
        return level == 0 ? 1 : level;
    }
    
    /**
     * @notice Obtener costo para el siguiente nivel
     */
    function getNextUpgradeCost(address user) external view returns (uint256) {
        uint256 currentLevel = userCatLevel[user];
        if (currentLevel == 0) currentLevel = 1;
        if (currentLevel >= 20) return 0;
        return upgradeCosts[currentLevel + 1];
    }
    
    // === Admin Functions ===
    
    function setUpgradeCost(uint256 level, uint256 cost) external onlyRole(ADMIN_ROLE) {
        require(level > 0 && level <= 20, "Invalid level");
        require(cost > 0, "Cost must be > 0");
        upgradeCosts[level] = cost;
        emit UpgradeCostUpdated(level, cost);
    }
    
    function startNewSeason() external onlyRole(ADMIN_ROLE) {
        currentSeason++;
        emit SeasonStarted(currentSeason);
    }
    
    function updateKobanBuybackWallet(address newWallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newWallet != address(0), "Invalid wallet");
        kobanBuybackWallet = newWallet;
    }
    
    function updateSeasonReserveWallet(address newWallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newWallet != address(0), "Invalid wallet");
        seasonReserveWallet = newWallet;
    }
    
    function updateAdminWallet(address newWallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newWallet != address(0), "Invalid wallet");
        adminWallet = newWallet;
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
