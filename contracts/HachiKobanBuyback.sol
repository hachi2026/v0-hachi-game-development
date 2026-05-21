// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title HachiKobanBuyback
 * @dev Contrato para recompras de HACHI KOBAN con ingresos WLD de mejoras de gatos
 * 
 * TOKENOMICS DE MEJORAS:
 * - Usuario paga WLD para mejorar gato
 * - 70% WLD -> Recompra KOBAN (inmediato)
 * - 20% WLD -> Reserva para recompras al final de temporada
 * - 10% WLD -> Administracion
 */
contract HachiKobanBuyback is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ ROLES ============
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // ============ TOKENS ============
    IERC20 public immutable wldToken;
    IERC20 public immutable kobanToken;
    
    // ============ CONFIG ============
    uint256 public constant IMMEDIATE_BUYBACK_PERCENT = 70; // 70% recompra inmediata
    uint256 public constant SEASON_RESERVE_PERCENT = 20;    // 20% reserva temporada
    uint256 public constant ADMIN_FEE_PERCENT = 10;         // 10% admin
    
    address public adminWallet;
    address public kobanBuybackWallet; // Wallet que recibe WLD para ejecutar recompras
    
    // ============ SEASONS ============
    struct Season {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256 wldReserved;
        uint256 kobanBoughtBack;
        bool distributed;
    }
    
    uint256 public currentSeasonId;
    mapping(uint256 => Season) public seasons;
    
    // ============ STATE ============
    uint256 public totalWldReceived;
    uint256 public totalImmediateBuybacks;
    uint256 public totalSeasonReserves;
    uint256 public totalAdminFees;
    
    // ============ UPGRADE COSTS ============
    mapping(uint8 => uint256) public upgradeCosts; // level => WLD cost
    
    // ============ EVENTS ============
    event CatUpgraded(address indexed user, uint8 fromLevel, uint8 toLevel, uint256 wldPaid);
    event ImmediateBuyback(uint256 wldAmount, uint256 seasonId);
    event SeasonReserveAdded(uint256 wldAmount, uint256 seasonId);
    event SeasonDistributed(uint256 seasonId, uint256 totalKoban);
    event NewSeasonStarted(uint256 seasonId, uint256 startTime, uint256 endTime);
    event UpgradeCostUpdated(uint8 level, uint256 cost);
    
    constructor(
        address _wldToken,
        address _kobanToken,
        address _adminWallet,
        address _buybackWallet
    ) {
        require(_wldToken != address(0), "Invalid WLD token");
        require(_kobanToken != address(0), "Invalid KOBAN token");
        require(_adminWallet != address(0), "Invalid admin wallet");
        require(_buybackWallet != address(0), "Invalid buyback wallet");
        
        wldToken = IERC20(_wldToken);
        kobanToken = IERC20(_kobanToken);
        adminWallet = _adminWallet;
        kobanBuybackWallet = _buybackWallet;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        // Set default upgrade costs (in WLD)
        // Levels 1-10: Common (2 WLD)
        for (uint8 i = 1; i <= 10; i++) {
            upgradeCosts[i] = 2 * 10**18;
        }
        // Levels 11-15: Rare (5 WLD)
        for (uint8 i = 11; i <= 15; i++) {
            upgradeCosts[i] = 5 * 10**18;
        }
        // Levels 16-18: Epic (7 WLD)
        for (uint8 i = 16; i <= 18; i++) {
            upgradeCosts[i] = 7 * 10**18;
        }
        // Levels 19-20: Legendary (10 WLD)
        upgradeCosts[19] = 10 * 10**18;
        upgradeCosts[20] = 10 * 10**18;
        
        // Start first season (30 days)
        _startNewSeason(30 days);
    }
    
    // ============ UPGRADE FUNCTIONS ============
    
    /**
     * @dev Procesa pago de mejora de gato
     * @param fromLevel Nivel actual del gato
     * @param toLevel Nivel objetivo
     */
    function processUpgrade(
        uint8 fromLevel, 
        uint8 toLevel
    ) external nonReentrant {
        require(toLevel > fromLevel, "Must upgrade to higher level");
        require(toLevel <= 20, "Max level is 20");
        
        // Calcular costo total
        uint256 totalCost = 0;
        for (uint8 i = fromLevel + 1; i <= toLevel; i++) {
            totalCost += upgradeCosts[i];
        }
        
        require(totalCost > 0, "Invalid upgrade cost");
        
        // Transferir WLD
        wldToken.safeTransferFrom(msg.sender, address(this), totalCost);
        totalWldReceived += totalCost;
        
        // Distribuir segun tokenomics
        uint256 immediateBuyback = (totalCost * IMMEDIATE_BUYBACK_PERCENT) / 100;
        uint256 seasonReserve = (totalCost * SEASON_RESERVE_PERCENT) / 100;
        uint256 adminFee = totalCost - immediateBuyback - seasonReserve;
        
        // Transferir a admin
        wldToken.safeTransfer(adminWallet, adminFee);
        totalAdminFees += adminFee;
        
        // Transferir para recompra inmediata
        wldToken.safeTransfer(kobanBuybackWallet, immediateBuyback);
        totalImmediateBuybacks += immediateBuyback;
        emit ImmediateBuyback(immediateBuyback, currentSeasonId);
        
        // Agregar a reserva de temporada
        seasons[currentSeasonId].wldReserved += seasonReserve;
        totalSeasonReserves += seasonReserve;
        emit SeasonReserveAdded(seasonReserve, currentSeasonId);
        
        emit CatUpgraded(msg.sender, fromLevel, toLevel, totalCost);
    }
    
    // ============ SEASON FUNCTIONS ============
    
    /**
     * @dev Inicia una nueva temporada
     */
    function _startNewSeason(uint256 duration) internal {
        currentSeasonId++;
        
        seasons[currentSeasonId] = Season({
            id: currentSeasonId,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            wldReserved: 0,
            kobanBoughtBack: 0,
            distributed: false
        });
        
        emit NewSeasonStarted(currentSeasonId, block.timestamp, block.timestamp + duration);
    }
    
    /**
     * @dev Inicia nueva temporada manualmente
     */
    function startNewSeason(uint256 duration) external onlyRole(ADMIN_ROLE) {
        require(block.timestamp >= seasons[currentSeasonId].endTime, "Current season not ended");
        _startNewSeason(duration);
    }
    
    /**
     * @dev Marca temporada como distribuida (despues de recompra manual)
     */
    function markSeasonDistributed(uint256 seasonId, uint256 kobanAmount) external onlyRole(OPERATOR_ROLE) {
        require(!seasons[seasonId].distributed, "Already distributed");
        require(block.timestamp >= seasons[seasonId].endTime, "Season not ended");
        
        seasons[seasonId].kobanBoughtBack = kobanAmount;
        seasons[seasonId].distributed = true;
        
        // Transferir WLD reservado para recompra
        uint256 reserved = seasons[seasonId].wldReserved;
        if (reserved > 0) {
            wldToken.safeTransfer(kobanBuybackWallet, reserved);
        }
        
        emit SeasonDistributed(seasonId, kobanAmount);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Obtiene costo de upgrade entre niveles
     */
    function getUpgradeCost(uint8 fromLevel, uint8 toLevel) external view returns (uint256) {
        require(toLevel > fromLevel, "Invalid levels");
        
        uint256 totalCost = 0;
        for (uint8 i = fromLevel + 1; i <= toLevel; i++) {
            totalCost += upgradeCosts[i];
        }
        return totalCost;
    }
    
    /**
     * @dev Obtiene info de la temporada actual
     */
    function getCurrentSeason() external view returns (
        uint256 id,
        uint256 startTime,
        uint256 endTime,
        uint256 wldReserved,
        uint256 timeRemaining
    ) {
        Season storage s = seasons[currentSeasonId];
        uint256 remaining = block.timestamp >= s.endTime ? 0 : s.endTime - block.timestamp;
        return (s.id, s.startTime, s.endTime, s.wldReserved, remaining);
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Actualiza costo de upgrade para un nivel
     */
    function setUpgradeCost(uint8 level, uint256 cost) external onlyRole(ADMIN_ROLE) {
        require(level >= 1 && level <= 20, "Invalid level");
        upgradeCosts[level] = cost;
        emit UpgradeCostUpdated(level, cost);
    }
    
    /**
     * @dev Actualiza wallets
     */
    function setAdminWallet(address _wallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_wallet != address(0), "Invalid address");
        adminWallet = _wallet;
    }
    
    function setBuybackWallet(address _wallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_wallet != address(0), "Invalid address");
        kobanBuybackWallet = _wallet;
    }
}
