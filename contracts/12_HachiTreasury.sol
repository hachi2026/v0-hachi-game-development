// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title HachiTreasury
 * @notice Contrato central que maneja toda la economia del ecosistema Hachi Hub
 * @dev Gestiona ingresos WLD, distribuciones y recompras de tokens
 * 
 * DISTRIBUCION DE INGRESOS WLD:
 * - 10% Owner (operaciones)
 * - 30% Recompra KOBAN
 * - 30% Recompra HACHI  
 * - 30% Reserva del sistema (disponible para buyback manual)
 * 
 * INGRESOS HACHI:
 * - 100% va a la pool de rewards (HachiRanking)
 * - Paga locks y recompensas de temporada
 * 
 * POOL DE PREMIOS: 1,000,000 HACHI primera temporada
 */
contract HachiTreasury is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // Token addresses (Worldchain)
    IERC20 public immutable wldToken;
    IERC20 public hachiToken;
    IERC20 public kobanToken;

    // Treasury wallets
    address public ownerWallet;
    address public kobanRewardsPool;
    address public hachiRewardsPool; // Pool de premios en HACHI (HachiRanking contract)
    address public hachiLockPool;    // Pool para pagar HACHI Lock APY

    // Distribution percentages (basis points, 10000 = 100%)
    uint256 public constant OWNER_PERCENT = 1000;       // 10%
    uint256 public constant KOBAN_BUYBACK_PERCENT = 3000; // 30%
    uint256 public constant HACHI_BUYBACK_PERCENT = 3000; // 30%
    uint256 public constant RESERVE_PERCENT = 3000;      // 30%

    // Tracking balances
    uint256 public totalWldReceived;
    uint256 public totalWldFromUpgrades;
    uint256 public totalWldFromAds;
    uint256 public totalWldFromMemberships;
    uint256 public totalWldFromFoodPacks;
    uint256 public totalWldFromChests;

    // Pending distributions (WLD)
    uint256 public pendingOwnerWld;
    uint256 public pendingKobanBuyback;
    uint256 public pendingHachiBuyback;
    uint256 public reserveWld; // 30% reserva - owner decide cuando y que recomprar

    // Deposited tokens for distribution
    uint256 public depositedHachi;
    uint256 public depositedKoban;
    
    // HACHI income tracking (all goes to rewards)
    uint256 public totalHachiReceived;
    uint256 public totalHachiToRewards;
    uint256 public totalHachiToLocks;

    // Buyback stats
    uint256 public totalKobanBoughtBack;
    uint256 public totalHachiBoughtBack;
    uint256 public totalDistributedToUsers;

    // Events
    event PaymentReceived(address indexed from, uint256 wldAmount, string paymentType);
    event WldDistributed(uint256 toOwner, uint256 toKobanBuyback, uint256 toHachiBuyback, uint256 toReserve);
    event KobanBuybackExecuted(uint256 wldSpent, uint256 kobanReceived);
    event HachiBuybackExecuted(uint256 wldSpent, uint256 hachiReceived);
    event ReserveBuyback(uint256 wldSpent, bool isKoban, uint256 tokensReceived);
    event OwnerWithdrawal(uint256 amount);
    event TokensDeposited(bool isHachi, uint256 amount);
    event RewardDistributed(address indexed user, uint256 amount, bool isHachi, string rewardType);
    event HachiReceivedForRewards(address indexed from, uint256 amount, uint256 toRewards, uint256 toLocks);
    
    constructor(
        address _wldToken,
        address _hachiToken,
        address _kobanToken,
        address _ownerWallet
    ) {
        require(_wldToken != address(0), "Invalid WLD address");
        require(_hachiToken != address(0), "Invalid HACHI address");
        
        wldToken = IERC20(_wldToken);
        hachiToken = IERC20(_hachiToken);
        kobanToken = IERC20(_kobanToken);
        
        ownerWallet = _ownerWallet;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // ============================================
    // INCOME FUNCTIONS
    // ============================================

    /**
     * @notice Recibe cualquier pago WLD y distribuye automaticamente
     * @param from Quien paga
     * @param wldAmount Cantidad de WLD
     * @param paymentType Tipo de pago para tracking
     */
    function receivePayment(
        address from,
        uint256 wldAmount,
        string calldata paymentType
    ) external nonReentrant whenNotPaused onlyRole(OPERATOR_ROLE) {
        require(wldAmount > 0, "Amount must be > 0");
        
        wldToken.safeTransferFrom(from, address(this), wldAmount);
        
        // Distribute: 10% owner, 30% koban, 30% hachi, 30% reserve
        uint256 forOwner = (wldAmount * OWNER_PERCENT) / 10000;
        uint256 forKoban = (wldAmount * KOBAN_BUYBACK_PERCENT) / 10000;
        uint256 forHachi = (wldAmount * HACHI_BUYBACK_PERCENT) / 10000;
        uint256 forReserve = wldAmount - forOwner - forKoban - forHachi;

        pendingOwnerWld += forOwner;
        pendingKobanBuyback += forKoban;
        pendingHachiBuyback += forHachi;
        reserveWld += forReserve;

        totalWldReceived += wldAmount;
        
        // Track by type
        if (keccak256(bytes(paymentType)) == keccak256(bytes("upgrade"))) {
            totalWldFromUpgrades += wldAmount;
        } else if (keccak256(bytes(paymentType)) == keccak256(bytes("ad"))) {
            totalWldFromAds += wldAmount;
        } else if (keccak256(bytes(paymentType)) == keccak256(bytes("membership"))) {
            totalWldFromMemberships += wldAmount;
        } else if (keccak256(bytes(paymentType)) == keccak256(bytes("foodpack"))) {
            totalWldFromFoodPacks += wldAmount;
        } else if (keccak256(bytes(paymentType)) == keccak256(bytes("chest"))) {
            totalWldFromChests += wldAmount;
        }

        emit PaymentReceived(from, wldAmount, paymentType);
        emit WldDistributed(forOwner, forKoban, forHachi, forReserve);
    }

    // ============================================
    // HACHI INCOME (100% to rewards pool)
    // ============================================

    /**
     * @notice Recibe HACHI y lo distribuye: 70% rewards, 30% locks
     * @param from Quien envia HACHI
     * @param amount Cantidad de HACHI
     */
    function receiveHachi(address from, uint256 amount) external nonReentrant whenNotPaused onlyRole(OPERATOR_ROLE) {
        require(amount > 0, "Amount must be > 0");
        
        hachiToken.safeTransferFrom(from, address(this), amount);
        
        // 70% para pool de rewards de temporada
        uint256 forRewards = (amount * 7000) / 10000;
        // 30% para pagar APY de HACHI Lock
        uint256 forLocks = amount - forRewards;
        
        totalHachiReceived += amount;
        totalHachiToRewards += forRewards;
        totalHachiToLocks += forLocks;
        
        depositedHachi += amount; // Total disponible para distribuir
        
        emit HachiReceivedForRewards(from, amount, forRewards, forLocks);
    }

    /**
     * @notice Transfiere HACHI a la pool de ranking para premios de temporada
     */
    function fundSeasonRewards(uint256 amount) external nonReentrant onlyRole(ADMIN_ROLE) {
        require(amount <= depositedHachi, "Insufficient HACHI");
        require(hachiRewardsPool != address(0), "Rewards pool not set");
        
        depositedHachi -= amount;
        hachiToken.safeTransfer(hachiRewardsPool, amount);
    }

    /**
     * @notice Transfiere HACHI a la pool de locks para pagar APY
     */
    function fundLockRewards(uint256 amount) external nonReentrant onlyRole(ADMIN_ROLE) {
        require(amount <= depositedHachi, "Insufficient HACHI");
        require(hachiLockPool != address(0), "Lock pool not set");
        
        depositedHachi -= amount;
        hachiToken.safeTransfer(hachiLockPool, amount);
    }

    // ============================================
    // DEPOSIT FUNCTIONS (HACHI & KOBAN)
    // ============================================

    /**
     * @notice Depositar HACHI para distribucion de premios
     * @param amount Cantidad de HACHI
     */
    function depositHachi(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        hachiToken.safeTransferFrom(msg.sender, address(this), amount);
        depositedHachi += amount;
        emit TokensDeposited(true, amount);
    }

    /**
     * @notice Depositar KOBAN para distribucion de premios
     * @param amount Cantidad de KOBAN
     */
    function depositKoban(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        kobanToken.safeTransferFrom(msg.sender, address(this), amount);
        depositedKoban += amount;
        emit TokensDeposited(false, amount);
    }

    // ============================================
    // BUYBACK FUNCTIONS
    // ============================================

    /**
     * @notice Ejecuta recompra de KOBAN (30% automatico)
     * @param kobanAmount Cantidad de KOBAN recibida del DEX
     * @dev Operador ejecuta despues de swap en DEX
     */
    function executeKobanBuyback(uint256 kobanAmount) external nonReentrant onlyRole(OPERATOR_ROLE) {
        require(pendingKobanBuyback > 0, "No pending KOBAN buyback");
        require(kobanAmount > 0, "Invalid KOBAN amount");

        uint256 wldSpent = pendingKobanBuyback;
        pendingKobanBuyback = 0;

        // Operator debe haber traido el KOBAN al contrato
        kobanToken.safeTransferFrom(msg.sender, address(this), kobanAmount);
        depositedKoban += kobanAmount;

        totalKobanBoughtBack += kobanAmount;

        emit KobanBuybackExecuted(wldSpent, kobanAmount);
    }

    /**
     * @notice Ejecuta recompra de HACHI (30% automatico)
     * @param hachiAmount Cantidad de HACHI recibida del DEX
     */
    function executeHachiBuyback(uint256 hachiAmount) external nonReentrant onlyRole(OPERATOR_ROLE) {
        require(pendingHachiBuyback > 0, "No pending HACHI buyback");
        require(hachiAmount > 0, "Invalid HACHI amount");

        uint256 wldSpent = pendingHachiBuyback;
        pendingHachiBuyback = 0;

        // Operator debe haber traido el HACHI al contrato
        hachiToken.safeTransferFrom(msg.sender, address(this), hachiAmount);
        depositedHachi += hachiAmount;

        totalHachiBoughtBack += hachiAmount;

        emit HachiBuybackExecuted(wldSpent, hachiAmount);
    }

    /**
     * @notice Owner decide recomprar de la reserva (30%)
     * @param wldAmount Cantidad de WLD de la reserva a usar
     * @param isKoban true para KOBAN, false para HACHI
     * @param tokensReceived Cantidad de tokens recibidos del DEX
     */
    function executeReserveBuyback(
        uint256 wldAmount,
        bool isKoban,
        uint256 tokensReceived
    ) external nonReentrant onlyRole(ADMIN_ROLE) {
        require(wldAmount <= reserveWld, "Exceeds reserve");
        require(tokensReceived > 0, "Invalid token amount");

        reserveWld -= wldAmount;

        if (isKoban) {
            kobanToken.safeTransferFrom(msg.sender, address(this), tokensReceived);
            depositedKoban += tokensReceived;
            totalKobanBoughtBack += tokensReceived;
        } else {
            hachiToken.safeTransferFrom(msg.sender, address(this), tokensReceived);
            depositedHachi += tokensReceived;
            totalHachiBoughtBack += tokensReceived;
        }

        emit ReserveBuyback(wldAmount, isKoban, tokensReceived);
    }

    // ============================================
    // DISTRIBUTION FUNCTIONS
    // ============================================

    /**
     * @notice Distribuye recompensa a usuario
     * @param user Direccion del usuario
     * @param amount Cantidad a distribuir
     * @param isHachi Si es HACHI (true) o KOBAN (false)
     * @param rewardType Tipo de recompensa para tracking
     */
    function distributeReward(
        address user,
        uint256 amount,
        bool isHachi,
        string calldata rewardType
    ) external nonReentrant whenNotPaused onlyRole(OPERATOR_ROLE) {
        require(user != address(0), "Invalid user");
        require(amount > 0, "Amount must be > 0");

        if (isHachi) {
            require(depositedHachi >= amount, "Insufficient HACHI");
            depositedHachi -= amount;
            hachiToken.safeTransfer(user, amount);
        } else {
            require(depositedKoban >= amount, "Insufficient KOBAN");
            depositedKoban -= amount;
            kobanToken.safeTransfer(user, amount);
        }

        totalDistributedToUsers += amount;

        emit RewardDistributed(user, amount, isHachi, rewardType);
    }

    /**
     * @notice Owner retira su 10%
     */
    function withdrawOwnerFunds() external nonReentrant onlyRole(ADMIN_ROLE) {
        require(pendingOwnerWld > 0, "No pending withdrawal");

        uint256 amount = pendingOwnerWld;
        pendingOwnerWld = 0;

        wldToken.safeTransfer(ownerWallet, amount);

        emit OwnerWithdrawal(amount);
    }

    /**
     * @notice Owner retira WLD de reserva (sin recompra)
     */
    function withdrawReserve(uint256 amount) external nonReentrant onlyRole(ADMIN_ROLE) {
        require(amount <= reserveWld, "Exceeds reserve");
        reserveWld -= amount;
        wldToken.safeTransfer(ownerWallet, amount);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Estado de la tesoreria
     */
    function getTreasuryStatus() external view returns (
        uint256 _totalWldReceived,
        uint256 _pendingOwnerWld,
        uint256 _pendingKobanBuyback,
        uint256 _pendingHachiBuyback,
        uint256 _reserveWld,
        uint256 _depositedHachi,
        uint256 _depositedKoban
    ) {
        return (
            totalWldReceived,
            pendingOwnerWld,
            pendingKobanBuyback,
            pendingHachiBuyback,
            reserveWld,
            depositedHachi,
            depositedKoban
        );
    }

    /**
     * @notice Desglose de ingresos por fuente
     */
    function getIncomeBreakdown() external view returns (
        uint256 fromUpgrades,
        uint256 fromAds,
        uint256 fromMemberships,
        uint256 fromFoodPacks,
        uint256 fromChests
    ) {
        return (
            totalWldFromUpgrades,
            totalWldFromAds,
            totalWldFromMemberships,
            totalWldFromFoodPacks,
            totalWldFromChests
        );
    }

    /**
     * @notice Stats de buyback
     */
    function getBuybackStats() external view returns (
        uint256 _totalKobanBoughtBack,
        uint256 _totalHachiBoughtBack,
        uint256 _totalDistributed
    ) {
        return (totalKobanBoughtBack, totalHachiBoughtBack, totalDistributedToUsers);
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    function setOwnerWallet(address _wallet) external onlyRole(ADMIN_ROLE) {
        require(_wallet != address(0), "Invalid address");
        ownerWallet = _wallet;
    }

    function setKobanToken(address _token) external onlyRole(ADMIN_ROLE) {
        require(_token != address(0), "Invalid address");
        kobanToken = IERC20(_token);
    }

    function setKobanRewardsPool(address _pool) external onlyRole(ADMIN_ROLE) {
        require(_pool != address(0), "Invalid address");
        kobanRewardsPool = _pool;
    }

    function setHachiRewardsPool(address _pool) external onlyRole(ADMIN_ROLE) {
        require(_pool != address(0), "Invalid address");
        hachiRewardsPool = _pool;
    }

    function setHachiLockPool(address _pool) external onlyRole(ADMIN_ROLE) {
        require(_pool != address(0), "Invalid address");
        hachiLockPool = _pool;
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
    function recoverToken(address token, uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(token != address(wldToken), "Cannot recover WLD");
        require(token != address(hachiToken), "Cannot recover HACHI");
        require(token != address(kobanToken), "Cannot recover KOBAN");
        IERC20(token).safeTransfer(ownerWallet, amount);
    }
}
