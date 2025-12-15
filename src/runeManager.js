import * as PIXI from "pixi.js";
import { TILE_SIZE } from "./constants.js";

/**
 * RuneManager - Handles rune creation, display, and crumbling effects
 */
export class RuneManager {
  constructor(textures, textRenderer, physicsManager) {
    this.runeBlack = textures.runeBlack;
    this.runeBlue = textures.runeBlue;
    this.runeGrey = textures.runeGrey;
    this.textRenderer = textRenderer;
    this.physicsManager = physicsManager;

    this.runes = [];
    this.runeNumbers = [];
    this.fallenRunes = [];
  }

  /**
   * Check if device is in portrait orientation
   */
  isPortrait() {
    return window.innerHeight > window.innerWidth;
  }

  /**
   * Create runes with numbers
   * @param {Array<number>} numbers - Array of 4 numbers to display
   * @param {PIXI.Container} container - Container to add runes to
   * @param {Function} onRuneClick - Callback when rune is clicked (receives index)
   */
  createRunes(numbers, container, onRuneClick) {
    container.removeChildren();
    this.runes = [];
    this.runeNumbers = [];

    const portrait = this.isPortrait();
    const runeScale = portrait ? 2 : 2.5;
    const textScale = portrait ? 2 : 2.5;

    if (portrait) {
      this.createRunesPortrait(numbers, container, onRuneClick, runeScale, textScale);
    } else {
      this.createRunesLandscape(numbers, container, onRuneClick, runeScale, textScale);
    }
  }

  /**
   * Create runes in portrait layout (2x2 grid)
   */
  createRunesPortrait(numbers, container, onRuneClick, runeScale, textScale) {
    const spacingX = window.innerWidth / 2.5;
    const spacingY = 200;
    const startX = window.innerWidth / 2 - spacingX / 2;
    const startY = window.innerHeight / 2 - spacingY / 2;

    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);

      const rune = this.createRuneSprite(
        startX + col * spacingX,
        startY + row * spacingY,
        runeScale,
        i,
        onRuneClick
      );

      container.addChild(rune);
      this.runes.push(rune);

      const numSprites = this.addNumberToRune(rune, numbers[i], textScale, container);
      this.runeNumbers.push({ sprites: numSprites, index: i });
    }
  }

  /**
   * Create runes in landscape layout (horizontal row)
   */
  createRunesLandscape(numbers, container, onRuneClick, runeScale, textScale) {
    const spacing = Math.min(200, window.innerWidth / 5);
    const startX = (window.innerWidth - spacing * 3) / 2;
    const startY = window.innerHeight / 2 - 50;

    for (let i = 0; i < 4; i++) {
      const rune = this.createRuneSprite(
        startX + i * spacing,
        startY,
        runeScale,
        i,
        onRuneClick
      );

      container.addChild(rune);
      this.runes.push(rune);

      const numSprites = this.addNumberToRune(rune, numbers[i], textScale, container);
      this.runeNumbers.push({ sprites: numSprites, index: i });
    }
  }

  /**
   * Create a single rune sprite
   */
  createRuneSprite(x, y, scale, index, onRuneClick) {
    const rune = new PIXI.Sprite(this.runeBlack);
    rune.x = x;
    rune.y = y;
    rune.scale.set(scale);
    rune.anchor.set(0.5);
    rune.eventMode = "static";
    rune.cursor = "pointer";
    rune.runeIndex = index;

    rune.on("pointerdown", () => onRuneClick(index));
    rune.on("click", () => onRuneClick(index));

    return rune;
  }

  /**
   * Add number text to a rune
   */
  addNumberToRune(rune, number, textScale, container) {
    const numStr = number.toString();
    const numSprites = this.textRenderer.drawText(
      numStr,
      rune.x - (numStr.length * TILE_SIZE * textScale) / 2,
      rune.y - 12,
      textScale,
      0xffffff,
      container
    );
    return numSprites;
  }

  /**
   * Disable interaction on all runes
   */
  disableRuneInteraction() {
    this.runes.forEach((r) => {
      r.eventMode = "none";
      r.cursor = "default";
    });
  }

  /**
   * Update rune texture and number color
   * @param {number} index - Rune index
   * @param {string} type - 'correct', 'wrong', or 'reveal'
   */
  updateRuneAppearance(index, type) {
    const rune = this.runes[index];
    const numberSprites = this.runeNumbers[index].sprites;

    switch (type) {
      case "correct":
        rune.texture = this.runeBlue;
        numberSprites.forEach((s) => (s.tint = 0x00ff00));
        break;
      case "wrong":
        rune.texture = this.runeGrey;
        numberSprites.forEach((s) => (s.tint = 0xff0000));
        break;
      case "reveal":
        rune.texture = this.runeBlue;
        numberSprites.forEach((s) => (s.tint = 0x0000ff));
        break;
    }
  }

  /**
   * Crumble a rune into physics pieces
   */
  crumbleRune(rune, runeTexture, runeNumber, numberSprites, compaction, groundContainer) {
    const baseWidth = runeTexture.width;
    const baseHeight = runeTexture.height;

    // Vary piece sizes based on compaction
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
        const PIECE_SIZE = pieceSizes[Math.floor(Math.random() * pieceSizes.length)];
        const actualWidth = Math.min(PIECE_SIZE, baseWidth - currentX);
        const actualHeight = Math.min(PIECE_SIZE, baseHeight - currentY);

        // Random chance to skip some pieces for irregular look
        if (Math.random() < 0.3) {
          currentX += actualWidth;
          continue;
        }

        const pieceTexture = new PIXI.Texture({
          source: runeTexture.source,
          frame: new PIXI.Rectangle(currentX, currentY, actualWidth, actualHeight),
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

        groundContainer.addChild(piece);

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
        this.physicsManager.setAngularVelocity(body, (Math.random() - 0.5) * 0.4);

        this.physicsManager.addPhysicsObject(piece, body);
        currentX += actualWidth;
      }

      currentY += Math.min(
        pieceSizes[Math.floor(Math.random() * pieceSizes.length)],
        baseHeight - currentY
      );
    }

    // Crumble the number sprites
    if (numberSprites) {
      this.crumbleNumberSprites(numberSprites, compaction, groundContainer);
    }
  }

  /**
   * Crumble number sprites into pieces
   */
  crumbleNumberSprites(numberSprites, compaction, groundContainer) {
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

          groundContainer.addChild(miniPiece);

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

  /**
   * Store fallen runes for later crumbling
   */
  addFallenRune(rune, texture, number, numberSprites) {
    this.fallenRunes.push({
      rune,
      texture,
      number,
      numberSprites,
    });
  }

  /**
   * Get all fallen runes
   */
  getFallenRunes() {
    return this.fallenRunes;
  }

  /**
   * Clear fallen runes array
   */
  clearFallenRunes() {
    this.fallenRunes = [];
  }

  /**
   * Get current runes
   */
  getRunes() {
    return this.runes;
  }

  /**
   * Get current rune numbers
   */
  getRuneNumbers() {
    return this.runeNumbers;
  }
}