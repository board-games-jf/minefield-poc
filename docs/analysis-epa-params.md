# Análise Crítica — Parâmetros EPA por Modo/Dificuldade

## Entendendo o que cada parâmetro faz

| Parâmetro | Efeito |
|---|---|
| `safeEnergy` | Raio da zona segura ao redor do firstClick. **1 = só a célula clicada. 2 = firstClick + anel 3×3 (9 células). 3 = 25 células.** |
| `dangerSources` | Quantidade de epicentros de perigo fora da zona segura |
| `dangerEnergyMax` | Energia máxima por epicentro — controla o raio e intensidade do cluster de perigo |
| `reliefPockets` | Quantidade de bolsões de alívio (reduzem probabilidade de bomba naquela região) |
| `reliefEnergyMax` | Energia máxima por bolsão de alívio |
| `reliefWeightMultiplier` | Quanto o alívio reduz o peso das bombas. **Valores mais baixos = alívio mais forte.** 0.35 ≈ 3× mais seguro. 0.7 ≈ apenas 1.4× mais seguro. |
| `dangerWeightMultiplier` | Quanto a zona de perigo puxa as bombas. Mais alto = bombas mais clusterizadas. |

---

## Análise por modo

### COOP / EXPLOSIVE (`ENERGY_PRESETS`)

**Easy (6×6):**
- `safeEnergy: 1` → somente a célula clicada é garantida segura. Para um tabuleiro 6×6 com ~8 bombas, isso significa que o jogador abre literalmente 1 célula garantida. O heurístico emocional (`maxFirstRevealFootprint: 6`) vai selecionar boards onde se abre uma região, mas a variância de tentativas é alta.
- **Sugestão:** considerar `safeEnergy: 2` (9 células seguras), assim o primeiro clique é visualmente generoso num tabuleiro já pequeno.
- `reliefPockets: 1` — muito pouco para easy. O objetivo do coop easy é ser acessível. Um bolsão de alívio significa que existe apenas uma "respiração" além da zona segura inicial.

**Medium (8×8):**
- Parâmetros razoáveis. A transição de `dangerSources: 2 → 3` e `dangerEnergyMax: 3 → 5` é um salto significativo de tensão. Avalie se o medium não fica muito próximo do hard na prática.

**Hard (10×10):**
- `safeEnergy: 1` — intencional (hard = menos colchão inicial), mas é a mesma abertura que o easy. A diferença de dificuldade fica toda nos outros parâmetros.
- `reliefPockets: 4` — **mais relief pockets que medium (2) e easy (1)**. Isso é contra-intuitivo na superfície, mas tem justificativa: hard tem mais bombas e sem bolsões de alívio o tabuleiro pode virar "ruído branco". Os bolsões criam o ritmo *tensão → respiro → tensão*.
- **Problema potencial:** com `reliefPockets: 4` e `reliefWeightMultiplier: 0.28` (o mais baixo, ou seja, alívio mais forte), o hard pode ter corredores de segurança tão definidos que o mapa parece "guiado".
- **Sugestão:** aumentar `reliefWeightMultiplier` para `0.30–0.32` no hard e reduzir `reliefPockets` para `3`.

---

### DEFUSE (`DEFUSE_ENERGY_PRESETS`)

**Contexto do modo:** Solo/coop com timer. O objetivo é dedução pura — encontrar bombas por lógica, depois decidir entre inspecionar e desativar. Forced guesses (50/50 sem lógica) são a maior punição aqui porque cada erro custa tempo real.

**Easy (preset base + override `safeEnergy: 2` em `ensureDefuseGridReady`):**
- A decisão de sobrescrever para `safeEnergy: 2` está correta. O jogador precisa de uma abertura generosa para começar a raciocinar.
- `dangerSources: 2`, `dangerEnergyMax: 3` — clusters leves. Bom para easy.
- **Sugestão:** aumentar `reliefPockets` para `2` e `reliefEnergyMax` para `3`, para criar mais corredores dedutivos e reduzir forced guesses no início da partida.

**Medium:**
- Parâmetros idênticos ao coop medium. Para defuse, onde forced guesses custam 10s de penalidade, o ideal seria uma board um pouco mais "dedutível".
- **Sugestão:** `reliefPockets: 3` (vs. 2 atual) e `dangerWeightMultiplier: 1.3` — mais concentração de perigo = padrão mais previsível = mais dedução possível.

