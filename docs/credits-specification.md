# Credit System Specification

> A gamified economy for the Oyrenoyret.org EdTech platform. Designed to balance participation costs with earning opportunities while fostering subconscious engagement through variable rewards, progression, and social dynamics.

---

## Core Principles

- **Default balance**: 15 credits on registration — enough to try each feature once (except special academic events)
- **Earn by contributing**: Host sessions, publish materials, perform in sprints, help in discussions
- **Spend to consume**: Join sessions, unlock materials, enter sprints, create discussions
- **Integer credits**: All credit amounts are whole numbers
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

### 2.1 Minimum Content

- **Textual**: at least **300 words**
- **Practice tests**: at least **5 questions**

---

### 2.2 Credit Value (Unlock Cost)

Material credit value is integer and based on size.

```
C_textual = 3 + floor(max(words - 300, 0) / 200)
C_practice = 3 + floor(max(questions - 5, 0) / 5)
```

**Examples:**
- 300 words → 3 credits
- 500 words → 4 credits
- 700 words → 5 credits
- 5 questions → 3 credits
- 10 questions → 4 credits
- 15 questions → 5 credits

---

### 2.3 Publisher Rewards

- **Publish bonus**: 1 credit (one-time, on publish)
- **Passive earnings**: 1 credit per unlock

---

## 3. Problem-Solving Sprints

10–15 minute competitive contests with fixed entry and payouts.

### 3.1 Entry Cost

```
C_sprint = 3
```

---

### 3.2 Payouts

Only **top 3** earn. Ranks 4+ receive nothing.

| Rank | Payout |
|------|--------|
| 1st  | 9      |
| 2nd  | 7      |
| 3rd  | 5      |

---

## 4. Discussions

### 4.1 Create Discussion (Cost)

```
C_create = 1
```

---

### 4.2 Reply Reward

- **Reply prize**: 1 credit
- **No credits** for replies by the discussion author in their own thread

---

### 4.3 Help Others (Earn)

Only rewarded when help is validated (e.g., accepted by asker or upvoted by others).

```
G_help =
  accepted_by_asker → 3
  upvoted (net ≥ 2) → 2
  upvoted (net ≥ 1) → 1
  otherwise         → 0
```

**Minimum threshold:** Reply must be accepted OR have net upvotes ≥ 1 to earn anything.

*Engagement hook: "Your help was accepted — +3 credits" — social validation + reward.*

---

## 5. Special Academic Events

High-cost, high-prestige events. Not covered by default 15 credits.

```
C_event = BASE_EVENT × TIER

Where:
  BASE_EVENT = 100.0
  TIER = { standard → 1.0, premium → 1.25, elite → 1.5 }
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

- **Top 3 only**: Ranks 4+ receive nothing
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

- **Entry cost**: 3 credits feels significant
- **Effect**: "I've already paid — I'll give it my best shot"

---

## 7. Default Credit Allocation (15 Credits)

| Activity              | Typical Cost | Fits in 15? |
|-----------------------|--------------|-------------|
| 1× short session (30m)| ~1           | ✓           |
| 1× material unlock    | ~3           | ✓           |
| 1× sprint entry       | 3            | ✓           |
| 1× discussion create  | 1            | ✓           |
| 1× special event     | 100–150      | ✗ (aspirational) |

**Remaining after one of each:** ~7 credits — buffer for another session or material.

---

## 8. Summary Constants Reference

| Constant        | Value | Purpose                    |
|-----------------|-------|----------------------------|
| DEFAULT_CREDITS | 15    | New user balance           |
| BASE_SESSION    | 1.0   | Participant cost base     |
| BASE_HOST       | 1.2   | Facilitator gain base (2–4 range) |
| BASE_PUBLISH    | 1     | Initial material publish   |
| BASE_PASSIVE    | 1     | Per-use material passive   |
| BASE_UNLOCK     | 3     | Material consumer cost     |
| BASE_SPRINT     | 3     | Sprint entry cost          |
| BASE_CREATE     | 1     | Discussion creation cost   |
| BASE_HELP       | 1     | Help reward base           |
| BASE_EVENT      | 100.0 | Special event base (100–150) |

---

## 9. Implementation Notes

1. **Credit transactions**: Log every credit change (CreditTransaction model) for audit and analytics
2. **Idempotency**: Prevent double-spend (e.g., joining same session twice)
3. **Negative balance**: Block actions when credits < required cost
4. **Content minimums**: Enforce 300-word textual minimum and 5-question practice test minimum before publish
5. **Rating system**: Group session objectives + participant ratings need UI and storage
