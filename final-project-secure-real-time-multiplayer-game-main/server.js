require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const expect = require('chai');
const socket = require('socket.io');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const noCache = require('nocache');

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');

const app = express();
const server = http.createServer(app);
const io = socket(server);

app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//For FCC testing purposes and enables user to connect from outside the hosting platform
app.use(cors({origin: '*'})); 

// Info from https://www.npmjs.com/package/helmet/v/6.1.2
app.use(helmet.noSniff());  // Prevent the client from trying to guess / sniff the MIME type.
app.use(helmet.xssFilter());  // Prevent cross-site scripting (XSS) attacks.
app.use(helmet.noCache());  // Nothing from the website is cached in the client. (deprecated but due to unit test requirements, kept in)
app.use(noCache());
app.use(function(req, res, next) {  // The headers say that the site is powered by 'PHP 7.4.3'. (https://github.com/helmetjs/helmet/wiki/How-to-set-a-custom-X%E2%80%93Powered%E2%80%93By-header)
  res.setHeader("x-Powered-By", "PHP 7.4.3");
  next();
});

// Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  }); 

//For FCC testing purposes
fccTestingRoutes(app);
    
// 404 Not Found Middleware
app.use(function(req, res, next) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

const portNum = process.env.PORT || 3000;

/*** Start: Implementation v2 ***/
let playerList = {};
let collectible = {};
const boardElementSize = 540;
let boardEdges;
let activeGame = false;  // by default, inactive game has no collectible or players yet

/***
 * get Edge coordinates based on starting and ending points of a square object
 * Based on: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from
 * Unique merged filtering from: https://stackoverflow.com/questions/20339466/how-to-remove-duplicates-from-a-two-dimensional-array
 */
function getEdgeCoordinates(startPts, endPts) { 
  let northEdge = Array.from({length: (endPts[0] - startPts[0]) + 1 / 1}, (_, i) => [startPts[0] + i, startPts[1]]); // get north coordinates and assign them to a nested array
  let westEdge = Array.from({length: (endPts[1] - startPts[1]) + 1 / 1}, (_, i) => [startPts[0], startPts[1] + i]); // get west coordinates and assign them to a nested array
  let southEdge = Array.from({length: (endPts[0] - startPts[0]) + 1 / 1}, (_, i) => [startPts[0] + i, endPts[1]]); // get south coordinates and assign them to a nested array
  let eastEdge = Array.from({length: (endPts[1] - startPts[1]) + 1 / 1}, (_, i) => [endPts[0], startPts[1] + i]); // get east coordinates and assign them to a nested array

  let mergedEdges = northEdge.concat(westEdge, southEdge, eastEdge);  // combine all edged into one single array ([[199, 306], [200, 308], ...])
  let uniqueEdgeSet = new Set(mergedEdges); // convert to set ({[199, 306], [200, 308], ...})
  const uniqueEdgeArray = [...uniqueEdgeSet]; // remove duplicate values in the single nested array ([[199, 306], [200, 308], ...]])
  return uniqueEdgeArray; // returns nested array that contains all unique edge values
}

/*** 
 * Define the player object with id, coordinates, score, etc.
 */
function setPlayer(playerId, color) {
  // console.log("setting player...");
  let playerStartPts = [Math.ceil(Math.random() * boardElementSize), Math.ceil(Math.random() * boardElementSize)];  // get random x, y values for player starting coordinates
  let playerEndPts = [playerStartPts[0] + 25, playerStartPts[1] + 40];    // assign x, y values for player end coordinates
  let playerCoordinates = getEdgeCoordinates(playerStartPts, playerEndPts);

  let restrictedAreas = boardEdges; // start off with restricted areas on the board
  for (const [key, value] of Object.entries(playerList)) {  // iterate through the properties of all the current players
    if (key !== playerId) { // adds restricted areas of other players other than the one being created
      restrictedAreas = restrictedAreas.concat(value["edgeCoordinates"]); // add edge coordinates of other players to restricted areas list
    }
  }

  let restrictedAreasString = JSON.stringify(restrictedAreas);  // convert boardEdges array to string for easier traversal
  let restrictedArea = playerCoordinates.some((item) => restrictedAreasString.indexOf(JSON.stringify(item)) != -1); // check if player coordinates touch border edges

  while (restrictedArea) {
    playerStartPts = [Math.ceil(Math.random() * boardElementSize), Math.ceil(Math.random() * boardElementSize)];
    playerEndPts = [playerStartPts[0] + 25, playerEndPts[1] + 40];    // assign x, y values for collectible end coordinates
    playerCoordinates = getEdgeCoordinates(playerStartPts, playerEndPts); 
    restrictedArea = playerCoordinates.some((item) => restrictedAreasString.indexOf(JSON.stringify(item)) != -1); // check if player coordinates touch border edges
  }

  playerList[playerId] = {
    "id": playerId,
    "score": 0,
    "rank": 1,
    // "nextRank": 100,
    "x": playerStartPts[0],
    "y": playerStartPts[1],
    "edgeCoordinates": playerCoordinates,
    "playerColor": color,
  }
  // console.log(playerList);
  return playerList;
}

/*** 
 * Generate an id for the collectible
 */
function generateCollectibleId() {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      id += characters[randomIndex];
  }
  return Date.now().toString(16) + id;
}

