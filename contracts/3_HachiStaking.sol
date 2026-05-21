// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HachiStaking
 * @notice Staking de HACHI con APY variable (50% base - 80% max anual)
 * @dev APY aumenta segun nivel del gato del usuario
 */
contract HachiStaking is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GAME_CONTROLLER_ROLE = keccak256("GAME_CONTROLLER_ROLE");
    
    IERC20 public immutable hachiToken;
    
    // APY Configuration (en basis points, 10000 = 100%)
    uint256 public constant BASE_APY = 5000; // 50% anual
    uint256 public constant MAX_APY = 8000;  // 80% anual
    uint256 public constant APY_PER_LEVEL = 150; // 1.5% por nivel arriba de 10
    uint256 public constant MIN_LEVEL_FOR_BONUS = 10;
    uint256 public constant MAX_LEVEL = 20;
    
    uint256 public constant MIN_STAKE = 1000 * 10**18; // 1000 HACHI minimo
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    // Estructura de stake
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 lastClaimTime;
        uint256 catLevel; // Nivel del gato al momento de stake
        bool active;
    }
    
    // User stakes
    mapping(address => StakeInfo[]) public userStakes;
    mapping(address => uint256) public totalStakedByUser;
    
    // Estadisticas globales
    uint256 public totalStaked;
    uint256 public totalRewardsPaid;
    
    // Pool de recompensas
    uint256 public rewardsPool;
    
    // Eventos
    event Staked(address indexed user, uint256 amount, uint256 catLevel, uint256 apy);
    event Unstaked(address indexed user, uint256 amount, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 rewards);
    event RewardsPoolFunded(uint256 amount);
    event CatLevelUpdated(address indexed user, uint256 stakeIndex, uint256 newLevel);
    
    constructor(address _hachiToken) {
        require(_hachiToken != address(0), "Invalid token address");
        hachiToken = IERC20(_hachiToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @notice Calcula APY basado en nivel del gato
     * @param catLevel Nivel del gato (1-20)
     * @return APY en basis points (5000 = 50%)
     */
    function calculateAPY(uint256 catLevel) public pure returns (uint256) {
        if (catLevel <= MIN_LEVEL_FOR_BONUS) {
            return BASE_APY;
        }
        
        uint256 bonusLevels = catLevel - MIN_LEVEL_FOR_BONUS;
        if (catLevel > MAX_LEVEL) {
            bonusLevels = MAX_LEVEL - MIN_LEVEL_FOR_BONUS;
        }
        
        uint256 totalAPY = BASE_APY + (bonusLevels * APY_PER_LEVEL);
        return totalAPY > MAX_APY ? MAX_APY : totalAPY;
    }
    
    /**
     * @notice Stake HACHI tokens
     * @param amount Cantidad a stakear
     * @param catLevel Nivel actual del gato del usuario
     */
    function stake(uint256 amount, uint256 catLevel) external nonReentrant whenNotPaused {
        require(amount >= MIN_STAKE, "Below minimum stake");
        require(catLevel >= 1 && catLevel <= MAX_LEVEL, "Invalid cat level");
        
        hachiToken.safeTransferFrom(msg.sender, address(this), amount);
        
        userStakes[msg.sender].push(StakeInfo({
            amount: amount,
            startTime: block.timestamp,
            lastClaimTime: block.timestamp,
            catLevel: catLevel,
            active: true
        }));
        
        totalStakedByUser[msg.sender] += amount;
        totalStaked += amount;
        
        uint256 apy = calculateAPY(catLevel);
        emit Staked(msg.sender, amount, catLevel, apy);
    }
    
    /**
     * @notice Calcula recompensas pendientes de un stake
     */
    function calculateRewards(address user, uint256 stakeIndex) public view returns (uint256) {
        require(stakeIndex < userStakes[user].length, "Invalid stake index");
        
        StakeInfo storage stakeInfo = userStakes[user][stakeIndex];
        if (!stakeInfo.active) return 0;
        
        uint256 timeElapsed = block.timestamp - stakeInfo.lastClaimTime;
        uint256 apy = calculateAPY(stakeInfo.catLevel);
        
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
     * @notice Reclamar recompensas de un stake especifico
     */
    function claimRewards(uint256 stakeIndex) external nonReentrant whenNotPaused {
        require(stakeIndex < userStakes[msg.sender].length, "Invalid stake index");
        
        StakeInfo storage stakeInfo = userStakes[msg.sender][stakeIndex];
        require(stakeInfo.active, "Stake not active");
        
        uint256 rewards = calculateRewards(msg.sender, stakeIndex);
        require(rewards > 0, "No rewards to claim");
        require(rewardsPool >= rewards, "Insufficient rewards pool");
        
        stakeInfo.lastClaimTime = block.timestamp;
        rewardsPool -= rewards;
        totalRewardsPaid += rewards;
        
        hachiToken.safeTransfer(msg.sender, rewards);
        
        emit RewardsClaimed(msg.sender, rewards);
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
                    totalRewards += rewards;
                }
            }
        }
        
        require(totalRewards > 0, "No rewards to claim");
        require(rewardsPool >= totalRewards, "Insufficient rewards pool");
        
        rewardsPool -= totalRewards;
        totalRewardsPaid += totalRewards;
        
        hachiToken.safeTransfer(msg.sender, totalRewards);
        
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
        
        // Verificar que hay suficientes fondos
        require(hachiToken.balanceOf(address(this)) >= totalAmount, "Insufficient contract balance");
        if (rewards > 0) {
            require(rewardsPool >= rewards, "Insufficient rewards pool");
            rewardsPool -= rewards;
            totalRewardsPaid += rewards;
        }
        
        // Actualizar estado
        stakeInfo.active = false;
        totalStakedByUser[msg.sender] -= principal;
        totalStaked -= principal;
        
        // Transferir fondos
        hachiToken.safeTransfer(msg.sender, totalAmount);
        
        emit Unstaked(msg.sender, principal, rewards);
    }
    
    /**
     * @notice Actualizar nivel del gato para un stake (aumenta APY)
     */
    function updateCatLevel(
        address user, 
        uint256 stakeIndex, 
        uint256 newLevel
    ) external onlyRole(GAME_CONTROLLER_ROLE) {
        require(stakeIndex < userStakes[user].length, "Invalid stake index");
        require(newLevel >= 1 && newLevel <= MAX_LEVEL, "Invalid level");
        
        StakeInfo storage stakeInfo = userStakes[user][stakeIndex];
        require(stakeInfo.active, "Stake not active");
        require(newLevel > stakeInfo.catLevel, "New level must be higher");
        
        stakeInfo.catLevel = newLevel;
        
        emit CatLevelUpdated(user, stakeIndex, newLevel);
    }
    
    /**
     * @notice Fondear el pool de recompensas
     */
    function fundRewardsPool(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        hachiToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardsPool += amount;
        emit RewardsPoolFunded(amount);
    }
    
    /**
     * @notice Obtener informacion de stakes del usuario
     */
    function getUserStakes(address user) external view returns (StakeInfo[] memory) {
        return userStakes[user];
    }
    
    /**
     * @notice Obtener numero de stakes del usuario
     */
    function getUserStakeCount(address user) external view returns (uint256) {
        return userStakes[user].length;
    }
    
    // === Admin Functions ===
    
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Retirar tokens de emergencia (solo admin)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
