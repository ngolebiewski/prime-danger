import "./style.css";
import * as PIXI from "pixi.js";
import { DebugTilemap } from "./debugTilemap.js";
import {
  FONT_MAP,
  TILE_SIZE,
  TILES_VERTICAL,
  TILES_HORIZONTAL,
} from "./constants.js";
import primes_200 from "./primes_200.js";
import { Player } from "./player.js";

document.querySelector("#app").innerHTML = `<div id="game"></div>`;

const app = new PIXI.Application();

await app.init({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0x222222,
  resizeTo: window,
  antialias: false,
  roundPixels: true,
});

document.querySelector("#game").appendChild(app.canvas);

// Load assets
PIXI.Assets.add({ alias: "tilemap", src: "./art/monochrome-transparent_packed.png" });
PIXI.Assets.add({ alias: "runeBlack", src: "./art/runeBlack_slabOutline_035.png" });
PIXI.Assets.add({ alias: "runeBlue", src: "./art/runeBlue_slabOutline_035.png" });
PIXI.Assets.add({ alias: "runeGrey", src: "./art/runeGrey_slabOutline_036.png" });

const loadedAssets = await PIXI.Assets.load(["tilemap", "runeBlack", "runeBlue", "runeGrey"]);
const texture = loadedAssets.tilemap;
const runeBlack = loadedAssets.runeBlack;
const runeBlue = loadedAssets.runeBlue;
const runeGrey = loadedAssets.runeGrey;

[texture, runeBlack, runeBlue, runeGrey].forEach((t) => (t.source.scaleMode = "nearest"));

// Debug tilemap
const debugTilemap = new DebugTilemap(app, texture, TILE_SIZE, TILES_HORIZONTAL, TILES_VERTICAL, 1.5);

// Helper functions
function getTileIndex(char) {
  return FONT_MAP[char.toUpperCase()] || null;
}

function getFactors(num) {
  const factors = [];
  for (let i = 2; i <= Math.sqrt(num); i++) {
    if (num % i === 0) {
      factors.push(i);
      if (i !== num / i) {
        factors.push(num / i);
      }
    }
  }
  return factors.sort((a, b) => a - b);
}

function drawText(text, startX, startY, scale = 2, color = 0xffffff, container = app.stage) {
  const chars = text.toUpperCase().split("");
  const spacing = TILE_SIZE * scale;
  const textSprites = [];

  chars.forEach((char, i) => {
    const tileIndex = getTileIndex(char);
    if (tileIndex === null) return;

    const x = tileIndex % TILES_HORIZONTAL;
    const y = Math.floor(tileIndex / TILES_HORIZONTAL);

    const tileTexture = new PIXI.Texture({
      source: texture.source,
      frame: new PIXI.Rectangle(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE),
    });

    const sprite = new PIXI.Sprite(tileTexture);
    sprite.x = startX + i * spacing;
    sprite.y = startY;
    sprite.scale.set(scale);
    sprite.tint = color;
    container.addChild(sprite);
    textSprites.push(sprite);
  });

  return textSprites;
}

// Game state
const GAME_STATE = {
  TITLE: "title",
  PLAYING: "playing",
  ROUND_END: "round_end",
  GAME_OVER: "game_over",
};

class Game {
  constructor() {
    this.state = GAME_STATE.TITLE;
    this.player = new Player();
    this.round = 0;
    this.maxRounds = 10;
    this.currentNumbers = [];
    this.primeIndex = -1;
    this.runes = [];
    this.runeNumbers = [];
    this.runeContainer = new PIXI.Container();
    this.groundContainer = new PIXI.Container();
    this.uiContainer = new PIXI.Container();
    this.titleContainer = new PIXI.Container();
    this.shakeContainer = new PIXI.Container();
    
    // Add containers in order
    app.stage.addChild(this.shakeContainer);
    this.shakeContainer.addChild(this.groundContainer);
    this.shakeContainer.addChild(this.runeContainer);
    app.stage.addChild(this.uiContainer);
    app.stage.addChild(this.titleContainer);

    this.setupInput();
    this.showTitle();
  }

  setupInput() {
    window.addEventListener("keydown", (e) => {
      if (this.state === GAME_STATE.TITLE && (e.key === "Enter" || e.key === " ")) {
        this.startGame();
      } else if (this.state === GAME_STATE.PLAYING) {
        if (e.key === "1") this.selectRune(0);
        if (e.key === "2") this.selectRune(1);
        if (e.key === "3") this.selectRune(2);
        if (e.key === "4") this.selectRune(3);
      } else if (this.state === GAME_STATE.GAME_OVER && (e.key === "Enter" || e.key === " ")) {
        this.resetGame();
      }
    });
  }

