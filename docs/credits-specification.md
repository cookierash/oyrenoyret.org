# Credit System Specification

> A gamified economy for the Oyrenoyret.org EdTech platform. Designed to balance participation costs with earning opportunities while fostering subconscious engagement through variable rewards, progression, and social dynamics.

---

## Core Principles

- **Default balance**: 15 credits on registration — enough to try each feature once (except special academic events)
- **Earn by contributing**: Host sessions, publish materials, perform in sprints, help in discussions
- **Spend to consume**: Join sessions, unlock materials, enter sprints, create discussions
- **Engagement design**: Variable rewards, near-miss effects, streaks, and loss-aversion nudges

---

## 1. Guided Group Sessions

### 1.1 Participant Cost (Credits Lost)

Participants pay to join a session. Cost scales with duration.

```
C_participant = BASE_SESSION × DURATION_FACTOR × (1 + ε)

Where:
  BASE_SESSION = 1.0
  DURATION_FACTOR = { 30 min → 1.0, 45 min → 1.25, 60 min → 1.5 }
  ε = random uniform in [-0.1, 0.1]  // "Sometimes I get a slightly better deal"
```

**Resulting costs (approx):**
| Duration | Min | Typical | Max |
|----------|-----|---------|-----|
| 30 min   | 0.9 | 1.0     | 1.1 |
| 45 min   | 1.1 | 1.25    | 1.4 |
| 60 min   | 1.4 | 1.5     | 1.7 |

*Engagement hook: Slight randomness creates "lucky session" moments.*

---

### 1.2 Facilitator Gain (Credits Earned)

The host earns based on attendance, duration, and session quality (participant ratings). Target range: **2–4 credits**.

```
G_facilitator = BASE_HOST × PARTICIPANT_FACTOR × DURATION_FACTOR × RATING_MULTIPLIER × (1 + BONUS_FULL)

Where:
  BASE_HOST = 1.2
  PARTICIPANT_FACTOR = clamp(N_participants, 3, 6) / 4
  DURATION_FACTOR = { 30 min → 1.0, 45 min → 1.2, 60 min → 1.4 }
  RATING_MULTIPLIER = 0.7 + (avg_objectives_achieved)  // avg in [0,1] → mult in [0.7, 1.7]
  BONUS_FULL = N_participants >= 6 ? 0.15 : 0  // "Full house" jackpot feel
```

**Example:** 5 participants, 45 min, 85% objectives achieved:
- G = 1.2 × (5/4) × 1.2 × (0.7 + 0.85) × 1.0 ≈ **3.3 credits**

*Engagement hook: Full sessions (6 people) feel like a "jackpot." High ratings = tangible reward.*

---

## 2. Publish Materials

### 2.1 Publisher: Initial Publication Bonus

One-time credit when material is published. AI evaluates alignment with publisher-defined objectives. Target: **~0.5 credits**.

```
G_initial = BASE_PUBLISH × ALIGNMENT_SCORE × TYPE_MULTIPLIER × (1 + ε)

Where:
  BASE_PUBLISH = 0.5
  ALIGNMENT_SCORE = AI_rating in [0.5, 1.0]  // 0.5 = weak, 1.0 = excellent
  TYPE_MULTIPLIER = { TEXTUAL → 1.0, PRACTICE_TEST → 1.0 + 0.05 × min(N_questions, 20) }
  ε = random in [-0.1, 0.1]
```

**Typical range:** 0.25–0.6 credits. Practice test adds up to +0.5 for 20 questions.

*Engagement hook: Small initial reward — main earnings come from passive use over time.*

---

### 2.2 Publisher: Passive Earnings (Per Use)

Small credits each time someone benefits from the material.

```
G_passive = BASE_PASSIVE × ALIGNMENT_SCORE × TYPE_FACTOR

Where:
  BASE_PASSIVE = 0.15
  ALIGNMENT_SCORE = same as above
  TYPE_FACTOR = { TEXTUAL → 1.0, PRACTICE_TEST → 1.0 + 0.02 × min(N_questions, 15) }
```

**Typical:** 0.08–0.20 credits per consumer use.

*Engagement hook: "Your material earned 0.12 credits" — drip rewards create checking habit.*

---

### 2.3 Consumer Cost (Unlock Material)

Users pay based on material quality (alignment) and type.

```
C_material = BASE_UNLOCK × ALIGNMENT_SCORE × TYPE_FACTOR × (1 + ε)

Where:
  BASE_UNLOCK = 2.0
  ALIGNMENT_SCORE = AI_rating in [0.5, 1.0]
  TYPE_FACTOR = { TEXTUAL → 1.0, PRACTICE_TEST → 1.0 + 0.03 × min(N_questions, 25) }
  ε = random in [-0.08, 0.08]
```

**Typical range:** 1.0–3.5 credits per unlock.

*Engagement hook: Higher quality costs more — creates "premium" perception.*

---

## 3. Problem-Solving Sprints

10–15 minute competitive contests. Entry is expensive; top performers earn net positive.

### 3.1 Entry Cost

```
C_sprint = BASE_SPRINT × DURATION_FACTOR

Where:
  BASE_SPRINT = 5.0
  DURATION_FACTOR = { 10 min → 1.0, 12 min → 1.1, 15 min → 1.2 }
```

**Typical:** 5–6 credits to enter.

---

### 3.2 Payout (Winner Multiplier)

