# Hachi Hub - Smart Contracts Suite

## Sistema Completo de Contratos para Worldchain

Suite de 7 contratos inteligentes con integracion World ID para verificacion de humanidad.

---

## Contratos

| # | Contrato | Archivo | Descripcion |
|---|----------|---------|-------------|
| 1 | **HachiKoban** | `1_HachiKoban.sol` | Token ERC-20 KOBAN con vesting |
| 2 | **WorldIDVerifier** | `2_WorldIDVerifier.sol` | Verificacion World ID |
| 3 | **HachiStaking** | `3_HachiStaking.sol` | Staking APY 50-80% anual |
| 4 | **HachiRewards** | `4_HachiRewards.sol` | Distribucion recompensas |
| 5 | **HachiAdvertising** | `5_HachiAdvertising.sol` | Sistema publicidad |
| 6 | **HachiCatUpgrades** | `6_HachiCatUpgrades.sol` | Mejoras de gatos |
| 7 | **HachiRanking** | `7_HachiRanking.sol` | Ranking por temporada |

---

## Tokenomics KOBAN (100M Total)

| Asignacion | Cantidad | % | Vesting |
|------------|----------|---|---------|
| App Rewards | 60,000,000 | 60% | Inmediato |
| Publicidad | 15,000,000 | 15% | Inmediato |
| Liquidez | 10,000,000 | 10% | Inmediato |
| Equipo | 15,000,000 | 15% | 2 años |

---

## Distribucion Ingresos

### Publicidad (WLD)
- 90% -> Recompra HACHI (usuarios)
- 10% -> Administracion

### Mejoras Gatos (WLD)
- 70% -> Recompra KOBAN
- 20% -> Reserva temporada
- 10% -> Administracion

---

## Costos Mejora Gatos

| Niveles | Rareza | Costo |
|---------|--------|-------|
| 1-10 | Common | 2 WLD |
| 11-15 | Rare | 5 WLD |
| 16-18 | Epic | 7 WLD |
| 19-20 | Legendary | 10 WLD |

---

## APY Staking (Anual)

| Nivel Gato | APY |
|------------|-----|
| 1-10 | 50% |
| 11-15 | 51.5-57.5% |
| 16-20 | 59-80% max |

---

## Sistema Puntos

| Actividad | Puntos |
|-----------|--------|
| Claim diario | +10 |
| Alimentar gato | +5 |
| Abrir cofre | +50 |
| Depositar cofre | +5 |
| Mision | +25 |
| Ver anuncio | +15 |
| Mejorar gato | +75 |
| Equipar accesorio | +10 |
| Staking (1K) | +20 |
| Referir amigo | +100 |

---

## Deploy en Remix

### Orden:
1. HachiKoban
2. WorldIDVerifier
3. HachiStaking
4. HachiRewards
5. HachiAdvertising
6. HachiCatUpgrades
7. HachiRanking

### Worldchain Addresses
- WLD: `0x2cFc85d8E48F8EAB294be644d9E25C3030863003`
- World ID Router: `0x17B354dD2595411ff79041f930e491A4Df39A278`

### Seguridad
- World ID (anti-bots)
- ReentrancyGuard
- Pausable
- AccessControl
- SafeERC20
- Cooldowns (1h)
- Max limits por claim
