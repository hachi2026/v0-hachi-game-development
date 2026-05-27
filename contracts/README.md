# Hachi Hub - Smart Contracts Suite v2

## Sistema Completo para Worldchain con World ID

Suite de 13 contratos inteligentes con integracion completa de World ID.

---

## Contratos

| # | Contrato | Archivo | Descripcion |
|---|----------|---------|-------------|
| 1 | **HachiKoban** | `1_HachiKoban.sol` | Token ERC-20 KOBAN (100M) |
| 2 | **WorldIDVerifier** | `2_WorldIDVerifier.sol` | Verificacion World ID |
| 3 | **HachiStaking** | `3_HachiStaking.sol` | Staking KOBAN->KOBAN (60-100% APY) |
| 4 | **HachiRewards** | `4_HachiRewards.sol` | Distribucion recompensas |
| 5 | **HachiAdvertising** | `5_HachiAdvertising.sol` | Sistema publicidad |
| 6 | **HachiCatUpgrades** | `6_HachiCatUpgrades.sol` | Mejoras de gatos |
| 7 | **HachiRanking** | `7_HachiRanking.sol` | Ranking por temporada (90 dias) |
| 8 | **HachiMembership** | `8_HachiMembership.sol` | Membresia premium (10 WLD) |
| 9 | **HachiReferrals** | `9_HachiReferrals.sol` | Sistema referidos |
| 10 | **HachiFoodPacks** | `10_HachiFoodPacks.sol` | Packs comida (producen KOBAN) |
| 11 | **HachiChests** | `11_HachiChests.sol` | Cofres gacha (5 cuotas) |
| 12 | **HachiTreasury** | `12_HachiTreasury.sol` | Tesoreria central (economia) |
| 13 | **HachiLock** | `13_HachiLock.sol` | Lock HACHI->HACHI (5-70% APY) |

---

## HachiTreasury (Contrato Central de Economia)

El contrato de tesoreria maneja TODOS los flujos de ingresos y distribuciones.

### Distribucion de Ingresos WLD:

| Destino | Porcentaje |
|---------|------------|
| Owner (operaciones) | 10% |
| Recompra KOBAN | 30% |
| Recompra HACHI | 30% |
| Reserva sistema | 30% |

**Reserva**: Owner decide cuando y que token recomprar (HACHI o KOBAN)

### Distribucion de Ingresos HACHI:

| Destino | Porcentaje |
|---------|------------|
| Pool de Rewards (Temporada) | 70% |
| Pool de Locks (APY) | 30% |

**TODOS los ingresos en HACHI van a rewards y locks.**

### Funciones:

- `receivePayment()` - Recibe pago WLD y distribuye (10/30/30/30)
- `receiveHachi()` - Recibe HACHI y distribuye (70% rewards, 30% locks)
- `fundSeasonRewards()` - Transfiere HACHI a pool de ranking
- `fundLockRewards()` - Transfiere HACHI a pool de locks
- `executeKobanBuyback()` - Ejecuta recompra de KOBAN (30%)
- `executeHachiBuyback()` - Ejecuta recompra de HACHI (30%)
- `executeReserveBuyback()` - Owner usa reserva para buyback manual
- `withdrawOwnerFunds()` - Owner retira su 10%

---

## HachiRanking (Pool de Premios en HACHI)

### Pool de Temporada:
- **Primera temporada**: 1,000,000 HACHI
- **Duracion**: 90 dias
- **Al terminar**: se reparten premios y se reinicia

### Distribucion de Premios:

| Posicion | % del Pool |
|----------|------------|
| Top 1 | 20% |
| Top 2-5 | 15% (div 4) |
| Top 6-20 | 10% (div 15) |
| Top 21-100 | 5% (div 80) |

### Puntos Escalonados:

