import Matter from "matter-js";

/**
 * PhysicsManager - Handles all Matter.js physics operations
 */
export class PhysicsManager {
  constructor() {
    this.Engine = Matter.Engine;
    this.World = Matter.World;
    this.Bodies = Matter.Bodies;
    this.Body = Matter.Body;

    // Create physics engine
    this.engine = this.Engine.create();
    this.engine.gravity.y = 2;

    // Track all physics objects
    this.physicsObjects = [];

    // Create ground
    this.createGround();
  }

  /**
   * Create the ground body
   */
  createGround() {
    const ground = this.Bodies.rectangle(
      window.innerWidth / 2,
      window.innerHeight + 50,
      window.innerWidth * 2,
      100,
      { isStatic: true }
    );
    this.World.add(this.engine.world, ground);
  }

  /**
   * Update physics simulation and sync sprites
   * Call this every frame
   */
  update() {
    this.Engine.update(this.engine, 1000 / 60);

    this.physicsObjects.forEach((obj) => {
      if (obj.sprite && obj.body) {
        // Sync sprite to physics body
        obj.sprite.x = obj.body.position.x;
        obj.sprite.y = obj.body.position.y;
        obj.sprite.rotation = obj.body.angle;

        // Stop moving rubble after a short time
        if (obj.created && Date.now() - obj.created > 3000) {
          this.Body.setStatic(obj.body, true);
        }

        // Also stop if velocity is very low
        const vel = obj.body.velocity;
        if (
          Math.abs(vel.x) < 0.1 &&
          Math.abs(vel.y) < 0.1 &&
          Math.abs(obj.body.angularVelocity) < 0.01
        ) {
          this.Body.setStatic(obj.body, true);
        }
      }
    });
  }

  /**
   * Add a physics object (sprite + body pair)
   * @param {PIXI.Sprite} sprite - The sprite to track
   * @param {Matter.Body} body - The physics body
   */
  addPhysicsObject(sprite, body) {
    this.World.add(this.engine.world, body);
    const physicsObj = { 
      sprite, 
      body, 
      created: Date.now() 
    };
    this.physicsObjects.push(physicsObj);
    return physicsObj;
  }

  /**
   * Create a rectangular physics body
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Width
   * @param {number} height - Height
   * @param {Object} options - Matter.js body options
   * @returns {Matter.Body} - Created body
   */
  createRectangleBody(x, y, width, height, options = {}) {
    return this.Bodies.rectangle(x, y, width, height, options);
  }

  /**
   * Set velocity on a body
   * @param {Matter.Body} body - The body
   * @param {Object} velocity - {x, y} velocity vector
   */
  setVelocity(body, velocity) {
    this.Body.setVelocity(body, velocity);
  }

  /**
   * Set angular velocity on a body
   * @param {Matter.Body} body - The body
   * @param {number} velocity - Angular velocity
   */
  setAngularVelocity(body, velocity) {
    this.Body.setAngularVelocity(body, velocity);
  }

  /**
   * Clear all physics objects
   */
  clear() {
    this.physicsObjects.forEach((obj) => {
      if (obj.body) {
        this.World.remove(this.engine.world, obj.body);
      }
    });
    this.physicsObjects = [];
  }

  /**
   * Get all physics objects
   * @returns {Array} - Array of physics objects
   */
  getPhysicsObjects() {
    return this.physicsObjects;
  }
}