Only **top 5** earn. Ranks 6–20 receive nothing.

```
Payout_rank = C_sprint × MULTIPLIER_rank × (1 + ε)

Where:
  MULTIPLIER_rank = {
    1st  → 2.0
    2nd  → 1.75
    3rd  → 1.5
    4th  → 1.25
    5th  → 1.0
    6–20 → 0
  }
  ε = random in [-0.05, 0.05]
```

**Net outcome (entry 5 credits):**
| Rank | Payout | Net |
|------|--------|-----|
| 1st  | ~10    | +5  |
| 2nd  | ~8.75  | +3.75 |
| 3rd  | ~7.5   | +2.5 |
| 4th  | ~6.25  | +1.25 |
| 5th  | ~5     | 0 (break-even) |
| 6–20 | 0      | -5  |

*Engagement hook: Top 5 net positive or break-even; only winners earn.*

---

## 4. Discussions

### 4.1 Create Discussion (Cost)

```
C_create = BASE_CREATE × (1 + ε)

Where:
  BASE_CREATE = 1.0
  ε = random in [-0.1, 0.1]
```

**Typical:** 0.9–1.1 credits.

---

### 4.2 Help Others (Earn)

Only rewarded when help is validated (e.g., accepted by asker or upvoted by others).

```
G_help = BASE_HELP × VALIDATION_STRENGTH × (1 + ε)

Where:
  BASE_HELP = 0.5
  VALIDATION_STRENGTH = {
    accepted_by_asker → 1.5
    upvoted (net ≥ 2) → 1.2
    upvoted (net ≥ 1) → 1.0
    otherwise         → 0
  }
  ε = random in [-0.1, 0.1]
```

**Minimum threshold:** Reply must be accepted OR have net upvotes ≥ 1 to earn anything.

*Engagement hook: "Your help was accepted — +0.75 credits" — social validation + reward.*

---

## 5. Special Academic Events

High-cost, high-prestige events. Not covered by default 15 credits.

```
C_event = BASE_EVENT × TIER × (1 + ε)

Where:
  BASE_EVENT = 100.0
  TIER = { standard → 1.0, premium → 1.25, elite → 1.5 }
  ε = random in [-0.05, 0.05]
```

**Typical:** 100–150 credits. Requires significant prior earning through other activities.

*Engagement hook: Aspirational goal — "Save up for the elite event."*

---

## 6. Engagement & Addiction Mechanics

### 6.1 Variable Reward Schedules

- **ε (epsilon)**: Small randomness (±5–10%) in most formulas
- **Effect**: Avoids predictability; creates "lucky" moments
- **Principle**: Variable rewards increase dopamine response (slot-machine effect)

### 6.2 Winner-Only Sprints

- **Top 5 only**: Ranks 6–20 receive nothing
- **Effect**: Clear stakes; only skill is rewarded

### 6.3 Streak Bonuses (Optional Future)

```
STREAK_BONUS = 1 + 0.05 × min(consecutive_days_active, 7)
```
- 7-day streak → 35% bonus on next credit-earning action
- *Effect*: Daily return habit

### 6.4 Loss Aversion Nudges

- **UI**: "You have 3 credits left — enough for 1 discussion or 1 short session"
- **Effect**: Creates urgency; users act before "losing" opportunity

### 6.5 Progression & Leveling (Optional Future)

- **Credit milestones**: 25, 50, 100, 250 → badges or titles
- **Effect**: Long-term goals; "I'm 12 credits from Level 2"

### 6.6 Sunk Cost in Sprints

- **Entry cost**: 5 credits feels significant
- **Effect**: "I've already paid — I'll give it my best shot"

---

## 7. Default Credit Allocation (15 Credits)

| Activity              | Typical Cost | Fits in 15? |
|-----------------------|--------------|-------------|
| 1× short session (30m)| ~1           | ✓           |
| 1× material unlock    | ~2           | ✓           |
| 1× sprint entry      | ~5           | ✓           |
| 1× discussion create  | ~1           | ✓           |
| 1× special event     | 100–150      | ✗ (aspirational) |

**Remaining after one of each:** ~6 credits — buffer for another session or material.

---

## 8. Summary Constants Reference

| Constant        | Value | Purpose                    |
|-----------------|-------|----------------------------|
| DEFAULT_CREDITS | 15    | New user balance           |
| BASE_SESSION    | 1.0   | Participant cost base     |
| BASE_HOST       | 1.2   | Facilitator gain base (2–4 range) |
| BASE_PUBLISH    | 0.5   | Initial material publish   |
| BASE_PASSIVE    | 0.15  | Per-use material passive   |
| BASE_UNLOCK     | 2.0   | Material consumer cost     |
| BASE_SPRINT     | 5.0   | Sprint entry cost          |
| BASE_CREATE     | 1.0   | Discussion creation cost   |
| BASE_HELP       | 0.5   | Help reward base           |
| BASE_EVENT      | 100.0 | Special event base (100–150) |

---

## 9. Implementation Notes

1. **Credit transactions**: Log every credit change (CreditTransaction model) for audit and analytics
2. **Idempotency**: Prevent double-spend (e.g., joining same session twice)
3. **Negative balance**: Block actions when credits < required cost
4. **AI alignment**: Material alignment score requires AI evaluation pipeline before publish
5. **Rating system**: Group session objectives + participant ratings need UI and storage