| Actividad | Puntos |
|-----------|--------|
| Food Pack 7 dias | 25 |
| Food Pack 30 dias | 100 |
| Food Pack 90 dias | 300 |
| Cofre Basico (deposito) | 10 |
| Cofre Avanzado (deposito) | 25 |
| Cofre Premium (deposito) | 50 |
| Cofre Exclusivo (deposito) | 100 |
| Abrir Cofre Basico | 50 |
| Abrir Cofre Avanzado | 150 |
| Abrir Cofre Premium | 400 |
| Abrir Cofre Exclusivo | 1000 |
| Staking 100+ | 5 |
| Staking 1,000+ | 50 |
| Staking 10,000+ | 500 |
| Staking 100,000+ | 5000 |

**Nota**: Puntos de staking solo se agregan despues de 24h stakeado.

---

## HachiLock (Lock HACHI -> HACHI)

### APY por Nivel:

| Sin Membresia | Con Membresia |
|---------------|---------------|
| 5% base | 5% base |
| +5% cada 2 niveles | +7% por nivel |
| Max 50% | Max 70% |

**Ejemplo sin membresia**: Nivel 1 = 5%, Nivel 3 = 10%, Nivel 5 = 15%... Nivel 19+ = 50%
**Ejemplo con membresia**: Nivel 1 = 5%, Nivel 2 = 12%, Nivel 3 = 19%... Nivel 10+ = 70%

### Cooldown:
- Claims cada 24 horas
- Unstake cada 24 horas
- Puntos ranking solo despues de 24h stakeado

---

## Tokenomics KOBAN (100M Total)

| Asignacion | Cantidad | % | Vesting |
|------------|----------|---|---------|
| App Rewards | 60,000,000 | 60% | Inmediato |
| Publicidad | 15,000,000 | 15% | Inmediato |
| Liquidez | 10,000,000 | 10% | Inmediato |
| Equipo | 15,000,000 | 15% | 2 años lineal |

---

## Sistema Dual de Tokens

| Token | Uso |
|-------|-----|
| **HACHI** | Agua diaria (100/dia), cofres, ranking, referidos |
| **KOBAN** | Produccion gatos, staking, rewards |

---

## Temporada: 90 Dias (3 Meses)

---

## APY Staking (KOBAN -> KOBAN)

| Condicion | APY Anual |
|-----------|-----------|
| Base | 60% |
| Gato nivel 11 | 62% |
| Gato nivel 15 | 70% |
| Gato nivel 20 | 80% |
| + Membresia | hasta 100% max |

**Formula**: `60% + (nivel - 10) * 2%` (cap 80% sin membresia, 100% con membresia)

---

## Membresia Premium (10 WLD)

| Beneficio | Detalle |
|-----------|---------|
| APY Bonus | +20% (hasta 100% max) |
| Descuento mejoras | 10% en mejoras de gatos |
| HACHI Return | 60% del valor devuelto en HACHI |
| Duracion | 90 dias (1 temporada) |

**HACHI Return**: 6 WLD en HACHI distribuido linealmente en 90 dias

---

## Sistema Referidos

| Evento | Recompensa |
|--------|------------|
| Registro (referido) | 1,000 HACHI |
| Registro (referidor) | 1,000 HACHI |

### Bonos por Rango

| Rango | Referidos | Bono HACHI |
|-------|-----------|------------|
| Bronze | 5 | 2,000 |
| Silver | 15 | 5,000 |
| Gold | 30 | 15,000 |
| Platinum | 50 | 30,000 |
| Diamond | 100 | 100,000 |

---

## Food Packs (Producen KOBAN)

**Formula**: `(WLD * 1000 KOBAN * 80%) / dias = KOBAN diario`

| Pack | Dias | Costo WLD | KOBAN/dia |
|------|------|-----------|-----------|
| Semanal | 7 | 1 | 114 |
| Mensual | 30 | 3 | 80 |
| Temporada | 90 | 7 | 62 |

**Agua**: 100 HACHI/dia (INDISPENSABLE para producir)

---

## Cofres (5 Cuotas)

- 5 depositos (1 por dia = tarea diaria)
- Se revela despues de 5 dias
- Gacha de accesorios

| Tier | Costo Total | Por Cuota |
|------|-------------|-----------|
| Basico | 500 HACHI | 100 |
| Avanzado | 2,500 HACHI | 500 |
| Premium | 10,000 HACHI | 2,000 |
| Exclusivo | 50,000 HACHI | 10,000 |

