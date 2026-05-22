// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWorldID {
    function verifyProof(
        uint256 root,
        uint256 groupId,
        uint256 signalHash,
        uint256 nullifierHash,
        uint256 externalNullifierHash,
        uint256[8] calldata proof
    ) external view;
}

interface IHachiStaking {
    function updateMembership(address user, bool hasMembership) external;
}

/**
 * @title HachiMembership
 * @notice Sistema de membresia premium (10 WLD = 90 dias)
 * @dev Beneficios:
 *      - +20% APY en staking (hasta 100%)
 *      - 10% descuento en mejoras de gatos
 *      - 60% del valor devuelto en HACHI durante 90 dias
 */
contract HachiMembership is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    IERC20 public immutable wldToken;
    IERC20 public immutable hachiToken;
    IHachiStaking public stakingContract;
    IWorldID public worldId;
    
    // Membership config
    uint256 public constant MEMBERSHIP_COST = 10 * 10**18; // 10 WLD
    uint256 public constant MEMBERSHIP_DURATION = 90 days; // 3 meses
    uint256 public constant HACHI_RETURN_PERCENT = 60; // 60% devuelto en HACHI
    
    // World ID config
    uint256 public immutable groupId;
    uint256 public immutable externalNullifier;
    
    // Membership info
    struct MembershipInfo {
        uint256 startTime;
        uint256 endTime;
        uint256 hachiPriceAtPurchase; // Precio HACHI en WLD al comprar
        uint256 totalHachiToReturn; // Total HACHI a devolver
        uint256 hachiClaimed; // HACHI ya reclamado
        bool active;
    }
    
    mapping(address => MembershipInfo) public memberships;
    mapping(uint256 => bool) public usedNullifiers; // World ID nullifiers
    
    // Stats
    uint256 public totalMembershipsSold;
    uint256 public totalWLDCollected;
    
    // Wallets
    address public adminWallet;
    
    // HACHI price (set by oracle, in WLD with 18 decimals)
    uint256 public hachiPriceInWLD = 0.001 * 10**18; // Default: 1 HACHI = 0.001 WLD
    
    // Events
    event MembershipPurchased(address indexed user, uint256 wldPaid, uint256 hachiToReturn, uint256 endTime);
    event HachiClaimed(address indexed user, uint256 amount);
    event MembershipExpired(address indexed user);
    event HachiPriceUpdated(uint256 newPrice);
    
    constructor(
        address _wldToken,
        address _hachiToken,
        address _stakingContract,
        address _worldId,
        uint256 _groupId,
        address _adminWallet
    ) {
        require(_wldToken != address(0), "Invalid WLD token");
        require(_hachiToken != address(0), "Invalid HACHI token");
        require(_adminWallet != address(0), "Invalid admin wallet");
        
        wldToken = IERC20(_wldToken);
        hachiToken = IERC20(_hachiToken);
        stakingContract = IHachiStaking(_stakingContract);
        worldId = IWorldID(_worldId);
        groupId = _groupId;
        externalNullifier = uint256(keccak256(abi.encodePacked("hachi_membership_v1")));
        adminWallet = _adminWallet;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @notice Comprar membresia con World ID verification
     */
    function purchaseMembership(
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external nonReentrant whenNotPaused {
        // Verify World ID
        require(!usedNullifiers[nullifierHash], "Already verified");
        
        worldId.verifyProof(
            root,
            groupId,
            uint256(keccak256(abi.encodePacked(msg.sender))),
            nullifierHash,
            externalNullifier,
            proof
        );
        
        usedNullifiers[nullifierHash] = true;
        
        _purchaseMembership();
    }
    
    /**
     * @notice Comprar membresia sin World ID (para testing/desarrollo)
     */
    function purchaseMembershipNoVerify() external nonReentrant whenNotPaused {
        _purchaseMembership();
    }
    
    function _purchaseMembership() internal {
        require(!memberships[msg.sender].active || block.timestamp > memberships[msg.sender].endTime, 
            "Active membership exists");
        
        // Transfer WLD payment
        wldToken.safeTransferFrom(msg.sender, adminWallet, MEMBERSHIP_COST);
        
        // Calculate HACHI to return (60% of value)
        // 60% of 10 WLD = 6 WLD worth of HACHI
        uint256 wldValueToReturn = (MEMBERSHIP_COST * HACHI_RETURN_PERCENT) / 100;
        uint256 hachiToReturn = (wldValueToReturn * 10**18) / hachiPriceInWLD;
        
        memberships[msg.sender] = MembershipInfo({
            startTime: block.timestamp,
            endTime: block.timestamp + MEMBERSHIP_DURATION,
            hachiPriceAtPurchase: hachiPriceInWLD,
            totalHachiToReturn: hachiToReturn,
            hachiClaimed: 0,
            active: true
        });
        
        totalMembershipsSold++;
        totalWLDCollected += MEMBERSHIP_COST;
        
        // Update staking contract
        if (address(stakingContract) != address(0)) {
            stakingContract.updateMembership(msg.sender, true);
        }
        
        emit MembershipPurchased(msg.sender, MEMBERSHIP_COST, hachiToReturn, block.timestamp + MEMBERSHIP_DURATION);
    }
    
    /**
     * @notice Calcular HACHI disponible para reclamar
     */
    function getClaimableHachi(address user) public view returns (uint256) {
        MembershipInfo memory info = memberships[user];
        if (!info.active) return 0;
        
        uint256 elapsed = block.timestamp - info.startTime;
        if (elapsed > MEMBERSHIP_DURATION) {
            elapsed = MEMBERSHIP_DURATION;
        }
        
        // Linear vesting over 90 days
        uint256 vested = (info.totalHachiToReturn * elapsed) / MEMBERSHIP_DURATION;
        return vested > info.hachiClaimed ? vested - info.hachiClaimed : 0;
    }
    
    /**
     * @notice Reclamar HACHI disponible
     */
    function claimHachi() external nonReentrant whenNotPaused {
        MembershipInfo storage info = memberships[msg.sender];
        require(info.active, "No active membership");
        
        uint256 claimable = getClaimableHachi(msg.sender);
        require(claimable > 0, "Nothing to claim");
        require(hachiToken.balanceOf(address(this)) >= claimable, "Insufficient HACHI in contract");
        
        info.hachiClaimed += claimable;
        hachiToken.safeTransfer(msg.sender, claimable);
        
        // Check if membership expired
        if (block.timestamp > info.endTime) {
            info.active = false;
            if (address(stakingContract) != address(0)) {
                stakingContract.updateMembership(msg.sender, false);
            }
            emit MembershipExpired(msg.sender);
        }
        
        emit HachiClaimed(msg.sender, claimable);
    }
    
    /**
     * @notice Verificar si usuario tiene membresia activa
     */
    function hasMembership(address user) external view returns (bool) {
        MembershipInfo memory info = memberships[user];
        return info.active && block.timestamp <= info.endTime;
    }
    
    /**
     * @notice Obtener info de membresia
     */
    function getMembershipInfo(address user) external view returns (
        bool active,
        uint256 startTime,
        uint256 endTime,
        uint256 daysRemaining,
        uint256 totalHachiToReturn,
        uint256 hachiClaimed,
        uint256 hachiClaimable
    ) {
        MembershipInfo memory info = memberships[user];
        uint256 remaining = 0;
        if (info.active && block.timestamp < info.endTime) {
            remaining = (info.endTime - block.timestamp) / 1 days;
        }
        
        return (
            info.active && block.timestamp <= info.endTime,
            info.startTime,
            info.endTime,
            remaining,
            info.totalHachiToReturn,
            info.hachiClaimed,
            getClaimableHachi(user)
        );
    }
    
    // === Admin Functions ===
    
    function updateHachiPrice(uint256 newPrice) external onlyRole(ADMIN_ROLE) {
        require(newPrice > 0, "Invalid price");
        hachiPriceInWLD = newPrice;
        emit HachiPriceUpdated(newPrice);
    }
    
    function updateStakingContract(address _stakingContract) external onlyRole(ADMIN_ROLE) {
        stakingContract = IHachiStaking(_stakingContract);
    }
    
    function fundHachiPool(uint256 amount) external {
        hachiToken.safeTransferFrom(msg.sender, address(this), amount);
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
