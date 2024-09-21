class Player {
  constructor({x, y, score, id}) {
    this.x = x;
    this.y = y;
    this.score = score;
    this.id = id;
  }

  /*** Start: Implementation v2 ***/
  movePlayer(dir, speed) {
    if (dir == "left") {  // action when pressing left key
      this.x -= speed;
      // console.log(this.x);
    } else if (dir == "up") { // action when pressing up key
      this.y -= speed;
      // console.log(this.y);
    } else if (dir == "right") { // action when pressing right key
      this.x += speed;
      // console.log(this.x);
    } else if (dir == "down") { // action when pressing down key
      this.y += speed;
      // console.log(this.y);
    } 
    
    if (dir == "upleft") {
      this.x -= Math.ceil(speed / Math.sqrt(speed));
      this.y -= Math.ceil(speed / Math.sqrt(speed));
    } else if (dir == "downleft") {
      this.x -= Math.ceil(speed / Math.sqrt(speed));
      this.y += Math.ceil(speed / Math.sqrt(speed));
    } else if (dir == "upright") {
      this.x += Math.ceil(speed / Math.sqrt(speed));
      this.y -= Math.ceil(speed / Math.sqrt(speed));
    } else if (dir == "downright") {
      this.x += Math.ceil(speed / Math.sqrt(speed));
      this.y += Math.ceil(speed / Math.sqrt(speed));
    }
  }

  collision(item) {
    if (item.constructor.name == "Collectible") { // check that item is an instance of class Collectible
      return true;
    }
    return false;
  }

  /***
   * Sends back string after calculating rank of current Player
   */
  calculateRank(arr) {  // returns string (e.g. Rank: 1/1)
    const numOfPlayers = arr.length;  // counts number of players currently in game
    let rank; // checks rank of player based on their score and how they rank against the other player scores

    if (this.score === 0) { // if everyone's score is 0
      rank = numOfPlayers;
    } else {
      const sortedPlayers = arr.sort( //
        (playerA, playerB) => playerB.score - playerA.score
      );
      rank = sortedPlayers.findIndex((player) => player.id === this.id) + 1;
    }
    return `Rank: ${rank} / ${numOfPlayers}`;
  }
  /*** End: Implementation v2 ***/
}

export default Player;
