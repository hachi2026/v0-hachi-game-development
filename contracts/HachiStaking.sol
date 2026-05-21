// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title HachiStaking
 * @dev Contrato de Staking para HACHI con APY variable
 * 
 * APY STRUCTURE:
 * - Base APY: 50% anual
 * - Bonus por nivel de gato: +1.5% por nivel sobre 10
 * - Max APY: 80% anual (con gato nivel 20)
 */
contract HachiStaking is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // ============ ROLES ============
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE"); // Para actualizar niveles de gatos
    
    // ============ TOKENS ============
    IERC20 public immutable hachiToken;
    IERC20 public immutable kobanToken;
    
    // ============ APY CONFIG ============
    uint256 public constant BASE_APY = 5000; // 50.00% (basis points)
    uint256 public constant MAX_APY = 8000;  // 80.00% (basis points)
    uint256 public constant APY_BONUS_PER_LEVEL = 150; // 1.50% por nivel
    uint256 public constant MIN_CAT_LEVEL_FOR_BONUS = 10;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    // ============ STAKING LIMITS ============
    uint256 public minStakeAmount = 1000 * 10**18; // 1000 HACHI minimo
    uint256 public maxStakeAmount = 1_000_000 * 10**18; // 1M HACHI maximo por usuario
    
    // ============ STRUCTS ============
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 lastClaimTime;
        uint256 totalRewardsClaimed;
        uint8 catLevel; // Nivel del gato del usuario (actualizado por oracle)
        bool active;
    }
    
    // ============ MAPPINGS ============
    mapping(address => StakeInfo) public stakes;
    mapping(address => uint8) public userCatLevels; // Cache de niveles de gatos
    
    // ============ STATE ============
    uint256 public totalStaked;
    uint256 public totalRewardsDistributed;
    uint256 public rewardsPool; // KOBAN disponible para recompensas
    
    // ============ EVENTS ============
    event Staked(address indexed user, uint256 amount, uint8 catLevel);
    event Unstaked(address indexed user, uint256 amount, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 amount);
    event CatLevelUpdated(address indexed user, uint8 newLevel);
    event RewardsPoolFunded(uint256 amount);
    event MinStakeUpdated(uint256 newMin);
    event MaxStakeUpdated(uint256 newMax);
    
    constructor(
        address _hachiToken,
        address _kobanToken
    ) {
        require(_hachiToken != address(0), "Invalid HACHI token");
        require(_kobanToken != address(0), "Invalid KOBAN token");
        
        hachiToken = IERC20(_hachiToken);
        kobanToken = IERC20(_kobanToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Calcula el APY para un usuario basado en su nivel de gato
     * @param catLevel Nivel del gato (1-20)
     * @return APY en basis points (5000 = 50%)
     */
    function calculateAPY(uint8 catLevel) public pure returns (uint256) {
        if (catLevel <= MIN_CAT_LEVEL_FOR_BONUS) {
            return BASE_APY;
        }
        
        uint256 bonusLevels = catLevel - MIN_CAT_LEVEL_FOR_BONUS;
        uint256 totalAPY = BASE_APY + (bonusLevels * APY_BONUS_PER_LEVEL);
        
        return totalAPY > MAX_APY ? MAX_APY : totalAPY;
    }
    
    /**
     * @dev Calcula recompensas pendientes para un usuario
     */
    function pendingRewards(address user) public view returns (uint256) {
        StakeInfo storage stake = stakes[user];
        
        if (!stake.active || stake.amount == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - stake.lastClaimTime;
        uint256 apy = calculateAPY(stake.catLevel);
        
        // Recompensa = (amount * apy * timeElapsed) / (basisPoints * secondsPerYear)
        uint256 reward = (stake.amount * apy * timeElapsed) / (BASIS_POINTS * SECONDS_PER_YEAR);
        
        return reward;
    }
    
    /**
     * @dev Obtiene info de stake de un usuario
     */
    function getStakeInfo(address user) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 pendingReward,
        uint256 currentAPY,
        uint8 catLevel,
        bool active
    ) {
        StakeInfo storage stake = stakes[user];
        return (
            stake.amount,
            stake.startTime,
            pendingRewards(user),
            calculateAPY(stake.catLevel),
            stake.catLevel,
            stake.active
        );
    }
    
    // ============ STAKING FUNCTIONS ============
    
    /**
     * @dev Deposita HACHI en staking
     * @param amount Cantidad de HACHI a stakear
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= minStakeAmount, "Below minimum stake");
        
        StakeInfo storage userStake = stakes[msg.sender];
        
        // Si ya tiene stake activo, primero reclama recompensas
        if (userStake.active && userStake.amount > 0) {
            _claimRewards(msg.sender);
        }
        
        require(userStake.amount + amount <= maxStakeAmount, "Exceeds max stake");
        
        // Transferir HACHI al contrato
        hachiToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Actualizar stake
        if (!userStake.active) {
            userStake.startTime = block.timestamp;
            userStake.lastClaimTime = block.timestamp;
            userStake.catLevel = userCatLevels[msg.sender] > 0 ? userCatLevels[msg.sender] : 1;
            userStake.active = true;
        }
        
        userStake.amount += amount;
        totalStaked += amount;
        
        emit Staked(msg.sender, amount, userStake.catLevel);
    }
    
    /**
     * @dev Retira HACHI del staking
     * @param amount Cantidad a retirar (0 = todo)
     */
    function unstake(uint256 amount) external nonReentrant {
        StakeInfo storage userStake = stakes[msg.sender];
        require(userStake.active, "No active stake");
        require(userStake.amount > 0, "Nothing staked");
        
        if (amount == 0) {
            amount = userStake.amount;
        }
        
        require(amount <= userStake.amount, "Insufficient stake");
        
        // Reclamar recompensas pendientes
        uint256 rewards = _claimRewards(msg.sender);
        
        // Actualizar stake
        userStake.amount -= amount;
        totalStaked -= amount;
        
        if (userStake.amount == 0) {
            userStake.active = false;
        }
        
        // Devolver HACHI
        hachiToken.safeTransfer(msg.sender, amount);
        
        emit Unstaked(msg.sender, amount, rewards);
    }
    
    /**
     * @dev Reclama recompensas sin retirar stake
     */
    function claimRewards() external nonReentrant {
        _claimRewards(msg.sender);
    }
    
    /**
     * @dev Logica interna de claim
     */
    function _claimRewards(address user) internal returns (uint256) {
        uint256 rewards = pendingRewards(user);
        
        if (rewards == 0) {
            return 0;
        }
        
        require(rewardsPool >= rewards, "Insufficient rewards pool");
        
        StakeInfo storage userStake = stakes[user];
        userStake.lastClaimTime = block.timestamp;
        userStake.totalRewardsClaimed += rewards;
        
        rewardsPool -= rewards;
        totalRewardsDistributed += rewards;
        
        // Transferir KOBAN como recompensa
        kobanToken.safeTransfer(user, rewards);
        
        emit RewardsClaimed(user, rewards);
        
        return rewards;
    }
    
    // ============ ORACLE FUNCTIONS ============
    
    /**
     * @dev Actualiza el nivel de gato de un usuario (llamado por backend/oracle)
     */
    function updateCatLevel(address user, uint8 newLevel) external onlyRole(ORACLE_ROLE) {
        require(newLevel >= 1 && newLevel <= 20, "Invalid cat level");
        
        userCatLevels[user] = newLevel;
        
        if (stakes[user].active) {
            // Reclamar con APY anterior antes de actualizar
            _claimRewards(user);
            stakes[user].catLevel = newLevel;
        }
        
        emit CatLevelUpdated(user, newLevel);
    }
    
    /**
     * @dev Actualiza niveles de multiples usuarios en batch
     */
    function batchUpdateCatLevels(
        address[] calldata users, 
        uint8[] calldata levels
    ) external onlyRole(ORACLE_ROLE) {
        require(users.length == levels.length, "Length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            require(levels[i] >= 1 && levels[i] <= 20, "Invalid cat level");
            
            userCatLevels[users[i]] = levels[i];
            
            if (stakes[users[i]].active) {
                _claimRewards(users[i]);
                stakes[users[i]].catLevel = levels[i];
            }
            
            emit CatLevelUpdated(users[i], levels[i]);
        }
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Fondea el pool de recompensas con KOBAN
     */
    function fundRewardsPool(uint256 amount) external onlyRole(ADMIN_ROLE) {
        kobanToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardsPool += amount;
        emit RewardsPoolFunded(amount);
    }
    
    /**
     * @dev Actualiza stake minimo
     */
    function setMinStake(uint256 _minStake) external onlyRole(ADMIN_ROLE) {
        minStakeAmount = _minStake;
        emit MinStakeUpdated(_minStake);
    }
    
    /**
     * @dev Actualiza stake maximo
     */
    function setMaxStake(uint256 _maxStake) external onlyRole(ADMIN_ROLE) {
        maxStakeAmount = _maxStake;
        emit MaxStakeUpdated(_maxStake);
    }
    
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Recupera tokens enviados por error (no HACHI stakeado ni KOBAN de recompensas)
     */
    function recoverToken(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(hachiToken)) {
            require(amount <= IERC20(token).balanceOf(address(this)) - totalStaked, "Cannot withdraw staked");
        }
        if (token == address(kobanToken)) {
            require(amount <= IERC20(token).balanceOf(address(this)) - rewardsPool, "Cannot withdraw rewards pool");
        }
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
