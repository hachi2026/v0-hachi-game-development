// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title HachiKoban Token
 * @notice Token ERC-20 para el ecosistema Hachi Hub en Worldchain
 * @dev Tokenomics:
 *   - Total Supply: 100,000,000 KOBAN
 *   - App Rewards: 60,000,000 (60%)
 *   - Publicidad: 15,000,000 (15%)
 *   - Liquidez: 10,000,000 (10%)
 *   - Equipo: 15,000,000 (15%) - Vesting 2 años
 */
contract HachiKoban is ERC20, ERC20Burnable, ERC20Permit, AccessControl, Pausable, ReentrancyGuard {
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant GAME_CONTROLLER_ROLE = keccak256("GAME_CONTROLLER_ROLE");
    
    // Tokenomics
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 10**18;
    uint256 public constant APP_REWARDS_ALLOCATION = 60_000_000 * 10**18;
    uint256 public constant ADVERTISING_ALLOCATION = 15_000_000 * 10**18;
    uint256 public constant LIQUIDITY_ALLOCATION = 10_000_000 * 10**18;
    uint256 public constant TEAM_ALLOCATION = 15_000_000 * 10**18;
    
    // Vesting para equipo
    uint256 public constant VESTING_DURATION = 730 days; // 2 años
    uint256 public constant VESTING_CLIFF = 180 days; // 6 meses cliff
    uint256 public vestingStartTime;
    uint256 public teamTokensClaimed;
    
    // Wallets
    address public appRewardsWallet;
    address public advertisingWallet;
    address public liquidityWallet;
    address public teamWallet;
    
    // Emergency mint (solo en casos extremos, con limite)
    uint256 public constant MAX_EMERGENCY_MINT = 5_000_000 * 10**18; // 5% max
    uint256 public emergencyMinted;
    
    // Eventos
    event TokensDistributed(address indexed wallet, uint256 amount, string allocation);
    event TeamTokensClaimed(address indexed teamWallet, uint256 amount);
    event EmergencyMint(address indexed to, uint256 amount, string reason);
    event WalletUpdated(string walletType, address oldWallet, address newWallet);
    
    constructor(
        address _appRewardsWallet,
        address _advertisingWallet,
        address _liquidityWallet,
        address _teamWallet
    ) ERC20("Hachi Koban", "KOBAN") ERC20Permit("Hachi Koban") {
        require(_appRewardsWallet != address(0), "Invalid app rewards wallet");
        require(_advertisingWallet != address(0), "Invalid advertising wallet");
        require(_liquidityWallet != address(0), "Invalid liquidity wallet");
        require(_teamWallet != address(0), "Invalid team wallet");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        
        appRewardsWallet = _appRewardsWallet;
        advertisingWallet = _advertisingWallet;
        liquidityWallet = _liquidityWallet;
        teamWallet = _teamWallet;
        
        vestingStartTime = block.timestamp;
        
        // Distribuir tokens iniciales (excepto equipo que tiene vesting)
        _mint(appRewardsWallet, APP_REWARDS_ALLOCATION);
        emit TokensDistributed(appRewardsWallet, APP_REWARDS_ALLOCATION, "App Rewards");
        
        _mint(advertisingWallet, ADVERTISING_ALLOCATION);
        emit TokensDistributed(advertisingWallet, ADVERTISING_ALLOCATION, "Advertising");
        
        _mint(liquidityWallet, LIQUIDITY_ALLOCATION);
        emit TokensDistributed(liquidityWallet, LIQUIDITY_ALLOCATION, "Liquidity");
        
        // Team tokens se guardan en el contrato para vesting
        _mint(address(this), TEAM_ALLOCATION);
        emit TokensDistributed(address(this), TEAM_ALLOCATION, "Team (Vesting)");
    }
    
    /**
     * @notice Calcula tokens disponibles para el equipo segun vesting
     */
    function getVestedTeamTokens() public view returns (uint256) {
        if (block.timestamp < vestingStartTime + VESTING_CLIFF) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - vestingStartTime;
        if (timeElapsed >= VESTING_DURATION) {
            return TEAM_ALLOCATION;
        }
        
        return (TEAM_ALLOCATION * timeElapsed) / VESTING_DURATION;
    }
    
    /**
     * @notice Tokens del equipo disponibles para reclamar
     */
    function getClaimableTeamTokens() public view returns (uint256) {
        uint256 vested = getVestedTeamTokens();
        return vested > teamTokensClaimed ? vested - teamTokensClaimed : 0;
    }
    
    /**
     * @notice El equipo reclama sus tokens segun vesting
     */
    function claimTeamTokens() external nonReentrant {
        require(msg.sender == teamWallet, "Only team wallet");
        
        uint256 claimable = getClaimableTeamTokens();
        require(claimable > 0, "No tokens to claim");
        
        teamTokensClaimed += claimable;
        _transfer(address(this), teamWallet, claimable);
        
        emit TeamTokensClaimed(teamWallet, claimable);
    }
    
    /**
     * @notice Mint de emergencia (solo admin, con limite estricto)
     */
    function emergencyMint(
        address to, 
        uint256 amount, 
        string calldata reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(emergencyMinted + amount <= MAX_EMERGENCY_MINT, "Emergency mint limit exceeded");
        require(bytes(reason).length > 0, "Reason required");
        
        emergencyMinted += amount;
        _mint(to, amount);
        
        emit EmergencyMint(to, amount, reason);
    }
    
    /**
     * @notice Permite al Game Controller transferir tokens de recompensas
     */
    function distributeReward(
        address to, 
        uint256 amount
    ) external onlyRole(GAME_CONTROLLER_ROLE) whenNotPaused nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(balanceOf(appRewardsWallet) >= amount, "Insufficient rewards pool");
        
        _transfer(appRewardsWallet, to, amount);
    }
    
    // === Admin Functions ===
    
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    function updateTeamWallet(address newWallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newWallet != address(0), "Invalid wallet");
        emit WalletUpdated("team", teamWallet, newWallet);
        teamWallet = newWallet;
    }
    
    function updateAppRewardsWallet(address newWallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newWallet != address(0), "Invalid wallet");
        emit WalletUpdated("appRewards", appRewardsWallet, newWallet);
        appRewardsWallet = newWallet;
    }
    
    // === Overrides ===
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}