  showTitle() {
    this.titleContainer.removeChildren();
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    drawText("PRIME DANGER", centerX - 200, centerY - 100, 5, 0x00ff00, this.titleContainer);
    drawText("PRESS ENTER TO START", centerX - 250, centerY + 50, 3, 0xffff00, this.titleContainer);
    drawText("FIND THE PRIMES", centerX - 200, centerY + 120, 2, 0xffffff, this.titleContainer);
  }

  startGame() {
    this.state = GAME_STATE.PLAYING;
    this.round = 0;
    this.player.score = 0;
    this.player.foundPrimes = {};
    this.player.missedPrimes = {};
    this.titleContainer.removeChildren();
    this.groundContainer.removeChildren();
    this.nextRound();
  }

  resetGame() {
    this.state = GAME_STATE.TITLE;
    this.runeContainer.removeChildren();
    this.uiContainer.removeChildren();
    this.groundContainer.removeChildren();
    this.runes = [];
    this.runeNumbers = [];
    this.showTitle();
  }

  nextRound() {
    if (this.round >= this.maxRounds) {
      this.endGame();
      return;
    }

    this.round++;
    this.runeContainer.removeChildren();
    this.uiContainer.removeChildren();
    this.generateNumbers();
    this.createRunes();
    this.updateUI();
  }

  generateNumbers() {
    this.currentNumbers = [];
    
    // Get a random prime from the list
    const randomPrime = primes_200[Math.floor(Math.random() * primes_200.length)];
    this.primeIndex = Math.floor(Math.random() * 4);
    
    // Generate 3 non-prime numbers
    const nonPrimes = [];
    while (nonPrimes.length < 3) {
      const num = Math.floor(Math.random() * 200) + 1;
      if (!primes_200.includes(num) && !nonPrimes.includes(num)) {
        nonPrimes.push(num);
      }
    }
    
    // Insert numbers with prime at the correct index
    for (let i = 0; i < 4; i++) {
      if (i === this.primeIndex) {
        this.currentNumbers.push(randomPrime);
      } else {
        this.currentNumbers.push(nonPrimes.shift());
      }
    }
  }

  createRunes() {
    const spacing = 250;
    const startX = (window.innerWidth - (spacing * 3)) / 2;
    const startY = window.innerHeight / 2 - 100;

    this.runes = [];
    this.runeNumbers = [];

    for (let i = 0; i < 4; i++) {
      const rune = new PIXI.Sprite(runeBlack);
      rune.x = startX + i * spacing;
      rune.y = startY;
      rune.scale.set(3); // Bigger runes!
      rune.anchor.set(0.5);
      rune.eventMode = 'static'; // Enable for touch
      rune.cursor = "pointer";
      rune.runeIndex = i;

      rune.on("pointerdown", () => this.selectRune(i));

      this.runeContainer.addChild(rune);
      this.runes.push(rune);

      // Draw number on rune (centered)
      const numStr = this.currentNumbers[i].toString();
      const numSprites = drawText(numStr, rune.x - (numStr.length * 24), rune.y - 15, 3, 0xffffff, this.runeContainer);
      this.runeNumbers.push({ sprites: numSprites, index: i });
    }
  }

  selectRune(index) {
    if (this.state !== GAME_STATE.PLAYING) return;

    const isCorrect = index === this.primeIndex;
    
    if (isCorrect) {
      this.player.updateScore(10);
      this.player.foundPrimes[this.currentNumbers[index]] = true;
      
      // Change prime number to green
      this.runeNumbers[this.primeIndex].sprites.forEach(s => s.tint = 0x00ff00);
      
      // Change to blue rune
      this.runes[index].texture = runeBlue;
    } else {
      this.player.missedPrimes[this.currentNumbers[this.primeIndex]] = true;
      
      // Show correct answer in yellow
      this.runeNumbers[this.primeIndex].sprites.forEach(s => s.tint = 0xffff00);
      this.runes[this.primeIndex].texture = runeBlue;
      
      // Show wrong answer in red
      this.runeNumbers[index].sprites.forEach(s => s.tint = 0xff0000);
      this.runes[index].texture = runeGrey;
      
      // Show factors of the wrong number in blue
      const factors = getFactors(this.currentNumbers[index]);
      if (factors.length > 0) {
        const factorText = factors.join(" X ");
        const rune = this.runes[index];
        drawText(factorText, rune.x - (factorText.length * 8), rune.y + 60, 2, 0x00aaff, this.runeContainer);
      }
      
      // SHAKE THE SCREEN!
      this.shakeScreen();
    }

    // Animate runes falling
    this.animateRunesFall();
  }