**Hard:**
- `safeEnergy: 1` — zona mínima. Para um modo solo timed, isso significa que o jogador pode abrir em uma célula cercada por números por todos os lados, sem nenhuma lógica disponível de imediato.
- **Sugestão:** considerar `safeEnergy: 2` mesmo no defuse hard. A dificuldade do hard não vem da abertura, vem da densidade e da exigência de dedução perfeita.
- `dangerSources: 4`, `dangerEnergyMax: 5` — idêntico ao coop hard. Para defuse hard, clusters mais concentrados (`dangerEnergyMax: 6–7`) tornariam os padrões de bombas mais reconhecíveis e portanto mais dedutíveis, recompensando habilidade real.

**Problema estrutural — sem heurístico próprio para defuse:**
O `scoreBoardForCoop` (que avalia ilhas de zero, footprints, etc.) está sendo reutilizado para defuse. Para defuse, o que importa não é quantas ilhas bonitas existem, mas **deducibility** — evitar situações de 50/50 isoladas, criar padrões de bombas que seguem clusters claros. Um `scoreBoardForDefuse` dedicado seria o maior ganho de longo prazo.

---

### VERSUS (`VERSUS_ENERGY_PRESETS`)

**Contexto do modo:** Dois jogadores, risco é parte da estratégia, sem garantia de primeiro clique.

**Observação sobre `reliefWeightMultiplier` alto:**
- Valores: `0.7 → 0.72 → 0.75`. São os valores mais altos do sistema, o que significa que os bolsões de alívio **quase não funcionam** (0.7 = bomba ainda tem 70% do peso original no bolsão). Isso cria um tabuleiro quase uniformemente distribuído.
- É uma escolha válida para versus (o risco é a mecânica), mas o resultado é que `reliefPockets` vira parâmetro cosmético — existe no código mas tem efeito mínimo. Considerar remover reliefPockets do versus ou baixar o multiplier para `0.5` para criar corredores de rota estratégica mais claros.

**Hard versus:**
- `reliefWeightMultiplier: 0.75` combinado com `dangerWeightMultiplier: 1.25` = bombas muito clusterizadas E o alívio não funciona. Resultado: hard versus vira "tudo é perigoso em certas regiões, e o resto é loteria". Poderia ser mais interessante estrategicamente com `reliefWeightMultiplier: 0.55` para criar alguns corredores de rota mais seguros que exijam decisão táctica, não apenas sorte.

---

## Resumo das sugestões

| Modo | Onde | Parâmetro | Atual | Sugerido | Motivo |
|---|---|---|---|---|---|
| coop + explosive | `ENERGY_PRESETS.easy` | `safeEnergy` | 1 | 2 | Board 6×6 — abertura de 1 célula é muito austera para easy |
| coop + explosive | `ENERGY_PRESETS.hard` | `reliefWeightMultiplier` | 0.28 | 0.30–0.32 | 4 bolsões com alívio muito forte podem criar corredores muito guiados |
| coop + explosive | `ENERGY_PRESETS.hard` | `reliefPockets` | 4 | 3 | Reduzir levemente para balancear com o multiplier |
| defuse | `DEFUSE_ENERGY_PRESETS.easy` | `reliefPockets` | 1 | 2 | Mais corredores dedutivos para reduzir forced guesses |
| defuse | `DEFUSE_ENERGY_PRESETS.easy` | `reliefEnergyMax` | 2 | 3 | Bolsões mais expressivos para abertura dedutiva |
| defuse | `DEFUSE_ENERGY_PRESETS.medium` | `reliefPockets` | 2 | 3 | Modo exige mais deducibility |
| defuse | `DEFUSE_ENERGY_PRESETS.medium` | `dangerWeightMultiplier` | 1.2 | 1.3 | Clusters mais definidos = padrões mais previsíveis = mais dedução |
| defuse | `DEFUSE_ENERGY_PRESETS.hard` | `safeEnergy` (override) | 1 | 2 | A dificuldade vem da densidade, não da abertura mínima |
| defuse | `DEFUSE_ENERGY_PRESETS.hard` | `dangerEnergyMax` | 5 | 6–7 | Clusters mais concentrados e legíveis para dedução avançada |
| versus | `VERSUS_ENERGY_PRESETS.hard` | `reliefWeightMultiplier` | 0.75 | 0.55 | Criar corredores estratégicos reais no hard |
| defuse | Longo prazo | Heurístico defuse | reutiliza coop score | `scoreBoardForDefuse` próprio | Otimizar por deducibility, não por ilhas visualmente bonitas |
