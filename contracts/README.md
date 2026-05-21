# Contratos Solidity - Hachi Hub Economy

## Resumen de Contratos

### 1. HachiKoban.sol - Token KOBAN (ERC20)
**Proposito**: Token secundario del ecosistema que se produce por gatos y accesorios.

**Tokenomics (100M Total Supply)**:
| Asignacion | Cantidad | Porcentaje | Descripcion |
|------------|----------|------------|-------------|
| App Rewards | 60,000,000 | 60% | Produccion de gatos y accesorios |
| Advertising | 15,000,000 | 15% | Pool de recompras con ingresos WLD |
| Liquidity | 10,000,000 | 10% | Pool de liquidez DEX |
| Team | 15,000,000 | 15% | Vesting 2 años lineal |

**Funciones principales**:
- `emergencyMint()` - Solo en casos extremos (max 10M adicionales)
- `claimTeamTokens()` - Equipo reclama tokens vested
- `disableMinting()` - Desactiva mint permanentemente

---

### 2. HachiStaking.sol - Sistema de Staking
**Proposito**: Los usuarios bloquean HACHI y reciben KOBAN como recompensa.

**APY Structure**:
| Nivel Gato | APY Anual |
|------------|-----------|
| 1-10 | 50% |
| 11 | 51.5% |
| 12 | 53% |
| 13 | 54.5% |
| 14 | 56% |
| 15 | 57.5% |
| 16 | 59% |
| 17 | 60.5% |
| 18 | 62% |
| 19 | 63.5% |
| 20 | 65% → 80% (max) |

**Funciones principales**:
- `stake(amount)` - Deposita HACHI
- `unstake(amount)` - Retira HACHI + recompensas
- `claimRewards()` - Solo recompensas
- `updateCatLevel(user, level)` - Oracle actualiza nivel

---

### 3. HachiRewardsDistributor.sol - Sistema de Publicidad
**Proposito**: Distribuye HACHI a usuarios por ver anuncios.

**Flujo de Fondos (Anuncios)**:
```
Anunciante paga 3 WLD
    ├── 90% (2.7 WLD) → Recompra HACHI → Pool recompensas
    └── 10% (0.3 WLD) → Admin wallet
```

**Funciones principales**:
- `createAdvertisement()` - Anunciante crea anuncio
- `viewAd(adId)` - Usuario ve anuncio y recibe HACHI
- `fundRewardsPool()` - Admin fondea pool de HACHI

---

### 4. HachiKobanBuyback.sol - Sistema de Recompras
**Proposito**: Procesa pagos de mejoras de gatos y distribuye segun tokenomics.

**Flujo de Fondos (Mejoras)**:
```
Usuario paga WLD para mejorar gato
    ├── 70% → Recompra KOBAN (inmediato)
    ├── 20% → Reserva temporada (recompra al final)
    └── 10% → Admin wallet
```

**Costos de Mejora**:
| Niveles | Rareza | Costo WLD |
|---------|--------|-----------|
| 1-10 | Common | 2 WLD |
| 11-15 | Rare | 5 WLD |
| 16-18 | Epic | 7 WLD |
| 19-20 | Legendary | 10 WLD |

---

## Instrucciones para Remix IDE

### Paso 1: Preparar Remix
1. Ir a https://remix.ethereum.org
2. Crear nueva carpeta `contracts/`
3. Copiar cada archivo .sol

### Paso 2: Instalar OpenZeppelin
En la terminal de Remix:
```bash
npm install @openzeppelin/contracts
```

O usar imports de GitHub:
```solidity
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.0/contracts/token/ERC20/ERC20.sol";
```

### Paso 3: Compilar
1. Seleccionar compilador 0.8.20
2. Habilitar optimizacion (200 runs)
3. Compilar cada contrato

### Paso 4: Deploy en Worldchain

**Orden de deployment**:

1. **HachiKoban** (Token KOBAN)
   ```
   Constructor params:
   - _appRewardsWallet: 0x... (wallet app)
   - _advertisingWallet: 0x... (wallet publicidad)
   - _liquidityWallet: 0x... (wallet liquidez)
   - _teamWallet: 0x... (wallet equipo)
   ```

2. **HachiStaking**
   ```
   Constructor params:
   - _hachiToken: 0x... (direccion HACHI existente)
   - _kobanToken: 0x... (direccion KOBAN del paso 1)
   ```

3. **HachiRewardsDistributor**
   ```
   Constructor params:
   - _hachiToken: 0x... (direccion HACHI existente)
   - _wldToken: 0x... (direccion WLD en Worldchain)
   - _adminWallet: 0x... (wallet admin)
   ```

4. **HachiKobanBuyback**
   ```
   Constructor params:
   - _wldToken: 0x... (direccion WLD)
   - _kobanToken: 0x... (direccion KOBAN)
   - _adminWallet: 0x... (wallet admin)
   - _buybackWallet: 0x... (wallet para ejecutar recompras)
   ```

### Paso 5: Configuracion Post-Deploy

1. **Fondear pools**:
   ```solidity
   // En HachiStaking - transferir KOBAN para recompensas
   kobanToken.approve(stakingAddress, amount);
   staking.fundRewardsPool(amount);
   
   // En HachiRewardsDistributor - transferir HACHI para recompensas
   hachiToken.approve(distributorAddress, amount);
   distributor.fundRewardsPool(amount);
   ```

2. **Asignar roles**:
   ```solidity
   // ORACLE_ROLE para actualizar niveles de gatos desde backend
   staking.grantRole(ORACLE_ROLE, backendWallet);
   
   // DISTRIBUTOR_ROLE para operaciones
   distributor.grantRole(DISTRIBUTOR_ROLE, operatorWallet);
   ```

---

## Direcciones en Worldchain

**Tokens existentes** (verificar en explorer):
- WLD: `0x...` (Worldcoin token)
- HACHI: `0x...` (tu token existente)

**Nuevos contratos** (despues de deploy):
- KOBAN: `0x...`
- Staking: `0x...`
- Rewards: `0x...`
- Buyback: `0x...`

---

## Seguridad

- Todos los contratos usan OpenZeppelin (auditados)
- ReentrancyGuard en funciones criticas
- AccessControl para roles
- Pausable para emergencias
- SafeERC20 para transferencias

## Gas Estimates (Worldchain)

| Funcion | Gas Estimado |
|---------|--------------|
| Deploy KOBAN | ~2,500,000 |
| Deploy Staking | ~2,000,000 |
| Deploy Rewards | ~1,800,000 |
| Deploy Buyback | ~1,500,000 |
| stake() | ~150,000 |
| unstake() | ~180,000 |
| viewAd() | ~100,000 |
| processUpgrade() | ~120,000 |