/*** 
 * Define the collectible object with id, coordinates, score, etc.
 */
function setCollectible() {
  // console.log("setting collectible...")
  collectible = {};
  let collectibleStartPts = [Math.ceil(Math.random() * boardElementSize), Math.ceil(Math.random() * boardElementSize)];  // get random x, y values for player starting coordinates
  let collectibleEndPts = [collectibleStartPts[0] + 14, collectibleStartPts[1] + 20];    // assign x, y values for player end coordinates
  let collectibleCoordinates = getEdgeCoordinates(collectibleStartPts, collectibleEndPts); 

  let restrictedAreas = boardEdges;
  for (const [key, value] of Object.entries(playerList)) {  // iterate through the properties of all the current players
    restrictedAreas = restrictedAreas.concat(value["edgeCoordinates"]); // add edge coordinates of other players to restricted areas list
  }

  let restrictedAreasString = JSON.stringify(restrictedAreas);  // convert boardEdges array to string for easier traversal
  let restrictedArea = collectibleCoordinates.some((item) => restrictedAreasString.indexOf(JSON.stringify(item)) != -1); // check if player coordinates touch border edges

  while (restrictedArea) {  // redefine new collectible coordinates while new collectible hits restricted areas like players or board edges
    collectibleStartPts = [Math.ceil(Math.random() * boardElementSize), Math.ceil(Math.random() * boardElementSize)];
    collectibleEndPts = [collectibleStartPts[0] + 14, collectibleEndPts[1] + 20];    // assign x, y values for collectible end coordinates
    collectibleCoordinates = getEdgeCoordinates(collectibleStartPts, collectibleEndPts); 
    restrictedArea = collectibleCoordinates.some((item) => restrictedAreasString.indexOf(JSON.stringify(item)) != -1); // check if player coordinates touch border edges
  }

  collectible["id"] = generateCollectibleId();
  collectible["status"] = "active";
  collectible["x"] = collectibleStartPts[0];
  collectible["y"] = collectibleStartPts[1];
  collectible["edgeCoordinates"] = collectibleCoordinates,
  collectible["score"] = Math.floor(Math.random() * 100) + 1;

  return collectible;
}

/*** 
 * Checks for collision with edges, other players or collectibles
 */
function checkCollision(id, x, y) {
  let playerStartPts = [x, y];
  let playerEndPts = [x + 25, y + 40];    // assign x, y values for player end coordinates
  let playerCoordinates = getEdgeCoordinates(playerStartPts, playerEndPts); 
  let playerCollisionAreas = [];  // array to store collision areas from other players
  let collisionType = {"board": false, "player": false, "collectible": false};
  
  let boardEdgesString = JSON.stringify(boardEdges);  // convert boardEdges array to string for easier traversal

  const borderViolation = playerCoordinates.some((item) => boardEdgesString.indexOf(JSON.stringify(item)) != -1); // check if player coordinates touch border edges
  collisionType["board"] = borderViolation;

  for (const [key, value] of Object.entries(playerList)) {  // iterate through player areas
    if (key != id) {
      // adds other player areas to restricted
      playerCollisionAreas = playerCollisionAreas.concat(playerList[key]["edgeCoordinates"]);
    }
  }

  let playerCollisionString = JSON.stringify(playerCollisionAreas);  // convert other player coordinates array to string for easier traversal
  const playerViolation = playerCoordinates.some((item) => playerCollisionString.indexOf(JSON.stringify(item)) != -1);   // check if player coordinates touch other player coordinates
  collisionType["player"] = playerViolation;

  let collectibleCollisionString = JSON.stringify(collectible["edgeCoordinates"]);  // convert collible coordinates array to string for easier traversal
  const collectibleViolation = playerCoordinates.some((item) => collectibleCollisionString.indexOf(JSON.stringify(item)) != -1);  // check if player coordinates touch collectible coordinates
  collisionType["collectible"] = collectibleViolation;

  return collisionType;
}

