import * as PIXI from "pixi.js";
import { FONT_MAP, TILE_SIZE, TILES_HORIZONTAL } from "./constants.js";

/**
 * TextRenderer - Handles rendering pixel-font text from a tilemap
 */
export class TextRenderer {
  constructor(texture) {
    this.texture = texture;
  }

  /**
   * Get the tile index for a character from the font map
   * @param {string} char - Single character to look up
   * @returns {number|null} - Tile index or null if not found
   */
  getTileIndex(char) {
    return FONT_MAP[char.toUpperCase()] || null;
  }

  /**
   * Draw text using the pixel font tilemap
   * @param {string} text - Text to render
   * @param {number} startX - X position
   * @param {number} startY - Y position
   * @param {number} scale - Scale factor (default: 2)
   * @param {number} color - Tint color in hex (default: 0xffffff)
   * @param {PIXI.Container} container - Container to add sprites to
   * @returns {Array<PIXI.Sprite>} - Array of created sprite objects
   */
  drawText(
    text,
    startX,
    startY,
    scale = 2,
    color = 0xffffff,
    container
  ) {
    const chars = text.toUpperCase().split("");
    const spacing = TILE_SIZE * scale;
    const textSprites = [];

    chars.forEach((char, i) => {
      const tileIndex = this.getTileIndex(char);
      if (tileIndex === null) return;

      const x = tileIndex % TILES_HORIZONTAL;
      const y = Math.floor(tileIndex / TILES_HORIZONTAL);

      const tileTexture = new PIXI.Texture({
        source: this.texture.source,
        frame: new PIXI.Rectangle(
          x * TILE_SIZE,
          y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE
        ),
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

  /**
   * Calculate the width of text when rendered
   * @param {string} text - Text to measure
   * @param {number} scale - Scale factor
   * @returns {number} - Width in pixels
   */
  getTextWidth(text, scale = 2) {
    return text.length * TILE_SIZE * scale;
  }
}
