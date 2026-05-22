// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HachiStaking
 * @notice Staking de KOBAN con rewards en KOBAN
 * @dev APY: 60% base, hasta 80% sin membresia, 100% con membresia
 *      Temporada: 90 dias (3 meses)
 */
contract HachiStaking is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    IERC20 public immutable kobanToken;
    
    // APY Configuration (en basis points, 10000 = 100%)
    uint256 public constant BASE_APY = 6000; // 60% anual base
    uint256 public constant MAX_APY_NO_MEMBERSHIP = 8000; // 80% max sin membresia
    uint256 public constant MAX_APY_WITH_MEMBERSHIP = 10000; // 100% max con membresia
    uint256 public constant APY_PER_LEVEL = 200; // 2% por nivel arriba de 10
    uint256 public constant MIN_LEVEL_FOR_BONUS = 10;
    uint256 public constant MAX_LEVEL = 20;
    
    uint256 public constant MIN_STAKE = 100 * 10**18; // 100 KOBAN minimo
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant SEASON_DURATION = 90 days; // 3 meses
    
    // Estructura de stake
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 lastClaimTime;
        uint256 catLevel;
        bool hasMembership;
        bool active;
    }
    
    // User stakes
    mapping(address => StakeInfo[]) public userStakes;
    mapping(address => uint256) public totalStakedByUser;
    mapping(address => bool) public userHasMembership;
    mapping(address => uint256) public userCatLevel;
    
    // Estadisticas globales
    uint256 public totalStaked;
    uint256 public totalRewardsPaid;
    uint256 public rewardsPool;
    
    // Season tracking
    uint256 public currentSeasonId;
    uint256 public currentSeasonStart;
    
    // Eventos
    event Staked(address indexed user, uint256 amount, uint256 catLevel, bool hasMembership, uint256 apy);
    event Unstaked(address indexed user, uint256 amount, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 rewards);
    event RewardsPoolFunded(uint256 amount);
    event MembershipUpdated(address indexed user, bool hasMembership);
    event CatLevelUpdated(address indexed user, uint256 newLevel);
    event NewSeasonStarted(uint256 seasonId, uint256 startTime);
    
    constructor(address _kobanToken) {
        require(_kobanToken != address(0), "Invalid token address");
        kobanToken = IERC20(_kobanToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        
        currentSeasonId = 1;
        currentSeasonStart = block.timestamp;
    }
    
    /**
     * @notice Calcula APY basado en nivel del gato y membresia
     * @param catLevel Nivel del gato (1-20)
     * @param hasMembership Si tiene membresia activa
     * @return APY en basis points (6000 = 60%)
     */
    function calculateAPY(uint256 catLevel, bool hasMembership) public pure returns (uint256) {
        uint256 apy = BASE_APY;
        
        // Bonus por nivel de gato arriba de 10
        if (catLevel > MIN_LEVEL_FOR_BONUS) {
            uint256 bonusLevels = catLevel - MIN_LEVEL_FOR_BONUS;
            if (catLevel > MAX_LEVEL) {
                bonusLevels = MAX_LEVEL - MIN_LEVEL_FOR_BONUS;
            }
            apy += bonusLevels * APY_PER_LEVEL;
        }
        
        // Cap segun membresia
        uint256 maxAPY = hasMembership ? MAX_APY_WITH_MEMBERSHIP : MAX_APY_NO_MEMBERSHIP;
        return apy > maxAPY ? maxAPY : apy;
    }
    
    /**
     * @notice Stake KOBAN tokens
     * @param amount Cantidad a stakear
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= MIN_STAKE, "Below minimum stake");
        
        kobanToken.safeTransferFrom(msg.sender, address(this), amount);
        
        uint256 catLevel = userCatLevel[msg.sender];
        if (catLevel == 0) catLevel = 1;
        bool hasMembership = userHasMembership[msg.sender];
        
        userStakes[msg.sender].push(StakeInfo({
            amount: amount,
            startTime: block.timestamp,
            lastClaimTime: block.timestamp,
            catLevel: catLevel,
            hasMembership: hasMembership,
            active: true
        }));
        
        totalStakedByUser[msg.sender] += amount;
        totalStaked += amount;
        
        uint256 apy = calculateAPY(catLevel, hasMembership);
        emit Staked(msg.sender, amount, catLevel, hasMembership, apy);
    }
    
    /**
     * @notice Calcula recompensas pendientes de un stake
     */
    function calculateRewards(address user, uint256 stakeIndex) public view returns (uint256) {
        require(stakeIndex < userStakes[user].length, "Invalid stake index");
        
        StakeInfo storage stakeInfo = userStakes[user][stakeIndex];
        if (!stakeInfo.active) return 0;
        
        uint256 timeElapsed = block.timestamp - stakeInfo.lastClaimTime;
        
        // Usar el estado actual del usuario (puede haber mejorado)
        uint256 catLevel = userCatLevel[user];
        if (catLevel < stakeInfo.catLevel) catLevel = stakeInfo.catLevel;
        bool hasMembership = userHasMembership[user] || stakeInfo.hasMembership;
        
        uint256 apy = calculateAPY(catLevel, hasMembership);
        
        // rewards = (amount * apy * timeElapsed) / (10000 * SECONDS_PER_YEAR)
        return (stakeInfo.amount * apy * timeElapsed) / (10000 * SECONDS_PER_YEAR);
    }
    
    /**
     * @notice Calcula total de recompensas pendientes del usuario
     */
    function getTotalPendingRewards(address user) external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < userStakes[user].length; i++) {
            total += calculateRewards(user, i);
        }
        return total;
    }
    
    /**
     * @notice Reclamar todas las recompensas pendientes
     */
    function claimAllRewards() external nonReentrant whenNotPaused {
        uint256 totalRewards = 0;
        
        for (uint256 i = 0; i < userStakes[msg.sender].length; i++) {
            if (userStakes[msg.sender][i].active) {
                uint256 rewards = calculateRewards(msg.sender, i);
                if (rewards > 0) {
                    userStakes[msg.sender][i].lastClaimTime = block.timestamp;
                    // Update stake info with current user status
                    userStakes[msg.sender][i].catLevel = userCatLevel[msg.sender];
                    userStakes[msg.sender][i].hasMembership = userHasMembership[msg.sender];
                    totalRewards += rewards;
                }
            }
        }
        
        require(totalRewards > 0, "No rewards to claim");
        require(rewardsPool >= totalRewards, "Insufficient rewards pool");
        
        rewardsPool -= totalRewards;
        totalRewardsPaid += totalRewards;
        
        kobanToken.safeTransfer(msg.sender, totalRewards);
        
        emit RewardsClaimed(msg.sender, totalRewards);
    }
    
    /**
     * @notice Unstake y recibir principal + recompensas
     */
    function unstake(uint256 stakeIndex) external nonReentrant whenNotPaused {
        require(stakeIndex < userStakes[msg.sender].length, "Invalid stake index");
        
        StakeInfo storage stakeInfo = userStakes[msg.sender][stakeIndex];
        require(stakeInfo.active, "Stake not active");
        
        uint256 rewards = calculateRewards(msg.sender, stakeIndex);
        uint256 principal = stakeInfo.amount;
        uint256 totalAmount = principal + rewards;
        
        require(kobanToken.balanceOf(address(this)) >= totalAmount, "Insufficient contract balance");
        if (rewards > 0) {
            require(rewardsPool >= rewards, "Insufficient rewards pool");
            rewardsPool -= rewards;
            totalRewardsPaid += rewards;
        }
        
        stakeInfo.active = false;
        totalStakedByUser[msg.sender] -= principal;
        totalStaked -= principal;
        
        kobanToken.safeTransfer(msg.sender, totalAmount);
        
        emit Unstaked(msg.sender, principal, rewards);
    }
    
    /**
     * @notice Actualizar membresia del usuario (Oracle)
     */
    function updateMembership(address user, bool hasMembership) external onlyRole(ORACLE_ROLE) {
        userHasMembership[user] = hasMembership;
        emit MembershipUpdated(user, hasMembership);
    }
    
    /**
     * @notice Actualizar nivel del gato del usuario (Oracle)
     */
    function updateCatLevel(address user, uint256 newLevel) external onlyRole(ORACLE_ROLE) {
        require(newLevel >= 1 && newLevel <= MAX_LEVEL, "Invalid level");
        userCatLevel[user] = newLevel;
        emit CatLevelUpdated(user, newLevel);
    }
    
    /**
     * @notice Fondear el pool de recompensas
     */
    function fundRewardsPool(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        kobanToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardsPool += amount;
        emit RewardsPoolFunded(amount);
    }
    
    /**
     * @notice Iniciar nueva temporada
     */
    function startNewSeason() external onlyRole(ADMIN_ROLE) {
        require(block.timestamp >= currentSeasonStart + SEASON_DURATION, "Season not ended");
        currentSeasonId++;
        currentSeasonStart = block.timestamp;
        emit NewSeasonStarted(currentSeasonId, currentSeasonStart);
    }
    
    /**
     * @notice Obtener APY actual del usuario
     */
    function getUserAPY(address user) external view returns (uint256) {
        uint256 catLevel = userCatLevel[user];
        if (catLevel == 0) catLevel = 1;
        return calculateAPY(catLevel, userHasMembership[user]);
    }
    
    /**
     * @notice Obtener informacion de stakes del usuario
     */
    function getUserStakes(address user) external view returns (StakeInfo[] memory) {
        return userStakes[user];
    }
    
    /**
     * @notice Obtener informacion de temporada
     */
    function getSeasonInfo() external view returns (
        uint256 seasonId,
        uint256 startTime,
        uint256 endTime,
        uint256 remaining
    ) {
        uint256 end = currentSeasonStart + SEASON_DURATION;
        uint256 rem = block.timestamp >= end ? 0 : end - block.timestamp;
        return (currentSeasonId, currentSeasonStart, end, rem);
    }
    
    // === Admin Functions ===
    
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
