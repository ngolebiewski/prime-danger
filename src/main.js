import "./style.css";
import * as PIXI from "pixi.js";
import Matter from "matter-js";
import { DebugTilemap } from "./debugTilemap.js";
import {
  FONT_MAP,
  TILE_SIZE,
  TILES_VERTICAL,
  TILES_HORIZONTAL,
} from "./constants.js";
import primes_200 from "./primes_200.js";
import { Player } from "./player.js";

console.log('🚀 Main.js loaded');

async function initGame() {
document.querySelector("#app").innerHTML = `<div id="game"></div>`;

const app = new PIXI.Application();

await app.init({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0x222222,
  resizeTo: window,
  antialias: false,
  roundPixels: true,
  preference: 'high-performance',
});


console.log('✨ PIXI App Initialized');
document.querySelector("#game").style.backgroundColor = "red"; // Temporarily turn the background red
document.querySelector("#game").appendChild(app.canvas); 


// Matter.js setup
const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;

const engine = Engine.create();
engine.gravity.y = 2;

// Create ground
const ground = Bodies.rectangle(
  window.innerWidth / 2,
  window.innerHeight + 50,
  window.innerWidth * 2,
  100,
  { isStatic: true }
);
World.add(engine.world, ground);

// Load assets
PIXI.Assets.add({ alias: "tilemap", src: "/art/monochrome-transparent_packed.png" });
PIXI.Assets.add({ alias: "runeBlack", src: "/art/runeBlack_slabOutline_035.png" });
PIXI.Assets.add({ alias: "runeBlue", src: "/art/runeBlue_slabOutline_035.png" });
PIXI.Assets.add({ alias: "runeGrey", src: "/art/runeGrey_slabOutline_036.png" });

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

function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

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
    this.maxRounds = 7;
    this.currentNumbers = [];
    this.primeIndex = -1;
    this.runes = [];
    this.runeNumbers = [];
    this.physicsObjects = [];
    this.fallenRunes = []; // Track runes that have fallen
    this.runeContainer = new PIXI.Container();
    this.groundContainer = new PIXI.Container();
    this.uiContainer = new PIXI.Container();
    this.titleContainer = new PIXI.Container();
    this.shakeContainer = new PIXI.Container();
    
    app.stage.addChild(this.shakeContainer);
    this.shakeContainer.addChild(this.groundContainer);
    this.shakeContainer.addChild(this.runeContainer);
    app.stage.addChild(this.uiContainer);
    app.stage.addChild(this.titleContainer);

    this.setupInput();
    this.showTitle();
    
    // Start physics update loop
    app.ticker.add(() => {
      Engine.update(engine, 1000 / 60);
      this.updatePhysics();
    });
    
    window.addEventListener('resize', () => {
      if (this.state === GAME_STATE.TITLE) {
        this.showTitle();
      } else if (this.state === GAME_STATE.PLAYING) {
        this.createRunes();
        this.updateUI();
      } else if (this.state === GAME_STATE.GAME_OVER) {
        this.endGame();
      }
    });
  }

  updatePhysics() {
    this.physicsObjects.forEach(obj => {
      if (obj.sprite && obj.body) {
        obj.sprite.x = obj.body.position.x;
        obj.sprite.y = obj.body.position.y;
        obj.sprite.rotation = obj.body.angle;
        
        // Stop moving rubble after a short time
        if (obj.created && Date.now() - obj.created > 3000) {
          Body.setStatic(obj.body, true);
        }
        
        // Also stop if velocity is very low
        const vel = obj.body.velocity;
        if (Math.abs(vel.x) < 0.1 && Math.abs(vel.y) < 0.1 && Math.abs(obj.body.angularVelocity) < 0.01) {
          Body.setStatic(obj.body, true);
        }
      }
    });
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

    app.canvas.addEventListener("click", (e) => {
      if (this.state === GAME_STATE.TITLE) {
        this.startGame();
      } else if (this.state === GAME_STATE.GAME_OVER) {
        this.resetGame();
      }
    });
  }

  showTitle() {
    this.titleContainer.removeChildren();
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const scale = isPortrait() ? 1.5 : 3;

    // Calculate text widths for proper centering
    const titleText = "PRIME DANGER";
    const titleWidth = titleText.length * TILE_SIZE * scale;
    
    const enterText = "PRESS ENTER";
    const enterWidth = enterText.length * TILE_SIZE * 1;
    
    const startText = "TO START";
    const startWidth = startText.length * TILE_SIZE * 1;
    
    const findText = "FIND THE PRIMES";
    const findWidth = findText.length * TILE_SIZE * 1;

    drawText("PRIME DANGER", centerX - titleWidth / 2, centerY - 100, scale, 0x00ff00, this.titleContainer);
    drawText("PRESS ENTER", centerX - enterWidth / 2, centerY + 50, 1, 0xffff00, this.titleContainer);
    drawText("TO START", centerX - startWidth / 2, centerY + 90, 1, 0xffff00, this.titleContainer);
    drawText("FIND THE PRIMES", centerX - findWidth / 2, centerY + 140, 1, 0xffffff, this.titleContainer);
  }

  startGame() {
    this.state = GAME_STATE.PLAYING;
    this.round = 0;
    this.player.score = 0;
    this.player.foundPrimes = {};
    this.player.missedPrimes = {};
    this.titleContainer.removeChildren();
    this.groundContainer.removeChildren();
    
    // Clear physics objects
    this.physicsObjects.forEach(obj => {
      if (obj.body) World.remove(engine.world, obj.body);
    });
    this.physicsObjects = [];
    this.fallenRunes = [];
    
    this.nextRound();
  }

  resetGame() {
    this.state = GAME_STATE.TITLE;
    this.runeContainer.removeChildren();
    this.uiContainer.removeChildren();
    this.groundContainer.removeChildren();
    this.runes = [];
    this.runeNumbers = [];
    
    // Clear physics objects
    this.physicsObjects.forEach(obj => {
      if (obj.body) World.remove(engine.world, obj.body);
    });
    this.physicsObjects = [];
    this.fallenRunes = [];
    
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
    
    const randomPrime = primes_200[Math.floor(Math.random() * primes_200.length)];
    this.primeIndex = Math.floor(Math.random() * 4);
    
    const nonPrimes = [];
    while (nonPrimes.length < 3) {
      const num = Math.floor(Math.random() * 200) + 1;
      if (!primes_200.includes(num) && !nonPrimes.includes(num)) {
        nonPrimes.push(num);
      }
    }
    
    for (let i = 0; i < 4; i++) {
      if (i === this.primeIndex) {
        this.currentNumbers.push(randomPrime);
      } else {
        this.currentNumbers.push(nonPrimes.shift());
      }
    }
  }

  createRunes() {
    this.runeContainer.removeChildren();
    this.runes = [];
    this.runeNumbers = [];

    const portrait = isPortrait();
    const runeScale = portrait ? 2 : 2.5;
    const textScale = portrait ? 2 : 2.5;
    
    if (portrait) {
      const spacingX = window.innerWidth / 2.5;
      const spacingY = 200;
      const startX = window.innerWidth / 2 - spacingX / 2;
      const startY = window.innerHeight / 2 - spacingY / 2;

      for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        
        const rune = new PIXI.Sprite(runeBlack);
        rune.x = startX + col * spacingX;
        rune.y = startY + row * spacingY;
        rune.scale.set(runeScale);
        rune.anchor.set(0.5);
        rune.eventMode = 'static';
        rune.cursor = "pointer";
        rune.runeIndex = i;

        rune.on("pointerdown", () => this.selectRune(i));
        rune.on("click", () => this.selectRune(i));

        this.runeContainer.addChild(rune);
        this.runes.push(rune);

        const numStr = this.currentNumbers[i].toString();
        const numSprites = drawText(numStr, rune.x - (numStr.length * TILE_SIZE * textScale / 2), rune.y - 12, textScale, 0xffffff, this.runeContainer);
        this.runeNumbers.push({ sprites: numSprites, index: i });
      }
    } else {
      const spacing = Math.min(200, window.innerWidth / 5);
      const startX = (window.innerWidth - (spacing * 3)) / 2;
      const startY = window.innerHeight / 2 - 50;

      for (let i = 0; i < 4; i++) {
        const rune = new PIXI.Sprite(runeBlack);
        rune.x = startX + i * spacing;
        rune.y = startY;
        rune.scale.set(runeScale);
        rune.anchor.set(0.5);
        rune.eventMode = 'static';
        rune.cursor = "pointer";
        rune.runeIndex = i;

        rune.on("pointerdown", () => this.selectRune(i));
        rune.on("click", () => this.selectRune(i));

        this.runeContainer.addChild(rune);
        this.runes.push(rune);

        const numStr = this.currentNumbers[i].toString();
        const numSprites = drawText(numStr, rune.x - (numStr.length * TILE_SIZE * textScale / 2), rune.y - 12, textScale, 0xffffff, this.runeContainer);
        this.runeNumbers.push({ sprites: numSprites, index: i });
      }
    }
  }

  selectRune(index) {
    if (this.state !== GAME_STATE.PLAYING) return;

    const isCorrect = index === this.primeIndex;
    
    if (isCorrect) {
      this.player.updateScore(10);
      this.player.foundPrimes[this.currentNumbers[index]] = true;
      
      this.runeNumbers[this.primeIndex].sprites.forEach(s => s.tint = 0x00ff00);
      this.runes[index].texture = runeBlue;
    } else {
      this.player.missedPrimes[this.currentNumbers[this.primeIndex]] = true;
      
      this.runeNumbers[this.primeIndex].sprites.forEach(s => s.tint = 0x0000ff); //blue
      this.runes[this.primeIndex].texture = runeBlue;
      
      this.runeNumbers[index].sprites.forEach(s => s.tint = 0xff0000);
      this.runes[index].texture = runeGrey;
      
      const factors = getFactors(this.currentNumbers[index]);
      if (factors.length > 0) {
        const factorText = factors.join(" X ");
        const rune = this.runes[index];
        const factorScale = isPortrait() ? 1 : 2;
        drawText(factorText, rune.x - (factorText.length * TILE_SIZE * factorScale / 2.5), rune.y + 50, factorScale, 0x00aaff, this.runeContainer);
      }
      
      this.shakeScreen();
    }

    // Disable interactivity on all runes
    this.runes.forEach(r => {
      r.eventMode = 'none';
      r.cursor = 'default';
    });

    this.animateRunesFall();
  }

  crumbleRune(rune, runeTexture, runeNumber, numberSprites, compaction = 0) {
    const baseWidth = runeTexture.width;
    const baseHeight = runeTexture.height;
    
    // Vary piece sizes based on compaction - more compacted = smaller pieces
    const pieceSizes = compaction > 2 ? [1, 1, 2, 4] : compaction > 1 ? [2, 4, 4, 6] : [4, 4, 6, 6];
    
    let currentY = 0;
    
    while (currentY < baseHeight) {
      let currentX = 0;
      
      while (currentX < baseWidth) {
        // Random piece size
        const PIECE_SIZE = pieceSizes[Math.floor(Math.random() * pieceSizes.length)];
        
        // Make sure we don't go out of bounds
        const actualWidth = Math.min(PIECE_SIZE, baseWidth - currentX);
        const actualHeight = Math.min(PIECE_SIZE, baseHeight - currentY);
        
        // Random chance to skip some pieces for irregular look
        if (Math.random() < 0.3) {
          currentX += actualWidth;
          continue;
        }
        
        const pieceTexture = new PIXI.Texture({
          source: runeTexture.source,
          frame: new PIXI.Rectangle(
            currentX,
            currentY,
            actualWidth,
            actualHeight
          )
        });

        const piece = new PIXI.Sprite(pieceTexture);
        piece.anchor.set(0.5);
        piece.scale.set(rune.scale.x);
        
        const scaledWidth = actualWidth * rune.scale.x;
        const scaledHeight = actualHeight * rune.scale.x;
        const worldX = rune.x - (baseWidth * rune.scale.x / 2) + currentX * rune.scale.x + scaledWidth / 2;
        const worldY = rune.y - (baseHeight * rune.scale.x / 2) + currentY * rune.scale.x + scaledHeight / 2;
        
        piece.x = worldX;
        piece.y = worldY;
        piece.eventMode = 'static';
        piece.cursor = 'pointer';
        
        this.groundContainer.addChild(piece);

        const body = Bodies.rectangle(
          worldX,
          worldY,
          scaledWidth,
          scaledHeight,
          {
            friction: 0.3,
            restitution: .4,
            density: 0.008 / (compaction + 1) // Lighter pieces when more compacted
          }
        );
        
        // More compaction = more violent explosion but pieces settle faster
        const velocityMult = 8 + compaction * 3;
        Body.setVelocity(body, {
          x: (Math.random() - 0.5) * velocityMult,
          y: -5 - Math.random() * velocityMult
        });
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.4);

        World.add(engine.world, body);
        
        const physicsObj = { sprite: piece, body: body, created: Date.now() };
        this.physicsObjects.push(physicsObj);
        
        // Add drag interaction
        // piece.on('pointerdown', (event) => {
        //   piece.isDragging = true;
        //   piece.dragData = event.data;
        //   Body.setStatic(body, false);
        // });
        
        // piece.on('pointerup', () => {
        //   piece.isDragging = false;
        // });
        
        // piece.on('pointerupoutside', () => {
        //   piece.isDragging = false;
        // });
        
        // piece.on('pointermove', (event) => {
        //   if (piece.isDragging) {
        //     const newPos = piece.dragData.getLocalPosition(piece.parent);
        //     Body.setPosition(body, { x: newPos.x, y: newPos.y });
        //     Body.setVelocity(body, { x: 0, y: 0 });
        //   }
        // });
        
        currentX += actualWidth;
      }
      
      currentY += Math.min(pieceSizes[Math.floor(Math.random() * pieceSizes.length)], baseHeight - currentY);
    }
    
    // Also crumble the number sprites with varying sizes
    if (numberSprites) {
      numberSprites.forEach(sprite => {
        // Break each number character into smaller pieces
        const charWidth = sprite.width;
        const charHeight = sprite.height;
        const numPieces = compaction > 1 ? 4 : 2; // More pieces when compacted
        const pieceSize = charWidth / numPieces;
        
        for (let i = 0; i < numPieces; i++) {
          for (let j = 0; j < numPieces; j++) {
            if (Math.random() < 0.2) continue; // Skip some for irregular look
            
            const miniPiece = new PIXI.Sprite(sprite.texture);
            miniPiece.x = sprite.x + i * pieceSize;
            miniPiece.y = sprite.y + j * pieceSize;
            miniPiece.width = pieceSize;
            miniPiece.height = pieceSize;
            miniPiece.tint = sprite.tint;
            
            this.groundContainer.addChild(miniPiece);
            
            const body = Bodies.rectangle(
              miniPiece.x,
              miniPiece.y,
              pieceSize,
              pieceSize,
              {
                friction: 0.5,
                restitution: 0.1,
                density: 0.001
              }
            );
            
            Body.setVelocity(body, {
              x: (Math.random() - 0.5) * (6 + compaction * 2),
              y: -4 - Math.random() * (4 + compaction * 2)
            });
            
            World.add(engine.world, body);
            this.physicsObjects.push({ sprite: miniPiece, body: body, created: Date.now() });
          }
        }
        
        sprite.destroy();
      });
    }
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
    const duration = 1000;
    const startTime = Date.now();
    const groundY = window.innerHeight - 150;
    const initialPositions = this.runes.map(r => ({ x: r.x, y: r.y }));
    const textScale = isPortrait() ? 2 : 2.5;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * progress;

      this.runes.forEach((rune, i) => {
        rune.y = initialPositions[i].y + (groundY - initialPositions[i].y) * easeProgress;
        
        const numStr = this.currentNumbers[i].toString();
        this.runeNumbers[i].sprites.forEach((sprite, j) => {
          sprite.x = rune.x - (numStr.length * TILE_SIZE * textScale / 2) + (j * TILE_SIZE * textScale);
          sprite.y = rune.y - 12;
        });
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Crumble ALL fallen runes when new ones land
        const numFallen = this.fallenRunes.length;
        this.fallenRunes.forEach((fallen, index) => {
          // Calculate compaction level - older runes (at bottom) are more compacted
          const compaction = numFallen - index - 1;
          this.crumbleRune(fallen.rune, fallen.texture, fallen.number, fallen.numberSprites, compaction);
          fallen.rune.destroy();
        });
        
        // Clear fallen runes array
        this.fallenRunes = [];
        
        // Move current runes to ground container and save them as fallen runes
        this.runes.forEach((rune, i) => {
          this.groundContainer.addChild(rune);
          this.runeNumbers[i].sprites.forEach(s => {
            this.groundContainer.addChild(s);
          });
          
          // Store this rune as a fallen rune
          this.fallenRunes.push({
            rune: rune,
            texture: rune.texture,
            number: this.currentNumbers[i],
            numberSprites: this.runeNumbers[i].sprites
          });
        });
        
        // Clear the rune container
        this.runeContainer.removeChildren();
        
        setTimeout(() => this.nextRound(), 1500);
      }
    };

    animate();
  }

  updateUI() {
    this.uiContainer.removeChildren();
    
    const uiScale = isPortrait() ? 1.5 : 2;
    drawText(`ROUND ${this.round}/${this.maxRounds}`, 10, 10, uiScale, 0xffffff, this.uiContainer);
    drawText(`SCORE ${this.player.score}`, 10, 40, uiScale, 0x00ff00, this.uiContainer);
    
    if (isPortrait()) {
      drawText("TAP TO SELECT", 10, window.innerHeight - 30, 1.5, 0xffff00, this.uiContainer);
    } else {
      drawText("PRESS 1 2 3 4 OR TAP", 10, window.innerHeight - 40, 1.5, 0xffff00, this.uiContainer);
    }
  }

  endGame() {
    this.state = GAME_STATE.GAME_OVER;
    this.runeContainer.removeChildren();
    this.uiContainer.removeChildren();

    const centerX = window.innerWidth / 2;
    const titleScale = isPortrait() ? 3 : 5;
    let yPos = 50;

    drawText("GAME OVER", centerX - (9 * TILE_SIZE * titleScale / 2), yPos, titleScale, 0xff0000, this.uiContainer);
    yPos += titleScale * 30;
    
    drawText(`SCORE ${this.player.score}`, centerX - (12 * TILE_SIZE), yPos, 2, 0x00ff00, this.uiContainer);
    yPos += 60;

    const foundList = Object.keys(this.player.foundPrimes).join(" ");
    if (foundList) {
      drawText("FOUND", centerX - (5 * TILE_SIZE * 1.5), yPos, 1.5, 0x00ff00, this.uiContainer);
      yPos += 35;
      const maxChars = isPortrait() ? 20 : 40;
      const lines = this.wrapTextByChars(foundList, maxChars);
      lines.forEach(line => {
        drawText(line, centerX - (line.length * TILE_SIZE / 2), yPos, 1.5, 0xffffff, this.uiContainer);
        yPos += 28;
      });
      yPos += 15;
    }

    const missedList = Object.keys(this.player.missedPrimes).join(" ");
    if (missedList) {
      drawText("MISSED", centerX - (6 * TILE_SIZE * 1.5), yPos, 1.5, 0xff0000, this.uiContainer);
      yPos += 35;
      const maxChars = isPortrait() ? 20 : 40;
      const lines = this.wrapTextByChars(missedList, maxChars);
      lines.forEach(line => {
        drawText(line, centerX - (line.length * TILE_SIZE / 2), yPos, 1.5, 0xffaa00, this.uiContainer);
        yPos += 28;
      });
      yPos += 15;
    }

    drawText("PRESS ENTER", centerX - (11 * TILE_SIZE), window.innerHeight - 60, 1.5, 0xffff00, this.uiContainer);
    drawText("TO PLAY AGAIN", centerX - (13 * TILE_SIZE), window.innerHeight - 30, 1.5, 0xffff00, this.uiContainer);
  }

  wrapTextByChars(text, maxChars) {
    const lines = [];
    let currentLine = "";
    
    text.split(" ").forEach(word => {
      if ((currentLine + word).length > maxChars) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word + " ";
      } else {
        currentLine += word + " ";
      }
    });
    
    if (currentLine) lines.push(currentLine.trim());
    return lines;
  }
}

const game = new Game();
}
initGame()