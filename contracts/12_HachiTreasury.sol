// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title HachiTreasury
 * @notice Contrato central que maneja toda la economia del ecosistema Hachi Hub
 * @dev Gestiona ingresos WLD, distribuciones y recompras de tokens
 * 
 * FLUJOS DE INGRESOS:
 * 1. Mejoras de gatos (WLD): 70% recompra KOBAN, 20% reserva temporada, 10% admin
 * 2. Publicidad (WLD): 90% recompra HACHI (usuarios), 10% admin
 * 3. Membresias (WLD): 40% operaciones, 60% devuelto en HACHI (90 dias)
 * 4. Packs de alimento (WLD): 80% pool KOBAN rewards, 20% operaciones
 */
contract HachiTreasury is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant BUYBACK_ROLE = keccak256("BUYBACK_ROLE");

    // Token addresses (Worldchain)
    IERC20 public immutable wldToken;
    IERC20 public immutable hachiToken;
    IERC20 public immutable kobanToken;

    // Treasury wallets
    address public adminWallet;
    address public seasonReserveWallet;
    address public kobanRewardsPool;
    address public hachiRewardsPool;

    // Tracking balances
    uint256 public totalWldReceived;
    uint256 public totalWldFromUpgrades;
    uint256 public totalWldFromAds;
    uint256 public totalWldFromMemberships;
    uint256 public totalWldFromFoodPacks;

    uint256 public totalKobanBoughtBack;
    uint256 public totalHachiBoughtBack;
    uint256 public totalDistributedToUsers;

    // Pending distributions
    uint256 public pendingKobanBuyback;
    uint256 public pendingHachiBuyback;
    uint256 public pendingSeasonReserve;
    uint256 public pendingAdminWithdraw;

    // Distribution percentages (basis points, 10000 = 100%)
    uint256 public constant UPGRADE_KOBAN_BUYBACK = 7000; // 70%
    uint256 public constant UPGRADE_SEASON_RESERVE = 2000; // 20%
    uint256 public constant UPGRADE_ADMIN = 1000; // 10%

    uint256 public constant ADS_HACHI_BUYBACK = 9000; // 90%
    uint256 public constant ADS_ADMIN = 1000; // 10%

    uint256 public constant MEMBERSHIP_OPERATIONS = 4000; // 40%
    uint256 public constant MEMBERSHIP_USER_RETURN = 6000; // 60%

    uint256 public constant FOODPACK_KOBAN_POOL = 8000; // 80%
    uint256 public constant FOODPACK_OPERATIONS = 2000; // 20%

    // Events
    event UpgradePaymentReceived(address indexed user, uint256 wldAmount, uint256 level);
    event AdPaymentReceived(address indexed advertiser, uint256 wldAmount, uint256 adId);
    event MembershipPaymentReceived(address indexed user, uint256 wldAmount);
    event FoodPackPaymentReceived(address indexed user, uint256 wldAmount, uint256 days_);
    
    event KobanBuybackExecuted(uint256 wldSpent, uint256 kobanReceived);
    event HachiBuybackExecuted(uint256 wldSpent, uint256 hachiReceived);
    event SeasonReserveTransferred(uint256 amount);
    event AdminWithdrawal(uint256 amount);
    
    event RewardDistributed(address indexed user, uint256 amount, string rewardType);
    event TreasuryBalanceUpdated(
        uint256 pendingKoban,
        uint256 pendingHachi,
        uint256 pendingSeason,
        uint256 pendingAdmin
    );

    constructor(
        address _wldToken,
        address _hachiToken,
        address _kobanToken,
        address _adminWallet,
        address _seasonReserveWallet,
        address _kobanRewardsPool,
        address _hachiRewardsPool
    ) {
        require(_wldToken != address(0), "Invalid WLD address");
        require(_hachiToken != address(0), "Invalid HACHI address");
        require(_kobanToken != address(0), "Invalid KOBAN address");
        
        wldToken = IERC20(_wldToken);
        hachiToken = IERC20(_hachiToken);
        kobanToken = IERC20(_kobanToken);
        
        adminWallet = _adminWallet;
        seasonReserveWallet = _seasonReserveWallet;
        kobanRewardsPool = _kobanRewardsPool;
        hachiRewardsPool = _hachiRewardsPool;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // ============================================
    // INCOME FUNCTIONS
    // ============================================

    /**
     * @notice Recibe pago WLD por mejora de gato
     * @param user Usuario que paga
     * @param wldAmount Cantidad de WLD
     * @param level Nivel al que mejora
     */
    function receiveUpgradePayment(
        address user,
        uint256 wldAmount,
        uint256 level
    ) external nonReentrant whenNotPaused onlyRole(OPERATOR_ROLE) {
        require(wldAmount > 0, "Amount must be > 0");
        
        wldToken.safeTransferFrom(user, address(this), wldAmount);

        // Distribute: 70% KOBAN buyback, 20% season reserve, 10% admin
        uint256 forKoban = (wldAmount * UPGRADE_KOBAN_BUYBACK) / 10000;
        uint256 forSeason = (wldAmount * UPGRADE_SEASON_RESERVE) / 10000;
        uint256 forAdmin = wldAmount - forKoban - forSeason;

        pendingKobanBuyback += forKoban;
        pendingSeasonReserve += forSeason;
        pendingAdminWithdraw += forAdmin;

        totalWldReceived += wldAmount;
        totalWldFromUpgrades += wldAmount;

        emit UpgradePaymentReceived(user, wldAmount, level);
        _emitBalanceUpdate();
    }

    /**
     * @notice Recibe pago WLD por publicidad
     * @param advertiser Anunciante que paga
     * @param wldAmount Cantidad de WLD
     * @param adId ID del anuncio
     */
    function receiveAdPayment(
        address advertiser,
        uint256 wldAmount,
        uint256 adId
    ) external nonReentrant whenNotPaused onlyRole(OPERATOR_ROLE) {
        require(wldAmount > 0, "Amount must be > 0");
        
        wldToken.safeTransferFrom(advertiser, address(this), wldAmount);

        // Distribute: 90% HACHI buyback (for users), 10% admin
        uint256 forHachi = (wldAmount * ADS_HACHI_BUYBACK) / 10000;
        uint256 forAdmin = wldAmount - forHachi;

        pendingHachiBuyback += forHachi;
        pendingAdminWithdraw += forAdmin;

        totalWldReceived += wldAmount;
        totalWldFromAds += wldAmount;

        emit AdPaymentReceived(advertiser, wldAmount, adId);
        _emitBalanceUpdate();
    }

    /**
     * @notice Recibe pago WLD por membresia
     * @param user Usuario que paga
     * @param wldAmount Cantidad de WLD (10 WLD)
     */
    function receiveMembershipPayment(
        address user,
        uint256 wldAmount
    ) external nonReentrant whenNotPaused onlyRole(OPERATOR_ROLE) {
        require(wldAmount > 0, "Amount must be > 0");
        
        wldToken.safeTransferFrom(user, address(this), wldAmount);

        // 40% operations, 60% will be returned as HACHI over 90 days
        uint256 forOperations = (wldAmount * MEMBERSHIP_OPERATIONS) / 10000;
        uint256 forUserReturn = wldAmount - forOperations;

        // The 60% goes to HACHI buyback pool to be distributed to user
        pendingHachiBuyback += forUserReturn;
        pendingAdminWithdraw += forOperations;

        totalWldReceived += wldAmount;
        totalWldFromMemberships += wldAmount;

        emit MembershipPaymentReceived(user, wldAmount);
        _emitBalanceUpdate();
    }

    /**
     * @notice Recibe pago WLD por pack de alimento
     * @param user Usuario que paga
     * @param wldAmount Cantidad de WLD
     * @param days_ Dias del pack
     */
    function receiveFoodPackPayment(
        address user,
        uint256 wldAmount,
        uint256 days_
    ) external nonReentrant whenNotPaused onlyRole(OPERATOR_ROLE) {
        require(wldAmount > 0, "Amount must be > 0");
        
        wldToken.safeTransferFrom(user, address(this), wldAmount);

        // 80% to KOBAN rewards pool, 20% operations
        uint256 forKobanPool = (wldAmount * FOODPACK_KOBAN_POOL) / 10000;
        uint256 forOperations = wldAmount - forKobanPool;

        pendingKobanBuyback += forKobanPool;
        pendingAdminWithdraw += forOperations;

        totalWldReceived += wldAmount;
        totalWldFromFoodPacks += wldAmount;

        emit FoodPackPaymentReceived(user, wldAmount, days_);
        _emitBalanceUpdate();
    }

    // ============================================
    // BUYBACK & DISTRIBUTION FUNCTIONS
    // ============================================

    /**
     * @notice Ejecuta recompra de KOBAN con WLD acumulado
     * @param kobanAmount Cantidad de KOBAN recibida del DEX
     * @dev En produccion, esto seria llamado despues de swap en DEX
     */
    function executeKobanBuyback(
        uint256 kobanAmount
    ) external nonReentrant onlyRole(BUYBACK_ROLE) {
        require(pendingKobanBuyback > 0, "No pending buyback");
        require(kobanAmount > 0, "Invalid KOBAN amount");

        uint256 wldSpent = pendingKobanBuyback;
        pendingKobanBuyback = 0;

        // Transfer KOBAN to rewards pool
        kobanToken.safeTransferFrom(msg.sender, kobanRewardsPool, kobanAmount);

        totalKobanBoughtBack += kobanAmount;

        emit KobanBuybackExecuted(wldSpent, kobanAmount);
        _emitBalanceUpdate();
    }

    /**
     * @notice Ejecuta recompra de HACHI con WLD acumulado
     * @param hachiAmount Cantidad de HACHI recibida del DEX
     */
    function executeHachiBuyback(
        uint256 hachiAmount
    ) external nonReentrant onlyRole(BUYBACK_ROLE) {
        require(pendingHachiBuyback > 0, "No pending buyback");
        require(hachiAmount > 0, "Invalid HACHI amount");

        uint256 wldSpent = pendingHachiBuyback;
        pendingHachiBuyback = 0;

        // Transfer HACHI to rewards pool
        hachiToken.safeTransferFrom(msg.sender, hachiRewardsPool, hachiAmount);

        totalHachiBoughtBack += hachiAmount;

        emit HachiBuybackExecuted(wldSpent, hachiAmount);
        _emitBalanceUpdate();
    }

    /**
     * @notice Transfiere reserva de temporada
     */
    function transferSeasonReserve() external nonReentrant onlyRole(ADMIN_ROLE) {
        require(pendingSeasonReserve > 0, "No pending reserve");

        uint256 amount = pendingSeasonReserve;
        pendingSeasonReserve = 0;

        wldToken.safeTransfer(seasonReserveWallet, amount);

        emit SeasonReserveTransferred(amount);
        _emitBalanceUpdate();
    }

    /**
     * @notice Retira fondos de administracion
     */
    function withdrawAdmin() external nonReentrant onlyRole(ADMIN_ROLE) {
        require(pendingAdminWithdraw > 0, "No pending withdrawal");

        uint256 amount = pendingAdminWithdraw;
        pendingAdminWithdraw = 0;

        wldToken.safeTransfer(adminWallet, amount);

        emit AdminWithdrawal(amount);
        _emitBalanceUpdate();
    }

    /**
     * @notice Distribuye recompensa a usuario
     * @param user Direccion del usuario
     * @param amount Cantidad a distribuir
     * @param isKoban Si es KOBAN (true) o HACHI (false)
     * @param rewardType Tipo de recompensa para tracking
     */
    function distributeReward(
        address user,
        uint256 amount,
        bool isKoban,
        string calldata rewardType
    ) external nonReentrant whenNotPaused onlyRole(OPERATOR_ROLE) {
        require(user != address(0), "Invalid user");
        require(amount > 0, "Amount must be > 0");

        if (isKoban) {
            kobanToken.safeTransferFrom(kobanRewardsPool, user, amount);
        } else {
            hachiToken.safeTransferFrom(hachiRewardsPool, user, amount);
        }

        totalDistributedToUsers += amount;

        emit RewardDistributed(user, amount, rewardType);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Obtiene el estado actual de la tesoreria
     */
    function getTreasuryStatus() external view returns (
        uint256 _totalWldReceived,
        uint256 _pendingKobanBuyback,
        uint256 _pendingHachiBuyback,
        uint256 _pendingSeasonReserve,
        uint256 _pendingAdminWithdraw,
        uint256 _totalKobanBoughtBack,
        uint256 _totalHachiBoughtBack,
        uint256 _totalDistributed
    ) {
        return (
            totalWldReceived,
            pendingKobanBuyback,
            pendingHachiBuyback,
            pendingSeasonReserve,
            pendingAdminWithdraw,
            totalKobanBoughtBack,
            totalHachiBoughtBack,
            totalDistributedToUsers
        );
    }

    /**
     * @notice Obtiene desglose de ingresos por fuente
     */
    function getIncomeBreakdown() external view returns (
        uint256 fromUpgrades,
        uint256 fromAds,
        uint256 fromMemberships,
        uint256 fromFoodPacks
    ) {
        return (
            totalWldFromUpgrades,
            totalWldFromAds,
            totalWldFromMemberships,
            totalWldFromFoodPacks
        );
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    function setAdminWallet(address _wallet) external onlyRole(ADMIN_ROLE) {
        require(_wallet != address(0), "Invalid address");
        adminWallet = _wallet;
    }

    function setSeasonReserveWallet(address _wallet) external onlyRole(ADMIN_ROLE) {
        require(_wallet != address(0), "Invalid address");
        seasonReserveWallet = _wallet;
    }

    function setKobanRewardsPool(address _pool) external onlyRole(ADMIN_ROLE) {
        require(_pool != address(0), "Invalid address");
        kobanRewardsPool = _pool;
    }

    function setHachiRewardsPool(address _pool) external onlyRole(ADMIN_ROLE) {
        require(_pool != address(0), "Invalid address");
        hachiRewardsPool = _pool;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Recupera tokens enviados por error
     */
    function recoverToken(
        address token,
        uint256 amount
    ) external onlyRole(ADMIN_ROLE) {
        require(token != address(wldToken), "Cannot recover WLD");
        IERC20(token).safeTransfer(adminWallet, amount);
    }

    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================

    function _emitBalanceUpdate() internal {
        emit TreasuryBalanceUpdated(
            pendingKobanBuyback,
            pendingHachiBuyback,
            pendingSeasonReserve,
            pendingAdminWithdraw
        );
    }
}
