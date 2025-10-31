export class Player{
  constructor(name=null){
    this.name = null
    this.score = 0;
    this.foundPrimes = {};
    this.missedPrimes = {}
  }

  updateScore(points){
    this.score += points
  }

  addName(firstName){
    // eventually add in player name for high score!
    this.name = firstName
  }
}