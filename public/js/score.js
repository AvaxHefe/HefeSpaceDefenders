class ScoreService {
  constructor() {
    this.currentScore = 0;
    this.highScore = localStorage.getItem('spaceDefendersHighScore') || 0;
    this.scoreDisplay = document.getElementById('scoreDisplay');
    if (!this.scoreDisplay) {
      console.error('Score display element not found');
      this.scoreDisplay = { textContent: '' }; // Fallback object
    }
  }

  increment(points) {
    this.currentScore += points;
    if (this.currentScore > this.highScore) {
      this.highScore = this.currentScore;
      localStorage.setItem('spaceDefendersHighScore', this.highScore);
    }
    this.updateDisplay();
  }

  reset() {
    this.currentScore = 0;
    this.updateDisplay();
  }

  updateDisplay() {
    this.scoreDisplay.textContent = 
      `Score: ${this.currentScore} | High Score: ${this.highScore}`;
  }
}