---

## Sistema de Puntos (Ranking)

| Actividad | Puntos |
|-----------|--------|
| Claim diario | +10 |
| Pagar agua | +5 |
| Deposito cofre | +20 |
| Abrir cofre | +100 |
| Mision completada | +25 |
| Ver anuncio | +15 |
| Mejorar gato | +75 |
| Equipar accesorio | +10 |
| Staking (100 KOBAN) | +10 |
| Comprar food pack | +50 |
| Comprar membresia | +500 |
| Referir amigo | +100 |

### Pool Progresiva

| Puntos Min | % del Pool |
|------------|------------|
| 0 | 1% |
| 1,000 | 2% |
| 5,000 | 5% |
| 15,000 | 10% |
| 30,000 | 15% |
| 50,000 | 20% |

---

## Costos Mejora Gatos

| Niveles | Rareza | Costo WLD | Con Membresia |
|---------|--------|-----------|---------------|
| 1-10 | Common | 2 | 1.8 |
| 11-15 | Rare | 5 | 4.5 |
| 16-18 | Epic | 7 | 6.3 |
| 19-20 | Legendary | 10 | 9 |

---

## Deploy en Remix IDE

### Orden de Deployment

```
1. HachiKoban (Token KOBAN)
2. WorldIDVerifier
3. HachiStaking (necesita: KOBAN)
4. HachiMembership (necesita: WLD, HACHI, Staking, WorldID)
5. HachiReferrals (necesita: HACHI, WorldID)
6. HachiFoodPacks (necesita: WLD, HACHI, KOBAN)
7. HachiChests (necesita: HACHI)
8. HachiRewards (necesita: HACHI, KOBAN)
9. HachiAdvertising (necesita: WLD, HACHI)
10. HachiCatUpgrades (necesita: WLD, Membership)
11. HachiRanking (necesita: HACHI, KOBAN)
```

### Worldchain Mainnet Addresses

```
WLD Token: 0x2cFc85d8E48F8EAB294be644d9E25C3030863003
World ID Router: 0x17B354dD2595411ff79041f930e491A4Df39A278
HACHI Token: 0xbE0313f279580FDD1aA1b1b6888407E6504fF19E
KOBAN Token: [DEPLOY_PENDING]
```

### Post-Deploy Setup

1. **Grant Roles**:
   - ORACLE_ROLE al backend
   - GAME_CONTROLLER_ROLE al backend
   - ADMIN_ROLE al multisig

2. **Fund Pools**:
   - KOBAN al Staking rewards pool
   - HACHI al Referrals rewards pool
   - KOBAN al FoodPacks rewards pool
   - HACHI al Membership return pool

3. **Connect Contracts**:
   - Membership.updateStakingContract()
   - Staking recibe updates de Membership

---

## Seguridad Implementada

- World ID (verificacion de humanidad)
- ReentrancyGuard (proteccion reentrancy)
- Pausable (pausa de emergencia)
- AccessControl (roles granulares)
- SafeERC20 (transferencias seguras)
- Cooldowns (1 deposito/dia en cofres)
- Max limits por operacion

---

## Flujo de Fondos

### Membresia (10 WLD)
```
Usuario paga 10 WLD
  └── 100% -> Admin Wallet
  └── 60% valor en HACHI -> Usuario (90 dias)
```

### Food Packs (WLD)
```
Usuario compra pack
  └── 100% WLD -> Admin Wallet
  └── 80% valor en KOBAN -> Usuario (diario)
  └── 20% -> Fee
```

### Publicidad (WLD)
```
Anunciante paga WLD
  ├── 90% -> Recompra HACHI -> Usuarios
  └── 10% -> Admin
```

### Mejoras Gatos (WLD)
```
Usuario mejora gato
  ├── 70% -> Recompra KOBAN
  ├── 20% -> Reserva temporada
  └── 10% -> Admin
```

---

## Compiler Settings (Remix)

```
Solidity: 0.8.20
Optimizer: Enabled
Runs: 200
EVM Version: Paris
```

## OpenZeppelin

Usar version 5.x:
```
@openzeppelin/contracts@5.0.0
```
