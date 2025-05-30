import { Component, HostListener, OnInit, OnDestroy, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

// Define the Zombie interface
interface Zombie {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  type: string; // e.g., 'normal', 'brute', 'runner'
  speedFactor: number; // Multiplier for base zombieSpeed
  scoreValue: number;
}

// Define Bullet interface
interface Bullet {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speedX: number;
  speedY: number;
  damage: number; // Added damage to bullet
}

// Define Weapon interface
interface Weapon {
  id: string;
  name: string;
  bulletBaseSpeed: number;
  shootCooldown: number;
  bulletDamage: number;
  bulletWidth: number;
  bulletHeight: number;
  // For shotgun type
  bulletCount?: number; // Number of pellets per shot
  spreadAngle?: number; // Max spread angle in degrees for pellets
  // For future use:
  // ammoCapacity?: number;
  // reloadTime?: number;
  cost?: number; // Cost to acquire this weapon
  acquired: boolean; // Whether the player has this weapon
}

// Define Zombie Types
interface ZombieTypeStats {
  type: string;
  maxHp: number;
  speedFactor: number; // How much this type modifies base zombieSpeed
  scoreValue: number;
  width?: number; // Optional: if types have different sizes
  height?: number; // Optional
  // color?: string; // Optional: for styling based on type
}

const ZOMBIE_TYPES: ZombieTypeStats[] = [
  {
    type: 'normal',
    maxHp: 20,
    speedFactor: 1.0,
    scoreValue: 10,
  },
  {
    type: 'runner', // Faster but less HP
    maxHp: 15,
    speedFactor: 1.5,
    scoreValue: 15,
    // width: 25, height: 25 // Potentially smaller
  },
  {
    type: 'brute', // Slower but more HP
    maxHp: 40,
    speedFactor: 0.7,
    scoreValue: 25,
    // width: 35, height: 35 // Potentially larger
  },
];

// Define available weapons
const AVAILABLE_WEAPONS: Weapon[] = [
  {
    id: 'pistol',
    name: 'Pistol',
    bulletBaseSpeed: 15,
    shootCooldown: 400, // Slightly slower than previous base for pistol
    bulletDamage: 10,
    bulletWidth: 5,
    bulletHeight: 15,
    acquired: true, // Player starts with pistol
    cost: 0,
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    bulletBaseSpeed: 12, // Pellets might be slightly slower but more of them
    shootCooldown: 700,
    bulletDamage: 7, // Each pellet does less damage, but multiple pellets
    bulletWidth: 7, // Pellets slightly wider
    bulletHeight: 7,
    bulletCount: 5,
    spreadAngle: 30, // Degrees
    acquired: false,
    cost: 200, // Cost to acquire shotgun
  },
  // Add more weapons here later e.g. Machine Gun
  // {
  //   id: 'machinegun',
  //   name: 'Machine Gun',
  //   bulletBaseSpeed: 20,
  //   shootCooldown: 100,
  //   bulletDamage: 5,
  //   bulletWidth: 4,
  //   bulletHeight: 12,
  //   acquired: false,
  //   cost: 350,
  // }
];

@Component({
  selector: 'app-zombie-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './zombie-game.component.html',
  styleUrls: ['./zombie-game.component.css']
})
export class ZombieGameComponent implements OnInit, OnDestroy {
  // Player Stats
  playerX: number = 50;
  playerY: number = 50;
  basePlayerSpeed: number = 4; // Reduced base player speed
  playerSpeed: number = this.basePlayerSpeed; // Actual speed, can be upgraded
  playerWidth: number = 30;
  playerHeight: number = 30;
  playerLives: number = 3; // Player lives
  score: number = 0; // Player score
  playerFacingDirection: 'up' | 'down' | 'left' | 'right' = 'up'; // Added player facing direction

  // Game Area
  gameAreaWidth: number = 600;
  gameAreaHeight: number = 400;

  // Zombie Stats
  zombies: Zombie[] = [];
  baseZombieWidth: number = 30; // Base size, can be overridden by type
  baseZombieHeight: number = 30; // Base size
  baseZombieSpeed: number = 1.2; // Adjusted base speed for all zombies, types will modify this
  initialZombieCount: number = 3; // Number of zombies to spawn at the start
  private nextZombieId: number = 0;

  // Bullet Stats - some will be derived from currentWeapon
  bullets: Bullet[] = [];
  private nextBulletId: number = 0;

  // Weapon System
  playerWeapons: Weapon[] = JSON.parse(JSON.stringify(AVAILABLE_WEAPONS)); // Deep copy to allow modification of 'acquired'
  currentWeaponIndex: number = 0;
  currentWeapon: Weapon = this.playerWeapons[this.currentWeaponIndex];

  private canShoot: boolean = true;
  private shootCooldownTimeout: any;

  // Upgrade System Properties (will now apply multiplicatively or additively to currentWeapon stats if applicable)
  // Or, some upgrades might be weapon-specific later. For now, let's keep them general.
  // Player Speed Upgrade
  playerSpeedLevel: number = 1;
  playerSpeedUpgradeCost: number = 50;
  playerSpeedIncreaseFactor: number = 1.2;

  // Bullet Speed Upgrade (Now acts as a multiplier to weapon's base bullet speed)
  bulletSpeedMultiplierLevel: number = 1;
  bulletSpeedMultiplierUpgradeCost: number = 70;
  bulletSpeedMultiplierFactor: number = 1.10; // Smaller factor as it multiplies

  // Fire Rate Upgrade (Now acts as a multiplier to weapon's base fire rate/reduction to cooldown)
  fireRateMultiplierLevel: number = 1;
  fireRateMultiplierUpgradeCost: number = 60;
  fireRateDecreaseFactor: number = 0.92; // Cooldown reduces to 92% of weapon's base

  upgradeCostMultiplier: number = 1.5;

  gameOver: boolean = false; // Game over state

  private pressedKeys: { [key: string]: boolean } = {};
  private gameLoopInterval: any;

  // Store bound event listener functions
  private boundHandleKeyDown: (event: KeyboardEvent) => void;
  private boundHandleKeyUp: (event: KeyboardEvent) => void;

  private isBrowser: boolean;

  constructor(private cdr: ChangeDetectorRef, @Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    // Initialize bound functions in the constructor
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleKeyUp = this.handleKeyUp.bind(this);
    this.initializeWeapons();
  }

  initializeWeapons(): void {
    // Ensure player starts with the first weapon (pistol) and it's marked as acquired.
    // Other weapons' 'acquired' status is as defined in AVAILABLE_WEAPONS.
    this.playerWeapons = JSON.parse(JSON.stringify(AVAILABLE_WEAPONS));
    this.currentWeaponIndex = this.playerWeapons.findIndex(w => w.id === 'pistol');
    if (this.currentWeaponIndex === -1) this.currentWeaponIndex = 0; // Fallback
    this.playerWeapons[this.currentWeaponIndex].acquired = true;
    this.currentWeapon = this.playerWeapons[this.currentWeaponIndex];
  }

  ngOnInit(): void {
    console.log('ZombieGameComponent OnInit');
    this.resetGame(); // Initialize/reset game state

    if (this.isBrowser) {
      window.addEventListener('keydown', this.boundHandleKeyDown);
      window.addEventListener('keyup', this.boundHandleKeyUp);
    }

    // Game loop interval should also ideally only run in browser, 
    // but setInterval itself is available in Node.js. 
    // However, the game logic it triggers might depend on browser features.
    // For now, let's assume resetGame and updateGame are safe or will be made safe.
    if (this.isBrowser) { // Start game loop only in browser
        this.gameLoopInterval = setInterval(() => {
            if (!this.gameOver) {
                this.updateGame();
            }
        }, 16); // Roughly 60 FPS
    }
  }

  ngOnDestroy(): void {
    console.log('ZombieGameComponent OnDestroy');
    if (this.isBrowser) {
      window.removeEventListener('keydown', this.boundHandleKeyDown);
      window.removeEventListener('keyup', this.boundHandleKeyUp);
      if (this.gameLoopInterval) {
        clearInterval(this.gameLoopInterval);
      }
    }
    // shootCooldownTimeout can be cleared regardless of platform as clearTimeout is safe
    if (this.shootCooldownTimeout) { 
        clearTimeout(this.shootCooldownTimeout);
    }
  }

  resetGame(): void {
    this.playerX = 50;
    this.playerY = 50;
    
    // Reset Upgradable Stats to base values
    this.playerSpeed = this.basePlayerSpeed;

    // Reset Upgrade Levels and Costs
    this.playerSpeedLevel = 1;
    this.playerSpeedUpgradeCost = 50;
    this.bulletSpeedMultiplierLevel = 1;
    this.bulletSpeedMultiplierUpgradeCost = 70;
    this.fireRateMultiplierLevel = 1;
    this.fireRateMultiplierUpgradeCost = 60;

    this.playerLives = 5;
    this.score = 0; // Reset score
    this.zombies = [];
    this.bullets = []; // Clear bullets on reset
    this.nextZombieId = 0;
    this.nextBulletId = 0;
    this.gameOver = false;
    this.canShoot = true;
    this.pressedKeys = {}; // Clear pressed keys on reset
    this.playerFacingDirection = 'up'; // Reset facing direction
    this.zombies = []; // Clear existing zombies before spawning new ones
    for (let i = 0; i < this.initialZombieCount; i++) {
      this.spawnZombie(); 
    }
    console.log("Game Reset with", this.initialZombieCount, "initial zombies.");
  }

  spawnZombie(): void {
    if (this.gameOver) return;

    const randomTypeIndex = Math.floor(Math.random() * ZOMBIE_TYPES.length);
    const zombieStats = ZOMBIE_TYPES[randomTypeIndex];

    const newZombieWidth = zombieStats.width || this.baseZombieWidth;
    const newZombieHeight = zombieStats.height || this.baseZombieHeight;

    let spawnX = 0;
    let spawnY = 0;

    const spawnSide = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left

    switch (spawnSide) {
      case 0: // Top
        spawnX = Math.random() * (this.gameAreaWidth - newZombieWidth);
        spawnY = 0 - newZombieHeight;
        break;
      case 1: // Right
        spawnX = this.gameAreaWidth;
        spawnY = Math.random() * (this.gameAreaHeight - newZombieHeight);
        break;
      case 2: // Bottom
        spawnX = Math.random() * (this.gameAreaWidth - newZombieWidth);
        spawnY = this.gameAreaHeight;
        break;
      case 3: // Left
        spawnX = 0 - newZombieWidth;
        spawnY = Math.random() * (this.gameAreaHeight - newZombieHeight);
        break;
    }

    const newZombie: Zombie = {
      id: this.nextZombieId++,
      x: spawnX,
      y: spawnY,
      width: newZombieWidth,
      height: newZombieHeight,
      hp: zombieStats.maxHp,
      maxHp: zombieStats.maxHp,
      type: zombieStats.type,
      speedFactor: zombieStats.speedFactor,
      scoreValue: zombieStats.scoreValue,
    };
    
    // Optional: Add a small safety margin check again if needed, 
    // but spawning directly from edges might be fine.
    // For very fast player/zombies, spawning too close to player even from edge might be an issue.
    // Consider if player is near an edge when a zombie spawns on that edge.

    this.zombies.push(newZombie);
    // console.log(`Spawned ${newZombie.type} zombie from side ${spawnSide}:`, newZombie);
  }

  getApplicableBulletSpeed(): number {
    return this.currentWeapon.bulletBaseSpeed * Math.pow(this.bulletSpeedMultiplierFactor, this.bulletSpeedMultiplierLevel - 1);
  }

  getApplicableShootCooldown(): number {
    let cooldown = this.currentWeapon.shootCooldown * Math.pow(this.fireRateDecreaseFactor, this.fireRateMultiplierLevel - 1);
    return Math.max(cooldown, 50); // Ensure minimum cooldown
  }

  shootBullet(): void {
    if (!this.canShoot || this.gameOver) return;

    const weapon = this.currentWeapon;
    const bulletSpeed = this.getApplicableBulletSpeed();
    const pellets = weapon.bulletCount || 1;
    const spread = weapon.spreadAngle || 0; // Degrees

    for (let i = 0; i < pellets; i++) {
      let angleOffset = 0;
      if (pellets > 1 && spread > 0) {
        // Calculate spread for multiple pellets
        // Simple even spread: angleOffset = (i - (pellets - 1) / 2) * (spread / (pellets > 1 ? pellets -1 : 1) ); // this was a bit complex
        angleOffset = (Math.random() - 0.5) * spread; 
      }

      let bulletX = 0;
      let bulletY = 0;
      let speedX = 0;
      let speedY = 0;
      let currentBulletWidth = weapon.bulletWidth;
      let currentBulletHeight = weapon.bulletHeight;

      let baseSpeedX = 0;
      let baseSpeedY = 0;

      switch (this.playerFacingDirection) {
        case 'up':
          bulletX = this.playerX + (this.playerWidth / 2) - (currentBulletWidth / 2);
          bulletY = this.playerY - currentBulletHeight;
          baseSpeedY = -bulletSpeed;
          break;
        case 'down':
          bulletX = this.playerX + (this.playerWidth / 2) - (currentBulletWidth / 2);
          bulletY = this.playerY + this.playerHeight;
          baseSpeedY = bulletSpeed;
          break;
        case 'left':
          currentBulletWidth = weapon.bulletHeight; // Swap for horizontal
          currentBulletHeight = weapon.bulletWidth;
          bulletX = this.playerX - currentBulletWidth;
          bulletY = this.playerY + (this.playerHeight / 2) - (currentBulletHeight / 2);
          baseSpeedX = -bulletSpeed;
          break;
        case 'right':
          currentBulletWidth = weapon.bulletHeight; // Swap for horizontal
          currentBulletHeight = weapon.bulletWidth;
          bulletX = this.playerX + this.playerWidth;
          bulletY = this.playerY + (this.playerHeight / 2) - (currentBulletHeight / 2);
          baseSpeedX = bulletSpeed;
          break;
      }

      // Apply spread angle if any
      if (angleOffset !== 0) {
        const angleInRadians = angleOffset * (Math.PI / 180);
        // If primarily moving along Y (up/down shots)
        if (baseSpeedY !== 0) {
            speedX = baseSpeedY * Math.sin(angleInRadians); // sin for perpendicular component
            speedY = baseSpeedY * Math.cos(angleInRadians); // cos for main component
        } 
        // If primarily moving along X (left/right shots)
        else if (baseSpeedX !== 0) {
            speedX = baseSpeedX * Math.cos(angleInRadians); // cos for main component
            speedY = baseSpeedX * Math.sin(angleInRadians); // sin for perpendicular component
        }
      } else {
        speedX = baseSpeedX;
        speedY = baseSpeedY;
      }
      
      const newBullet: Bullet = {
        id: this.nextBulletId++,
        x: bulletX,
        y: bulletY,
        width: currentBulletWidth,
        height: currentBulletHeight,
        speedX: speedX,
        speedY: speedY,
        damage: weapon.bulletDamage,
      };
      this.bullets.push(newBullet);
    } // End of pellet loop

    this.canShoot = false;
    if (this.shootCooldownTimeout) {
      clearTimeout(this.shootCooldownTimeout);
    }
    this.shootCooldownTimeout = setTimeout(() => {
      this.canShoot = true;
    }, this.getApplicableShootCooldown());
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (this.gameOver && event.key.toLowerCase() === 'r') { // Allow reset on 'R' if game over
        this.resetGame();
        return;
    }
    // Handle upgrade keys even if game over, to see costs, but not purchase if no score
    const key = event.key.toLowerCase();
    switch (key) {
        case '1':
            this.tryUpgradePlayerSpeed();
            event.preventDefault();
            return;
        case '2':
            this.tryUpgradeBulletSpeedMultiplier();
            event.preventDefault();
            return;
        case '3':
            this.tryUpgradeFireRateMultiplier();
            event.preventDefault();
            return;
        case '4':
            this.tryAcquireAndEquipWeapon('shotgun');
            event.preventDefault();
            return;
        case 'q':
            this.switchToNextWeapon();
            event.preventDefault();
            return;
    }

    if (this.gameOver) return; // Don't process game input if game is over
    this.pressedKeys[key] = true;

    // Update facing direction based on movement keys, even if not moving yet
    // Prioritize the latest pressed movement key for facing direction
    if (key === 'w') this.playerFacingDirection = 'up';
    else if (key === 's') this.playerFacingDirection = 'down';
    else if (key === 'a') this.playerFacingDirection = 'left';
    else if (key === 'd') this.playerFacingDirection = 'right';

    if (event.key === ' ') { // Spacebar for shooting
      event.preventDefault(); // Prevent page scroll
      this.shootBullet();
    }
  }

  handleKeyUp(event: KeyboardEvent): void {
    this.pressedKeys[event.key.toLowerCase()] = false;
  }

  updateGame(): void {
    if (!this.isBrowser) return; // Prevent game logic from running on server
    this.updatePlayerPosition();
    this.updateZombiesPosition();
    this.updateBulletsPosition();
    this.checkCollisions();
    this.cdr.detectChanges();
  }

  updatePlayerPosition(): void {
    if (this.gameOver) return;
    // console.log('[DEBUG] updatePlayerPosition - pressedKeys:', JSON.stringify(this.pressedKeys)); // Can be too noisy for every frame
    let newX = this.playerX;
    let newY = this.playerY;
    let moved = false;

    if (this.pressedKeys['w']) {
      newY -= this.playerSpeed;
      moved = true;
    }
    if (this.pressedKeys['s']) {
      newY += this.playerSpeed;
      moved = true;
    }
    if (this.pressedKeys['a']) {
      newX -= this.playerSpeed;
      moved = true;
    }
    if (this.pressedKeys['d']) {
      newX += this.playerSpeed;
      moved = true;
    }

    if (moved) {
      const oldX = this.playerX;
      const oldY = this.playerY;
      this.playerX = Math.max(0, Math.min(newX, this.gameAreaWidth - this.playerWidth));
      this.playerY = Math.max(0, Math.min(newY, this.gameAreaHeight - this.playerHeight));
      console.log(`[DEBUG] Player Moved from (${oldX},${oldY}) to (${this.playerX},${this.playerY}) because of keys: ${JSON.stringify(this.pressedKeys)}`);
    } else {
      // Optional: Log if no movement keys are pressed but function is called
      // if (Object.values(this.pressedKeys).some(v => v)) { 
      //   console.log('[DEBUG] updatePlayerPosition - No WASD movement, pressedKeys:', JSON.stringify(this.pressedKeys));
      // }
    }
    
    this.cdr.detectChanges(); // Manually trigger change detection
  }

  updateZombiesPosition(): void {
    if (this.gameOver) return;
    this.zombies.forEach(zombie => {
      const effectiveZombieSpeed = this.baseZombieSpeed * zombie.speedFactor;

      const dx = this.playerX + (this.playerWidth / 2) - (zombie.x + (zombie.width / 2));
      const dy = this.playerY + (this.playerHeight / 2) - (zombie.y + (zombie.height / 2));
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        const moveX = (dx / distance) * effectiveZombieSpeed;
        const moveY = (dy / distance) * effectiveZombieSpeed;
        zombie.x += moveX;
        zombie.y += moveY;
        zombie.x = Math.max(0, Math.min(zombie.x, this.gameAreaWidth - zombie.width));
        zombie.y = Math.max(0, Math.min(zombie.y, this.gameAreaHeight - zombie.height));
      }
    });
  }

  updateBulletsPosition(): void {
    if (this.gameOver) return;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.x += bullet.speedX;
      bullet.y += bullet.speedY;

      // Remove bullet if it goes off screen (any side)
      if (bullet.x + bullet.width < 0 || 
          bullet.x > this.gameAreaWidth || 
          bullet.y + bullet.height < 0 || 
          bullet.y > this.gameAreaHeight) {
        this.bullets.splice(i, 1);
      }
    }
  }

  checkCollisions(): void {
    if (this.gameOver) return;
    // Player-Zombie collisions
    this.zombies.forEach((zombie, zIndex) => {
      if (this.isColliding(this.playerX, this.playerY, this.playerWidth, this.playerHeight, zombie.x, zombie.y, zombie.width, zombie.height)) {
        console.log('Player collision with zombie:', zombie.id);
        this.playerLives--;
        this.zombies.splice(zIndex, 1); 
        this.spawnZombie(); 

        if (this.playerLives <= 0) {
          this.gameOver = true;
          console.log('Game Over!');
        }
        return; // Process one player-zombie collision per frame to avoid issues
      }
    });

    // Bullet-Zombie collisions
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      for (let j = this.zombies.length - 1; j >= 0; j--) {
        const zombie = this.zombies[j];
        if (this.isColliding(bullet.x, bullet.y, bullet.width, bullet.height, zombie.x, zombie.y, zombie.width, zombie.height)) {
          console.log('Bullet hit zombie:', zombie.id);
          zombie.hp -= bullet.damage;
          if (zombie.hp <= 0) {
            this.score += zombie.scoreValue;
            this.zombies.splice(j, 1); // Remove zombie
            this.spawnZombie(); // Spawn a new zombie
          }
          this.bullets.splice(i, 1); // Remove bullet
          break; // Stop checking this bullet against other zombies
        }
      }
    }
  }

  // Helper function for AABB collision detection
  isColliding(x1: number, y1: number, w1: number, h1: number, 
              x2: number, y2: number, w2: number, h2: number): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  // Upgrade Methods
  tryUpgradePlayerSpeed(): void {
    if (this.score >= this.playerSpeedUpgradeCost && !this.gameOver) {
      this.score -= this.playerSpeedUpgradeCost;
      this.playerSpeed *= this.playerSpeedIncreaseFactor;
      this.playerSpeedLevel++;
      this.playerSpeedUpgradeCost = Math.floor(this.playerSpeedUpgradeCost * this.upgradeCostMultiplier);
      console.log(`Player speed upgraded to level ${this.playerSpeedLevel}. New speed: ${this.playerSpeed.toFixed(2)}`);
    } else if (this.gameOver) {
        console.log(`Cannot upgrade: Game Over. Cost: ${this.playerSpeedUpgradeCost}`);
    } 
    else {
      console.log(`Not enough score to upgrade player speed. Need ${this.playerSpeedUpgradeCost}, have ${this.score}`);
    }
  }

  tryUpgradeBulletSpeedMultiplier(): void {
    if (this.score >= this.bulletSpeedMultiplierUpgradeCost && !this.gameOver) {
      this.score -= this.bulletSpeedMultiplierUpgradeCost;
      this.bulletSpeedMultiplierLevel++;
      this.bulletSpeedMultiplierUpgradeCost = Math.floor(this.bulletSpeedMultiplierUpgradeCost * this.upgradeCostMultiplier);
      console.log(`Bullet speed multiplier upgraded to level ${this.bulletSpeedMultiplierLevel}.`);
    } else if (this.gameOver) {
        console.log(`Cannot upgrade: Game Over. Cost: ${this.bulletSpeedMultiplierUpgradeCost}`);
    }
    else {
      console.log(`Not enough score to upgrade bullet speed multiplier. Need ${this.bulletSpeedMultiplierUpgradeCost}, have ${this.score}`);
    }
  }

  tryUpgradeFireRateMultiplier(): void {
    if (this.score >= this.fireRateMultiplierUpgradeCost && !this.gameOver) {
      this.score -= this.fireRateMultiplierUpgradeCost;
      this.fireRateMultiplierLevel++;
      this.fireRateMultiplierUpgradeCost = Math.floor(this.fireRateMultiplierUpgradeCost * this.upgradeCostMultiplier);
      console.log(`Fire rate multiplier upgraded to level ${this.fireRateMultiplierLevel}.`);
    } else if (this.gameOver) {
        console.log(`Cannot upgrade: Game Over. Cost: ${this.fireRateMultiplierUpgradeCost}`);
    }
    else {
      console.log(`Not enough score to upgrade fire rate multiplier. Need ${this.fireRateMultiplierUpgradeCost}, have ${this.score}`);
    }
  }

  // Weapon System Methods
  switchToNextWeapon(): void {
    if (this.playerWeapons.filter(w => w.acquired).length < 2) {
        console.log("Not enough acquired weapons to switch.");
        return; // No other acquired weapon to switch to
    }
    let nextIndex = this.currentWeaponIndex;
    do {
        nextIndex = (nextIndex + 1) % this.playerWeapons.length;
    } while (!this.playerWeapons[nextIndex].acquired);
    
    this.currentWeaponIndex = nextIndex;
    this.currentWeapon = this.playerWeapons[this.currentWeaponIndex];
    // Clear any existing shoot cooldown when switching weapons
    if (this.shootCooldownTimeout) {
        clearTimeout(this.shootCooldownTimeout);
    }
    this.canShoot = true; // Allow immediate shot with new weapon if cooldown permits
    console.log(`Switched to weapon: ${this.currentWeapon.name}`);
  }

  tryAcquireAndEquipWeapon(weaponId: string): void {
    const weaponToAcquire = this.playerWeapons.find(w => w.id === weaponId);
    if (!weaponToAcquire) {
      console.log(`Weapon ${weaponId} not found in available weapons.`);
      return;
    }

    if (weaponToAcquire.acquired) {
      // If already acquired, switch to it
      this.currentWeaponIndex = this.playerWeapons.findIndex(w => w.id === weaponId);
      this.currentWeapon = this.playerWeapons[this.currentWeaponIndex];
      console.log(`Switched to already acquired weapon: ${this.currentWeapon.name}`);
      if (this.shootCooldownTimeout) clearTimeout(this.shootCooldownTimeout);
      this.canShoot = true;
      return;
    }

    if (this.score >= weaponToAcquire.cost! && !this.gameOver) {
      this.score -= weaponToAcquire.cost!;
      weaponToAcquire.acquired = true;
      this.currentWeaponIndex = this.playerWeapons.findIndex(w => w.id === weaponId);
      this.currentWeapon = this.playerWeapons[this.currentWeaponIndex];
      console.log(`Acquired and equipped: ${this.currentWeapon.name}`);
      if (this.shootCooldownTimeout) clearTimeout(this.shootCooldownTimeout);
      this.canShoot = true;
    } else if (this.gameOver){
      console.log(`Cannot acquire ${weaponToAcquire.name}: Game Over. Cost: ${weaponToAcquire.cost}`);
    } else {
      console.log(`Not enough score to acquire ${weaponToAcquire.name}. Need ${weaponToAcquire.cost}, have ${this.score}`);
    }
  }

  // For HTML display
  get currentBulletSpeedDisplayMultiplier(): string {
    return Math.pow(this.bulletSpeedMultiplierFactor, this.bulletSpeedMultiplierLevel - 1).toFixed(2);
  }

  get currentFireRateDisplayMultiplier(): string {
    // Effectively, how many times faster the fire rate is.
    // If factor is 0.9 (90% cooldown), multiplier is 1/0.9 = 1.11x
    return Math.pow(1 / this.fireRateDecreaseFactor, this.fireRateMultiplierLevel - 1).toFixed(2);
  }
} 