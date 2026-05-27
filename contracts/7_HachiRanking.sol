// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HachiRanking
 * @notice Sistema de ranking por temporada con puntos y recompensas EN HACHI
 * @dev Los puntos se ganan por actividades en la app. Premios en HACHI.
 * 
 * TEMPORADA:
 * - Duracion: 90 dias
 * - Pool inicial: 1,000,000 HACHI
 * - Al terminar: se reparten premios y se reinicia
 */
contract HachiRanking is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant POINTS_MANAGER_ROLE = keccak256("POINTS_MANAGER_ROLE");
    
    // HACHI token para premios (NO KOBAN)
    IERC20 public immutable hachiToken;
    
    // Referencia al Treasury para recibir HACHI
    address public treasury;
    
    // Puntos por actividad
    uint256 public constant POINTS_DAILY_CLAIM = 10;
    uint256 public constant POINTS_WATER_PURCHASE = 5;
    
    // Puntos por food pack (escalonados)
    uint256 public constant POINTS_FOOD_7 = 25;
    uint256 public constant POINTS_FOOD_30 = 100;
    uint256 public constant POINTS_FOOD_90 = 300;
    
    // Puntos por deposito de cofre (escalonados por tier)
    uint256 public constant POINTS_CHEST_DEPOSIT_BASICO = 10;
    uint256 public constant POINTS_CHEST_DEPOSIT_AVANZADO = 25;
    uint256 public constant POINTS_CHEST_DEPOSIT_PREMIUM = 50;
    uint256 public constant POINTS_CHEST_DEPOSIT_EXCLUSIVO = 100;
    
    // Puntos por abrir cofre (escalonados por tier)
    uint256 public constant POINTS_CHEST_OPEN_BASICO = 50;
    uint256 public constant POINTS_CHEST_OPEN_AVANZADO = 150;
    uint256 public constant POINTS_CHEST_OPEN_PREMIUM = 400;
    uint256 public constant POINTS_CHEST_OPEN_EXCLUSIVO = 1000;
    
    // Puntos por staking (escalonados por cantidad)
    uint256 public constant POINTS_STAKING_100 = 5;
    uint256 public constant POINTS_STAKING_1000 = 50;
    uint256 public constant POINTS_STAKING_10000 = 500;
    uint256 public constant POINTS_STAKING_100000 = 5000;
    
    // Otros puntos
    uint256 public constant POINTS_MISSION_COMPLETE = 25;
    uint256 public constant POINTS_AD_WATCH = 15;
    uint256 public constant POINTS_REFERRAL = 100;
    uint256 public constant POINTS_CAT_UPGRADE = 75;
    uint256 public constant POINTS_EQUIP_ACCESSORY = 10;
    uint256 public constant POINTS_MEMBERSHIP = 500;
    
    // Tiempo minimo de staking para puntos (24 horas)
    uint256 public constant MIN_STAKE_TIME_FOR_POINTS = 24 hours;
    
    // Temporada
    struct Season {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256 rewardPool; // EN HACHI
        uint256 totalDistributed;
        bool finalized;
    }
    
    // Ranking del usuario por temporada
    struct UserRanking {
        uint256 points;
        uint256 claimsCount;
        uint256 missionsCompleted;
        uint256 adsWatched;
        uint256 referralsCount;
        uint256 chestsOpened;
        uint256 upgrades;
        uint256 totalStaked;
        bool rewardClaimed;
    }
    
    // Temporadas
    uint256 public currentSeasonId;
    mapping(uint256 => Season) public seasons;
    
    // Rankings por temporada
    mapping(uint256 => mapping(address => UserRanking)) public rankings;
    mapping(uint256 => address[]) public seasonParticipants;
    mapping(uint256 => mapping(address => bool)) public isParticipant;
    
    // Tracking de stakes para puntos (user => timestamp de ultimo stake)
    mapping(address => uint256) public lastStakeTime;
    
    // Referidos
    mapping(address => address) public referrer;
    mapping(address => address[]) public referrals;
    
    // Recompensas por posicion (en basis points del pool, 10000 = 100%)
    // Top 1: 20%, Top 2-5: 15% (div 4), Top 6-20: 10% (div 15), Top 21-100: 5% (div 80)
    uint256[] public rewardTiers;      
    uint256[] public rewardPercentages; 
    
    // Constantes de temporada
    uint256 public constant SEASON_DURATION = 90 days;
    uint256 public constant INITIAL_REWARD_POOL = 1_000_000 * 10**18; // 1M HACHI
    
    // Eventos
    event SeasonStarted(uint256 indexed seasonId, uint256 startTime, uint256 endTime, uint256 rewardPool);
    event SeasonFinalized(uint256 indexed seasonId, uint256 totalDistributed);
    event PointsAdded(address indexed user, uint256 points, string activity);
    event RewardClaimed(address indexed user, uint256 seasonId, uint256 amount, uint256 rank);
    event ReferralRegistered(address indexed user, address indexed referrer);
    event RewardPoolFunded(uint256 amount, uint256 newTotal);
    
    constructor(address _hachiToken) {
        require(_hachiToken != address(0), "Invalid token");
        hachiToken = IERC20(_hachiToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(POINTS_MANAGER_ROLE, msg.sender);
        
        // Configurar tiers de recompensa
        // Top 1, Top 2-5, Top 6-20, Top 21-100
        rewardTiers = [1, 5, 20, 100];
        rewardPercentages = [2000, 1500, 1000, 500]; // 20%, 15%, 10%, 5%
    }
    
    /**
     * @notice Iniciar nueva temporada
     * @dev Solo admin. Pool inicial de 1M HACHI
     */
    function startSeason() external onlyRole(ADMIN_ROLE) {
        // Finalizar temporada anterior si existe y no esta finalizada
        if (currentSeasonId > 0 && !seasons[currentSeasonId].finalized) {
            _finalizeSeason();
        }
        
        currentSeasonId++;
        
        // Verificar que hay suficiente HACHI para el pool
        uint256 availableHachi = hachiToken.balanceOf(address(this));
        uint256 poolAmount = availableHachi >= INITIAL_REWARD_POOL ? INITIAL_REWARD_POOL : availableHachi;
        
        seasons[currentSeasonId] = Season({
            id: currentSeasonId,
            startTime: block.timestamp,
            endTime: block.timestamp + SEASON_DURATION,
            rewardPool: poolAmount,
            totalDistributed: 0,
            finalized: false
        });
        
        emit SeasonStarted(currentSeasonId, block.timestamp, block.timestamp + SEASON_DURATION, poolAmount);
    }
    
    /**
     * @notice Agregar puntos a un usuario
     */
    function addPoints(
        address user, 
        uint256 points, 
        string calldata activity
    ) external onlyRole(POINTS_MANAGER_ROLE) whenNotPaused {
        require(currentSeasonId > 0, "No active season");
        require(!seasons[currentSeasonId].finalized, "Season finalized");
        require(user != address(0), "Invalid user");
        require(points > 0, "Points must be > 0");
        
        _addParticipant(user);
        rankings[currentSeasonId][user].points += points;
        
        emit PointsAdded(user, points, activity);
    }
    
    /**
     * @notice Agregar puntos por staking (solo si han pasado 24h)
     */
    function addStakingPoints(
        address user, 
        uint256 amount,
        uint256 stakeTimestamp
    ) external onlyRole(POINTS_MANAGER_ROLE) whenNotPaused {
        require(currentSeasonId > 0, "No active season");
        require(!seasons[currentSeasonId].finalized, "Season finalized");
        
        // Solo dar puntos si han pasado 24h desde el stake
        if (block.timestamp < stakeTimestamp + MIN_STAKE_TIME_FOR_POINTS) {
            return; // No dar puntos aun
        }
        
        uint256 points;
        if (amount >= 100000 * 10**18) points = POINTS_STAKING_100000;
        else if (amount >= 10000 * 10**18) points = POINTS_STAKING_10000;
        else if (amount >= 1000 * 10**18) points = POINTS_STAKING_1000;
        else points = POINTS_STAKING_100;
        
        _addParticipant(user);
        rankings[currentSeasonId][user].points += points;
        rankings[currentSeasonId][user].totalStaked += amount;
        
        emit PointsAdded(user, points, "staking");
    }
    
    /**
     * @notice Agregar puntos por cofre (escalonado por tier)
     */
    function addChestPoints(
        address user, 
        uint8 tier, // 0=basico, 1=avanzado, 2=premium, 3=exclusivo
        bool isOpen  // true=abrir, false=depositar
    ) external onlyRole(POINTS_MANAGER_ROLE) whenNotPaused {
        require(currentSeasonId > 0, "No active season");
        require(!seasons[currentSeasonId].finalized, "Season finalized");
        
        uint256 points;
        string memory activity;
        
        if (isOpen) {
            if (tier == 0) points = POINTS_CHEST_OPEN_BASICO;
            else if (tier == 1) points = POINTS_CHEST_OPEN_AVANZADO;
            else if (tier == 2) points = POINTS_CHEST_OPEN_PREMIUM;
            else points = POINTS_CHEST_OPEN_EXCLUSIVO;
            activity = "chest_open";
            rankings[currentSeasonId][user].chestsOpened++;
        } else {
            if (tier == 0) points = POINTS_CHEST_DEPOSIT_BASICO;
            else if (tier == 1) points = POINTS_CHEST_DEPOSIT_AVANZADO;
            else if (tier == 2) points = POINTS_CHEST_DEPOSIT_PREMIUM;
            else points = POINTS_CHEST_DEPOSIT_EXCLUSIVO;
            activity = "chest_deposit";
        }
        
        _addParticipant(user);
        rankings[currentSeasonId][user].points += points;
        
        emit PointsAdded(user, points, activity);
    }
    
    /**
     * @notice Agregar puntos por food pack
     */
    function addFoodPackPoints(
        address user, 
        uint8 packType // 0=7dias, 1=30dias, 2=90dias
    ) external onlyRole(POINTS_MANAGER_ROLE) whenNotPaused {
        require(currentSeasonId > 0, "No active season");
        require(!seasons[currentSeasonId].finalized, "Season finalized");
        
        uint256 points;
        if (packType == 0) points = POINTS_FOOD_7;
        else if (packType == 1) points = POINTS_FOOD_30;
        else points = POINTS_FOOD_90;
        
        _addParticipant(user);
        rankings[currentSeasonId][user].points += points;
        
        emit PointsAdded(user, points, "food_pack");
    }
    
    /**
     * @notice Agregar participante si es nuevo
     */
    function _addParticipant(address user) internal {
        if (!isParticipant[currentSeasonId][user]) {
            isParticipant[currentSeasonId][user] = true;
            seasonParticipants[currentSeasonId].push(user);
        }
    }
    
    /**
     * @notice Registrar referido
     */
    function registerReferral(address newUser, address referrerAddr) external onlyRole(POINTS_MANAGER_ROLE) {
        require(referrer[newUser] == address(0), "Already has referrer");
        require(newUser != referrerAddr, "Cannot refer yourself");
        require(referrerAddr != address(0), "Invalid referrer");
        
        referrer[newUser] = referrerAddr;
        referrals[referrerAddr].push(newUser);
        
        // Dar puntos al referrer
        if (currentSeasonId > 0 && !seasons[currentSeasonId].finalized) {
            _addParticipant(referrerAddr);
            rankings[currentSeasonId][referrerAddr].points += POINTS_REFERRAL;
            rankings[currentSeasonId][referrerAddr].referralsCount++;
            
            emit PointsAdded(referrerAddr, POINTS_REFERRAL, "referral");
        }
        
        emit ReferralRegistered(newUser, referrerAddr);
    }
    
    /**
     * @notice Finalizar temporada internamente
     */
    function _finalizeSeason() internal {
        seasons[currentSeasonId].finalized = true;
        emit SeasonFinalized(currentSeasonId, seasons[currentSeasonId].totalDistributed);
    }
    
    /**
     * @notice Finalizar temporada manualmente
     */
    function finalizeSeason() external onlyRole(ADMIN_ROLE) {
        require(currentSeasonId > 0, "No season");
        require(!seasons[currentSeasonId].finalized, "Already finalized");
        require(block.timestamp >= seasons[currentSeasonId].endTime, "Season not ended");
        
        _finalizeSeason();
    }
    
    /**
     * @notice Reclamar recompensa de temporada finalizada (EN HACHI)
     */
    function claimSeasonReward(uint256 seasonId) external nonReentrant {
        require(seasons[seasonId].finalized, "Season not finalized");
        require(!rankings[seasonId][msg.sender].rewardClaimed, "Already claimed");
        require(rankings[seasonId][msg.sender].points > 0, "No points");
        
        // Calcular posicion
        uint256 rank = _calculateRank(seasonId, msg.sender);
        uint256 reward = _calculateReward(seasonId, rank);
        
        require(reward > 0, "No reward for rank");
        require(hachiToken.balanceOf(address(this)) >= reward, "Insufficient pool");
        
        rankings[seasonId][msg.sender].rewardClaimed = true;
        seasons[seasonId].totalDistributed += reward;
        
        hachiToken.safeTransfer(msg.sender, reward);
        
        emit RewardClaimed(msg.sender, seasonId, reward, rank);
    }
    
    /**
     * @notice Calcular posicion del usuario en el ranking
     */
    function _calculateRank(uint256 seasonId, address user) internal view returns (uint256) {
        uint256 userPoints = rankings[seasonId][user].points;
        uint256 rank = 1;
        
        address[] storage participants = seasonParticipants[seasonId];
        for (uint256 i = 0; i < participants.length; i++) {
            if (participants[i] != user && rankings[seasonId][participants[i]].points > userPoints) {
                rank++;
            }
        }
        
        return rank;
    }
    
    /**
     * @notice Calcular recompensa segun posicion (EN HACHI)
     */
    function _calculateReward(uint256 seasonId, uint256 rank) internal view returns (uint256) {
        uint256 pool = seasons[seasonId].rewardPool;
        
        // Top 1: 20% del pool
        if (rank == 1) return (pool * rewardPercentages[0]) / 10000;
        
        // Top 2-5: 15% dividido entre 4
        if (rank <= rewardTiers[1]) return (pool * rewardPercentages[1]) / 10000 / (rewardTiers[1] - 1);
        
        // Top 6-20: 10% dividido entre 15
        if (rank <= rewardTiers[2]) return (pool * rewardPercentages[2]) / 10000 / (rewardTiers[2] - rewardTiers[1]);
        
        // Top 21-100: 5% dividido entre 80
        if (rank <= rewardTiers[3]) return (pool * rewardPercentages[3]) / 10000 / (rewardTiers[3] - rewardTiers[2]);
        
        return 0;
    }
    
    /**
     * @notice Obtener ranking del usuario
     */
    function getUserRanking(uint256 seasonId, address user) external view returns (UserRanking memory, uint256 rank) {
        return (rankings[seasonId][user], _calculateRank(seasonId, user));
    }
    
    /**
     * @notice Obtener temporada actual
     */
    function getCurrentSeason() external view returns (Season memory) {
        return seasons[currentSeasonId];
    }
    
    /**
     * @notice Obtener numero de participantes en temporada
     */
    function getParticipantCount(uint256 seasonId) external view returns (uint256) {
        return seasonParticipants[seasonId].length;
    }
    
    /**
     * @notice Calcular recompensa estimada para usuario
     */
    function estimateReward(address user) external view returns (uint256 rank, uint256 estimatedReward) {
        if (currentSeasonId == 0) return (0, 0);
        rank = _calculateRank(currentSeasonId, user);
        estimatedReward = _calculateReward(currentSeasonId, rank);
    }
    
    // === Funding Functions ===
    
    /**
     * @notice Agregar HACHI al pool de premios
     */
    function fundRewardPool(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        hachiToken.safeTransferFrom(msg.sender, address(this), amount);
        
        if (currentSeasonId > 0 && !seasons[currentSeasonId].finalized) {
            seasons[currentSeasonId].rewardPool += amount;
        }
        
        emit RewardPoolFunded(amount, currentSeasonId > 0 ? seasons[currentSeasonId].rewardPool : amount);
    }
    
    /**
     * @notice Treasury deposita HACHI para rewards
     */
    function depositFromTreasury(uint256 amount) external {
        require(msg.sender == treasury || hasRole(ADMIN_ROLE, msg.sender), "Unauthorized");
        require(amount > 0, "Amount must be > 0");
        
        hachiToken.safeTransferFrom(msg.sender, address(this), amount);
        
        if (currentSeasonId > 0 && !seasons[currentSeasonId].finalized) {
            seasons[currentSeasonId].rewardPool += amount;
        }
        
        emit RewardPoolFunded(amount, currentSeasonId > 0 ? seasons[currentSeasonId].rewardPool : amount);
    }
    
    // === Admin Functions ===
    
    function setTreasury(address _treasury) external onlyRole(ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
    }
    
    function setRewardTiers(uint256[] calldata tiers, uint256[] calldata percentages) external onlyRole(ADMIN_ROLE) {
        require(tiers.length == percentages.length, "Length mismatch");
        rewardTiers = tiers;
        rewardPercentages = percentages;
    }
    
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    function emergencyWithdraw(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        hachiToken.safeTransfer(msg.sender, amount);
    }
}
