// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HachiRanking
 * @notice Sistema de ranking por temporada con puntos y recompensas
 * @dev Los puntos se ganan por actividades en la app
 */
contract HachiRanking is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant POINTS_MANAGER_ROLE = keccak256("POINTS_MANAGER_ROLE");
    
    IERC20 public immutable kobanToken;
    
    // Puntos por actividad
    uint256 public constant POINTS_DAILY_CLAIM = 10;
    uint256 public constant POINTS_FEED_CAT = 5;
    uint256 public constant POINTS_OPEN_CHEST = 50;
    uint256 public constant POINTS_DEPOSIT_CHEST = 5;
    uint256 public constant POINTS_MISSION_COMPLETE = 25;
    uint256 public constant POINTS_AD_WATCH = 15;
    uint256 public constant POINTS_CAT_UPGRADE = 75;
    uint256 public constant POINTS_EQUIP_ACCESSORY = 10;
    uint256 public constant POINTS_STAKING_DEPOSIT = 20; // por cada 1000 HACHI
    uint256 public constant POINTS_REFERRAL = 100;
    
    // Temporada
    struct Season {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256 rewardPool;
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
        bool rewardClaimed;
    }
    
    // Temporadas
    uint256 public currentSeasonId;
    mapping(uint256 => Season) public seasons;
    
    // Rankings por temporada
    mapping(uint256 => mapping(address => UserRanking)) public rankings;
    mapping(uint256 => address[]) public seasonParticipants;
    mapping(uint256 => mapping(address => bool)) public isParticipant;
    
    // Referidos
    mapping(address => address) public referrer;
    mapping(address => address[]) public referrals;
    
    // Recompensas por posicion (en basis points del pool, 10000 = 100%)
    uint256[] public rewardTiers;      // [top1, top2-5, top6-20, top21-100]
    uint256[] public rewardPercentages; // [2000, 1500, 500, 100] = 20%, 15%, 5%, 1%
    
    // Eventos
    event SeasonStarted(uint256 indexed seasonId, uint256 startTime, uint256 endTime, uint256 rewardPool);
    event SeasonFinalized(uint256 indexed seasonId);
    event PointsAdded(address indexed user, uint256 points, string activity);
    event RewardClaimed(address indexed user, uint256 seasonId, uint256 amount, uint256 rank);
    event ReferralRegistered(address indexed user, address indexed referrer);
    
    constructor(address _kobanToken) {
        require(_kobanToken != address(0), "Invalid token");
        kobanToken = IERC20(_kobanToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(POINTS_MANAGER_ROLE, msg.sender);
        
        // Configurar tiers de recompensa por defecto
        rewardTiers = [1, 5, 20, 100];
        rewardPercentages = [2000, 1500, 500, 100]; // 20%, 15%, 5%, 1%
    }
    
    /**
     * @notice Iniciar nueva temporada
     */
    function startSeason(uint256 duration, uint256 rewardPool) external onlyRole(ADMIN_ROLE) {
        // Finalizar temporada anterior si existe
        if (currentSeasonId > 0 && !seasons[currentSeasonId].finalized) {
            seasons[currentSeasonId].finalized = true;
            emit SeasonFinalized(currentSeasonId);
        }
        
        currentSeasonId++;
        
        seasons[currentSeasonId] = Season({
            id: currentSeasonId,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            rewardPool: rewardPool,
            finalized: false
        });
        
        emit SeasonStarted(currentSeasonId, block.timestamp, block.timestamp + duration, rewardPool);
    }
    
    /**
     * @notice Agregar puntos a un usuario (llamado por backend/otros contratos)
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
        
        // Agregar participante si es nuevo
        if (!isParticipant[currentSeasonId][user]) {
            isParticipant[currentSeasonId][user] = true;
            seasonParticipants[currentSeasonId].push(user);
        }
        
        rankings[currentSeasonId][user].points += points;
        
        emit PointsAdded(user, points, activity);
    }
    
    /**
     * @notice Agregar puntos por actividad especifica
     */
    function addActivityPoints(address user, uint8 activityType) external onlyRole(POINTS_MANAGER_ROLE) whenNotPaused {
        require(currentSeasonId > 0, "No active season");
        require(!seasons[currentSeasonId].finalized, "Season finalized");
        
        uint256 points;
        string memory activity;
        
        if (activityType == 1) { points = POINTS_DAILY_CLAIM; activity = "daily_claim"; rankings[currentSeasonId][user].claimsCount++; }
        else if (activityType == 2) { points = POINTS_FEED_CAT; activity = "feed_cat"; }
        else if (activityType == 3) { points = POINTS_OPEN_CHEST; activity = "open_chest"; rankings[currentSeasonId][user].chestsOpened++; }
        else if (activityType == 4) { points = POINTS_DEPOSIT_CHEST; activity = "deposit_chest"; }
        else if (activityType == 5) { points = POINTS_MISSION_COMPLETE; activity = "mission"; rankings[currentSeasonId][user].missionsCompleted++; }
        else if (activityType == 6) { points = POINTS_AD_WATCH; activity = "ad_watch"; rankings[currentSeasonId][user].adsWatched++; }
        else if (activityType == 7) { points = POINTS_CAT_UPGRADE; activity = "cat_upgrade"; rankings[currentSeasonId][user].upgrades++; }
        else if (activityType == 8) { points = POINTS_EQUIP_ACCESSORY; activity = "equip_accessory"; }
        else if (activityType == 9) { points = POINTS_STAKING_DEPOSIT; activity = "staking"; }
        else if (activityType == 10) { points = POINTS_REFERRAL; activity = "referral"; rankings[currentSeasonId][user].referralsCount++; }
        else revert("Invalid activity type");
        
        // Agregar participante si es nuevo
        if (!isParticipant[currentSeasonId][user]) {
            isParticipant[currentSeasonId][user] = true;
            seasonParticipants[currentSeasonId].push(user);
        }
        
        rankings[currentSeasonId][user].points += points;
        
        emit PointsAdded(user, points, activity);
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
            if (!isParticipant[currentSeasonId][referrerAddr]) {
                isParticipant[currentSeasonId][referrerAddr] = true;
                seasonParticipants[currentSeasonId].push(referrerAddr);
            }
            rankings[currentSeasonId][referrerAddr].points += POINTS_REFERRAL;
            rankings[currentSeasonId][referrerAddr].referralsCount++;
            
            emit PointsAdded(referrerAddr, POINTS_REFERRAL, "referral");
        }
        
        emit ReferralRegistered(newUser, referrerAddr);
    }
    
    /**
     * @notice Finalizar temporada
     */
    function finalizeSeason() external onlyRole(ADMIN_ROLE) {
        require(currentSeasonId > 0, "No season");
        require(!seasons[currentSeasonId].finalized, "Already finalized");
        require(block.timestamp >= seasons[currentSeasonId].endTime, "Season not ended");
        
        seasons[currentSeasonId].finalized = true;
        emit SeasonFinalized(currentSeasonId);
    }
    
    /**
     * @notice Reclamar recompensa de temporada finalizada
     */
    function claimSeasonReward(uint256 seasonId) external nonReentrant {
        require(seasons[seasonId].finalized, "Season not finalized");
        require(!rankings[seasonId][msg.sender].rewardClaimed, "Already claimed");
        require(rankings[seasonId][msg.sender].points > 0, "No points");
        
        // Calcular posicion
        uint256 rank = _calculateRank(seasonId, msg.sender);
        uint256 reward = _calculateReward(seasonId, rank);
        
        require(reward > 0, "No reward for rank");
        require(kobanToken.balanceOf(address(this)) >= reward, "Insufficient pool");
        
        rankings[seasonId][msg.sender].rewardClaimed = true;
        kobanToken.safeTransfer(msg.sender, reward);
        
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
     * @notice Calcular recompensa segun posicion
     */
    function _calculateReward(uint256 seasonId, uint256 rank) internal view returns (uint256) {
        uint256 pool = seasons[seasonId].rewardPool;
        
        if (rank == 1) return (pool * rewardPercentages[0]) / 10000;
        if (rank <= rewardTiers[1]) return (pool * rewardPercentages[1]) / 10000 / (rewardTiers[1] - 1);
        if (rank <= rewardTiers[2]) return (pool * rewardPercentages[2]) / 10000 / (rewardTiers[2] - rewardTiers[1]);
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
    
    // === Admin Functions ===
    
    function fundRewardPool(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        kobanToken.safeTransferFrom(msg.sender, address(this), amount);
        if (currentSeasonId > 0 && !seasons[currentSeasonId].finalized) {
            seasons[currentSeasonId].rewardPool += amount;
        }
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
    
    function emergencyWithdraw(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
