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

/**
 * @title HachiReferrals
 * @notice Sistema de referidos con bonos por rango
 * @dev Pago unico: 1000 HACHI para referido Y referidor
 *      Bonos adicionales por alcanzar rangos
 */
contract HachiReferrals is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    IERC20 public immutable hachiToken;
    IWorldID public worldId;
    
    // Referral rewards
    uint256 public constant SIGNUP_BONUS = 1000 * 10**18; // 1000 HACHI para referido
    uint256 public constant REFERRER_BONUS = 1000 * 10**18; // 1000 HACHI para referidor
    
    // World ID config
    uint256 public immutable groupId;
    uint256 public immutable externalNullifier;
    
    // Rank bonuses
    struct RankBonus {
        uint256 referralsRequired;
        uint256 bonus;
        string name;
    }
    
    RankBonus[] public rankBonuses;
    
    // User info
    struct UserInfo {
        address referrer;
        uint256 referralCount;
        uint256 totalEarned;
        uint256 currentRank;
        bool registered;
    }
    
    mapping(address => UserInfo) public users;
    mapping(address => address[]) public referrals;
    mapping(uint256 => bool) public usedNullifiers;
    
    // Stats
    uint256 public totalReferrals;
    uint256 public totalBonusesPaid;
    
    // Rewards pool
    uint256 public rewardsPool;
    
    // Events
    event UserRegistered(address indexed user, address indexed referrer);
    event ReferralBonusPaid(address indexed referrer, address indexed referred, uint256 amount);
    event SignupBonusPaid(address indexed user, uint256 amount);
    event RankAchieved(address indexed user, uint256 rank, string rankName, uint256 bonus);
    event RewardsPoolFunded(uint256 amount);
    
    constructor(
        address _hachiToken,
        address _worldId,
        uint256 _groupId
    ) {
        require(_hachiToken != address(0), "Invalid HACHI token");
        
        hachiToken = IERC20(_hachiToken);
        worldId = IWorldID(_worldId);
        groupId = _groupId;
        externalNullifier = uint256(keccak256(abi.encodePacked("hachi_referrals_v1")));
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        // Initialize rank bonuses
        rankBonuses.push(RankBonus(5, 2000 * 10**18, "Bronze"));
        rankBonuses.push(RankBonus(15, 5000 * 10**18, "Silver"));
        rankBonuses.push(RankBonus(30, 15000 * 10**18, "Gold"));
        rankBonuses.push(RankBonus(50, 30000 * 10**18, "Platinum"));
        rankBonuses.push(RankBonus(100, 100000 * 10**18, "Diamond"));
    }
    
    /**
     * @notice Registrar con referido usando World ID
     */
    function registerWithReferral(
        address referrer,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external nonReentrant whenNotPaused {
        require(!users[msg.sender].registered, "Already registered");
        require(referrer != msg.sender, "Cannot refer yourself");
        require(referrer == address(0) || users[referrer].registered, "Invalid referrer");
        
        // Verify World ID
        require(!usedNullifiers[nullifierHash], "Already used");
        
        worldId.verifyProof(
            root,
            groupId,
            uint256(keccak256(abi.encodePacked(msg.sender))),
            nullifierHash,
            externalNullifier,
            proof
        );
        
        usedNullifiers[nullifierHash] = true;
        
        _register(referrer);
    }
    
    /**
     * @notice Registrar sin World ID (para testing)
     */
    function registerWithReferralNoVerify(address referrer) external nonReentrant whenNotPaused {
        require(!users[msg.sender].registered, "Already registered");
        require(referrer != msg.sender, "Cannot refer yourself");
        require(referrer == address(0) || users[referrer].registered, "Invalid referrer");
        
        _register(referrer);
    }
    
    function _register(address referrer) internal {
        users[msg.sender] = UserInfo({
            referrer: referrer,
            referralCount: 0,
            totalEarned: 0,
            currentRank: 0,
            registered: true
        });
        
        totalReferrals++;
        
        // Pay signup bonus to new user
        if (rewardsPool >= SIGNUP_BONUS) {
            rewardsPool -= SIGNUP_BONUS;
            users[msg.sender].totalEarned += SIGNUP_BONUS;
            totalBonusesPaid += SIGNUP_BONUS;
            hachiToken.safeTransfer(msg.sender, SIGNUP_BONUS);
            emit SignupBonusPaid(msg.sender, SIGNUP_BONUS);
        }
        
        // Pay referrer bonus
        if (referrer != address(0) && rewardsPool >= REFERRER_BONUS) {
            rewardsPool -= REFERRER_BONUS;
            users[referrer].referralCount++;
            users[referrer].totalEarned += REFERRER_BONUS;
            totalBonusesPaid += REFERRER_BONUS;
            referrals[referrer].push(msg.sender);
            
            hachiToken.safeTransfer(referrer, REFERRER_BONUS);
            emit ReferralBonusPaid(referrer, msg.sender, REFERRER_BONUS);
            
            // Check for rank upgrades
            _checkRankUpgrade(referrer);
        }
        
        emit UserRegistered(msg.sender, referrer);
    }
    
    /**
     * @notice Check and apply rank upgrades
     */
    function _checkRankUpgrade(address user) internal {
        UserInfo storage info = users[user];
        
        for (uint256 i = info.currentRank; i < rankBonuses.length; i++) {
            if (info.referralCount >= rankBonuses[i].referralsRequired) {
                if (i > info.currentRank) {
                    uint256 bonus = rankBonuses[i].bonus;
                    if (rewardsPool >= bonus) {
                        rewardsPool -= bonus;
                        info.totalEarned += bonus;
                        info.currentRank = i + 1;
                        totalBonusesPaid += bonus;
                        
                        hachiToken.safeTransfer(user, bonus);
                        emit RankAchieved(user, i + 1, rankBonuses[i].name, bonus);
                    }
                }
            } else {
                break;
            }
        }
    }
    
    /**
     * @notice Get user rank info
     */
    function getUserRank(address user) external view returns (
        uint256 currentRank,
        string memory rankName,
        uint256 referralCount,
        uint256 nextRankReferrals,
        uint256 nextRankBonus
    ) {
        UserInfo memory info = users[user];
        
        string memory name = "None";
        if (info.currentRank > 0 && info.currentRank <= rankBonuses.length) {
            name = rankBonuses[info.currentRank - 1].name;
        }
        
        uint256 nextRank = info.currentRank;
        uint256 nextReferrals = 0;
        uint256 nextBonus = 0;
        
        if (nextRank < rankBonuses.length) {
            nextReferrals = rankBonuses[nextRank].referralsRequired;
            nextBonus = rankBonuses[nextRank].bonus;
        }
        
        return (info.currentRank, name, info.referralCount, nextReferrals, nextBonus);
    }
    
    /**
     * @notice Get user's referrals list
     */
    function getUserReferrals(address user) external view returns (address[] memory) {
        return referrals[user];
    }
    
    /**
     * @notice Fund rewards pool
     */
    function fundRewardsPool(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        hachiToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardsPool += amount;
        emit RewardsPoolFunded(amount);
    }
    
    // Admin functions
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
