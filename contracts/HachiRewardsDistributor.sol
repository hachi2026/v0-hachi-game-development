// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title HachiRewardsDistributor
 * @dev Distribuye recompensas de HACHI por ver anuncios
 * 
 * TOKENOMICS DE PUBLICIDAD:
 * - Anunciante paga WLD
 * - 90% WLD -> Recompra HACHI (para usuarios)
 * - 10% WLD -> Administracion
 */
contract HachiRewardsDistributor is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ ROLES ============
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // ============ TOKENS ============
    IERC20 public immutable hachiToken;
    IERC20 public immutable wldToken;
    
    // ============ CONFIG ============
    uint256 public constant AD_COST_WLD = 3 * 10**18; // 3 WLD por anuncio
    uint256 public constant USER_REWARD_PERCENT = 90; // 90% para usuarios
    uint256 public constant ADMIN_FEE_PERCENT = 10;   // 10% para admin
    
    address public adminWallet;
    uint256 public hachiRewardPerAd = 50 * 10**18; // 50 HACHI por ver anuncio
    
    // ============ STATE ============
    uint256 public totalAdsCreated;
    uint256 public totalAdViews;
    uint256 public totalHachiDistributed;
    uint256 public totalWldCollected;
    uint256 public hachiRewardsPool;
    
    // ============ STRUCTS ============
    struct Advertisement {
        uint256 id;
        address advertiser;
        string imageUrl;
        string linkUrl;
        uint256 wldPaid;
        uint256 hachiReward;
        uint256 viewsRemaining;
        uint256 totalViews;
        bool active;
        uint256 createdAt;
    }
    
    // ============ MAPPINGS ============
    mapping(uint256 => Advertisement) public advertisements;
    mapping(address => mapping(uint256 => bool)) public userAdViews; // user => adId => viewed
    mapping(address => uint256) public userTotalRewards;
    
    // ============ EVENTS ============
    event AdCreated(uint256 indexed adId, address indexed advertiser, uint256 wldPaid, uint256 views);
    event AdViewed(uint256 indexed adId, address indexed user, uint256 hachiReward);
    event RewardsPoolFunded(uint256 amount);
    event HachiRewardUpdated(uint256 newReward);
    event AdminWalletUpdated(address newWallet);
    
    constructor(
        address _hachiToken,
        address _wldToken,
        address _adminWallet
    ) {
        require(_hachiToken != address(0), "Invalid HACHI token");
        require(_wldToken != address(0), "Invalid WLD token");
        require(_adminWallet != address(0), "Invalid admin wallet");
        
        hachiToken = IERC20(_hachiToken);
        wldToken = IERC20(_wldToken);
        adminWallet = _adminWallet;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
    }
    
    // ============ ADVERTISER FUNCTIONS ============
    
    /**
     * @dev Crea un nuevo anuncio pagando WLD
     * @param imageUrl URL de la imagen del anuncio
     * @param linkUrl URL de destino al hacer click
     * @param wldAmount Cantidad de WLD a pagar (multiplos de 3)
     */
    function createAdvertisement(
        string calldata imageUrl,
        string calldata linkUrl,
        uint256 wldAmount
    ) external nonReentrant returns (uint256) {
        require(wldAmount >= AD_COST_WLD, "Minimum 3 WLD required");
        require(wldAmount % AD_COST_WLD == 0, "Must be multiple of 3 WLD");
        require(bytes(imageUrl).length > 0, "Image URL required");
        require(bytes(linkUrl).length > 0, "Link URL required");
        
        // Calcular vistas y distribucion
        uint256 numViews = wldAmount / AD_COST_WLD;
        uint256 adminFee = (wldAmount * ADMIN_FEE_PERCENT) / 100;
        uint256 rewardsAmount = wldAmount - adminFee;
        
        // Transferir WLD
        wldToken.safeTransferFrom(msg.sender, address(this), wldAmount);
        wldToken.safeTransfer(adminWallet, adminFee);
        
        totalWldCollected += wldAmount;
        
        // Crear anuncio
        totalAdsCreated++;
        uint256 adId = totalAdsCreated;
        
        advertisements[adId] = Advertisement({
            id: adId,
            advertiser: msg.sender,
            imageUrl: imageUrl,
            linkUrl: linkUrl,
            wldPaid: wldAmount,
            hachiReward: hachiRewardPerAd,
            viewsRemaining: numViews,
            totalViews: 0,
            active: true,
            createdAt: block.timestamp
        });
        
        emit AdCreated(adId, msg.sender, wldAmount, numViews);
        
        return adId;
    }
    
    // ============ USER FUNCTIONS ============
    
    /**
     * @dev Usuario ve un anuncio y recibe HACHI
     * @param adId ID del anuncio a ver
     */
    function viewAd(uint256 adId) external nonReentrant {
        Advertisement storage ad = advertisements[adId];
        
        require(ad.active, "Ad not active");
        require(ad.viewsRemaining > 0, "No views remaining");
        require(!userAdViews[msg.sender][adId], "Already viewed this ad");
        require(hachiRewardsPool >= ad.hachiReward, "Insufficient rewards pool");
        
        // Marcar como visto
        userAdViews[msg.sender][adId] = true;
        ad.viewsRemaining--;
        ad.totalViews++;
        totalAdViews++;
        
        // Si no quedan vistas, desactivar
        if (ad.viewsRemaining == 0) {
            ad.active = false;
        }
        
        // Distribuir recompensa
        hachiRewardsPool -= ad.hachiReward;
        totalHachiDistributed += ad.hachiReward;
        userTotalRewards[msg.sender] += ad.hachiReward;
        
        hachiToken.safeTransfer(msg.sender, ad.hachiReward);
        
        emit AdViewed(adId, msg.sender, ad.hachiReward);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Obtiene anuncios activos disponibles para un usuario
     */
    function getActiveAdsForUser(address user) external view returns (uint256[] memory) {
        uint256 count = 0;
        
        // Primero contamos
        for (uint256 i = 1; i <= totalAdsCreated; i++) {
            if (advertisements[i].active && 
                advertisements[i].viewsRemaining > 0 &&
                !userAdViews[user][i]) {
                count++;
            }
        }
        
        // Luego llenamos el array
        uint256[] memory activeAds = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= totalAdsCreated; i++) {
            if (advertisements[i].active && 
                advertisements[i].viewsRemaining > 0 &&
                !userAdViews[user][i]) {
                activeAds[index] = i;
                index++;
            }
        }
        
        return activeAds;
    }
    
    /**
     * @dev Verifica si usuario puede ver un anuncio
     */
    function canViewAd(address user, uint256 adId) external view returns (bool) {
        Advertisement storage ad = advertisements[adId];
        return ad.active && 
               ad.viewsRemaining > 0 && 
               !userAdViews[user][adId] &&
               hachiRewardsPool >= ad.hachiReward;
    }
    
    /**
     * @dev Obtiene info de un anuncio
     */
    function getAdInfo(uint256 adId) external view returns (
        address advertiser,
        string memory imageUrl,
        string memory linkUrl,
        uint256 hachiReward,
        uint256 viewsRemaining,
        bool active
    ) {
        Advertisement storage ad = advertisements[adId];
        return (
            ad.advertiser,
            ad.imageUrl,
            ad.linkUrl,
            ad.hachiReward,
            ad.viewsRemaining,
            ad.active
        );
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Fondea el pool de recompensas HACHI
     */
    function fundRewardsPool(uint256 amount) external onlyRole(ADMIN_ROLE) {
        hachiToken.safeTransferFrom(msg.sender, address(this), amount);
        hachiRewardsPool += amount;
        emit RewardsPoolFunded(amount);
    }
    
    /**
     * @dev Actualiza recompensa HACHI por anuncio
     */
    function setHachiRewardPerAd(uint256 _reward) external onlyRole(ADMIN_ROLE) {
        hachiRewardPerAd = _reward;
        emit HachiRewardUpdated(_reward);
    }
    
    /**
     * @dev Actualiza wallet de admin
     */
    function setAdminWallet(address _wallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_wallet != address(0), "Invalid address");
        adminWallet = _wallet;
        emit AdminWalletUpdated(_wallet);
    }
    
    /**
     * @dev Desactiva un anuncio manualmente
     */
    function deactivateAd(uint256 adId) external onlyRole(ADMIN_ROLE) {
        advertisements[adId].active = false;
    }
    
    /**
     * @dev Recupera WLD acumulado para recompras
     */
    function withdrawWldForBuyback(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        wldToken.safeTransfer(msg.sender, amount);
    }
}
