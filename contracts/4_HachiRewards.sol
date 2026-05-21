// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWorldIDVerifier {
    function isVerified(address user) external view returns (bool);
}

/**
 * @title HachiRewards
 * @notice Distribucion de recompensas HACHI (anuncios) y KOBAN (produccion)
 * @dev Integra World ID para verificar humanidad antes de claims
 */
contract HachiRewards is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    
    IERC20 public immutable hachiToken;
    IERC20 public immutable kobanToken;
    IWorldIDVerifier public worldIdVerifier;
    
    // Limites de seguridad por claim
    uint256 public maxHachiPerClaim = 1000 * 10**18;  // Max 1000 HACHI por claim
    uint256 public maxKobanPerClaim = 10000 * 10**18; // Max 10000 KOBAN por claim
    
    // Cooldowns
    uint256 public constant CLAIM_COOLDOWN = 1 hours;
    mapping(address => uint256) public lastHachiClaim;
    mapping(address => uint256) public lastKobanClaim;
    
    // Recompensas pendientes (asignadas off-chain, reclamadas on-chain)
    mapping(address => uint256) public pendingHachi;
    mapping(address => uint256) public pendingKoban;
    
    // Estadisticas
    uint256 public totalHachiDistributed;
    uint256 public totalKobanDistributed;
    mapping(address => uint256) public userTotalHachiClaimed;
    mapping(address => uint256) public userTotalKobanClaimed;
    
    // Pools de recompensas
    uint256 public hachiRewardsPool;
    uint256 public kobanRewardsPool;
    
    // Verificacion World ID requerida
    bool public worldIdRequired = true;
    
    // Eventos
    event HachiClaimed(address indexed user, uint256 amount);
    event KobanClaimed(address indexed user, uint256 amount);
    event RewardsAssigned(address indexed user, uint256 hachiAmount, uint256 kobanAmount);
    event HachiPoolFunded(uint256 amount);
    event KobanPoolFunded(uint256 amount);
    event WorldIdRequirementUpdated(bool required);
    event MaxClaimUpdated(string tokenType, uint256 newMax);
    
    constructor(
        address _hachiToken,
        address _kobanToken,
        address _worldIdVerifier
    ) {
        require(_hachiToken != address(0), "Invalid HACHI token");
        require(_kobanToken != address(0), "Invalid KOBAN token");
        
        hachiToken = IERC20(_hachiToken);
        kobanToken = IERC20(_kobanToken);
        worldIdVerifier = IWorldIDVerifier(_worldIdVerifier);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Modifier para verificar humanidad con World ID
     */
    modifier onlyVerifiedHuman() {
        if (worldIdRequired && address(worldIdVerifier) != address(0)) {
            require(worldIdVerifier.isVerified(msg.sender), "World ID verification required");
        }
        _;
    }
    
    /**
     * @notice Asignar recompensas a un usuario (llamado por backend)
     * @dev Solo DISTRIBUTOR_ROLE puede llamar
     */
    function assignRewards(
        address user,
        uint256 hachiAmount,
        uint256 kobanAmount
    ) external onlyRole(DISTRIBUTOR_ROLE) {
        require(user != address(0), "Invalid user");
        
        if (hachiAmount > 0) {
            pendingHachi[user] += hachiAmount;
        }
        if (kobanAmount > 0) {
            pendingKoban[user] += kobanAmount;
        }
        
        emit RewardsAssigned(user, hachiAmount, kobanAmount);
    }
    
    /**
     * @notice Asignar recompensas en batch
     */
    function assignRewardsBatch(
        address[] calldata users,
        uint256[] calldata hachiAmounts,
        uint256[] calldata kobanAmounts
    ) external onlyRole(DISTRIBUTOR_ROLE) {
        require(users.length == hachiAmounts.length && users.length == kobanAmounts.length, "Array length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] != address(0)) {
                pendingHachi[users[i]] += hachiAmounts[i];
                pendingKoban[users[i]] += kobanAmounts[i];
                emit RewardsAssigned(users[i], hachiAmounts[i], kobanAmounts[i]);
            }
        }
    }
    
    /**
     * @notice Reclamar recompensas HACHI (de ver anuncios)
     */
    function claimHachi() external nonReentrant whenNotPaused onlyVerifiedHuman {
        require(pendingHachi[msg.sender] > 0, "No HACHI rewards");
        require(block.timestamp >= lastHachiClaim[msg.sender] + CLAIM_COOLDOWN, "Cooldown active");
        
        uint256 amount = pendingHachi[msg.sender];
        if (amount > maxHachiPerClaim) {
            amount = maxHachiPerClaim;
        }
        
        require(hachiRewardsPool >= amount, "Insufficient HACHI pool");
        
        pendingHachi[msg.sender] -= amount;
        lastHachiClaim[msg.sender] = block.timestamp;
        hachiRewardsPool -= amount;
        totalHachiDistributed += amount;
        userTotalHachiClaimed[msg.sender] += amount;
        
        hachiToken.safeTransfer(msg.sender, amount);
        
        emit HachiClaimed(msg.sender, amount);
    }
    
    /**
     * @notice Reclamar recompensas KOBAN (produccion de gatos/accesorios)
     */
    function claimKoban() external nonReentrant whenNotPaused onlyVerifiedHuman {
        require(pendingKoban[msg.sender] > 0, "No KOBAN rewards");
        require(block.timestamp >= lastKobanClaim[msg.sender] + CLAIM_COOLDOWN, "Cooldown active");
        
        uint256 amount = pendingKoban[msg.sender];
        if (amount > maxKobanPerClaim) {
            amount = maxKobanPerClaim;
        }
        
        require(kobanRewardsPool >= amount, "Insufficient KOBAN pool");
        
        pendingKoban[msg.sender] -= amount;
        lastKobanClaim[msg.sender] = block.timestamp;
        kobanRewardsPool -= amount;
        totalKobanDistributed += amount;
        userTotalKobanClaimed[msg.sender] += amount;
        
        kobanToken.safeTransfer(msg.sender, amount);
        
        emit KobanClaimed(msg.sender, amount);
    }
    
    /**
     * @notice Reclamar ambas recompensas
     */
    function claimAll() external nonReentrant whenNotPaused onlyVerifiedHuman {
        bool claimed = false;
        
        // Claim HACHI
        if (pendingHachi[msg.sender] > 0 && block.timestamp >= lastHachiClaim[msg.sender] + CLAIM_COOLDOWN) {
            uint256 hachiAmount = pendingHachi[msg.sender];
            if (hachiAmount > maxHachiPerClaim) {
                hachiAmount = maxHachiPerClaim;
            }
            if (hachiRewardsPool >= hachiAmount) {
                pendingHachi[msg.sender] -= hachiAmount;
                lastHachiClaim[msg.sender] = block.timestamp;
                hachiRewardsPool -= hachiAmount;
                totalHachiDistributed += hachiAmount;
                userTotalHachiClaimed[msg.sender] += hachiAmount;
                hachiToken.safeTransfer(msg.sender, hachiAmount);
                emit HachiClaimed(msg.sender, hachiAmount);
                claimed = true;
            }
        }
        
        // Claim KOBAN
        if (pendingKoban[msg.sender] > 0 && block.timestamp >= lastKobanClaim[msg.sender] + CLAIM_COOLDOWN) {
            uint256 kobanAmount = pendingKoban[msg.sender];
            if (kobanAmount > maxKobanPerClaim) {
                kobanAmount = maxKobanPerClaim;
            }
            if (kobanRewardsPool >= kobanAmount) {
                pendingKoban[msg.sender] -= kobanAmount;
                lastKobanClaim[msg.sender] = block.timestamp;
                kobanRewardsPool -= kobanAmount;
                totalKobanDistributed += kobanAmount;
                userTotalKobanClaimed[msg.sender] += kobanAmount;
                kobanToken.safeTransfer(msg.sender, kobanAmount);
                emit KobanClaimed(msg.sender, kobanAmount);
                claimed = true;
            }
        }
        
        require(claimed, "Nothing to claim");
    }
    
    /**
     * @notice Ver recompensas pendientes del usuario
     */
    function getPendingRewards(address user) external view returns (uint256 hachi, uint256 koban) {
        return (pendingHachi[user], pendingKoban[user]);
    }
    
    /**
     * @notice Ver tiempo restante de cooldown
     */
    function getCooldownRemaining(address user) external view returns (uint256 hachiCooldown, uint256 kobanCooldown) {
        uint256 hachiNext = lastHachiClaim[user] + CLAIM_COOLDOWN;
        uint256 kobanNext = lastKobanClaim[user] + CLAIM_COOLDOWN;
        
        hachiCooldown = block.timestamp >= hachiNext ? 0 : hachiNext - block.timestamp;
        kobanCooldown = block.timestamp >= kobanNext ? 0 : kobanNext - block.timestamp;
    }
    
    // === Pool Management ===
    
    function fundHachiPool(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        hachiToken.safeTransferFrom(msg.sender, address(this), amount);
        hachiRewardsPool += amount;
        emit HachiPoolFunded(amount);
    }
    
    function fundKobanPool(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        kobanToken.safeTransferFrom(msg.sender, address(this), amount);
        kobanRewardsPool += amount;
        emit KobanPoolFunded(amount);
    }
    
    // === Admin Functions ===
    
    function setWorldIdVerifier(address _verifier) external onlyRole(ADMIN_ROLE) {
        worldIdVerifier = IWorldIDVerifier(_verifier);
    }
    
    function setWorldIdRequired(bool required) external onlyRole(ADMIN_ROLE) {
        worldIdRequired = required;
        emit WorldIdRequirementUpdated(required);
    }
    
    function setMaxHachiPerClaim(uint256 max) external onlyRole(ADMIN_ROLE) {
        maxHachiPerClaim = max;
        emit MaxClaimUpdated("HACHI", max);
    }
    
    function setMaxKobanPerClaim(uint256 max) external onlyRole(ADMIN_ROLE) {
        maxKobanPerClaim = max;
        emit MaxClaimUpdated("KOBAN", max);
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
