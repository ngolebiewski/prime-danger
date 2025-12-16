import "./style.css";
import * as PIXI from "pixi.js";
import Matter from "matter-js";
import { DebugTilemap } from "./debugTilemap.js";
import {
  snd_crash0,
  snd_good_blip,
  snd_wrong_blip,
  snd_boom,
} from "./soundFx.js";
import {
  FONT_MAP,
  TILE_SIZE,
  TILES_VERTICAL,
  TILES_HORIZONTAL,
} from "./constants.js";
import primes_200 from "./primes_200.js";
import { Player } from "./player.js";
import { TextRenderer } from "./textRenderer.js";
import { PhysicsManager } from "./physicsManager.js";
import { RuneManager } from "./runeManager.js";

// AUDIO SOUNDTRACK
// use it:
// audio.start(); // fade sound in
// audio.fadeOut(); // fade sound out
import { AudioManager } from "./audioManager.js";
const audio = new AudioManager();

console.log("🚀 Main.js loaded");

/* Vite needs Pixi Games to be wrapped in an async function. Known oddity.
https://pixijs.com/8.x/guides/getting-started/quick-start
warning
If using Vite you still need to wrap your code in an async function. There is an issue when using top level await with PixiJS when building for production.
This issue is known to affect Vite <=6.0.6. Future versions of Vite may resolve this issue. */

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
    preference: "high-performance",
  });

  document.querySelector("#game").appendChild(app.canvas);
  const physicsManager = new PhysicsManager();

  // Load assets
  PIXI.Assets.add({
    alias: "tilemap",
    src: "art/monochrome-transparent_packed.png",
  });
  PIXI.Assets.add({
    alias: "runeBlack",
    src: "art/runeBlack_slabOutline_035.png",
  });
  PIXI.Assets.add({
    alias: "runeBlue",
    src: "art/runeBlue_slabOutline_035.png",
  });
  PIXI.Assets.add({
    alias: "runeGrey",
    src: "art/runeGrey_slabOutline_036.png",
  });

  const loadedAssets = await PIXI.Assets.load([
    "tilemap",
    "runeBlack",
    "runeBlue",
    "runeGrey",
  ]);
  const texture = loadedAssets.tilemap;
  const runeBlack = loadedAssets.runeBlack;
  const runeBlue = loadedAssets.runeBlue;
  const runeGrey = loadedAssets.runeGrey;

  [texture, runeBlack, runeBlue, runeGrey].forEach(
    (t) => (t.source.scaleMode = "nearest")
  );

  // After the texture assets are loaded and scale mode is set
  const textRenderer = new TextRenderer(texture);

  // After creating textRenderer and physicsManager
  const runeManager = new RuneManager(
    { runeBlack, runeBlue, runeGrey },
    textRenderer,
    physicsManager
  );

  // Debug tilemap
  const debugTilemap = new DebugTilemap(
    app,
    texture,
    TILE_SIZE,
    TILES_HORIZONTAL,
    TILES_VERTICAL,
    1.5
  );

  // New clean factor pair logic
  // Wait -- we DONT CARE ABOUT 1. so lets start with i = 2 rather than i = 1
  // Also, you only need to check to the square root of the number you're factoring.
  function getFactorPairs(n) {
    const pairs = [];
    const limit = Math.floor(Math.sqrt(n));
    for (let i = 2; i <= limit; i++) {
      if (n % i === 0) {
        const j = n / i;
        pairs.push(`${i}X${j}`);
      }
    }
    return pairs;
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
    constructor(physicsManager, textRenderer, runeManager) {
      this.physicsManager = physicsManager;
      this.textRenderer = textRenderer;
      this.runeManager = runeManager;
      this.state = GAME_STATE.TITLE;
      this.inputLocked = false; // 🧠 prevent spam input
      this.handleKeyDown = null; // 🎹 store listener reference
      this.soundOn = true; //sound off/on
      this.player = new Player();
      this.round = 0;
      this.maxRounds = 7;
      this.currentNumbers = [];
      this.primeIndex = -1;
      this.runes = [];
      this.runeNumbers = [];
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
        physicsManager.update();
      });

      window.addEventListener("resize", () => {
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

    setupInput() {
      // 🧠 Unified input handler
      const handleStartOrSelect = (index = null) => {
        if (this.state === GAME_STATE.TITLE) {
          if (this.soundOn) snd_crash0();
          this.startGame();
        } else if (this.state === GAME_STATE.PLAYING && index !== null) {
          this.selectRune(index);
        } else if (this.state === GAME_STATE.GAME_OVER) {
          if (this.soundOn) snd_crash0();
          this.resetGame();
        }
      };

      // Keyboard input
      this.handleKeyDown = (e) => {
        if (
          this.state === GAME_STATE.TITLE &&
          (e.key === "Enter" || e.key === " ")
        ) {
          handleStartOrSelect();
        } else if (
          this.state === GAME_STATE.PLAYING &&
          ["1", "2", "3", "4"].includes(e.key)
        ) {
          handleStartOrSelect(parseInt(e.key) - 1);
        } else if (
          this.state === GAME_STATE.GAME_OVER &&
          (e.key === "Enter" || e.key === " ")
        ) {
          handleStartOrSelect();
        }
      };
      window.addEventListener("keydown", this.handleKeyDown);

      // Pointer input (tap/click) — covers touch & mouse
      this.handlePointerDown = () => {
        if (
          this.state === GAME_STATE.TITLE ||
          this.state === GAME_STATE.GAME_OVER
        ) {
          handleStartOrSelect();
        }
      };
      app.view.addEventListener("pointerdown", this.handlePointerDown);
    }

    // Remove listeners when locking input
    removeInput() {
      if (this.handleKeyDown) {
        window.removeEventListener("keydown", this.handleKeyDown);
        this.handleKeyDown = null;
      }
      if (this.handlePointerDown) {
        app.removeEventListener("pointerdown", this.handlePointerDown);
        this.handlePointerDown = null;
      }
    }

    removeInput() {
      if (this.handleKeyDown) {
        window.removeEventListener("keydown", this.handleKeyDown);
        this.handleKeyDown = null;
      }
    }

    showTitle() {
      this.titleContainer.removeChildren();
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const scale = isPortrait() ? 1.5 : 3;

      // Calculate text widths for proper centering
      const titleText = "PRIME DANGER";
      // const titleWidth = titleText.length * TILE_SIZE * scale; // example without the getTextWidth function which does the same thing
      const titleWidth = textRenderer.getTextWidth(titleText, scale);

      const enterText = "PRESS ENTER";
      const enterWidth = textRenderer.getTextWidth(enterText, 1);

      const startText = "TO START";
      const startWidth = textRenderer.getTextWidth(startText, 1);

      const findText = "FIND THE PRIMES";
      const findWidth = textRenderer.getTextWidth(findText, 1);

      textRenderer.drawText(
        "PRIME DANGER",
        centerX - titleWidth / 2,
        centerY - 100,
        scale,
        0x00ff00,
        this.titleContainer
      );
      textRenderer.drawText(
        "PRESS ENTER",
        centerX - enterWidth / 2,
        centerY + 50,
        1,
        0xffff00,
        this.titleContainer
      );
      textRenderer.drawText(
        "TO START",
        centerX - startWidth / 2,
        centerY + 90,
        1,
        0xffff00,
        this.titleContainer
      );
      textRenderer.drawText(
        "FIND THE PRIMES",
        centerX - findWidth / 2,
        centerY + 140,
        1,
        0xffffff,
        this.titleContainer
      );
    }

    startGame() {
      this.state = GAME_STATE.PLAYING;
      this.round = 0;
      this.player.score = 0;
      this.player.foundPrimes = {};
      this.player.missedPrimes = {};
      this.titleContainer.removeChildren();
      this.groundContainer.removeChildren();

      // start music TEMPORARILY TURNED OFF!
      // audio.start();

      // Clear physics objects
      this.physicsManager.clear();
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
      this.physicsManager.clear();
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

      const randomPrime =
        primes_200[Math.floor(Math.random() * primes_200.length)];
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
      this.runeManager.createRunes(
        this.currentNumbers,
        this.runeContainer,
        (index) => this.selectRune(index)
      );
    }

    selectRune(index) {
      if (this.state !== GAME_STATE.PLAYING || this.inputLocked) return;

      this.inputLocked = true;
      this.removeInput();

      const isCorrect = index === this.primeIndex;

      if (isCorrect) {
        this.player.updateScore(10);
        this.player.foundPrimes[this.currentNumbers[index]] = true;
        snd_good_blip();

        // OLD CODE - REMOVE:
        // this.runeNumbers[this.primeIndex].sprites.forEach(
        //   (s) => (s.tint = 0x00ff00)
        // );
        // this.runes[index].texture = runeBlue;

        // NEW CODE:
        this.runeManager.updateRuneAppearance(index, "correct");
        
        // Show "CORRECT" text above the rune
        const runes = this.runeManager.getRunes();
        const rune = runes[index];
        const correctScale = this.runeManager.isPortrait() ? 1.5 : 2;
        const correctText = "CORRECT";
        const correctWidth = this.textRenderer.getTextWidth(correctText, correctScale);
        
        const correctContainer = new PIXI.Container();
        this.runeContainer.addChild(correctContainer);
        
        this.textRenderer.drawText(
          correctText,
          rune.x - correctWidth / 2,
          rune.y - 80,
          correctScale,
          0x00ff00,
          correctContainer
        );
        
        // Fade out animation
        const startTime = Date.now();
        const fadeDuration = 1000;
        
        const fade = () => {
          const elapsed = Date.now() - startTime;
          const progress = elapsed / fadeDuration;
          
          if (progress < 1) {
            correctContainer.alpha = 1 - progress;
            requestAnimationFrame(fade);
          } else {
            correctContainer.destroy();
          }
        };
        
        fade();
      } else {
        this.player.missedPrimes[this.currentNumbers[this.primeIndex]] = true;

        // OLD CODE - REMOVE:
        // this.runeNumbers[this.primeIndex].sprites.forEach(
        //   (s) => (s.tint = 0x0000ff)
        // );
        // this.runes[this.primeIndex].texture = runeBlue;
        //
        // this.runeNumbers[index].sprites.forEach((s) => (s.tint = 0xff0000));
        // this.runes[index].texture = runeGrey;

        // NEW CODE:
        this.runeManager.updateRuneAppearance(this.primeIndex, "reveal");
        this.runeManager.updateRuneAppearance(index, "wrong");

        snd_wrong_blip();

        // 🧮 Display factor pairs vertically
        const pairs = getFactorPairs(this.currentNumbers[index]);
        if (pairs.length > 0) {
          const runes = this.runeManager.getRunes();
          const rune = runes[index];
          const factorScale = this.runeManager.isPortrait() ? 1 : 2;

          pairs.forEach((pair, i) => {
            this.textRenderer.drawText(
              pair,
              rune.x - (pair.length * TILE_SIZE * factorScale) / 3,
              rune.y + 40 + i * (TILE_SIZE * factorScale * 1.1),
              factorScale,
              0x00aaff,
              this.runeContainer
            );
          });
        }

        this.shakeScreen();
      }

      // OLD CODE - REMOVE:
      // this.runes.forEach((r) => {
      //   r.eventMode = "none";
      //   r.cursor = "default";
      // });

      // NEW CODE:
      this.runeManager.disableRuneInteraction();

      this.animateRunesFall();

      setTimeout(() => {
        this.inputLocked = false;
        this.setupInput();
      }, 2000);
    }

    crumbleRune(rune, runeTexture, runeNumber, numberSprites, compaction = 0) {
      const baseWidth = runeTexture.width;
      const baseHeight = runeTexture.height;

      // Vary piece sizes based on compaction - more compacted = smaller pieces
      const pieceSizes =
        compaction > 2
          ? [1, 1, 2, 4]
          : compaction > 1
          ? [2, 4, 4, 6]
          : [4, 4, 6, 6];

      let currentY = 0;

      while (currentY < baseHeight) {
        let currentX = 0;

        while (currentX < baseWidth) {
          // Random piece size
          const PIECE_SIZE =
            pieceSizes[Math.floor(Math.random() * pieceSizes.length)];

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
            ),
          });

          const piece = new PIXI.Sprite(pieceTexture);
          piece.anchor.set(0.5);
          piece.scale.set(rune.scale.x);

          const scaledWidth = actualWidth * rune.scale.x;
          const scaledHeight = actualHeight * rune.scale.x;
          const worldX =
            rune.x -
            (baseWidth * rune.scale.x) / 2 +
            currentX * rune.scale.x +
            scaledWidth / 2;
          const worldY =
            rune.y -
            (baseHeight * rune.scale.x) / 2 +
            currentY * rune.scale.x +
            scaledHeight / 2;

          piece.x = worldX;
          piece.y = worldY;
          piece.eventMode = "static";
          piece.cursor = "pointer";

          this.groundContainer.addChild(piece);

          const body = this.physicsManager.createRectangleBody(
            worldX,
            worldY,
            scaledWidth,
            scaledHeight,
            {
              friction: 0.3,
              restitution: 0.4,
              density: 0.008 / (compaction + 1),
            }
          );

          const velocityMult = 8 + compaction * 3;

          this.physicsManager.setVelocity(body, {
            x: (Math.random() - 0.5) * velocityMult,
            y: -5 - Math.random() * velocityMult,
          });
          this.physicsManager.setAngularVelocity(
            body,
            (Math.random() - 0.5) * 0.4
          );

          this.physicsManager.addPhysicsObject(piece, body);
          currentX += actualWidth;
        }

        currentY += Math.min(
          pieceSizes[Math.floor(Math.random() * pieceSizes.length)],
          baseHeight - currentY
        );
      }

      // Also crumble the number sprites with varying sizes
      // Also crumble the number sprites with varying sizes
      if (numberSprites) {
        numberSprites.forEach((sprite) => {
          const charWidth = sprite.width;
          const charHeight = sprite.height;
          const numPieces = compaction > 1 ? 4 : 2;
          const pieceSize = charWidth / numPieces;

          for (let i = 0; i < numPieces; i++) {
            for (let j = 0; j < numPieces; j++) {
              if (Math.random() < 0.2) continue;

              const miniPiece = new PIXI.Sprite(sprite.texture);
              miniPiece.x = sprite.x + i * pieceSize;
              miniPiece.y = sprite.y + j * pieceSize;
              miniPiece.width = pieceSize;
              miniPiece.height = pieceSize;
              miniPiece.tint = sprite.tint;

              this.groundContainer.addChild(miniPiece);

              const body = this.physicsManager.createRectangleBody(
                miniPiece.x,
                miniPiece.y,
                pieceSize,
                pieceSize,
                {
                  friction: 0.5,
                  restitution: 0.1,
                  density: 0.001,
                }
              );

              this.physicsManager.setVelocity(body, {
                x: (Math.random() - 0.5) * (6 + compaction * 2),
                y: -4 - Math.random() * (4 + compaction * 2),
              });

              this.physicsManager.addPhysicsObject(miniPiece, body);
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
          this.shakeContainer.x =
            (Math.random() - 0.5) * shakeIntensity * (1 - progress);
          this.shakeContainer.y =
            (Math.random() - 0.5) * shakeIntensity * (1 - progress);
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

      // Get runes from manager
      const runes = this.runeManager.getRunes();
      const runeNumbers = this.runeManager.getRuneNumbers();
      const initialPositions = runes.map((r) => ({ x: r.x, y: r.y }));
      const textScale = this.runeManager.isPortrait() ? 2 : 2.5;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = progress * progress;

        runes.forEach((rune, i) => {
          rune.y =
            initialPositions[i].y +
            (groundY - initialPositions[i].y) * easeProgress;

          const numStr = this.currentNumbers[i].toString();
          runeNumbers[i].sprites.forEach((sprite, j) => {
            sprite.x =
              rune.x -
              (numStr.length * TILE_SIZE * textScale) / 2 +
              j * TILE_SIZE * textScale;
            sprite.y = rune.y - 12;
          });
        });

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Crumble ALL fallen runes when new ones land
          snd_boom();

          const fallenRunes = this.runeManager.getFallenRunes();
          const numFallen = fallenRunes.length;

          fallenRunes.forEach((fallen, index) => {
            // Calculate compaction level - older runes (at bottom) are more compacted
            const compaction = numFallen - index - 1;
            this.runeManager.crumbleRune(
              fallen.rune,
              fallen.texture,
              fallen.number,
              fallen.numberSprites,
              compaction,
              this.groundContainer
            );
            fallen.rune.destroy();
          });

          // Clear fallen runes array
          this.runeManager.clearFallenRunes();

          // Move current runes to ground container and save them as fallen runes
          runes.forEach((rune, i) => {
            this.groundContainer.addChild(rune);
            runeNumbers[i].sprites.forEach((s) => {
              this.groundContainer.addChild(s);
            });

            // Store this rune as a fallen rune
            this.runeManager.addFallenRune(
              rune,
              rune.texture,
              this.currentNumbers[i],
              runeNumbers[i].sprites
            );
          });

          // Clear the rune container
          this.runeContainer.removeChildren();

          setTimeout(() => this.nextRound(), 1000);
        }
      };

      animate();
    }

    updateUI() {
      this.uiContainer.removeChildren();

      const uiScale = isPortrait() ? 1.5 : 2;
      textRenderer.drawText(
        `ROUND ${this.round}/${this.maxRounds}`,
        10,
        10,
        uiScale,
        0xffffff,
        this.uiContainer
      );
      textRenderer.drawText(
        `SCORE ${this.player.score}`,
        10,
        40,
        uiScale,
        0x00ff00,
        this.uiContainer
      );

      if (isPortrait()) {
        textRenderer.drawText(
          "TAP TO SELECT",
          10,
          window.innerHeight - 30,
          1.5,
          0xffff00,
          this.uiContainer
        );
      } else {
        textRenderer.drawText(
          "PRESS 1 2 3 4 OR TAP",
          10,
          window.innerHeight - 40,
          1.5,
          0xffff00,
          this.uiContainer
        );
      }
    }

    endGame() {
      this.state = GAME_STATE.GAME_OVER;
      this.runeContainer.removeChildren();
      this.uiContainer.removeChildren();

      // FADE OUT SOUND
      audio.fadeOut();

      const centerX = window.innerWidth / 2;
      const titleScale = isPortrait() ? 2 : 5;
      let yPos = 50;

      // -------------------------------
      // END MESSAGE (GAME OVER / PERFECT / GOOD)
      // -------------------------------
      let endMessage = "GAME OVER";

      switch (true) {
        case this.player.score === 70:
          endMessage = "PERFECT SCORE";
          break;
        case this.player.score >= 50:
          endMessage = "GOOD SCORE";
          break;
      }

      const endMsgWidth = endMessage.length * TILE_SIZE * titleScale;

      textRenderer.drawText(
        endMessage,
        centerX - endMsgWidth / 2,
        yPos,
        titleScale,
        0xff0000,
        this.uiContainer
      );
      yPos += titleScale * 30;

      // -------------------------------
      // SCORE (Centered)
      // -------------------------------
      const scoreText = `SCORE ${this.player.score}`;
      const scoreWidth = scoreText.length * TILE_SIZE * 2;

      textRenderer.drawText(
        scoreText,
        centerX - scoreWidth / 2,
        yPos,
        2,
        0x00ff00,
        this.uiContainer
      );
      yPos += 60;

      // -------------------------------
      // FOUND PRIMES (Centered)
      // -------------------------------
      const foundList = Object.keys(this.player.foundPrimes).join(" ");
      if (foundList) {
        const foundHeader = "FOUND";
        const foundHeaderWidth = foundHeader.length * TILE_SIZE * 1.5;

        textRenderer.drawText(
          foundHeader,
          centerX - foundHeaderWidth / 2,
          yPos,
          1.5,
          0x00ff00,
          this.uiContainer
        );
        yPos += 35;

        const maxChars = isPortrait() ? 20 : 40;
        const foundLines = this.wrapTextByChars(foundList, maxChars);

        foundLines.forEach((line) => {
          const lineWidth = line.length * TILE_SIZE * 1.5;

          textRenderer.drawText(
            line,
            centerX - lineWidth / 2,
            yPos,
            1.5,
            0xffffff,
            this.uiContainer
          );
          yPos += 28;
        });

        yPos += 15;
      }

      // -------------------------------
      // MISSED PRIMES (Centered)
      // -------------------------------
      const missedList = Object.keys(this.player.missedPrimes).join(" ");
      if (missedList) {
        const missedHeader = "MISSED";
        const missedHeaderWidth = missedHeader.length * TILE_SIZE * 1.5;

        textRenderer.drawText(
          missedHeader,
          centerX - missedHeaderWidth / 2,
          yPos,
          1.5,
          0xff0000,
          this.uiContainer
        );
        yPos += 35;

        const maxChars = isPortrait() ? 20 : 40;
        const missedLines = this.wrapTextByChars(missedList, maxChars);

        missedLines.forEach((line) => {
          const lineWidth = line.length * TILE_SIZE * 1.5;

          textRenderer.drawText(
            line,
            centerX - lineWidth / 2,
            yPos,
            1.5,
            0xffaa00,
            this.uiContainer
          );
          yPos += 28;
        });

        yPos += 15;
      }

      // -------------------------------
      // PRESS ENTER + TO PLAY AGAIN (Centered!)
      // -------------------------------
      const enter1 = "PRESS ENTER";
      const enter1Width = enter1.length * TILE_SIZE * 1.5;

      textRenderer.drawText(
        enter1,
        centerX - enter1Width / 2,
        window.innerHeight - 60,
        1.5,
        0xffff00,
        this.uiContainer
      );

      const enter2 = "TO PLAY AGAIN";
      const enter2Width = enter2.length * TILE_SIZE * 1.5;

      textRenderer.drawText(
        enter2,
        centerX - enter2Width / 2,
        window.innerHeight - 30,
        1.5,
        0xffff00,
        this.uiContainer
      );
    }

    wrapTextByChars(text, maxChars) {
      const lines = [];
      let currentLine = "";

      text.split(" ").forEach((word) => {
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

  const game = new Game(physicsManager, textRenderer, runeManager);
}
initGame();