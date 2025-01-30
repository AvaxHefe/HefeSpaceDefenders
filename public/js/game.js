class Game {
  constructor(config) {
    this.canvas = document.getElementById(config.canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas element with id '${config.canvasId}' not found`);
    }
    
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    if (!config.spritePaths || !config.spritePaths.player || !config.spritePaths.aliens) {
      throw new Error('Invalid sprite paths configuration');
    }
    
    this.sprites = {};
    this.spritePaths = config.spritePaths;
    this.player = {
      x: this.canvas.width/2,
      width: 50,
      height: 50,
      y: 0, // Will be set properly in setCanvasSize
      speed: 7,
      isMovingLeft: false,
      isMovingRight: false
    };
    this.aliens = [];
    this.bullets = [];
    this.currentWave = 1;
    this.scoreService = new ScoreService();
    this.lives = 5;
    this.isPaused = false;
    this.gameOver = false;
    this.isMuted = false;
    this.justSpawned = false; // Flag to prevent immediate respawn
    
    // Load and set up background music
    this.sounds = {};
    const bgMusic = new Audio('sounds/siteopen.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0.5;
    
    // Create a promise to handle audio loading
    this.audioLoaded = new Promise((resolve, reject) => {
      bgMusic.addEventListener('canplaythrough', () => {
        console.log('Background music loaded successfully');
        this.sounds.bgMusic = bgMusic;
        resolve();
      });
      bgMusic.addEventListener('error', (e) => {
        console.error('Error loading background music:', e);
        reject(e);
      });
      bgMusic.load();
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    Object.values(this.sounds).forEach(sound => {
      sound.muted = this.isMuted;
    });
    this.showSoundStatus();
  }

  showSoundStatus() {
    // Save current text alignment
    const currentAlign = this.ctx.textAlign;
    
    // Draw sound status
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(this.canvas.width - 200, 10, 190, 40);
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`Sound: ${this.isMuted ? 'OFF' : 'ON'}`, this.canvas.width - 20, 35);
    
    // Restore text alignment
    this.ctx.textAlign = currentAlign;
  }

  async init() {
    try {
      console.log('Starting game initialization...');
      
      this.justSpawned = true;  // Set flag at the very start
      
      console.log('Loading sprites...');
      await this.loadSprites();
      console.log('Sprites loaded successfully');
      
      console.log('Setting up canvas...');
      this.setCanvasSize();
      
      console.log('Setting up event listeners...');
      this.setupEventListeners();
      
      console.log('Waiting for audio to load...');
      try {
        await this.audioLoaded;
        console.log('Audio loaded, attempting to play...');
        // Start audio in response to user interaction
        document.addEventListener('click', () => {
          this.sounds.bgMusic.play().catch(err =>
            console.warn('Background music failed to start:', err)
          );
        }, { once: true });
      } catch (err) {
        console.warn('Audio loading failed:', err);
      }
      
      console.log('Spawning initial alien wave...');
      this.spawnAlienWave();
      
      console.log('Starting game loop...');
      this.startGameLoop();
      
      console.log('Game initialization complete');
    } catch (error) {
      console.error('Game initialization failed:', error);
      throw error;
    }
  }

  async loadSprites() {
    const loadImage = (path) => new Promise((resolve, reject) => {
      const img = new Image();
      img.src = path;
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.error(`Failed to load sprite: ${path}`);
        reject(new Error(`Failed to load sprite: ${path}`));
      };
    });

    try {
      console.log('Loading player sprite:', this.spritePaths.player);
      this.sprites.player = await loadImage(this.spritePaths.player);
      
      console.log('Loading alien sprites:', this.spritePaths.aliens);
      this.sprites.aliens = await Promise.all(
        this.spritePaths.aliens.map(path => loadImage(path))
      );
    } catch (error) {
      console.error('Error loading sprites:', error);
      throw error;
    }
  }

  setCanvasSize() {
    this.canvas.width = window.innerWidth * 0.8;
    this.canvas.height = window.innerHeight * 0.7;
    // Set player's y position at bottom of canvas
    this.player.y = this.canvas.height - this.player.height;
  }

  checkCollisions() {
    this.bullets.forEach((bullet, bulletIndex) => {
      this.aliens.forEach((alien, alienIndex) => {
        // Check if bullet hits alien
        if (bullet.x >= alien.x - alien.width/2 &&
            bullet.x <= alien.x + alien.width/2 &&
            bullet.y >= alien.y - alien.height/2 &&
            bullet.y <= alien.y + alien.height/2) {
          // Calculate points based on alien's height (more points for higher aliens)
          const points = Math.max(10, Math.floor((this.canvas.height - alien.y) / 50) * 10);
          this.scoreService.increment(points);
          
          // Remove both bullet and alien
          this.bullets.splice(bulletIndex, 1);
          this.aliens.splice(alienIndex, 1);
        }
      });
    });
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.setCanvasSize());
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  startGameLoop() {
    const gameLoop = () => {
      if (!this.isPaused && !this.gameOver) {
        this.update();
      }
      this.draw();
      requestAnimationFrame(gameLoop);
    };
    gameLoop();
  }

  drawPauseScreen() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '40px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('PAUSED', this.canvas.width/2, this.canvas.height/2);
    this.ctx.font = '20px Arial';
    this.ctx.fillText('Press P to resume', this.canvas.width/2, this.canvas.height/2 + 40);
  }

  drawLives() {
    const lifeIconSize = 25;
    const padding = 10;
    const startX = 10;
    const startY = 10;

    for (let i = 0; i < this.lives; i++) {
      this.ctx.drawImage(
        this.sprites.player,
        startX + (i * (lifeIconSize + padding)),
        startY,
        lifeIconSize,
        lifeIconSize
      );
    }
  }

  update() {
    if (this.gameOver) return;
    
    this.movePlayer();
    this.updateBullets();
    this.updateAliens();
    this.checkCollisions();
    
    this.movePlayer();
    this.updateBullets();
    this.updateAliens();
    this.checkCollisions();
    
    // Only spawn new wave if not in first update and aliens are gone
    if (!this.justSpawned && this.aliens.length === 0) {
      this.spawnAlienWave();
      // Display wave number
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '30px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`Wave ${this.currentWave}`, this.canvas.width/2, this.canvas.height/2);
    }
    
    this.justSpawned = false; // Reset flag after first update
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw game elements if not game over
    if (!this.gameOver) {
      this.ctx.drawImage(
        this.sprites.player,
        this.player.x - this.player.width/2,
        this.player.y - this.player.height/2,
        this.player.width,
        this.player.height
      );
      
      this.aliens.forEach(alien => {
        this.ctx.drawImage(
          this.sprites.aliens[alien.type],
          alien.x - 25,
          alien.y - 25,
          50,
          50
        );
      });

      this.bullets.forEach(bullet => {
        this.ctx.fillStyle = '#ff0000';
        this.ctx.fillRect(bullet.x - 2, bullet.y - 10, 4, 20);
      });
    }

    // Always draw HUD
    this.drawLives();
    this.showSoundStatus();
    
    // Draw pause screen if paused
    if (this.isPaused) {
      this.drawPauseScreen();
    }

    // Draw game over screen
    if (this.gameOver) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = '#ff0000';
      this.ctx.font = '40px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('GAME OVER', this.canvas.width/2, this.canvas.height/2);
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '20px Arial';
      this.ctx.fillText(`Final Score: ${this.scoreService.currentScore}`, this.canvas.width/2, this.canvas.height/2 + 40);
      this.ctx.fillText('Refresh to play again', this.canvas.width/2, this.canvas.height/2 + 80);
    }
  }

  movePlayer() {
    if (this.player.isMovingLeft && this.player.x > this.player.width/2) {
      this.player.x -= this.player.speed;
    }
    if (this.player.isMovingRight && this.player.x < this.canvas.width - this.player.width/2) {
      this.player.x += this.player.speed;
    }
  }

  handleKeyDown(e) {
    if (this.gameOver) return;
    
    if (e.key === 'p' || e.key === 'P') {
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        this.drawPauseScreen();
      }
      return;
    }

    if (e.key === 'm' || e.key === 'M') {
      this.toggleMute();
      return;
    }
    
    if (this.isPaused) return;
    
    if (e.key === 'ArrowLeft') this.player.isMovingLeft = true;
    if (e.key === 'ArrowRight') this.player.isMovingRight = true;
    if (e.key === ' ') this.fireBullet();
  }

  handleKeyUp(e) {
    if (e.key === 'ArrowLeft') this.player.isMovingLeft = false;
    if (e.key === 'ArrowRight') this.player.isMovingRight = false;
  }

  fireBullet() {
    this.bullets.push({
      x: this.player.x,
      y: this.player.y - 40,
      speed: 10
    });
  }

  spawnAlienWave() {
    const cols = Math.min(8 + Math.floor(this.currentWave / 2), 12); // More columns with each wave, max 12
    const rows = Math.min(2 + Math.floor(this.currentWave / 3), 5);  // Start with 2 rows, max 5
    const alienWidth = 50;  // Width of each alien
    const alienHeight = 50; // Height of each alien
    const horizontalPadding = 20; // Minimum space between aliens
    const verticalPadding = 20;   // Minimum space between rows
    
    // Calculate spacing to evenly distribute aliens across canvas width
    const totalWidth = this.canvas.width * 0.8; // Use 80% of canvas width
    const columnSpacing = Math.max((totalWidth - (cols * alienWidth)) / (cols - 1) + alienWidth, alienWidth + horizontalPadding);
    const rowSpacing = alienHeight + verticalPadding;
    
    // Center the formation horizontally
    const formationWidth = (cols - 1) * columnSpacing + alienWidth;
    const startX = (this.canvas.width - formationWidth) / 2;
    const startY = 50;
    
    // Increase speed with each wave
    const alienSpeed = 2 + (this.currentWave * 0.5);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this.aliens.push({
          x: startX + (col * columnSpacing) + (alienWidth / 2),
          y: startY + (row * rowSpacing) + (alienHeight / 2),
          type: Math.random() > 0.5 ? 0 : 1,
          speed: alienSpeed,
          width: alienWidth,
          height: alienHeight,
          direction: 1
        });
      }
    }
    
    this.currentWave++;
  }

  updateBullets() {
    this.bullets = this.bullets.filter(bullet => {
      bullet.y -= bullet.speed;
      return bullet.y > 0;
    });
  }

  updateAliens() {
    if (this.gameOver) return;
    
    let shouldChangeDirection = false;
    const bottomLimit = this.canvas.height - 100;
    
    // First check if any alien would hit the boundaries
    this.aliens.forEach(alien => {
      const nextX = alien.x + (alien.speed * alien.direction);
      if (nextX > this.canvas.width - alien.width || nextX < alien.width) {
        shouldChangeDirection = true;
      }
    });
    
    // Then update all aliens together
    this.aliens.forEach(alien => {
      if (shouldChangeDirection) {
        alien.direction *= -1;
        alien.y += 30;
      }
      alien.x += alien.speed * alien.direction;
    });

    // Check for aliens reaching bottom and remove them
    this.aliens = this.aliens.filter(alien => {
      if (alien.y >= bottomLimit) {
        this.lives--;
        if (this.lives <= 0) {
          this.gameOver = true;
        }
        return false;
      }
      return true;
    });
  }
}