// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HachiLock
 * @dev HACHI token locking contract with APY rewards
 * 
 * APY Structure:
 * - Base APY: 5%
 * - Without Membership: +5% per 2 levels (max 50%)
 * - With Membership: +7% per level (max 70%)
 * 
 * Claims/Unstakes: Every 24 hours
 * Ranking points: Only after 24h staked
 */
contract HachiLock is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    IERC20 public hachiToken;
    
    // APY Configuration (in basis points, 100 = 1%)
    uint256 public constant BASE_APY = 500; // 5%
    uint256 public constant APY_PER_TWO_LEVELS = 500; // +5% per 2 levels
    uint256 public constant MAX_APY = 5000; // 50%
    uint256 public constant MEMBERSHIP_APY_PER_LEVEL = 700; // +7% per level
    uint256 public constant MAX_APY_MEMBERSHIP = 7000; // 70%
    
    // Timing
    uint256 public constant CLAIM_COOLDOWN = 24 hours;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    // Lock info
    struct LockInfo {
        uint256 amount;
        uint256 lockedAt;
        uint256 lastClaimAt;
        uint256 totalClaimed;
        bool isActive;
    }
    
    // User locks (user => lockId => LockInfo)
    mapping(address => mapping(uint256 => LockInfo)) public userLocks;
    mapping(address => uint256) public userLockCount;
    mapping(address => uint256) public userTotalLocked;
    
    // User data (from external source or set by admin)
    mapping(address => uint256) public userCatLevel;
    mapping(address => bool) public userHasMembership;
    
    // Global stats
    uint256 public totalLocked;
    uint256 public totalRewardsDistributed;
    
    // Treasury for rewards
    address public treasury;

    // ============================================
    // EVENTS
    // ============================================
    
    event HachiLocked(address indexed user, uint256 indexed lockId, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 indexed lockId, uint256 reward);
    event HachiUnlocked(address indexed user, uint256 indexed lockId, uint256 amount, uint256 reward);
    event UserDataUpdated(address indexed user, uint256 catLevel, bool hasMembership);

    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(address _hachiToken, address _treasury) Ownable(msg.sender) {
        hachiToken = IERC20(_hachiToken);
        treasury = _treasury;
    }

    // ============================================
    // MAIN FUNCTIONS
    // ============================================
    
    /**
     * @dev Lock HACHI tokens
     * @param amount Amount of HACHI to lock
     */
    function lock(uint256 amount) external nonReentrant {
        require(amount >= 100 * 10**18, "Minimum 100 HACHI");
        
        // Transfer HACHI from user
        hachiToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Create lock
        uint256 lockId = userLockCount[msg.sender];
        userLocks[msg.sender][lockId] = LockInfo({
            amount: amount,
            lockedAt: block.timestamp,
            lastClaimAt: block.timestamp,
            totalClaimed: 0,
            isActive: true
        });
        
        userLockCount[msg.sender]++;
        userTotalLocked[msg.sender] += amount;
        totalLocked += amount;
        
        emit HachiLocked(msg.sender, lockId, amount);
    }
    
    /**
     * @dev Claim rewards without unlocking
     * @param lockId The lock ID to claim from
     */
    function claimRewards(uint256 lockId) external nonReentrant {
        LockInfo storage lockInfo = userLocks[msg.sender][lockId];
        require(lockInfo.isActive, "Lock not active");
        require(block.timestamp >= lockInfo.lastClaimAt + CLAIM_COOLDOWN, "24h cooldown not passed");
        
        uint256 reward = calculateReward(msg.sender, lockId);
        require(reward > 0, "No rewards to claim");
        
        // Update lock info
        lockInfo.lastClaimAt = block.timestamp;
        lockInfo.totalClaimed += reward;
        
        // Transfer reward from treasury
        hachiToken.safeTransferFrom(treasury, msg.sender, reward);
        totalRewardsDistributed += reward;
        
        emit RewardsClaimed(msg.sender, lockId, reward);
    }
    
    /**
     * @dev Unlock HACHI and claim any pending rewards
     * @param lockId The lock ID to unlock
     */
    function unlock(uint256 lockId) external nonReentrant {
        LockInfo storage lockInfo = userLocks[msg.sender][lockId];
        require(lockInfo.isActive, "Lock not active");
        require(block.timestamp >= lockInfo.lastClaimAt + CLAIM_COOLDOWN, "24h cooldown not passed");
        
        uint256 reward = calculateReward(msg.sender, lockId);
        uint256 amount = lockInfo.amount;
        
        // Mark as inactive
        lockInfo.isActive = false;
        lockInfo.totalClaimed += reward;
        
        // Update totals
        userTotalLocked[msg.sender] -= amount;
        totalLocked -= amount;
        
        // Transfer principal back
        hachiToken.safeTransfer(msg.sender, amount);
        
        // Transfer reward from treasury
        if (reward > 0) {
            hachiToken.safeTransferFrom(treasury, msg.sender, reward);
            totalRewardsDistributed += reward;
        }
        
        emit HachiUnlocked(msg.sender, lockId, amount, reward);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @dev Calculate pending reward for a lock
     */
    function calculateReward(address user, uint256 lockId) public view returns (uint256) {
        LockInfo storage lockInfo = userLocks[user][lockId];
        if (!lockInfo.isActive) return 0;
        
        uint256 timePassed = block.timestamp - lockInfo.lastClaimAt;
        uint256 apy = getUserAPY(user);
        
        // reward = amount * apy * timePassed / (secondsPerYear * 10000)
        return (lockInfo.amount * apy * timePassed) / (SECONDS_PER_YEAR * 10000);
    }
    
    /**
     * @dev Get user's APY based on cat level and membership
     */
    function getUserAPY(address user) public view returns (uint256) {
        uint256 catLevel = userCatLevel[user];
        bool hasMembership = userHasMembership[user];
        
        if (catLevel == 0) catLevel = 1; // Default level 1
        
        if (hasMembership) {
            // +7% per level (mejora)
            uint256 levelBonus = (catLevel - 1) * MEMBERSHIP_APY_PER_LEVEL;
            uint256 totalApy = BASE_APY + levelBonus;
            return totalApy > MAX_APY_MEMBERSHIP ? MAX_APY_MEMBERSHIP : totalApy;
        } else {
            // +5% per 2 levels
            uint256 upgrades = (catLevel - 1) / 2;
            uint256 levelBonus = upgrades * APY_PER_TWO_LEVELS;
            uint256 totalApy = BASE_APY + levelBonus;
            return totalApy > MAX_APY ? MAX_APY : totalApy;
        }
    }
    
    /**
     * @dev Get all active locks for a user
     */
    function getUserActiveLocks(address user) external view returns (uint256[] memory, uint256[] memory) {
        uint256 count = userLockCount[user];
        uint256 activeCount = 0;
        
        // Count active locks
        for (uint256 i = 0; i < count; i++) {
            if (userLocks[user][i].isActive) activeCount++;
        }
        
        // Populate arrays
        uint256[] memory lockIds = new uint256[](activeCount);
        uint256[] memory amounts = new uint256[](activeCount);
        uint256 idx = 0;
        
        for (uint256 i = 0; i < count; i++) {
            if (userLocks[user][i].isActive) {
                lockIds[idx] = i;
                amounts[idx] = userLocks[user][i].amount;
                idx++;
            }
        }
        
        return (lockIds, amounts);
    }
    
    /**
     * @dev Check if user can claim/unstake (24h cooldown passed)
     */
    function canClaimOrUnstake(address user, uint256 lockId) external view returns (bool) {
        LockInfo storage lockInfo = userLocks[user][lockId];
        if (!lockInfo.isActive) return false;
        return block.timestamp >= lockInfo.lastClaimAt + CLAIM_COOLDOWN;
    }
    
    /**
     * @dev Get time until next claim is available
     */
    function timeUntilNextClaim(address user, uint256 lockId) external view returns (uint256) {
        LockInfo storage lockInfo = userLocks[user][lockId];
        if (!lockInfo.isActive) return 0;
        
        uint256 nextClaimTime = lockInfo.lastClaimAt + CLAIM_COOLDOWN;
        if (block.timestamp >= nextClaimTime) return 0;
        return nextClaimTime - block.timestamp;
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    /**
     * @dev Update user's cat level and membership status
     * Called by backend or World ID verifier
     */
    function updateUserData(address user, uint256 catLevel, bool hasMembership) external onlyOwner {
        userCatLevel[user] = catLevel;
        userHasMembership[user] = hasMembership;
        emit UserDataUpdated(user, catLevel, hasMembership);
    }
    
    /**
     * @dev Batch update user data
     */
    function batchUpdateUserData(
        address[] calldata users,
        uint256[] calldata catLevels,
        bool[] calldata memberships
    ) external onlyOwner {
        require(users.length == catLevels.length && users.length == memberships.length, "Array length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            userCatLevel[users[i]] = catLevels[i];
            userHasMembership[users[i]] = memberships[i];
            emit UserDataUpdated(users[i], catLevels[i], memberships[i]);
        }
    }
    
    /**
     * @dev Update treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }
    
    /**
     * @dev Emergency withdraw (only owner, only excess tokens)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        uint256 excess = hachiToken.balanceOf(address(this)) - totalLocked;
        require(amount <= excess, "Cannot withdraw locked tokens");
        hachiToken.safeTransfer(owner(), amount);
    }
}
