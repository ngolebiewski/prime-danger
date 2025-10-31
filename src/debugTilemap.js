import * as PIXI from 'pixi.js';

// Class/Functions to overlay the indeci on top of your tilesheet for easy picking IF you are not going the full on
// Tilemap + JSON route for things.
export class DebugTilemap {
  constructor(app, texture, tileSize, tilesHorizontal, tilesVertical, scale = 1.5) {
    this.app = app;
    this.texture = texture;
    this.tileSize = tileSize;
    this.tilesHorizontal = tilesHorizontal;
    this.tilesVertical = tilesVertical;
    this.scale = scale;
    this.isVisible = false;
    
    // Create container for debug tiles
    this.debugContainer = new PIXI.Container();
    this.app.stage.addChild(this.debugContainer);
    
    // Set up keyboard listener
    this.setupKeyListener();
  }
  
  setupKeyListener() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 't' || e.key === 'T') {
        this.toggle();
      }
    });
  }
  
  toggle() {
    this.isVisible = !this.isVisible;
    console.log("Debug tilemap:", this.isVisible);
    this.render();
  }
  
  render() {
    // Clear existing debug tiles
    this.debugContainer.removeChildren();
    
    if (!this.isVisible) return;
    
    // Draw all tiles with numbers
    for (let y = 0; y < this.tilesVertical; y++) {
      for (let x = 0; x < this.tilesHorizontal; x++) {
        const index = y * this.tilesHorizontal + x;
        
        // Create tile texture
        const tileTexture = new PIXI.Texture({
          source: this.texture.source,
          frame: new PIXI.Rectangle(
            x * this.tileSize, 
            y * this.tileSize, 
            this.tileSize, 
            this.tileSize
          )
        });
        
        // Create sprite
        const sprite = new PIXI.Sprite(tileTexture);
        sprite.x = x * this.tileSize * this.scale;
        sprite.y = y * this.tileSize * this.scale;
        sprite.scale.set(this.scale);
        this.debugContainer.addChild(sprite);
        
        // Add text label with index number
        const text = new PIXI.Text({
          text: index.toString(),
          style: {
            fontSize: 8,
            fill: 0xffff00,
            stroke: { color: 0x000000, width: 2 }
          }
        });
        text.x = sprite.x + 2;
        text.y = sprite.y + 2;
        this.debugContainer.addChild(text);
      }
    }
    
    // Center the grid on screen
    this.debugContainer.x = (window.innerWidth - (this.tilesHorizontal * this.tileSize * this.scale)) / 2;
    this.debugContainer.y = (window.innerHeight - (this.tilesVertical * this.tileSize * this.scale)) / 2;
  }
  
  destroy() {
    this.debugContainer.destroy({ children: true });
  }
}