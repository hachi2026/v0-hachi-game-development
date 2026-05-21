// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title HACHI KOBAN Token
 * @dev ERC20 Token para el ecosistema Hachi Hub en Worldchain
 * 
 * TOKENOMICS - Total Supply: 100,000,000 KOBAN
 * =============================================
 * - App Rewards:    60,000,000 (60%) - Produccion de gatos y accesorios
 * - Advertising:    15,000,000 (15%) - Pool de recompras con ingresos WLD
 * - Liquidity:      10,000,000 (10%) - Pool de liquidez DEX
 * - Team:           15,000,000 (15%) - Equipo (vesting 2 años)
 */
contract HachiKoban is ERC20, ERC20Burnable, AccessControl, Pausable {
    
    // ============ ROLES ============
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    
    // ============ TOKENOMICS ============
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 10**18; // 100M tokens
    
    uint256 public constant APP_REWARDS_ALLOCATION = 60_000_000 * 10**18;    // 60%
    uint256 public constant ADVERTISING_ALLOCATION = 15_000_000 * 10**18;    // 15%
    uint256 public constant LIQUIDITY_ALLOCATION = 10_000_000 * 10**18;      // 10%
    uint256 public constant TEAM_ALLOCATION = 15_000_000 * 10**18;           // 15%
    
    // ============ WALLETS ============
    address public appRewardsWallet;
    address public advertisingWallet;
    address public liquidityWallet;
    address public teamWallet;
    
    // ============ VESTING ============
    uint256 public teamVestingStart;
    uint256 public constant TEAM_VESTING_DURATION = 730 days; // 2 años
    uint256 public teamTokensClaimed;
    
    // ============ MINT CONTROL ============
    uint256 public totalMinted;
    uint256 public constant MAX_MINTABLE = 10_000_000 * 10**18; // Max 10M extra en emergencias
    bool public mintingEnabled = true;
    
    // ============ EVENTS ============
    event TokensDistributed(address indexed wallet, uint256 amount, string allocation);
    event EmergencyMint(address indexed to, uint256 amount, string reason);
    event TeamTokensClaimed(address indexed to, uint256 amount);
    event MintingDisabled();
    
    constructor(
        address _appRewardsWallet,
        address _advertisingWallet,
        address _liquidityWallet,
        address _teamWallet
    ) ERC20("HACHI KOBAN", "KOBAN") {
        require(_appRewardsWallet != address(0), "Invalid app rewards wallet");
        require(_advertisingWallet != address(0), "Invalid advertising wallet");
        require(_liquidityWallet != address(0), "Invalid liquidity wallet");
        require(_teamWallet != address(0), "Invalid team wallet");
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
        
        // Set wallets
        appRewardsWallet = _appRewardsWallet;
        advertisingWallet = _advertisingWallet;
        liquidityWallet = _liquidityWallet;
        teamWallet = _teamWallet;
        
        // Set vesting start
        teamVestingStart = block.timestamp;
        
        // Mint initial allocations (except team - vested)
        _mint(appRewardsWallet, APP_REWARDS_ALLOCATION);
        emit TokensDistributed(appRewardsWallet, APP_REWARDS_ALLOCATION, "APP_REWARDS");
        
        _mint(advertisingWallet, ADVERTISING_ALLOCATION);
        emit TokensDistributed(advertisingWallet, ADVERTISING_ALLOCATION, "ADVERTISING");
        
        _mint(liquidityWallet, LIQUIDITY_ALLOCATION);
        emit TokensDistributed(liquidityWallet, LIQUIDITY_ALLOCATION, "LIQUIDITY");
        
        // Team tokens are held in contract for vesting
        _mint(address(this), TEAM_ALLOCATION);
        emit TokensDistributed(address(this), TEAM_ALLOCATION, "TEAM_VESTING");
    }
    
    // ============ VESTING FUNCTIONS ============
    
    /**
     * @dev Calcula tokens disponibles para el equipo basado en vesting lineal
     */
    function getVestedTeamTokens() public view returns (uint256) {
        if (block.timestamp < teamVestingStart) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - teamVestingStart;
        
        if (timeElapsed >= TEAM_VESTING_DURATION) {
            return TEAM_ALLOCATION;
        }
        
        return (TEAM_ALLOCATION * timeElapsed) / TEAM_VESTING_DURATION;
    }
    
    /**
     * @dev Tokens del equipo disponibles para reclamar
     */
    function getClaimableTeamTokens() public view returns (uint256) {
        uint256 vested = getVestedTeamTokens();
        return vested - teamTokensClaimed;
    }
    
    /**
     * @dev El equipo reclama sus tokens vested
     */
    function claimTeamTokens() external {
        require(msg.sender == teamWallet, "Only team wallet can claim");
        
        uint256 claimable = getClaimableTeamTokens();
        require(claimable > 0, "No tokens to claim");
        
        teamTokensClaimed += claimable;
        _transfer(address(this), teamWallet, claimable);
        
        emit TeamTokensClaimed(teamWallet, claimable);
    }
    
    // ============ EMERGENCY MINT ============
    
    /**
     * @dev Mint de emergencia - Solo en casos extremos
     * @param to Direccion destino
     * @param amount Cantidad a mintear
     * @param reason Razon del mint de emergencia
     */
    function emergencyMint(
        address to, 
        uint256 amount, 
        string calldata reason
    ) external onlyRole(MINTER_ROLE) {
        require(mintingEnabled, "Minting is permanently disabled");
        require(totalMinted + amount <= MAX_MINTABLE, "Exceeds max mintable");
        require(bytes(reason).length > 0, "Reason required");
        
        totalMinted += amount;
        _mint(to, amount);
        
        emit EmergencyMint(to, amount, reason);
    }
    
    /**
     * @dev Desactiva el minting permanentemente
     */
    function disableMinting() external onlyRole(DEFAULT_ADMIN_ROLE) {
        mintingEnabled = false;
        emit MintingDisabled();
    }
    
    // ============ PAUSE FUNCTIONS ============
    
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    // ============ OVERRIDE FUNCTIONS ============
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Actualiza wallet de recompensas de la app
     */
    function setAppRewardsWallet(address _wallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_wallet != address(0), "Invalid address");
        appRewardsWallet = _wallet;
    }
    
    /**
     * @dev Actualiza wallet de publicidad
     */
    function setAdvertisingWallet(address _wallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_wallet != address(0), "Invalid address");
        advertisingWallet = _wallet;
    }
    
    /**
     * @dev Actualiza wallet de liquidez
     */
    function setLiquidityWallet(address _wallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_wallet != address(0), "Invalid address");
        liquidityWallet = _wallet;
    }
    
    /**
     * @dev Actualiza wallet del equipo
     */
    function setTeamWallet(address _wallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_wallet != address(0), "Invalid address");
        teamWallet = _wallet;
    }
}
