// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IWorldID
 * @notice Interface para World ID de Worldcoin
 */
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
 * @title WorldIDVerifier
 * @notice Verificacion de humanidad usando World ID de Worldcoin
 * @dev Previene bots y asegura un usuario = una persona
 */
contract WorldIDVerifier {
    
    IWorldID public immutable worldId;
    uint256 public immutable groupId;
    uint256 public immutable externalNullifier;
    
    // Mapping de nullifiers usados (previene doble uso)
    mapping(uint256 => bool) public nullifierHashes;
    
    // Mapping de direcciones verificadas
    mapping(address => bool) public isVerified;
    mapping(address => uint256) public verificationTime;
    
    // Eventos
    event HumanVerified(address indexed user, uint256 nullifierHash);
    event VerificationRevoked(address indexed user);
    
    error InvalidNullifier();
    error AlreadyVerified();
    error NotVerified();
    error DuplicateNullifier();
    
    constructor(
        IWorldID _worldId,
        string memory _appId,
        string memory _actionId
    ) {
        worldId = _worldId;
        groupId = 1; // Orb verification level
        externalNullifier = hashToField(abi.encodePacked(hashToField(abi.encodePacked(_appId)), _actionId));
    }
    
    /**
     * @notice Verifica que el usuario es humano usando World ID
     * @param signal La direccion del usuario que se verifica
     * @param root El root del merkle tree de World ID
     * @param nullifierHash Hash unico por usuario/accion
     * @param proof La prueba ZK de World ID
     */
    function verifyHuman(
        address signal,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external {
        // Verificar que el nullifier no ha sido usado
        if (nullifierHashes[nullifierHash]) revert DuplicateNullifier();
        
        // Verificar la prueba con World ID
        worldId.verifyProof(
            root,
            groupId,
            hashToField(abi.encodePacked(signal)),
            nullifierHash,
            externalNullifier,
            proof
        );
        
        // Marcar nullifier como usado
        nullifierHashes[nullifierHash] = true;
        
        // Marcar usuario como verificado
        isVerified[signal] = true;
        verificationTime[signal] = block.timestamp;
        
        emit HumanVerified(signal, nullifierHash);
    }
    
    /**
     * @notice Verifica si una direccion esta verificada como humano
     */
    function checkVerified(address user) external view returns (bool) {
        return isVerified[user];
    }
    
    /**
     * @notice Modifier para requerir verificacion de humanidad
     */
    modifier onlyVerifiedHuman(address user) {
        if (!isVerified[user]) revert NotVerified();
        _;
    }
    
    /**
     * @notice Convierte bytes a field element para World ID
     */
    function hashToField(bytes memory data) internal pure returns (uint256) {
        return uint256(keccak256(data)) >> 8;
    }
}
