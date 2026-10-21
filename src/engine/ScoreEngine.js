/**
 * MOTION SMART CLASS - Score Engine
 * Computes scores, streaks, multipliers, speed bonuses, response times, and topic mastery.
 */

export class ScoreEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.history = [];
    this.responseTimesMs = [];
    this.topicStats = {}; // { [topic]: { correct: 0, total: 0 } }
  }

  calculateAnswerScore({
    isCorrect,
    timeLeft = 0,
    totalTime = 40,
    pointWeight = 100,
    isBonusGesture = false,
    responseTimeMs = 0,
    topic = "Materi Umum"
  }) {
    // Record response time
    if (responseTimeMs > 0) {
      this.responseTimesMs.push(responseTimeMs);
    }

    // Record topic mastery
    if (!this.topicStats[topic]) {
      this.topicStats[topic] = { correct: 0, total: 0 };
    }
    this.topicStats[topic].total += 1;

    if (!isCorrect) {
      this.streak = 0;
      this.wrongCount += 1;
      this.history.push({ correct: false, points: 0, streak: 0, topic, responseTimeMs });
      return {
        pointsEarned: 0,
        basePoints: 0,
        speedBonus: 0,
        comboMultiplier: 1,
        bonusGesturePoints: 0,
        totalScore: this.score,
        streak: 0,
        comboText: ""
      };
    }

    this.correctCount += 1;
    this.topicStats[topic].correct += 1;

    this.streak += 1;
    if (this.streak > this.maxStreak) {
      this.maxStreak = this.streak;
    }

    const basePoints = pointWeight || 100;

    // Speed bonus: answered within first 35% of total time
    let speedBonus = 0;
    if (timeLeft >= totalTime * 0.65) {
      speedBonus = 50;
    } else if (timeLeft >= totalTime * 0.40) {
      speedBonus = 25;
    }

    // Combo multiplier
    let comboMultiplier = 1;
    if (this.streak >= 8) {
      comboMultiplier = 5;
    } else if (this.streak >= 6) {
      comboMultiplier = 4;
    } else if (this.streak >= 4) {
      comboMultiplier = 3;
    } else if (this.streak >= 2) {
      comboMultiplier = 2;
    }

    // Gesture bonus
    const bonusGesturePoints = isBonusGesture ? 25 : 0;

    const pointsEarned = (basePoints + speedBonus + bonusGesturePoints) * comboMultiplier;
    this.score += pointsEarned;

    this.history.push({
      correct: true,
      points: pointsEarned,
      streak: this.streak,
      comboMultiplier,
      topic,
      responseTimeMs
    });

    let comboText = "";
    if (comboMultiplier > 1) {
      comboText = `COMBO x${comboMultiplier}!`;
    }

    return {
      pointsEarned,
      basePoints,
      speedBonus,
      comboMultiplier,
      bonusGesturePoints,
      totalScore: this.score,
      streak: this.streak,
      comboText
    };
  }

  getAccuracy() {
    const total = this.correctCount + this.wrongCount;
    if (total === 0) return 100;
    return Math.round((this.correctCount / total) * 100);
  }

  getAverageResponseTimeSec() {
    if (this.responseTimesMs.length === 0) return 0;
    const sum = this.responseTimesMs.reduce((a, b) => a + b, 0);
    return parseFloat((sum / this.responseTimesMs.length / 1000).toFixed(1));
  }

  getWeakTopics() {
    const weak = [];
    Object.keys(this.topicStats).forEach((topic) => {
      const stat = this.topicStats[topic];
      const acc = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
      if (acc < 60) {
        weak.push({
          topic,
          accuracy: Math.round(acc),
          correct: stat.correct,
          total: stat.total
        });
      }
    });
    return weak;
  }

  getLevel() {
    if (this.score >= 2000) return 5;
    if (this.score >= 1200) return 4;
    if (this.score >= 700) return 3;
    if (this.score >= 300) return 2;
    return 1;
  }

  getBadge(category = "numerasi") {
    const accuracy = this.getAccuracy();
    if (accuracy === 100 && this.correctCount >= 5) {
      return { title: "🏅 PERFECT MASTER", desc: "Menjawab semua soal dengan tepat tanpa salah!" };
    }
    if (this.maxStreak >= 5) {
      return { title: "🔥 STREAK LEGEND", desc: "Mempertahankan 5+ jawaban benar berturut-turut!" };
    }
    if (category === "numerasi") {
      return { title: "🏅 MATH HERO", desc: "Ketepatan berhitung & numerasi luar biasa!" };
    } else if (category === "literasi") {
      return { title: "🏅 READING DETECTIVE", desc: "Pakar analisis teks dan pemahaman bahasa!" };
    }
    return { title: "🏅 QUICK THINKER", desc: "Kecepatan berpikir dan respon tubuh yang hebat!" };
  }
}
