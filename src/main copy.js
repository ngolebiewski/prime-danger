import "./style.css";
import * as PIXI from "pixi.js";
import { DebugTilemap } from "./debugTilemap.js";
import {
  FONT_MAP,
  TILE_SIZE,
  TILES_VERTICAL,
  TILES_HORIZONTAL,
} from "./constants.js";
import primes from "./primes_200.js";

document.querySelector("#app").innerHTML = `
    <div id="game"></div>
`;

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

// const texture = await PIXI.Assets.load(
//   "./art/monochrome-transparent_packed.png"
// );
// texture.source.scaleMode = "nearest";

PIXI.Assets.add({ alias: 'tilemap', src: './art/monochrome-transparent_packed.png' });
PIXI.Assets.add({ alias: 'runeBlack', src: './art/runeBlack_slabOutline_035.png' });
PIXI.Assets.add({ alias: 'runeBlue', src: './art/runeBlue_slabOutline_035.png' });
PIXI.Assets.add({ alias: 'runeGrey', src: './art/runeGrey_slabOutline_036.png' });

const loadedAssets = await PIXI.Assets.load(['tilemap', 'runeBlack', 'runeBlue', 'runeGrey']);

const texture = loadedAssets.tilemap;
const runeBlack = loadedAssets.runeBlack;
const runeBlue = loadedAssets.runeBlue;
const runeGrey = loadedAssets.runeGrey;

// Set scale mode for all
[texture, runeBlack, runeBlue, runeGrey].forEach(t => t.source.scaleMode = 'nearest');




// Initialize debug tilemap (press 'T' to toggle)
const debugTilemap = new DebugTilemap(
  app,
  texture,
  TILE_SIZE,
  TILES_HORIZONTAL,
  TILES_VERTICAL,
  1.5
);

function getTileIndex(char) {
  return FONT_MAP[char.toUpperCase()] || null;
}

function drawText(text, startX, startY, scale = 2, color = 0xffffff) {
  const chars = text.toUpperCase().split("");
  const spacing = TILE_SIZE * scale;

  chars.forEach((char, i) => {
    const tileIndex = getTileIndex(char);
    if (tileIndex === null) return;

    const x = tileIndex % TILES_HORIZONTAL;
    const y = Math.floor(tileIndex / TILES_HORIZONTAL);

    const tileTexture = new PIXI.Texture({
      source: texture.source,
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
    sprite.tint = color; // Add color tint
    app.stage.addChild(sprite);
  });
}

// Example usage with different colors:
// drawText("HELLO 123", 100, 100, 3, 0xFF0000);      // Red
drawText("$$ PRIME DANGER $$,", 100, 200, 4, 0x00ff00); // Green
drawText("GAME OVER", 100, 300, 3, 0xffff00); // Yellow
drawText("SCORE 999", 100, 400, 2, 0xff00ff); // Magenta
drawText("Insert Coin", 100, 500, 4, 0xffaaff); // Pink