io.on('connection', (socket) => {
  boardEdges = getEdgeCoordinates([0, 0], [540, 540]);  // to list down the edges of the game boards

  socket.on("initializeServer", (args, callback) => {
    let id = args["id"];
    let color = args["color"];
    if (activeGame == false) {  // activeGame is true only when the first client connects or when the victory condition occurs
      playerList = {};
      collectible = {};
      activeGame = true;
    }
    
    setPlayer(id, color); // set player (either as an additional player or the first one)
    io.emit("playerToClient", playerList);
    io.emit("collectibleToClient", Object.keys(collectible).length === 0 ? setCollectible() : collectible);
  });

  socket.on("playerToServer", (args) => {
    let playerId = args["id"];
    let collisionResults = checkCollision(playerId, args["x"], args["y"]);
    let collisionOperation = collisionResults["board"] == true || collisionResults["player"] == true; //checks if player collides with board or player
    if (collisionOperation) { // if player collides with another player of the board
      playerList[playerId]["x"] = playerList[playerId]["x"] == args["x"] ? args["x"] : playerList[playerId]["x"];  // if x coordinates are colliding with restricted areas, revert back to current coordinates
      playerList[playerId]["y"] = playerList[playerId]["y"] == args["y"] ? args["y"] : playerList[playerId]["y"];  // if x coordinates are colliding with restricted areas, revert back to current coordinates
      let playerStartPts = [playerList[playerId]["x"], playerList[playerId]["y"]];
      let playerEndPts = [playerList[playerId]["x"] + 25, playerList[playerId]["y"] + 40];    // assign x, y values for player end coordinates
      playerList[playerId]["edgeCoordinates"] = getEdgeCoordinates(playerStartPts, playerEndPts);
    } else {  // if player collides with collectible 
      if (collisionResults["collectible"] == true) {
        playerList[playerId]["score"] += collectible["score"];
        // console.log(playerList[playerId]["score"], collectible);
        io.emit("collectibleCollided", playerId, collectible);  // signal client that a collectible has been collided with by a player
        collectible = {};
        setCollectible(); // create collectible with new coordinates
      }
      playerList[playerId]["x"] = args["x"];
      playerList[playerId]["y"] = args["y"];
      let playerStartPts = [playerList[playerId]["x"], playerList[playerId]["y"]];
      let playerEndPts = [playerList[playerId]["x"] + 25, playerList[playerId]["y"] + 40];    // assign x, y values for player end coordinates
      playerList[playerId]["edgeCoordinates"] = getEdgeCoordinates(playerStartPts, playerEndPts);
    }
    if (playerList[playerId]["score"] >= 50) {
      io.emit("clearBoard");
      io.emit("playerToClient", playerList);
      io.emit("collectibleToClient", collectible);  // send new collectible object to client to be drawn
      activeGame = false;
      playerList = {};
      collectible = {};
      io.emit("resetGame", {id: playerId});
    } else {
      io.emit("clearBoard");
      io.emit("playerToClient", playerList);
      io.emit("collectibleToClient", collectible);  // send new collectible object to client to be drawn
    }
  });

  // socket.on("deletePlayer", (args) => {
  //   console.log("deleting player", args.id);
  //   delete playerList[args.id];
  //   io.emit("playerToClient", playerList);
  // });

  socket.on("restartGame", (args, callback) => {
    let id = args["id"];
    let color = args["color"];
    // activeGame = false;
    // playerList = {};
    // collectible = {};
    
    setPlayer(id, color); // set player (either as an additional player or the first one)

    // console.log(playerList);
    // console.log(collectible);
    // callback({
    //   playerList: playerList,
    //   collectible: Object.keys(collectible).length === 0 ? setCollectible() : collectible,
    // });

    io.emit("playerToClient", playerList);
    io.emit("collectibleToClient", Object.keys(collectible).length === 0 ? setCollectible() : collectible);
  });

  socket.on("disconnecting", (reason, details) => {
    console.log("disconnecting...");
    // the reason of the disconnection, for example "transport error"
    // socket.emit("deletePlayer", {id: playerId});
    // delete player[playerId];    // remove player if disconnected from game
    console.log(reason);
 
    if (details) {
        // the low-level reason of the disconnection, for example "xhr post error"
        console.log(details.message);

        // some additional description, for example the status code of the HTTP response
        console.log(details.description);

        // some additional context, for example the XMLHttpRequest object
        console.log(details.context);
    }

    delete playerList[socket.id];  // remove specific client using their socket.id
    io.emit("clientDisconnect", socket.id);
    io.emit("clearBoard");
    io.emit("playerToClient", playerList);
    io.emit("collectibleToClient", collectible);  // send new collectible object to client to be drawn
  });

});



// Set up server and tests
server.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV==='test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch (error) {
        console.log('Tests are not valid:');
        console.error(error);
      }
    }, 1500);
  }
});

module.exports = app; // For testing