  shakeScreen() {
    const shakeIntensity = 15;
    const shakeDuration = 400;
    const startTime = Date.now();

    const shake = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / shakeDuration;

      if (progress < 1) {
        this.shakeContainer.x = (Math.random() - 0.5) * shakeIntensity * (1 - progress);
        this.shakeContainer.y = (Math.random() - 0.5) * shakeIntensity * (1 - progress);
        requestAnimationFrame(shake);
      } else {
        this.shakeContainer.x = 0;
        this.shakeContainer.y = 0;
      }
    };

    shake();
  }

  animateRunesFall() {
    const duration = 800;
    const startTime = Date.now();
    const groundY = window.innerHeight - 100;
    const initialPositions = this.runes.map(r => ({ x: r.x, y: r.y }));

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * progress; // Ease in

      this.runes.forEach((rune, i) => {
        rune.y = initialPositions[i].y + (groundY - initialPositions[i].y) * easeProgress;
        
        // Update number positions
        const numStr = this.currentNumbers[i].toString();
        this.runeNumbers[i].sprites.forEach((sprite, j) => {
          sprite.x = rune.x - (numStr.length * 24) + (j * 48);
          sprite.y = rune.y - 15;
        });
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Move runes to ground container
        this.runes.forEach((rune, i) => {
          this.groundContainer.addChild(rune);
          this.runeNumbers[i].sprites.forEach(s => this.groundContainer.addChild(s));
        });
        
        setTimeout(() => this.nextRound(), 1000);
      }
    };

    animate();
  }

  updateUI() {
    this.uiContainer.removeChildren();
    
    drawText(`ROUND ${this.round} OF ${this.maxRounds}`, 20, 20, 2, 0xffffff, this.uiContainer);
    drawText(`SCORE ${this.player.score}`, 20, 60, 2, 0x00ff00, this.uiContainer);
    drawText("PRESS 1 2 3 4 OR TAP TO SELECT", 20, window.innerHeight - 60, 2, 0xffff00, this.uiContainer);
  }

  endGame() {
    this.state = GAME_STATE.GAME_OVER;
    this.runeContainer.removeChildren();
    this.uiContainer.removeChildren();

    const centerX = window.innerWidth / 2;
    let yPos = 50;

    drawText("GAME OVER", centerX - 150, yPos, 5, 0xff0000, this.uiContainer);
    yPos += 100;
    
    drawText(`FINAL SCORE ${this.player.score}`, centerX - 200, yPos, 3, 0x00ff00, this.uiContainer);
    yPos += 80;

    // Show found primes
    const foundList = Object.keys(this.player.foundPrimes).join(" ");
    if (foundList) {
      drawText("FOUND", centerX - 100, yPos, 2, 0x00ff00, this.uiContainer);
      yPos += 40;
      const lines = this.wrapText(foundList, 15);
      lines.forEach(line => {
        drawText(line, centerX - 200, yPos, 2, 0xffffff, this.uiContainer);
        yPos += 35;
      });
      yPos += 20;
    }

    // Show missed primes
    const missedList = Object.keys(this.player.missedPrimes).join(" ");
    if (missedList) {
      drawText("MISSED", centerX - 120, yPos, 2, 0xff0000, this.uiContainer);
      yPos += 40;
      const lines = this.wrapText(missedList, 15);
      lines.forEach(line => {
        drawText(line, centerX - 200, yPos, 2, 0xffaa00, this.uiContainer);
        yPos += 35;
      });
      yPos += 20;
    }

    drawText("PRESS ENTER TO PLAY AGAIN", centerX - 300, window.innerHeight - 100, 2, 0xffff00, this.uiContainer);
  }

  wrapText(text, maxWords) {
    const words = text.split(" ");
    const lines = [];
    for (let i = 0; i < words.length; i += maxWords) {
      lines.push(words.slice(i, i + maxWords).join(" "));
    }
    return lines;
  }
}

// Start the game
const game = new Game();