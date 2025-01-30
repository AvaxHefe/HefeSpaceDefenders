class LeaderboardService {
  constructor() {
    try {
      this.firebaseConfig = {
        apiKey: 'AIzaSyC9B_gA2K29bXbc4yKDolyCKFEft6eQss8',
        authDomain: 'hefe-s.firebaseapp.com',
        databaseURL: 'https://hefe-s-default-rtdb.firebaseio.com',
        projectId: 'hefe-s',
        storageBucket: 'hefe-s.appspot.com',
        messagingSenderId: '203193310179',
        appId: '1:203193310179:web:bb1afaa4860100edd09ed6',
        measurementId: 'G-M1DMQCZBSH'
      };

      if (typeof firebase === 'undefined') {
        console.warn('Firebase not loaded, leaderboard functionality will be disabled');
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(this.firebaseConfig);
      }
      this.db = firebase.database();
      this.scoresRef = this.db.ref('scores');
    } catch (error) {
      console.error('Failed to initialize LeaderboardService:', error);
    }
  }

  async postScore(score, playerName = 'Anonymous') {
    if (!this.scoresRef) {
      console.warn('Leaderboard not initialized, score not posted');
      return;
    }

    const newScore = {
      name: playerName,
      score: score,
      timestamp: Date.now()
    };
    
    try {
      await this.scoresRef.push(newScore);
    } catch (error) {
      console.error('Error posting score:', error);
    }
  }

  async getTopScores(limit = 10) {
    if (!this.scoresRef) {
      console.warn('Leaderboard not initialized, returning empty scores');
      return [];
    }

    try {
      const snapshot = await this.scoresRef
        .orderByChild('score')
        .limitToLast(limit)
        .once('value');
      return this.processSnapshot(snapshot);
    } catch (error) {
      console.error('Error fetching scores:', error);
      return [];
    }
  }

  processSnapshot(snapshot) {
    const scores = [];
    snapshot.forEach(childSnapshot => {
      scores.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    return scores.sort((a, b) => b.score - a.score);
  }
}