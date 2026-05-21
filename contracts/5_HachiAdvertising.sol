// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HachiAdvertising
 * @notice Manejo de pagos de publicidad (WLD) y distribucion de recompensas (HACHI)
 * @dev Tokenomics de publicidad:
 *   - 90% WLD -> Recompra HACHI para usuarios
 *   - 10% WLD -> Administracion
 */
contract HachiAdvertising is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ADVERTISER_ROLE = keccak256("ADVERTISER_ROLE");
    
    IERC20 public immutable wldToken;
    IERC20 public immutable hachiToken;
    
    // Distribucion de ingresos (en basis points, 10000 = 100%)
    uint256 public constant USER_REWARDS_SHARE = 9000; // 90%
    uint256 public constant ADMIN_SHARE = 1000;        // 10%
    
    // Costo por anuncio
    uint256 public adCost = 3 * 10**18; // 3 WLD
    uint256 public hachiPerView = 50 * 10**18; // 50 HACHI por ver anuncio
    
    // Wallets
    address public adminWallet;
    address public hachiRewardsPool;
    
    // Estructura de anuncio
    struct Advertisement {
        uint256 id;
        address advertiser;
        string imageUrl;
        string linkUrl;
        uint256 wldPaid;
        uint256 viewsTotal;
        uint256 viewsRemaining;
        uint256 hachiRewardPerView;
        bool active;
        uint256 createdAt;
    }
    
    // Anuncios
    uint256 public adCounter;
    mapping(uint256 => Advertisement) public advertisements;
    mapping(address => uint256[]) public advertiserAds;
    
    // Tracking de vistas (user => adId => viewed)
    mapping(address => mapping(uint256 => bool)) public hasViewed;
    mapping(address => uint256) public totalAdsWatched;
    
    // Estadisticas
    uint256 public totalWldCollected;
    uint256 public totalHachiDistributed;
    uint256 public totalAdViews;
    
    // Eventos
    event AdCreated(uint256 indexed adId, address indexed advertiser, uint256 views, uint256 wldPaid);
    event AdViewed(uint256 indexed adId, address indexed user, uint256 hachiReward);
    event AdDeactivated(uint256 indexed adId);
    event RevenueDistributed(uint256 toRewards, uint256 toAdmin);
    event AdCostUpdated(uint256 newCost);
    event HachiPerViewUpdated(uint256 newAmount);
    
    constructor(
        address _wldToken,
        address _hachiToken,
        address _adminWallet,
        address _hachiRewardsPool
    ) {
        require(_wldToken != address(0), "Invalid WLD token");
        require(_hachiToken != address(0), "Invalid HACHI token");
        require(_adminWallet != address(0), "Invalid admin wallet");
        require(_hachiRewardsPool != address(0), "Invalid rewards pool");
        
        wldToken = IERC20(_wldToken);
        hachiToken = IERC20(_hachiToken);
        adminWallet = _adminWallet;
        hachiRewardsPool = _hachiRewardsPool;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @notice Crear un nuevo anuncio pagando WLD
     * @param imageUrl URL de la imagen del anuncio
     * @param linkUrl URL de destino al hacer click
     * @param numViews Numero de vistas a comprar
     */
    function createAd(
        string calldata imageUrl,
        string calldata linkUrl,
        uint256 numViews
    ) external nonReentrant whenNotPaused {
        require(bytes(imageUrl).length > 0, "Image URL required");
        require(bytes(linkUrl).length > 0, "Link URL required");
        require(numViews > 0, "Must buy at least 1 view");
        
        uint256 totalCost = (adCost * numViews) / 1; // Por cada vista
        
        // Cobrar WLD
        wldToken.safeTransferFrom(msg.sender, address(this), totalCost);
        
        // Distribuir ingresos
        uint256 toRewards = (totalCost * USER_REWARDS_SHARE) / 10000;
        uint256 toAdmin = totalCost - toRewards;
        
        wldToken.safeTransfer(hachiRewardsPool, toRewards);
        wldToken.safeTransfer(adminWallet, toAdmin);
        
        totalWldCollected += totalCost;
        
        emit RevenueDistributed(toRewards, toAdmin);
        
        // Crear anuncio
        adCounter++;
        advertisements[adCounter] = Advertisement({
            id: adCounter,
            advertiser: msg.sender,
            imageUrl: imageUrl,
            linkUrl: linkUrl,
            wldPaid: totalCost,
            viewsTotal: numViews,
            viewsRemaining: numViews,
            hachiRewardPerView: hachiPerView,
            active: true,
            createdAt: block.timestamp
        });
        
        advertiserAds[msg.sender].push(adCounter);
        
        emit AdCreated(adCounter, msg.sender, numViews, totalCost);
    }
    
    /**
     * @notice Usuario ve un anuncio y recibe HACHI
     * @param adId ID del anuncio a ver
     */
    function viewAd(uint256 adId) external nonReentrant whenNotPaused {
        Advertisement storage ad = advertisements[adId];
        
        require(ad.active, "Ad not active");
        require(ad.viewsRemaining > 0, "No views remaining");
        require(!hasViewed[msg.sender][adId], "Already viewed");
        
        // Marcar como visto
        hasViewed[msg.sender][adId] = true;
        ad.viewsRemaining--;
        totalAdsWatched[msg.sender]++;
        totalAdViews++;
        
        // Si se acabaron las vistas, desactivar
        if (ad.viewsRemaining == 0) {
            ad.active = false;
            emit AdDeactivated(adId);
        }
        
        // Transferir recompensa HACHI
        uint256 reward = ad.hachiRewardPerView;
        require(hachiToken.balanceOf(hachiRewardsPool) >= reward, "Insufficient HACHI pool");
        
        hachiToken.safeTransferFrom(hachiRewardsPool, msg.sender, reward);
        totalHachiDistributed += reward;
        
        emit AdViewed(adId, msg.sender, reward);
    }
    
    /**
     * @notice Obtener anuncios activos
     */
    function getActiveAds() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= adCounter; i++) {
            if (advertisements[i].active && advertisements[i].viewsRemaining > 0) {
                count++;
            }
        }
        
        uint256[] memory activeIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= adCounter; i++) {
            if (advertisements[i].active && advertisements[i].viewsRemaining > 0) {
                activeIds[index] = i;
                index++;
            }
        }
        
        return activeIds;
    }
    
    /**
     * @notice Obtener anuncios no vistos por el usuario
     */
    function getUnwatchedAds(address user) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= adCounter; i++) {
            if (advertisements[i].active && 
                advertisements[i].viewsRemaining > 0 && 
                !hasViewed[user][i]) {
                count++;
            }
        }
        
        uint256[] memory unwatched = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= adCounter; i++) {
            if (advertisements[i].active && 
                advertisements[i].viewsRemaining > 0 && 
                !hasViewed[user][i]) {
                unwatched[index] = i;
                index++;
            }
        }
        
        return unwatched;
    }
    
    /**
     * @notice Obtener info de un anuncio
     */
    function getAdInfo(uint256 adId) external view returns (Advertisement memory) {
        return advertisements[adId];
    }
    
    // === Admin Functions ===
    
    function setAdCost(uint256 newCost) external onlyRole(ADMIN_ROLE) {
        require(newCost > 0, "Cost must be > 0");
        adCost = newCost;
        emit AdCostUpdated(newCost);
    }
    
    function setHachiPerView(uint256 newAmount) external onlyRole(ADMIN_ROLE) {
        require(newAmount > 0, "Amount must be > 0");
        hachiPerView = newAmount;
        emit HachiPerViewUpdated(newAmount);
    }
    
    function updateAdminWallet(address newWallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newWallet != address(0), "Invalid wallet");
        adminWallet = newWallet;
    }
    
    function updateHachiRewardsPool(address newPool) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newPool != address(0), "Invalid pool");
        hachiRewardsPool = newPool;
    }
    
    function deactivateAd(uint256 adId) external onlyRole(ADMIN_ROLE) {
        require(advertisements[adId].active, "Ad not active");
        advertisements[adId].active = false;
        emit AdDeactivated(adId);
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
